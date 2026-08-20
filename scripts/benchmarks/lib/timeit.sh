#!/usr/bin/env bash
# Record the execution time and exit status of a command
set -u
label="$1"; out="$2"; shift 2
[ "$1" = "--" ] && shift
mkdir -p "$(dirname "$out")"
start_epoch=$(date +%s.%N)
start_iso=$(date -Iseconds)
"$@"
code=$?
end_epoch=$(date +%s.%N)
end_iso=$(date -Iseconds)
wall=$(awk "BEGIN{printf \"%.3f\", $end_epoch - $start_epoch}")
printf '{"label":"%s","start":"%s","end":"%s","wall_seconds":%s,"exit_code":%d,"cmd":"%s"}\n' \
  "$label" "$start_iso" "$end_iso" "$wall" "$code" "$(printf '%s ' "$@" | sed 's/"/\\"/g; s/ $//')" >> "$out"
echo "[timeit] $label: ${wall}s (exit $code)" >&2
exit $code
