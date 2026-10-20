#!/usr/bin/env python3
"""Offline independent Nomis CSV/JSON extraction. No production reader or network."""
import argparse
import csv
import hashlib
import json
import re
from decimal import Decimal
from pathlib import Path

GEOGRAPHIES = {
    "K02000001": "United Kingdom",
    "E92000001": "England",
    "S92000003": "Scotland",
    "W92000004": "Wales",
    "N92000002": "Northern Ireland",
}
DIMENSIONS = {
    "gender": (0, "Total"),
    "age": (0, "All categories: Age 16+"),
    "measure": (1, "Claimant count"),
    "measures": (20100, "Value"),
}
PERIOD = re.compile(r"^\d{4}-(?:0[1-9]|1[0-2])$")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def annotations(obj):
    entries = obj.get("annotations", {}).get("annotation", [])
    require(len({x["annotationtitle"] for x in entries}) == len(entries),
            "duplicate metadata annotation")
    return {x["annotationtitle"]: x["annotationtext"] for x in entries}


def count(value):
    require(value is not None and not isinstance(value, bool), "missing count")
    result = Decimal(str(value))
    require(result.is_finite() and result >= 0 and result % 5 == 0
            and result <= 2**53 - 1, f"invalid rounded count: {value!r}")
    return int(result)


def preceding_months(latest, number=13):
    year, month = map(int, latest.split("-"))
    end = year * 12 + month - 1
    return [f"{x // 12:04d}-{x % 12 + 1:02d}"
            for x in range(end - number + 1, end + 1)]


def extract_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        require(len(set(reader.fieldnames)) == len(reader.fieldnames),
                "duplicate CSV column")
        rows = list(reader)
    require(len(rows) == 65, "CSV must contain exactly 65 observations")
    result = {}
    offsets = set()
    for row in rows:
        geo, period = row["GEOGRAPHY_CODE"], row["DATE"]
        require(geo in GEOGRAPHIES and row["GEOGRAPHY"] == geo
                and row["GEOGRAPHY_NAME"] == GEOGRAPHIES[geo],
                "CSV geography code/name mismatch")
        require(PERIOD.fullmatch(period) and row["DATE_CODE"] == period,
                "CSV period mismatch")
        require(row["RECORD_COUNT"] == "65", "CSV incomplete record count")
        offsets.add(int(row["RECORD_OFFSET"]))
        require(row["URN"].startswith("Nm-162d1d"), "CSV wrong dataset")
        for dimension, (code, label) in DIMENSIONS.items():
            require(row[dimension.upper()] == str(code)
                    and row[dimension.upper() + "_NAME"] == label,
                    f"CSV wrong {dimension}")
        require(row["OBS_STATUS"] == "A" and row["OBS_CONF"] == "F",
                "CSV non-public or non-normal observation")
        key = (geo, period)
        require(key not in result, "CSV duplicate geography/month")
        result[key] = count(row["OBS_VALUE"])
    require(offsets == set(range(65)), "CSV incomplete offsets")
    return result


def extract_json(path):
    document = json.loads(path.read_text())
    require(document["header"]["truncated"] == "false", "JSON truncated")
    observations = document["obs"]
    require(len(observations) == 65, "JSON must contain 65 observations")
    result = {}
    for observation in observations:
        require(observation["dataset"]["value"] == "NM_162_1",
                "JSON wrong dataset")
        geo = observation["geography"]["geogcode"]
        period = observation["time"]["value"]
        require(geo in GEOGRAPHIES
                and observation["geography"]["value"] == geo
                and observation["geography"]["description"] == GEOGRAPHIES[geo],
                "JSON geography mismatch")
        require(PERIOD.fullmatch(period), "JSON invalid period")
        for dimension, (code, label) in DIMENSIONS.items():
            require(observation[dimension]["value"] == code
                    and observation[dimension]["description"] == label,
                    f"JSON wrong {dimension}")
        for dimension, expected in {
            "unit": "PER", "freq": "M", "time_format": "P1M",
            "obs_status": "A", "obs_conf": "F", "obs_round": 5,
        }.items():
            require(observation[dimension]["value"] == expected,
                    f"JSON wrong {dimension}")
        key = (geo, period)
        require(key not in result, "JSON duplicate geography/month")
        result[key] = count(observation["obs_value"]["value"])
    return result, document["header"]


def codelist(path, name):
    structure = json.loads(path.read_text())["structure"]
    require(structure["header"]["id"] == "NM_162_1", "metadata dataset mismatch")
    lists = structure["codelists"]["codelist"]
    require(len(lists) == 1 and lists[0]["id"] == "CL_162_1_" + name,
            f"wrong {name} codelist")
    return lists[0]["code"]


def verify(original):
    manifest = json.loads((original / "acquisition.json").read_text())
    inputs = []
    for entry in manifest["records"]:
        name = entry.get("retained_file", entry.get("file"))
        require(name and entry["status"] == 200, "failed original acquisition")
        data = (original / name).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        require(digest == entry.get("retained_sha256", entry.get("sha256")),
                f"retained input digest mismatch: {name}")
        require(len(data) == entry.get("retained_bytes", entry.get("bytes")),
                f"retained input byte count mismatch: {name}")
        if "retained_file" in entry:
            require(entry.get("transformation") and entry.get("retained_sha256")
                    and entry.get("retained_bytes"), f"undocumented excerpt: {name}")
            document = json.loads(data)
            header = document.get("structure", {}).get("header", document.get("header", {}))
            require("sender" not in header, f"publisher contact header retained: {name}")
        inputs.append({
            "file": name, "sha256": digest, "bytes": len(data),
            "original_wire_sha256": entry["sha256"],
            "original_wire_bytes": entry["bytes"],
            "transformation": entry.get("transformation"),
        })
    csv_values = extract_csv(original / "nomis-national.csv")
    json_values, json_header = extract_json(original / "nomis-national.excerpt.json")
    require(csv_values == json_values, "independent CSV/JSON cell mismatch")

    periods_metadata = codelist(original / "nomis-time.json", "TIME")
    require(all(PERIOD.fullmatch(x["value"]) for x in periods_metadata),
            "time codelist has nonmonthly period")
    require(len({x["value"] for x in periods_metadata}) == len(periods_metadata),
            "duplicate time codelist entry")
    latest = max(x["value"] for x in periods_metadata)
    months = preceding_months(latest)
    expected = {(geo, month) for geo in GEOGRAPHIES for month in months}
    require(set(csv_values) == expected, "missing cells or older complete window")
    period_map = {x["value"]: x for x in periods_metadata}
    period_details = []
    for month in months:
        metadata = annotations(period_map[month])
        require(metadata["CurrentRevisionStatus"] == "Live",
                "period is not a live publisher release")
        require(re.fullmatch(r"\d{4}-\d{2}-\d{2}", metadata["taken on"])
                and metadata["taken on"].startswith(month),
                "reference date/period mismatch")
        period_details.append({"period": month, **metadata})

    keyfamilies = json.loads((original / "nomis-dataset.json").read_text())[
        "structure"]["keyfamilies"]["keyfamily"]
    require(len(keyfamilies) == 1 and keyfamilies[0]["id"] == "NM_162_1",
            "wrong dataset definition")
    dataset_metadata = annotations(keyfamilies[0])
    require(dataset_metadata["Units"] == "Persons"
            and dataset_metadata["Mnemonic"] == "ucjsa", "wrong dataset units")
    for dimension, (code, label) in DIMENSIONS.items():
        codes = codelist(original / f"nomis-{dimension}.json", dimension.upper())
        match = [x for x in codes if str(x["value"]) == str(code)]
        require(len(match) == 1
                and match[0]["description"]["value"].casefold() == label.casefold(),
                f"unverified {dimension} mapping")
    geography_codes = codelist(original / "nomis-countries.json", "GEOGRAPHY")
    for geo, name in GEOGRAPHIES.items():
        match = [x for x in geography_codes if annotations(x).get("GeogCode") == geo]
        require(len(match) == 1 and match[0]["description"]["value"] == name,
                "geography mapping not supported by codelist")

    residuals = []
    for month in months:
        uk = csv_values[("K02000001", month)]
        nations = sum(csv_values[(geo, month)] for geo in GEOGRAPHIES
                      if geo != "K02000001")
        require(abs(uk - nations) <= Decimal("12.5"), "country aggregation mismatch")
        residuals.append({"period": month, "uk": uk, "four_nation_sum": nations,
                          "residual_persons": uk - nations})
    history = [{
        "geography_code": geo, "geography": name,
        "observations": [{"period": month, "count": csv_values[(geo, month)],
                          "obs_status": "A", "obs_conf": "F"} for month in months],
        "latest_count": csv_values[(geo, latest)],
        "same_month_previous_year_count": csv_values[(geo, months[0])],
        "year_on_year_change_count": csv_values[(geo, latest)] - csv_values[(geo, months[0])],
    } for geo, name in GEOGRAPHIES.items()]
    return {
        "pass": True, "method": "Python csv.DictReader and Decimal vs independently acquired JSON; no runtime reader imports",
        "observations_compared": 65, "period_start": months[0], "period_end": latest,
        "inputs": inputs, "acquisition_completed_at": manifest["retrieved_at"],
        "publisher_json_prepared_raw": json_header.get("prepared"),
        "publisher_json_extracted_raw": json_header.get("extracted"),
        "dataset_annotations": dataset_metadata, "period_metadata": period_details,
        "history": history, "uk_nation_rounding_checks": residuals,
        "limitations": [
            "CSV and JSON are separate representations/extractions of the same Nomis statistical lineage.",
            "This establishes the retained vintage only, not future releases or runtime retrieval.",
            "Publisher unzoned release strings are preserved without inventing a UTC offset.",
            "Publisher JSON prepared/extracted Z-labelled strings are approximately one hour ahead of the local UTC acquisition record; do not use them as independently verified retrieval timestamps.",
            "Counts are administrative claimants, not ILO unemployment or available recruits.",
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    report = verify(args.original)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in
                      ("pass", "observations_compared", "period_start", "period_end")}))
