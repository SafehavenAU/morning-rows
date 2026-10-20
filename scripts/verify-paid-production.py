"""Offline schema/reference/source-state review of check-information captures.

Usage: python scripts/verify-paid-production.py CAPTURE_DIR REFERENCE_JSON OUTPUT
       [--staged-semantic PREVIEW_REPORT] [--laws-confirmation CONFIRMATION_REPORT]

Reads only supplied files. Requires jsonschema. No publisher requests, credential
access, fixture substitution, or changes to retained input reports.
"""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import quote

from jsonschema import Draft202012Validator, FormatChecker

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("capture_directory", type=Path)
parser.add_argument("reference", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--staged-semantic", type=Path)
parser.add_argument("--laws-confirmation", type=Path)
args = parser.parse_args()

inputs = []


def read(path):
    content = path.read_bytes()
    inputs.append({"file": str(path), "sha256": sha256(content).hexdigest()})
    return json.loads(content)


def body(host, path):
    return read(args.capture_directory / (host + "-" + quote(path, safe="") + ".body"))


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


captured = read(args.capture_directory / "report.json")
reference = read(args.reference)
identity = captured["identity"]
identity_valid = (
    captured.get("pass") is True
    and captured.get("release_mismatches") == []
    and identity.get("source_dirty") is False
    and re.fullmatch(r"[a-f0-9]{40}", identity.get("source_revision", "")) is not None
    and re.fullmatch(r"[a-f0-9]{16}", identity.get("build_fingerprint", "")) is not None
    and re.fullmatch(r"[a-f0-9-]{36}", identity.get("worker_version", "")) is not None
    and all(
        r.get("headers", {}).get("x-source-revision") == identity["source_revision"]
        and r.get("headers", {}).get("x-worker-version") == identity["worker_version"]
        for r in captured["requests"]
    )
)
assert reference.get("pass") is True, "Independent reference report failed"
slots = {r["period"]: r["value_text"] for r in reference["checks"]}
assert len(slots) == len(reference["checks"]) == 13, "Reference must contain 13 unique slots"
desks = [
    "australia", "new-zealand", "canada", "united-kingdom", "england",
    "scotland", "wales", "northern-ireland", "united-states",
]
checks, comparisons, counts, source_states = [], [], {}, {}
selection = "/united-states.json?source=cpi&measure=CUUR0000SA0"

for host in ["apex", "www"]:
    schemas = {"v1": body(host, "/schema.json"), "v2": body(host, "/schema.v2.json")}
    validators = {}
    for key, schema in schemas.items():
        Draft202012Validator.check_schema(schema)
        validators[key] = Draft202012Validator(schema, format_checker=FormatChecker())
    paths = ["/catalog.json", "/catalog.v2.json"] + ["/" + d + ".json" for d in desks] + [selection]
    selected = None
    for path in paths:
        document = body(host, path)
        version = "v2" if path.startswith("/united-states") or path == "/catalog.v2.json" else "v1"
        errors = [e.message for e in validators[version].iter_errors(document)]
        checks.append({"domain": host, "path": path, "schema": version, "pass": not errors, "errors": errors})
        if path == selection:
            selected = document
        if path in ["/" + d + ".json" for d in desks]:
            source_states[host + path] = {
                **document.get("sources", {}),
                **{"also." + k: v for k, v in document.get("also", {}).get("sources", {}).items()},
            }
    seen = set()
    for row in selected["observations"]:
        period = row["period"]
        expected = slots.get(period)
        unique_known = period in slots and period not in seen
        seen.add(period)
        if expected is None:
            # The workbook uses null plus its note; the reader keeps the printed
            # dash alongside a null number and the publisher's explicit X flag.
            equal = (
                period == "2025-10"
                and "Oct 2025" in reference.get("note", "")
                and "lapse in appropriations" in reference.get("note", "")
                and row["value"] is None
                and row["value_text"] == "-"
                and row["value_state"] == "unavailable"
                and row["footnotes"] == [{
                    "code": "X", "text": "Data unavailable due to the 2025 lapse in appropriations",
                }]
            )
        else:
            equal = (
                row["value_text"] == expected
                and row["value_state"] == "observed"
                and Decimal(str(row["value"])) == Decimal(expected)
            )
        comparisons.append({
            "domain": host, "period": period, "expected_value_text": expected,
            "observed_value_text": row["value_text"], "value_state": row["value_state"],
            "pass": unique_known and equal,
        })
    counts[host] = {
        "slots": len(selected["observations"]), "unique_periods": len(seen),
        "reference_coverage": seen == set(slots),
    }

comparison = None
if args.staged_semantic:
    staged = read(args.staged_semantic)
    assert staged.get("pass") is True, "Staged semantic report failed"
    confirmation = read(args.laws_confirmation) if args.laws_confirmation else None
    changes = []
    for key, states in source_states.items():
        host, desk = key.split("/", 1)
        before = staged["source_status"][desk.removesuffix(".json")]
        for source in sorted(set(before) | set(states)):
            old, new = before.get(source), states.get(source)
            if (old or {}).get("status") == (new or {}).get("status"):
                continue
            known_tfl = (
                desk == "england.json" and source in ["service", "rail", "also.roads"]
                and old is not None and new is not None
                and {old.get("status"), new.get("status")} == {"ok", "error"}
                and all(x.get("status") == "ok" or x.get("http_status") == 429 for x in [old, new])
            )
            resolved_laws = False
            if host == "apex" and desk == "australia.json" and source == "laws" and confirmation:
                retrieval = confirmation.get("body", {}).get("retrieval", {})
                resolved_laws = (
                    confirmation.get("url") == "https://morningrows.com/australia.json?source=laws"
                    and confirmation.get("status") == 200
                    and confirmation.get("headers", {}).get("x-source-revision") == identity["source_revision"]
                    and confirmation.get("headers", {}).get("x-worker-version") == identity["worker_version"]
                    and retrieval.get("status") == "ok"
                    and timestamp(retrieval["retrieved_at"]) > timestamp(new["fetched_at"])
                    and source_states["www/australia.json"].get("laws", {}).get("status") == "ok"
                )
            classification = (
                "known intermittent TfL status change" if known_tfl else
                "isolated timeout resolved by later same-version retrieval" if resolved_laws else
                "requires review"
            )
            changes.append({
                "domain": host, "desk": desk, "source": source,
                "staged": old, "production": new, "classification": classification,
                "resolved_laws_evidence": str(args.laws_confirmation) if resolved_laws else None,
            })
    comparison = {
        "compared_source_states": sum(len(s) for s in source_states.values()),
        "changes": changes,
        "requires_review": [c for c in changes if c["classification"] == "requires review"],
        "semantic_boundary": "Native source availability is not independent certification of coverage or correctness.",
    }

passed = (
    identity_valid
    and all(c["pass"] for c in checks + comparisons)
    and all(c["slots"] == c["unique_periods"] == 13 and c["reference_coverage"] for c in counts.values())
    and (comparison is None or not comparison["requires_review"])
)
report = {
    "checked_at": datetime.now(timezone.utc).isoformat(),
    "method": "Offline Draft2020-12/format assertions and Decimal comparison against separate retained Python workbook extraction",
    "identity_valid": identity_valid, "identity": identity, "inputs": inputs,
    "schema_checks": checks, "us_comparisons": comparisons, "counts": counts,
    "source_comparison": comparison, "pass": passed,
    "missing_value_comparison": "Workbook null with the October 2025 note equals public null numeric value, dash text, unavailable state and exact X footnote.",
    "limitations": [
        "All BLS presentations share statistical lineage; this is separate extraction/presentation evidence.",
        "Does not make new network requests or establish sustained monitoring acceptance.",
        "Original failed or mixed-rollout captures remain separate evidence and are not rewritten.",
    ],
}
args.output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({
    "pass": passed, "schema_documents": len(checks), "us_slot_comparisons": len(comparisons),
    "source_states": comparison["compared_source_states"] if comparison else None,
    "source_changes": len(comparison["changes"]) if comparison else None,
    "requires_review": comparison["requires_review"] if comparison else None,
    "output": str(args.output),
}))
raise SystemExit(0 if passed else 1)
