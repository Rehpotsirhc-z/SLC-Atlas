# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""What the fetch phase is made of: its steps, their order, and which of them a given run
wants.

Kept apart from the runner so that the shape of the phase can be read without the machinery
that carries it out, and so the runner stays the step factory and the run loop.
"""

from dataclasses import dataclass
from pathlib import Path

from ..lib import windows

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
    ["record_sources"],
]

STEP_NAMES = tuple(step for stage in STAGES for step in stage)

# Seeds the curated files every other step reads, so it runs whatever --step asks for
ALWAYS = "fetch_hgnc"

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
    "slice_coverage": "local_coverage",
}

LABELS = {
    "fetch_hgnc": "Downloading the gene list from HGNC",
    "annotate_genes": "Matching genes to their families",
    "fetch_ensembl_genes": "Fetching gene coordinates from Ensembl",
    "fetch_ncbi_summaries": "Fetching gene summaries from NCBI",
    "assemble_genes": "Writing the gene and transcript tables",
    "subset_expression": "Selecting the family's genes from the GTEx matrix",
    "fetch_sequences": "Fetching canonical coding and protein sequences from Ensembl",
    "fetch_orthologs": "Fetching orthologs from Ensembl Compara",
    "fetch_species_tree": "Building the species tree",
    "fetch_gene_models": "Fetching the transcript models from GENCODE",
    "fetch_coverage": "Resolving the coverage tracks",
    "fetch_gwas": "Reading the GWAS Catalog studies",
    "slice_coverage": "Writing the local copies of the coverage tracks",
    "fetch_uniprot_map": "Matching genes to UniProt entries",
    "fetch_uniprot_sequences": "Fetching the UniProt canonical sequences",
    "fetch_protein_features": "Fetching membrane topology and binding sites from UniProt",
    "fetch_structures": "Finding AlphaFold and PDB structures",
    "fetch_confidence": "Fetching AlphaFold confidence (pLDDT) per residue",
    "download_models": "Mirroring the AlphaFold models",
    "download_experimental_models": "Mirroring the PDB structures",
    "record_sources": "Recording where the data came from",
}

DONE = (
    "Fetch complete. Your editable source files are in {source}.\n"
    "Review or replace any of them, then build the atlas with:"
)

DONE_AGAIN = (
    "Run fetch again to download any missing files; files already on disk are left unchanged."
)

INCOMPLETE = (
    "Some of the dataset is missing. Everything that could be fetched is in {source}, and "
    "another fetch will keep those files and retry only what is missing."
)

REVIEW = (
    "These files control dataset-specific names, exclusions, species, protein mappings,\n"
    "and browser tracks. Edit them now or keep the suggested values.\n"
    "Use --no-review to continue automatically when creating another dataset."
)

# The flag was given, the file was already there, and curation is never written over
SEEDED_ALREADY = (
    "{flag} had no effect because {path} already exists.\n"
    "Curation files are never overwritten, so your edits are safe.\n"
    "To seed it again from {sources}, delete the file and rerun, or paste the rows below in."
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
    browser_tracks: tuple[Path, ...] = ()
    browser_gwas: tuple[Path, ...] = ()
    browser_flank_min: int = windows.FLANK_MIN
    browser_flank_max: int = windows.FLANK_MAX
    browser_bin: int = 25
    browser_max_bytes: int = 500_000_000
    browser_whole_genome: bool = False
    local_coverage: bool = False
    no_review: bool = False
    skipped_views: frozenset[str] = frozenset()
    only_steps: tuple[str, ...] = ()


def selected(options: FetchOptions) -> set[str]:
    """Which steps this run wants, always including the one that seeds curation."""
    if options.only_steps:
        return {ALWAYS} | set(options.only_steps)
    skip = {step for step, views in CONSUMED_BY.items() if views <= options.skipped_views}
    skip |= {step for step, flag in GATED_ON_FLAG.items() if not getattr(options, flag)}
    return set(STEP_NAMES) - skip
