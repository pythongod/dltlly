"""Collect, reconcile, then publish. Run from the repo: python -m ops.ingestion.run."""
import argparse
import csv
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from .collector import discover_video_ids, fetch_video_details
from .config import clients
from .records import COLUMN_ORDER, merge_records, parse_record
from .sheets import sync_sheet
from .storage import atomic_write, csv_text, exclusive_lock


def write_json(path, value):
    atomic_write(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def run(repo, state, youtube, worksheets, *, apply=False, historical=False):
    repo, state = Path(repo), Path(state)
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    journal = state / 'runs' / stamp
    journal.mkdir(parents=True, mode=0o700)
    primary = repo / 'data/battle_events.csv'
    with primary.open(newline='') as stream:
        previous = list(csv.DictReader(stream))
    # Retain the original merge baseline across any interrupted publication.
    pending = state / 'pending.json'
    if pending.exists():
        recovery = json.loads(pending.read_text())
        previous = recovery['previous']
        historical = historical or recovery['historical']
    snapshots = [sheet.get_all_values() for sheet in worksheets]
    write_json(journal / 'before.json', {'rows': previous, 'sheets': snapshots})
    ids = discover_video_ids(youtube)
    all_ids = dict.fromkeys(ids + [row['ID'] for row in previous])
    for snapshot in snapshots:
        if not snapshot or 'ID' not in snapshot[0]:
            raise ValueError('Sheet has no ID header')
        index = snapshot[0].index('ID')
        for row in snapshot[1:]:
            if len(row) > index and row[index]:
                all_ids[row[index]] = None
    records = fetch_video_details(youtube, list(all_ids))
    write_json(journal / 'records.json', records)
    rows = merge_records(previous, records)
    available = {record['id'] for record in records}
    for row in rows:
        row['Availability'] = 'available' if row['ID'] in available else 'unavailable'
    rows.sort(key=lambda row: (str(row['Uploaded']), row['ID']), reverse=True)
    before = {row['ID']: row for row in previous}
    changes = [{'ID': row['ID'], 'changes': {key: [before[row['ID']].get(key), value]
                for key, value in row.items() if str(before[row['ID']].get(key, '')) != str(value)}}
               for row in rows if row['ID'] in before]
    changes = [change for change in changes if change['changes']]
    summary = {'run': stamp, 'apply': apply, 'historical': historical,
               'discovered': len(ids), 'details': len(records), 'rows': len(rows),
               'new': sum(row['ID'] not in before for row in rows),
               'unavailable': sum(row['Availability'] == 'unavailable' for row in rows),
               'categories': dict(Counter(row['Content category'] for row in rows)),
               'changed_existing': len(changes), 'sheets': []}
    write_json(journal / 'changes.json', changes)
    write_json(journal / 'proposed.json', rows)
    write_json(journal / 'rejected.json', [record for record in records if parse_record(record) is None])
    if apply:
        write_json(pending, {'previous': previous, 'run': stamp, 'historical': historical})
    # Validate both destinations before the first external mutation.
    summary['sheets'] = [sync_sheet(sheet, rows, previous, historical=historical, dry_run=True)
                         for sheet in worksheets]
    if apply:
        summary['sheets'] = [sync_sheet(sheet, rows, previous, historical=historical)
                             for sheet in worksheets]
    write_json(journal / 'summary.json', summary)
    if not apply:
        print(json.dumps({key: value for key, value in summary.items() if key != 'sheets'}))
        return summary
    # Export after metadata AND view synchronization, never before it.
    exports = [sheet.get_all_values() for sheet in worksheets]
    for export in exports:
        uploaded = export[0].index('Uploaded')
        export[1:] = sorted(export[1:], key=lambda row: row[uploaded] if len(row) > uploaded else '', reverse=True)
    header = COLUMN_ORDER + ['Availability']
    payloads = {'battle_events': csv_text([header] + [[row.get(key, '') for key in header] for row in rows]),
                'gsheet_battle_events': csv_text(exports[0]),
                'gsheet_battle_events_v2': csv_text(exports[1])}
    for name, payload in payloads.items():
        atomic_write(repo / 'data' / (name + '.csv'), payload)
        history = 'history' if name == 'battle_events' else 'gsheet'
        atomic_write(repo / 'data' / history / (name + '_' + stamp + '.csv'), payload)
    now = datetime.now().astimezone()
    atomic_write(repo / 'info.yml', f'last_updated: {now:%Y-%m-%d}\nlast_updated_time: {now:%Y-%m-%d %H-%M}\n')
    write_json(state / 'last-success.json', summary)
    pending.unlink()
    print(json.dumps({key: value for key, value in summary.items() if key != 'sheets'}))
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--legacy', type=Path, default=Path.home() / 'dltlly/getdata')
    parser.add_argument('--state', type=Path, default=Path.home() / '.local/state/battledb')
    parser.add_argument('--apply', action='store_true', help='Write Sheets and publish exports; default is dry-run')
    parser.add_argument('--historical', action='store_true', help='Mark NEW Sheet rows as skipped historical backfill')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        with exclusive_lock(args.state / 'ingestion.lock'):
            youtube, worksheets = clients(args.repo, args.legacy)
            run(args.repo, args.state, youtube, worksheets, apply=args.apply, historical=args.historical)
    except Exception as error:
        # Google exceptions embed URLs/API keys. Logs report only safe type/status.
        status = getattr(getattr(error, 'resp', None), 'status', None)
        import traceback
        frame = traceback.extract_tb(error.__traceback__)[-1]
        print(f'Ingestion failed: {type(error).__name__}, HTTP status {status}, at {frame.name}:{frame.lineno}; no success recorded', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
