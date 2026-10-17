"""Local research only: two official aggregate tables, no deployment or credentials.

python research/rent-demand-2026-10-17/demo.py
python research/rent-demand-2026-10-17/demo.py --live
Live output goes to stdout; dated specimens are never overwritten.
"""
import argparse
from calendar import monthrange
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
PAGE = "https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/"
METHOD = PAGE + "market-rent-explained/"
BASE = "https://www.tenancy.govt.nz/market-rent-api/updateMarketValueLocation?"
AREAS = [("Auckland", "Avondale"), ("Wellington", "Kelburn")]
HEADERS = ["Size", "Active bonds", "Lower Quartile", "Median Rent", "Upper Quartile"]


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.headings, self.tables = [], []
        self.heading = self.table = self.row = self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "h5":
            self.heading = []
        if tag == "table":
            self.table = []
        if tag == "tr":
            self.row = []
        if tag in ("td", "th"):
            self.cell = []

    def handle_data(self, data):
        if self.heading is not None:
            self.heading.append(data)
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag == "h5" and self.heading is not None:
            self.headings.append(" ".join("".join(self.heading).split()))
            self.heading = None
        if tag in ("td", "th") and self.cell is not None:
            if self.row is not None:
                self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        if tag == "tr" and self.row is not None:
            if self.table is not None:
                self.table.append(self.row)
            self.row = None
        if tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def number(raw, currency=False):
    # Unexplained blanks/dashes are not assigned a suppression meaning.
    markers = {"": "missing", "—": "missing", "-": "missing",
               "N/A": "unavailable", "Suppressed": "suppressed"}
    if raw in markers:
        return {"value": None, "status": markers[raw], "raw": raw}
    pattern = r"\$(?:\d+|\d{1,3}(?:,\d{3})+)" if currency else r"(?:\d+|\d{1,3}(?:,\d{3})+)"
    if not re.fullmatch(pattern, raw):
        raise ValueError("Unrecognized numeric cell: " + repr(raw))
    return {"value": int(raw.replace("$", "").replace(",", "")), "status": "observed"}


def parse_table(fragment, city, suburb):
    parser = Tables()
    parser.feed(fragment)
    if not parser.headings:
        raise ValueError("No market-rent heading (possible outage HTML)")
    heading = re.fullmatch(r"(.+?) (\d{2} \w{3} \d{4}) - (\d{2} \w{3} \d{4})", parser.headings[0])
    if not heading or heading[1] != f"{city} - {suburb}":
        raise ValueError("Unexpected geography or period")
    start, end = [datetime.strptime(heading[i], "%d %b %Y").date() for i in (2, 3)]
    if (start.day != 1 or end.day != monthrange(end.year, end.month)[1]
            or (end.year * 12 + end.month) - (start.year * 12 + start.month) != 5):
        raise ValueError("Expected six-month window")
    apartments = [table for table in parser.tables if table and table[0] == ["Apartment"]]
    if len(apartments) != 1 or len(apartments[0]) < 3 or apartments[0][1] != HEADERS:
        raise ValueError("Missing, duplicate or changed Apartment table")
    by_bedroom = {}
    for row in apartments[0][2:]:
        if len(row) != 5 or not re.fullmatch(r"(?:[1-4]|5\+) bedrooms?", row[0]):
            raise ValueError("Unexpected row shape or bedroom category")
        bedrooms = row[0].split()[0]
        if bedrooms in by_bedroom:
            raise ValueError("Duplicate bedroom category")
        cells = [number(row[1])] + [number(x, currency=True) for x in row[2:]]
        values = [cell["value"] for cell in cells[1:]]
        if all(value is not None for value in values) and values != sorted(values):
            raise ValueError("Quartiles are out of order")
        by_bedroom[bedrooms] = dict(zip(["active_bonds", "lower_quartile", "median", "upper_quartile"], cells))
    return {"geography": {"country": "New Zealand", "city": city, "suburb": suburb,
                          "definition": "NZAD suburb; publisher label; no stable code verified"},
            "period": {"start": start.isoformat(), "end": end.isoformat(), "kind": "six-month bond window"},
            "dwelling_type": "Apartment", "unit": "NZD/week", "adjustment": "unadjusted descriptive rents",
            "population": "non-government properties with bonds lodged in the period",
            "count_definition": "active bonds within the period; not the denominator of all lodged bonds",
            "revision_status": "provisional; publisher warns of bond-system migration",
            "bedrooms": by_bedroom,
            "source_url": BASE + urlencode({"ajax_city": city, "ajax_suburb": suburb}),
            "methodology_url": METHOD,
            "attribution": "Ministry of Business, Innovation and Employment",
            "licence": "https://creativecommons.org/licenses/by/3.0/nz/"}


def benchmark(record, bedrooms):
    cells = record["bedrooms"].get(str(bedrooms))
    if cells is None:
        return {"status": "not_reported", "value": None, "reason": "No published row; zero and suppression cannot be inferred"}
    return {"status": "reported", "cells": cells, "period": record["period"], "unit": record["unit"]}


def compare(first, second):
    for field in ("period", "unit", "dwelling_type", "population"):
        if first[field] != second[field]:
            raise ValueError("Incomparable " + field)
    a = benchmark(first, 2)["cells"]["median"]["value"]
    b = benchmark(second, 2)["cells"]["median"]["value"]
    if a is None or b is None:
        return {"status": "unavailable", "difference_nzd_per_week": None}
    return {"status": "equal_medians" if a == b else "different_medians", "difference_nzd_per_week": a - b}


def decode_response(status, body):
    # Observed endpoint serves JSON with text/html. Validate actual payload, not MIME alone.
    if status != 200 or len(body) > 1_000_000:
        raise ValueError("Unexpected response status or size")
    payload = json.loads(body)
    if not isinstance(payload, dict) or not isinstance(payload.get("Table"), str):
        raise ValueError("Expected JSON object containing HTML Table")
    return payload["Table"]


def retrieve(live=False):
    records = []
    for city, suburb in AREAS:
        if live:
            url = BASE + urlencode({"ajax_city": city, "ajax_suburb": suburb})
            request = Request(url, headers={"X-Requested-With": "XMLHttpRequest", "Referer": PAGE, "Accept": "application/json"})
            # 429, auth and transport failures propagate; no retries or older-release fallback.
            with urlopen(request, timeout=30) as response:
                body = response.read(1_000_001)
                fragment = decode_response(response.status, body)
        else:
            fragment = (ROOT / "specimens" / (suburb.lower() + ".html")).read_text()
        records.append(parse_table(fragment, city, suburb))
    return records


def budget_position(record, budget):
    cells = benchmark(record, 2)["cells"]
    values = [cells[k]["value"] for k in ("lower_quartile", "median", "upper_quartile")]
    if any(v is None for v in values):
        return {"status": "unavailable"}
    lo, median, hi = values
    position = ("at upper quartile" if budget == hi else "between median and upper quartile" if median < budget < hi
                else "at median" if budget == median else "above upper quartile" if budget > hi
                else "between lower quartile and median" if lo < budget < median
                else "at lower quartile" if budget == lo else "below lower quartile")
    return {"budget_nzd_per_week": budget, "position": position,
            "limitation": "Historical aggregate benchmark; does not establish available listings or a property's value"}


def demonstrate(records, live=False):
    first, second = records
    return {"test_case_origin": "constructed from public workflow capabilities; not observed user queries",
            "records": records,
            "answers": {
                "avondale_two_bed_apartment": benchmark(first, 2),
                "compare_two_bed_apartment_medians": compare(first, second),
                "budget_600_nzd_per_week": {"Avondale": budget_position(first, 600), "Kelburn": budget_position(second, 600)},
                "avondale_four_bed_apartment": benchmark(first, 4),
                "today_advertised_rent": {"status": "unsupported", "reason": "Bond statistics do not report current listings or availability"}},
            "retrieval": "live" if live else "dated offline specimens"}


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--live", action="store_true")
    ARGS = cli.parse_args()
    print(json.dumps(demonstrate(retrieve(ARGS.live), ARGS.live), indent=2))
