"""Research only: replay original aggregate specimens or fetch the same selections.

python research/project-demand-2026-10-17/demo.py [--live]
No deployment, credential access, persistent database or automatic retries.
"""
import argparse
import csv
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
SPEC = ROOT / "specimens"
GEO = {
    "K02000001": "United Kingdom", "E92000001": "England", "W92000004": "Wales",
    "S92000003": "Scotland", "N92000002": "Northern Ireland", "E08000025": "Birmingham",
    "W06000015": "Cardiff", "S12000049": "Glasgow City", "N09000003": "Belfast",
}
MONTHS = [f"2025-{m:02}" for m in range(8, 13)] + [f"2026-{m:02}" for m in range(1, 9)]
NOMIS_URL = ("https://www.nomisweb.co.uk/api/v01/dataset/NM_162_1.data.csv?geography="
             + ",".join(GEO) + "&date=" + ",".join(MONTHS)
             + "&gender=0&age=0&measure=1&measures=20100")
BOC_URL = "https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXGBPCAD/json?start_date=2026-10-12&end_date=2026-10-16"
AEMO_URL = "https://www.aemo.com.au/aemo/data/nem/priceanddemand/PRICE_AND_DEMAND_202610_{}.csv"
MARKET_TZ = timezone(timedelta(hours=10))


def decimal(raw):
    if raw is None or isinstance(raw, bool) or not str(raw).strip():
        raise ValueError("Missing numeric value")
    try:
        result = Decimal(str(raw))
    except InvalidOperation as exc:
        raise ValueError("Invalid numeric value") from exc
    if not result.is_finite():
        raise ValueError("Non-finite numeric value")
    return result


def money(value):
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "MorningRowsResearch/1.0"}), timeout=40) as response:
        if response.status != 200:
            raise ValueError("Unexpected HTTP status")
        body = response.read(8_000_001)
        if len(body) > 8_000_000:
            raise ValueError("Response too large")
        return body.decode("utf-8-sig")


def read_nomis(text):
    reader = csv.DictReader(io.StringIO(text))
    required = {"DATE", "GEOGRAPHY_CODE", "GEOGRAPHY_NAME", "GENDER", "AGE", "MEASURE",
                "MEASURES", "OBS_VALUE", "OBS_STATUS", "OBS_CONF", "RECORD_COUNT", "URN"}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("Not the expected Nomis data CSV")
    records = {code: {} for code in GEO}
    for row in reader:
        code, month = row["GEOGRAPHY_CODE"], row["DATE"]
        if code not in GEO or row["GEOGRAPHY_NAME"] != GEO[code]:
            raise ValueError("Unexpected geography code/name")
        if month not in MONTHS or month in records[code]:
            raise ValueError("Unexpected or duplicate geography/month")
        if [row[k] for k in ("GENDER", "AGE", "MEASURE", "MEASURES")] != ["0", "0", "1", "20100"]:
            raise ValueError("Unexpected claimant dimensions")
        if not row["URN"].startswith("Nm-162d1"):
            raise ValueError("Wrong dataset")
        if row["OBS_STATUS"] != "A" or row["OBS_CONF"] != "F":
            raise ValueError("Missing, suppressed or unrecognized observation status")
        value = decimal(row["OBS_VALUE"])
        if value < 0 or value % 5:
            raise ValueError("Not a non-negative count rounded to five")
        if int(row["RECORD_COUNT"]) != len(GEO) * len(MONTHS):
            raise ValueError("Unexpected record count / truncated query")
        records[code][month] = int(value)
    if any(set(rows) != set(MONTHS) for rows in records.values()):
        raise ValueError("Incomplete geography/month coverage")
    residuals = {}
    for month in MONTHS:
        residual = records["K02000001"][month] - sum(records[k][month] for k in list(GEO)[1:5])
        if abs(residual) > 12.5:
            raise ValueError("National components exceed rounding tolerance")
        residuals[month] = residual
    rows = []
    for code, name in GEO.items():
        first, last = records[code][MONTHS[0]], records[code][MONTHS[-1]]
        rows.append({"geography": name, "geography_code": code, "period": MONTHS[-1],
                     "claimants": last, "prior_year_period": MONTHS[0], "prior_year_claimants": first,
                     "change_persons": last - first,
                     "change_percent": money(Decimal(last - first) * 100 / first) if first else None})
    return {"status": "verified", "dataset": "NM_162_1", "source_url": NOMIS_URL,
            "publisher": "Office for National Statistics / Nomis", "licence": "Open Government Licence",
            "licence_url": "https://www.nomisweb.co.uk/home/copyright.asp",
            "measure": "Claimant count; not ILO unemployment", "population": "All sexes, age 16+, JSA and relevant UC claimant categories",
            "unit": "persons, rounded to nearest five", "adjustment": "not seasonally adjusted",
            "period_convention": "monthly reference-date stock", "revision_status": "latest month provisional; earlier values may be revised",
            "metadata_vintage": "2026-10-17; next release listed 2026-10-20",
            "rounding_residual_by_month": residuals, "rows": rows,
            "unsupported_question": "Do not use claimant counts as unemployment rates or numbers of available recruits"}


def read_aemo(text, region, day="2026-10-16"):
    reader = csv.DictReader(io.StringIO(text))
    if not {"REGION", "SETTLEMENTDATE", "RRP", "PERIODTYPE"}.issubset(reader.fieldnames or []):
        raise ValueError("Not an AEMO price CSV")
    if region not in ("SA1", "VIC1"):
        raise ValueError("Region outside the demonstrated selection")
    start = datetime.fromisoformat(day).replace(tzinfo=MARKET_TZ)
    end = start + timedelta(days=1)
    slots = {}
    for row in reader:
        stamp = datetime.strptime(row["SETTLEMENTDATE"], "%Y/%m/%d %H:%M:%S").replace(tzinfo=MARKET_TZ)
        if not start < stamp <= end:
            continue
        if row["REGION"] != region or row["PERIODTYPE"] != "TRADE":
            raise ValueError("Wrong region or non-trade period")
        if stamp in slots:
            raise ValueError("Duplicate price interval")
        slots[stamp] = decimal(row["RRP"])
    expected = {start + timedelta(minutes=5 * i) for i in range(1, 289)}
    if set(slots) != expected:
        raise ValueError("Incomplete or non-five-minute day")
    values = list(slots.values())
    return {"status": "verified", "region": region, "source_url": AEMO_URL.format(region),
            "publisher": "Australian Energy Market Operator", "licence": "AEMO copyright permissions; attribution required",
            "licence_url": "https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions",
            "calendar_day": day, "timezone": "fixed AEST / UTC+10; not local daylight-saving time",
            "period_start_utc": start.astimezone(timezone.utc).isoformat(), "period_end_utc": end.astimezone(timezone.utc).isoformat(),
            "interval_ending": True, "intervals": len(values), "unit": "AUD/MWh", "adjustment": "nominal wholesale prices",
            "negative_intervals": sum(v < 0 for v in values), "zero_intervals": sum(v == 0 for v in values),
            "negative_minutes": sum(v < 0 for v in values) * 5,
            "minimum": str(min(values)), "maximum": str(max(values)), "time_weighted_mean": money(sum(values) / len(values)),
            "revision_status": "mutable publisher file; finality not established",
            "unsupported_question": "This dated day does not answer the last 24 hours ending now, a future price, or a household bill"}


def read_boc(payload):
    selected = {"FXUSDCAD": "Canadian dollars per US dollar", "FXGBPCAD": "Canadian dollars per UK pound sterling"}
    for key, unit in selected.items():
        if payload.get("seriesDetail", {}).get(key, {}).get("metadata", {}).get("unit") != unit:
            raise ValueError("Wrong FX series definition or quote direction")
    rows = {}
    for observation in payload.get("observations", []):
        date = observation.get("d")
        if not isinstance(date, str) or not "2026-10-12" <= date <= "2026-10-16" or date in rows:
            raise ValueError("Unexpected or duplicate FX date")
        values = {key: decimal(observation.get(key, {}).get("v")) for key in selected}
        if any(value <= 0 for value in values.values()):
            raise ValueError("Non-positive FX rate")
        rows[date] = {key: str(value) for key, value in values.items()}
    if set(rows) != {"2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"}:
        raise ValueError("Missing expected business-day observations")
    return {"status": "verified", "source_url": BOC_URL, "publisher": "Bank of Canada",
            "licence_url": "https://www.bankofcanada.ca/terms/", "licence": "Bank of Canada terms; attribution and accuracy required",
            "free_source_notice": "Original data available free of charge from the Bank of Canada",
            "quote": "CAD per one unit of foreign currency", "frequency": "business daily; normally by 16:30 ET",
            "measure": "indicative daily average; not executable trade quote", "revision_status": "no immutable vintage guarantee established",
            "observations": rows, "transformation": "Exact-date multiplication; monetary answers rounded to cents",
            "example_usd1000_2026_10_16_cad": convert(rows, "2026-10-16", "FXUSDCAD", "1000"),
            "example_gbp2500_2026_10_16_cad": convert(rows, "2026-10-16", "FXGBPCAD", "2500"),
            "holiday_2026_10_12": convert(rows, "2026-10-12", "FXUSDCAD", "1000")}


def convert(rows, date, series, amount):
    if date not in rows:
        return {"status": "not_published_on_date", "cad": None, "date": date}
    if series not in rows[date]:
        raise ValueError("Currency not available")
    return {"status": "reference_calculation", "date": date, "cad": money(decimal(amount) * decimal(rows[date][series]))}


def run(live=False):
    def get(name, url):
        return fetch(url) if live else (SPEC / name).read_text(encoding="utf-8-sig")
    tasks = {
        "uk_five_desks": lambda: read_nomis(get("nomis.csv", NOMIS_URL)),
        "australia_sa": lambda: read_aemo(get("aemo-sa.csv", AEMO_URL.format("SA1")), "SA1"),
        "australia_vic": lambda: read_aemo(get("aemo-vic.csv", AEMO_URL.format("VIC1")), "VIC1"),
        "canada": lambda: read_boc(json.loads(get("boc.json", BOC_URL))),
    }
    results = {}
    for task, read in tasks.items():
        try:
            results[task] = read()
        except Exception as exc:
            results[task] = {"status": "failed", "error_type": type(exc).__name__}
    return {"mode": "live dated selections" if live else "offline dated specimens",
            "question_origin": "Constructed tests grounded in cited public workflows; not usage telemetry",
            "results": results, "new_zealand": "Reuse ../rent-demand-2026-10-17/demo.py and its evidence"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    output = run(args.live)
    print(json.dumps(output, indent=2))
    raise SystemExit(1 if any(r["status"] == "failed" for r in output["results"].values()) else 0)
