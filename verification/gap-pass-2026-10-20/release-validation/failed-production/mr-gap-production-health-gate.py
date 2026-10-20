"""Offline production schema/BLS and source-health gate with explicit SEPA scope.

Usage: python /tmp/mr-gap-production-health-gate.py CAPTURE REFERENCE OUTPUT STAGE_GATE STAGE_STRICT
Run from the exact release repository. Never rewrites an input or existing output.
This gate does not replace independent gap numerical/schema acceptance.
"""
import argparse
import copy
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import quote

DESKS = {
    "australia": "Australia", "new-zealand": "New Zealand", "canada": "Canada",
    "united-kingdom": "United Kingdom", "england": "England", "scotland": "Scotland",
    "wales": "Wales", "northern-ireland": "Northern Ireland", "united-states": "United States",
}
SEPA = "SEPA Galashiels observation"


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def read(path):
    return json.loads(path.read_bytes())


def write_new(path, value):
    with path.open("x") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def check_stage(gate, strict, strict_hash):
    require(gate.get("release_gate_pass") is True and gate.get("strict_semantics_pass") is False,
            "Stage release gate does not declare the explicit strict failure")
    require(gate.get("strict_report_sha256") == strict_hash, "Stage gate/strict hash mismatch")
    failures = [c for c in strict["checks"] if not c["pass"]]
    require(strict.get("pass") is False and len(failures) == 1 and failures[0]["name"] == SEPA,
            "Stage has a failure outside the explicit SEPA boundary")
    exceptions = gate.get("unresolved_source_availability", [])
    require(len(exceptions) == 1 and exceptions[0].get("source") == "scotland/river_level"
            and exceptions[0].get("status") == "error" and exceptions[0].get("http_status") == 503,
            "Unexpected or broadened stage exception")
    state = strict["source_status"]["scotland"]["river_level"]
    require(state.get("status") == "error" and state.get("http_status") == 503,
            "Stage SEPA source does not match the documented exception")


def validate_semantics(report, states):
    failures = [c for c in report["checks"] if not c["pass"]]
    sepa = states["scotland"]["river_level"]
    permitted = (len(failures) == 1 and failures[0]["name"] == SEPA
                 and sepa.get("status") == "error" and sepa.get("http_status") == 503
                 and "timeseries.sepa.org.uk returned HTTP 503" == sepa.get("error"))
    require(not failures or permitted, "Production strict semantics has an unapproved failure")
    return {"strict_semantics_pass": not failures, "release_semantic_gate_pass": True,
            "exception": "unchanged evidenced SEPA HTTP503 only" if permitted else None}


def classify(desk, source, old, new, strict_checks):
    if not isinstance(old, dict) or not isinstance(new, dict):
        return "requires_review_missing_or_added_source"
    before, after = old.get("status"), new.get("status")
    if before == after == "ok":
        return "unchanged_healthy"
    if desk == "australia" and source == "grid_day":
        return ("parser_healthy_recovery_conditional_on_independent_gap_gate"
                if after == "ok" else "requires_review_AEMO_not_healthy")
    if desk == "scotland" and source == "river_level":
        if before == after == "error" and old.get("http_status") == new.get("http_status") == 503 \
                and old.get("error") == new.get("error"):
            return "unchanged_evidenced_SEPA_503"
        if before == "error" and after == "ok" and strict_checks.get(SEPA) is True:
            return "SEPA_strict_semantic_recovery"
        return "requires_review_SEPA_outside_503_boundary"
    if desk == "england" and source in {"service", "rail", "also.roads"} \
            and all(s.get("status") == "ok" or (s.get("status") == "error" and s.get("http_status") == 429
                    and s.get("error") == "api.tfl.gov.uk returned HTTP 429") for s in [old, new]):
        return "known_intermittent_TfL_429"
    if before == after == "error":
        if old.get("http_status") == new.get("http_status") and old.get("error") == new.get("error"):
            return "unchanged_known_failure"
        if old.get("http_status") in {403, 429} and new.get("http_status") in {403, 429} \
                and old.get("error") == f"www.ons.gov.uk returned HTTP {old['http_status']}" \
                and new.get("error") == f"www.ons.gov.uk returned HTTP {new['http_status']}":
            return "known_ONS_403_429_availability_change"
    if before in {"error", "degraded"} and after == "ok":
        return "parser_healthy_recovery_not_independent_numerical_certification"
    return "requires_review_new_or_changed_failure"


def compare_states(staged, production, semantic):
    changes, failures, count = [], [], 0
    require(set(staged) == set(production) == set(DESKS), "Missing or added desk")
    strict_checks = {c["name"]: c["pass"] for c in semantic["checks"]}
    for desk in DESKS:
        for source in sorted(set(staged[desk]) | set(production[desk])):
            old, new = staged[desk].get(source), production[desk].get(source)
            classification = classify(desk, source, old, new, strict_checks)
            row = {"desk": desk, "source": source, "staged": old, "production": new,
                   "classification": classification}
            count += 1
            if classification.startswith("requires_review"):
                failures.append(row)
            if classification not in {"unchanged_healthy", "unchanged_known_failure"}:
                changes.append(row)
    return {"compared_source_states": count, "changes": changes, "requires_review": failures}


def check_geographies(documents):
    for desk, country in DESKS.items():
        require(documents[desk].get("country") == country, f"Wrong country for {desk}")


def selftest(output):
    healthy = {"status": "ok"}
    failed = {"status": "error", "http_status": 503, "error": "source returned HTTP 503"}
    controls = []
    for label, condition in [
        ("new_GDP_failure_rejected", classify("canada", "product", healthy, failed, {}).startswith("requires_review")),
        ("SEPA_wrong_failure_rejected", classify("scotland", "river_level",
            {"status": "error", "http_status": 503}, {"status": "error", "http_status": 403}, {}).startswith("requires_review")),
        ("AEMO_unhealthy_rejected", classify("australia", "grid_day", failed, failed, {}).startswith("requires_review")),
        ("AEMO_recovery_conditional", classify("australia", "grid_day", failed, healthy, {}).endswith("independent_gap_gate")),
        ("SEPA_recovery_requires_semantics", classify("scotland", "river_level", failed, healthy, {}).startswith("requires_review")),
        ("new_source_rejected", classify("canada", "unknown", None, healthy, {}).startswith("requires_review")),
    ]:
        controls.append({"name": label, "pass": condition})
    documents = {desk: {"country": country} for desk, country in DESKS.items()}
    documents["canada"]["country"] = "England"
    try:
        check_geographies(documents)
        rejected = False
    except ValueError:
        rejected = True
    controls.append({"name": "wrong_desk_geography_rejected", "pass": rejected})
    try:
        validate_semantics({"checks": [{"name": "Canada GDP correctness", "pass": False}]},
                           {"scotland": {"river_level": {"status": "error", "http_status": 503}}})
        rejected = False
    except ValueError:
        rejected = True
    controls.append({"name": "unrelated_semantic_failure_rejected", "pass": rejected})
    result = {"kind": "Offline wrapper decision controls; constructed, not publisher evidence",
              "pass": all(c["pass"] for c in controls), "checks": controls,
              "script_sha256": digest(Path(__file__))}
    write_new(output, result)
    print(json.dumps({"pass": result["pass"], "controls": len(controls)}))
    return 0 if result["pass"] else 1


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--self-test":
        return selftest(Path(sys.argv[2]))
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["capture", "reference", "output", "stage_gate", "stage_strict"]:
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    repo = Path.cwd()
    base_output = args.output.with_name(args.output.stem + ".base.json")
    semantic_outputs = {host: args.output.with_name(args.output.stem + "." + host + "-strict.json")
                        for host in ["apex", "www"]}
    for path in [args.output, base_output, *semantic_outputs.values()]:
        require(not path.exists(), f"Refusing existing output: {path}")
    inputs = [{"path": str(path), "sha256": digest(path)} for path in
              [args.capture / "report.json", args.reference, args.stage_gate, args.stage_strict,
               repo / "scripts/verify-paid-production.py", repo / "scripts/verify-preview-bodies.mjs",
               Path(__file__)]]
    result = {"kind": "Offline production source-health gate preserving strict SEPA failure",
              "checked_at": datetime.now(timezone.utc).isoformat(), "inputs": inputs, "pass": False,
              "scope": "Schema/BLS/source availability only; independent gap, GDP, claimant and rent gates remain required",
              "independent_gap_gate_required": True, "source_comparison": {}, "semantic": {}}
    try:
        gate, staged = read(args.stage_gate), read(args.stage_strict)
        check_stage(gate, staged, digest(args.stage_strict))
        captured, reference = read(args.capture / "report.json"), read(args.reference)
        require(captured["identity"] == staged["identity"], "Production identity differs from exact stage")
        completed = subprocess.run([sys.executable, str(repo / "scripts/verify-paid-production.py"),
                                    str(args.capture), str(args.reference), str(base_output)],
                                   capture_output=True, text=True)
        require(base_output.exists(), "Base schema/BLS checker produced no report")
        base = read(base_output)
        result["base"] = {"file": str(base_output), "sha256": digest(base_output),
                          "pass": base.get("pass"), "exit_code": completed.returncode}
        require(completed.returncode == 0 and base.get("pass") is True, "Base schema/BLS gate failed")
        result["identity"] = base["identity"]
        for host in ["apex", "www"]:
            documents = {desk: read(args.capture / (host + "-" + quote("/" + desk + ".json", safe="") + ".body"))
                         for desk in DESKS}
            check_geographies(documents)
            with tempfile.TemporaryDirectory(prefix="mr-production-semantic-") as temporary:
                directory = Path(temporary)
                paths = ["/health.json", "/catalog.json", "/schema.json", "/catalog.v2.json", "/schema.v2.json"]
                paths += ["/" + desk + ".json" for desk in DESKS]
                for path in paths:
                    original = args.capture / (host + "-" + quote(path, safe="") + ".body")
                    matching = [r for r in captured["requests"] if r["path"] == path and r.get("method", "GET") == "GET"
                                and r["origin"] == ("https://morningrows.com" if host == "apex" else "https://www.morningrows.com")
                                and r["status"] == 200]
                    require(matching and any(r["bytes"] == original.stat().st_size for r in matching),
                            f"Missing successful transport for {host}{path}")
                    (directory / (path.replace("/", "_") + ".response")).write_bytes(original.read_bytes())
                env = {**os.environ, "EXPECTED_REVISION": base["identity"]["source_revision"],
                       "EXPECTED_US_LATEST": max(row["period"] for row in reference["checks"])}
                process = subprocess.run(["node", str(repo / "scripts/verify-preview-bodies.mjs"),
                                          str(directory), str(semantic_outputs[host])],
                                         env=env, capture_output=True, text=True)
                require(semantic_outputs[host].exists(), "Strict semantics produced no report")
            strict = read(semantic_outputs[host])
            require(strict["identity"] == base["identity"], "Production strict identity mismatch")
            states = strict["source_status"]
            result["semantic"][host] = {**validate_semantics(strict, states),
                                        "file": str(semantic_outputs[host]), "sha256": digest(semantic_outputs[host]),
                                        "strict_exit_code": process.returncode}
            comparison = compare_states(staged["source_status"], states, strict)
            result["source_comparison"][host] = comparison
            require(not comparison["requires_review"], f"New unapproved source failure on {host}")
        result["pass"] = True
    except (AssertionError, ValueError, KeyError, TypeError, OSError) as error:
        result["error"] = str(error)
    write_new(args.output, result)
    print(json.dumps({"pass": result["pass"], "output": str(args.output),
                      "requires_review": [x for c in result["source_comparison"].values()
                                          for x in c["requires_review"]], "error": result.get("error")}))
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
