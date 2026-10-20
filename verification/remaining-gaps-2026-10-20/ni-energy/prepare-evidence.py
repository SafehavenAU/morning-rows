"""Retain a minimal transformed specimen from the frozen independent audit.

No network or runtime-reader imports. Original statistical XML bytes are kept;
unrelated ZIP metadata, all contact/footer material and other figures are omitted.
"""
import argparse, base64, datetime, hashlib, html, io, json, pathlib, re, zipfile
from html.parser import HTMLParser

class Report(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.jsons, self.buffer = [], [], []
        self.is_json = False
    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == "a" and attributes.get("href", "").startswith("data:"):
            self.links.append(attributes)
        if tag == "script":
            self.is_json = attributes.get("type") == "application/json"
            self.buffer = []
    def handle_data(self, value):
        if self.is_json:
            self.buffer.append(value)
    def handle_endtag(self, tag):
        if tag == "script" and self.is_json:
            self.jsons.append(json.loads("".join(self.buffer)))
            self.is_json = False

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audit", type=pathlib.Path)
    ap.add_argument("output", type=pathlib.Path)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    raw = (args.audit / "original/report.html").read_bytes()
    document = raw.decode("utf-8")
    parsed = Report()
    parsed.feed(document)
    reference_raw = (args.audit / "independent-report.json").read_bytes()
    reference = json.loads(reference_raw)
    assert reference["pass"] and len(reference["observations"]) == 5
    assert reference["original_report_sha256"] == sha(raw)
    fields = {}
    for name in ["Coverage", "Frequency", "Official Statistics Status", "Publication date", "Publication period"]:
        matches = re.findall(r"<strong>\s*" + name + r":\s*</strong>\s*([^<]+)", document)
        assert len(matches) == 1
        fields[name] = re.sub(r"\s+", " ", html.unescape(matches[0])).strip()
    heading = re.findall(r"<h1\b[^>]*>(.*?)</h1>", document, re.S)
    assert len(heading) == 1
    title = re.sub(r"\s+", " ", re.sub(r"<[^>]*>", "", heading[0])).strip()
    paragraphs = []
    for pattern in [
        r"This report format follows.*?plus imports of electricity minus exports of electricity\.",
        r"Data from SONI and NIE Networks may be subject to revision.*?future publications\.",
        r"Percentage estimates in this report are published to the nearest\s+whole percent\.",
    ]:
        matches = re.findall(pattern, document, re.S)
        assert len(matches) == 1
        paragraphs.append(re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", matches[0])).strip())
    report = "<!doctype html><html><body>\n<h1>" + html.escape(title) + "</h1>\n"
    report += "\n".join("<p><strong>" + name + ": </strong>" + html.escape(value) + "</p>" for name, value in fields.items()) + "\n"
    report += "\n".join("<p>" + html.escape(value) + "</p>" for value in paragraphs) + "\n"
    ledger = {"created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "network_requests": 0,
              "source_report": {"path": "../prior-audit/ni-energy/original/report.html", "bytes": len(raw), "sha256": sha(raw)},
              "source_independent_report_sha256": sha(reference_raw),
              "transformations": ["Selected title, five publication/scope fields and three methodology paragraphs only",
                                  "Selected Figure1/Figure3 embedded XLSX; preserve four statistical XML parts byte-for-byte",
                                  "Omit all contacts/footer, other figures, scripts, docProps, printer settings, styles and theme",
                                  "Repackage retained XML ZIP entries; original and retained archive digests are distinct"],
              "archives": []}
    for figure in [1, 3]:
        links = [link for link in parsed.links if re.fullmatch(r"ecrg-figure-" + str(figure) + r"-[a-z]+-\d{4}\.xlsx", link.get("download", ""))]
        assert len(links) == 1
        archive = base64.b64decode(links[0]["href"].split(",", 1)[1], validate=True)
        buf = io.BytesIO()
        parts = []
        with zipfile.ZipFile(io.BytesIO(archive)) as original, zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as retained:
            for name in ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]:
                data = original.read(name)
                info = zipfile.ZipInfo(name, (2026, 10, 20, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                retained.writestr(info, data)
                parts.append({"path": name, "bytes": len(data), "sha256": sha(data)})
        retained_raw = buf.getvalue()
        file = f"figure-{figure}.xlsx"
        (args.output / file).write_bytes(retained_raw)
        ledger["archives"].append({"figure": figure, "file": file, "download": links[0]["download"], "wire_bytes": len(archive), "wire_sha256": sha(archive), "retained_bytes": len(retained_raw), "retained_sha256": sha(retained_raw), "unchanged_xml_parts": parts})
        uri = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + base64.b64encode(retained_raw).decode()
        report += '<a href="' + uri + '" download="' + links[0]["download"] + '">Figure ' + str(figure) + '.XLSX (' + str((len(archive)+999)//1000) + 'kB)</a>\n'
    report += "</body></html>\n"
    assert not re.search(r"\bContact:|\bTelephone:|mailto:", report, re.I)
    (args.output / "report.excerpt.html").write_text(report)
    ledger["retained_report"] = {"file": "report.excerpt.html", "bytes": len(report.encode()), "sha256": sha(report.encode()), "transformed": True}
    chart = []
    for cell in reference["observations"]:
        index = 0 if cell["measure"] == "renewable_share_gfec" else 2
        traces = [trace for trace in parsed.jsons[index]["x"]["data"] if trace.get("name") == cell["plotly_trace"]]
        assert len(traces) == 1 and traces[0]["y"][-1] == cell["value"] and traces[0]["x"][-1] == "2026-06-01"
        chart.append({"measure": cell["measure"], "trace": cell["plotly_trace"], "date": traces[0]["x"][-1], "value": traces[0]["y"][-1]})
    (args.output / "chart-selection.json").write_text(json.dumps(chart, indent=2) + "\n")
    (args.output / "acquisition.json").write_text(json.dumps(ledger, indent=2) + "\n")
    print(json.dumps({"pass": True, "retained_bytes": ledger["retained_report"]["bytes"], "archives": len(ledger["archives"]), "network_requests": 0}))

if __name__ == "__main__":
    main()
