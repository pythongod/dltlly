import json
import csv
import copy
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ops.ingestion.config import literal_settings
from ops.ingestion.storage import atomic_write, exclusive_lock
from ops.ingestion.run import run, main
from ops.ingestion.records import COLUMN_ORDER
from ops.ingestion.storage import csv_text


class MemorySheet:
    def __init__(self, rows=()):
        self.headers = COLUMN_ORDER + ['hidden', 'Location', 'Stadt', 'Processed']
        self.values = [self.headers] + [[str(row.get(key, '')) for key in self.headers] for row in rows]
        self.fail_append = False

    def get_all_values(self):
        return copy.deepcopy(self.values)

    def batch_update(self, updates, value_input_option):
        for update in updates:
            match = re.fullmatch(r'([A-Z]+)(\d+)', update['range'])
            column = 0
            for letter in match[1]:
                column = column * 26 + ord(letter) - 64
            self.values[int(match[2])-1][column-1] = str(update['values'][0][0])

    def append_rows(self, rows, value_input_option):
        self.values.extend([[str(value) for value in row] for row in rows])
        if self.fail_append:
            raise ConnectionError('append completed but acknowledgement lost')


class IngestionRunTests(unittest.TestCase):
    def test_direct_cli_cannot_overlap_locked_git_job(self):
        with tempfile.TemporaryDirectory() as directory:
            with exclusive_lock(Path(directory) / 'job.lock'), \
                 patch('sys.argv', ['ingestion', '--state', directory]), \
                 patch('ops.ingestion.run.clients', side_effect=RuntimeError('must not connect')) as connect:
                self.assertEqual(main(), 1)
                connect.assert_not_called()

    def test_settings_never_execute_legacy_source(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'legacy.py'
            path.write_text("raise RuntimeError('must not execute')\napi_key = 'private'\n")
            self.assertEqual(literal_settings(path, {'api_key'}), {'api_key': 'private'})

    def test_atomic_write_failure_preserves_previous_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'data.csv'
            path.write_text('old')
            with patch('os.replace', side_effect=OSError('disk error')):
                with self.assertRaises(OSError):
                    atomic_write(path, 'new')
            self.assertEqual(path.read_text(), 'old')

    def test_lock_excludes_second_worker(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'lock'
            with exclusive_lock(path):
                with self.assertRaises(RuntimeError):
                    with exclusive_lock(path):
                        self.fail('overlapping worker entered')

    def test_second_sheet_failure_does_not_publish_or_advance_checkpoint(self):
        class Sheet:
            def get_all_values(self):
                return [['ID', 'Views']]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            original = 'Name #1,Name #2,Event,Type,Year,Channel,Uploaded,URL,ID,Views\n'
            (root / 'data/battle_events.csv').write_text(original)
            state = root / 'state'
            with patch('ops.ingestion.run.discover_video_ids', return_value=[]), \
                 patch('ops.ingestion.run.fetch_video_details', return_value=[]), \
                 patch('ops.ingestion.run.sync_sheet', side_effect=[{}, RuntimeError('sheet unavailable')]):
                with self.assertRaises(RuntimeError):
                    run(root, state, None, [Sheet(), Sheet()], apply=True)
            self.assertEqual((root / 'data/battle_events.csv').read_text(), original)
            self.assertFalse((state / 'last-success.json').exists())
            self.assertFalse((root / 'info.yml').exists())
            self.assertTrue((state / 'pending.json').exists())

    def test_historical_retry_preserves_baseline_curated_fields_and_final_exports(self):
        baseline = dict(zip(COLUMN_ORDER, ['Alice', 'Bob', 'Old event', 'Accapella', '2020',
            'DLTLLY', '2020-01-01', 'https://www.youtube.com/watch?v=abcdefghijk', 'abcdefghijk', '1', 'battle']))
        sheet_row = dict(baseline, Event='Curated event', hidden='Old event',
                         Location='Curated venue', Stadt='Berlin', Processed='sent')
        records = [dict(id='abcdefghijk', title='Alice vs Bob | New event',
                        published_at='2020-01-01T00:00:00Z', channel_title='DLTLLY',
                        duration_seconds=600, views=99),
                   dict(id='newvideo001', title='Carol vs Dave | New event',
                        published_at='2020-01-02T00:00:00Z', channel_title='DLTLLY',
                        duration_seconds=600, views=123)]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            atomic_write(root / 'data/battle_events.csv', csv_text([COLUMN_ORDER] + [[baseline[k] for k in COLUMN_ORDER]]))
            sheets = [MemorySheet([sheet_row]), MemorySheet([sheet_row])]
            sheets[1].fail_append = True
            with patch('ops.ingestion.run.discover_video_ids', return_value=['newvideo001']), \
                 patch('ops.ingestion.run.fetch_video_details', return_value=records):
                with self.assertRaises(ConnectionError):
                    run(root, root / 'state', None, sheets, apply=True, historical=True)
                pending = json.loads((root / 'state/pending.json').read_text())
                self.assertEqual(pending['previous'][0]['Views'], '1')
                self.assertFalse((root / 'state/last-success.json').exists())
                sheets[1].fail_append = False
                summary = run(root, root / 'state', None, sheets, apply=True)
            self.assertTrue(summary['historical'])
            self.assertFalse((root / 'state/pending.json').exists())
            self.assertTrue((root / 'state/last-success.json').exists())
            for sheet, export in zip(sheets, ['gsheet_battle_events', 'gsheet_battle_events_v2']):
                saved = [dict(zip(sheet.headers, row)) for row in sheet.values[1:]]
                self.assertEqual(len(saved), 2)
                self.assertEqual(saved[0]['hidden'], 'New event')
                self.assertEqual(saved[0]['Views'], '99')
                self.assertEqual(saved[0]['Event'], 'Curated event')
                self.assertEqual(saved[0]['Location'], 'Curated venue')
                self.assertEqual(saved[0]['Processed'], 'sent')
                self.assertEqual(saved[1]['Processed'], 'skipped historical backfill')
                payload = (root / 'data' / (export + '.csv')).read_text()
                expected = [sheet.values[0]] + sorted(sheet.values[1:], key=lambda row: row[sheet.values[0].index('Uploaded')], reverse=True)
                self.assertEqual(list(csv.reader(payload.splitlines())), expected)
                histories = list((root / 'data/gsheet').glob(export + '_2*.csv'))
                self.assertEqual(len(histories), 1)
                self.assertEqual(histories[0].read_text(), payload)
            primary = (root / 'data/battle_events.csv').read_text()
            self.assertEqual(next((root / 'data/history').glob('*.csv')).read_text(), primary)

    def test_detail_failure_does_not_write_pending_or_publish(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = csv_text([COLUMN_ORDER])
            atomic_write(root / 'data/battle_events.csv', original)
            with patch('ops.ingestion.run.discover_video_ids', return_value=[]), \
                 patch('ops.ingestion.run.fetch_video_details', side_effect=ConnectionError('API failed')):
                with self.assertRaises(ConnectionError):
                    run(root, root / 'state', None, [MemorySheet(), MemorySheet()], apply=True)
            self.assertFalse((root / 'state/pending.json').exists())
            self.assertFalse((root / 'state/last-success.json').exists())
            self.assertEqual((root / 'data/battle_events.csv').read_text(), original)


if __name__ == '__main__':
    unittest.main()
