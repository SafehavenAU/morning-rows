#!/usr/bin/env python3
"""Compare independent CSV extraction to two bounded WDS points; no network."""
import argparse
import csv
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
EXPECTED = {
    "186.3.3": ("Victoria, British Columbia", "2011S0503935", "v3823106"),
    "66.3.3": ("Victoriaville, Quebec", "2011S0504440", "v3823208"),
}


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def extract(wire, output):
    ledger = json.loads((ROOT / "acquisition.json").read_text())
    for name in ("cmhc-cube", "cmhc-bulk", "cmhc-points", "cmhc-series"):
        entry = next(x for x in ledger if x["name"] == name)
        raw = (wire / entry["local_file"]).read_bytes()
        assert len(raw) == entry["bytes"] and hashlib.sha256(raw).hexdigest() == entry["sha256"], name
    cube = json.loads((wire / "cmhc-cube.body").read_text())[0]
    assert cube["status"] == "SUCCESS"
    obj = cube["object"]
    excerpt = {k: obj[k] for k in ("productId", "cubeTitleEn", "cubeStartDate", "cubeEndDate", "frequencyCode", "releaseTime", "archiveStatusCode", "archiveStatusEn")}
    excerpt["dimension"] = []
    for d in obj["dimension"]:
        excerpt["dimension"].append({
            "dimensionPositionId": d["dimensionPositionId"], "dimensionNameEn": d["dimensionNameEn"],
            "member": [m for m in d["member"] if m["memberId"] in ([66, 186] if d["dimensionPositionId"] == 1 else [3])],
        })
    excerpt["footnote"] = [{k: f[k] for k in ("footnoteId", "footnotesEn", "link")} for f in obj["footnote"] if f["footnoteId"] in (1, 2, 5)]
    write(output / "cube-excerpt.json", excerpt)
    for name in ("cmhc-points", "cmhc-series"):
        (output / (name + ".json")).write_bytes((wire / (name + ".body")).read_bytes())
    with ZipFile(wire / "cmhc-bulk.body") as z:
        with z.open("34100133.csv") as stream:
            rows = csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig", newline=""))
            selected = [r for r in rows if r["REF_DATE"] == "2025" and r["COORDINATE"] in (*EXPECTED, "66.2.3")]
            fieldnames = rows.fieldnames
    assert len(selected) == 3
    with (output / "selected-csv.csv").open("w", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(selected)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wire-root", type=Path)
    ap.add_argument("--output", type=Path, default=ROOT)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.wire_root:
        extract(args.wire_root, args.output)
    with (args.output / "selected-csv.csv").open(newline="") as f:
        rows = {r["COORDINATE"]: r for r in csv.DictReader(f)}
    cube = json.loads((args.output / "cube-excerpt.json").read_text())
    assert cube["productId"] == "34100133" and cube["cubeEndDate"] == "2025-01-01" and cube["frequencyCode"] == 12
    assert cube["releaseTime"] == "2025-12-17T08:30"
    series = json.loads((args.output / "cmhc-series.json").read_text())
    assert len(series) == 2 and all(s["status"] == "SUCCESS" for s in series)
    points = json.loads((args.output / "cmhc-points.json").read_text())
    assert len(points) == 2
    comparisons = []
    seen = set()
    for result in points:
        assert result["status"] == "SUCCESS"
        obj = result["object"]
        assert obj["responseStatusCode"] == 0 and obj["productId"] == 34100133
        coord = ".".join(obj["coordinate"].split(".")[:3])
        assert coord in EXPECTED and coord not in seen
        seen.add(coord)
        row = rows[coord]
        geo, dguid, vector = EXPECTED[coord]
        assert row["GEO"] == geo and row["DGUID"] == dguid and row["VECTOR"] == vector == "v" + str(obj["vectorId"])
        assert row["Type of structure"] == "Row and apartment structures of three units and over"
        assert row["Type of unit"] == "Two bedroom units"
        assert row["UOM"] == "Dollars" and row["UOM_ID"] == "81" and row["SCALAR_ID"] == "0" and row["DECIMALS"] == "0"
        assert row["STATUS"] == row["SYMBOL"] == row["TERMINATED"] == ""
        assert len(obj["vectorDataPoint"]) == 1
        p = obj["vectorDataPoint"][0]
        assert p["refPer"] == "2025-01-01" and p["refPerRaw"] == "2025-10-01" and p["releaseTime"] == cube["releaseTime"]
        assert p["frequencyCode"] == 12
        for key in ("decimals", "scalarFactorCode", "symbolCode", "statusCode", "securityLevelCode"):
            assert p[key] == 0
        a, b = Decimal(row["VALUE"]), Decimal(str(p["value"]))
        assert a == b
        comparisons.append({"coordinate": coord, "geography": geo, "dguid": dguid, "vector": vector, "survey_year": 2025, "csv": str(a), "wds": str(b), "match": True})
    assert seen == set(EXPECTED)
    control = rows["66.2.3"]
    assert control["VALUE"] == "" and control["STATUS"] == "F"
    report = {"pass": True, "matched_observations": 2, "comparisons": comparisons, "missingness_control": {"coordinate": "66.2.3", "structure": control["Type of structure"], "value": None, "status": "F", "converted_to_zero": False}, "release_timestamp_raw": cube["releaseTime"], "release_timezone": None, "shared_lineage": "CSV and WDS encode the same CMHC survey table. Independent encoding/extraction checks do not constitute an independent rental survey or numerical CMHC presentation.", "transport_blocker_recovered": True, "runtime_implemented": False, "conditional_licence_acceptance_established": False}
    write(args.output / "reconciliation.json", report)
    print(json.dumps({"pass": True, "matched_observations": 2, "missingness_controls": 1}))


if __name__ == "__main__":
    main()
