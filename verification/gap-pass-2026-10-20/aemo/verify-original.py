#!/usr/bin/env python3
"""Independent stdlib CSV/Decimal evidence; no runtime imports or network.

Verify retained evidence:
  python verify-original.py ORIGINAL_DIR REPORT.json
Extract the pinned raw acquisitions, then verify:
  python verify-original.py --extract RAW_DIR BUNDLE_DIR
RAW_DIR must contain capture.json and the exact raw files it identifies.
"""
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, localcontext, ROUND_HALF_UP
from pathlib import Path

DAY = date(2026, 10, 19)
REGIONS = ("SA1", "VIC1")
AEST = timezone(timedelta(hours=10))
MONTH_FIELDS = ["REGION", "SETTLEMENTDATE", "TOTALDEMAND", "RRP", "PERIODTYPE"]
DAILY_FIELDS = ["SOURCE_BUNDLE", "CSV_FORMAT_VERSION", "SETTLEMENTDATE", "RUNNO",
                "REGIONID", "INTERVENTION", "RRP", "APCFLAG",
                "MARKETSUSPENDEDFLAG", "VERSION2_RRP"]
STAMP = "%Y/%m/%d %H:%M:%S"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def stamp(value):
    parsed = datetime.strptime(value, STAMP)
    require(parsed.strftime(STAMP) == value, "Malformed publisher timestamp")
    return parsed


def money(value):
    require(isinstance(value, str) and
            re.fullmatch(r"-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?", value) is not None,
            "Missing, nonfinite or malformed RRP")
    result = Decimal(value)
    require(result.is_finite(), "Nonfinite RRP")
    return result


def boundaries():
    start = datetime.combine(DAY, datetime.min.time())
    return start, start + timedelta(days=1)


def expected_stamps():
    start, _ = boundaries()
    return [(start + timedelta(minutes=5 * n)).strftime(STAMP)
            for n in range(1, 289)]


def utc(value):
    return value.replace(tzinfo=AEST).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_csv(raw, expected_fields):
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig"), newline=""))
    require(reader.fieldnames == expected_fields, "Unexpected retained CSV columns")
    rows = list(reader)
    require(all(None not in row and None not in row.values() for row in rows),
            "Malformed CSV row")
    return rows


def dump(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def retain(path, raw):
    """Allow identical existing specimens, but never overwrite different bytes."""
    if path.exists():
        require(path.read_bytes() == raw, "Refusing to overwrite " + str(path))
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as handle:
            handle.write(raw)


def extract(raw_dir, bundle_dir):
    captured = json.loads((raw_dir / "capture.json").read_text())
    sources = {item["name"]: item for item in captured["sources"]}
    original = bundle_dir / "original"
    original.mkdir(parents=True, exist_ok=True)
    required = ["monthly-SA1", "monthly-VIC1", "september-SA1", "september-VIC1",
                "Public_Prices-18", "Public_Prices"]
    raw = {}
    for name in required:
        item = sources[name]
        require(item["http_status"] == 200 and item["curl_status"] == 0,
                "Required source acquisition failed: " + name)
        payload = (raw_dir / item["raw_file"]).read_bytes()
        require(len(payload) == item["wire_bytes"] and sha(payload) == item["wire_sha256"],
                "Original wire hash/length mismatch: " + name)
        raw[name] = payload
    selected_files = {}
    source_boundaries = []
    for region in REGIONS:
        name = "monthly-" + region
        lines = raw[name].splitlines(keepends=True)
        rows = parse_csv(raw[name], MONTH_FIELDS)
        require(all(row["REGION"] == region and row["PERIODTYPE"] == "TRADE" for row in rows),
                "Wrong monthly region or period type")
        source_boundaries.append({
            "source": name, "rows": len(rows),
            "first_settlementdate": rows[0]["SETTLEMENTDATE"],
            "last_settlementdate": rows[-1]["SETTLEMENTDATE"],
        })
        wanted = set(expected_stamps())
        selected = [line for line in lines[1:]
                    if next(csv.reader([line.decode("utf-8")]))[1] in wanted]
        require(len(selected) == 288, "Target calendar day is incomplete")
        filename = f"monthly-{region}-{DAY.isoformat()}.csv"
        payload = lines[0] + b"".join(selected)
        retain(original / filename, payload)
        selected_files[filename] = {
            "bytes": len(payload), "sha256": sha(payload), "source_names": [name],
            "transformation": "Unmodified original header and 288 complete original CSV lines; other calendar days omitted.",
        }
    # Explicitly retain the actual month boundary. A filename owns the month
    # containing interval starts, including next-month midnight as its last end.
    boundary = {"date_checked": DAY.isoformat(), "monthly_files": source_boundaries,
                "boundary_rows": [], "conclusion": "Observed September files include October 1 00:00; October files begin October 1 00:05."}
    for region in REGIONS:
        for name in ["september-" + region, "monthly-" + region]:
            rows = parse_csv(raw[name], MONTH_FIELDS)
            require(all(row["REGION"] == region and row["PERIODTYPE"] == "TRADE" for row in rows),
                    "Wrong boundary source dimensions")
            boundary["boundary_rows"].append({
                "source": name, "rows": len(rows), "first": rows[0], "last": rows[-1]})
    payload = dump(boundary)
    retain(original / "month-boundary.json", payload)
    selected_files["month-boundary.json"] = {
        "bytes": len(payload), "sha256": sha(payload),
        "source_names": ["september-SA1", "september-VIC1", "monthly-SA1", "monthly-VIC1"],
        "transformation": "Selected first/last aggregate rows and original row counts only.",
    }
    # Public_Prices contains DREGION format versions 2 and 3. These are two
    # layouts, not competing price vintages. Verify their selected RRP agrees.
    records = {}
    daily_members = []
    for name in ["Public_Prices-18", "Public_Prices"]:
        with zipfile.ZipFile(io.BytesIO(raw[name])) as archive:
            require(len(archive.infolist()) == 1, "Unexpected daily ZIP members")
            member = archive.infolist()[0]
            require(member.filename.endswith(".CSV") and member.file_size < 3_000_000,
                    "Unexpected daily ZIP member or size")
            csv_bytes = archive.read(member)
            daily_members.append({"source": name, "member": member.filename,
                                  "bytes": len(csv_bytes), "sha256": sha(csv_bytes)})
            headers = {}
            for row in csv.reader(io.StringIO(csv_bytes.decode("utf-8-sig"), newline="")):
                if not row:
                    continue
                table = tuple(row[1:4])
                if row[0] == "I":
                    require(table not in headers, "Duplicate daily table header")
                    headers[table] = row[4:]
                elif row[0] == "D" and row[1] == "DREGION":
                    require(table in headers and row[2] == "" and row[3] in ("2", "3"),
                            "Unexpected DREGION format")
                    require(len(row[4:]) == len(headers[table]), "Malformed DREGION row")
                    obj = dict(zip(headers[table], row[4:]))
                    if obj["REGIONID"] not in REGIONS or obj["SETTLEMENTDATE"] not in expected_stamps():
                        continue
                    key = (obj["REGIONID"], obj["SETTLEMENTDATE"], row[3])
                    require(key not in records, "Duplicate selected DREGION observation")
                    records[key] = {"SOURCE_BUNDLE": name, "CSV_FORMAT_VERSION": row[3], **obj}
    projected = []
    for region in REGIONS:
        for end in expected_stamps():
            v2, v3 = records[(region, end, "2")], records[(region, end, "3")]
            require(v2["RRP"] == v3["RRP"], "DREGION versions disagree")
            projected.append({**{key: v3[key] for key in DAILY_FIELDS[:-1]},
                              "VERSION2_RRP": v2["RRP"]})
    require(len(projected) == 576, "Incomplete daily comparison")
    text = io.StringIO(newline="")
    writer = csv.DictWriter(text, fieldnames=DAILY_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(projected)
    payload = text.getvalue().encode()
    filename = "public-prices-DREGION-2026-10-19.csv"
    retain(original / filename, payload)
    selected_files[filename] = {
        "bytes": len(payload), "sha256": sha(payload),
        "source_names": ["Public_Prices-18", "Public_Prices"],
        "transformation": "CSV extraction of selected SA1/VIC1 target-day DREGION v3 columns, with exact v2 RRP retained for format agreement; other regions, days, demand and ancillary-service columns omitted.",
    }
    ledger = {
        "target_day": DAY.isoformat(), "market_clock": "fixed AEST, UTC+10",
        "sources": captured["sources"], "retained_files": selected_files,
        "daily_members": daily_members,
        "retention": "Only public regional aggregate prices, flags and minimal boundary evidence are retained. Full wire sources are hashed but kept outside the repository.",
    }
    retain(original / "acquisition.json", dump(ledger))
    return verify(original)


def verify(original):
    ledger = json.loads((original / "acquisition.json").read_text())
    require(ledger["target_day"] == DAY.isoformat(), "Wrong specimen day")
    for filename, item in ledger["retained_files"].items():
        payload = (original / filename).read_bytes()
        require(len(payload) == item["bytes"] and sha(payload) == item["sha256"],
                "Retained specimen integrity failed: " + filename)
    sources = {item["name"]: item for item in ledger["sources"]}
    for region in REGIONS:
        retrieved = datetime.fromisoformat(sources["monthly-" + region]["retrieved_at"])
        require(retrieved.tzinfo is not None and
                retrieved.astimezone(AEST).date() - timedelta(days=1) == DAY,
                "Specimen was not the latest completed fixed-AEST day at acquisition")
    boundary = json.loads((original / "month-boundary.json").read_text())
    for region in REGIONS:
        previous = next(x for x in boundary["boundary_rows"] if x["source"] == "september-" + region)
        current = next(x for x in boundary["boundary_rows"] if x["source"] == "monthly-" + region)
        require(previous["rows"] == 8640 and previous["first"]["SETTLEMENTDATE"] == "2026/09/01 00:05:00" and
                previous["last"]["SETTLEMENTDATE"] == "2026/10/01 00:00:00" and
                current["first"]["SETTLEMENTDATE"] == "2026/10/01 00:05:00",
                "Observed month ownership changed")
    daily = parse_csv((original / "public-prices-DREGION-2026-10-19.csv").read_bytes(), DAILY_FIELDS)
    require(len(daily) == 576, "Expected 576 separate daily price records")
    indexed = {}
    for row in daily:
        key = (row["REGIONID"], row["SETTLEMENTDATE"])
        require(key not in indexed and row["REGIONID"] in REGIONS, "Duplicate/wrong daily region")
        require(row["CSV_FORMAT_VERSION"] == "3" and row["RUNNO"] == "1" and
                row["INTERVENTION"] == "0", "Wrong daily market pricing run")
        require(row["APCFLAG"] == "0" and row["MARKETSUSPENDEDFLAG"] == "0",
                "Pinned specimen has changed price/suspension flags")
        require(money(row["RRP"]) == money(row["VERSION2_RRP"]), "Format v2/v3 mismatch")
        indexed[key] = row
    normalized, summaries = [], []
    for region in REGIONS:
        rows = parse_csv((original / f"monthly-{region}-{DAY.isoformat()}.csv").read_bytes(), MONTH_FIELDS)
        require(len(rows) == 288 and [row["SETTLEMENTDATE"] for row in rows] == expected_stamps(),
                "Duplicate, missing, shifted or out-of-order calendar intervals")
        values, differences = [], []
        for row in rows:
            require(row["REGION"] == region and row["PERIODTYPE"] == "TRADE",
                    "Wrong monthly dimensions or forecast contamination")
            price = money(row["RRP"])
            require(price.as_tuple().exponent >= -2, "Monthly price exceeds observed cents precision")
            comparison = indexed[(region, row["SETTLEMENTDATE"])]
            original_price = money(comparison["RRP"])
            difference = abs(price - original_price)
            require(difference <= Decimal("0.005"), "Monthly/daily price mismatch")
            end = stamp(row["SETTLEMENTDATE"])
            normalized.append({
                "region": region, "periodtype": "TRADE", "settlementdate_raw": row["SETTLEMENTDATE"],
                "interval_start": (end - timedelta(minutes=5)).replace(tzinfo=AEST).isoformat(),
                "interval_end": end.replace(tzinfo=AEST).isoformat(),
                "interval_start_utc": utc(end - timedelta(minutes=5)), "interval_end_utc": utc(end),
                "rrp_decimal": row["RRP"], "comparison_rrp_decimal": comparison["RRP"],
                "absolute_difference_decimal": str(difference),
            })
            values.append(price)
            differences.append(difference)
        with localcontext() as context:
            context.prec = 50
            mean = sum(values) / Decimal(288)
            summary = {
                "region": region, "date": DAY.isoformat(), "interval_count": 288,
                "negative_interval_count": sum(x < 0 for x in values),
                "zero_interval_count": sum(x == 0 for x in values),
                "positive_interval_count": sum(x > 0 for x in values),
                "sum_decimal": str(sum(values)), "mean_decimal": str(mean),
                "mean_rounded_2dp": str(mean.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "minimum_decimal": str(min(values)), "maximum_decimal": str(max(values)),
                "comparison_count": len(differences), "maximum_abs_difference_decimal": str(max(differences)),
                "monthly_decimal_places": sorted(set(-x.as_tuple().exponent for x in values)),
                "rounded_zero_but_negative_daily_count": sum(
                    money(row["RRP"]) == 0 and money(indexed[(region, row["SETTLEMENTDATE"])]["RRP"]) < 0
                    for row in rows),
            }
            summaries.append(summary)
    require([s["negative_interval_count"] for s in summaries] == [189, 206] and
            [s["mean_rounded_2dp"] for s in summaries] == ["6.73", "-7.80"],
            "Pinned specimen summary changed")
    start, end = boundaries()
    return {
        "kind": "Independent original AEMO CSV/Decimal reconciliation; not runtime or operational acceptance",
        "pass": True, "verified_at": datetime.now(timezone.utc).isoformat(),
        "target_day": DAY.isoformat(), "regions": list(REGIONS),
        "market_clock": "fixed AEST, UTC+10; no local daylight-saving conversion",
        "interval_minutes": 5, "interval_ending_convention": True,
        "calendar_start": start.replace(tzinfo=AEST).isoformat(),
        "calendar_end_exclusive": end.replace(tzinfo=AEST).isoformat(),
        "unit": "AUD/MWh", "monthly_prices_are_published_rounded_values": True,
        "comparison_dataset": "AEMO NEMweb PUBLIC_PRICES, DREGION format 3",
        "comparison_rows": 576, "comparison_tolerance_aud_per_mwh": "0.005",
        "daily_format_2_3_rrp_agreement_count": 576,
        "daily_runno": "1", "daily_intervention": "0",
        "daily_apcflag_counts": dict(Counter(row["APCFLAG"] for row in daily)),
        "daily_marketsuspendedflag_counts": dict(Counter(row["MARKETSUSPENDEDFLAG"] for row in daily)),
        "price_status": "not supplied by monthly CSV or selected DREGION fields; no FIRM or finality claim",
        "monthly_file_month_ownership": "Observed September complete month includes next-month midnight; October begins 00:05.",
        "summaries": summaries, "observations": normalized,
        "independence_limit": "Separately published monthly CSV and daily regional-price CSV, separately selected with Python csv and Decimal; both share AEMO market-calculation lineage. This does not independently recompute market clearing.",
        "limitations": [
            "Completed fixed-AEST calendar day, not a NEM trading day, moving last 24 hours, forecast or live dispatch.",
            "Negative counts concern published rounded monthly RRP values, excluding explicit zeros.",
            "Monthly refresh/correction SLA and finality are unestablished; preserve source hashes and no older-day substitution.",
            "Two selected NEM regions are not an Australian average, household tariff or household saving.",
        ],
    }


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--extract":
        bundle = Path(sys.argv[3])
        result = extract(Path(sys.argv[2]), bundle)
        target = bundle / "independent-report.json"
    elif len(sys.argv) == 3:
        result = verify(Path(sys.argv[1]))
        target = Path(sys.argv[2])
    else:
        raise SystemExit("verify-original.py ORIGINAL_DIR REPORT.json | --extract RAW_DIR BUNDLE_DIR")
    with target.open("x") as output:
        json.dump(result, output, indent=2, ensure_ascii=False)
        output.write("\n")
    print(json.dumps({"pass": result["pass"], "comparison_rows": result["comparison_rows"],
                      "summaries": result["summaries"], "output": str(target)}))
