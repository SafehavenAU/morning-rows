#!/usr/bin/env python3
"""Offline October 2026 NISRA aggregate extraction; original workbook stays outside git."""
import csv
import hashlib
import json
import runpy
import sys
from decimal import Decimal
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORKBOOK_SHA256 = "9d7d881f0d68767182f2636e3bf28b04eba391f0d8d95d5325c739254c3e61cb"
NOMIS_SHA256 = "c95b1b549d43219577f1beb8f90996c217e1027b07bc410770fe7de1c96267d0"
WORKBOOK_URL = "https://www.nisra.gov.uk/system/files/statistics/2026-10/lmr-claimant-count-tables-october-2026.xlsx"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    require(len(sys.argv) == 2, "Pass the original October workbook path outside the repository")
    workbook = Path(sys.argv[1])
    require(hashlib.sha256(workbook.read_bytes()).hexdigest() == WORKBOOK_SHA256,
            "Wrong October workbook bytes")
    nomis = HERE / "nomis-national.csv"
    require(hashlib.sha256(nomis.read_bytes()).hexdigest() == NOMIS_SHA256,
            "Wrong fresh Nomis CSV bytes")
    helpers = runpy.run_path(str(ROOT / "verification/claimant-count-2026-10-20/extract-nisra.py"))
    sheets = helpers["extract"](workbook)
    cover, headline, lgd, notes = (sheets[k] for k in ["Cover Sheet", "Headline", "LGD_11", "Notes"])
    require(cover["A1"] == "Claimant Count Tables, October 2026", "Wrong release title")
    require(cover["A5"] == "The data tables within this spreadsheet were published at 7.00am on 20 October 2026",
            "Wrong workbook publication date")
    require(lgd["A19"] == "Northern Ireland" and lgd["D7"] == "Total number of claimants",
            "Wrong LGD measure or geography")
    require("rounded to the nearest 5" in lgd["A6"] and "sufficiently classify" in lgd["A4"],
            "LGD population or rounding changed")
    require("Non seasonally adjusted" in headline["I6"] and "thousands" in headline["I6"]
            and headline["N7"] == "Claimant count all people", "Wrong headline context")
    latest = max(filter(None, (helpers["dated_period"](v) for k, v in headline.items()
                               if k.startswith("I") and k[1:].isdigit())))
    require(latest == "2026-09" and headline["I361"] == "2026 Sep [p]", "Wrong latest period")
    rows = list(csv.DictReader(nomis.open(encoding="utf-8-sig", newline="")))
    require(len(rows) == 65, "Expected five national geographies times thirteen months")
    ni = [r for r in rows if r.get("GEOGRAPHY_CODE") == "N92000002"]
    require(len(ni) == 13 and len({r["DATE"] for r in ni}) == 13, "Wrong NI calendar coverage")
    require(max(r["DATE"] for r in ni) == latest, "Different Nomis and NISRA reference periods")
    row = next(r for r in ni if r["DATE"] == latest)
    time_path = HERE / "nomis-time.json"
    def find_period(value):
        if isinstance(value, dict):
            if value.get("value") == latest and "annotations" in value:
                yield value
            for child in value.values():
                yield from find_period(child)
        elif isinstance(value, list):
            for child in value:
                yield from find_period(child)
    time_matches = list(find_period(json.loads(time_path.read_text())))
    require(len(time_matches) == 1, "Ambiguous Nomis reference-date metadata")
    annotations = {a["annotationtitle"]: a["annotationtext"]
                   for a in time_matches[0]["annotations"]["annotation"]}
    require(annotations["taken on"] == "2026-09-10"
            and annotations["CurrentRevisionReleased"] == "2026-10-20 07:00:00"
            and annotations["CurrentRevisionVersion"] == 0, "Unexpected Nomis release vintage")
    expected = {"GEOGRAPHY_NAME": "Northern Ireland", "GENDER": "0", "AGE": "0",
                "MEASURE": "1", "MEASURES": "20100", "OBS_STATUS": "A", "OBS_CONF": "F"}
    require(all(row.get(k) == v for k, v in expected.items()), "Wrong Nomis dimensions or flags")
    value = Decimal(row["OBS_VALUE"])
    require(value.is_finite() and value >= 0 and value == value.to_integral_value()
            and value % 5 == 0, "Invalid rounded claimant count")
    require(int(lgd["D19"]) == int(value) == 34225, "Exact comparable NI cell mismatch")
    selected = {
        "Cover Sheet": {k: cover[k] for k in ["A1", "A5"]},
        "LGD_11": {k: lgd[k] for k in ["A1", "A4", "A5", "A6", "A7", "D7", "A19", "D19"]},
        "Headline": {k: headline[k] for k in ["A5", "I6", "N7", "I360", "N360", "I361", "N361"]},
        "Notes": {k: notes[k] for k in ["B3", "B4", "B7", "B8"]},
    }
    headline_count = int(Decimal(headline["N361"]) * 1000)
    result = {
        "source_url": WORKBOOK_URL,
        "source_sha256": WORKBOOK_SHA256,
        "nomis_csv_sha256": NOMIS_SHA256,
        "nomis_time_sha256": hashlib.sha256(time_path.read_bytes()).hexdigest(),
        "workbook_latest_period": latest,
        "nomis_latest_period": latest,
        "nomis_reference_date": annotations["taken on"],
        "nomis_release_as_supplied": annotations["CurrentRevisionReleased"],
        "nomis_revision": annotations["CurrentRevisionVersion"],
        "nomis_publication_timezone": "Not supplied in the retained annotation",
        "published_as_supplied": cover["A5"],
        "publication_timezone": "Not supplied by this workbook; do not append a timezone",
        "extraction": "Independent Python stdlib XLSX relationships/shared-string extraction; reused historical extractor helper, no runtime reader",
        "attribution": "NISRA; Crown copyright / Open Government Licence",
        "licence_url": "https://www.nisra.gov.uk/crown-copyright",
        "licence_evidence": "Reuse the same-day 04:41 UTC acquisition in verification/claimant-count-2026-10-20/original/nisra-acquisition.json; no additional permission endpoint requested",
        "selected_cells": selected,
        "exact_comparisons": [{
            "period": latest, "geography": "Northern Ireland", "geography_code": "N92000002",
            "nisra_cell": "LGD_11!D19", "nisra_value": 34225, "nomis_value": int(value),
            "difference": 0, "unit": "persons, rounded to nearest five",
            "adjustment": "not seasonally adjusted",
            "coverage": "Geographically classified claimant records; insufficient-geography records can be excluded",
            "pass": True,
        }],
        "headline_context": {
            "period": latest, "period_cell": "Headline!I361", "value_cell": "Headline!N361",
            "raw_thousands": headline["N361"], "count": headline_count,
            "difference_from_geographically_classified_rounded_nomis": headline_count - int(value),
            "comparison_kind": "context_only_different_geographical_classification_and_rounding",
            "previous_month_revision_label": headline["I360"],
            "previous_month_raw_thousands": headline["N360"],
        },
        "limitations": [
            "Exactly one comparable latest Northern Ireland observation; not thirteen like-for-like historical confirmations.",
            "Headline 34,228 is context only, not an alternative to geographically classified rounded 34,225.",
            "NISRA and Nomis share upstream administrative statistics; separate publication/extraction is not independent population measurement.",
            "September 2026 is provisional and August is revised in this October vintage; older retained August evidence is not overwritten.",
            "Administrative JSA/relevant UC claimant count, not ILO unemployment or available recruits.",
            "Workbook and release-page originals remain outside the repository; staff contacts are omitted.",
        ],
    }
    (HERE / "nisra-selected-cells.json").write_text(json.dumps(result, indent=2) + "\n")
    checks = {"workbook_hash_pass": True, "nomis_hash_pass": True, "reference_period": latest,
              "release": "October 2026", "exact_comparisons": 1, "headline_context_records": 1,
              "headline_context_is_exact_comparison": False,
              "nisra_value": 34225, "nomis_value": int(value), "difference": 0,
              "scope": "Offline independent aggregate extraction; no endpoint calls, runtime changes or historical-vintage substitution"}
    (HERE / "nisra-extraction-checks.json").write_text(json.dumps(checks, indent=2) + "\n")
    print(json.dumps(checks, indent=2))


if __name__ == "__main__":
    main()
