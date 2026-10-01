# Scheduled updater

The ingestion Python files live outside this website repository. The patches in
`patches/` record the reviewed changes without copying credentials into Git.
Apply them from the ingestion directory with `patch -p1`, after backing up the
original files and checking `patch --dry-run -p1`.

- `cleanup-v4.patch`: tolerate missing view counts and propagate failures.
- `updateviewcount-v3.patch`: update only changed Views cells; never clear the
  worksheet or rewrite curated columns and formulas.
- `update-git-upload-v3.sh`: stop on failures, fast-forward pulls only, and skip
  empty commits while still retrying an outstanding push.
- `run-update.sh`: preserve pipeline failures, capture stderr, and send one
  healthcheck and one notification after a successful update.

The cron wrapper reads `$HOME/.config/battledb/cron.env` (directory mode 700,
file mode 600). Configure these shell variables there, keeping real endpoints
outside Git:

```
BATTLEDB_UPDATER=/path/to/update-git-upload-v3.sh
BATTLEDB_TIMESTAMP=/path/to/timestamp.sh
BATTLEDB_LOG=/path/to/cron.log
BATTLEDB_HEALTHCHECK_WEEKDAY=https://example.invalid/weekday
BATTLEDB_HEALTHCHECK_SUNDAY=https://example.invalid/sunday
BATTLEDB_NOTIFY_URL=https://example.invalid/notify
```

Keep the existing cron schedules and replace their command with the absolute
path to `run-update.sh`. Install both shell files as executable. Repository
push authentication uses a repository-scoped SSH deploy key; private keys and
known-host configuration stay outside Git. Branch protection is unchanged.

## Tests

```
npm ci
npm test
python3 tests/test_cron.py
python3 tests/test_upload_job.py
```

Run `tests/test_updater.py` as the ingestion service user with its existing
Python environment (`pandas` and `gspread` installed). Set
`BATTLEDB_UPDATER_DIR` when the ingestion directory differs from the test's
default. Tests load only the relevant functions and use fake external-service
boundaries; they do not write live Sheets, push commits, or send notifications.
