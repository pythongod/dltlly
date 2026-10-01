import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'ops/update-git-upload-v3.sh'


class UploadJobTests(unittest.TestCase):
    def run_job(self, failure='', changed=True):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            for name in ['git', 'python3']:
                executable = directory / name
                executable.write_text('''#!/bin/bash
printf '%s %s\\n' "${0##*/}" "$*" >> "$TEST_COMMANDS"
[[ "$*" == "$TEST_FAILURE" ]] && exit 42
if [[ "$1" == diff ]]; then exit "$TEST_CHANGED"; fi
exit 0
''')
                executable.chmod(0o755)
            log = directory / 'commands'
            env = dict(os.environ, BATTLEDB_REPO=folder, BATTLEDB_GETDATA=folder,
                       PATH=folder + os.pathsep + os.environ['PATH'], TEST_COMMANDS=str(log),
                       TEST_FAILURE=failure, TEST_CHANGED='1' if changed else '0')
            result = subprocess.run(['bash', str(SCRIPT)], env=env, capture_output=True)
            return result.returncode, log.read_text().splitlines()

    def test_pull_failure_stops_before_external_writes(self):
        status, commands = self.run_job('pull --ff-only')
        self.assertEqual(status, 42)
        self.assertEqual(commands, ['git pull --ff-only'])

    def test_no_changes_skips_commit_but_retries_push(self):
        status, commands = self.run_job(changed=False)
        self.assertEqual(status, 0)
        self.assertFalse(any(command.startswith('git commit') for command in commands))
        self.assertEqual(commands[-1], 'git push')

    def test_push_failure_is_reported(self):
        status, commands = self.run_job('push')
        self.assertEqual(status, 42)

    def test_changed_data_is_committed_before_push(self):
        status, commands = self.run_job()
        self.assertEqual(status, 0)
        self.assertEqual(commands[-2:], ['git commit -m Update battle data and timestamps', 'git push'])


if __name__ == '__main__':
    unittest.main()
