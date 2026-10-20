#!/usr/bin/env python3
"""Independent, offline extraction from SHA-bound official HTML/XLSX downloads.

extract RAW_DIRECTORY creates minimal source excerpts and findings here.
verify rechecks retained hashes and reconstructs the comparison findings.
No network, runtime imports, credentials, or target-value substitution.
"""
import argparse
import hashlib
import json
import pathlib
import re
import xml.etree.ElementTree as ET
import zipfile
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent
NAMES = [
    "moj-data-tables", "moj-adult-method", "moj-sep2025-news",
    "corrections-index", "stats-sentenced-concept", "moj-people-jun2026",
    "moj-publication-finder", "moj-copyright",
]
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def write_new(path, data):
    with path.open("xb") as handle:
        handle.write(data)


class Blocks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.blocks, self.links = [], [], []
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        if tag in {"p", "li", "h1", "h2", "h3"}:
            self.stack.append((tag, []))
        if tag == "a":
            self.anchor = (dict(attrs).get("href", ""), [])

    def handle_data(self, data):
        for _, text in self.stack:
            text.append(data)
        if self.anchor:
            self.anchor[1].append(data)

    def handle_endtag(self, tag):
        if self.stack and self.stack[-1][0] == tag:
            _, text = self.stack.pop()
            self.blocks.append(" ".join("".join(text).split()))
        if tag == "a" and self.anchor:
            href, text = self.anchor
            self.links.append({"href": href, "text": " ".join("".join(text).split())})
            self.anchor = None


SELECTORS = {
    "moj-adult-method": (
        "We provide data to Stats NZ about adults",
        "From 1 July 2019, 17-year-olds",
        "Adults with finalised charges in court – most serious offence",
        "Adults convicted in court by sentence type – most serious offence",
        "These tables go back as far as",
    ),
    "moj-data-tables": (
        "The Ministry of Justice publish justice data tables every six months.",
        "Note that the data in these tables differs to",
        "The number of people with finalised charges and convicted charges,",
    ),
    "moj-sep2025-news": (
        "The Ministry of Justice has published its most recent official statistics",
        "The statistics are the first Ministry of Justice figures",
    ),
    "moj-copyright": (
        "The Ministry of Justice uses the Creative Commons Attribution",
        "This website is licensed under a Creative Commons",
        "Share — copy",
        "Adapt — remix",
        "Attribution — You must",
        "This license excludes all photography",
    ),
}


def html_excerpt(name, data):
    parser = Blocks()
    parser.feed(data.decode("utf-8"))
    selected = [
        {"block_index": i, "text": text}
        for i, text in enumerate(parser.blocks)
        if any(text.startswith(prefix) for prefix in SELECTORS[name])
    ]
    assert len(selected) >= 2, (name, "Missing expected original text")
    links = [
        x for x in parser.links
        if (name == "moj-data-tables" and
            ("people charged and convicted" in x["text"] or
             x["text"] == "Publication Finder"))
        or (name == "moj-copyright" and "creativecommons.org/licenses/by/4.0" in x["href"])
    ]
    return {
        "extraction": "HTMLParser text from selected original p/li/heading blocks; "
                      "navigation, contacts and unrelated content omitted.",
        "blocks": selected, "links": links,
    }


def workbook_excerpt(path):
    selections = {
        "xl/worksheets/sheet7.xml": {
            "A1", "A2", "A7", "AT7", "AU7", "A25", "AT25", "AU25",
        },
        "xl/worksheets/sheet9.xml": {"A1", "A2", "A7", "L6", "C17", "L17"},
        "xl/worksheets/sheet10.xml": {
            "A1", "A2", "AT8", "A9", "AT9", "A13", "AT13", "A23", "AT23",
        },
        "xl/worksheets/sheet11.xml": {
            "A5", "B5", "A7", "B7", "A14", "B14", "A15", "B15",
        },
    }
    with zipfile.ZipFile(path) as archive:
        raw_shared = archive.read("xl/sharedStrings.xml")
        shared = [
            "".join(item.itertext())
            for item in ET.fromstring(raw_shared).findall("s:si", NS)
        ]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        }
        names = {}
        for sheet in workbook.findall("s:sheets/sheet", NS):
            relation = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            names["xl/" + relationships[relation]] = sheet.attrib["name"]
        # ElementTree namespace-qualified path is explicit, never positional.
        if not names:
            for sheet in workbook.findall("s:sheets/s:sheet", NS):
                relation = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
                names["xl/" + relationships[relation]] = sheet.attrib["name"]
        cells, parts = [], []
        for member, wanted in selections.items():
            raw = archive.read(member)
            parts.append({"member": member, "bytes": len(raw), "sha256": sha(raw)})
            found = set()
            for cell in ET.fromstring(raw).findall(".//s:c", NS):
                coordinate = cell.attrib["r"]
                if coordinate not in wanted:
                    continue
                raw_value = cell.find("s:v", NS)
                assert raw_value is not None and raw_value.text is not None
                value = raw_value.text
                if cell.attrib.get("t") == "s":
                    value = shared[int(value)]
                cells.append({
                    "sheet": names[member], "member": member,
                    "coordinate": coordinate, "original_type": cell.attrib.get("t", "n"),
                    "original_value_text": value,
                })
                found.add(coordinate)
            assert found == wanted, (member, wanted - found)
    return {
        "extraction": "Independent Python zipfile/ElementTree extraction of selected "
                      "original cell values and shared strings; no runtime parser. "
                      "Original workbook author/contact properties, unrelated cells "
                      "and formatting are not retained.",
        "original_parts": parts,
        "cells": cells,
    }


def make_findings(sources):
    cells = sources["moj-people-jun2026"]["cells"]

    def value(member, coordinate):
        matches = [x["original_value_text"] for x in cells
                   if x["member"] == member and x["coordinate"] == coordinate]
        assert len(matches) == 1
        return matches[0]

    period = value("xl/worksheets/sheet7.xml", "AT7")
    observed = int(value("xl/worksheets/sheet7.xml", "AT25"))
    assert period == "2024/2025"
    assert observed == int(value("xl/worksheets/sheet9.xml", "L17"))
    assert observed == int(value("xl/worksheets/sheet10.xml", "AT9"))
    notes = value("xl/worksheets/sheet11.xml", "B14")
    assert "counts all people" in notes and "adults" in notes
    assert "19 years and under" == value("xl/worksheets/sheet10.xml", "A23")
    assert "financial years start in july and end in june" in value(
        "xl/worksheets/sheet11.xml", "B5").lower()
    assert "dash (-)" in value("xl/worksheets/sheet11.xml", "B15")
    return {
        "evidence_extraction_pass": True,
        "numeric_gates_closed": 0,
        "runtime_defect_established": False,
        "future_vintages_approved": False,
        "same_underlying_administrative_lineage": True,
        "independent_method": "Python stdlib HTMLParser and ZIP/XML; no runtime imports",
        "rejected_comparator": {
            "publisher": "New Zealand Ministry of Justice",
            "edition": "June 2026, version 1.0",
            "period": period, "value": observed, "unit": "people",
            "population": "All people with convicted charges; not the separate Stats NZ adult population",
            "exact_cell_repetitions": 3,
            "retained_adult_target": 50741,
            "difference_not_interpreted_as_reader_error": observed - 50741,
            "reason": "Different population and later edition; no exact adult fiscal "
                      "2024/25 revision lineage. The 19-and-under age group cannot "
                      "isolate 18+ with the July2019 transitional charge rule.",
        },
        "contracts": [
            {
                "id": "CORR_FIS_005", "period": "2024/2025", "target_value": 8199,
                "status": "blocked_external_evidence",
                "new_exact_numeric_reference": None,
                "reason": "No independently acquired exact fiscal sentenced-person "
                          "cell. New Corrections and Stats NZ concept acquisitions "
                          "returned HTTP403/error1010. Quarterly stocks and calendar "
                          "years do not satisfy this contract.",
            },
            {
                "id": "JUS_FIS_001", "period": "2024/2025", "target_value": 50741,
                "status": "blocked_external_evidence",
                "new_exact_numeric_reference": None,
                "reason": "New official metadata supports the adult counting rule, "
                          "but the acquired workbook is all-person/later-vintage. "
                          "Historical publication finder returned HTTP405.",
            },
        ],
    }


def extract(raw):
    sources, acquisitions, prepared = {}, [], {}
    for name in NAMES:
        data = (raw / (name + ".body")).read_bytes()
        acquisition = json.loads((raw / (name + ".json")).read_text())
        assert len(data) == acquisition["bytes"] and sha(data) == acquisition["sha256"]
        acquisitions.append(acquisition)
        if acquisition["status"] != 200:
            excerpt = {
                "extraction": "Failure metadata only; challenge body/footer not retained.",
                "observed_short_body": data.decode().strip() if len(data) < 80 else None,
                "no_retry_or_access_bypass": True,
            }
        elif name == "moj-people-jun2026":
            excerpt = workbook_excerpt(raw / (name + ".body"))
        else:
            excerpt = html_excerpt(name, data)
        excerpt["acquisition"] = acquisition
        retained = encoded(excerpt)
        assert not re.search(rb"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", retained)
        sources[name] = excerpt
        prepared["sources/" + name + ".json"] = retained
    findings = make_findings(sources)
    prepared["acquisitions.json"] = encoded(acquisitions)
    prepared["findings.json"] = encoded(findings)
    manifest = {
        "scope": "Two unchanged fiscal justice selections; zero exact numeric gates closed",
        "original_bodies": "Original hashes/bytes retained; local raw downloads remain outside the repository.",
        "licence": "Ministry of Justice excerpts: CC BY 4.0 International; credit Ministry "
                   "of Justice, indicate excerpt/XML extraction, no endorsement. "
                   "No third-party photographs, individual records or contact metadata retained.",
        "files": [{"file": name, "bytes": len(data), "sha256": sha(data)}
                  for name, data in sorted(prepared.items())],
    }
    for name, data in prepared.items():
        write_new(ROOT / name, data)
    write_new(ROOT / "manifest.json", encoded(manifest))
    return findings


def verify():
    manifest = json.loads((ROOT / "manifest.json").read_text())
    for item in manifest["files"]:
        data = (ROOT / item["file"]).read_bytes()
        assert len(data) == item["bytes"] and sha(data) == item["sha256"]
    sources = {name: json.loads((ROOT / "sources" / (name + ".json")).read_text())
               for name in NAMES}
    findings = make_findings(sources)
    assert findings == json.loads((ROOT / "findings.json").read_text())
    return findings


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["extract", "verify"])
    parser.add_argument("raw_directory", nargs="?", type=pathlib.Path)
    args = parser.parse_args()
    if args.mode == "extract":
        assert args.raw_directory is not None
        result = extract(args.raw_directory)
    else:
        assert args.raw_directory is None
        result = verify()
    print(json.dumps(result, ensure_ascii=False, indent=2))
