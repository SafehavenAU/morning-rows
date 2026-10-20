#!/usr/bin/env python3
"""Reconcile a new official PDF presentation without fetching or runtime imports."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import re

p = Path(__file__).resolve().parent
txt = (p / "cohort-pages.txt").read_text()
figure = txt.split("Figure A1: Adult social care, overall ratings, 2025")[1]
values = [int(x.replace(",", "")) for x in re.findall(r"\(([0-9,]+)\)", figure)]
assert len(values) == 4
total = int(re.search(r"show the ([0-9,]+) ratings for adult social", txt).group(1).replace(",", ""))
assert sum(values) == total
assert "as at 1 August 2025" in txt and "individual services at a location" in txt
assert "based on risk" in txt and "should not be combined with or compared with" in txt
prior = p.parents[2] / "remaining-gaps-2026-10-20/cqc/independent-reference.json"
wire = prior.read_bytes()
ref = json.loads(wire)
assert ref["passed"]
comparisons = [{"measure": r["measure"], "pdf_value": v, "workbook_value": r["value"], "pass": v == r["value"]}
               for r, v in zip(ref["references"], values + [total])]
assert all(r["pass"] for r in comparisons)
out = {
    "pass": True, "verified_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    "method": "PyMuPDF text extraction of exact official GOV.UK-linked PDF pages; category parentheses and separate narrative total reconciled with retained Python ZIP/XML workbook reference.",
    "source_acquisition": json.loads((p / "acquisition.json").read_text()),
    "reference_sha256": hashlib.sha256(wire).hexdigest(),
    "comparisons": comparisons, "observations_compared": 5,
    "publication_date": "2025-10-24", "snapshot_date": "2025-08-01",
    "shared_cqc_administrative_lineage": True,
    "actual_worker_tested": False, "runtime_parser_implemented": False, "release_accepted": False,
    "limitations": ["PDF is 7,175,967 bytes and requires a separately reviewed bounded extraction strategy and real Worker CPU/access proof.",
                    "GOV.UK publication links the PDF and CQC HTML, but no separate tabular asset was identified there.",
                    "Risk-prioritised service ratings; not unique locations, all-England quality or a comparable time series."]
}
(p / "comparison.json").write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps({"pass": True, "observations_compared": len(comparisons)}))
