# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the served structure Parquet from dataset/structure/.

The whole view is optional: with no dataset/structure/ directory this writes nothing and
exits cleanly, and the API then reports the structure capability as unavailable.

Sources with different licences stay in separate files so a redistributor can drop one
without re-encumbering the rest.
"""

import shutil
import sys
from datetime import date, datetime
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.reporting import report_missing

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
DATASET_DIR = DATA_DIR / "dataset" / "structure"
OUT_DIR = DATA_DIR / "structure"

SOURCES = [
    ("AlphaFold DB", "structures.tsv", "CC-BY-4.0", "https://alphafold.ebi.ac.uk"),
    ("UniProt", "features.tsv", "CC-BY-4.0", "https://www.uniprot.org"),
    ("PDBe (via 3D-Beacons)", "experimental.tsv", "CC0-1.0",
     "https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons"),
]

# The feature_type vocabulary the served figure knows how to read
FEATURE_TYPES = {
    "transmembrane",
    "intramembrane",
    "topological_domain",
    "binding_site",
    "active_site",
    "glycosylation",
    "disulfide_bond",
    "signal_peptide",
}

FEATURE_SCHEMA = {
    "gene_id": pl.Utf8,
    "uniprot_accession": pl.Utf8,
    "feature_type": pl.Utf8,
    "start": pl.Int64,
    "end": pl.Int64,
    "description": pl.Utf8,
    "ligand_name": pl.Utf8,
    "ligand_chebi": pl.Utf8,
    "ligand_label": pl.Int64,
}

EXPERIMENTAL_SCHEMA = {
    "gene_id": pl.Utf8,
    "uniprot_accession": pl.Utf8,
    "pdb_id": pl.Utf8,
    "method": pl.Utf8,
    "resolution": pl.Float64,
    "coverage": pl.Float64,
    "uniprot_start": pl.Int64,
    "uniprot_end": pl.Int64,
    "chains": pl.Utf8,
    "ligand_ccd": pl.Utf8,
    "model_url": pl.Utf8,
    "model_page_url": pl.Utf8,
    "created": pl.Utf8,
}

SOURCES_SCHEMA = {
    "source": pl.Utf8,
    "version": pl.Utf8,
    "retrieved_date": pl.Utf8,
    "license_spdx": pl.Utf8,
    "url": pl.Utf8,
}


def read_tsv(name: str, schema: dict | None = None) -> pl.DataFrame:
    path = DATASET_DIR / name
    if not path.exists():
        return pl.DataFrame(schema=schema) if schema else pl.DataFrame()
    return pl.read_csv(path, separator="\t", schema=schema, infer_schema_length=10000)


def read_confidence() -> pl.DataFrame:
    path = DATASET_DIR / "confidence.parquet"
    if not path.exists():
        return pl.DataFrame(schema={"gene_id": pl.Utf8, "plddt": pl.List(pl.UInt8)})
    return pl.read_parquet(path).select("gene_id", "plddt")


def feature_counts(features: pl.DataFrame) -> pl.DataFrame:
    """A site is one pocket, coordinated by several residues that are often far apart in
    sequence, so counting annotation rows would report residues rather than sites."""
    sites = features.filter(pl.col("feature_type").is_in(["binding_site", "active_site"]))
    return (
        features.group_by("gene_id")
        .agg(
            n_transmembrane=(pl.col("feature_type") == "transmembrane").sum(),
            n_intramembrane=(pl.col("feature_type") == "intramembrane").sum(),
        )
        .join(
            sites.group_by("gene_id").agg(
                n_binding_sites=pl.struct("ligand_name", "ligand_label").n_unique(),
                # A binding feature can cover a range, so rows undercount the residues
                n_binding_residues=(pl.col("end") - pl.col("start") + 1).sum(),
            ),
            on="gene_id",
            how="left",
        )
    )


def experimental_entries(experimental: pl.DataFrame) -> pl.DataFrame:
    """One row per PDB entry. 3D-Beacons reports a summary per contiguous observed segment,
    so an entry modelled in 33 pieces arrives as 33 rows carrying the same metadata; the
    residue span collapses to the range they cover and `coverage` still says how much of it
    was resolved."""
    return (
        experimental.group_by("gene_id", "pdb_id", maintain_order=True)
        .agg(
            pl.col(
                "uniprot_accession",
                "method",
                "resolution",
                "coverage",
                "chains",
                "ligand_ccd",
                "model_url",
                "model_page_url",
                "created",
            ).first(),
            uniprot_start=pl.col("uniprot_start").min(),
            uniprot_end=pl.col("uniprot_end").max(),
        )
        .select(experimental.columns)
    )


def experimental_summary(experimental: pl.DataFrame) -> pl.DataFrame:
    """Per gene: how many entries, and the best-resolved one to open by default."""
    return (
        experimental.sort("resolution", nulls_last=True)
        .group_by("gene_id")
        .agg(
            n_experimental=pl.len(),
            best_pdb_id=pl.col("pdb_id").first(),
            best_method=pl.col("method").first(),
            best_resolution=pl.col("resolution").first(),
        )
    )


def build_structure(
    models_dir: Path, features: pl.DataFrame, experimental: pl.DataFrame
) -> pl.DataFrame:
    gene_map = read_tsv("uniprot_map.tsv")
    structures = read_tsv("structures.tsv").drop("gene_id")

    df = (
        gene_map.join(structures, on="uniprot_accession", how="left")
        .join(feature_counts(features), on="gene_id", how="left")
        .join(experimental_summary(experimental), on="gene_id", how="left")
        .join(read_confidence(), on="gene_id", how="left")
        .with_columns(
            pl.col(
                "n_transmembrane",
                "n_intramembrane",
                "n_binding_sites",
                "n_binding_residues",
                "n_experimental",
            ).fill_null(0),
            model_file=pl.col("uniprot_accession")
            + pl.when(pl.col("model_format") == "BCIF")
            .then(pl.lit(".bcif"))
            .otherwise(pl.lit(".cif")),
        )
        .rename({"model_url": "model_source_url"})
    )
    present = {p.name for p in models_dir.glob("*.*cif")}
    return drop_misaligned_confidence(
        df.with_columns(pl.col("model_file").is_in(present).alias("model_available"))
    )


def drop_misaligned_confidence(df: pl.DataFrame) -> pl.DataFrame:
    """AlphaFold indexes pLDDT by its own model sequence, which for a stale entry is not the
    UniProt canonical the features are numbered against. There is no way to align the two, so
    the figure gets no confidence lane rather than a stretched one."""
    misaligned = pl.col("plddt").list.len() != pl.col("uniprot_length")
    report_missing(
        "gene(s) whose pLDDT length disagrees with uniprot_length; confidence dropped",
        df.filter(pl.col("plddt").is_not_null() & misaligned)
        .select(
            pl.format(
                "{} {}: {} scores for {} residues",
                "symbol",
                "uniprot_accession",
                pl.col("plddt").list.len(),
                "uniprot_length",
            )
        )
        .to_series()
        .to_list(),
    )
    return df.with_columns(
        plddt=pl.when(misaligned).then(None).otherwise(pl.col("plddt")),
    )


def build_sources(structures: pl.DataFrame) -> pl.DataFrame:
    versions = structures["afdb_version"].drop_nulls().unique().to_list()
    afdb_version = f"v{versions[0]}" if len(versions) == 1 else None
    rows = []
    for source, filename, license_spdx, url in SOURCES:
        path = DATASET_DIR / filename
        rows.append({
            "source": source,
            "version": afdb_version if source.startswith("AlphaFold") else None,
            "retrieved_date": (
                datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
                if path.exists()
                else date.today().isoformat()
            ),
            "license_spdx": license_spdx,
            "url": url,
        })
    return pl.DataFrame(rows, schema=SOURCES_SCHEMA)


def copy_models(source_dir: Path, target_dir: Path) -> tuple[int, int]:
    if not source_dir.exists():
        return 0, 0
    target_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for model in source_dir.glob("*.*cif"):
        target = target_dir / model.name
        if target.exists() and target.stat().st_size == model.stat().st_size:
            continue
        shutil.copy2(model, target)
        copied += 1
    return copied, len(list(target_dir.glob("*.*cif")))


def main() -> None:
    if not DATASET_DIR.exists():
        print(f"no {DATASET_DIR}; skipping the structure view", file=sys.stderr)
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    models_dir = OUT_DIR / "models"
    copied, total_models = copy_models(DATASET_DIR / "models", models_dir)

    features = read_tsv("features.tsv", FEATURE_SCHEMA)
    report_missing(
        "unknown feature_type value(s) in features.tsv; the figure will ignore them",
        sorted(set(features["feature_type"].drop_nulls()) - FEATURE_TYPES),
    )
    experimental = experimental_entries(read_tsv("experimental.tsv", EXPERIMENTAL_SCHEMA))

    structure = build_structure(models_dir, features, experimental)
    structure.write_parquet(OUT_DIR / "structure.parquet")
    features.write_parquet(OUT_DIR / "features.parquet")
    experimental.write_parquet(OUT_DIR / "experimental.parquet")
    build_sources(structure).write_parquet(OUT_DIR / "sources.parquet")

    n_models = int(structure["model_available"].sum())
    n_experimental = int((structure["n_experimental"] > 0).sum())
    print(f"wrote {structure.height} genes ({n_models} with a model, "
          f"{n_experimental} with experimental structures) -> {OUT_DIR}", file=sys.stderr)
    print(f"{total_models} model files in {models_dir} ({copied} copied)", file=sys.stderr)


if __name__ == "__main__":
    main()
