#!/usr/bin/env bash
# Sweeps VAD parameters through the REAL src/config.ts + src/audio/vad.ts and records
# the `ours` aggregate for each setting. Restores config.ts on exit.
set -e
cd "$(dirname "$0")/.."
CFG=src/config.ts
cp "$CFG" "$CFG.bak"
trap 'mv "$CFG.bak" "$CFG"' EXIT

setcfg() { # onset offset hold
  sed -i '' -E "s/(VAD_ONSET_MARGIN_DB = )[0-9.]+/\1$1/" "$CFG"
  sed -i '' -E "s/(VAD_OFFSET_MARGIN_DB = )[0-9.]+/\1$2/" "$CFG"
  sed -i '' -E "s/(VAD_HOLD_MS = )[0-9.]+/\1$3/" "$CFG"
}
runone() { # label onset offset hold
  setcfg "$2" "$3" "$4"
  npx --yes tsx benchmark/run.ts >/dev/null 2>&1
  printf "%s\t" "$1"; node benchmark/agg.mjs | head -1   # ours line
}

echo "# label(onset/offset/hold)  side  FA  MO  flick  lat_ms  acc%"
echo "## Onset-margin sweep (offset=4, hold=600):"
runone "onset+3 " 3 4 600
runone "onset+6 " 6 4 600
runone "onset+9*" 9 4 600
runone "onset+12" 12 4 600
echo "## Hold sweep (onset=9, offset=4):"
runone "hold0   " 9 4 0
runone "hold200 " 9 4 200
runone "hold600*" 9 4 600
runone "hold1000" 9 4 1000
echo "## Hysteresis sweep (onset=9, hold=600); offset=9 means NO hysteresis:"
runone "gap0(off9)" 9 9 600
runone "gap3(off6)" 9 6 600
runone "gap5(off4)*" 9 4 600
