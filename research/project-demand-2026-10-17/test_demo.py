"""Constructed failure tests and original-publisher comparisons; no usage claims."""
import copy
import csv
from decimal import Decimal
from html import unescape
import io
import json
import re
import unittest
from unittest.mock import patch

import demo


class ResearchChecks(unittest.TestCase):
    def setUp(self):
        self.nomis = (demo.SPEC / "nomis.csv").read_text()
        self.aemo = (demo.SPEC / "aemo-sa.csv").read_text()
        self.boc = json.loads((demo.SPEC / "boc.json").read_text())

    def mutate_nomis(self, mutate):
        reader = csv.DictReader(io.StringIO(self.nomis))
        rows = list(reader)
        mutate(rows)
        out = io.StringIO()
        writer = csv.DictWriter(out, reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        return out.getvalue()

    def test_nomis_all_five_nations_and_cities(self):
        result = demo.read_nomis(self.nomis)
        values = {r["geography"]: r["claimants"] for r in result["rows"]}
        self.assertEqual(values, {"United Kingdom": 1698450, "England": 1486460, "Wales": 65615,
                                 "Scotland": 112215, "Northern Ireland": 34155, "Birmingham": 77930,
                                 "Cardiff": 10115, "Glasgow City": 22530, "Belfast": 8980})
        birmingham = next(r for r in result["rows"] if r["geography"] == "Birmingham")
        self.assertEqual(birmingham["change_persons"], 760)
        self.assertEqual(result["rounding_residual_by_month"]["2026-08"], 5)

    def test_nisra_separate_presentation(self):
        cells = json.loads((demo.SPEC / "nisra-selected-cells.json").read_text())["selected_cells"]["LGD_11"]
        self.assertEqual((cells["A11"], cells["D11"]), ("Belfast", "8980"))
        self.assertEqual((cells["A19"], cells["D19"]), ("Northern Ireland", "34155"))
        rows = {r["geography"]: r["claimants"] for r in demo.read_nomis(self.nomis)["rows"]}
        self.assertEqual(rows["Belfast"], int(cells["D11"]))
        self.assertEqual(rows["Northern Ireland"], int(cells["D19"]))

    def test_nomis_wrong_dataset_or_dimensions(self):
        for column, value in [("URN", "Nm-1d1"), ("AGE", "2"), ("MEASURE", "2"), ("GENDER", "1"), ("GEOGRAPHY_NAME", "Great Britain")]:
            with self.subTest(column=column), self.assertRaises(ValueError):
                demo.read_nomis(self.mutate_nomis(lambda rows: rows[0].update({column: value})))

    def test_nomis_missing_suppressed_flags_are_not_zero(self):
        for column, value in [("OBS_VALUE", ""), ("OBS_VALUE", "NaN"), ("OBS_CONF", "C"), ("OBS_STATUS", "M")]:
            with self.subTest(column=column), self.assertRaises(ValueError):
                demo.read_nomis(self.mutate_nomis(lambda rows: rows[0].update({column: value})))

    def test_nomis_duplicate_or_incomplete_coverage(self):
        for change in [lambda rows: rows.pop(), lambda rows: rows.append(rows[0])]:
            with self.assertRaises(ValueError):
                demo.read_nomis(self.mutate_nomis(change))

    def test_nomis_rounding_does_not_hide_large_total_error(self):
        def change(rows):
            rows[0]["OBS_VALUE"] = str(int(rows[0]["OBS_VALUE"]) + 20)
        with self.assertRaisesRegex(ValueError, "rounding tolerance"):
            demo.read_nomis(self.mutate_nomis(change))

    def test_aemo_negative_zero_and_complete_day(self):
        result = demo.read_aemo(self.aemo, "SA1")
        self.assertEqual((result["intervals"], result["negative_intervals"], result["zero_intervals"]), (288, 68, 2))
        self.assertEqual(result["time_weighted_mean"], "57.83")
        self.assertEqual(result["negative_minutes"], 340)
        self.assertEqual(result["period_start_utc"], "2026-10-15T14:00:00+00:00")

    def test_aemo_separate_dispatch_comparison(self):
        comparison = json.loads((demo.SPEC / "aemo-dispatch-selected.json").read_text())
        for code, file in [("SA1", "aemo-sa.csv"), ("VIC1", "aemo-vic.csv")]:
            rows = {r["SETTLEMENTDATE"]: Decimal(r["RRP"]) for r in csv.DictReader(io.StringIO((demo.SPEC / file).read_text()))}
            for observation in (r for r in comparison if r["REGIONID"] == code):
                self.assertLessEqual(abs(rows[observation["SETTLEMENTDATE"]] - Decimal(observation["RRP"])), Decimal("0.005"))
                self.assertEqual(observation["PRICE_STATUS"], "FIRM")

    def test_aemo_partial_duplicate_and_forecast_windows(self):
        lines = self.aemo.splitlines()
        for text in ["\n".join(lines[:-1]), self.aemo + lines[-1] + "\n", self.aemo.replace("TRADE", "FORECAST", 1), self.aemo.replace("SA1", "NSW1", 1)]:
            with self.assertRaises(ValueError):
                demo.read_aemo(text, "SA1")

    def test_aemo_invalid_number_not_coerced(self):
        rows = list(csv.DictReader(io.StringIO(self.aemo)))
        original = rows[0]["RRP"]
        for bad in ["", "NaN", "Infinity", "Suppressed"]:
            with self.assertRaises(ValueError):
                demo.read_aemo(self.aemo.replace("," + original + ",", "," + bad + ",", 1), "SA1")

    def test_boc_exact_date_conversion_and_holiday(self):
        result = demo.read_boc(self.boc)
        self.assertEqual(result["example_usd1000_2026_10_16_cad"]["cad"], "1415.40")
        self.assertEqual(result["example_gbp2500_2026_10_16_cad"]["cad"], "4717.75")
        self.assertEqual(result["holiday_2026_10_12"]["status"], "not_published_on_date")
        self.assertIsNone(result["holiday_2026_10_12"]["cad"])

    def test_boc_original_csv_and_official_page(self):
        rows = demo.read_boc(self.boc)["observations"]
        raw = (demo.SPEC / "boc.csv").read_text(encoding="utf-8-sig").split('"OBSERVATIONS"', 1)[1].strip()
        for row in csv.DictReader(io.StringIO(raw)):
            for key in ("FXUSDCAD", "FXGBPCAD"):
                self.assertEqual(row[key], rows[row["date"]][key])
        page = (demo.SPEC / "boc-official-table.html").read_text()
        tables = []
        for tr in re.findall(r"<tr\b[^>]*>.*?</tr>", page, re.S):
            cells = re.findall(r"<t[hd]\b[^>]*>(.*?)</t[hd]>", tr, re.S)
            tables.append([unescape(re.sub("<[^>]+>", "", cell)).strip().replace("‑", "-") for cell in cells])
        dates = tables[0][1:]
        self.assertEqual(dates, ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"])
        for table_row in tables[1:]:
            key = {"US dollar": "FXUSDCAD", "UK pound sterling": "FXGBPCAD"}[table_row[0]]
            self.assertEqual(table_row[1], "Bank holiday")
            for date, value in zip(dates[1:], table_row[2:]):
                self.assertEqual(value, rows[date][key])

    def test_boc_inverse_definition_missing_values_and_dates(self):
        bad = copy.deepcopy(self.boc)
        bad["seriesDetail"]["FXUSDCAD"]["metadata"]["unit"] = "US dollars per Canadian dollar"
        with self.assertRaises(ValueError):
            demo.read_boc(bad)
        for value in ["", "0", "NaN", None]:
            bad = copy.deepcopy(self.boc)
            bad["observations"][0]["FXUSDCAD"]["v"] = value
            with self.assertRaises(ValueError):
                demo.read_boc(bad)
        bad = copy.deepcopy(self.boc)
        bad["observations"].pop()
        with self.assertRaises(ValueError):
            demo.read_boc(bad)

    def test_failure_isolation(self):
        def mocked_fetch(url):
            if "nomis" in url:
                raise ValueError("Outage")
            if "bankofcanada" in url:
                return json.dumps(self.boc)
            return (demo.SPEC / ("aemo-sa.csv" if "SA1" in url else "aemo-vic.csv")).read_text()
        with patch.object(demo, "fetch", mocked_fetch):
            results = demo.run(True)["results"]
        self.assertEqual(results["uk_five_desks"]["status"], "failed")
        self.assertTrue(all(results[k]["status"] == "verified" for k in ["australia_sa", "australia_vic", "canada"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
