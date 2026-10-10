"""Offline coverage for the YouTube ingestion boundary."""
import unittest
import socket
from http.client import IncompleteRead
from types import SimpleNamespace
from unittest.mock import Mock

from ops.ingestion import collector


class APIError(Exception):
    def __init__(self, status):
        self.resp = SimpleNamespace(status=status)


class CollectorTests(unittest.TestCase):
    def test_discovery_reads_all_pages_and_deduplicates_all_sources(self):
        youtube = Mock()
        youtube.channels().list().execute.return_value = {
            'items': [{'id': channel, 'contentDetails': {'relatedPlaylists': {'uploads': 'uploads-' + channel}}}
                      for channel in collector.CHANNEL_IDS]}
        first = ['video%06d' % index for index in range(50)]
        second = ['video%06d' % index for index in range(50, 81)]
        def playlist_list(**kwargs):
            ids = second if kwargs.get('pageToken') else first
            payload = {'items': [{'contentDetails': {'videoId': value}} for value in ids]}
            if not kwargs.get('pageToken'):
                payload['nextPageToken'] = 'next'
            return SimpleNamespace(execute=lambda: payload)
        youtube.playlistItems().list.side_effect = playlist_list
        self.assertEqual(collector.discover_video_ids(youtube), first + second)
        self.assertEqual(youtube.playlistItems().list.call_count, 10)
        self.assertEqual(set(call.kwargs['playlistId'] for call in youtube.playlistItems().list.call_args_list),
                         {'uploads-' + channel for channel in collector.CHANNEL_IDS} | set(collector.PLAYLIST_IDS))

    def test_missing_configured_channel_fails_discovery(self):
        youtube = Mock()
        youtube.channels().list().execute.return_value = {'items': []}
        with self.assertRaises(ValueError):
            collector.discover_video_ids(youtube)

    def test_details_use_video_publication_and_optional_fields(self):
        youtube = Mock()
        youtube.videos().list().execute.return_value = {'items': [{
            'id': 'abcdefghijk', 'snippet': {'title': 'A vs B', 'publishedAt': '2020-01-02T12:00:00Z',
                                           'channelId': 'channel', 'channelTitle': 'Channel'},
            'contentDetails': {'duration': 'P1DT2H3M4S'}, 'statistics': {}}]}
        self.assertEqual(collector.fetch_video_details(youtube, ['abcdefghijk', 'private0000', 'abcdefghijk']), [{
            'id': 'abcdefghijk', 'title': 'A vs B', 'published_at': '2020-01-02T12:00:00Z',
            'channel_id': 'channel', 'channel_title': 'Channel', 'duration_seconds': 93784, 'views': None}])

    def test_later_batch_failure_raises_instead_of_returning_partial_data(self):
        youtube = Mock()
        youtube.videos().list().execute.side_effect = [{'items': [{'id': 'video000000'}]}, APIError(403)]
        with self.assertRaises(APIError):
            collector.fetch_video_details(youtube, ['video%06d' % i for i in range(51)])

    def test_retry_is_bounded_and_permanent_errors_fail_immediately(self):
        for status, count in [(503, 4), (429, 4), (403, 1)]:
            with self.subTest(status=status):
                request, sleep = Mock(), Mock()
                request.execute.side_effect = APIError(status)
                with self.assertRaises(APIError):
                    collector.execute_with_retry(request, sleep=sleep, random=lambda: 0.5)
                self.assertEqual(request.execute.call_count, count)
                self.assertEqual([call.args[0] for call in sleep.call_args_list], [1.5, 3.0, 6.0][:count-1])

    def test_retry_recovers_transient_network_failure(self):
        request = Mock()
        request.execute.side_effect = [TimeoutError(), {'items': []}]
        self.assertEqual(collector.execute_with_retry(request, sleep=lambda _: None), {'items': []})

    def test_retry_recovers_dns_and_truncated_http_transport_failures(self):
        server_not_found = type('ServerNotFoundError', (Exception,), {'__module__': 'httplib2'})
        for error in [socket.gaierror(socket.EAI_AGAIN, 'temporary DNS failure'),
                      IncompleteRead(b'partial'), server_not_found('unavailable')]:
            with self.subTest(error=type(error).__name__):
                request = Mock()
                request.execute.side_effect = [error, {'items': []}]
                self.assertEqual(collector.execute_with_retry(request, sleep=lambda _: None), {'items': []})

    def test_duration_parser(self):
        for value, expected in [('PT0S', 0), ('PT99S', 99), ('PT2H', 7200), ('P2D', 172800), ('PT1M0.5S', 60.5)]:
            self.assertEqual(collector.parse_duration_seconds(value), expected)
        for value in ['P', 'PT', 'garbage', '-PT1S', 'P1M']:
            with self.assertRaises(ValueError):
                collector.parse_duration_seconds(value)

    def test_details_preserve_input_order_and_numeric_views(self):
        youtube = Mock()
        youtube.videos().list().execute.return_value = {'items': [
            {'id': 'second00000', 'statistics': {'viewCount': '0'}},
            {'id': 'first000000', 'statistics': {'viewCount': '123'}}]}
        rows = collector.fetch_video_details(youtube, ['first000000', 'second00000'])
        self.assertEqual([row['id'] for row in rows], ['first000000', 'second00000'])
        self.assertEqual([row['views'] for row in rows], [123, 0])
        self.assertIsNone(rows[0]['duration_seconds'])
        self.assertIsNone(rows[0]['title'])

    def test_empty_detail_input_makes_no_request(self):
        youtube = Mock()
        self.assertEqual(collector.fetch_video_details(youtube, []), [])
        youtube.videos.assert_not_called()


if __name__ == '__main__':
    unittest.main()
