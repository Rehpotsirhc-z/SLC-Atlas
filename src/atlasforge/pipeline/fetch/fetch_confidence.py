# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch AlphaFold's confidence score (pLDDT) for each residue of every predicted model.

The structure view plots the confidence along the residue axis, so it needs one score per
residue rather than the four band fractions that the summary API returns. A score runs
from 0 to 100 and is rounded to a whole number, which fits in a byte and keeps the whole
family down to a few hundred kilobytes.
"""

from pathlib import Path

import polars as pl

from ..lib import console, progress

from ..lib.http import get_json
from ..lib.reporting import FAILURE, attempt, report_missing

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
    console.detail(f"Fetching pLDDT scores for {len(urls)} accessions")

    refused: list[str] = []
    with progress.bar("confidence scores", total=len(urls), noun="accessions") as bar:
        with console.pool(WORKERS) as pool:
            fetched = pool.map(
                lambda pair: attempt(pair[0], lambda: fetch_scores(pair[1]), refused),
                zip(accessions, urls),
            )
            scores = {}
            for accession, got in zip(accessions, fetched):
                scores[accession] = got
                bar.advance()
    report_missing(
        "accession",
        "whose confidence scores AlphaFold would not give up",
        refused,
        severity=FAILURE,
        checked=len(urls),
    )

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
    console.success(
        f"Wrote {covered}/{len(rows)} genes, {residues} residues "
        f"({out_path.stat().st_size / 1024:.0f} KiB) -> {out_path}"
    )
