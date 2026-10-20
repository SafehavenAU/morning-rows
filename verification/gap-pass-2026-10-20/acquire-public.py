"""Explicit public original-source acquisition; never overwrites a specimen."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import sys
import urllib.request

TARGETS = {
    "wra-data.csv": "https://api.stats.gov.wales/v2/60a57730-166f-486d-9315-69f7fd4c78b1/data?format=csv",
    "wra-metadata.json": "https://api.stats.gov.wales/v2/60a57730-166f-486d-9315-69f7fd4c78b1",
    "nz-fleet-index.html": "https://www.transport.govt.nz/statistics-and-insights/fleet-statistics/sheet/annual-fleet-statistics",
    "scotland-index.html": "https://www.transport.gov.scot/our-approach/statistics",
    "scotland-edition.html": "https://www.transport.gov.scot/publication/scottish-transport-statistics-2025/",
}
out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=False)


def fetch(item):
    name, url = item
    record = {"file": name, "url": url, "retrieved_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MorningRows-evidence/1.0", "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=35) as response:
            data = response.read(3 * 1024 * 1024 + 1)
            if len(data) > 3 * 1024 * 1024:
                raise ValueError("Evidence response exceeds 3 MiB bound")
            record.update(status=response.status, final_url=response.url, headers={
                k: response.headers[k] for k in ("Content-Type", "Last-Modified", "Date") if k in response.headers
            })
        (out / name).write_bytes(data)
        record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    except Exception as exc:
        record["error"] = str(exc)
    return record


with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    records = list(pool.map(fetch, TARGETS.items()))
(out / "acquisition.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps(records, indent=2))
