# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
import polars as pl

from .newick import adjacency_to_newick

GENES_FILE = "genes.parquet"
TRANSCRIPTS_FILE = "transcripts.parquet"
EXPRESSION_FILE = "expression.parquet"
CLUSTERING_FILE = "clustering.parquet"
CONSERVATION_FILE = "conservation.parquet"
SPECIES_TREE_FILE = "species_tree.parquet"
APP_SOURCES_FILE = "sources.parquet"

SOURCE_COLUMNS = (
    "domain",
    "source",
    "version",
    "assembly",
    "retrieved_date",
    "citation",
    "license_spdx",
    "url",
)

STRUCTURE_FILE = "structure/structure.parquet"
FEATURES_FILE = "structure/features.parquet"
EXPERIMENTAL_FILE = "structure/experimental.parquet"

MODELS_FILE = "browser/models.bb"
WINDOWS_FILE = "browser/windows.parquet"
BROWSER_GENES_FILE = "browser/genes.parquet"
TRACKS_FILE = "browser/tracks.parquet"
CHROMS_FILE = "browser/chroms.parquet"
GWAS_DIR = "browser/gwas"
STUDIES_FILE = "browser/studies.parquet"
BROWSER_SOURCES_FILE = "browser/sources.parquet"

CAPABILITY_FILES: dict[str, tuple[str, ...]] = {
    "expression": (EXPRESSION_FILE,),
    "clustering": (CLUSTERING_FILE,),
    "conservation": (CONSERVATION_FILE, SPECIES_TREE_FILE),
    "structure": (STRUCTURE_FILE, FEATURES_FILE, EXPERIMENTAL_FILE),
    "browser": (
        MODELS_FILE,
        WINDOWS_FILE,
        BROWSER_GENES_FILE,
        TRACKS_FILE,
        CHROMS_FILE,
        STUDIES_FILE,
        BROWSER_SOURCES_FILE,
    ),
}

# These run to megabytes across a family and are only ever read one gene at a time
PER_RESIDUE_COLUMNS = ("plddt", "sequence")

MEMBRANE_FEATURES = ("transmembrane", "intramembrane")
DRAWN_FEATURES = (
    "binding_site",
    "active_site",
    "glycosylation",
    "disulfide_bond",
    "signal_peptide",
)
SPAN_LIST = pl.List(pl.Struct({"start": pl.Int64, "end": pl.Int64, "kind": pl.String}))


def _spans(features: pl.LazyFrame, kinds: tuple[str, ...], name: str) -> pl.LazyFrame:
    """Collect the features of the given kinds into one list per gene, in sequence order."""
    return (
        features.filter(pl.col("feature_type").is_in(kinds))
        .sort("gene_id", "start")
        .group_by("gene_id", maintain_order=True)
        .agg(pl.struct(start="start", end="end", kind="feature_type").alias(name))
    )


class ParquetSource:
    def __init__(self, app_dir: Path) -> None:
        self._dir = app_dir

    def _scan(self, filename: str) -> pl.LazyFrame:
        path = self._dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Data file not found: {path}")
        return pl.scan_parquet(path)

    def _scan_optional(self, filename: str) -> pl.LazyFrame | None:
        """Return None when an optional view file was not built."""
        path = self._dir / filename
        return pl.scan_parquet(path) if path.exists() else None

    def has(self, filename: str) -> bool:
        return (self._dir / filename).exists()

    def model_path(self, filename: str) -> Path | None:
        path = (self._dir / "structure" / "models" / filename).resolve()
        models_dir = (self._dir / "structure" / "models").resolve()
        if models_dir not in path.parents or not path.is_file():
            return None
        return path

    def coverage_path(self, filename: str) -> Path | None:
        path = (self._dir / "browser" / "coverage" / filename).resolve()
        coverage_dir = (self._dir / "browser" / "coverage").resolve()
        if coverage_dir not in path.parents or not path.is_file():
            return None
        return path

    def get_genes(self) -> pl.DataFrame:
        return self._scan(GENES_FILE).collect()

    def get_transcripts(self, gene_id: str) -> pl.DataFrame:
        return self._scan(TRANSCRIPTS_FILE).filter(pl.col("gene_id") == gene_id).collect()

    def get_expression(
        self, gene_id: str | None = None, tissue_scope: str = "all"
    ) -> pl.DataFrame | None:
        lf = self._scan_optional(EXPRESSION_FILE)
        if lf is None:
            return None
        lf = lf.filter(pl.col("tissue_scope") == tissue_scope)
        if gene_id:
            lf = lf.filter(pl.col("gene_id") == gene_id)
        return lf.collect()

    def get_conservation(self, gene_ids: list[str] | None = None) -> pl.DataFrame | None:
        lf = self._scan_optional(CONSERVATION_FILE)
        if lf is None:
            return None
        if gene_ids:
            lf = lf.filter(pl.col("gene_id").is_in(gene_ids))
        return lf.collect()

    def get_species_tree(self) -> pl.DataFrame | None:
        lf = self._scan_optional(SPECIES_TREE_FILE)
        return lf.collect() if lf is not None else None

    def get_species_tree_newick(self) -> str | None:
        """Build the Newick form of the species tree back up from its rows."""
        tree = self.get_species_tree()
        if tree is None:
            return None
        return adjacency_to_newick(tree, ("species_label", "species"), include_root_branch=True)

    def get_clustering(self, method: str = "aa_sequence") -> pl.DataFrame | None:
        lf = self._scan_optional(CLUSTERING_FILE)
        if lf is None:
            return None
        return lf.filter(pl.col("method") == method).collect()

    def get_clustering_newick(self, method: str = "aa_sequence") -> str | None:
        """Build the Newick form of the clustering tree back up from its rows."""
        clustering = self.get_clustering(method=method)
        if clustering is None:
            return None
        return adjacency_to_newick(clustering, ("symbol", "gene_id"), include_root_branch=False)

    def _scan_by_gene(self, filename: str, gene_id: str | None) -> pl.DataFrame | None:
        lf = self._scan_optional(filename)
        if lf is None:
            return None
        if gene_id:
            lf = lf.filter(pl.col("gene_id") == gene_id)
        return lf.collect()

    def get_structure(self, gene_id: str | None = None) -> pl.DataFrame | None:
        df = self._scan_by_gene(STRUCTURE_FILE, gene_id)
        if df is not None and gene_id is None:
            return df.drop(c for c in PER_RESIDUE_COLUMNS if c in df.columns)
        return df

    def get_protein_features(self, gene_id: str | None = None) -> pl.DataFrame | None:
        return self._scan_by_gene(FEATURES_FILE, gene_id)

    def get_topology(self) -> pl.DataFrame | None:
        features = self._scan_optional(FEATURES_FILE)
        structure = self._scan_optional(STRUCTURE_FILE)
        if features is None or structure is None:
            return None
        return (
            structure.select("gene_id", "uniprot_length")
            .join(_spans(features, MEMBRANE_FEATURES, "segments"), on="gene_id", how="left")
            .join(_spans(features, DRAWN_FEATURES, "features"), on="gene_id", how="left")
            .with_columns(
                pl.col("segments", "features").fill_null(pl.lit([], dtype=SPAN_LIST)),
            )
            .collect()
        )

    def get_experimental_structures(self, gene_id: str | None = None) -> pl.DataFrame | None:
        return self._scan_by_gene(EXPERIMENTAL_FILE, gene_id)

    def get_all_sources(self) -> pl.DataFrame | None:
        """Return provenance records for every available dataset."""
        parts = []
        core = self._scan_optional(APP_SOURCES_FILE)
        if core is not None:
            parts.append(core.collect())
        # GWAS citations live in the track manifest, so omit incomplete records here
        browser = self.get_browser_sources()
        if browser is not None and "kind" in browser.columns:
            browser = browser.filter(pl.col("kind") != "gwas")
        if browser is not None and not browser.is_empty():
            parts.append(browser.with_columns(pl.lit("browser").alias("domain")))
        if not parts:
            return None
        columns = list(SOURCE_COLUMNS)
        normalized = []
        for part in parts:
            missing = [pl.lit(None, pl.String).alias(c) for c in columns if c not in part.columns]
            normalized.append((part.with_columns(missing) if missing else part).select(columns))
        merged = pl.concat(normalized)
        return merged.with_columns(
            pl.when(pl.col(c).str.len_chars() == 0).then(None).otherwise(pl.col(c)).alias(c)
            for c in columns
        )

    def get_track_manifest(self) -> dict | None:
        """Everything the browser needs before it draws anything: the tracks it may read,
        the studies it may plot, and how long each chromosome is."""
        tracks = self._scan_optional(TRACKS_FILE)
        chroms = self._scan_optional(CHROMS_FILE)
        if tracks is None or chroms is None:
            return None
        studies = self._scan_optional(STUDIES_FILE)
        return {
            "tracks": tracks.collect().to_dicts(),
            "studies": studies.collect().to_dicts() if studies is not None else [],
            "chroms": chroms.filter(pl.col("role") == "primary").collect().to_dicts(),
        }

    def get_region(self, gene_id: str) -> dict | None:
        """Return a gene's location and the region available for browsing."""
        windows = self._scan_optional(WINDOWS_FILE)
        if windows is None or not self.has(MODELS_FILE):
            return None
        window = windows.filter(pl.col("gene_id") == gene_id).collect()
        return window.to_dicts()[0] if not window.is_empty() else None

    def get_browser_genes(self) -> list[dict] | None:
        """Return every gene available to the browser."""
        lf = self._scan_optional(BROWSER_GENES_FILE)
        return lf.collect().to_dicts() if lf is not None else None

    def models_path(self) -> Path | None:
        path = self._dir / MODELS_FILE
        return path if path.is_file() else None

    def gwas_path(self, study_id: str) -> Path | None:
        directory = (self._dir / GWAS_DIR).resolve()
        path = (directory / f"{study_id}.bb").resolve()
        if directory not in path.parents or not path.is_file():
            return None
        return path

    def get_browser_sources(self) -> pl.DataFrame | None:
        lf = self._scan_optional(BROWSER_SOURCES_FILE)
        return lf.collect() if lf is not None else None

    def capabilities(self) -> dict[str, bool]:
        return {view: all(self.has(f) for f in files) for view, files in CAPABILITY_FILES.items()}
