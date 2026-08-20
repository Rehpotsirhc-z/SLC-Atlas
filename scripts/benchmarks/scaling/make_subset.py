"""Create a deterministic subset of the SLC source dataset."""

import os
import sys
import polars as pl

N = int(sys.argv[1])
SRC = "/workspace/data/source"
DEST = sys.argv[2]
dsrc = f"{DEST}/source"
os.makedirs(dsrc, exist_ok=True)
os.makedirs(f"{DEST}/app", exist_ok=True)
os.makedirs(f"{DEST}/cache", exist_ok=True)
if not os.path.lexists(f"{DEST}/curation"):
    os.symlink("/workspace/data/curation", f"{DEST}/curation")

genes = pl.read_csv(f"{SRC}/genes.tsv", separator="\t")
keep = genes.sort("symbol").head(N)
ids = set(keep["id"].to_list())
keep.write_csv(f"{dsrc}/genes.tsv", separator="\t")

tx = pl.read_csv(f"{SRC}/transcripts.tsv", separator="\t")
tx.filter(pl.col("gene_id").is_in(ids)).write_csv(f"{dsrc}/transcripts.tsv", separator="\t")

orth = pl.read_csv(f"{SRC}/orthologs.tsv", separator="\t")
orth.filter(pl.col("gene_id").is_in(ids)).write_csv(f"{dsrc}/orthologs.tsv", separator="\t")

expr = pl.read_parquet(f"{SRC}/expression.parquet")
expr.filter(pl.col("gene_id").is_in(ids)).write_parquet(f"{dsrc}/expression.parquet")

# Link unchanged inputs used by the measured views
for name in ("sample_tissue.tsv", "species_tree.nwk", "species.tsv", "sources.tsv"):
    dst = f"{dsrc}/{name}"
    if os.path.lexists(dst):
        os.remove(dst)
    if os.path.exists(f"{SRC}/{name}"):
        os.symlink(f"{SRC}/{name}", dst)

print(
    f"subset N={N}: {len(ids)} genes, {tx.filter(pl.col('gene_id').is_in(ids)).height} transcripts -> {DEST}"
)
