"""Create a chromosome-size file for the browser benchmarks."""

import polars as pl, sys

app = sys.argv[1] if len(sys.argv) > 1 else "/workspace/.bench-build/app"
out = sys.argv[2] if len(sys.argv) > 2 else "/workspace/scripts/benchmarks/browser/hg38.chrom.sizes"
c = pl.read_parquet(f"{app}/browser/chroms.parquet")
# Match the chromosome names used by the bigWig files
name_col = "chrom" if "chrom" in c.columns else c.columns[0]
size_col = next(x for x in ("size", "chrom_size", "length") if x in c.columns)
rows = c.select([name_col, size_col]).sort(size_col, descending=True)
with open(out, "w") as fh:
    for name, size in rows.iter_rows():
        fh.write(f"{name}\t{size}\n")
print(f"wrote {out}: {rows.height} chromosomes; cols used: {name_col},{size_col}")
print(rows.head(5))
