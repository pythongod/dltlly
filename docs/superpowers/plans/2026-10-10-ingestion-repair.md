# Ingestion repair implementation plan

**Goal:** Implement the approved Python audit repair sequence and deploy it on the LXC, keeping existing secrets in place.

**Architecture:** Import-safe Python modules collect canonical structured YouTube records, merge by video ID, reconcile both Sheets, and publish atomic CSV exports only after synchronization. A private run journal and backups support recovery. Every collection scans complete source playlists, avoiding fragile date cutoffs and limited upload windows.

**Tech stack:** Python 3.12, Google API client, gspread, standard-library CSV/JSON/locking, existing Bash cron wrappers and JavaScript consumers.

**Spec:** The approved recommended repair sequence in `audits/2026-10-10-python-ingestion/report.md` in the original checkout.

## Constraints

- Leave legacy embedded API keys, private configuration, and service-account JSON in place. Read literal configuration through AST without executing legacy scripts.
- Preserve every existing ID, curated Sheet fields, and existing Processed markers.
- Mark newly recovered historical rows as skipped; do not invoke notification endpoints during deployment or backfill.
- Never publish private settings, credentials, backups, or API exceptions containing request URLs.

## Tasks

- [ ] Parser: add `ops/ingestion/records.py` and fixture tests for title boundaries, entities, years, categories, invalid IDs, empty batches, and ID-preserving merge.
- [ ] Collector: add `ops/ingestion/collector.py` and tests for complete pagination, retries, canonical publication dates, missing optional fields, and later-batch failures.
- [ ] Sheets: add `ops/ingestion/sheets.py` and tests for header mapping, RAW writes, curated fields, existing notification markers, and resumable reconciliation.
- [ ] Runner: add literal settings reader, atomic storage, file locking, private before/after journal, dry-run and apply CLI, pinned dependencies, and integration tests showing failures cannot publish success.
- [ ] Cron: run the versioned replacement under a job lock, avoid retrying notification triggers, and report success only after required steps succeed.
- [ ] Consumers: parse quoted CSV and use explicit content categories for rankings while retaining existing display columns.
- [ ] Validate locally; run a read-only full-source LXC dry run; inspect the concrete data diff and curate any parser anomalies before applying.
- [ ] Back up live data and Sheets privately; apply historical repair without notifications; verify exports, markers, source secret hashes, and second-run reconciliation.
- [ ] Save and publish versioned repair, switch scheduled runner, document rollback and remaining conflicts.

## Review focus

Tests cover an acknowledged append followed by lost response; partial destination failure before publication; an empty accepted batch; preserved nonempty curator edits; and multiple videos with identical visible metadata. Full-source dry-run diff review checks patterns that synthetic fixtures cannot establish.
