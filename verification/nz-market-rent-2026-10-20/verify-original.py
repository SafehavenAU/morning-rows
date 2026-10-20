#!/usr/bin/env python3
"""Offline independent extraction of the two acquired publisher presentations.

Uses only Python's standard library, no runtime parser and no network.
Usage: python verify-original.py ORIGINAL_DIRECTORY OUTPUT_JSON
The output must not already exist.
"""

import argparse
import calendar
from datetime import datetime
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re


PLACES = [
    ("nz-auckland-avondale", "Auckland", "Avondale", [3, 1, 3, 5, 1]),
    ("nz-wellington-kelburn", "Wellington", "Kelburn", [4, 1, 5, 5, 1]),
]
TYPES = ["Apartment", "Boarding House", "Flat", "House", "Room"]
TYPE_KEYS = ["apartment", "boarding-house", "flat", "house", "room"]
HEADERS = ["Size", "Active bonds", "Lower Quartile", "Median Rent", "Upper Quartile"]
BEDROOMS = {
    "1 bedroom": "1", "2 bedrooms": "2", "3 bedrooms": "3",
    "4 bedrooms": "4", "5+ bedrooms": "5-plus",
}
FIELDS = ["active_bonds", "lower_quartile", "median", "upper_quartile"]


def check(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def text(value):
    return " ".join(unescape(re.sub(r"<[^>]+>", "", value)).split())


def period(heading, label):
    match = re.fullmatch(
        re.escape(label) + r" (\d{2} [A-Z][a-z]{2} \d{4}) - (\d{2} [A-Z][a-z]{2} \d{4})",
        heading,
    )
    check(match, "Exact publisher area/window echo missing: " + label)
    start, end = [
        datetime.strptime(part, "%d %b %Y").date() for part in match.groups()
    ]
    check(start.day == 1, "Window must start on first day")
    check(end.day == calendar.monthrange(end.year, end.month)[1], "Window must end at month end")
    check((end.year - start.year) * 12 + end.month - start.month == 5, "Not six consecutive months")
    return {"start": start.isoformat(), "end": end.isoformat(), "inclusive": True}


def number(raw, currency):
    prefix = r"\$" if currency else ""
    check(re.fullmatch(prefix + r"(?:\d+|\d{1,3}(?:,\d{3})+)", raw),
          "Unrecognized publisher numeric cell: " + repr(raw))
    return int(raw.replace("$", "").replace(",", ""))


def normalize(tables):
    check([table[0] for table in tables] == TYPES, "Missing, duplicated or unknown dwelling tables")
    result = []
    for (name, headers, raw_rows), slug in zip(tables, TYPE_KEYS):
        check(headers == HEADERS, "Changed headers for " + name)
        seen = set()
        for cells in raw_rows:
            check(len(cells) == 5, "Invalid row width")
            check(cells[0] in BEDROOMS, "Unknown bedroom label")
            bedroom = BEDROOMS[cells[0]]
            check(bedroom not in seen, "Duplicate bedroom row")
            seen.add(bedroom)
            values = [number(cell, i > 0) for i, cell in enumerate(cells[1:])]
            check(values[1] <= values[2] <= values[3], "Quartiles out of order")
            result.append({
                "dwelling_type": name, "dwelling_key": slug,
                "bedrooms": bedroom, "bedroom_label": cells[0],
                **dict(zip(FIELDS, values)),
            })
    return result


def ajax_extract(source, label):
    """Bounded structural regex extraction of the original AJAX Table string."""
    headings = re.findall(r"<h5\b[^>]*>(.*?)</h5>", source, re.S)
    check(len(headings) == 6, "Expected one result heading plus five table headings")
    window = period(text(headings[0]), label)
    tables = []
    for table in re.findall(r"<table\b[^>]*>.*?</table>", source, re.S):
        title = re.findall(r"<h5\b[^>]*>(.*?)</h5>", table, re.S)
        thead = re.findall(r"<thead\b[^>]*>(.*?)</thead>", table, re.S)
        tbody = re.findall(r"<tbody\b[^>]*>(.*?)</tbody>", table, re.S)
        check(len(title) == len(thead) == len(tbody) == 1, "Malformed AJAX table")
        headers = [text(cell) for cell in re.findall(r"<th\b[^>]*>(.*?)</th>", thead[0], re.S)]
        rows = [
            [text(cell) for cell in re.findall(r"<td\b[^>]*>(.*?)</td>", row, re.S)]
            for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", tbody[0], re.S)
        ]
        tables.append((text(title[0]), headers, rows))
    return window, normalize(tables)


class PageParser(HTMLParser):
    """Independent event-driven HTML extraction for the separately fetched page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.headings = []
        self.inputs = {}
        self.table = self.row = self.cell = self.heading = None
        self.heading_outside_table = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "input" and attrs.get("name") in ("location", "period"):
            name = attrs["name"]
            check(name not in self.inputs, "Duplicate selection input")
            self.inputs[name] = attrs.get("value")
        if tag == "table":
            check(self.table is None, "Nested table")
            self.table = []
        elif tag == "tr":
            self.row = []
        elif tag in ("td", "th"):
            self.cell = []
        elif tag == "h5":
            self.heading = []
            self.heading_outside_table = self.table is None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)
        if self.heading is not None:
            self.heading.append(data)

    def handle_endtag(self, tag):
        if tag == "h5" and self.heading is not None:
            if self.heading_outside_table:
                self.headings.append(" ".join("".join(self.heading).split()))
            self.heading = None
        elif tag in ("td", "th") and self.cell is not None:
            check(self.row is not None, "Cell outside row")
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            check(self.table is not None, "Row outside table")
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def page_extract(source, selection, label):
    parser = PageParser()
    parser.feed(source)
    check(len(parser.headings) == 1, "Page must have exactly one result heading")
    window = period(parser.headings[0], label)
    tables = []
    for raw in parser.tables:
        check(len(raw) >= 2 and len(raw[0]) == 1, "Malformed full-page table")
        tables.append((raw[0][0], raw[1], raw[2:]))
    form = PageParser()
    form.feed(selection)
    check(form.inputs.get("location") == label, "Full-page selection does not match requested place")
    check(re.fullmatch(r"\d+", form.inputs.get("period", "")), "Missing opaque period form field")
    return window, normalize(tables), form.inputs


def verify(original):
    ledger_bytes = (original / "acquisition.json").read_bytes()
    ledger = json.loads(ledger_bytes)
    by_file = {}
    for record in ledger["records"]:
        name = record["file"]
        check(name == Path(name).name and name not in by_file, "Invalid retained file identity")
        body = (original / name).read_bytes()
        check(len(body) == record["retained_bytes"], "Retained length mismatch: " + name)
        check(digest(body) == record["retained_sha256"], "Retained hash mismatch: " + name)
        check(record["status"] == 200, "Acquisition did not succeed")
        by_file[name] = record
    localities = []
    for identifier, city, suburb, counts in PLACES:
        prefix = suburb.lower()
        label = city + " - " + suburb
        ajax_window, ajax_rows = ajax_extract((original / f"{prefix}-ajax.html").read_text(), label)
        page_window, page_rows, form = page_extract(
            (original / f"{prefix}-page.html").read_text(),
            (original / f"{prefix}-selection.html").read_text(), label,
        )
        check(ajax_window == page_window, "Independent presentation window differs")
        check(ajax_rows == page_rows, "Independent presentation values/dimensions differ")
        check([sum(r["dwelling_type"] == name for r in ajax_rows) for name in TYPES] == counts,
              "Initial dated specimen row coverage differs")
        check(ajax_window == {"start": "2026-03-01", "end": "2026-08-31", "inclusive": True},
              "Evidence vintage changed; review and retain a new comparison")
        present = {(r["dwelling_key"], r["bedrooms"]) for r in ajax_rows}
        missing = [
            {"dwelling_key": dwelling, "bedrooms": bedroom, "status": "not_reported"}
            for dwelling in TYPE_KEYS for bedroom in BEDROOMS.values()
            if (dwelling, bedroom) not in present
        ]
        localities.append({
            "id": identifier, "city": city, "suburb": suburb,
            "publisher_label": label, "geography_definition": "NZAD suburb; city-qualified publisher label",
            "publisher_geography_code": None, "period": ajax_window,
            "rows": ajax_rows, "absent_tuples": missing,
            "opaque_form_period": form["period"],
            "source_url": by_file[f"{prefix}-ajax.html"]["url"],
            "independent_presentation_url": by_file[f"{prefix}-page.html"]["url"],
            "retrieved_at": by_file[f"{prefix}-ajax.html"]["retrieved_at"],
            "row_count": len(ajax_rows), "numeric_cell_count": len(ajax_rows) * 4,
        })
    row_count = sum(x["row_count"] for x in localities)
    check(row_count == 29, "Initial dated coverage must contain 29 rows")
    return {
        "schema_version": 1, "pass": True, "evidence_date": "2026-10-20",
        "method": "AJAX structural-regex extraction reconciled with independent event-driven HTMLParser full-page extraction; no runtime parser imported",
        "independence_limit": "Both official presentations share MBIE rental-bond statistical lineage; this does not recompute or independently survey the underlying rents.",
        "source_manifest_sha256": digest(ledger_bytes),
        "publisher_notes_sha256": digest((original / "publisher-notes.json").read_bytes()),
        "retained_inputs": [{
            "file": r["file"], "sha256": r["retained_sha256"], "bytes": r["retained_bytes"],
            "original_response_sha256": r["sha256"], "original_response_bytes": r["bytes"],
        } for r in ledger["records"]],
        "comparison": {
            "localities": 2, "dwelling_tables": 10, "rows": row_count,
            "numeric_cells": row_count * 4, "numeric_tolerance": 0,
            "matching_periods": 2, "matching_explicit_form_selections": 2,
        },
        "units": {"active_bonds": "bonds", "lower_quartile": "NZD/week",
                  "median": "NZD/week", "upper_quartile": "NZD/week"},
        "localities": localities,
        "attribution": "Ministry of Business, Innovation and Employment",
        "licence": "CC BY 3.0 NZ",
        "licence_url": "https://creativecommons.org/licenses/by/3.0/nz/",
        "methodology_url": "https://www.tenancy.govt.nz/rent-bond-and-bills/market-rent/market-rent-explained/",
        "limitations": [
            "Non-government bond-based six-month aggregate; not advertised listings or all current tenancies.",
            "Active bonds are current bonds within the selected window with complete fields; not established as a quantile denominator.",
            "Publisher-rounded weekly rents, provisional and revisable during bond-system migration.",
            "No exact publication timestamp, stable NZAD code or website-specific rounding base/suppression rule established.",
            "Absent rows are not_reported; no zero or suppression reason inferred.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    check(not args.output.exists(), "Output already exists; preserve evidence and choose a new output")
    report = verify(args.original)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as stream:
        json.dump(report, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    print(json.dumps({"pass": report["pass"], **report["comparison"], "output": str(args.output)}))


if __name__ == "__main__":
    main()
