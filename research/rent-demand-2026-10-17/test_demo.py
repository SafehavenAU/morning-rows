"""Constructed research checks; no claim of an observed user or agent benchmark."""
import copy
import json
import re
import unittest

from demo import ROOT, compare, decode_response, demonstrate, number, parse_table, retrieve


class RentEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.fragment = (ROOT / "specimens/avondale.html").read_text()

    def test_selected_figures_and_questions(self):
        records = retrieve()
        # Expected cells transcribed separately from the official presentations.
        for record, expected in zip(records, [(93, 470, 550, 600), (43, 496, 550, 620)]):
            row = record["bedrooms"]["2"]
            self.assertEqual(tuple(row[key]["value"] for key in ("active_bonds", "lower_quartile", "median", "upper_quartile")), expected)
            self.assertEqual(record["period"]["start"], "2026-03-01")
            self.assertEqual(record["period"]["end"], "2026-08-31")
        answers = demonstrate(records)["answers"]
        self.assertEqual(answers["compare_two_bed_apartment_medians"]["status"], "equal_medians")
        self.assertEqual(answers["budget_600_nzd_per_week"]["Avondale"]["position"], "at upper quartile")
        self.assertEqual(answers["budget_600_nzd_per_week"]["Kelburn"]["position"], "between median and upper quartile")
        self.assertEqual(answers["today_advertised_rent"]["status"], "unsupported")
        self.assertEqual(answers["avondale_four_bed_apartment"]["status"], "not_reported")

    def test_separate_official_page_presentation(self):
        # Different extraction method; same publisher lineage, not an independent survey.
        page = (ROOT / "specimens/avondale-official-page.html").read_text()
        row = re.search(r"<tr>\s*<td>2 bedrooms</td>(.*?)</tr>", page, re.S).group(1)
        self.assertEqual(re.findall(r"<td>(.*?)</td>", row), ["93", "$470", "$550", "$600"])
        self.assertIn("01 Mar 2026 - 31 Aug 2026", page)

    def test_wrong_geography(self):
        with self.assertRaisesRegex(ValueError, "geography"):
            parse_table(self.fragment, "Wellington", "Avondale")

    def test_incomplete_period(self):
        with self.assertRaisesRegex(ValueError, "window"):
            parse_table(self.fragment.replace("31 Aug", "30 Aug"), "Auckland", "Avondale")

    def test_different_periods_cannot_be_compared(self):
        a, b = retrieve()
        b = copy.deepcopy(b)
        b["period"]["start"] = "2026-02-01"
        with self.assertRaisesRegex(ValueError, "period"):
            compare(a, b)

    def test_column_reordering(self):
        with self.assertRaisesRegex(ValueError, "table"):
            parse_table(self.fragment.replace("Lower Quartile", "Upper Quartile", 1), "Auckland", "Avondale")

    def test_plausible_but_wrong_quartiles(self):
        with self.assertRaisesRegex(ValueError, "Quartiles"):
            parse_table(self.fragment.replace("$600", "$500"), "Auckland", "Avondale")

    def test_duplicate_bedroom_row(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            parse_table(self.fragment.replace("3 bedrooms", "2 bedrooms"), "Auckland", "Avondale")

    def test_outage_html(self):
        with self.assertRaisesRegex(ValueError, "heading"):
            parse_table("<html>Service unavailable</html>", "Auckland", "Avondale")

    def test_response_payload_instead_of_mime_assumption(self):
        self.assertEqual(decode_response(200, json.dumps({"Table": self.fragment}).encode()), self.fragment)
        for status, body in [(200, b"<html>Outage</html>"), (429, b'{}'), (200, b'{"error":"Invalid request"}'), (200, b'{"Table":null}')]:
            with self.assertRaises(ValueError):
                decode_response(status, body)

    def test_missing_suppressed_and_zero_remain_distinct(self):
        # Marker mutations are synthetic robustness tests, not observed publisher cells.
        for marker, status in [("", "missing"), ("—", "missing"), ("N/A", "unavailable"), ("Suppressed", "suppressed")]:
            row = parse_table(self.fragment.replace("$550", marker), "Auckland", "Avondale")["bedrooms"]["2"]
            self.assertEqual(row["median"]["status"], status)
            self.assertIsNone(row["median"]["value"])
        self.assertEqual(number("$0", currency=True), {"value": 0, "status": "observed"})
        with self.assertRaises(ValueError):
            number("..", currency=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
