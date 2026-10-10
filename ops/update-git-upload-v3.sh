#!/usr/bin/env bash
set -euo pipefail

cd "${BATTLEDB_REPO:-$HOME/git/dltlly}"
python=${BATTLEDB_PYTHON:-$HOME/.local/share/battledb/venv/bin/python}
[[ -x "$python" ]] || python=python3
if [[ ${1:-} != --locked ]]; then
    exec "$python" -m ops.ingestion.storage "${BATTLEDB_STATE:-$HOME/.local/state/battledb}/job.lock" bash "$0" --locked
fi

git pull --ff-only
"$python" -m ops.ingestion.run --apply --job-lock-held --repo "$PWD" \
    --legacy "${BATTLEDB_GETDATA:-$HOME/dltlly/getdata}" \
    --state "${BATTLEDB_STATE:-$HOME/.local/state/battledb}"
git add -- data info.yml
if ! git diff --cached --quiet; then
    git commit -m 'Update battle data and timestamps'
fi
git push
