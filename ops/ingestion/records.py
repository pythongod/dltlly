"""Structured YouTube metadata to CSV rows; identity is always the video ID."""
import html
import math
import re
import unicodedata
from datetime import datetime, timezone

COLUMN_ORDER = ['Name #1', 'Name #2', 'Event', 'Type', 'Year', 'Channel',
                'Uploaded', 'URL', 'ID', 'Views', 'Content category']
UNKNOWN = 'Unknown'
_ID = re.compile(r'[A-Za-z0-9_-]{11}\Z')
_CHANNELS = {"future of battlerap": 'FOB', 'du und deine lines': 'DUDL',
             'du & deine lines': 'DUDL', "don't flop entertainment": "DON'T FLOP",
             'spox': 'SPOX', 'urban id': 'RAM', 'aggro.tv': 'RAM'}


def _known(value):
    return value is not None and str(value).strip().lower() not in {
        '', 'unknown', 'n/a', 'nan', 'none', 'could not identify event'}


def _text(value):
    return ' '.join(unicodedata.normalize('NFC', html.unescape(str(value))).split())


def _date(value):
    if not _known(value):
        return UNKNOWN
    try:
        date = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if date.tzinfo:
            date = date.astimezone(timezone.utc)
        return date.date().isoformat()
    except ValueError:
        return UNKNOWN


def _views(value):
    if isinstance(value, bool) or not re.fullmatch(r'\d+', str(value)):
        return UNKNOWN
    return int(value)


def _name(value):
    value = re.sub(r'#(?!\d)\w+', '', value)
    value = re.sub(r'^(?:AGGRO\.TV\s+)?RAP AM MITTWOCH(?:\s+KING FINALE VOM \d{2}\.\d{2}\.\d{4})?\s*[-:]?\s*', '', value, flags=re.I)
    value = re.sub(r'^(?:BMCL RAP BATTLE:|Zoom Freestyle:|Sport-Rap-Battle #?\d+\s*:?)\s*', '', value, flags=re.I)
    value = re.sub(r'^(?:DLTLLY\+D(?:&DL|UDL)\s*)?"Breakthrough"\s*', '', value, flags=re.I)
    value = re.sub(r'^(?:Freestyle Turnier \d+/\d+:|BMCL MEETS DLTLLY RAP BATTLE:|Ankündigung:)\s*', '', value, flags=re.I)
    # Remove decorative symbols at the edges without changing punctuation inside artist names.
    value = value.strip()
    while value and unicodedata.category(value[0]) in {'So', 'Sk'}:
        value = value[1:].strip()
    return value.strip(' :-')


def _title_parts(title):
    # These legacy title markers start event/production metadata, never an artist.
    # Strip the one RAM date prefix first so it cannot become an event separator.
    title = re.sub(r'^(RAP AM MITTWOCH) KING FINALE VOM \d{2}\.\d{2}\.\d{4}\s+', r'\1 ', title, flags=re.I)
    title = re.sub(r'\s+(?=D&DL#\d+)', ' // ', title, flags=re.I)
    ram_marker = (r'\(BATTLEMANIA CHAMPIONSLEAGUE\)|GERMAN BATTLE|'
                  r'\(OFFICIAL HD VERSION AGGRO ?TV\)|\(OPENAIR FRAUENFELD\)|'
                  r'\(\d+/\d+\)|\(AGGRO TV\)|KING FINALE VOM \d{2}\.\d{2}\.\d{4}|'
                  r'\d{2}\.\d{2}\.\d{2} BattleMania King Finale')
    title = re.sub(ram_marker, '// BMCL', title, flags=re.I)
    parts = re.split(r'⎪|//|\||\s/\s', title)
    annotated = re.split(r'\s+(?:-\s*)?(?=(?:Das\s+)?Interview\b)|\s+(?=\((?:FINALE|BATTLE UM PLATZ \d+|NEWCOMER BATTLE|BONUS BATTLE)\))', parts[0], maxsplit=1, flags=re.I)
    return annotated + parts[1:]


def _event(value):
    value = re.sub(r'\b(?:DLTLLY|Don\'t Flop|BRB|FOB)\b', '', value, flags=re.I)
    value = re.sub(r'\b(?:On[ -]?Beat(?:\s*Battle)?|Rap\s*Battles?|TitleContenderMatch)\b', '', value, flags=re.I)
    value = re.sub(r'#(?!\d)\w+', '', value).replace('@', ' ').replace('(', '').replace(')', '')
    return ' '.join(value.split()).strip(' -') or 'could not identify event'


def parse_record(record):
    """Return one row or None for invalid/uncertain input. Never inspect serialized metadata.

    A versus pair and known duration >=99 seconds are required. Unmarked clips
    under 180 seconds are retained as other. Classification is
    conservative keyword inference, not proof of the video's contents. Publication
    time must already be the video's time, not its playlist insertion time.
    """
    video_id = record.get('id')
    if not isinstance(video_id, str) or not _ID.fullmatch(video_id):
        return None
    duration = record.get('duration_seconds')
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration < 99:
        return None
    if not isinstance(record.get('title'), str):
        return None
    title = _text(record['title'])
    parts = _title_parts(title)
    one_rounder = re.fullmatch(r'(.+?)\s+-\s+ONE ROUNDER\s+\(VS\.?\s+([^()]+)\)\s*', parts[0], flags=re.I)
    names = list(one_rounder.groups()) if one_rounder else re.split(r'\s+(?:"vs\.?"\s+|vs\.\s*|vs\s+)', parts[0], flags=re.I)
    if len(names) != 2:
        return None
    names = [_name(name) for name in names]
    if not all(names) or any(re.search(r'\b(?:PPV|Trailer|weitere Battles)\b|\d{2}\.\d{2}\.', name, re.I) for name in names):
        return None
    explicit_freestyle = re.search(r'\bFREESTYLE (?:RAP )?BATTLE\b', title, re.I)
    category = 'other' if duration < 180 and not explicit_freestyle else 'battle'
    if re.search(r'\b(?:quiz|reaction|reaktion|recap)\b', title, re.I):
        category = 'other'
    elif re.search(r'\b(?:trailer|teaser|promo|pressekonferenz|press conference|reveal|out now|ankündigung)\b', title, re.I):
        category = 'promo'
    elif re.search(r'\b(?:interview|aftermatch)\b', title, re.I) and not re.search(r'\+\s*Interview\b', title, re.I):
        category = 'interview'
    published = _date(record.get('published_at'))
    year_match = re.search(r'(?<![\d#])([1-9]\d{3})(?!\d)', title)
    year = int(year_match[1]) if year_match else int(published[:4]) if published != UNKNOWN else UNKNOWN
    channel = _text(record['channel_title']) if _known(record.get('channel_title')) else UNKNOWN
    channel = 'DLTLLY' if re.match(r'^DLTLLY\b', channel, re.I) else _CHANNELS.get(channel.lower(), channel or UNKNOWN)
    return dict(zip(COLUMN_ORDER, [*names, _event(parts[1]) if len(parts) > 1 else 'could not identify event',
        'On Beat' if re.search(r'\bon[ -]?beat\b', title, re.I) else 'Accapella', year,
        channel, published, f'https://www.youtube.com/watch?v={video_id}', video_id,
        _views(record.get('views')), category]))


def merge_records(existing, incoming):
    """Merge rows (or incoming structured records) by ID, preserving known fields.

    Existing invalid identities raise instead of silently dropping historical data.
    A failed reparse retains old metadata; available views can still refresh. Order
    follows existing IDs then newly discovered IDs. Inputs are never mutated.
    """
    merged = {}
    for item in [*existing, *incoming]:
        structured = 'id' in item and 'ID' not in item
        video_id = item.get('id' if structured else 'ID')
        if not isinstance(video_id, str) or not _ID.fullmatch(video_id):
            raise ValueError(f'Invalid video ID: {video_id!r}')
        row = parse_record(item) if structured else dict(item)
        if row is None:
            if video_id in merged and _known(_views(item.get('views'))):
                merged[video_id]['Views'] = _views(item['views'])
            continue
        if not _known(row.get('Views')):
            row['Views'] = UNKNOWN
        if video_id not in merged:
            merged[video_id] = {key: row.get(key, 'other' if key == 'Content category' else UNKNOWN) for key in COLUMN_ORDER}
        else:
            for key in COLUMN_ORDER:
                if _known(row.get(key)):
                    merged[video_id][key] = row[key]
    return list(merged.values())
