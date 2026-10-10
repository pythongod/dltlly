"""Reconcile generated rows with a curated worksheet using RAW cell writes.

The caller must serialize ingestion runs. Sheets offers no conditional cell
write: external editors must also be coordinated for the final read/write gap.
Failures deliberately propagate. Rerun against a fresh read after an ambiguous
append response; retrying the append request itself can duplicate records.
"""
import re


CORE_HEADERS = ('Name #1', 'Name #2', 'Event', 'Type', 'Year', 'Channel',
                'Uploaded', 'URL', 'ID', 'Views')
MACHINE_FIELDS = ('Name #1', 'Name #2', 'Event', 'Type', 'Year', 'Channel',
                  'Uploaded', 'URL', 'Views')
MISSING = {'', 'unknown', 'n/a', 'none', 'null', 'nan'}


def _known(value):
    return value is not None and str(value).strip().lower() not in MISSING


def _text(value):
    return '' if value is None else str(value)


def _index(rows, label):
    indexed = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError(f'{label}: rows must be dictionaries')
        video_id = row.get('ID')
        if not isinstance(video_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
            raise ValueError(f'{label}: invalid or empty video ID')
        if video_id in indexed:
            raise ValueError(f'{label}: duplicate video ID')
        for field in MACHINE_FIELDS:
            if row.get(field) is not None and not isinstance(row[field], (str, int)):
                raise ValueError(f'{label}: metadata must contain scalar text or integers')
        views = row.get('Views')
        if _known(views) and (isinstance(views, bool) or not re.fullmatch(r'\d+', str(views))):
            raise ValueError(f'{label}: views must be a nonnegative integer')
        indexed[video_id] = row
    return indexed


def _cell(column, row):
    letters = ''
    while column:
        column, remainder = divmod(column - 1, 26)
        letters = chr(65 + remainder) + letters
    return f'{letters}{row}'


def sync_sheet(worksheet, rows: list[dict], previous_rows: list[dict],
               historical: bool = False, dry_run: bool = False) -> dict:
    """Return planned/applied counts and conflicts, leaving exports to the caller.

    ``previous_rows`` is the previous generated collection, never a Sheet export.
    With no baseline, nonempty differing Sheet metadata is conservatively kept.
    Conflicts contain only ID/field references, not imported or private contents.
    New-layout curator columns are never ingestion destinations, even if empty.
    """
    incoming = _index(rows, 'Incoming data')
    previous = _index(previous_rows, 'Previous data')
    snapshot = worksheet.get_all_values()
    if not isinstance(snapshot, list) or not snapshot or not isinstance(snapshot[0], list):
        raise ValueError('Sheet has no header row')
    headers = snapshot[0]
    if (any(not isinstance(h, str) or not h or h != h.strip() for h in headers)
            or len(set(headers)) != len(headers)
            or not set(CORE_HEADERS).issubset(headers)):
        raise ValueError('Sheet has missing, duplicate, or invalid headers')
    new_layout = 'hidden' in headers or 'Processed' in headers
    if new_layout and not {'hidden', 'Location', 'Stadt'}.issubset(headers):
        raise ValueError('New Sheet layout requires hidden, Location, and Stadt headers')
    existing = {}
    for row_number, values in enumerate(snapshot[1:], start=2):
        if not isinstance(values, list) or len(values) > len(headers):
            raise ValueError('Sheet row exceeds header width or is malformed')
        padded = values + [''] * (len(headers) - len(values))
        if not any(_text(value) for value in padded):
            continue
        record = dict(zip(headers, padded))
        video_id = record['ID']
        if not isinstance(video_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
            raise ValueError('Nonempty Sheet row has invalid or empty ID')
        if video_id in existing:
            raise ValueError('Sheet has duplicate IDs')
        existing[video_id] = (row_number, record)

    updates, additions, conflicts = [], [], []
    updated_ids = set()
    for video_id, row in incoming.items():
        generated = {field: row.get(field) for field in MACHINE_FIELDS}
        if _known(generated['Views']):
            generated['Views'] = int(generated['Views'])
        baseline = previous.get(video_id, {})
        if new_layout:
            generated['hidden'] = generated.pop('Event')
            baseline = dict(baseline, hidden=baseline.get('Event'))
        if video_id not in existing:
            new_row = {field: value for field, value in generated.items() if _known(value)}
            new_row['ID'] = video_id
            if historical and 'Processed' in headers:
                new_row['Processed'] = 'skipped historical backfill'
            additions.append([new_row.get(header, '') for header in headers])
            continue
        row_number, current = existing[video_id]
        for field, value in generated.items():
            if not _known(value) or _text(current[field]) == _text(value):
                continue
            if (field == 'Views' or _text(current[field]) == ''
                    or (field in baseline and _text(current[field]) == _text(baseline[field]))):
                updates.append({'range': _cell(headers.index(field) + 1, row_number),
                                'values': [[value]]})
                updated_ids.add(video_id)
            else:
                conflicts.append({'ID': video_id, 'field': field})
    summary = {'appended': len(additions), 'updated': len(updated_ids),
               'updated_cells': len(updates), 'conflicts': conflicts, 'dry_run': dry_run}
    if not dry_run and (updates or additions):
        # Detect a sort/edit between planning and writing rather than knowingly
        # applying positional writes to a changed worksheet.
        if worksheet.get_all_values() != snapshot:
            raise RuntimeError('Sheet changed during synchronization; rerun from a fresh read')
        if updates:
            worksheet.batch_update(updates, value_input_option='RAW')
        if additions:
            worksheet.append_rows(additions, value_input_option='RAW')
    return summary
