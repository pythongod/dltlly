# BattleDB Telegram notifications

The 2026-10-08 repair fixes a partially delivered batch being resent on every
trigger. The Telegram node defaulted to Markdown; an underscore in a video URL
caused the fourth message to fail. Processing markers were on a separate branch
that never ran after that failure.

`repair_notifications.py` transforms a private export of the existing workflow:

- Escape imported text for explicit HTML formatting.
- Loop through one row at a time: send, write its `Processed` timestamp by video
  ID, then advance. Retry the marker write, not the send.
- Preserve the original ID through Telegram's response using n8n item linking.
- Remove the 12-hour timer, empty-run notifications, and the extra marker write
  that incorrectly matched row numbers across different worksheets.
- Retain the existing cron webhook and its subworkflow entry point.

Run the transformer with private paths outside the repository:

```
python3 ops/n8n/repair_notifications.py original.json fixed.json
python3 tests/test_notification_workflow.py
```

The transformed export is inactive until explicitly published. Keep credentials,
chat identifiers, workflow exports, and database/Sheet backups outside Git.

Deployment on 2026-10-08 backed up the n8n database and Sheet, then marked the
399 existing pending rows as **skipped historical backlog**, not delivered. Their
other columns were unchanged. Future appended rows retain blank `Processed`
values and are eligible for notification. No test messages were sent.

Validation included the installed n8n engine in a separate temporary database,
with external-service nodes replaced by local mocks. Successful items were
marked in order; an injected third-message failure left the first two marked
and the failed item unmarked. The live published graph matches the tested one.

Telegram sending and Sheet acknowledgement are separate API calls. A persistent
Sheet write failure after Telegram accepts a message can still leave that one
message eligible for retry; inspect the execution before replaying such a run.
