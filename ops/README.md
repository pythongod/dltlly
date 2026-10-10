# Scheduled ingestion

`ops/ingestion/` is the versioned Python replacement for the three legacy LXC
scripts. Python 3.12 is the production runtime. The old scripts and their
embedded keys remain in `/home/jack/dltlly/getdata`; credentials remain in
`/home/jack/git/dltlly/service_account_credentials.json`. The replacement reads
literal settings through AST, without importing or executing those scripts.
Do not commit credentials, private configuration, or run journals.

## Install and run

Create an isolated environment and install the complete dependency lock:

```sh
python3 -m venv --without-pip "$HOME/.local/share/battledb/venv"
python3 -m pip --python "$HOME/.local/share/battledb/venv/bin/python" install -r ops/ingestion/requirements.lock
cd "$HOME/git/dltlly"
"$HOME/.local/share/battledb/venv/bin/python" -m ops.ingestion.run --historical
```

The default is read-only for Sheets and published data. It saves a private
before/after review under `$HOME/.local/state/battledb/runs/<UTC timestamp>/`.
Review `changes.json`, `proposed.json`, `rejected.json`, and `summary.json`.
Private `before.json` retains generated rows and the two Sheet snapshots.

After reviewing a historical repair, add `--apply --historical`. This marks
only newly appended Sheet rows as `skipped historical backfill`; existing
`Processed` values and curator fields remain untouched. No CLI ingestion
command invokes Telegram, webhooks, or healthchecks. Routine scheduled runs
use `--apply` without `--historical`, allowing genuinely new rows to notify.

## Collection and recovery

Every run scans all pages of the configured uploads and curated playlists.
Video details supply publication dates; playlist insertion dates are ignored.
Identity is the video ID, including when two battles have identical metadata.
Optional missing fields preserve known data. Missing/private videos remain in
the primary CSV with `Availability=unavailable`. Supporting videos carry an
explicit `Content category`; rankings include only battles. Uncertain new
parses go to the private rejected-record journal for inspection.

Transient YouTube requests retry at most four times; exhausted/permanent
failures abort. Both Sheet schemas are checked before mutation. Reconciliation
uses header-based RAW writes and video IDs. Existing differing nonempty
metadata is preserved and reported as conflicts; new-layout Event, Location,
Stadt, and Processed are never overwritten. A second snapshot detects changes
before writing. Human edits during the final API call cannot be locked by the
Sheets API, so avoid sorting/editing while a repair is running.

An interrupted write leaves `pending.json` with the original baseline and
historical flag. Rerunning reads fresh Sheet IDs and does not blindly repeat
an append. An acknowledged append with a lost response therefore reconciles
without duplicating rows. A metadata change during recovery can conservatively
appear as a curator conflict; inspect that conflict rather than forcing it.

CSV files and history are written atomically after metadata and Views are
synchronized, with `info.yml` last. Each file is atomic individually; Git
publishes the full set together. A filesystem failure can leave local files
from different generations until recovery. `last-success.json` advances only
after all exports succeed. Run journals and backups are private and are not
staged for publication.

## Cron wrappers

`update-git-upload-v3.sh` obtains a process lock over pull, ingestion, commit,
and push. It stops on failure, uses fast-forward pulls, and retries an outstanding
push even when there is no new commit. `run-update.sh` captures stderr and
pipeline failures, invokes the existing notification trigger once, then reports
success to the healthcheck. Notification triggers have no automatic retry.

The unchanged private `$HOME/.config/battledb/cron.env` supplies the updater,
timestamp, log, healthcheck endpoints, and notification endpoint. Install the
versioned scripts to its existing configured paths after backing them up. Keep
the existing cron schedule. `BATTLEDB_REPO`, `BATTLEDB_GETDATA`, `BATTLEDB_STATE`,
and `BATTLEDB_PYTHON` are optional non-secret overrides.

## Validation and rollback

```sh
npm ci --ignore-scripts
npm test
python3 -m unittest discover -s tests
```

The legacy `test_updater.py` regressions run only where the preserved scripts
and their pandas/gspread dependencies exist; the replacement tests need no
Google credentials and use fake boundaries. LXC validation runs both sets.

Before production repair, preserve the live Git revision, published CSVs,
wrappers, and private Sheet snapshots. To roll back code, restore the backed-up
wrappers and revert the repair commit through Git. Restore data from the private
backup only after comparing current Sheet edits; never replace curator or
Processed cells wholesale. Historical rows already marked skipped must stay
skipped. The legacy patches in `patches/` are retained for reference, not applied
by the new scheduler.
