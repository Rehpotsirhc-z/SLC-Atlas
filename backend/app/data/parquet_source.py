# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
import polars as pl

from .newick import adjacency_to_newick


class ParquetSource:
    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir

    def _scan(self, filename: str) -> pl.LazyFrame:
        path = self._dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Data file not found: {path}")
        return pl.scan_parquet(path)

    def get_genes(self) -> pl.DataFrame:
        return self._scan("genes.parquet").collect()

    def get_transcripts(self, gene_id: str) -> pl.DataFrame:
        return self._scan("transcripts.parquet").filter(pl.col("gene_id") == gene_id).collect()

    def get_expression(self, gene_id: str | None = None, tissue_scope: str = "all") -> pl.DataFrame:
        lf = self._scan("expression.parquet").filter(pl.col("tissue_scope") == tissue_scope)
        if gene_id:
            lf = lf.filter(pl.col("gene_id") == gene_id)
        return lf.collect()

    def get_conservation(self, gene_ids: list[str] | None = None) -> pl.DataFrame:
        lf = self._scan("conservation.parquet")
        if gene_ids:
            lf = lf.filter(pl.col("gene_id").is_in(gene_ids))
        return lf.collect()

    def get_species_tree(self) -> pl.DataFrame:
        return self._scan("species_tree.parquet").collect()

    def get_species_tree_newick(self) -> str:
        """Reconstruct Newick from the species-tree adjacency rows."""
        return adjacency_to_newick(
            self.get_species_tree(), ("species_label", "species"), include_root_branch=True
        )

    def get_clustering(self, method: str = "aa_sequence") -> pl.DataFrame:
        return self._scan("clustering.parquet").filter(pl.col("method") == method).collect()

    def get_clustering_newick(self, method: str = "aa_sequence") -> str:
        """Reconstruct Newick from the clustering adjacency rows."""
        return adjacency_to_newick(
            self.get_clustering(method=method), ("symbol", "gene_id"), include_root_branch=False
        )
