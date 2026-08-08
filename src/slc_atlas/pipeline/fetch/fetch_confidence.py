# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch AlphaFold's confidence score (pLDDT) for each residue of every predicted model.

The structure view plots the confidence along the residue axis, so it needs one score per
residue rather than the four band fractions that the summary API returns. A score runs
from 0 to 100 and is rounded to a whole number, which fits in a byte and keeps all 462
genes down to a few hundred kilobytes.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import polars as pl

from ..lib.http import get_json
from ..lib.reporting import report_missing

WORKERS = 6

SCHEMA = {
    "gene_id": pl.Utf8,
    "uniprot_accession": pl.Utf8,
    "plddt": pl.List(pl.UInt8),
}


def fetch_scores(url: str) -> list[int] | None:
    payload = get_json(url, absent=(404,))
    if not payload or not payload.get("confidenceScore"):
        return None
    # AlphaFold returns the scores in residue order, so the list needs no reordering
    return [max(0, min(100, round(score))) for score in payload["confidenceScore"]]


def run(structures_path: Path, out_path: Path) -> None:
    structures = pl.read_csv(structures_path, separator="\t").drop_nulls("confidence_url")
    by_accession = structures.unique(subset="uniprot_accession")
    urls = by_accession["confidence_url"].to_list()
    accessions = by_accession["uniprot_accession"].to_list()
    print(f"fetching pLDDT for {len(urls)} accessions...", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        scores = dict(zip(accessions, pool.map(fetch_scores, urls)))

    rows = [
        {
            "gene_id": row["gene_id"],
            "uniprot_accession": row["uniprot_accession"],
            "plddt": scores.get(row["uniprot_accession"]),
        }
        for row in structures.iter_rows(named=True)
    ]

    report_missing(
        "gene",
        "with no per-residue confidence score",
        [r["gene_id"] for r in rows if not r["plddt"]],
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(rows, schema=SCHEMA).write_parquet(out_path)

    covered = sum(1 for r in rows if r["plddt"])
    residues = sum(len(r["plddt"]) for r in rows if r["plddt"])
    print(
        f"wrote {covered}/{len(rows)} genes, {residues} residues "
        f"({out_path.stat().st_size / 1e3:.0f} kB) -> {out_path}",
        file=sys.stderr,
    )
