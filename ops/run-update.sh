#!/usr/bin/env bash
set -euo pipefail

# Endpoints stay in a private file on the LXC, outside the published repository.
source "${BATTLEDB_CRON_CONFIG:-$HOME/.config/battledb/cron.env}"

: "${BATTLEDB_UPDATER:?}" "${BATTLEDB_TIMESTAMP:?}" "${BATTLEDB_LOG:?}"
: "${BATTLEDB_HEALTHCHECK_WEEKDAY:?}" "${BATTLEDB_HEALTHCHECK_SUNDAY:?}" "${BATTLEDB_NOTIFY_URL:?}"

"$BATTLEDB_UPDATER" 2>&1 | "$BATTLEDB_TIMESTAMP" >> "$BATTLEDB_LOG"

if [[ $(date +%u) == 7 ]]; then
    healthcheck_url=$BATTLEDB_HEALTHCHECK_SUNDAY
else
    healthcheck_url=$BATTLEDB_HEALTHCHECK_WEEKDAY
fi
# Trigger once: a lost response must not blindly resend an external action.
curl -fsS -m 10 -o /dev/null "$BATTLEDB_NOTIFY_URL"
curl -fsS -m 10 --retry 5 -o /dev/null "$healthcheck_url"
