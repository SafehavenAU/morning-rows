#!/usr/bin/env python3
"""Offline independent ZIP/XML and SVG comparison; imports no runtime reader."""
import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ORIGINAL = HERE.parent / "prior-audit" / "cqc" / "original"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
EXPECTED_FILES = {
    "ratings.xlsx": "8b8e87e34b48c8f9e171180afbd41d3abf5db7d5c0ca176eba5a8cc510902523",
    "adult-social-care.svg": "ca7c1cff2a9c72f7f266c8f2d16903b4a897486ea47ca8ac3c1fc65da55973f1",
    "charts.html": "907d15de90bda9c582359f927a1e45027e306ee1a1f3a4648d747cdebf6a5869",
    "using-data.html": "8e371c3d0f2b1aa2249ed924fc8fad73c76b9034e33757d57703594e9e71baf0",
}
LABELS = ["Inadequate", "Requires improvement", "Good", "Outstanding", "Total"]
IDS = ["inadequate", "requires_improvement", "good", "outstanding", "total"]
checks = []


def check(name, passed):
    checks.append({"check": name, "passed": bool(passed)})
    if not passed:
        raise AssertionError(name)


def normal(text):
    return re.sub(r"\s+", " ", text).strip()


files = []
for name, expected in EXPECTED_FILES.items():
    path = ORIGINAL / name
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    check(name + " exact original digest", digest == expected)
    request = json.loads(path.with_suffix(path.suffix + ".request.json").read_text())
    check(name + " retained original request digest", request["sha256"] == digest)
    files.append({"path": str(path.relative_to(HERE.parent)), "sha256": digest,
                  "bytes": len(data), "url": request["url"],
                  "retrieved_at": request["retrieved_at"]})

with zipfile.ZipFile(ORIGINAL / "ratings.xlsx") as archive:
    strings = ["".join(item.itertext()) for item in ET.fromstring(
        archive.read("xl/sharedStrings.xml")).findall("x:si", NS)]
    relationships = {
        item.attrib["Id"]: item.attrib["Target"]
        for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    }
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheet_paths = {}
    for item in workbook.findall("x:sheets/x:sheet", NS):
        target = relationships[item.attrib["{" + R + "}id"]]
        sheet_paths[item.attrib["name"]] = target.lstrip("/") if target.startswith("/") else "xl/" + target

    def sheet(name):
        cells = {}
        for cell in ET.fromstring(archive.read(sheet_paths[name])).findall(".//x:c", NS):
            value = cell.find("x:v", NS)
            cell_type = cell.attrib.get("t")
            if cell_type == "s" and value is not None:
                result = strings[int(value.text)]
            elif cell_type == "inlineStr":
                result = "".join(cell.find("x:is", NS).itertext())
            elif value is not None and cell_type in (None, "n"):
                # Keep original numeric text independent of the JS XLSX reader.
                result = {"number_text": value.text}
            elif value is not None:
                result = value.text
            else:
                result = None
            cells[cell.attrib["r"]] = result
        return cells

    guidance, contents, table = (sheet(name) for name in ("Guidance", "Table_of_contents", "1"))
    check("guidance snapshot", guidance["A1"] == "Ratings data for August 2025")
    check("guidance framework and exact snapshot",
          normal(guidance["A5"]).startswith("This workbook provides data for current published ratings under the single assessment framework, as at 1 August 2025."))
    check("risk and nonrepresentativeness", "based on risk" in guidance["A5"] and "unlikely to be representative" in guidance["A5"])
    check("no year comparability", "not directly comparable to previous years" in guidance["A5"])
    check("contents selected cohort", contents["B3"] == "Worksheet 1: Adult Social Care, overall ratings, August 2025")
    check("worksheet selected cohort", normal(table["A1"]) == "Worksheet 1: Adult Social Care, overall ratings, August 2025")
    check("publication date", table["A4"] == "Date report published: 24 October 2025")
    check("rating/value columns", table["A6"] == "Rating" and table["B6"] == "Value")
    counts = []
    for row, label in enumerate(LABELS, 7):
        check(f"row {row} label", table["A" + str(row)] == label)
        raw = table["B" + str(row)]
        check(f"row {row} native integer", isinstance(raw, dict) and bool(re.fullmatch(r"0|[1-9]\d*", raw["number_text"])))
        counts.append(int(raw["number_text"]))
    check("categories reconcile to total", sum(counts[:4]) == counts[4])

svg = ET.fromstring((ORIGINAL / "adult-social-care.svg").read_bytes())
text_nodes = ["".join(element.itertext()).strip() for element in svg.iter("{http://www.w3.org/2000/svg}text")]
chart_counts = [int(re.sub(r"[,()]", "", text)) for text in text_nodes if re.fullmatch(r"\([\d,]+\)", text)]
check("four separately presented SVG count cells", len(chart_counts) == 4)
check("SVG category labels in matching order", [text for text in text_nodes if text in LABELS[:4]][-4:] == LABELS[:4])
for label, workbook_value, chart_value in zip(LABELS, counts, chart_counts):
    check(label + " exact separate SVG comparison", workbook_value == chart_value)
check("SVG total equals workbook total", sum(chart_counts) == counts[4])

html = (ORIGINAL / "charts.html").read_text()
check("separate report service-versus-location qualification",
      "individual adult social care services are now rated separately as individual services at a location" in html)
check("separate report excludes prior framework combination",
      "should not be combined with or compared with those under previous frameworks" in html)
terms = (ORIGINAL / "using-data.html").read_text()
check("reuse guidance identifies Open Government Licence", "Open Government Licence" in terms)

references = [{"measure": measure, "label": label, "period": "2025-08-01", "unit": "ratings", "value": value}
              for measure, label, value in zip(IDS, LABELS, counts)]
report = {
    "passed": True, "verified_at": datetime.now(timezone.utc).isoformat(),
    "method": "Python stdlib ZIP/XML extraction and separate official SVG text extraction; no JavaScript reader imported",
    "files": files, "references": references, "checks": checks,
    "native_values": 5, "separate_svg_category_cells": 4,
    "total_check": "Sum of the four separately presented SVG category counts equals the workbook total",
    "tolerance": 0, "shared_cqc_administrative_lineage": True,
    "future_vintages_approved": False, "actual_worker_tested": False,
    "production_or_scheduled_acceptance": False,
}
(HERE / "independent-reference.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"passed": True, "checks": len(checks), "native_values": 5,
                  "separate_svg_category_cells": 4, "production_or_scheduled_acceptance": False}))
