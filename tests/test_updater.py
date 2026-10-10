"""Run on the LXC as jack: python3 tests/test_updater.py.

Only function definitions are loaded. Network clients and filesystem writes
are replaced at their boundaries; importing the scheduled scripts would run jobs.
"""
import ast
import copy
import logging
import os
from pathlib import Path
import types
import unittest

try:
    import pandas as pd
    from gspread.utils import a1_to_rowcol, rowcol_to_a1
except ImportError:
    pd = None


SOURCE = Path(os.environ.get('BATTLEDB_UPDATER_DIR', '/home/jack/dltlly/getdata'))


def load_functions(filename, **overrides):
    tree = ast.parse((SOURCE / filename).read_text())
    definitions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    env = {'pd': pd, 'logger': logging.getLogger('updater-tests'),
           'gspread': types.SimpleNamespace(utils=types.SimpleNamespace(rowcol_to_a1=rowcol_to_a1)),
           'SHEET_NAME': 'battle_events'}
    env.update(overrides)
    exec(compile(ast.Module(body=definitions, type_ignores=[]), filename, 'exec'), env)
    return env


class Worksheet:
    def __init__(self, rows, fail_write=False):
        self.rows = copy.deepcopy(rows)
        self.fail_write = fail_write
        self.appended = []

    def get_all_values(self):
        # Model Sheets' default formatted-value read: formula source is lost.
        return [[('42' if str(value).startswith('=') else value) for value in row]
                for row in self.rows]

    def get_all_records(self):
        return [dict(zip(self.rows[0], row)) for row in self.rows[1:]]

    def clear(self):
        self.rows = []

    def update(self, values):
        if self.fail_write:
            raise RuntimeError('simulated Sheets write failure')
        self.rows = copy.deepcopy(values)

    def batch_update(self, data, value_input_option='RAW'):
        if self.fail_write:
            raise RuntimeError('simulated Sheets write failure')
        if value_input_option != 'RAW':
            raise AssertionError('View updates must not evaluate formulas')
        for entry in data:
            row, col = a1_to_rowcol(entry['range'].split(':')[0])
            for offset, values in enumerate(entry['values']):
                for cell_offset, value in enumerate(values):
                    self.rows[row - 1 + offset][col - 1 + cell_offset] = value

    def append_rows(self, rows, **kwargs):
        self.appended.extend(copy.deepcopy(rows))

    def sort(self, *args):
        pass


def client_for(sheet):
    return types.SimpleNamespace(open_by_url=lambda _: types.SimpleNamespace(worksheet=lambda _: sheet))


@unittest.skipUnless(pd is not None and (SOURCE / 'updateviewcount_v3.py').exists(), 'Legacy LXC regression tests require the preserved scripts and pandas/gspread')
class ViewUpdateTests(unittest.TestCase):
    def run_update(self, sheet, details):
        functions = load_functions('updateviewcount_v3.py')
        functions['update_single_sheet'](client_for(sheet), 'unused', details)

    def test_failed_write_preserves_existing_worksheet(self):
        sheet = Worksheet([['ID', 'Views', 'Notes'], ['abc', '7', '=6*7']], fail_write=True)
        original = copy.deepcopy(sheet.rows)
        with self.assertRaisesRegex(RuntimeError, 'simulated Sheets write failure'):
            self.run_update(sheet, {'abc': {'view_count': '8'}})
        self.assertEqual(sheet.rows, original)

    def test_only_matching_views_change_and_formulas_survive(self):
        sheet = Worksheet([['Notes', 'Views', 'ID'], ['=6*7', '7', 'abc'], ['keep', '9', 'other']])
        self.run_update(sheet, {'abc': {'view_count': '8'}})
        self.assertEqual(sheet.rows, [['Notes', 'Views', 'ID'], ['=6*7', '8', 'abc'], ['keep', '9', 'other']])

    def test_no_matching_ids_does_not_write(self):
        sheet = Worksheet([['ID', 'Views'], ['abc', '7']], fail_write=True)
        self.run_update(sheet, {'unrelated': {'view_count': '8'}})
        self.assertEqual(sheet.rows[1], ['abc', '7'])

    def test_missing_header_fails_without_erasing_data(self):
        sheet = Worksheet([['Notes'], ['keep']])
        original = copy.deepcopy(sheet.rows)
        with self.assertRaises(ValueError):
            self.run_update(sheet, {'abc': {'view_count': '8'}})
        self.assertEqual(sheet.rows, original)


@unittest.skipUnless(pd is not None and (SOURCE / 'cleanup-v4.py').exists(), 'Legacy LXC regression tests require the preserved scripts and pandas/gspread')
class CleanupTests(unittest.TestCase):
    def test_cleanup_exception_reaches_caller(self):
        def fail(_):
            raise ValueError('injected read failure')
        functions = load_functions('cleanup-v4.py', OUTPUT_FILE_PATH='unused')
        functions['load_existing_data'] = fail
        with self.assertRaisesRegex(ValueError, 'injected read failure'):
            functions['main']()

    def test_missing_views_append_as_blank_in_both_formats(self):
        cases = [('Unknown', ''), ('N/A', ''), (None, ''), (float('nan'), ''), ('0', 0), ('123', 123)]
        for function, view_index in [('update_google_sheets', 9), ('update_google_sheets_new', 10)]:
            for value, expected in cases:
                with self.subTest(function=function, value=value):
                    sheet = Worksheet([['ID', 'Views']])
                    env = load_functions('cleanup-v4.py',
                        SERVICE_ACCOUNT_FILE='unused', GOOGLE_SHEET_URL='unused', GOOGLE_SHEET_URL_NEW='unused',
                        GSHEET_FILE_PATH='unused', GSHEET_FILE_PATH_TIMESTAMPED='unused',
                        GSHEET_FILE_PATH_NEW='unused', GSHEET_FILE_PATH_TIMESTAMPED_NEW='unused',
                        ServiceAccountCredentials=types.SimpleNamespace(from_json_keyfile_name=lambda *a: None),
                        gspread=types.SimpleNamespace(authorize=lambda _: client_for(sheet)))
                    env['save_dataframe'] = lambda *args: None
                    row = {'Name #1': 'A', 'Name #2': 'B', 'Event': 'event', 'Type': 'Accapella',
                           'Year': 2026, 'Channel': 'FOB', 'Uploaded': '2026-09-21',
                           'URL': 'https://www.youtube.com/watch?v=test', 'ID': 'test', 'Views': value}
                    env[function](pd.DataFrame([row]))
                    self.assertEqual(sheet.appended[0][view_index], expected)


if __name__ == '__main__':
    unittest.main()
