#!/usr/bin/env bash
# Run the full v0 pipeline end-to-end.
# Each stage is idempotent; safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"
GAP_TOLERANCE_MINUTES="${GAP_TOLERANCE_MINUTES:-45}"
if [[ -z "${PYTHON_BIN:-}" ]]; then
  if [[ -x "../.venv/bin/python" ]]; then
    PYTHON_BIN="../.venv/bin/python"
  else
    PYTHON_BIN="python3"
  fi
fi

echo "=== 01: ingest from Figshare ==="
"${PYTHON_BIN}" data/01_ingest.py

echo "=== 02: construct events (${GAP_TOLERANCE_MINUTES} min gap tolerance) ==="
"${PYTHON_BIN}" data/02_construct_events.py --gap-tolerance-minutes "${GAP_TOLERANCE_MINUTES}"

echo "=== 03: aggregate county summary ==="
"${PYTHON_BIN}" data/03_aggregate_county.py

echo "=== 04: filter (D-tiers) ==="
"${PYTHON_BIN}" filtration/04_filter.py

echo "=== 05: price grid ==="
"${PYTHON_BIN}" pricing/05_price.py

echo "=== done ==="
