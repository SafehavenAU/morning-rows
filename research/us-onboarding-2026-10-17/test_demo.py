"""Constructed semantic failure cases, grounded in the cited public workflows/issues."""
import copy
import json
import unittest
from pathlib import Path

from demo import (ROOT, ContractError, decode_value, read_bulk, represent, load,
                  select, ratio, reconcile, changes)


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.directory = ROOT / 'specimens'
        self.raw = [(self.directory / n).read_text() for n in ['bls-flat', 'bls-series', 'bls-footnote']]
        self.rep, self.annual = load()

    def test_original_presentations_reconcile(self):
        self.assertEqual(reconcile(self.rep, self.directory)['api_slots_equal'], 13)

    def test_window_includes_real_unavailable_month(self):
        self.assertEqual(len(self.rep['observations']), 13)
        cell = select(self.rep, '2025-10')
        self.assertEqual(cell['value_state'], 'unavailable')
        self.assertIsNone(cell['value'])
        self.assertEqual(cell['footnotes'][0]['code'], 'X')

    def test_actual_annual_row_excluded(self):
        self.assertEqual(self.annual, ['2025'])
        self.assertEqual(self.rep['observations'][-1]['period'], '2026-09')

    def test_missing_base_cannot_produce_adjustment(self):
        with self.assertRaisesRegex(ContractError, 'non_numeric'):
            ratio(self.rep, '2025-10', '2026-09')

    def test_zero_retained_as_observed_but_invalid_index(self):
        self.assertEqual(decode_value('0', []), (0, 'observed'))
        with self.assertRaisesRegex(ContractError, 'nonpositive'):
            read_bulk(self.raw[0].replace('324.800', '0'), *self.raw[1:])

    def test_unknown_missing_marker_and_empty_value_fail(self):
        for marker in ['', 'NaN', 'Infinity', '.', 'N/A', '1e3']:
            with self.subTest(marker=marker), self.assertRaises(ContractError):
                read_bulk(self.raw[0].replace('324.800', marker), *self.raw[1:])

    def test_dash_is_not_automatically_suppression(self):
        self.assertEqual(decode_value('-', []), (None, 'missing'))
        changed = self.raw[0].replace('\tX', '\tS')
        with self.assertRaisesRegex(ContractError, 'unknown_footnote'):
            read_bulk(changed, *self.raw[1:])

    def test_numeric_value_with_unavailable_flag_fails(self):
        with self.assertRaisesRegex(ContractError, 'numeric_value_with_unavailable_flag'):
            decode_value('324.800', [{'code': 'X', 'text': 'Data unavailable due to the 2025 lapse in appropriations'}])

    def test_missing_or_duplicate_month_fails(self):
        line = next(x for x in self.raw[0].splitlines(keepends=True) if 'M09' in x and '2025' in x)
        for text in [self.raw[0].replace(line, ''), self.raw[0] + line]:
            with self.assertRaises(ContractError):
                read_bulk(text, *self.raw[1:])

    def test_wrong_series_or_adjustment_metadata_fails(self):
        for text in [self.raw[1].replace('CUUR0000SA0', 'CUSR0000SA0'), self.raw[1].replace('\tU\t', '\tS\t'), self.raw[1].replace('\t0000\t', '\tA101\t')]:
            with self.assertRaisesRegex(ContractError, 'incompatible_definition'):
                read_bulk(self.raw[0], text, self.raw[2])

    def test_mismatched_metadata_release_fails(self):
        with self.assertRaisesRegex(ContractError, 'metadata_release_mismatch'):
            read_bulk(*self.raw, latest='2026-10')

    def test_wrong_geography_units_adjustment_refused(self):
        for request in [{'geography': 'New York'}, {'geography': 'United Kingdom'}, {'geography': 'Puerto Rico'}, {'unit': 'USD'}, {'unit': 'percent'}, {'adjustment': 'seasonally adjusted'}]:
            with self.subTest(request=request), self.assertRaisesRegex(ContractError, 'unsupported_dimensions'):
                select(self.rep, '2026-09', **request)

    def test_daily_annual_future_and_expired_requests_refused(self):
        for period in ['2026-09-01', '2025-13', '2025', '2026-10', '2024-09']:
            with self.subTest(period=period), self.assertRaises(ContractError):
                select(self.rep, period)

    def test_unchanged_retrieval_is_not_revision(self):
        rows = read_bulk(*self.raw)[0]
        again = represent(rows, retrieved_at='2026-10-18T00:00:00Z')
        self.assertEqual(again['content_version'], self.rep['content_version'])
        self.assertEqual(changes(self.rep, again)['changed_periods'], [])

    def test_constructed_revision_keeps_id_changes_version(self):
        rows = read_bulk(*self.raw)[0]
        rows[-1].update(value=336.941, value_text='336.941')
        revised = represent(rows)
        self.assertEqual(select(revised, '2026-09')['id'], select(self.rep, '2026-09')['id'])
        self.assertEqual(changes(self.rep, revised)['changed_periods'], ['2026-09'])

    def test_constructed_footnote_revision_detected(self):
        rows = read_bulk(*self.raw)[0]
        rows[-1]['footnotes'] = [{'code': 'R', 'text': 'Revised'}]
        self.assertEqual(changes(self.rep, represent(rows))['changed_periods'], ['2026-09'])

    def test_constructed_new_period_distinguished(self):
        rows = read_bulk(*self.raw)[0]
        # Synthetic period/value solely for change classification; not publisher data.
        rows.append({**copy.deepcopy(rows[-1]), 'period': '2026-10'})
        new = represent(rows[1:])
        self.assertEqual(changes(self.rep, new)['new_periods'], ['2026-10'])
        self.assertEqual(changes(self.rep, new)['changed_periods'], [])

    def test_constructed_suppression_prevents_numeric_answer(self):
        rep = copy.deepcopy(self.rep)
        rep['observations'][-1].update(value=None, value_state='suppressed')
        with self.assertRaisesRegex(ContractError, 'non_numeric'):
            ratio(rep, '2025-09', '2026-09')

    def test_failure_and_recovery_not_unchanged(self):
        failed = represent([], health='error')
        self.assertNotEqual(failed['content_version'], self.rep['content_version'])
        self.assertEqual(changes(self.rep, failed)['retrieval'], 'failed')
        self.assertEqual(changes(failed, self.rep)['retrieval'], 'recovered')
        self.assertEqual(failed['observations'], [])
        with self.assertRaisesRegex(ContractError, 'retrieval_failed'):
            select(failed, '2026-09')

    def test_reversed_periods_and_real_no_change(self):
        with self.assertRaisesRegex(ContractError, 'reversed'):
            ratio(self.rep, '2026-09', '2025-09')
        self.assertEqual(ratio(self.rep, '2026-09', '2026-09')['percent_change'], '0')


if __name__ == '__main__':
    unittest.main(verbosity=2)
