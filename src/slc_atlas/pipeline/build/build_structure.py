# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the structure Parquet files that the app serves, from the files in
source/structure/.

The structure view is optional. When there is no source/structure/ directory this step
writes nothing and finishes without an error, and the API then tells the frontend that the
structure view is not available.

Each source is written to a file of its own so that the sources stay separate by licence,
which lets anyone who redistributes the dataset leave one of them out without the licence
of the others being affected.
"""

import sys
from datetime import date, datetime
from pathlib import Path

import polars as pl

from ..lib.reporting import count, report_missing
from ..lib.structures import rank_experimental
from .model_files import copy_models, stale_models

SOURCES = [
    ("AlphaFold DB", "structures.tsv", "CC-BY-4.0", "https://alphafold.ebi.ac.uk"),
    ("UniProt", "features.tsv", "CC-BY-4.0", "https://www.uniprot.org"),
    (
        "PDBe (via 3D-Beacons)",
        "experimental.tsv",
        "CC0-1.0",
        "https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons",
    ),
]

# The feature types the topology figure knows how to draw
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

# Both files are fetched rather than built from other source files, so one of them being
# absent means the structure source is incomplete rather than missing altogether. Giving
# the empty frame a schema lets the rest of the build join against it either way.
UNIPROT_MAP_SCHEMA = {
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "uniprot_accession": pl.Utf8,
    "uniprot_id": pl.Utf8,
    "uniprot_length": pl.Int64,
    "seq_agreement": pl.Utf8,
    "id_route": pl.Utf8,
}

STRUCTURES_SCHEMA = {
    "gene_id": pl.Utf8,
    "uniprot_accession": pl.Utf8,
    "afdb_entry_id": pl.Utf8,
    "afdb_version": pl.Int64,
    "model_url": pl.Utf8,
    "model_format": pl.Utf8,
    "model_page_url": pl.Utf8,
    "mean_plddt": pl.Float64,
    "frac_plddt_very_high": pl.Float64,
    "frac_plddt_confident": pl.Float64,
    "frac_plddt_low": pl.Float64,
    "frac_plddt_very_low": pl.Float64,
    "model_created": pl.Utf8,
    "model_is_canonical": pl.Boolean,
    "confidence_url": pl.Utf8,
    "alphafill_url": pl.Utf8,
    "alphafill_page_url": pl.Utf8,
}


def read_tsv(source_dir: Path, name: str, schema: dict | None = None) -> pl.DataFrame:
    path = source_dir / name
    if not path.exists():
        return pl.DataFrame(schema=schema) if schema else pl.DataFrame()
    return pl.read_csv(path, separator="\t", schema=schema, infer_schema_length=10000)


def read_confidence(source_dir: Path) -> pl.DataFrame:
    path = source_dir / "confidence.parquet"
    schema = {"gene_id": pl.Utf8, "plddt_accession": pl.Utf8, "plddt": pl.List(pl.UInt8)}
    if not path.exists():
        return pl.DataFrame(schema=schema)
    return pl.read_parquet(path).select(
        "gene_id", pl.col("uniprot_accession").alias("plddt_accession"), "plddt"
    )


def read_sequences(source_dir: Path) -> pl.DataFrame:
    path = source_dir / "sequences.tsv"
    schema = {"gene_id": pl.Utf8, "sequence_accession": pl.Utf8, "sequence": pl.Utf8}
    if not path.exists():
        return pl.DataFrame(schema=schema)
    return pl.read_csv(path, separator="\t").select(
        "gene_id", pl.col("uniprot_accession").alias("sequence_accession"), "sequence"
    )


def feature_counts(features: pl.DataFrame) -> pl.DataFrame:
    """Count the features of each gene. A binding site is a single pocket held together by
    several residues that are often far apart in the sequence, so it is counted once rather
    than once per residue."""
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
                # A binding feature can cover a range of residues rather than just one
                n_binding_residues=(pl.col("end") - pl.col("start") + 1).sum(),
            ),
            on="gene_id",
            how="left",
        )
    )


def experimental_entries(experimental: pl.DataFrame) -> pl.DataFrame:
    """Reduce the experimental structures to one row per PDB entry.

    3D-Beacons reports one row for each unbroken stretch of the protein that an entry
    resolved, so an entry that was modelled in thirty-three pieces arrives as thirty-three
    rows with the same information on each of them. The rows are combined into a single
    span running from the start of the first to the end of the last, and the coverage
    column still says how much of that span was actually resolved.
    """
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
    """Count the experimental entries each gene has and pick the one the viewer offers
    first."""
    return (
        rank_experimental(experimental)
        .group_by("gene_id")
        .agg(
            n_experimental=pl.len(),
            best_pdb_id=pl.col("pdb_id").first(),
            best_method=pl.col("method").first(),
            best_resolution=pl.col("resolution").first(),
        )
    )


def build_structure(
    gene_map: pl.DataFrame,
    source_dir: Path,
    models_dir: Path,
    features: pl.DataFrame,
    experimental: pl.DataFrame,
) -> pl.DataFrame:
    # Two genes that map to the same protein each carry its AlphaFold row, and joining on
    # the accession without removing the duplicate would give each gene both copies
    structures = (
        read_tsv(source_dir, "structures.tsv", STRUCTURES_SCHEMA)
        .drop("gene_id")
        .unique(subset=["uniprot_accession"], keep="first", maintain_order=True)
    )

    df = (
        gene_map.join(structures, on="uniprot_accession", how="left")
        .join(feature_counts(features), on="gene_id", how="left")
        .join(experimental_summary(experimental), on="gene_id", how="left")
        .join(read_confidence(source_dir), on="gene_id", how="left")
        .join(read_sequences(source_dir), on="gene_id", how="left")
        .with_columns(
            pl.col(
                "n_transmembrane",
                "n_intramembrane",
                "n_binding_sites",
                "n_binding_residues",
                "n_experimental",
            ).fill_null(0),
            pl.col("model_is_canonical").fill_null(False),
            model_file=pl.col("uniprot_accession")
            + pl.when(pl.col("model_format") == "BCIF")
            .then(pl.lit(".bcif"))
            .otherwise(pl.lit(".cif")),
        )
        .rename({"model_url": "model_source_url"})
    )
    present = {p.name for p in models_dir.glob("*.*cif")}
    return drop_stale(df.with_columns(pl.col("model_file").is_in(present).alias("model_available")))


# Per-residue columns and the accession each was fetched for
PER_RESIDUE = [("plddt", "plddt_accession"), ("sequence", "sequence_accession")]


def drop_stale(df: pl.DataFrame) -> pl.DataFrame:
    """Drop any per-residue column that was fetched for a different accession.

    The gene to UniProt mapping is regenerated on every fetch, while the confidence scores
    and the canonical sequence are numbered against whichever accession was current when
    they were fetched. When the mapping has moved on since, they describe a different
    protein and there is no way to line them up, so the figure is given nothing rather than
    something that does not belong to the gene.

    Scores that are numbered against the right accession but the wrong sequence version
    never get this far. fetch_structures records a confidence URL only for a model whose
    sequence is the canonical one, so an unplaceable score is never fetched at all.
    """
    for column, accession in PER_RESIDUE:
        stale = pl.col(accession).is_null() | (pl.col(accession) != pl.col("uniprot_accession"))
        report_missing(
            "gene",
            f"whose {column} was fetched for a different accession, so the {column} was dropped",
            df.filter(pl.col(column).is_not_null() & stale)
            .select(
                pl.format(
                    "{} {}: fetched for {}, currently {}",
                    "symbol",
                    "gene_id",
                    accession,
                    "uniprot_accession",
                )
            )
            .to_series()
            .to_list(),
        )
        df = df.with_columns(pl.when(stale).then(None).otherwise(pl.col(column)).alias(column))
    return df.drop(accession for _, accession in PER_RESIDUE)


def build_sources(source_dir: Path, structures: pl.DataFrame) -> pl.DataFrame:
    versions = structures["afdb_version"].drop_nulls().unique().to_list()
    afdb_version = f"v{versions[0]}" if len(versions) == 1 else None
    rows = []
    for source, filename, license_spdx, url in SOURCES:
        path = source_dir / filename
        rows.append(
            {
                "source": source,
                "version": afdb_version if source.startswith("AlphaFold") else None,
                "retrieved_date": (
                    datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
                    if path.exists()
                    else date.today().isoformat()
                ),
                "license_spdx": license_spdx,
                "url": url,
            }
        )
    return pl.DataFrame(rows, schema=SOURCES_SCHEMA)


def run(source_dir: Path, out_dir: Path) -> None:
    structure_source = source_dir / "structure"
    structure_out = out_dir / "structure"

    if not structure_source.exists():
        print(f"No {structure_source}; skipping the structure view", file=sys.stderr)
        return

    gene_map = read_tsv(structure_source, "uniprot_map.tsv", UNIPROT_MAP_SCHEMA)
    unmapped = gene_map.filter(pl.col("uniprot_accession").is_null())
    report_missing(
        "gene",
        "with no UniProt accession, left out of the structure view",
        unmapped["gene_id"].to_list(),
    )
    gene_map = gene_map.filter(pl.col("uniprot_accession").is_not_null())
    if gene_map.is_empty():
        print(
            f"no structure inputs under {structure_source}; skipping the structure view",
            file=sys.stderr,
        )
        return

    structure_out.mkdir(parents=True, exist_ok=True)
    models_dir = structure_out / "models"
    copied, total_models = copy_models(structure_source / "models", models_dir)
    pdb_copied, total_pdb = copy_models(structure_source / "models" / "pdb", models_dir / "pdb")
    for kind, flag, source, target in (
        ("model", "--download-predicted", structure_source / "models", models_dir),
        (
            "experimental",
            "--download-experimental",
            structure_source / "models" / "pdb",
            models_dir / "pdb",
        ),
    ):
        report_missing(
            f"{kind} file",
            f"in {target} that the source no longer carries; a run without {flag} leaves "
            "anything already mirrored in place, and it stays served until you delete it",
            stale_models(source, target),
        )

    features = read_tsv(structure_source, "features.tsv", FEATURE_SCHEMA)
    report_missing(
        "feature_type value",
        "in features.tsv that the figure does not recognise and will ignore",
        sorted(set(features["feature_type"].drop_nulls()) - FEATURE_TYPES),
    )
    experimental = experimental_entries(
        read_tsv(structure_source, "experimental.tsv", EXPERIMENTAL_SCHEMA)
    )

    structure = build_structure(gene_map, structure_source, models_dir, features, experimental)
    structure.write_parquet(structure_out / "structure.parquet")
    features.write_parquet(structure_out / "features.parquet")
    experimental.write_parquet(structure_out / "experimental.parquet")
    build_sources(structure_source, structure).write_parquet(structure_out / "sources.parquet")

    n_models = int(structure["afdb_entry_id"].is_not_null().sum())
    n_experimental = int((structure["n_experimental"] > 0).sum())
    print(
        f"wrote {structure.height} genes ({n_models} with a model, "
        f"{n_experimental} with experimental structures) -> {structure_out}",
        file=sys.stderr,
    )
    print(f"{total_models} model files in {models_dir} ({copied} copied)", file=sys.stderr)
    print(
        f"{count('experimental file', total_pdb)} mirrored ({pdb_copied} copied)",
        file=sys.stderr,
    )
