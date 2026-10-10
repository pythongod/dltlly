import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest


WRAPPER = Path(os.environ.get('BATTLEDB_TEST_WRAPPER', Path(__file__).resolve().parents[1] / 'ops/run-update.sh'))


class CronTests(unittest.TestCase):
    def run_job(self, exit_code, curl_failure=''):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            updater = directory / 'update'
            updater.write_text(f'#!/bin/sh\necho normal-output\necho error-output >&2\nexit {exit_code}\n')
            timestamp = directory / 'timestamp'
            timestamp.write_text('#!/bin/sh\ncat\n')
            curl = directory / 'curl'
            # Require a real URL argument after -o /dev/null, unlike the broken cron entry.
            curl.write_text('''#!/bin/sh
output_pending=0
url_count=0
for arg in "$@"; do
  if [ "$output_pending" = 1 ]; then
    [ "$arg" = /dev/null ] || exit 2
    output_pending=0
  elif [ "$arg" = -o ]; then
    output_pending=1
  else
    case "$arg" in https://*) url_count=$((url_count + 1));; esac
  fi
done
[ "$url_count" = 1 ] || exit 2
printf '%s\\n' "$*" >> "$TEST_CURL_LOG"
case "$*" in *"$TEST_CURL_FAILURE"*) [ -z "$TEST_CURL_FAILURE" ] || exit 42;; esac
''')
            for path in [updater, timestamp, curl]:
                path.chmod(0o755)
            log = directory / 'job.log'
            requests = directory / 'requests.log'
            config = directory / 'cron.env'
            values = {'BATTLEDB_UPDATER': str(updater), 'BATTLEDB_TIMESTAMP': str(timestamp),
                      'BATTLEDB_LOG': str(log), 'BATTLEDB_HEALTHCHECK_WEEKDAY': 'https://example.invalid/health-weekday',
                      'BATTLEDB_HEALTHCHECK_SUNDAY': 'https://example.invalid/health-sunday',
                      'BATTLEDB_NOTIFY_URL': 'https://example.invalid/notify'}
            config.write_text(''.join(f'{key}={shlex.quote(value)}\n' for key, value in values.items()))
            env = dict(os.environ, BATTLEDB_CRON_CONFIG=str(config), TEST_CURL_LOG=str(requests), TEST_CURL_FAILURE=curl_failure,
                       PATH=str(directory) + os.pathsep + os.environ['PATH'])
            result = subprocess.run(['bash', str(WRAPPER)], env=env, capture_output=True, text=True)
            return result.returncode, log.read_text() if log.exists() else '', requests.read_text().splitlines() if requests.exists() else []

    def test_failure_does_not_report_success(self):
        status, log, requests = self.run_job(42)
        self.assertEqual(status, 42)
        self.assertEqual(requests, [])

    def test_logs_stdout_and_stderr(self):
        status, log, requests = self.run_job(42)
        self.assertIn('normal-output', log)
        self.assertIn('error-output', log)

    def test_success_reports_once_to_each_destination(self):
        status, log, requests = self.run_job(0)
        self.assertEqual(status, 0)
        self.assertEqual(len(requests), 2)
        self.assertEqual(sum('example.invalid/notify' in request for request in requests), 1)

    def test_notification_failure_is_not_retried_or_reported_as_success(self):
        status, _, requests = self.run_job(0, curl_failure='/notify')
        self.assertEqual(status, 42)
        self.assertEqual(len(requests), 1)
        self.assertNotIn('--retry', requests[0])

    def test_healthcheck_failure_does_not_prevent_notification(self):
        status, _, requests = self.run_job(0, curl_failure='example.invalid/health')
        self.assertEqual(status, 42)
        self.assertEqual(len(requests), 2)
        self.assertIn('/notify', requests[0])


if __name__ == '__main__':
    unittest.main()
