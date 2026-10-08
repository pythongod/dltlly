import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('repair', ROOT / 'ops/n8n/repair_notifications.py')
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


def workflow():
    names = ["On clicking 'execute'", 'Read  Sheets *new*', 'Is new?', 'Do something here',
             'Telegram', 'Set processed value', 'Mark row as processed *new*',
             'Mark row as processed *new* TelegramNotifications', 'Run every 12h', 'Telegram1', 'Limit']
    nodes = [{'name': name, 'id': str(i), 'parameters': {}, 'type': 'test', 'position': [0, 0]}
             for i, name in enumerate(names)]
    nodes[4]['parameters'] = {'chatId': 'preserve-me', 'text': "=Added row: {{ $json['Name #1'] }}", 'additionalFields': {'message_thread_id': 123}}
    nodes[6]['parameters'] = {'columns': {'mappingMode': 'defineBelow', 'value': {}, 'matchingColumns': ['ID']}}
    return {'name': 'test', 'nodes': nodes, 'connections': {}, 'settings': {'executionOrder': 'v1'}}


class NotificationWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.fixed = repair.repair(workflow())
        self.nodes = {node['name']: node for node in self.fixed['nodes']}

    def targets(self, name, output=0):
        return [edge['node'] for edge in self.fixed['connections'][name]['main'][output]]

    def test_html_escapes_imported_fields_and_preserves_underscore_url(self):
        telegram = self.nodes['Telegram']['parameters']
        self.assertEqual(telegram['additionalFields'].get('parse_mode'), 'HTML')
        expression = telegram['text']
        row = {'Name #1': '<Neilz> & Veto', 'Name #2': 'Fynn & Faivel', 'Channel': 'DLTLLY', 'URL': 'https://www.youtube.com/watch?v=w6cctGAqO_U&x=1'}
        result = subprocess.check_output(['node', '-e', 'const [e,row]=process.argv.slice(1); console.log(new Function("$json", "return ("+e.slice(3,-2)+")")(JSON.parse(row)));', expression, json.dumps(row)], text=True).strip()
        self.assertEqual(result, 'Added row: &lt;Neilz&gt; &amp; Veto vs. Fynn &amp; Faivel from DLTLLY  Link: https://www.youtube.com/watch?v=w6cctGAqO_U&amp;x=1')
        self.assertEqual(telegram['chatId'], 'preserve-me')
        self.assertEqual(telegram['additionalFields']['message_thread_id'], 123)

    def test_delivery_is_recorded_before_advancing_to_next_item(self):
        self.assertEqual(self.nodes['Loop notifications']['parameters']['batchSize'], 1)
        self.assertEqual(self.targets('Is new?'), ['Loop notifications'])
        self.assertEqual(self.targets('Loop notifications', 1), ['Telegram'])
        self.assertEqual(self.targets('Telegram'), ['Set processed value'])
        self.assertEqual(self.targets('Set processed value'), ['Mark row as processed *new*'])
        self.assertEqual(self.targets('Mark row as processed *new*'), ['Loop notifications'])
        self.assertFalse(self.nodes['Telegram'].get('continueOnFail', False))
        self.assertFalse(self.nodes['Telegram'].get('retryOnFail', False))

    def test_delivery_marker_uses_original_video_id_not_telegram_response(self):
        values = self.nodes['Set processed value']['parameters']['values']['string']
        mappings = {v['name']: v['value'] for v in values}
        self.assertEqual(mappings['ID'], "={{ $('Loop notifications').item.json.ID }}")
        self.assertEqual(self.nodes['Mark row as processed *new*']['parameters']['columns']['matchingColumns'], ['ID'])
        self.assertNotIn('Mark row as processed *new* TelegramNotifications', self.nodes)

    def test_only_webhook_subworkflow_entry_and_no_empty_run_messages(self):
        self.assertNotIn('Run every 12h', self.nodes)
        self.assertNotIn('Telegram1', self.nodes)
        self.assertEqual(self.targets("On clicking 'execute'"), ['Read  Sheets *new*'])
        self.assertEqual(self.targets('Is new?', 1), [])


if __name__ == '__main__':
    unittest.main()
