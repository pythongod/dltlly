"""Offline regression tests for curation-aware Sheet reconciliation."""
import copy
import re
import unittest

from ops.ingestion.sheets import sync_sheet


OLD = ['Name #1', 'Name #2', 'Event', 'Type', 'Year', 'Channel',
       'Uploaded', 'URL', 'ID', 'Views', 'Location', 'Stadt', 'Event 2']
NEW = ['Name #1', 'Name #2', 'Event', 'Location', 'Stadt', 'Type',
       'Year', 'Channel', 'Uploaded', 'URL', 'Views', 'ID', 'hidden', 'Processed']


def record(**changes):
    return dict({'ID': 'abcdefghijk', 'Name #1': 'Alice', 'Name #2': 'Bob',
                 'Event': 'Imported event', 'Type': 'Accapella', 'Year': 2025,
                 'Channel': 'Channel', 'Uploaded': '2025-01-01',
                 'URL': 'https://www.youtube.com/watch?v=abcdefghijk', 'Views': 10},
                **changes)


class Worksheet:
    def __init__(self, headers=NEW, rows=()):
        self.values = [list(headers)] + [[str(r.get(h, '')) for h in headers] for r in rows]
        self.calls = []
        self.fail_append = False
        self.fail_update = False

    def get_all_values(self):
        return copy.deepcopy(self.values)

    def append_rows(self, rows, value_input_option):
        self.calls.append(('append', value_input_option))
        self.values.extend([[str(v) for v in r] for r in rows[:1 if self.fail_append else len(rows)]])
        if self.fail_append:
            raise ConnectionError('ack lost after first row')

    def batch_update(self, changes, value_input_option):
        self.calls.append(('update', value_input_option))
        if self.fail_update:
            raise ConnectionError('update failed')
        for change in changes:
            match = re.fullmatch(r'([A-Z]+)(\d+)', change['range'])
            column = 0
            for letter in match[1]:
                column = column * 26 + ord(letter) - 64
            self.values[int(match[2]) - 1][column - 1] = str(change['values'][0][0])

    def records(self):
        return [dict(zip(self.values[0], r)) for r in self.values[1:]]


class SheetTests(unittest.TestCase):
    def test_empty_batch_leaves_header_only_sheet_unchanged(self):
        sheet = Worksheet()
        result = sync_sheet(sheet, [], [])
        self.assertEqual(result['appended'], 0)
        self.assertEqual(sheet.calls, [])

    def test_reordered_headers_and_raw_formula_text(self):
        sheet = Worksheet(list(reversed(NEW)))
        row = record(**{'Name #1': '=1+1'})
        sync_sheet(sheet, [row], [], historical=True)
        saved = sheet.records()[0]
        self.assertEqual(saved['Name #1'], '=1+1')
        self.assertEqual(saved['hidden'], row['Event'])
        self.assertEqual([saved[x] for x in ('Event', 'Location', 'Stadt')], ['', '', ''])
        self.assertEqual(saved['Processed'], 'skipped historical backfill')
        self.assertEqual(sheet.calls, [('append', 'RAW')])

    def test_existing_metadata_updates_only_when_unchanged_or_empty(self):
        before = record()
        curated = record(**{'Name #1': 'Curator', 'Name #2': '', 'Views': 99,
                            'Event': 'Curated event', 'Location': 'Venue', 'Processed': 'sent'})
        sheet = Worksheet(NEW, [curated])
        after = record(**{'Name #1': 'New name', 'Name #2': 'New Bob', 'Year': 2026, 'Views': 100})
        result = sync_sheet(sheet, [after], [before], historical=True)
        saved = sheet.records()[0]
        self.assertEqual(saved['Name #1'], 'Curator')
        self.assertEqual(saved['Name #2'], 'New Bob')
        self.assertEqual(saved['Year'], '2026')
        self.assertEqual(saved['Views'], '100')
        self.assertEqual(saved['Event'], 'Curated event')
        self.assertEqual(saved['Location'], 'Venue')
        self.assertEqual(saved['Processed'], 'sent')
        self.assertTrue(any(c['field'] == 'Name #1' for c in result['conflicts']))
        self.assertTrue(all(option == 'RAW' for _, option in sheet.calls))

    def test_legacy_event_is_corrected_but_curated_event_is_preserved(self):
        before = record()
        after = record(Event='Corrected')
        sheet = Worksheet(OLD, [before])
        sync_sheet(sheet, [after], [before])
        self.assertEqual(sheet.records()[0]['Event'], 'Corrected')
        sheet = Worksheet(OLD, [record(Event='Curated')])
        result = sync_sheet(sheet, [after], [before])
        self.assertEqual(sheet.records()[0]['Event'], 'Curated')
        self.assertEqual(result['conflicts'][0]['field'], 'Event')

    def test_unknown_values_do_not_erase_known_values(self):
        sheet = Worksheet(OLD, [record()])
        sync_sheet(sheet, [record(Channel='Unknown', Views=None)], [record()])
        self.assertEqual(sheet.records()[0]['Channel'], 'Channel')
        self.assertEqual(sheet.records()[0]['Views'], '10')

    def test_legacy_nan_views_are_missing_in_incoming_and_baseline(self):
        sheet = Worksheet(OLD, [record()])
        sync_sheet(sheet, [record(Views='nan')], [record(Views='nan')])
        self.assertEqual(sheet.records()[0]['Views'], '10')
        self.assertEqual(sheet.calls, [])
        sync_sheet(sheet, [record(Views=11)], [record(Views='nan')])
        self.assertEqual(sheet.records()[0]['Views'], '11')

    def test_malformed_existing_id_aborts_before_writes(self):
        for video_id in ('short', 'abcdefghij!', 'abcdefghijkx'):
            sheet = Worksheet(OLD, [record(ID=video_id)])
            with self.subTest(video_id=video_id), self.assertRaises(ValueError):
                sync_sheet(sheet, [record()], [])
            self.assertEqual(sheet.calls, [])

    def test_rerun_is_idempotent(self):
        sheet = Worksheet()
        sync_sheet(sheet, [record()], [])
        sheet.calls.clear()
        result = sync_sheet(sheet, [record()], [])
        self.assertEqual(len(sheet.records()), 1)
        self.assertEqual(result['appended'], 0)
        self.assertEqual(sheet.calls, [])

    def test_partial_append_failure_is_reconciled_on_next_call_without_retry(self):
        sheet = Worksheet()
        rows = [record(), record(ID='lmnopqrstuv')]
        sheet.fail_append = True
        with self.assertRaises(ConnectionError):
            sync_sheet(sheet, rows, [], historical=True)
        self.assertEqual(len(sheet.calls), 1)
        sheet.fail_append = False
        sync_sheet(sheet, rows, [], historical=True)
        self.assertEqual({r['ID'] for r in sheet.records()}, {r['ID'] for r in rows})
        self.assertEqual(len(sheet.records()), 2)

    def test_invalid_sheet_structure_rejected_before_any_write(self):
        sheets = [Worksheet(NEW + ['ID']), Worksheet([h for h in NEW if h != 'ID']),
                  Worksheet(NEW, [record(), record()]), Worksheet(['ID']), Worksheet()]
        sheets[-1].values.append(['orphan without ID'])
        for sheet in sheets:
            with self.subTest(values=sheet.values), self.assertRaises(ValueError):
                sync_sheet(sheet, [record()], [])
            self.assertEqual(sheet.calls, [])

    def test_invalid_incoming_rows_rejected_before_any_write(self):
        for rows in ([record(), record()], [record(ID='')], [record(Views=-1)],
                     [record(Channel=['unexpected nested value'])]):
            sheet = Worksheet()
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                sync_sheet(sheet, rows, [])
            self.assertEqual(sheet.calls, [])

    def test_zero_views_is_known_and_written_as_number(self):
        sheet = Worksheet(OLD, [record()])
        updates = []
        apply_update = sheet.batch_update
        def capture(changes, value_input_option):
            updates.extend(changes)
            apply_update(changes, value_input_option)
        sheet.batch_update = capture
        sync_sheet(sheet, [record(Views='0')], [record()])
        self.assertEqual(sheet.records()[0]['Views'], '0')
        self.assertIsInstance(updates[0]['values'][0][0], int)

    def test_sheet_changed_since_planning_aborts_before_write(self):
        sheet = Worksheet(OLD, [record()])
        reads = 0
        def changing_read():
            nonlocal reads
            reads += 1
            result = copy.deepcopy(sheet.values)
            if reads > 1:
                result[1][0] = 'Changed by curator'
            return result
        sheet.get_all_values = changing_read
        with self.assertRaises(RuntimeError):
            sync_sheet(sheet, [record(Views=11)], [record()])
        self.assertEqual(sheet.calls, [])

    def test_dry_run_reports_without_writes(self):
        sheet = Worksheet()
        result = sync_sheet(sheet, [record()], [], dry_run=True)
        self.assertEqual(result['appended'], 1)
        self.assertEqual(sheet.calls, [])

    def test_failed_update_propagates(self):
        sheet = Worksheet(OLD, [record()])
        sheet.fail_update = True
        with self.assertRaises(ConnectionError):
            sync_sheet(sheet, [record(Views=11)], [record()])


if __name__ == '__main__':
    unittest.main()
