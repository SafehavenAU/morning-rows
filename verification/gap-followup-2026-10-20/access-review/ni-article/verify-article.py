#!/usr/bin/env python3
"""Offline extraction only; no runtime-reader imports and no HTTP."""
import datetime as dt
import hashlib
from html import unescape
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
source = HERE / "article-download.tmp"
excerpt = HERE / "statistical-article.excerpt.html"
acquisition = json.loads((HERE / "second-acquisition.json").read_text())
if source.exists():
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == acquisition["wire_sha256"]
    html = raw.decode("utf-8")
    start = html.index('<h1 class="page-title">')
    end = re.search(r'<h2>\s*<span>Contact details</span>\s*</h2>', html).start()
    excerpt.write_text(html[start:end])
    # Public copyright footer is a separate minimal original fragment.
    terms = re.search(r'<a[^>]+href="[^"]*crown-copyright-economy"[^>]*>[\s\S]*?</a>', html)
    if terms:
        (HERE / "copyright-link.excerpt.html").write_text(terms.group(0) + "\n")
    source.unlink()
html = excerpt.read_text()
text = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html)))
patterns = {
    "renewable_generation": r"volume of electricity generated from renewable sources in the year to June 2026 \(([0-9,]+) GWh\)",
    "renewable_share_gfec": r"was equivalent to ([0-9]+)% of gross final electricity consumption",
    "gross_final_consumption": r"gross final electricity consumption \(([0-9,]+) GWh\)",
    "non_renewable_generation": r"([0-9,]+) GWh \(47%\) was from non-renewable sources",
    "net_imports": r"year to June 2026, Northern Ireland imported more than it exported with net imports of ([0-9,]+) GWh",
}
values = {}
for key, pattern in patterns.items():
    matches = re.findall(pattern, text)
    assert len(matches) == 1, (key, matches)
    values[key] = int(matches[0].replace(",", ""))
assert "Latest results published 3 September 2026" in text
assert "12-month period July 2025 to June 2026" in text
assert "moved to a Gross Final Electricity Consumption approach in March 2026" in text
assert "December 2026" in text
prior_path = ROOT / "remaining-gaps-2026-10-20/ni-energy/independent-report.json"
prior_bytes = prior_path.read_bytes()
prior = json.loads(prior_bytes)
assert prior["pass"]
comparisons = []
for row in prior["observations"]:
    key = row["measure"]
    comparisons.append({"measure": key, "article": values[key], "original_workbook": row["value"],
                        "cell": row["cell"], "figure": row["figure"],
                        "pass": values[key] == row["value"]})
assert all(x["pass"] for x in comparisons)
report = {
    "pass": True, "kind": "Independent offline extraction of newly acquired official article",
    "verified_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    "network_requests_in_verifier": 0, "runtime_reader_imports": 0,
    "original_acquisition": acquisition, "article_excerpt_sha256": hashlib.sha256(excerpt.read_bytes()).hexdigest(),
    "prior_reference": str(prior_path.relative_to(ROOT)),
    "prior_reference_sha256": hashlib.sha256(prior_bytes).hexdigest(),
    "publication_date": "2026-09-03", "period_start": "2025-07-01", "period_end": "2026-06-30",
    "comparisons": comparisons, "observations_compared": 5,
    "metadata_present": ["exact title", "published date", "rolling window", "GFEC method from March2026", "next publication December2026"],
    "metadata_absent": ["full own-use basis", "full revisions policy", "Statistics in Development status"],
    "independent_statistical_lineage": False,
    "worker_access_verified": False, "release_accepted": False,
    "limitations": ["Same-vintage original report establishes fuller definitions; future editions need explicit metadata review.",
                    "Workspace article transport is not Worker access or production acceptance."]
}
(HERE / "comparison.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"pass": True, "comparisons": len(comparisons), "worker_access_verified": False}))
