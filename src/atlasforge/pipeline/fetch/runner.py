# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the fetch phase, which acquires a gene family and writes the source files.

The stages run one after another and the steps within a stage run in parallel. A step is
left out entirely when every view that would use its output has been skipped, and a step
whose output files are already on disk is left alone, so naming it with --step is the only
way to make it run a second time.

A step that fails stops only the steps that read what it was meant to write. Every step
states the files it reads, so the runner can tell a step whose producer just failed from one
whose input nobody was ever asked to fetch, and the run gets as far as it can either way.
"""

from dataclasses import replace
from pathlib import Path

from ...config import COMMAND_NAME
from ..lib import console, interrupt, progress
from ..lib.orchestration import Ledger, Step, kept, preflight, run_stage, summarize
from ..lib.paths import PipelinePaths
from . import (
    annotate_genes,
    assemble_genes,
    curation,
    download_experimental_models,
    download_models,
    fetch_confidence,
    fetch_coverage,
    fetch_ensembl_genes,
    fetch_gene_models,
    fetch_gwas,
    fetch_ncbi_summaries,
    fetch_orthologs,
    fetch_protein_features,
    fetch_sequences,
    fetch_species_tree,
    fetch_structures,
    fetch_uniprot_map,
    fetch_uniprot_sequences,
    gtex,
    hgnc,
    plan,
    record_sources,
    slice_coverage,
    subset_expression,
)
from .browser_curation import GWAS_FILE, TRACKS_FILE, gwas_text, tracks_text

STEP_NAMES = plan.STEP_NAMES


def _acquire(options: plan.FetchOptions, paths: PipelinePaths) -> bool:
    """Return True when curation files have just been seeded and the user should be given a
    chance to edit them before the rest of the fetch runs."""
    hgnc_path = hgnc.acquire(options.source, paths.cache / "hgnc_family.txt")
    seeded = curation.seed(
        options.source,
        hgnc_path,
        paths.curation_dir,
        promote_prefix=options.promote_prefix,
        tracks_dirs=options.browser_tracks,
        gwas_dirs=options.browser_gwas,
    )
    written = {path.name for path in seeded}
    _warn_ignored(options, paths, written)
    if not seeded or options.no_review or options.only_steps:
        return False
    console.heading("Review the new curation files")
    for path in seeded:
        console.success(f"Created {path}")
    console.paragraph(plan.REVIEW)
    return True


def _warn_ignored(options: plan.FetchOptions, paths: PipelinePaths, written: set[str]) -> None:
    """Say so when a seeding flag was given for a curation file that already existed.

    Nothing here rewrites the file, so the rows it would have written are printed instead
    and the user can paste in the ones they want.
    """
    for flag, name, dirs, build in (
        ("--browser-tracks", TRACKS_FILE, options.browser_tracks, tracks_text),
        ("--browser-gwas", GWAS_FILE, options.browser_gwas, gwas_text),
    ):
        if not dirs or name in written:
            continue
        path = paths.curation_dir / name
        sources = ", ".join(str(d) for d in dirs)
        console.blank()
        console.paragraph(plan.SEEDED_ALREADY.format(flag=flag, path=path, sources=sources), "warn")
        for line in build(dirs).splitlines():
            if line.strip() and not line.startswith("#"):
                console.detail(line, indent=2)


def _expression(options: plan.FetchOptions, paths: PipelinePaths) -> None:
    tpm = options.gtex_file or gtex.ensure_tpm(paths.cache, options.gtex_version)
    subset_expression.run(
        paths.source / "genes.tsv",
        tpm,
        gtex.ensure_attributes(paths.cache, options.gtex_version),
        paths.source / "expression.parquet",
        paths.source / "sample_tissue.tsv",
    )


def _browser_steps(options: plan.FetchOptions, paths: PipelinePaths) -> list[Step]:
    browser, genes = paths.browser_source, paths.source / "genes.tsv"
    chroms, coverage = browser / "chroms.tsv", browser / "coverage.tsv"
    tracks_file, gwas_file = paths.curation_dir / TRACKS_FILE, paths.curation_dir / GWAS_FILE
    flank = {"flank_min": options.browser_flank_min, "flank_max": options.browser_flank_max}
    extent = {**flank, "whole_genome": options.browser_whole_genome}
    return [
        Step(
            "fetch_gene_models",
            lambda: fetch_gene_models.run(
                genes,
                paths.cache,
                browser,
                ensembl_release=options.ensembl_release,
                gencode_override=options.gencode_release,
                models_file=options.gene_models_file,
                **extent,
            ),
            inputs=(genes,),
            outputs=(browser / "transcripts.bed", chroms, browser / "gene_models.tsv"),
        ),
        Step(
            "fetch_coverage",
            lambda: fetch_coverage.run(
                tracks_file,
                genes,
                chroms,
                coverage,
                default_bin=options.browser_bin,
                default_local=options.local_coverage,
                **extent,
            ),
            requires=("pybigtools",),
            inputs=(tracks_file, genes, chroms),
            outputs=(coverage,),
        ),
        Step(
            "fetch_gwas",
            lambda: fetch_gwas.run(gwas_file, genes, chroms, paths.cache, browser, **extent),
            inputs=(gwas_file, genes, chroms),
            outputs=(browser / "gwas.parquet", browser / "gwas_studies.tsv"),
        ),
        Step(
            "slice_coverage",
            lambda: slice_coverage.run(
                coverage,
                genes,
                chroms,
                paths.coverage_dir,
                max_bytes=options.browser_max_bytes,
                **extent,
            ),
            requires=("pybigtools",),
            inputs=(coverage, genes, chroms),
            outputs=(paths.coverage_dir,),
            # Decides file by file, so its directory is never complete
            skip_when_present=False,
        ),
    ]


def _steps(options: plan.FetchOptions, paths: PipelinePaths) -> dict[str, Step]:
    cache, source, structure = paths.cache, paths.source, paths.structure_source
    curation_dir = paths.curation_dir
    hgnc_table = cache / "hgnc_family.txt"
    annotation = cache / "annotation.tsv"
    ensembl_genes = cache / "ensembl_genes.tsv"
    summaries = cache / "ncbi_gene_summaries.tsv"
    families = curation_dir / "families.tsv"
    exclusions = curation_dir / "exclusions.txt"
    symbol_overrides = curation_dir / "symbol_overrides.tsv"
    uniprot_overrides = curation_dir / "uniprot_overrides.tsv"
    genes = source / "genes.tsv"
    protein = source / "protein.fasta"
    species = curation_dir / "species.tsv"
    uniprot_map = structure / "uniprot_map.tsv"
    sequences = structure / "sequences.tsv"
    structures = structure / "structures.tsv"
    experimental = structure / "experimental.tsv"
    steps = [
        Step(
            "annotate_genes",
            lambda: annotate_genes.run(hgnc_table, families, annotation),
            inputs=(hgnc_table, families),
            outputs=(annotation,),
        ),
        Step(
            "fetch_ensembl_genes",
            lambda: fetch_ensembl_genes.run(annotation, ensembl_genes),
            inputs=(annotation,),
            outputs=(ensembl_genes,),
        ),
        Step(
            "fetch_ncbi_summaries",
            lambda: fetch_ncbi_summaries.run(annotation, summaries),
            inputs=(annotation,),
            outputs=(summaries,),
        ),
        Step(
            "assemble_genes",
            lambda: assemble_genes.run(
                annotation,
                ensembl_genes,
                summaries,
                exclusions,
                symbol_overrides,
                genes,
                source / "transcripts.tsv",
            ),
            inputs=(annotation, ensembl_genes, summaries),
            outputs=(genes, source / "transcripts.tsv"),
        ),
        Step(
            "subset_expression",
            lambda: _expression(options, paths),
            inputs=(genes,),
            outputs=(source / "expression.parquet", source / "sample_tissue.tsv"),
        ),
        Step(
            "fetch_sequences",
            lambda: fetch_sequences.run(genes, source / "cds.fasta", protein),
            inputs=(genes,),
            outputs=(source / "cds.fasta", protein),
        ),
        Step(
            "fetch_orthologs",
            lambda: fetch_orthologs.run(genes, species, source / "orthologs.tsv", cache),
            inputs=(genes, species),
            outputs=(source / "orthologs.tsv",),
            # Resumes from its cache, so it always looks for the genes it has yet to fetch
            skip_when_present=False,
        ),
        Step(
            "fetch_species_tree",
            lambda: fetch_species_tree.run(
                options.tree_source,
                species,
                source / "species_tree.nwk",
                source / "species.tsv",
                ensembl_release=options.ensembl_release,
                curation_dir=curation_dir,
            ),
            requires=("Bio",),
            inputs=(species,),
            outputs=(source / "species_tree.nwk", source / "species.tsv"),
        ),
        Step(
            "fetch_uniprot_map",
            lambda: fetch_uniprot_map.run(
                genes, protein, annotation, uniprot_overrides, uniprot_map
            ),
            inputs=(genes,),
            outputs=(uniprot_map,),
        ),
        Step(
            "fetch_uniprot_sequences",
            lambda: fetch_uniprot_sequences.run(uniprot_map, sequences),
            inputs=(uniprot_map,),
            outputs=(sequences,),
        ),
        Step(
            "fetch_protein_features",
            lambda: fetch_protein_features.run(uniprot_map, structure / "features.tsv"),
            inputs=(uniprot_map,),
            outputs=(structure / "features.tsv",),
        ),
        Step(
            "fetch_structures",
            lambda: fetch_structures.run(uniprot_map, sequences, structures, experimental),
            inputs=(uniprot_map, sequences),
            outputs=(structures, experimental),
        ),
        Step(
            "fetch_confidence",
            lambda: fetch_confidence.run(structures, structure / "confidence.parquet"),
            inputs=(structures,),
            outputs=(structure / "confidence.parquet",),
        ),
        # The two download steps decide file by file, so their directory is never complete
        Step(
            "download_models",
            lambda: download_models.run(structures, paths.models_dir),
            inputs=(structures,),
            outputs=(paths.models_dir,),
            skip_when_present=False,
        ),
        Step(
            "download_experimental_models",
            lambda: download_experimental_models.run(experimental, paths.models_dir / "pdb"),
            inputs=(experimental,),
            outputs=(paths.models_dir / "pdb",),
            skip_when_present=False,
        ),
        *_browser_steps(options, paths),
        Step(
            "record_sources",
            lambda: record_sources.run(options, paths),
            inputs=(genes,),
            outputs=(source / "sources.tsv",),
        ),
    ]
    return {step.name: step for step in steps}


def _curation_outputs(paths: PipelinePaths) -> tuple[Path, ...]:
    names = (
        "families.tsv",
        "exclusions.txt",
        "symbol_overrides.tsv",
        "species.tsv",
        "uniprot_overrides.tsv",
        TRACKS_FILE,
        GWAS_FILE,
    )
    return (paths.cache / "hgnc_family.txt", *(paths.curation_dir / name for name in names))


def run(
    options: plan.FetchOptions, paths: PipelinePaths, build_command: str = ""
) -> tuple[bool, bool]:
    """Return whether the run halted for curation review, and whether anything went wrong."""
    halted = False

    def fetch_hgnc() -> None:
        nonlocal halted
        halted = _acquire(options, paths)

    seeding = Step(
        "fetch_hgnc",
        fetch_hgnc,
        outputs=_curation_outputs(paths),
        # Cheap when everything is already there, and it is what writes the curated files
        skip_when_present=False,
    )
    steps = {"fetch_hgnc": seeding} | _steps(options, paths)
    steps = {name: replace(step, label=plan.LABELS[name]) for name, step in steps.items()}
    chosen = plan.selected(options)
    forced = frozenset(options.only_steps)
    preflight(
        [
            steps[name]
            for name in plan.STEP_NAMES
            if name in chosen and not kept(steps[name], forced)
        ]
    )

    ledger = Ledger()
    with interrupt.handler(), progress.display():
        for stage in plan.STAGES:
            run_stage([steps[name] for name in stage if name in chosen], ledger, forced)
            if halted:
                return True, False

    summarize(ledger, "Fetch", f"{COMMAND_NAME} fetch")
    console.blank()
    if ledger.unusable:
        console.paragraph(plan.INCOMPLETE.format(source=paths.source), "warn")
    else:
        console.paragraph(plan.DONE.format(source=paths.source), "success")
        console.detail(build_command or f"{COMMAND_NAME} build", indent=2)
        console.paragraph(plan.DONE_AGAIN, "success")
    return False, ledger.unusable
