#!/usr/bin/env bash
# Time each AtlasForge build step in a scratch data directory
set -eu
REPO=/workspace
SCRATCH=${SCRATCH:-/workspace/.bench-build}
OUT=$REPO/scripts/benchmarks/results/buildtime.jsonl
TIMEIT=$REPO/scripts/benchmarks/lib/timeit.sh

rm -rf "$SCRATCH"
mkdir -p "$SCRATCH/app" "$SCRATCH/cache"
ln -s "$REPO/data/source" "$SCRATCH/source"
ln -s "$REPO/data/curation" "$SCRATCH/curation"

echo "[build_steps] scratch data-dir: $SCRATCH" >&2
for step in gene_tables expression conservation clustering structure browser; do
  ATLASFORGE_NO_PROGRESS=1 bash "$TIMEIT" "build_step:$step" "$OUT" -- \
    atlasforge build --data-dir "$SCRATCH" --step "$step" || echo "[build_steps] $step exited nonzero" >&2
done

echo "[build_steps] built app size:" >&2
du -sh "$SCRATCH/app" >&2
du -sh "$SCRATCH/app"/* "$SCRATCH/app"/browser/* "$SCRATCH/app"/structure/* 2>/dev/null \
  | sort -h > "$REPO/scripts/benchmarks/results/build_app_sizes.txt"
echo "[build_steps] done" >&2
