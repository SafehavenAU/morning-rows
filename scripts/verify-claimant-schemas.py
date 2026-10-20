"""Offline schema checks of actual claimant-count HTTP captures.

Usage:
  python scripts/verify-claimant-schemas.py CAPTURE_DIR OUTPUT_JSON
    [--schema-capture DIR] [--expected-revision SHA] [--expected-version UUID]

CAPTURE_DIR contains check-claimants.mjs's claimant-interface-report.json and
retained response files. The schema comes from /schema.json in the same
directory's staged-preview-report.json, or check-information.mjs's report.json
in --schema-capture DIR. No runtime imports, fixtures, requests or credentials.
OUTPUT_JSON must be a new path; existing evidence is never overwritten.
Requires the Python jsonschema package.
"""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import quote

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError


NATIONS = {
    "united-kingdom": ("United Kingdom", "K02000001"),
    "england": ("England", "E92000001"),
    "scotland": ("Scotland", "S92000003"),
    "wales": ("Wales", "W92000004"),
    "northern-ireland": ("Northern Ireland", "N92000002"),
}
APEX = "https://morningrows.com"
SCHEMA_ID = APEX + "/schema.json"
PERIOD = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
REVISION = re.compile(r"^[a-f0-9]{40}$")
VERSION = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture_directory", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--schema-capture", type=Path)
    parser.add_argument("--expected-revision")
    parser.add_argument("--expected-version")
    args = parser.parse_args()
    if args.output.exists():
        print(json.dumps({"pass": False, "error": "Output already exists; choose a new evidence path", "output": str(args.output)}))
        return 1
    capturedir = args.capture_directory.resolve()
    schemadir = (args.schema_capture or capturedir).resolve()
    inputs, schema_checks, negative_checks, boundaries = [], [], [], []
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "method": "Offline Draft 2020-12 and format assertions against captured schema.json; semantic mutations of actual captured responses",
        "capture_directory": str(capturedir), "schema_capture_directory": str(schemadir),
        "inputs": inputs, "schema_checks": schema_checks,
        "negative_contracts": negative_checks, "windows": boundaries,
        "limitations": [
            "This checks retained capture consistency, schema behavior and bounded history. It makes no HTTP requests and cannot independently authenticate a supplied capture.",
            "Schema acceptance is separate from publisher numerical reconciliation, CPU acceptance, production promotion and sustained monitoring.",
            "Negative cases are mutations of actual captures, not additional publisher observations.",
            "Historical fixtures and constructed fault previews are not used as actual-release proof.",
        ],
        "pass": False,
    }
    used_paths, encountered_paths = set(), set()

    def require(condition, message):
        if not condition:
            raise ValueError(message)

    def read(path):
        path = path.resolve()
        encountered_paths.add(path)
        require(path != args.output.resolve(), "Output must not overwrite an input")
        raw = path.read_bytes()
        if path not in used_paths:
            inputs.append({"file": str(path), "bytes": len(raw), "sha256": sha256(raw).hexdigest()})
            used_paths.add(path)
        return raw, json.loads(raw)

    def local_file(directory, name):
        path = (directory / name).resolve()
        require(path.is_relative_to(directory), "Capture path leaves its directory")
        return path

    def unique_record(capture, origin, path):
        rows = [
            r for r in capture.get("requests", [])
            if r.get("origin") == origin and r.get("path") == path
            and r.get("method", "GET") == "GET" and not r.get("conditional", False)
            and r.get("status") == 200
        ]
        require(len(rows) == 1, f"Require one successful unconditional GET: {origin}{path}")
        row = rows[0]
        headers = row.get("headers", {})
        require(headers.get("x-source-revision") == revision and headers.get("x-worker-version") == version,
                f"Mixed release identity: {origin}{path}")
        return row

    def retained_body(capture, directory, origin, path, *, require_hash):
        row = unique_record(capture, origin, path)
        filename = row.get("file")
        if filename is None:
            # check-information.mjs uses this deterministic filename but does not
            # record per-body SHA256; this verifier records its actual input hash.
            require(not require_hash, f"Missing retained body filename: {path}")
            filename = ("www" if origin == "https://www.morningrows.com" else "apex") + "-" + quote(path, safe="") + ".body"
        raw, body = read(local_file(directory, filename))
        require(row.get("bytes") == len(raw), f"Retained body byte length differs: {origin}{path}")
        if require_hash or row.get("sha256") is not None:
            require(row.get("sha256") == sha256(raw).hexdigest(), f"Retained body hash differs: {origin}{path}")
        return body

    def reject_remote_refs(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in ("$ref", "$dynamicRef"):
                    require(isinstance(item, str) and item.startswith("#"), "External schema references are not allowed offline")
                reject_remote_refs(item)
        elif isinstance(value, list):
            for item in value:
                reject_remote_refs(item)

    def validate(validator, body, origin, path):
        errors = list(validator.iter_errors(body))
        schema_checks.append({
            "origin": origin, "path": path, "pass": not errors,
            "errors": [{"path": "/" + "/".join(map(str, e.absolute_path)), "message": e.message} for e in errors[:5]],
        })

    def mutate_negative(validator, body, origin, path, name, mutate):
        changed = deepcopy(body)
        mutate(changed)
        require(changed != body, f"Negative case did not mutate its input: {name}")
        negative_checks.append({
            "origin": origin, "path": path, "case": name,
            "pass": not validator.is_valid(changed),
        })

    def window(native, desk):
        require(isinstance(native, dict), f"Missing native claimant data: {desk}")
        rows, metadata = native.get("rows"), native.get("metadata", {})
        require(isinstance(rows, list) and len(rows) == 13, f"Require thirteen native rows: {desk}")
        periods = [r.get("period") for r in rows]
        require(all(isinstance(p, str) and PERIOD.fullmatch(p) for p in periods), f"Invalid native month: {desk}")
        ordinals = [int(p[:4]) * 12 + int(p[5:]) for p in periods]
        require(ordinals == list(range(ordinals[0], ordinals[0] + 13)), f"Require ordered contiguous unique months: {desk}")
        require(metadata.get("count") == 13 and metadata.get("first_period") == periods[0] and metadata.get("latest_period") == periods[-1],
                f"Native metadata disagrees with retained history: {desk}")
        return periods[0], periods[-1]

    try:
        _, captured = read(capturedir / "claimant-interface-report.json")
        require(captured.get("pass") is True, "Claimant interface capture did not pass")
        revision, version = captured.get("revision"), captured.get("version")
        require(isinstance(revision, str) and REVISION.fullmatch(revision), "Invalid capture source revision")
        require(isinstance(version, str) and VERSION.fullmatch(version), "Invalid capture Worker version")
        require(args.expected_revision is None or revision == args.expected_revision, "Unexpected source revision")
        require(args.expected_version is None or version == args.expected_version, "Unexpected Worker version")
        kind = captured.get("kind")
        require(kind in ("Exact zero-percent candidate interface", "Production interface"), "Unknown capture kind")
        staged = kind == "Exact zero-percent candidate interface"
        origins = [APEX] if staged else [APEX, "https://www.morningrows.com"]
        report.update({"capture_kind": kind, "source_revision": revision, "worker_version": version})
        schema_report_file = schemadir / ("staged-preview-report.json" if staged else "report.json")
        _, schema_capture = read(schema_report_file)
        require(schema_capture.get("pass") is True, "Schema capture report did not pass")
        schema_identity = schema_capture.get("identity", {})
        require(schema_identity.get("source_revision") == revision and schema_identity.get("worker_version") == version
                and schema_identity.get("source_dirty") is False, "Schema capture identity differs or is not clean")

        expected_window = None
        for origin in origins:
            health = retained_body(captured, capturedir, origin, "/health.json", require_hash=True)
            require(health.get("source_revision") == revision and health.get("worker_version") == version
                    and health.get("source_dirty") is False
                    and re.fullmatch(r"[a-f0-9]{16}", health.get("build_fingerprint", "")) is not None,
                    f"Invalid clean release health: {origin}")
            require(health.get("build_fingerprint") == schema_identity.get("build_fingerprint"), "Schema/capture fingerprint differs")
            schema = retained_body(schema_capture, schemadir, origin, "/schema.json", require_hash=staged)
            require(schema.get("$id") == SCHEMA_ID and schema.get("$schema") == "https://json-schema.org/draft/2020-12/schema",
                    "Unexpected captured schema identity/dialect")
            reject_remote_refs(schema)
            Draft202012Validator.check_schema(schema)
            validator = Draft202012Validator(schema, format_checker=FormatChecker())
            for desk, (name, code) in NATIONS.items():
                fullpath = "/" + desk + ".json"
                full = retained_body(captured, capturedir, origin, fullpath, require_hash=True)
                require(full.get("country") == name and full.get("sources", {}).get("claimant_count", {}).get("status") == "ok",
                        f"Missing healthy national claimant source: {desk}")
                native = full.get("claimant_count")
                first, last = window(native, desk)
                require(native.get("definition", {}).get("geography_code") == code, f"Wrong native geography: {desk}")
                if expected_window is None:
                    expected_window = (first, last)
                require((first, last) == expected_window, "Captured desks/domains use different release windows")
                boundaries.append({"origin": origin, "desk": desk, "first_period": first, "latest_period": last, "slots": 13})
                validate(validator, full, origin, fullpath)
                full_bad = [
                    ("wrong native geography", lambda b: b["claimant_count"]["rows"][0].__setitem__("geography_code", "E09000001")),
                    ("wrong native unit", lambda b: b["claimant_count"]["rows"][0].__setitem__("unit", "percent")),
                    ("wrong native adjustment", lambda b: b["claimant_count"]["definition"].__setitem__("adjustment", "seasonally adjusted")),
                    ("wrong native population definition", lambda b: b["claimant_count"]["definition"].__setitem__("population", "ILO unemployed persons")),
                    ("partial native history", lambda b: b["claimant_count"]["rows"].pop()),
                ]
                for label, mutate in full_bad:
                    mutate_negative(validator, full, origin, fullpath, label, mutate)
                source = fullpath + "?source=claimant_count"
                measure = source + "&measure=claimants"
                for path in [source, measure, measure + "&observation=" + first, measure + "&observation=" + last]:
                    selected = retained_body(captured, capturedir, origin, path, require_hash=True)
                    require("error" not in selected and selected.get("retrieval", {}).get("status") == "ok", f"Selected claimant response failed: {path}")
                    require(selected.get("source") == APEX + source and selected.get("id") == APEX + path,
                            f"Wrong selected identity: {path}")
                    validate(validator, selected, origin, path)
                    bad = [
                        ("wrong geography", lambda b: b["observations"][0]["definition"].__setitem__("geography_code", "E09000001")),
                        ("wrong unit", lambda b: b["observations"][0]["definition"].__setitem__("unit", "percent")),
                        ("wrong adjustment", lambda b: b["observations"][0]["definition"].__setitem__("adjustment", "seasonally adjusted")),
                        ("wrong population definition", lambda b: b["observations"][0]["definition"]["dimensions"].__setitem__("age", "1")),
                        ("missing observation", lambda b: b["observations"].pop()),
                        ("suppressed claimed as observed", lambda b: b["observations"][0]["qualifications"].__setitem__("obs_conf", "C")),
                        ("unrounded person count", lambda b: b["observations"][0].__setitem__("value", 1)),
                    ]
                    if path in (source, measure):
                        bad.append(("partial selected history", lambda b: b["data"].pop()))
                    else:
                        bad.append(("history substituted for exact month", lambda b: b.__setitem__("data", [b["data"]])))
                    for label, mutate in bad:
                        mutate_negative(validator, selected, origin, path, label, mutate)
        require(len(schema_checks) == 25 * len(origins), "Incomplete expected actual-response coverage")
        require(len(negative_checks) == 185 * len(origins), "Incomplete semantic negative coverage")
        report["pass"] = all(c["pass"] for c in schema_checks + negative_checks)
    except (ValueError, OSError, KeyError, TypeError, IndexError, SchemaError) as error:
        report["error"] = str(error)
    if args.output.resolve() not in encountered_paths:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        try:
            with args.output.open("x") as destination:
                destination.write(json.dumps(report, indent=2) + "\n")
        except FileExistsError:
            report["pass"] = False
            report["error"] = "Output appeared during verification; existing evidence was preserved"
    print(json.dumps({
        "pass": report["pass"], "responses_validated": len(schema_checks),
        "negative_contracts": len(negative_checks), "error": report.get("error"),
        "output": str(args.output),
    }))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
