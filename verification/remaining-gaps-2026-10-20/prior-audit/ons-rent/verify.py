#!/usr/bin/env python3
"""Independent ONS XLSX/XML and official HTML extraction; never calls the network."""
import argparse
from datetime import datetime, timedelta
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
CELLS = {
    "all_properties": "H", "one_bedroom": "L", "two_bedrooms": "P",
    "three_bedrooms": "T", "four_or_more_bedrooms": "X",
    "flats_all_bedrooms_control": "AN",
}


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden and data.strip():
            self.parts.append(data.strip())


def extract(wire, output):
    ledger = json.loads((ROOT / "acquisition.json").read_text())
    for name in ("ons-workbook", "ons-manchester"):
        entry = next(x for x in ledger if x["name"] == name)
        raw = (wire / entry["local_file"]).read_bytes()
        assert len(raw) == entry["bytes"] and hashlib.sha256(raw).hexdigest() == entry["sha256"], name
    with ZipFile(wire / "ons-workbook.body") as z:
        strings = ["".join(el.itertext()) for el in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        selected = None
        with z.open("xl/worksheets/sheet4.xml") as source:
            for _, row in ET.iterparse(source, events=("end",)):
                if row.tag != NS + "row":
                    continue
                values = {}
                for c in row.findall(NS + "c"):
                    v = c.find(NS + "v")
                    if v is not None:
                        values[c.attrib["r"]] = strings[int(v.text)] if c.attrib.get("t") == "s" else v.text
                number = row.attrib["r"]
                if values.get("B" + number) == "E08000003":
                    selected = values
                row.clear()
        assert selected is not None
        n = re.sub(r"^[A-Z]+", "", next(iter(selected)))
        month = (datetime(1899, 12, 30) + timedelta(days=float(selected["A" + n]))).strftime("%Y-%m")
        workbook = {
            "release_date": "2026-09-16", "sheet": "Table 1",
            "sheet_xml_uncompressed_bytes": z.getinfo("xl/worksheets/sheet4.xml").file_size,
            "period": month, "geography": selected["C" + n], "geography_code": selected["B" + n],
            "cells": {key: {"cell": col + n, "value": int(float(selected[col + n]))} for key, col in CELLS.items()},
            "transformation": "Standard-library XML extraction of the last Manchester row in Table 1; Excel date converted to calendar month. Selected numeric rent cells only.",
        }
    p = Text()
    p.feed((wire / "ons-manchester.body").read_text())
    text = " ".join(p.parts)
    month_text = re.search(r"average rents as of ([A-Za-z]+ \d{4}) in Manchester were:", text)[1]
    rent_list = text[text.index("average rents as of "):]
    patterns = {
        "all_properties": r"The average monthly private rent in Manchester was £([\d,]+)",
        "one_bedroom": r"One bedroom: £([\d,]+)", "two_bedrooms": r"Two bedrooms: £([\d,]+)",
        "three_bedrooms": r"Three bedrooms: £([\d,]+)",
        "four_or_more_bedrooms": r"Four or more bedrooms: £([\d,]+)",
        "flats_all_bedrooms_control": r"Flats and maisonettes: £([\d,]+)",
    }
    presentation = {
        "release_date": datetime.strptime(re.search(r"Last updated: (\d+ [A-Za-z]+ \d{4})", text)[1], "%d %B %Y").strftime("%Y-%m-%d"),
        "period": datetime.strptime(month_text, "%B %Y").strftime("%Y-%m"),
        "geography": "Manchester", "geography_code": "E08000003",
        "values": {key: int(re.search(pattern, text if key == "all_properties" else rent_list)[1].replace(",", "")) for key, pattern in patterns.items()},
        "transformation": "HTMLParser excludes script/style; independent regular expressions read the official narrative rent paragraph and bedroom/property lists. No workbook parser reused.",
    }
    write(output / "selected-workbook.json", workbook)
    write(output / "selected-presentation.json", presentation)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wire-root", type=Path)
    ap.add_argument("--output", type=Path, default=ROOT)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.wire_root:
        extract(args.wire_root, args.output)
    a = json.loads((args.output / "selected-workbook.json").read_text())
    b = json.loads((args.output / "selected-presentation.json").read_text())
    assert a["release_date"] == b["release_date"] == "2026-09-16"
    assert a["period"] == b["period"] == "2026-08"
    assert a["geography_code"] == b["geography_code"] == "E08000003"
    assert set(a["cells"]) == set(b["values"]) == set(CELLS)
    comparisons = [{"measure": k, "cell": a["cells"][k]["cell"], "workbook": a["cells"][k]["value"], "official_presentation": b["values"][k], "match": a["cells"][k]["value"] == b["values"][k]} for k in CELLS]
    assert all(x["match"] for x in comparisons)
    report = {"pass": True, "matched_cells": len(comparisons), "bedroom_cells": 4, "comparisons": comparisons, "release_date": a["release_date"], "period": a["period"], "shared_lineage": "Both are ONS PIPR outputs; different official presentations and separate extraction methods do not independently certify ONS estimation.", "joint_bedroom_property_estimate": False}
    write(args.output / "reconciliation.json", report)
    print(json.dumps({"pass": True, "matched_cells": len(comparisons), "bedroom_cells": 4}))


if __name__ == "__main__":
    main()
