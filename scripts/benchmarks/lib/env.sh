#!/usr/bin/env bash
# Record the benchmark environment
set -u
OUT=${1:-/workspace/scripts/benchmarks/results/ENV.txt}
mkdir -p "$(dirname "$OUT")"
{
  echo "# AtlasForge benchmark environment"
  echo "captured: $(date -Iseconds)"
  echo
  echo "## host"
  echo "kernel: $(uname -sr)"
  echo "cpu: $(lscpu | awk -F: '/Model name/{gsub(/^ +/,"",$2);print $2; exit}')"
  echo "cores: $(nproc) logical"
  echo "mem: $(free -h | awk '/^Mem:/{print $2" total, "$7" available"}')"
  echo "disk(/workspace): $(df -h /workspace | awk 'NR==2{print $4" avail"}')"
  echo
  echo "## versions"
  echo "atlasforge: $(atlasforge --version 2>&1)"
  echo "python: $(python --version 2>&1)"
  echo "node: $(node --version)"
  echo "npm: $(npm --version)"
  echo "polars: $(python -c 'import polars;print(polars.__version__)' 2>&1)"
  echo "playwright: $(cd /workspace/scripts/benchmarks && node -e "console.log(require('playwright/package.json').version)" 2>&1)"
  echo "chromium: $(cd /workspace/scripts/benchmarks && node -e "console.log(require('playwright').chromium.executablePath())" 2>&1)"
  echo "autocannon: $(cd /workspace/scripts/benchmarks && node -e "console.log(require('autocannon/package.json').version)" 2>&1)"
  echo
  echo "## repo"
  echo "atlasforge commit: $(cd /workspace && git rev-parse --short HEAD) ($(cd /workspace && git log -1 --format=%ci))"
  echo
  echo "## dataset (data/app)"
  echo "genes: $(python -c "import polars;print(polars.read_parquet('/workspace/data/app/genes.parquet').height)" 2>&1)"
  du -sh /workspace/data/app 2>/dev/null | awk '{print "app total: "$1}'
  du -sh /workspace/data/app/browser/coverage /workspace/data/app/browser/gwas /workspace/data/app/browser/models.bb /workspace/data/app/structure/models 2>/dev/null \
    | awk '{print "  "$2": "$1}'
} > "$OUT"
cat "$OUT"
