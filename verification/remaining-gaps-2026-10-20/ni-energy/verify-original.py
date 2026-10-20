"""Independent Python ZIP/XML extraction against chart and dated-news evidence."""
import argparse, datetime, hashlib, io, json, pathlib, re, zipfile, xml.etree.ElementTree as E

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
def digest(raw):
    return hashlib.sha256(raw).hexdigest()
def workbook(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        strings = ["".join(si.itertext()) for si in E.fromstring(z.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        result = {}
        for cell in E.fromstring(z.read("xl/worksheets/sheet1.xml")).findall(".//s:c", NS):
            value = cell.find("s:v", NS).text
            result[cell.attrib["r"]] = strings[int(value)] if cell.attrib.get("t") == "s" else int(value)
        return result
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("original", type=pathlib.Path)
    parser.add_argument("audit", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError(args.output)
    acquisition = json.loads((args.original / "acquisition.json").read_text())
    chart = json.loads((args.original / "chart-selection.json").read_text())
    audit = json.loads((args.audit / "independent-report.json").read_text())
    original_news = (args.audit / "original/news.html").read_bytes()
    news = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", original_news.decode()))
    checks = []
    def check(name, value):
        checks.append({"check": name, "pass": bool(value)})
        if not value:
            raise ValueError(name)
    check("independent_prior_audit", audit["pass"] and audit["independent_statistical_lineage"] is False)
    check("dated_news_wire_hash", digest(original_news) == audit["news_sha256"])
    report = (args.original / "report.excerpt.html").read_bytes()
    check("minimal_report_hash", digest(report) == acquisition["retained_report"]["sha256"])
    check("minimal_report_no_contact_fields", not re.search(rb"Telephone:|mailto:|Contact:", report, re.I))
    books = {}
    for archive in acquisition["archives"]:
        raw = (args.original / archive["file"]).read_bytes()
        check(f"figure{archive['figure']}_retained_archive_hash", digest(raw) == archive["retained_sha256"])
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            check(f"figure{archive['figure']}_only_statistical_parts", set(z.namelist()) == {part["path"] for part in archive["unchanged_xml_parts"]})
            for part in archive["unchanged_xml_parts"]:
                check(f"figure{archive['figure']}_{part['path']}", digest(z.read(part["path"])) == part["sha256"])
        books[archive["figure"]] = workbook(raw)
    mappings = [("renewable_share_gfec", 1, "B"), ("gross_final_consumption", 3, "B"),
                ("renewable_generation", 3, "C"), ("non_renewable_generation", 3, "D"), ("net_imports", 3, "E")]
    observations = []
    for measure, figure, column in mappings:
        cells = books[figure]
        date_rows = [(int(ref[1:]), value) for ref, value in cells.items() if re.fullmatch(r"A\d+", ref) and isinstance(value, int)]
        date_rows.sort()
        row, serial = date_rows[-1]
        month = (datetime.date(1899, 12, 30) + datetime.timedelta(days=serial)).isoformat()
        original = next(r for r in audit["observations"] if r["measure"] == measure)
        presentation = next(r for r in chart if r["measure"] == measure)
        value = cells[column + str(row)]
        check(measure + "_exact_workbook_value", value == original["value"])
        check(measure + "_exact_chart_value_and_month", value == presentation["value"] and month == presentation["date"])
        check(measure + "_exact_rolling_window", month == "2026-06-01" and original["period_start"] == "2025-07-01" and original["period_end"] == "2026-06-30")
        check(measure + "_dated_news_number", ("50%" in news) if measure == "renewable_share_gfec" else f"{value:,}" in news)
        observations.append({**{k:original[k] for k in ["measure","unit","geography","period_start","period_end","publisher_date"]},
                             "period": original["period_start"] + "/" + original["period_end"],
                             "value": value, "figure": figure, "cell": column + str(row), "reference_month": month[:7],
                             "plotly_trace": presentation["trace"]})
    values = {row["measure"]:row["value"] for row in observations}
    residual = values["gross_final_consumption"] - sum(values[k] for k in ["renewable_generation","non_renewable_generation","net_imports"])
    check("rounded_balance", abs(residual) <= 2)
    check("rounded_renewable_gfec_share", abs(100 * values["renewable_generation"] / values["gross_final_consumption"] - values["renewable_share_gfec"]) <= .5)
    result = {"pass": all(c["pass"] for c in checks), "verified_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "method": "Python stdlib ZIP/XML extraction, separately retained official Plotly presentation and frozen dated DfE news; no runtime imports or HTTP",
              "independent_statistical_lineage": False, "publication_date":"2026-09-03", "observations":observations, "checks":checks,
              "component_residual_gwh": residual, "source_report_sha256": acquisition["source_report"]["sha256"],
              "dated_news_sha256":digest(original_news), "original_acquisition_ledger_sha256":digest((args.original/"acquisition.json").read_bytes()),
              "limitations":["All presentations share SONI/NIE/DESNZ statistical lineage.", "Evidence certifies five latest-window cells only, not the complete historical series.", "News numbers are corroboration of the frozen independently reviewed report, not an alternative automated production feed."],
              "production_acceptance": False}
    with args.output.open("x") as output:
        json.dump(result, output, indent=2)
        output.write("\n")
    print(json.dumps({"pass":result["pass"],"checks":len(checks),"observations":len(observations)}))

if __name__ == "__main__":
    main()
