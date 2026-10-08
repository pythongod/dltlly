"""Transform a private n8n export; preserve deployment and credential references."""
import copy
import json
from pathlib import Path
import sys
import uuid


def repair(workflow):
    fixed = copy.deepcopy(workflow)
    nodes = {node['name']: node for node in fixed['nodes']}
    keep = ["On clicking 'execute'", 'Read  Sheets *new*', 'Is new?',
            'Telegram', 'Set processed value', 'Mark row as processed *new*']
    for name in keep:
        if name not in nodes:
            raise ValueError(f'Missing expected node: {name}')
    fixed['nodes'] = [nodes[name] for name in keep]
    fixed['nodes'].append({
        'id': str(uuid.uuid4()), 'name': 'Loop notifications',
        'type': 'n8n-nodes-base.splitInBatches', 'typeVersion': 3,
        'parameters': {'batchSize': 1, 'options': {}}, 'position': [1240, 440],
    })
    telegram = nodes['Telegram']
    telegram['parameters']['text'] = (
        "={{ ('Added row: ' + $json['Name #1'] + ' vs. ' + $json['Name #2']"
        " + ' from ' + $json.Channel + '  Link: ' + $json.URL)"
        ".replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}"
    )
    telegram['parameters'].setdefault('additionalFields', {}).update({
        'parse_mode': 'HTML', 'appendAttribution': False,
    })
    telegram['continueOnFail'] = False
    telegram['retryOnFail'] = False
    nodes['Set processed value']['parameters'] = {
        'keepOnlySet': True,
        'values': {'string': [
            {'name': 'ID', 'value': "={{ $('Loop notifications').item.json.ID }}"},
            {'name': 'Processed', 'value': '={{ $now.toISO() }}'},
        ]}, 'options': {},
    }
    marker = nodes['Mark row as processed *new*']
    marker['parameters']['columns'].update({
        'mappingMode': 'defineBelow', 'matchingColumns': ['ID'],
        'value': {'ID': '={{ $json.ID }}', 'Processed': '={{ $json.Processed }}'},
    })
    marker['continueOnFail'] = False
    # Retrying this ID-matched write is safe; retrying a send is not.
    marker.update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 1000})

    def edge(name):
        return {'node': name, 'type': 'main', 'index': 0}

    fixed['connections'] = {
        "On clicking 'execute'": {'main': [[edge('Read  Sheets *new*')]]},
        'Read  Sheets *new*': {'main': [[edge('Is new?')]]},
        'Is new?': {'main': [[edge('Loop notifications')], []]},
        'Loop notifications': {'main': [[], [edge('Telegram')]]},
        'Telegram': {'main': [[edge('Set processed value')]]},
        'Set processed value': {'main': [[edge('Mark row as processed *new*')]]},
        'Mark row as processed *new*': {'main': [[edge('Loop notifications')]]},
    }
    fixed['settings'] = {**fixed.get('settings', {}), 'executionOrder': 'v1'}
    fixed['pinData'] = {}
    fixed['versionId'] = str(uuid.uuid4())
    fixed['active'] = False  # Publish explicitly after import and verification.
    fixed.pop('activeVersionId', None)
    return fixed


if __name__ == '__main__':
    source, destination = map(Path, sys.argv[1:])
    destination.write_text(json.dumps(repair(json.loads(source.read_text())), indent=2))
    destination.chmod(0o600)
