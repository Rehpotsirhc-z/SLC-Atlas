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
