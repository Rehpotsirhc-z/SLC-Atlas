# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Record provenance for datasets created by the fetch pipeline."""

from datetime import date
from pathlib import Path

import polars as pl

from ..lib import console
from ..lib.paths import PipelinePaths
from .plan import FetchOptions

HEADER = ("domain", "source", "version", "assembly", "retrieved_date", "license_spdx", "url")

ENSEMBL_URL = "https://www.ensembl.org"
COMPARA_URL = "https://www.ensembl.org/info/genome/compara"

STRUCTURE_SOURCES = [
    ("AlphaFold DB", "CC-BY-4.0", "https://alphafold.ebi.ac.uk"),
    ("UniProt", "CC-BY-4.0", "https://www.uniprot.org"),
    ("PDBe (via 3D-Beacons)", "CC0-1.0", "https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons"),
]

TREE_SOURCES = {
    "ensembl_compara": ("Ensembl Compara", COMPARA_URL),
    "ncbi": ("NCBI Taxonomy", "https://www.ncbi.nlm.nih.gov/taxonomy"),
    "timetree": ("TimeTree", "http://www.timetree.org"),
    "ucsc": ("UCSC", "https://genome.ucsc.edu"),
}


def _assembly(browser_dir: Path) -> str:
    path = browser_dir / "gene_models.tsv"
    if not path.exists():
        return ""
    df = pl.read_csv(path, separator="\t")
    if "assembly" in df.columns and df.height:
        return df["assembly"][0] or ""
    return ""


def _afdb_version(structure_dir: Path) -> str:
    path = structure_dir / "structures.tsv"
    if not path.exists():
        return ""
    df = pl.read_csv(path, separator="\t", infer_schema_length=10000)
    if "afdb_version" not in df.columns:
        return ""
    values = df["afdb_version"].drop_nulls().unique().to_list()
    return f"v{values[0]}" if len(values) == 1 else ""


def _rows(options: FetchOptions, paths: PipelinePaths) -> list[tuple[str, ...]]:
    source = paths.source
    today = date.today().isoformat()
    assembly = _assembly(paths.browser_source)
    rows = [
        ("genes", "Ensembl", str(options.ensembl_release), assembly, today, "", ENSEMBL_URL),
        ("genes", "HGNC", "", "", today, "", "https://www.genenames.org"),
        ("genes", "NCBI Gene", "", "", today, "", "https://www.ncbi.nlm.nih.gov/gene"),
    ]
    # Record GTEx only when the pipeline fetched the expression matrix
    if (source / "expression.parquet").exists() and options.gtex_file is None:
        rows.append(
            ("expression", "GTEx", options.gtex_version, "", today, "", "https://gtexportal.org")
        )
    if (source / "orthologs.tsv").exists():
        rows.append(("conservation", "Ensembl Compara", "", "", today, "", COMPARA_URL))
    tree_source, tree_url = TREE_SOURCES.get(options.tree_source, ("", ""))
    if (source / "species_tree.nwk").exists() and options.tree_source != "ensembl_compara":
        rows.append(("conservation", tree_source, "", "", today, "", tree_url))
    if (paths.structure_source / "uniprot_map.tsv").exists():
        afdb = _afdb_version(paths.structure_source)
        for name, license_spdx, url in STRUCTURE_SOURCES:
            version = afdb if name == "AlphaFold DB" else ""
            rows.append(("structure", name, version, "", today, license_spdx, url))
    return rows


def run(options: FetchOptions, paths: PipelinePaths) -> None:
    rows = _rows(options, paths)
    lines = ["\t".join(HEADER)] + ["\t".join(row) for row in rows]
    path = paths.source / "sources.tsv"
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(f".{path.name}.partial")
    partial.write_text("\n".join(lines) + "\n", encoding="utf-8")
    partial.replace(path)
    console.detail(f"Recorded {len(rows)} data sources -> {path}")
