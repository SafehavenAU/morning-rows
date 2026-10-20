"""Independent standard-library extraction of WRA CSV and official HTML table."""
import csv
import datetime
import hashlib
import json
import pathlib
import re
import sys
from decimal import Decimal
from html.parser import HTMLParser


class Table(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th"):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            if self.row is not None:
                self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None


directory = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
if output.exists():
    raise ValueError("Refusing to overwrite an evidence report")
csv_rows = list(csv.DictReader((directory / "wra-data.csv").open(encoding="utf-8-sig")))
table = Table()
table.feed((directory / "wra-table-all.html").read_text())
assert ["Data values", "Data description", "Period", "Description", "Transaction type"] in table.rows
period = "2025-26"
restricted = "Annual total excluding untypical and undisclosed transactions"
selections = [
    ("all_inclusive", "Annual total", "All transactions"),
    ("all_disclosed", restricted, "All transactions"),
    ("residential_disclosed", restricted, "Residential"),
    ("non_residential_disclosed", restricted, "Non-residential"),
]
comparisons = []
for measure, coverage, transaction_type in selections:
    raw = [r for r in csv_rows if r["Period"] == period
           and r["Description"] == coverage and r["Transaction type"] == transaction_type]
    presented = [r for r in table.rows if len(r) == 5 and r[2:] == [period, coverage, transaction_type]]
    assert len(raw) == len(presented) == 1
    a, b = raw[0], presented[0]
    assert a["Data description"] == b[1] == "Tax due (£ million)"
    assert a["Notes"] == "Revised"
    match = re.fullmatch(r"(\d+\.\d+) \[r\]", b[0])
    assert match, b[0]
    assert Decimal(a["Data values"]) == Decimal(match[1])
    comparisons.append(dict(measure=measure, period=period, coverage=coverage,
                            transaction_type=transaction_type, csv=a["Data values"],
                            official_table=match[1], value=float(Decimal(a["Data values"])),
                            unit="GBP million", notes=a["Notes"], exact_match=True))
excluded = [r for r in csv_rows if r["Period"] == period
            and r["Description"] == "Annual total" and r["Transaction type"] != "All transactions"]
assert len(excluded) == 2 and all(r["Data values"] == "" and "Not Applicable" in r["Notes"] for r in excluded)
metadata = json.loads((directory / "wra-metadata.json").read_text())
assert metadata["id"] == "60a57730-166f-486d-9315-69f7fd4c78b1"
revision = metadata["published_revision"]
assert revision["id"] == "8d10f1e5-c8d2-4921-9c67-2707bf631a87"
assert revision["publish_at"] == "2026-09-25T08:30:00.000Z"
report = dict(
    verified_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), passed=True,
    method="Python csv + HTMLParser + Decimal; independent of runtime JavaScript",
    comparisons=comparisons, comparable_cells=4, excluded_missing_cells=2,
    publication_time=revision["publish_at"], revision=revision["id"],
    lineage="Both presentations share WRA/StatsWales administrative data; independent extraction/presentation, not independent statistical production.",
    source_sha256={p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in directory.iterdir() if p.is_file()},
)
output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"passed": True, "comparable_cells": 4, "excluded_missing_cells": 2}))
