# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the fetch phase, which acquires a gene family and writes the source files.

The stages run one after another, and the steps within a stage run in parallel. A step is
left out entirely when every view that would use its output has been skipped. A step whose
output files are already on disk is left alone as well, so naming it with --step is the
only way to make it run a second time.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace
from pathlib import Path

from ...config import COMMAND_NAME
from ..lib import windows
from ..lib.orchestration import Step, preflight, run_stage
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
    slice_coverage,
    subset_expression,
)
from .browser_curation import GWAS_FILE, TRACKS_FILE

STAGES = [
    ["fetch_hgnc"],
    ["annotate_genes"],
    ["fetch_ensembl_genes", "fetch_ncbi_summaries"],
    ["assemble_genes"],
    ["subset_expression", "fetch_sequences", "fetch_gene_models"],
    ["fetch_orthologs", "fetch_species_tree", "fetch_coverage", "fetch_gwas"],
    ["fetch_uniprot_map", "slice_coverage"],
    ["fetch_uniprot_sequences"],
    ["fetch_protein_features", "fetch_structures"],
    ["download_models", "download_experimental_models", "fetch_confidence"],
]

STEP_NAMES = tuple(step for stage in STAGES for step in stage)

CONSUMED_BY = {
    "subset_expression": {"clustering", "expression"},
    "fetch_sequences": {"clustering", "structure"},
    "fetch_orthologs": {"conservation"},
    "fetch_species_tree": {"conservation"},
    "fetch_gene_models": {"browser"},
    "fetch_coverage": {"browser"},
    "fetch_gwas": {"browser"},
    "slice_coverage": {"browser"},
    "fetch_uniprot_map": {"structure"},
    "fetch_protein_features": {"structure"},
    "fetch_structures": {"structure"},
    "fetch_uniprot_sequences": {"structure"},
    "download_models": {"structure"},
    "download_experimental_models": {"structure"},
    "fetch_confidence": {"structure"},
}

GATED_ON_FLAG = {
    "download_models": "download_predicted",
    "download_experimental_models": "download_experimental",
    "slice_coverage": "slice_coverage",
}

LABELS = {
    "fetch_hgnc": "Downloading the gene list from HGNC",
    "annotate_genes": "Matching genes to their families",
    "fetch_ensembl_genes": "Fetching gene coordinates from Ensembl",
    "fetch_ncbi_summaries": "Fetching gene summaries from NCBI",
    "assemble_genes": "Writing the gene and transcript tables",
    "subset_expression": "Taking this family's genes out of the GTEx matrix",
    "fetch_sequences": "Fetching the canonical coding and protein sequences",
    "fetch_orthologs": "Fetching orthologs from Ensembl Compara",
    "fetch_species_tree": "Building the species tree",
    "fetch_gene_models": "Fetching the transcript models around each gene",
    "fetch_coverage": "Resolving the coverage tracks",
    "fetch_gwas": "Taking this family's windows out of the GWAS studies",
    "slice_coverage": "Writing family-scoped copies of the coverage tracks",
    "fetch_uniprot_map": "Working out which UniProt entry each gene maps to",
    "fetch_uniprot_sequences": "Fetching the UniProt canonical sequences",
    "fetch_protein_features": "Fetching membrane topology and binding sites",
    "fetch_structures": "Finding the predicted and experimental structures",
    "fetch_confidence": "Fetching the per-residue confidence scores",
    "download_models": "Mirroring the predicted models",
    "download_experimental_models": "Mirroring the experimental structures",
}

KEPT = "Already available (delete its files to fetch it again)"

DONE = (
    "Fetch complete. Your editable source files are in {source}.\nReview or replace any "
    "of them, then run `{command} build` to build the atlas.\nRunning fetch again keeps "
    "existing files and downloads only what is missing."
)


@dataclass(frozen=True)
class FetchOptions:
    source: str = ""
    gtex_version: str = "v11"
    gtex_file: Path | None = None
    ensembl_release: int = 116
    tree_source: str = "ensembl_compara"
    promote_prefix: str = ""
    download_predicted: bool = False
    download_experimental: bool = False
    gene_models_file: Path | None = None
    gencode_release: str = ""
    browser_tracks: Path | None = None
    browser_gwas: Path | None = None
    browser_flank_min: int = windows.FLANK_MIN
    browser_flank_max: int = windows.FLANK_MAX
    browser_bin: int = 25
    browser_max_bytes: int = 500_000_000
    slice_coverage: bool = False
    no_review: bool = False
    skipped_views: frozenset[str] = frozenset()
    only_steps: tuple[str, ...] = ()


def _selected(options: FetchOptions) -> set[str]:
    if options.only_steps:
        return set(options.only_steps)
    skip = {step for step, views in CONSUMED_BY.items() if views <= options.skipped_views}
    skip |= {step for step, flag in GATED_ON_FLAG.items() if not getattr(options, flag)}
    return set(STEP_NAMES) - skip


def _acquire(options: FetchOptions, paths: PipelinePaths) -> bool:
    """Return True when curation files have just been seeded and the user should be given a
    chance to edit them before the rest of the fetch runs."""
    hgnc_path = hgnc.acquire(options.source, paths.cache / "hgnc_family.txt")
    seeded = curation.seed(
        options.source,
        hgnc_path,
        paths.curation_dir,
        promote_prefix=options.promote_prefix,
        tracks_dir=options.browser_tracks,
        gwas_dir=options.browser_gwas,
    )
    if not seeded or options.no_review or options.only_steps:
        return False
    print("\n=== Review the new curation files ===")
    for path in seeded:
        print(f"Created {path}")
    print(
        "\nThese files control dataset-specific names, exclusions, species, protein mappings,\n"
        "and browser tracks. Edit them now or keep the suggested values.\n"
        "Use --no-review to continue automatically when creating another dataset."
    )
    return True


def _expression(options: FetchOptions, paths: PipelinePaths) -> None:
    tpm = options.gtex_file or gtex.ensure_tpm(paths.cache, options.gtex_version)
    subset_expression.run(
        paths.source / "genes.tsv",
        tpm,
        gtex.ensure_attributes(paths.cache, options.gtex_version),
        paths.source / "expression.parquet",
        paths.source / "sample_tissue.tsv",
    )


def _browser_steps(options: FetchOptions, paths: PipelinePaths) -> list[Step]:
    browser, genes = paths.browser_source, paths.source / "genes.tsv"
    chroms, coverage = browser / "chroms.tsv", browser / "coverage.tsv"
    flank = {"flank_min": options.browser_flank_min, "flank_max": options.browser_flank_max}
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
                **flank,
            ),
            outputs=(browser / "transcripts.bed", chroms),
        ),
        Step(
            "fetch_coverage",
            lambda: fetch_coverage.run(
                paths.curation_dir / TRACKS_FILE,
                genes,
                chroms,
                coverage,
                default_bin=options.browser_bin,
                default_local=options.slice_coverage,
                **flank,
            ),
            requires=("pybigtools",),
            outputs=(coverage,),
        ),
        Step(
            "fetch_gwas",
            lambda: fetch_gwas.run(
                paths.curation_dir / GWAS_FILE,
                genes,
                chroms,
                paths.cache,
                browser,
                **flank,
            ),
            outputs=(browser / "gwas.parquet", browser / "gwas_studies.tsv"),
        ),
        # Decides file by file, so its directory is never complete
        Step(
            "slice_coverage",
            lambda: slice_coverage.run(
                coverage,
                genes,
                chroms,
                paths.coverage_dir,
                max_bytes=options.browser_max_bytes,
                **flank,
            ),
            requires=("pybigtools",),
        ),
    ]


def _steps(options: FetchOptions, paths: PipelinePaths) -> dict[str, Step]:
    cache, source, structure = paths.cache, paths.source, paths.structure_source
    curation_dir = paths.curation_dir
    annotation = cache / "annotation.tsv"
    ensembl_genes = cache / "ensembl_genes.tsv"
    summaries = cache / "ncbi_gene_summaries.tsv"
    genes = source / "genes.tsv"
    protein = source / "protein.fasta"
    species = curation_dir / "species.tsv"
    uniprot_map = structure / "uniprot_map.tsv"
    structures = structure / "structures.tsv"
    experimental = structure / "experimental.tsv"
    steps = [
        Step(
            "annotate_genes",
            lambda: annotate_genes.run(
                cache / "hgnc_family.txt", curation_dir / "families.tsv", annotation
            ),
            outputs=(annotation,),
        ),
        Step(
            "fetch_ensembl_genes",
            lambda: fetch_ensembl_genes.run(annotation, ensembl_genes),
            outputs=(ensembl_genes,),
        ),
        Step(
            "fetch_ncbi_summaries",
            lambda: fetch_ncbi_summaries.run(annotation, summaries),
            outputs=(summaries,),
        ),
        Step(
            "assemble_genes",
            lambda: assemble_genes.run(
                annotation,
                ensembl_genes,
                summaries,
                curation_dir / "exclusions.txt",
                curation_dir / "symbol_overrides.tsv",
                genes,
                source / "transcripts.tsv",
            ),
            outputs=(genes, source / "transcripts.tsv"),
        ),
        Step(
            "subset_expression",
            lambda: _expression(options, paths),
            outputs=(source / "expression.parquet", source / "sample_tissue.tsv"),
        ),
        Step(
            "fetch_sequences",
            lambda: fetch_sequences.run(genes, source / "cds.fasta", protein),
            outputs=(source / "cds.fasta", protein),
        ),
        Step(
            "fetch_orthologs",
            lambda: fetch_orthologs.run(genes, species, source / "orthologs.tsv"),
            outputs=(source / "orthologs.tsv",),
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
            outputs=(source / "species_tree.nwk", source / "species.tsv"),
        ),
        Step(
            "fetch_uniprot_map",
            lambda: fetch_uniprot_map.run(
                genes,
                protein,
                annotation,
                curation_dir / "uniprot_overrides.tsv",
                uniprot_map,
            ),
            outputs=(uniprot_map,),
        ),
        Step(
            "fetch_uniprot_sequences",
            lambda: fetch_uniprot_sequences.run(uniprot_map, structure / "sequences.tsv"),
            outputs=(structure / "sequences.tsv",),
        ),
        Step(
            "fetch_protein_features",
            lambda: fetch_protein_features.run(uniprot_map, structure / "features.tsv"),
            outputs=(structure / "features.tsv",),
        ),
        Step(
            "fetch_structures",
            lambda: fetch_structures.run(
                uniprot_map, structure / "sequences.tsv", structures, experimental
            ),
            outputs=(structures, experimental),
        ),
        Step(
            "fetch_confidence",
            lambda: fetch_confidence.run(structures, structure / "confidence.parquet"),
            outputs=(structure / "confidence.parquet",),
        ),
        # The two download steps decide file by file, so their directory is never complete
        Step("download_models", lambda: download_models.run(structures, paths.models_dir)),
        Step(
            "download_experimental_models",
            lambda: download_experimental_models.run(experimental, paths.models_dir / "pdb"),
        ),
        *_browser_steps(options, paths),
    ]
    return {step.name: step for step in steps}


def _kept(step: Step, forced: frozenset[str]) -> bool:
    """Return True when all of the step's output files already exist and --step did not
    name it, in which case the step does not need to run."""
    return bool(step.outputs) and step.name not in forced and all(p.exists() for p in step.outputs)


def _pending(steps: Sequence[Step], forced: frozenset[str]) -> list[Step]:
    pending = []
    for step in steps:
        if _kept(step, forced):
            print(f"\n=== {step.heading} === {KEPT}", flush=True)
        else:
            pending.append(step)
    return pending


def run(options: FetchOptions, paths: PipelinePaths) -> bool:
    """Return True when the run stopped so that the curation files could be edited."""
    halted = False

    def fetch_hgnc() -> None:
        nonlocal halted
        halted = _acquire(options, paths)

    steps = {"fetch_hgnc": Step("fetch_hgnc", fetch_hgnc)} | _steps(options, paths)
    steps = {name: replace(step, label=LABELS[name]) for name, step in steps.items()}
    selected = _selected(options)
    forced = frozenset(options.only_steps)
    preflight(
        [steps[name] for name in STEP_NAMES if name in selected and not _kept(steps[name], forced)]
    )

    for stage in STAGES:
        run_stage(_pending([steps[name] for name in stage if name in selected], forced))
        if halted:
            return True

    print("\n" + DONE.format(source=paths.source, command=COMMAND_NAME))
    return False
