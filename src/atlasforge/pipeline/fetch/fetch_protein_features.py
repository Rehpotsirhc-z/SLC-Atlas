# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the membrane topology and the ligand-binding features of each protein from
UniProt.

The positions are numbered against the UniProt canonical sequence, which is how the
structure models are numbered too. The seq_agreement column of uniprot_map.tsv records the
genes where that sequence differs from the Ensembl canonical protein that the rest of the
source files are built from.

The glycosylation, disulfide and signal-peptide features are fetched as well because they
show that a stretch of the chain lies outside the cell. For about a third of the family
UniProt gives no topological domains, and these features are then the only evidence of
which way round the protein sits in the membrane.
"""

from pathlib import Path

import polars as pl

from ..lib.http import get_json
from ..lib import console, progress
from ..lib.reporting import FAILURE, attempt, report_missing

REST = "https://rest.uniprot.org"
ACCESSION_BATCH = 100  # The most accessions /uniprotkb/accessions accepts at once

# The feature name UniProt uses in its JSON, and the name this pipeline stores it under
FEATURE_TYPES = {
    "Transmembrane": "transmembrane",
    "Intramembrane": "intramembrane",
    "Topological domain": "topological_domain",
    "Binding site": "binding_site",
    "Active site": "active_site",
    "Glycosylation": "glycosylation",
    "Disulfide bond": "disulfide_bond",
    "Signal": "signal_peptide",
}

FIELDS = [
    "gene_id",
    "uniprot_accession",
    "feature_type",
    "start",
    "end",
    "description",
    "ligand_name",
    "ligand_chebi",
    # Tells apart two sites that bind the same ligand, such as Na(+) label 1 and label 2
    "ligand_label",
]

SCHEMA = {f: pl.Int64 if f in ("start", "end") else pl.Utf8 for f in FIELDS}


def fetch_features(accessions: list[str]) -> dict[str, list[dict]]:
    """Return the features of each accession, in the order they appear in the sequence."""
    out: dict[str, list[dict]] = {}
    refused: list[str] = []
    with progress.bar("protein features", total=len(accessions), noun="accessions") as bar:
        for i in range(0, len(accessions), ACCESSION_BATCH):
            chunk = accessions[i : i + ACCESSION_BATCH]
            payload = attempt(
                f"{chunk[0]}..{chunk[-1]}",
                lambda: get_json(
                    f"{REST}/uniprotkb/accessions?accessions={','.join(chunk)}"
                    f"&format=json&fields=accession,ft_transmem,ft_intramem,ft_topo_dom"
                    f",ft_binding,ft_act_site,ft_signal,ft_carbohyd,ft_disulfid"
                ),
                refused,
            )
            for entry in (payload or {}).get("results", []):
                out[entry["primaryAccession"]] = entry.get("features", [])
            bar.advance(len(chunk))
    report_missing(
        "batch/batches",
        "of accessions UniProt would not answer for, so those genes have no topology",
        refused,
        severity=FAILURE,
    )
    return out


def spans(feature_type: str, start: int, end: int) -> list[tuple[int, int]]:
    """Return the residue ranges a feature covers. The two positions of a disulfide bond
    are the two cysteines that are bonded together rather than the ends of one range."""
    if feature_type == "disulfide_bond":
        return [(start, start), (end, end)]
    return [(start, end)]


def feature_rows(gene_id: str, accession: str, features: list[dict]) -> list[dict]:
    rows = []
    for feature in features:
        feature_type = FEATURE_TYPES.get(feature["type"])
        if feature_type is None:
            continue
        location = feature["location"]
        start, end = location["start"]["value"], location["end"]["value"]
        if start is None or end is None:
            continue
        ligand = feature.get("ligand") or {}
        for span_start, span_end in spans(feature_type, start, end):
            rows.append(
                {
                    "gene_id": gene_id,
                    "uniprot_accession": accession,
                    "feature_type": feature_type,
                    "start": span_start,
                    "end": span_end,
                    "description": feature.get("description") or None,
                    "ligand_name": ligand.get("name"),
                    "ligand_chebi": ligand.get("id"),
                    "ligand_label": ligand.get("label"),
                }
            )
    return sorted(rows, key=lambda r: (r["start"], r["end"]))


def run(map_path: Path, out_path: Path) -> None:
    gene_map = pl.read_csv(map_path, separator="\t").drop_nulls("uniprot_accession")
    accessions = sorted(set(gene_map["uniprot_accession"].to_list()))
    console.detail(f"{len(accessions)} accessions for {gene_map.height} genes")

    by_accession = fetch_features(accessions)

    rows = []
    for gene in gene_map.iter_rows(named=True):
        accession = gene["uniprot_accession"]
        rows.extend(feature_rows(gene["gene_id"], accession, by_accession.get(accession, [])))

    with_features = {r["gene_id"] for r in rows}
    report_missing(
        "gene",
        "with no topology or binding features",
        [g for g in gene_map["gene_id"].to_list() if g not in with_features],
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(rows, schema=SCHEMA).write_csv(out_path, separator="\t")

    counts = pl.DataFrame(rows)["feature_type"].value_counts().sort("feature_type")
    summary = ", ".join(f"{r['feature_type']}={r['count']}" for r in counts.iter_rows(named=True))
    console.success(f"Wrote {len(rows)} features ({summary}) -> {out_path}")
