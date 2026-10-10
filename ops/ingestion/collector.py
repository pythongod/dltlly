"""Complete YouTube discovery with an injected Google API client.

Imports have no side effects. A failed request always raises: callers must not
publish results until both discovery and all detail batches have succeeded.
"""
import random as _random
import socket
from http.client import IncompleteRead, RemoteDisconnected
import re
import time

CHANNEL_IDS = (
    'UCBMnRM8WE4A1JA6KyZtQhBg',  # DUDL
    'UCHzJ7s9HeHWrkTh8zeCnw0g',  # DLTLLY
    'UCK4v1FAAf8hDAjFnXnvxN7w',  # FOB
)
PLAYLIST_IDS = (
    'PLlYYj-TzOlFko09dyz1xsfLtvZdwxKPfK',  # FOB
    'PL40DAD3444D8C93C4',  # BMCL
)
_DURATION = re.compile(r'P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?')


def execute_with_retry(request, *, sleep=time.sleep, random=_random.random):
    """Attempt up to four times, retrying transport failures and HTTP 429/5xx.

    Inject sleep and random for deterministic offline tests. Permanent API
    errors (including quota/authentication errors) propagate immediately.
    """
    for attempt in range(4):
        try:
            return request.execute()
        except Exception as error:
            status = getattr(getattr(error, 'resp', None), 'status', None)
            # httplib2 wraps DNS failures in its own exception; recognize that
            # public type without requiring the SDK at module import time.
            dns_failure = (type(error).__module__ == 'httplib2'
                           and type(error).__name__ == 'ServerNotFoundError')
            transient = (isinstance(error, (TimeoutError, ConnectionError, IncompleteRead, RemoteDisconnected))
                         or isinstance(error, socket.gaierror) and error.errno == socket.EAI_AGAIN
                         or dns_failure or status in (429, 500, 502, 503, 504))
            if not transient or attempt == 3:
                raise
            sleep((2 ** attempt) * (1 + random()))


def parse_duration_seconds(value):
    """Parse day/hour/minute/second ISO 8601 durations without dependencies."""
    match = _DURATION.fullmatch(value)
    if not match or not any(part is not None for part in match.groups()) or value.endswith('T'):
        raise ValueError('Invalid video duration')
    seconds = sum(float(part or 0) * multiplier
                  for part, multiplier in zip(match.groups(), (86400, 3600, 60, 1)))
    return int(seconds) if seconds.is_integer() else seconds


def discover_video_ids(youtube):
    """Scan every uploads/curated playlist page and deduplicate in source order."""
    response = execute_with_retry(youtube.channels().list(
        part='contentDetails', id=','.join(CHANNEL_IDS), maxResults=50))
    uploads = {item['id']: item['contentDetails']['relatedPlaylists']['uploads']
               for item in response['items']}
    if any(not uploads.get(channel) for channel in CHANNEL_IDS):
        raise ValueError('A configured channel has no uploads playlist')
    video_ids = {}
    playlists = dict.fromkeys([uploads[channel] for channel in CHANNEL_IDS] + list(PLAYLIST_IDS))
    for playlist in playlists:
        token = None
        seen_tokens = set()
        while True:
            parameters = dict(part='contentDetails', playlistId=playlist, maxResults=50)
            if token:
                parameters['pageToken'] = token
            page = execute_with_retry(youtube.playlistItems().list(**parameters))
            for item in page['items']:
                video_id = item.get('contentDetails', {}).get('videoId')
                if video_id:
                    video_ids.setdefault(video_id, None)
            token = page.get('nextPageToken')
            if not token:
                break
            if token in seen_tokens:
                raise ValueError('Repeated playlist page token')
            seen_tokens.add(token)
    return list(video_ids)


def fetch_video_details(youtube, ids):
    """Fetch canonical video metadata in batches of 50, preserving input order.

    IDs omitted by a successful response are unavailable/private and skipped;
    the caller should preserve any previously stored values for those IDs.
    Missing optional metadata uses None, never an invented placeholder.
    """
    ids = list(dict.fromkeys(ids))
    records = {}
    for start in range(0, len(ids), 50):
        batch = ids[start:start + 50]
        response = execute_with_retry(youtube.videos().list(
            part='snippet,statistics,contentDetails', id=','.join(batch), maxResults=50))
        for item in response['items']:
            video_id = item['id']
            if video_id not in batch:
                raise ValueError('Video response contains an unrequested ID')
            snippet = item.get('snippet', {})
            duration = item.get('contentDetails', {}).get('duration')
            views = item.get('statistics', {}).get('viewCount')
            records[video_id] = {
                'id': video_id,
                'title': snippet.get('title'),
                'published_at': snippet.get('publishedAt'),
                'channel_id': snippet.get('channelId'),
                'channel_title': snippet.get('channelTitle'),
                'duration_seconds': parse_duration_seconds(duration) if duration else None,
                'views': int(views) if views is not None else None,
            }
    return [records[video_id] for video_id in ids if video_id in records]
