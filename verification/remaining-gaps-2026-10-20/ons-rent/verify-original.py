#!/usr/bin/env python3
"""Independent pinned ONS JSON/narrative/workbook-cell reconciliation. No network."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
PRIOR = ROOT.parent / "prior-audit" / "ons-rent"
SPEC = [
    ("bedroom_1", "one_bed", "one_bedroom", "One bedroom"),
    ("bedroom_2", "two_bed", "two_bedrooms", "Two bedrooms"),
    ("bedroom_3", "three_bed", "three_bedrooms", "Three bedrooms"),
    ("bedroom_4_plus", "four_or_more_bed", "four_or_more_bedrooms", "Four or more bedrooms"),
]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--wire-root", type=Path)
    p.add_argument("--output", type=Path, default=ROOT / "independent-report.json")
    args = p.parse_args()
    manifest = json.loads((ROOT / "original/manifest.json").read_text())
    for entry in manifest["retained"]:
        b = (ROOT / "original" / entry["path"]).read_bytes()
        assert len(b) == entry["bytes"] and hashlib.sha256(b).hexdigest() == entry["sha256"]
    if args.wire_root:
        for entry in manifest["acquisitions"]:
            b = (args.wire_root / entry["file"]).read_bytes()
            assert len(b) == entry["bytes"] and hashlib.sha256(b).hexdigest() == entry["sha256"]
        data = json.loads((args.wire_root / "data.json").read_text())
    else:
        data = json.loads((ROOT / "original/presentation-excerpt.json").read_text())
    old_manifest = json.loads((PRIOR / "retained-manifest.json").read_text())
    entry = next(x for x in old_manifest["files"] if x["path"] == "selected-workbook.json")
    b = (PRIOR / "selected-workbook.json").read_bytes()
    assert len(b) == entry["bytes"] and hashlib.sha256(b).hexdigest() == entry["sha256"]
    workbook = json.loads(b)
    page = json.loads((PRIOR / "selected-presentation.json").read_text())
    assert data["place"]["areacd"] == workbook["geography_code"] == page["geography_code"] == "E08000003"
    meta = [s for s in data["sections"] if s.get("type") == "Meta"]
    narrative = [s for s in data["sections"] if s.get("id") == "rent_price_third"]
    assert len(meta) == len(narrative) == 1
    assert meta[0]["lastUpdated"] == workbook["release_date"] == page["release_date"] == "2026-09-16"
    period = max(k[-7:] for k in data["place"] if re.fullmatch(r"rental_price_\d{4}-\d{2}", k))
    assert period == workbook["period"] == page["period"] == "2026-08"
    assert "average rents as of August 2026 in Manchester were:" in narrative[0]["content"]
    rows, comparisons = [], []
    for ident, field, cell_key, label in SPEC:
        value = data["place"][f"rental_price_{field}_{period}"]
        match = re.findall(r"<li>" + re.escape(label) + r": £([\d,]+)</li>", narrative[0]["content"])
        assert len(match) == 1
        narrative_value = int(match[0].replace(",", ""))
        xml_value = workbook["cells"][cell_key]["value"]
        html_value = page["values"][cell_key]
        assert type(value) is int and value == narrative_value == xml_value == html_value
        rows.append({"measure_id": ident, "period": period, "value": value, "unit": "GBP per month", "geography": "Manchester", "geography_code": "E08000003", "release_date": "2026-09-16"})
        comparisons.append({"measure_id": ident, "publisher_json": value, "json_narrative": narrative_value, "workbook_cell": workbook["cells"][cell_key]["cell"], "workbook_value": xml_value, "separate_official_page": html_value, "match": True})
    report = {
        "pass": True, "desk": "england", "source": "bedroom_rent", "observations": 4,
        "period": period, "release_date": "2026-09-16", "rows": rows, "comparisons": comparisons,
        "original_json_bytes": manifest["acquisitions"][0]["bytes"],
        "original_json_sha256": manifest["acquisitions"][0]["sha256"],
        "original_publication_index_bytes": manifest["acquisitions"][1]["bytes"],
        "original_publication_index_sha256": manifest["acquisitions"][1]["sha256"],
        "method": "Python JSON/regular-expression extraction compared with prior independent Python ZIP/XML workbook cells and a separate official HTML presentation; no runtime module imported.",
        "independence_limit": "All presentations share ONS PIPR estimation lineage. This verifies extraction and dimensions, not the underlying statistical estimation.",
        "actual_worker_resource_proof": "pending",
    }
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"pass": True, "observations": 4, "period": period, "release_date": "2026-09-16"}))


if __name__ == "__main__":
    main()
