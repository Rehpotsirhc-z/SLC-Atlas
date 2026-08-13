# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the tables used by the Genome Browser view."""

import csv
from pathlib import Path

import polars as pl

from ..lib import bed12, bigbed, windows

WINDOW_SCHEMA = {
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "chrom": pl.Utf8,
    "chrom_ensembl": pl.Utf8,
    "chrom_size": pl.Int64,
    "gene_start": pl.Int64,
    "gene_end": pl.Int64,
    "strand": pl.Utf8,
    "window_start": pl.Int64,
    "window_end": pl.Int64,
    "pan_start": pl.Int64,
    "pan_end": pl.Int64,
    "flank": pl.Int64,
    "clipped": pl.Boolean,
}


TRACK_SCHEMA = {
    "track_id": pl.Utf8,
    "label": pl.Utf8,
    "group": pl.Utf8,
    "stranded": pl.Boolean,
    "local": pl.Boolean,
    "file": pl.Utf8,
    "plus_file": pl.Utf8,
    "minus_file": pl.Utf8,
    "url": pl.Utf8,
    "plus_url": pl.Utf8,
    "minus_url": pl.Utf8,
    "bin": pl.Int64,
    "bytes": pl.Int64,
    "reduction": pl.Int64,
    "chroms": pl.List(pl.Utf8),
}

CHROM_SCHEMA = {"chrom": pl.Utf8, "ensembl": pl.Utf8, "size": pl.Int64, "role": pl.Utf8}


STUDY_SCHEMA = {
    "study_id": pl.Utf8,
    "trait": pl.Utf8,
    "citation": pl.Utf8,
    "source": pl.Utf8,
    "assembly": pl.Utf8,
    "license_spdx": pl.Utf8,
    "n_variants": pl.Int64,
    "chroms": pl.List(pl.Utf8),
}

SOURCES_SCHEMA = {
    "source": pl.Utf8,
    "kind": pl.Utf8,
    "version": pl.Utf8,
    "assembly": pl.Utf8,
    "retrieved_date": pl.Utf8,
    "license_spdx": pl.Utf8,
    "url": pl.Utf8,
}


def read_tsv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def window_frame(placed, merged) -> pl.DataFrame:
    rows = []
    for window in placed:
        pan_start, pan_end = windows.extent(window, merged)
        rows.append(
            {
                "gene_id": window.gene_id,
                "symbol": window.symbol,
                "chrom": window.chrom,
                "chrom_ensembl": window.chrom_ensembl,
                "chrom_size": window.chrom_size,
                "gene_start": window.gene_start,
                "gene_end": window.gene_end,
                "strand": window.strand,
                "window_start": window.start,
                "window_end": window.end,
                "pan_start": pan_start,
                "pan_end": pan_end,
                "flank": window.flank,
                "clipped": window.clipped,
            }
        )
    return pl.DataFrame(rows, schema=WINDOW_SCHEMA)


def transcript_rows(transcripts, sizes: dict[str, int], atlas_ids: set[str]):
    """Yield transcripts as bigBed rows in index order."""
    ordered = sorted(
        (t for t in transcripts if t.chrom in sizes),
        key=lambda t: (t.chrom, t.start, t.end, t.transcript_id),
    )
    for t in ordered:
        gene_id = bed12.versionless(t.gene_id)
        yield bigbed.transcript_row(
            {
                "transcript_id": bed12.versionless(t.transcript_id),
                "transcript_version": bed12.version_of(t.transcript_id),
                "model_gene_id": gene_id,
                "gene_name": t.gene_name,
                "biotype": t.biotype,
                "chrom": t.chrom,
                "start": t.start,
                "end": t.end,
                "strand": t.strand,
                "cds_start": t.cds_start,
                "cds_end": t.cds_end,
                "exons": [{"start": s, "end": e} for s, e in t.exons],
                "is_atlas_gene": gene_id in atlas_ids,
            }
        )


def overview(variants: pl.DataFrame, bin_size: int, cut: float) -> pl.DataFrame:
    """Keep significant variants and the strongest variant in each genomic bin."""
    if variants.is_empty():
        return variants
    strongest = (
        variants.with_columns(bin=pl.col("position") // bin_size)
        .sort("p_value")
        .group_by("chrom", "bin")
        .head(1)
        # Grouping reorders the columns, and stacking two frames goes by position
        .select(variants.columns)
    )
    return pl.concat([variants.filter(pl.col("p_value") < cut), strongest]).unique(
        subset=["chrom", "position", "snp_id"]
    )


def variant_rows(variants: pl.DataFrame, sizes: dict[str, int]):
    """One study's variants as bigBed rows, ordered and carrying their own statistics."""
    frame = (
        variants.filter(pl.col("chrom").is_in(list(sizes)))
        # Keep underflowed p-values off the numeric scale
        .with_columns(
            neg_log10_p=pl.when(pl.col("p_value") > 0)
            .then(-pl.col("p_value").log10())
            .otherwise(None)
            .cast(pl.Float32)
        )
        .select("chrom", "position", "snp_id", "p_value", "neg_log10_p", "beta")
        .sort("chrom", "position")
    )
    for row in frame.iter_rows():
        yield bigbed.variant_row(*row)


def _reduction(path: Path) -> int:
    """Return the minimum safe summary resolution, or 0 when no summary is safe."""
    from ..lib.bigwig import open_track, sound_reduction

    try:
        return sound_reduction(open_track(str(path)))
    except Exception:
        # Fall back to exact records when the summary pyramid cannot be verified
        return 0


def _shared_reduction(held: int | None, found: int) -> int:
    """Return the minimum safe resolution shared by both lanes."""
    if held is None:
        return found
    return 0 if 0 in (held, found) else max(held, found)


def track_frame(rows: list[dict], coverage_dir: Path) -> pl.DataFrame:
    """Combine coverage files into drawable tracks."""
    from ..fetch.slice_coverage import track_filename

    tracks: dict[str, dict] = {}
    for row in rows:
        if row.get("size_mismatch"):
            continue
        strand = (row.get("strand") or "").lower()
        local = row.get("local") == "yes"
        name = track_filename(row["track_id"], strand)
        present = local and (coverage_dir / name).is_file()
        track = tracks.setdefault(
            row["track_id"],
            {
                "track_id": row["track_id"],
                "label": row.get("label") or row["track_id"],
                "group": row.get("group") or "",
                "stranded": False,
                "local": True,
                "file": None,
                "plus_file": None,
                "minus_file": None,
                "url": None,
                "plus_url": None,
                "minus_url": None,
                "bin": int(row.get("bin") or 0),
                "bytes": 0,
                # None distinguishes an unchecked lane from a rejected summary pyramid
                "reduction": None,
                "chroms": [],
            },
        )
        prefix = f"{strand}_" if strand else ""
        track[f"{prefix}file"] = name if present else None
        track[f"{prefix}url"] = row.get("origin_url") or None
        track["stranded"] = track["stranded"] or bool(strand)
        track["local"] = track["local"] and present
        track["chroms"] = sorted(set(track["chroms"]) | set(row.get("chroms", "").split(",")))
        # Remote tracks use exact records because this build phase performs no network access
        found = _reduction(coverage_dir / name) if present else 0
        track["reduction"] = _shared_reduction(track["reduction"], found)
        if present:
            track["bytes"] += (coverage_dir / name).stat().st_size

    drawable = [t for t in tracks.values() if _reachable(t)]
    for track in drawable:
        track["reduction"] = track["reduction"] or 0
    return pl.DataFrame(drawable, schema=TRACK_SCHEMA).sort("group", "label")


def _reachable(track: dict) -> bool:
    """Return whether every lane in a track has a local file or remote URL."""
    lanes = (
        (("plus_file", "plus_url"), ("minus_file", "minus_url"))
        if track["stranded"]
        else (("file", "url"),)
    )
    return all(track[name] or track[url] for name, url in lanes)


def source_frame(source_dir: Path, coverage: list[dict], studies: list[dict]) -> pl.DataFrame:
    rows = [
        {k: v for k, v in row.items() if k in SOURCES_SCHEMA}
        for row in read_tsv(source_dir / "gene_models.tsv")
    ]
    groups = sorted({row.get("group") or "coverage" for row in coverage})
    rows += [
        {"source": group, "kind": "coverage", "version": "", "assembly": "", "url": ""}
        for group in groups
    ]
    rows += [
        {
            "source": study.get("trait") or study["study_id"],
            "kind": "gwas",
            "version": study.get("study_id", ""),
            "assembly": study.get("assembly", ""),
            "retrieved_date": study.get("retrieved_date", ""),
            "license_spdx": study.get("license_spdx", ""),
            "url": study.get("url", ""),
        }
        for study in studies
    ]
    return (
        pl.DataFrame(rows, schema=SOURCES_SCHEMA) if rows else pl.DataFrame(schema=SOURCES_SCHEMA)
    )


def study_frame(studies: list[dict]) -> pl.DataFrame:
    rows = [
        {
            "study_id": s["study_id"],
            "trait": s.get("trait", ""),
            "citation": s.get("citation", ""),
            "source": s.get("source", ""),
            "assembly": s.get("assembly", ""),
            "license_spdx": s.get("license_spdx", ""),
            "n_variants": int(s.get("n_variants") or 0),
            "chroms": [c for c in (s.get("chroms") or "").split(",") if c],
        }
        for s in studies
    ]
    return pl.DataFrame(rows, schema=STUDY_SCHEMA)
