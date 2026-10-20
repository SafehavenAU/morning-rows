#!/usr/bin/env python3
"""Independent CSV/Decimal against original WDS data and metadata; no network."""
import csv
from decimal import Decimal
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC = [
    ("victoria.two_bedroom_average_rent", "186.3.3", 3823106, "Victoria, British Columbia", "2011S0503935", "CMA", "935"),
    ("victoriaville.two_bedroom_average_rent", "66.3.3", 3823208, "Victoriaville, Quebec", "2011S0504440", "CA", "440"),
]


def main():
    manifest = json.loads((ROOT / "original/manifest.json").read_text())
    for record in manifest["retained"]:
        b = (ROOT / "original" / record["path"]).read_bytes()
        assert len(b) == record["bytes"] and hashlib.sha256(b).hexdigest() == record["sha256"]
    cube_response = json.loads((ROOT / "original/cube-response-excerpt.json").read_text())
    assert len(cube_response) == 1 and cube_response[0]["status"] == "SUCCESS"
    cube = cube_response[0]["object"]
    assert cube["responseStatusCode"] == 0 and cube["productId"] == "34100133" and cube["frequencyCode"] == 12
    assert cube["cubeEndDate"] == "2025-01-01" and cube["releaseTime"] == "2025-12-17T08:30"
    assert [d["dimensionNameEn"] for d in cube["dimension"]] == ["Geography", "Type of structure", "Type of unit"]
    assert [d["hasUom"] for d in cube["dimension"]] == [False, False, True]
    assert cube["dimension"][1]["member"][0]["memberNameEn"] == "Row and apartment structures of three units and over"
    assert cube["dimension"][2]["member"][0]["memberNameEn"] == "Two bedroom units"
    assert cube["dimension"][2]["member"][0]["memberUomCode"] == 81
    points = json.loads((ROOT / "original/points.json").read_text())
    series = json.loads((ROOT / "original/series.json").read_text())
    assert len(points) == len(series) == 2
    assert all(p["status"] == "SUCCESS" and p["object"]["responseStatusCode"] == 0 for p in points + series)
    by_vector = {p["object"]["vectorId"]: p["object"] for p in points}
    info = {p["object"]["vectorId"]: p["object"] for p in series}
    with (ROOT / "original/selected-csv.csv").open(newline="") as f:
        csv_rows = {r["COORDINATE"]: r for r in csv.DictReader(f)}
    rows, comparisons = [], []
    for ident, coordinate, vector, geography, dguid, geo_type, code in SPEC:
        source, metadata, original = by_vector[vector], info[vector], csv_rows[coordinate]
        assert source["productId"] == metadata["productId"] == 34100133
        assert source["coordinate"] == metadata["coordinate"] == coordinate + ".0.0.0.0.0.0.0"
        assert metadata["SeriesTitleEn"] == geography + ";Row and apartment structures of three units and over;Two bedroom units"
        assert metadata["frequencyCode"] == 12 and metadata["memberUomCode"] == 81 and metadata["terminated"] == 0
        assert original["GEO"] == geography and original["DGUID"] == dguid and original["VECTOR"] == "v" + str(vector)
        assert original["REF_DATE"] == "2025" and original["UOM_ID"] == "81" and original["SCALAR_ID"] == "0"
        assert original["STATUS"] == original["SYMBOL"] == original["TERMINATED"] == ""
        assert original["Type of structure"] == "Row and apartment structures of three units and over"
        assert original["Type of unit"] == "Two bedroom units" and original["DECIMALS"] == "0"
        assert len(source["vectorDataPoint"]) == 1
        point = source["vectorDataPoint"][0]
        assert point["refPer"] == "2025-01-01" and point["refPerRaw"] == "2025-10-01"
        assert point["releaseTime"] == cube["releaseTime"] and point["frequencyCode"] == 12
        for key in ("decimals", "scalarFactorCode", "symbolCode", "statusCode", "securityLevelCode"):
            assert point[key] == 0
        a, b = Decimal(original["VALUE"]), Decimal(str(point["value"]))
        assert a == b
        row = {"measure_id": ident, "period": "2025", "survey_month": "2025-10", "value": int(a), "unit": "CAD per month", "geography": geography, "geography_code": dguid, "geography_type": geo_type, "classification_code": code, "coordinate": coordinate + ".0.0.0.0.0.0.0", "vector_id": vector, "release_timestamp_raw": cube["releaseTime"], "release_timezone": None}
        rows.append(row)
        comparisons.append({"measure_id": ident, "csv": str(a), "wds": str(b), "match": True})
    control = csv_rows["66.2.3"]
    assert control["VALUE"] == "" and control["STATUS"] == "F"
    report = {
        "pass": True, "desk": "canada", "source": "rental_benchmark", "observations": 2,
        "period": "2025", "release_timestamp_raw": cube["releaseTime"], "release_timezone": None,
        "rows": rows, "comparisons": comparisons,
        "missingness_control": {"coordinate": "66.2.3", "value": None, "status": "F", "converted_to_zero": False},
        "method": "Independent Python CSV and Decimal extraction reconciles original WDS points, series metadata and selected cube dimensions. No runtime parser imported.",
        "independence_limit": "CSV and WDS share the same CMHC survey lineage. No independent rental survey or separately presented CMHC numerical table is claimed.",
        "licence_status": "Conditional redistribution grant established; existing notice mechanism reused; no individual recipient acceptance observed or recorded.",
        "actual_worker_resource_proof": "pending",
    }
    (ROOT / "independent-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"pass": True, "observations": 2, "missingness_controls": 1}))


if __name__ == "__main__":
    main()
