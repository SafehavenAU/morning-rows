#!/usr/bin/env python3
"""One bounded GET per newly documented official route; never retries held URLs."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
ROUTES = {
    "ni-article": (
        "https://www.economy-ni.gov.uk/articles/electricity-consumption-and-renewable-generation-statistics",
        262144,
    ),
    "cqc-gov-pdf": (
        "https://assets.publishing.service.gov.uk/media/68fa3b4fe200d653d8b63735/care-quality-commission-state-of-health-care-and-adult-social-care-England-2024-2025.pdf",
        8 * 1024 * 1024,
    ),
}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def clock():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def acquire(key):
    url, limit = ROUTES[key]
    out = ROOT / key
    out.mkdir(parents=True, exist_ok=True)
    record_path = out / "acquisition.json"
    if record_path.exists():
        raise SystemExit(f"Refusing repeat acquisition: {record_path}")
    record = {"url": url, "method": "GET", "started_at": clock(),
              "max_bytes": limit, "timeout_seconds": 30, "retries": 0,
              "credentials": False, "redirects_followed": False,
              "user_agent": "MorningRowsResearch/1.0 (+https://morningrows.com)"}
    req = urllib.request.Request(url, headers={"User-Agent": record["user_agent"]})
    try:
        response = urllib.request.build_opener(NoRedirect()).open(req, timeout=30)
        with response:
            data = response.read(limit + 1)
            record.update(status=response.status, content_type=response.headers.get("Content-Type"),
                          bytes=len(data), wire_sha256=sha(data), completed_at=clock())
            if len(data) > limit:
                raise ValueError("Bound exceeded")
            if response.status != 200:
                raise ValueError("Unexpected HTTP status")
            if key == "ni-article":
                html = data.decode("utf-8")
                start = html.index('<h1')
                match = re.search(r'<h[1-6][^>]*>\s*(?:<span>)?Contact details(?:</span>)?\s*</h[1-6]>', html, re.I)
                if not match or match.start() <= start:
                    raise ValueError("Cannot safely isolate statistical article before contact fields")
                selected = html[start:match.start()]
                if not all(x in selected for x in ["8,865", "4,431", "3,855", "578", "50%"]):
                    raise ValueError("Five expected comparison cells not present")
                raw = selected.encode("utf-8")
                (out / "statistical-article.excerpt.html").write_bytes(raw)
                record["retained"] = [{"file": "statistical-article.excerpt.html", "bytes": len(raw),
                    "sha256": sha(raw), "transformation": "Exact UTF-8 substring from h1 to before Contact details; navigation/footer/contact data omitted."}]
            else:
                import fitz
                book = fitz.open(stream=data, filetype="pdf")
                pages = [187, 188]  # PDF zero-based; printed pages 186 and 187.
                if len(book) != 205:
                    raise ValueError("Different report pagination")
                text = "\n".join(book[p].get_text() for p in pages)
                if not all(x in text for x in ["3,062", "2,063", "809", "125", "65", "1 August 2025"]):
                    raise ValueError("Exact cohort page not found")
                minimal = fitz.open()
                for p in pages:
                    minimal.insert_pdf(book, from_page=p, to_page=p)
                raw = minimal.tobytes(garbage=4, deflate=True)
                (out / "cohort-pages.excerpt.pdf").write_bytes(raw)
                txt = text.encode("utf-8")
                (out / "cohort-pages.txt").write_bytes(txt)
                record["retained"] = [
                    {"file": "cohort-pages.excerpt.pdf", "bytes": len(raw), "sha256": sha(raw),
                     "transformation": "Selected PDF page indices 187,188 only; repackaged, not byte-identical full report."},
                    {"file": "cohort-pages.txt", "bytes": len(txt), "sha256": sha(txt),
                     "transformation": "PyMuPDF text extraction of those same pages."}]
                record["source_pages"] = len(book)
            record["pass"] = True
    except urllib.error.HTTPError as exc:
        body = exc.read(limit + 1)
        record.update(status=exc.code, error=str(exc), bytes=len(body), wire_sha256=sha(body),
                      completed_at=clock(), pass_=False)
    except Exception as exc:
        record.update(error=str(exc), completed_at=clock(), pass_=False)
    if "pass_" in record:
        record["pass"] = record.pop("pass_")
    record_path.write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("route", choices=ROUTES)
    acquire(p.parse_args().route)
