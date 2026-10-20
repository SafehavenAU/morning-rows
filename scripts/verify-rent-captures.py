#!/usr/bin/env python3
"""Offline verification of actual market-rent captures against independent data.

python scripts/verify-rent-captures.py CAPTURE_DIR REFERENCE_JSON OUTPUT_JSON \
  --expected-revision SHA --expected-version UUID --domains apex|both

Requires jsonschema. Does not import the runtime reader, make network requests,
replace missing captures or overwrite output. The captured schema is checked
offline, and all expected requests are derived independently of report.pass.
"""

import argparse
from collections import Counter
import copy
from datetime import date, datetime
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, quote, urlsplit

from jsonschema import Draft202012Validator, FormatChecker

APEX = "https://morningrows.com"
WWW = "https://www.morningrows.com"
SOURCE = "/new-zealand.json?source=market_rent"
FIELDS = ["lower_quartile", "median", "upper_quartile", "active_bonds"]
DWELLINGS = ["apartment", "boarding-house", "flat", "house", "room"]
BEDROOMS = ["1", "2", "3", "4", "5-plus"]
EMPTY_HASH = sha256(b"").hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(value):
    return sha256(value).hexdigest()


def valid_date_time(value):
    """Timezone-required ISO/RFC3339 subset used by captured acquisition clocks."""
    if not isinstance(value, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)", value
    ):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("t", "T").replace("z", "Z").replace("Z", "+00:00"))
        return parsed.tzinfo is not None
    except ValueError:
        return False


def valid_uri(value):
    """Absolute ASCII URI syntax without optional jsonschema dependencies."""
    if not isinstance(value, str) or not value.isascii() or not re.fullmatch(r"[A-Za-z][A-Za-z0-9+.-]*:\S+", value):
        return False
    if re.search(r'[\x00-\x20\x7f-\uffff<>"{}|\\^`]', value) or re.search(r"%(?![0-9A-Fa-f]{2})", value):
        return False
    try:
        parsed = urlsplit(value)
        if parsed.scheme.lower() in ("http", "https") and not parsed.netloc:
            return False
        if parsed.netloc:
            if not parsed.hostname:
                return False
            parsed.port  # Validate malformed and out-of-range port numbers.
        return True
    except ValueError:
        return False


def capture_format_checker():
    # jsonschema silently ignores formats whose optional packages are absent.
    # Register the formats used by this evidence contract explicitly.
    checker = FormatChecker()

    @checker.checks("date-time")
    def date_time(value):
        return not isinstance(value, str) or valid_date_time(value)

    @checker.checks("uri")
    def uri(value):
        return not isinstance(value, str) or valid_uri(value)

    @checker.checks("date")
    def calendar_date(value):
        if not isinstance(value, str):
            return True
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return False
        try:
            return date.fromisoformat(value).isoformat() == value
        except ValueError:
            return False

    return checker


def reject_remote_refs(node):
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ("$ref", "$dynamicRef"):
                require(isinstance(value, str) and value.startswith("#"),
                        "External schema references are forbidden offline")
            reject_remote_refs(value)
    elif isinstance(node, list):
        for value in node:
            reject_remote_refs(value)


def canonical(path):
    return APEX + path


def expected_routes(localities, period):
    # A list preserves the intentional repeated example GET.
    routes = [(path, "GET", False, 200, None) for path in [
        "/health.json", "/schema.json", "/new-zealand.json",
        "/catalog.json?desk=new-zealand", SOURCE,
    ]]
    for place in localities:
        for field in FIELDS:
            path = SOURCE + "&measure=" + place + ".apartment.2." + field
            routes.append((path, "GET", False, 200, None))
            routes.append((path + "&observation=" + quote(period, safe=""),
                           "GET", False, 200, None))
    routes.append((SOURCE + "&measure=nz-wellington-kelburn.house.5-plus.median",
                   "GET", False, 200, None))
    example = SOURCE + "&measure=nz-auckland-avondale.apartment.2.median"
    routes.extend([(example, "GET", False, 200, None),
                   (example, "GET", True, 304, None),
                   (example, "HEAD", False, 200, None)])
    routes.extend((path, "GET", False, status, error) for path, status, error in [
        (SOURCE + "&measure=nz-auckland-avondale.apartment.4.median", 404, "not_reported"),
        (SOURCE + "&measure=nz-christchurch-avondale.apartment.2.median", 404, "unknown_measure"),
        (example + "&observation=1900-01-01%2F1900-06-30", 404, "observation_not_retained"),
        (example + "&geography=Christchurch", 400, "unsupported_query"),
        (example + "&date=2026-08", 400, "unsupported_query"),
        (SOURCE + "&source=prices", 400, "unsupported_query"),
    ])
    return routes


def verify(directory, reference_file, revision, version, domains):
    checks, schema_checks, schema_negatives = [], [], []
    comparisons, selected_comparisons, transport = [], [], []
    inputs, body_cache = [], {}
    report = {
        "pass": False,
        "method": "Offline original-capture status/identity/hash binding and schema validation; numeric reconciliation to separately extracted official AJAX/full-page reference, no runtime reader imported",
        "expected_revision": revision, "expected_version": version, "domains": domains,
        "format_validation": "Explicit dependency-free URI/date/date-time checks; acquisition timestamps require a timezone, valid calendar date and seconds 00-59.",
        "inputs": inputs, "checks": checks, "transport": transport,
        "schema_checks": schema_checks, "schema_negative_controls": schema_negatives,
        "native_comparisons": comparisons, "selected_comparisons": selected_comparisons,
        "limitations": [
            "Checks the consistency of supplied retained evidence; it does not independently authenticate a supplied capture.",
            "Both publisher presentations share MBIE rental-bond statistical lineage.",
            "No network request, new release, CPU measurement or scheduled observation is performed.",
        ],
    }

    def read(path):
        data = path.read_bytes()
        inputs.append({"file": str(path), "bytes": len(data), "sha256": digest(data)})
        return json.loads(data)

    def checked(label, fn):
        try:
            fn()
            checks.append({"label": label, "pass": True})
        except Exception as error:
            checks.append({"label": label, "pass": False, "error": str(error)})

    try:
        require(re.fullmatch(r"[a-f0-9]{40}", revision), "Invalid expected source revision")
        require(re.fullmatch(r"[a-f0-9-]{36}", version), "Invalid expected Worker version")
        reference = read(reference_file)
        report["reference_sha256"] = inputs[-1]["sha256"]
        require(reference.get("pass") is True and reference.get("comparison", {}).get("numeric_cells") == 116,
                "Independent reference did not pass all 116 cells")
        places = {place["id"]: place for place in reference["localities"]}
        require(list(places) == ["nz-auckland-avondale", "nz-wellington-kelburn"],
                "Wrong independent locality coverage")
        windows = {place["period"]["start"] + "/" + place["period"]["end"] for place in places.values()}
        require(len(windows) == 1, "Independent locality windows differ")
        window = next(iter(windows))
        report["verified_period"] = window
        rows = {}
        for place in places.values():
            for row in place["rows"]:
                key = (place["id"], row["dwelling_key"], row["bedrooms"])
                require(key not in rows, "Duplicate independent tuple")
                require(all(type(row.get(field)) is int and row[field] >= 0 for field in FIELDS),
                        "Invalid independent numeric cell")
                rows[key] = (place, row)
        require(len(rows) == 29, "Independent reference must contain 29 tuples")
        routes = expected_routes(places, window)
        rules = {(path, method, conditional): (status, error)
                 for path, method, conditional, status, error in routes}
        origins = [APEX] if domains == "apex" else [APEX, WWW]
        capture = read(directory / "rent-interface-report.json")
        require(capture.get("revision") == revision and capture.get("version") == version,
                "Capture report identity differs from required identity")
        require(capture.get("pass") is True, "Original capture runner failed")
        requests = capture.get("requests")
        require(isinstance(requests, list), "Missing capture requests")
        expected = Counter((origin, path, method, conditional)
                           for origin in origins for path, method, conditional, _, _ in routes)
        actual = Counter((r.get("origin"), r.get("path"), r.get("method"), r.get("conditional"))
                         for r in requests)
        require(actual == expected, "Incomplete, duplicate or unknown request coverage")
        require(all(type(r.get("conditional")) is bool for r in requests),
                "Conditional request flag must be explicit")
        report["expected_requests"] = sum(expected.values())
        bound_files, latest_get = set(), {}
        for index, record in enumerate(requests):
            label = f'{record["origin"]} {record["method"]} {record["path"]}'
            status, error = rules[(record["path"], record["method"], record["conditional"])]
            item = {"request": index + 1, "origin": record["origin"], "path": record["path"],
                    "method": record["method"], "conditional": record["conditional"]}
            try:
                require(record.get("status") == status and record.get("expected_status") == status,
                        "HTTP status or claimed expectation differs from independently derived route")
                headers = record.get("headers", {})
                require(headers.get("x-source-revision") == revision and headers.get("x-worker-version") == version,
                        "Response identity mismatch")
                if record["conditional"] or record["method"] == "HEAD":
                    require(record.get("bytes") == 0 and record.get("sha256") == EMPTY_HASH and not record.get("file"),
                            "HEAD/304 response has content, hash drift or unexpected body file")
                    prior = latest_get.get((record["origin"], record["path"]))
                    require(prior and prior["status"] == 200 and prior["headers"].get("etag")
                            and headers.get("etag") == prior["headers"]["etag"],
                            "HEAD/304 ETag differs from preceding successful GET")
                else:
                    name = record.get("file", "")
                    require(re.fullmatch(r"\d{3,}\.body", name) and name not in bound_files,
                            "Missing, reused or unsafe body filename")
                    bound_files.add(name)
                    data = (directory / name).read_bytes()
                    require(record.get("bytes") == len(data) and record.get("sha256") == digest(data),
                            "Recorded body hash/length differs from retained bytes")
                    inputs.append({"file": str(directory / name), "bytes": len(data), "sha256": digest(data)})
                    document = json.loads(data)
                    body_cache[index] = document
                    latest_get[(record["origin"], record["path"])] = record
                    if status == 200 and record["path"].startswith(SOURCE):
                        ttl = re.search(r"(?:^|[, ])max-age=(\d+)", headers.get("cache-control", ""))
                        require(ttl and int(ttl[1]) <= 120, "Selected response lacks bounded cache")
                    if error:
                        require(document.get("error") == error or document.get("reason") == error,
                                "Negative response lacks expected explicit refusal")
                        require(document.get("data") is None and not document.get("observations"),
                                "Negative response substitutes data or observations")
                item["pass"] = True
            except Exception as problem:
                item.update(pass_=False, error=str(problem))
                item["pass"] = item.pop("pass_")
            transport.append(item)
        require(all(item["pass"] for item in transport), "One or more capture transport bindings failed")

        def bodies(origin, path):
            return [(i, body_cache[i]) for i, r in enumerate(requests)
                    if r["origin"] == origin and r["path"] == path and i in body_cache]

        def one(origin, path):
            found = bodies(origin, path)
            require(len(found) == 1, "Expected one body for " + path)
            return found[0][1]

        def row_key(row):
            return row.get("location_id"), row.get("dwelling_key"), row.get("bedroom_key")

        def validate_dimensions(row, expected_key):
            require(expected_key in rows, "Unsupported or absent independently verified tuple")
            place, ref = rows[expected_key]
            require(row_key(row) == expected_key, "Wrong native tuple")
            for key, expected_value in {
                "geography": place["publisher_label"], "city": place["city"], "suburb": place["suburb"],
                "dwelling_type": ref["dwelling_type"], "bedrooms": ref["bedroom_label"],
                "period": window, "period_start": place["period"]["start"], "period_end": place["period"]["end"],
                "source_url": place["source_url"],
            }.items():
                require(row.get(key) == expected_value, "Wrong native " + key)

        def validate_metadata(native):
            require(isinstance(native, dict) and native.get("status") == "ok", "Native source not healthy")
            require(native.get("publisher") == "Ministry of Business, Innovation and Employment / Tenancy Services"
                    and native.get("licence") == "Creative Commons Attribution 3.0 New Zealand"
                    and native.get("licence_url") == reference["licence_url"], "Publisher attribution or licence differs")
            require(all(native.get(key) is None for key in
                        ["published_at", "publisher_updated_at", "next_expected_update"]),
                    "Invented native publication timestamp")
            definition = native.get("definition", {})
            require(definition.get("rent_unit") == "NZD per week" and definition.get("count_unit") == "bonds"
                    and definition.get("adjustment") == "unadjusted descriptive statistics",
                    "Native rent/count units or adjustment differ")
            require(definition.get("methodology_url") == reference["methodology_url"]
                    and "Non-government" in definition.get("population", "")
                    and "six-month" in definition.get("period_convention", "")
                    and "Current bonds" in definition.get("active_bonds", "")
                    and "not" in definition.get("active_bonds", "")
                    and "provisional" in native.get("limitations", "").lower(),
                    "Missing population, period, count or provisional qualification")
            metadata = native.get("metadata", {})
            require(metadata == {
                "count": 29, "location_count": 2, "successful_location_count": 2,
                "period_start": window.split("/")[0], "period_end": window.split("/")[1],
                "window_consistent": True, "publication_time": None, "revision_id": None,
            }, "Native metadata differs from independently verified window/coverage")
            require(len(native.get("locations", [])) == 2, "Native locality coverage differs")
            require({x.get("id") for x in native["locations"]} == set(places), "Wrong or duplicate locality IDs")
            require(all(x.get("status") == "ok" for x in native["locations"]), "Native locality failed")
            for location in native["locations"]:
                place = places[location["id"]]
                require(location.get("period_start") == place["period"]["start"]
                        and location.get("period_end") == place["period"]["end"]
                        and location.get("row_count") == len(place["rows"]), "Locality window/coverage differs")
                expected_counts = {dwelling: sum(row["dwelling_key"] == dwelling for row in place["rows"])
                                   for dwelling in DWELLINGS}
                require(location.get("table_counts") == expected_counts, "Locality table counts differ")
            provenance = native.get("provenance", [])
            require(len(provenance) == 2 and {item.get("location_id") for item in provenance} == set(places),
                    "Missing or duplicate original acquisition provenance")
            for item in provenance:
                require(item.get("url") == places[item["location_id"]]["source_url"]
                        and re.fullmatch(r"[a-f0-9]{64}", item.get("sha256", ""))
                        and type(item.get("bytes")) is int and 0 < item["bytes"] <= 131072
                        and valid_date_time(item.get("retrieved_at"))
                        and valid_uri(item.get("url")),
                        "Invalid original acquisition provenance")

        def validate_native(native):
            validate_metadata(native)
            require(len(native.get("rows", [])) == 29, "Native reported row coverage differs from evidence")
            require({row_key(row) for row in native["rows"]} == set(rows), "Missing, duplicate or substituted tuple")
            for row in native["rows"]:
                key = row_key(row)
                validate_dimensions(row, key)
                require(all(type(row.get(field)) is int and row[field] == rows[key][1][field] for field in FIELDS),
                        "Native value differs from independently verified presentation")

        def parse_measure(measure):
            parts = measure.split(".")
            require(len(parts) == 4 and parts[0] in places and parts[1] in DWELLINGS
                    and parts[2] in BEDROOMS and parts[3] in FIELDS, "Unknown measure dimensions")
            return tuple(parts[:3]), parts[3]

        def validate_observation(observation, measure):
            key, field = parse_measure(measure)
            place, row = rows[key]
            definition = observation.get("definition", {})
            require(definition.get("id") == measure, "Observation measure definition identity differs")
            require(observation.get("value") == row[field] and type(observation.get("value")) is int
                    and observation.get("value_state") == "observed", "Observation numeric value/state differs")
            require(observation.get("period") == window, "Observation release period differs")
            expected_unit = "bonds" if field == "active_bonds" else "NZD per week"
            require(definition.get("unit") == expected_unit, "Observation unit mixes count and rent")
            require(definition.get("geography") == place["publisher_label"], "Observation geography differs")
            require(definition.get("dimensions") == {
                "location": key[0], "dwelling": key[1], "bedrooms": key[2], "statistic": field,
            }, "Observation definition dimensions differ")
            require(definition.get("kind") == "observation" and definition.get("cadence") == "monthly"
                    and definition.get("adjustment") == "unadjusted descriptive statistics"
                    and "Non-government" in definition.get("population", "")
                    and "six-month" in definition.get("period_convention", "")
                    and definition.get("licence_url") == reference["licence_url"],
                    "Observation population/cadence/definition differs")
            require(observation.get("source_url") == place["source_url"], "Observation source URL differs")
            expected_path = SOURCE + "&measure=" + measure
            require(observation.get("measure") == canonical(expected_path)
                    and observation.get("id") == canonical(expected_path + "&observation=" + quote(window, safe="")),
                    "Observation canonical identity differs")
            require(isinstance(observation.get("version"), str) and observation["version"], "Missing observation version")
            require(observation.get("published_at") is None and observation.get("publisher_updated_at") is None
                    and observation.get("next_expected_update") is None, "Invented publication timestamp")
            require(observation.get("publisher_status", {}).get("revision_status") == "provisional",
                    "Missing provisional status")
            qualifications = observation.get("qualifications", {})
            validate_dimensions(qualifications, key)
            require(qualifications.get(field) == row[field] or
                    (qualifications.get("statistic") == field and qualifications.get("value") == row[field]),
                    "Observation qualifications differ from original row")

        def validate_selected(document, path):
            require(document.get("retrieval", {}).get("status") == "ok", "Selected retrieval is not healthy")
            require(valid_date_time(document.get("retrieval", {}).get("retrieved_at")),
                    "Selected retrieval timestamp is missing, invalid or unzoned")
            require(document.get("id") == canonical(path), "Selected canonical identity differs")
            validate_metadata(document.get("context"))
            query = parse_qs(urlsplit(path).query)
            measure = query.get("measure", [None])[0]
            expected_measures = ([measure] if measure else
                                 [".".join(key) + "." + field for key in rows for field in FIELDS])
            observations = document.get("observations", [])
            require(len(observations) == len(expected_measures), "Selected observation coverage differs")
            actual_measures = [observation.get("definition", {}).get("id") for observation in observations]
            require(Counter(actual_measures) == Counter(expected_measures), "Selected duplicate or missing measure")
            for observation in observations:
                validate_observation(observation, observation["definition"]["id"])
            if not measure:
                validate_native({**document["context"], "rows": document.get("data")})
            else:
                key, field = parse_measure(measure)
                data = document.get("data", {})
                validate_dimensions(data, key)
                require(data.get("statistic") == field and data.get("value") == rows[key][1][field]
                        and data.get("unit") == ("bonds" if field == "active_bonds" else "NZD per week")
                        and data.get("value_state") == "observed", "Selected native cell differs")

        fingerprints = set()
        for origin in origins:
            health = one(origin, "/health.json")
            require(health.get("source_dirty") is False and health.get("source_revision") == revision
                    and health.get("worker_version") == version, "Health identity is dirty or differs")
            require(re.fullmatch(r"[a-f0-9]{16}", health.get("build_fingerprint", "")), "Invalid build fingerprint")
            fingerprints.add(health["build_fingerprint"])
            schema = one(origin, "/schema.json")
            require(schema.get("$id") == APEX + "/schema.json"
                    and schema.get("$schema") == "https://json-schema.org/draft/2020-12/schema",
                    "Wrong captured schema dialect or identity")
            reject_remote_refs(schema)
            Draft202012Validator.check_schema(schema)
            validator = Draft202012Validator(schema, format_checker=capture_format_checker())
            full = one(origin, "/new-zealand.json")
            checked(origin + " native semantic contract", lambda: (
                require(full.get("country") == "New Zealand"
                        and full.get("sources", {}).get("market_rent", {}).get("status") == "ok",
                        "Wrong desk or unhealthy source"),
                validate_native(full.get("market_rent")),
            ))
            for row in full.get("market_rent", {}).get("rows", []):
                key = row_key(row)
                for field in FIELDS:
                    expected_value = rows.get(key, (None, {}))[1].get(field)
                    comparisons.append({"origin": origin, "tuple": list(key), "field": field,
                                        "expected": expected_value, "actual": row.get(field),
                                        "pass": key in rows and type(row.get(field)) is int and row[field] == expected_value})
            catalogue = one(origin, "/catalog.json?desk=new-zealand")
            cards = [card for card in catalogue.get("sources", []) if card.get("key") == "market_rent"]
            require(len(cards) == 1, "Missing or duplicate market-rent discovery card")
            measures = cards[0].get("measures", [])
            expected_ids = {".".join([place, dwelling, bedroom, field])
                            for place in places for dwelling in DWELLINGS for bedroom in BEDROOMS for field in FIELDS}
            require(len(measures) == 200 and {m.get("id") for m in measures} == expected_ids,
                    "Discovery does not describe exactly the bounded supported selectors")
            for index, document in sorted(body_cache.items()):
                record = requests[index]
                if record["origin"] != origin or record["status"] != 200:
                    continue
                path = record["path"]
                if path in ("/health.json", "/schema.json"):
                    continue
                errors = [error.message for error in validator.iter_errors(document)]
                schema_checks.append({"origin": origin, "path": path, "file": record["file"],
                                      "pass": not errors, "errors": errors[:5]})
                if path.startswith(SOURCE):
                    before = len(checks)
                    checked(origin + " selected semantic " + record["file"], lambda d=document, p=path: validate_selected(d, p))
                    selected_comparisons.append({"origin": origin, "path": path, "file": record["file"],
                                                 "observations": len(document.get("observations", [])),
                                                 "pass": checks[before]["pass"]})
            # Constructed malformed versions of captured actual data, not a
            # replacement for the real successful originals above.
            selected = one(origin, SOURCE)
            mutations = [
                ("native_wrong_geography", full, lambda d: d["market_rent"]["rows"][0].update(geography="Christchurch - Avondale")),
                ("native_unknown_dwelling", full, lambda d: d["market_rent"]["rows"][0].update(dwelling_key="office")),
                ("native_unknown_bedroom", full, lambda d: d["market_rent"]["rows"][0].update(bedroom_key="6")),
                ("native_negative_count", full, lambda d: d["market_rent"]["rows"][0].update(active_bonds=-1)),
                ("native_fractional_count", full, lambda d: d["market_rent"]["rows"][0].update(active_bonds=1.5)),
                ("native_missing_metric", full, lambda d: d["market_rent"]["rows"][0].pop("median")),
                ("native_unknown_location", full, lambda d: d["market_rent"]["rows"][0].update(location_id="nz-christchurch-avondale")),
                ("native_invalid_period", full, lambda d: d["market_rent"]["rows"][0].update(period="2026-08")),
                ("native_non_numeric_rent", full, lambda d: d["market_rent"]["rows"][0].update(median="550")),
                ("native_null_count", full, lambda d: d["market_rent"]["rows"][0].update(active_bonds=None)),
                ("observation_missing_period", selected, lambda d: d["observations"][0].pop("period")),
                ("observation_invalid_period", selected, lambda d: d["observations"][0].update(period="2026-08")),
                ("observation_null_value", selected, lambda d: d["observations"][0].update(value=None)),
                ("observation_suppressed_invented", selected, lambda d: d["observations"][0].update(value_state="suppressed")),
                ("observation_negative_value", selected, lambda d: d["observations"][0].update(value=-1)),
                ("observation_wrong_unit", selected, lambda d: d["observations"][0]["definition"].update(unit="NZD/month")),
                ("observation_wrong_geography", selected, lambda d: d["observations"][0]["definition"].update(geography="Christchurch - Avondale")),
                ("observation_unknown_id", selected, lambda d: d["observations"][0]["definition"].update(id="unknown")),
                ("observation_missing_definition", selected, lambda d: d["observations"][0].pop("definition")),
                ("observation_non_numeric_value", selected, lambda d: d["observations"][0].update(value="470")),
                ("native_provenance_invalid_datetime", full, lambda d: d["market_rent"]["provenance"][0].update(retrieved_at="unknown")),
                ("native_provenance_unzoned_datetime", full, lambda d: d["market_rent"]["provenance"][0].update(retrieved_at="2026-10-20T07:05:00")),
                ("observation_relative_uri", selected, lambda d: d["observations"][0].update(id="/new-zealand.json")),
                ("selected_id_malformed_uri", selected, lambda d: d.update(id="https://morningrows.com/%ZZ")),
            ]
            for name, original, change in mutations:
                mutated = copy.deepcopy(original)
                change(mutated)
                schema_negatives.append({"origin": origin, "case": name,
                                         "pass": not validator.is_valid(mutated)})
        require(len(fingerprints) == 1, "Different build fingerprints across domains")
        report["build_fingerprint"] = next(iter(fingerprints))
        require(len(comparisons) == 116 * len(origins), "Incomplete native numerical comparison")
        require(len(schema_checks) == 21 * len(origins), "Incomplete schema response coverage")
        require(len(selected_comparisons) == 19 * len(origins), "Incomplete selected response coverage")
        report["counts"] = {
            "requests": len(requests), "native_numeric_cells": len(comparisons),
            "native_tuples": 29 * len(origins), "selected_responses": len(selected_comparisons),
            "selected_observation_cells": sum(x["observations"] for x in selected_comparisons),
            "schema_documents": len(schema_checks), "schema_negative_controls": len(schema_negatives),
            "negative_responses": 6 * len(origins), "bodyless_responses": 2 * len(origins),
        }
        report["pass"] = all(check["pass"] for check in
                             checks + transport + comparisons + selected_comparisons + schema_checks + schema_negatives)
    except Exception as error:
        report["error"] = str(error)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture_directory", type=Path)
    parser.add_argument("reference", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--expected-revision", required=True)
    parser.add_argument("--expected-version", required=True)
    parser.add_argument("--domains", choices=["apex", "both"], required=True)
    args = parser.parse_args()
    require(not args.output.exists(), "Output already exists; preserve evidence and choose a new output")
    report = verify(args.capture_directory, args.reference, args.expected_revision, args.expected_version, args.domains)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as stream:
        json.dump(report, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    print(json.dumps({"pass": report["pass"], "error": report.get("error"), **report.get("counts", {}),
                      "output": str(args.output)}))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
