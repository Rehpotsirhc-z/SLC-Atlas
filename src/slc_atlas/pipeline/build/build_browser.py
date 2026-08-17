# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Validate browser source data and build the Genome Browser tables."""

from pathlib import Path

import polars as pl

from ..lib import parquet
from ..lib import bed12, bigbed, chroms as chrom_names, console, pyramid, windows
from ..lib.reporting import count, report_missing
from .browser_tables import (
    CHROM_SCHEMA,
    read_tsv,
    source_frame,
    study_frame,
    track_frame,
    transcript_rows,
    variant_frame,
    variant_rows,
    window_frame,
)
from .coverage_files import copy_coverage, stale_coverage

# Allow minor coordinate differences between annotation releases
AGREEMENT = 0.95

# Minimum reciprocal overlap between a gene and its transcript models
OVERLAP = 0.5

# Marker used instead of flank sizes for a whole-genome fetch
WHOLE_GENOME = "genome"


def check_assembly(genes: pl.DataFrame, transcripts) -> None:
    """Refuse transcript models built for a different genome assembly.

    GTF assembly headers are not always reliable, so compare coordinates instead. Releases
    for the same assembly generally place a gene within a few bases or extend its span, while
    different assemblies may place it hundreds of kilobases away. Reciprocal overlap
    therefore distinguishes compatible annotations without requiring identical starts.
    """
    spans: dict[str, tuple[int, int]] = {}
    for t in transcripts:
        gene = bed12.versionless(t.gene_id)
        start, end = spans.get(gene, (t.start, t.end))
        spans[gene] = (min(start, t.start), max(end, t.end))

    shared = genes.filter(pl.col("id").is_in(list(spans)))
    if shared.height < 20:
        return

    agreed, disagreed = 0, []
    for gene_id, start, end in shared.select("id", "start", "end").rows():
        model_start, model_end = spans[gene_id]
        shared_bases = min(end, model_end) - max(start - 1, model_start)
        widest = max(end - start + 1, model_end - model_start)
        if shared_bases >= OVERLAP * widest:
            agreed += 1
        elif len(disagreed) < 3:
            disagreed.append(
                f"{gene_id} at {start - 1}-{end} in the genes, "
                f"{model_start}-{model_end} in the models"
            )

    if agreed / shared.height < AGREEMENT:
        raise SystemExit(
            f"Only {agreed} of {shared.height} genes overlap their transcript models, "
            f"so the gene table and annotation likely use different genome assemblies: "
            + "; ".join(disagreed)
            + ". Fetch the gene models for the assembly the genes came from."
        )


def write_gwas(
    variants: pl.DataFrame, studies: list[dict], sizes: dict[str, int], out_dir: Path
) -> tuple[int, dict[str, list[int]]]:
    """Write each GWAS study and its pyramid levels to bigBed.

    Return the variant count and pyramid bin sizes for each study.
    """
    if not studies:
        return 0, {}
    out_dir.mkdir(parents=True, exist_ok=True)
    kept = 0
    built: dict[str, list[int]] = {}
    for study in studies:
        study_id = study["study_id"]
        own = (
            variants.filter(pl.col("study_id") == study_id)
            if "study_id" in variants.columns
            else variants
        )
        frame = variant_frame(own, sizes)
        chroms, levels = pyramid.build(frame, sizes)
        written = bigbed.write(
            out_dir / f"{study_id}.bb", chroms, variant_rows(frame, levels, chroms)
        )
        kept += frame.height
        built[study_id] = [level["bin"] for level in levels]
        console.detail(
            f"{study_id}: {frame.height:,} variants"
            + "".join(f", {level['rows']:,} at {level['bin']:,}b" for level in levels)
            + f" ({written:,} rows)",
            indent=2,
        )

    report_missing(
        "GWAS file",
        f"in {out_dir} that belong to no study and are no longer read",
        sorted(p.name for p in out_dir.glob("*.bb") if p.stem not in built),
    )
    return kept, built


def fetched_whole_genome(source_dir: Path) -> bool:
    """Return whether the fetch retained the whole genome."""
    rows = read_tsv(source_dir / "gene_models.tsv")
    return bool(rows) and rows[0].get("detail") == WHOLE_GENOME


def check_flank(source_dir: Path, flank_min: int, flank_max: int) -> None:
    rows = read_tsv(source_dir / "gene_models.tsv")
    fetched = rows[0].get("detail") if rows else ""
    if not fetched or "-" not in fetched:
        return
    was_min, was_max = (int(v) for v in fetched.split("-"))
    if flank_min > was_min or flank_max > was_max:
        raise SystemExit(
            f"The browser was fetched with flanks of {was_min}-{was_max} bases and the build "
            f"asks for {flank_min}-{flank_max}. Nothing was sliced for the extra margin, so "
            f"fetch it again at the wider flank or build at the narrower one."
        )


def run(source_dir: Path, out_dir: Path, *, flank_min: int, flank_max: int) -> None:
    browser = source_dir / "browser"
    models_path, chroms_path = browser / "transcripts.bed", browser / "chroms.tsv"
    if not models_path.exists() or not chroms_path.exists():
        console.detail(f"No gene models in {browser}, so the Genome Browser view is left out")
        return

    check_flank(browser, flank_min, flank_max)
    transcripts = bed12.read_bed12(models_path)
    genes = pl.read_csv(source_dir / "genes.tsv", separator="\t", columns=["id", "start", "end"])
    check_assembly(genes, transcripts)

    placed, unplaced = windows.load(
        source_dir / "genes.tsv", chroms_path, flank_min=flank_min, flank_max=flank_max
    )
    report_missing("gene", "with no chromosome the browser can draw", unplaced)
    whole_genome = fetched_whole_genome(browser)
    # Pan limits follow the regions retained during fetch
    merged = windows.spans(
        source_dir / "genes.tsv",
        chroms_path,
        flank_min=flank_min,
        flank_max=flank_max,
        whole_genome=whole_genome,
    )

    out = out_dir / "browser"
    out.mkdir(parents=True, exist_ok=True)
    coverage_out = out / "coverage"

    window_df = window_frame(placed, merged)
    coverage = read_tsv(browser / "coverage.tsv")
    studies = read_tsv(browser / "gwas_studies.tsv")
    variants = (
        pl.read_parquet(browser / "gwas.parquet")
        if (browser / "gwas.parquet").exists()
        else pl.DataFrame(schema={"chrom": pl.Utf8, "position": pl.Int64})
    )

    copied, mirrored = copy_coverage(browser / "coverage", coverage_out)
    report_missing(
        "coverage track",
        f"in {coverage_out} that the source no longer carries; it stays served until deleted",
        stale_coverage(browser / "coverage", coverage_out) if coverage_out.exists() else [],
    )

    chrom_table = chrom_names.read_chroms(chroms_path)
    spelling, _ = chrom_names.alias_map(
        [c.name for c in chrom_table], window_df["chrom_ensembl"].unique().to_list()
    )
    ensembl_of = {track: source for source, track in spelling.items()}

    sizes = {c.name: c.size for c in chrom_table if c.role == chrom_names.PRIMARY}
    parquet.write(window_df, out / "windows.parquet")
    written = bigbed.write(
        out / "models.bb",
        sizes,
        transcript_rows(transcripts, sizes, set(genes["id"].to_list())),
    )
    kept_variants, study_levels = write_gwas(variants, studies, sizes, out / "gwas")
    tracks = track_frame(coverage, coverage_out)
    parquet.write(tracks, out / "tracks.parquet")
    parquet.write(study_frame(studies, study_levels), out / "studies.parquet")
    parquet.write(source_frame(browser, coverage, studies), out / "sources.parquet")
    parquet.write(
        pl.DataFrame(
            [
                {
                    "chrom": c.name,
                    "ensembl": ensembl_of.get(c.name, c.name),
                    "size": c.size,
                    "role": c.role,
                }
                for c in chrom_table
            ],
            schema=CHROM_SCHEMA,
        ),
        out / "chroms.parquet",
    )

    console.detail(f"{count('gene', window_df.height)} over "
        f"{windows.covered_bases(merged) / 1e6:.0f} Mb"
        f"{' (the whole genome)' if whole_genome else ' of windows'}, "
        f"{count('transcript model', written)}, "
        # Stranded tracks have one lane per strand
        f"{count('coverage track', tracks.height)} from {count('lane', len(coverage))} "
        f"({mirrored} copied here, {copied} new), "
        f"{count('GWAS study/GWAS studies', len(studies))} "
        f"holding {count('variant', kept_variants)}")
