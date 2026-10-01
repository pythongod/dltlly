#!/usr/bin/env bash
set -euo pipefail

cd "${BATTLEDB_REPO:-$HOME/git/dltlly}"
getdata_dir=${BATTLEDB_GETDATA:-$HOME/dltlly/getdata}

git pull --ff-only
python3 "$getdata_dir/get_ytb_data_v4.py"
python3 "$getdata_dir/cleanup-v4.py"
python3 "$getdata_dir/updateviewcount_v3.py"
git add -- data info.yml
if ! git diff --cached --quiet; then
    git commit -m 'Update battle data and timestamps'
fi
git push
