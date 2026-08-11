# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Validate browser source data and build the Genome Browser tables."""

import sys
from pathlib import Path

import polars as pl

from ..lib import bed12, chroms as chrom_names, windows
from ..lib.reporting import count, report_missing
from .browser_tables import (
    CHROM_SCHEMA,
    gwas_frame,
    model_frame,
    read_tsv,
    source_frame,
    study_frame,
    track_frame,
    window_frame,
)
from .coverage_files import copy_coverage, stale_coverage

# Allow minor coordinate differences between annotation releases
AGREEMENT = 0.95


def check_assembly(genes: pl.DataFrame, transcripts) -> None:
    """Refuse an annotation that describes a different genome than the gene table does.

    A bigWig carries no assembly and a GTF's header is easy to get wrong, so the check is
    made against the coordinates themselves: the same gene in two builds of the genome sits
    hundreds of kilobases apart, and in the same build it sits at the same base.
    """
    starts: dict[str, int] = {}
    for t in transcripts:
        gene = bed12.versionless(t.gene_id)
        starts[gene] = min(starts.get(gene, t.start), t.start)

    shared = genes.filter(pl.col("id").is_in(list(starts)))
    if shared.height < 20:
        return

    agreed, disagreed = 0, []
    for gene_id, start in shared.select("id", "start").rows():
        if start - 1 == starts[gene_id]:
            agreed += 1
        elif len(disagreed) < 3:
            disagreed.append(f"{gene_id} at {start - 1} in the genes, {starts[gene_id]} in the models")

    if agreed / shared.height < AGREEMENT:
        raise SystemExit(
            f"Only {agreed} of {shared.height} genes start at the same base in the gene table "
            f"and in the transcript models, so they were built on different genomes: "
            + "; ".join(disagreed)
            + ". Fetch the gene models for the assembly the genes came from."
        )


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
        print(
            f"No gene models in {browser}, so the Genome Browser view is left out",
            file=sys.stderr,
        )
        return

    check_flank(browser, flank_min, flank_max)
    transcripts = bed12.read_bed12(models_path)
    genes = pl.read_csv(source_dir / "genes.tsv", separator="\t", columns=["id", "start"])
    check_assembly(genes, transcripts)

    placed, unplaced = windows.load(
        source_dir / "genes.tsv", chroms_path, flank_min=flank_min, flank_max=flank_max
    )
    report_missing("gene", "with no chromosome the browser can draw", unplaced)
    merged = windows.merge(placed)

    out = out_dir / "browser"
    out.mkdir(parents=True, exist_ok=True)
    coverage_out = out / "coverage"

    window_df = window_frame(placed, merged)
    models = model_frame(transcripts, window_df, set(genes["id"].to_list()))
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

    window_df.write_parquet(out / "windows.parquet")
    models.write_parquet(out / "transcripts.parquet")
    track_frame(coverage, coverage_out).write_parquet(out / "tracks.parquet")
    gwas_frame(variants, window_df).write_parquet(out / "gwas.parquet")
    study_frame(studies).write_parquet(out / "studies.parquet")
    source_frame(browser, coverage, studies).write_parquet(out / "sources.parquet")
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
    ).write_parquet(out / "chroms.parquet")

    print(
        f"{count('gene window', window_df.height)} covering "
        f"{windows.covered_bases(merged) / 1e6:.0f} Mb, "
        f"{count('transcript model', models.height)}, "
        f"{count('coverage track', len(coverage))} ({mirrored} copied here, {copied} new), "
        f"{count('GWAS study', len(studies))}",
        file=sys.stderr,
    )
