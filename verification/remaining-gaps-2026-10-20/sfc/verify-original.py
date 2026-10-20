#!/usr/bin/env python3
"""Offline independent stdlib extraction; never imports the JavaScript reader."""
import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
ORIGINAL = HERE.parent / "prior-audit" / "sfc" / "original"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
EXPECTED = {
    "tables.xlsx": "f4816a63e4ab246799f4cbb6075d3feba78ada67670e34d71e5900826c3b5979",
    "parliament-briefing.html": "cd331fb59d50596ecfa4bfdb9fbe030f65f32624bc4deca27fc2da2597246d81",
}
for filename, digest in EXPECTED.items():
    assert hashlib.sha256((ORIGINAL / filename).read_bytes()).hexdigest() == digest, filename

with ZipFile(ORIGINAL / "tables.xlsx") as archive:
    strings = [
        "".join(item.itertext())
        for item in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)
    ]
    sheets = ET.fromstring(archive.read("xl/workbook.xml")).findall("s:sheets/s:sheet", NS)
    relations = {
        item.attrib["Id"]: item.attrib["Target"]
        for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    }

    def sheet(name):
        matched = [item for item in sheets if item.attrib["name"] == name]
        assert len(matched) == 1, name
        target = relations[matched[0].attrib[R]]
        target = target.lstrip("/") if target.startswith("/") else "xl/" + target
        cells = {}
        for cell in ET.fromstring(archive.read(target)).findall(".//s:c", NS):
            ref = cell.attrib["r"]
            assert ref not in cells
            value = cell.find("s:v", NS)
            kind = cell.attrib.get("t")
            if kind == "s":
                parsed = strings[int(value.text)]
            elif kind == "inlineStr":
                parsed = "".join(cell.find("s:is", NS).itertext())
            elif value is None:
                parsed = None
            elif kind is None or kind == "n":
                parsed = Decimal(value.text)
            elif kind == "str":
                parsed = value.text
            else:
                parsed = None
            cells[ref] = parsed
        return cells

    fte, totals, geography = sheet("Table 1"), sheet("Table 3"), sheet("Table 14")

assert fte["B16"] == "2024-25"
assert fte["G5"] == "Full-time equivalents (FTEs)"
assert "all funding sources" in fte["B3"]
assert "Scotland’s Colleges" in geography["B2"]
headers = ["Academic Year", "Part-time FE", "Full-time FE", "Part-time HE", "Full-time HE", "Total"]
assert [fte[f"{column}6"] for column in "BCDEFG"] == headers
values = [fte[f"{column}16"] for column in "CDEFG"]
assert all(isinstance(value, Decimal) and value >= 0 and value % 5 == 0 for value in values)
assert totals["B15"] == "2024-25" and totals["E5"] == "FTEs" and totals["E15"] == values[-1]


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.current, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            assert self.current is None, "Nested presentation table"
            self.current = []
        elif self.current is not None and tag == "tr":
            self.row = []
        elif self.row is not None and tag in ("th", "td"):
            self.cell = []

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.current.append(self.row)
            self.row = None
        elif tag == "table" and self.current is not None:
            self.tables.append(self.current)
            self.current = None


parser = Tables()
parser.feed((ORIGINAL / "parliament-briefing.html").read_text())
presentation_headers = ["Academic Year", "Part-time FE", "Full-time FE", "Part time HE", "Full-time HE", "Total"]
matching = [table for table in parser.tables if table and table[0] == presentation_headers]
assert len(matching) == 1, "Exactly one independently presented FTE table"
rows = [row for row in matching[0] if row and row[0] == "2024-25"]
assert len(rows) == 1 and len(rows[0]) == 6
presented = [Decimal(cell.replace(",", "")) for cell in rows[0][1:]]
assert values == presented, "All five original numeric cells must exactly match Parliament"
assert abs(sum(values[:4]) - values[4]) <= Decimal("12.5")
measures = ["part_time_fe", "full_time_fe", "part_time_he", "full_time_he", "total"]
report = {
    "pass": True,
    "verified_at": datetime.now(timezone.utc).isoformat(),
    "method": "Independent Python stdlib ZIP/XML/Decimal extraction versus HTMLParser extraction of the Scottish Parliament FTE table; no JavaScript reader import",
    "source_sha256": EXPECTED,
    "geography": "Scotland",
    "period": "2024-25",
    "unit": "full-time equivalents",
    "publication_date": "2026-02-04",
    "observations_compared": 5,
    "observations": [
        {"measure": measure, "cell": column + "16", "value": int(original), "official_presentation_value": int(other)}
        for measure, column, original, other in zip(measures, "CDEFG", values, presented)
    ],
    "cross_table_total_matches": True,
    "shared_lineage": "Both presentations derive from Scottish Funding Council FES; independent presentation/extraction is not independent statistical measurement.",
    "runtime_or_release_acceptance": False,
}
(HERE / "independent-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"pass": True, "observations_compared": 5, "output": "independent-report.json"}))
