# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
import polars as pl

_EXPRESSION_FILES = {
    "rna": "expression_rna.parquet",
    "protein": "expression_protein.parquet",
}


class ParquetSource:
    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir

    def _scan(self, filename: str) -> pl.LazyFrame:
        path = self._dir / filename
        if not path.exists():
            return pl.LazyFrame()
        return pl.scan_parquet(path)

    def get_genes(self, search: str | None = None) -> pl.DataFrame:
        lf = self._scan("genes.parquet")
        if search:
            lf = lf.filter(
                pl.col("symbol").str.contains(search, literal=False)
                | pl.col("name").str.contains(search, literal=False)
            )
        return lf.collect()

    def get_transcripts(self, gene_id: str) -> pl.DataFrame:
        return self._scan("transcripts.parquet").filter(pl.col("gene_id") == gene_id).collect()

    def get_expression(self, gene_id: str | None = None, modality: str = "rna") -> pl.DataFrame:
        filename = _EXPRESSION_FILES.get(modality, "expression_rna.parquet")
        lf = self._scan(filename)
        if gene_id:
            lf = lf.filter(pl.col("gene_id") == gene_id)
        return lf.collect()

    def get_conservation(self, gene_ids: list[str] | None = None) -> pl.DataFrame:
        lf = self._scan("conservation.parquet")
        if gene_ids:
            lf = lf.filter(pl.col("gene_id").is_in(gene_ids))
        return lf.collect()

    def get_clustering(self, method: str = "aa_sequence") -> pl.DataFrame:
        return self._scan("clustering.parquet").filter(pl.col("method") == method).collect()

    def get_clustering_newick(self, method: str = "aa_sequence") -> str:
        """Reconstruct a Newick tree from the clustering adjacency rows, labeling
        leaves with their gene symbol (falling back to the Ensembl gene id)."""
        df = self.get_clustering(method=method)
        if df.is_empty():
            return ""

        children: dict[int, list[int]] = {}
        label: dict[int, str] = {}
        length: dict[int, float] = {}
        root: int | None = None
        for row in df.iter_rows(named=True):
            nid = row["node_id"]
            length[nid] = row["branch_length"] or 0.0
            label[nid] = row["symbol"] or row["gene_id"] or ""
            pid = row["parent_id"]
            if pid is None:
                root = nid
            else:
                children.setdefault(pid, []).append(nid)

        if root is None:
            return ""

        def emit(nid: int) -> str:
            kids = children.get(nid)
            if not kids:
                return f"{label[nid]}:{length[nid]:.5f}"
            return "(" + ",".join(emit(k) for k in kids) + f"):{length[nid]:.5f}"

        return "(" + ",".join(emit(k) for k in children.get(root, [])) + ");\n"
