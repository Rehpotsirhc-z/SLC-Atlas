# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch membrane topology and ligand-binding features from UniProt.

Positions are UniProt canonical residue numbering, which is what the structure models
are indexed by; uniprot_map.tsv's seq_agreement column records where that differs from
the Ensembl canonical protein the rest of the dataset uses.
"""

import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import get_json
from lib.reporting import report_missing

STRUCTURE_DIR = Path(__file__).resolve().parents[2] / "backend" / "data" / "dataset" / "structure"
DEFAULT_MAP_PATH = STRUCTURE_DIR / "uniprot_map.tsv"
DEFAULT_OUT_PATH = STRUCTURE_DIR / "features.tsv"

REST = "https://rest.uniprot.org"
ACCESSION_BATCH = 100  # /uniprotkb/accessions hard limit

# UniProt's JSON feature labels -> our enum
FEATURE_TYPES = {
    "Transmembrane": "transmembrane",
    "Topological domain": "topological_domain",
    "Binding site": "binding_site",
    "Active site": "active_site",
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
]

SCHEMA = {f: pl.Int64 if f in ("start", "end") else pl.Utf8 for f in FIELDS}


def fetch_features(accessions: list[str]) -> dict[str, list[dict]]:
    """accession -> feature dicts, in sequence order."""
    out: dict[str, list[dict]] = {}
    for i in range(0, len(accessions), ACCESSION_BATCH):
        chunk = accessions[i : i + ACCESSION_BATCH]
        payload = get_json(
            f"{REST}/uniprotkb/accessions?accessions={','.join(chunk)}"
            f"&format=json&fields=accession,ft_transmem,ft_topo_dom,ft_binding,ft_act_site"
        )
        for entry in payload.get("results", []):
            out[entry["primaryAccession"]] = entry.get("features", [])
        print(f"  {min(i + ACCESSION_BATCH, len(accessions))}/{len(accessions)} accessions",
              file=sys.stderr)
    return out


def feature_rows(gene_id: str, accession: str, features: list[dict]) -> list[dict]:
    rows = []
    for feature in features:
        feature_type = FEATURE_TYPES.get(feature["type"])
        if feature_type is None:
            continue
        ligand = feature.get("ligand") or {}
        rows.append({
            "gene_id": gene_id,
            "uniprot_accession": accession,
            "feature_type": feature_type,
            "start": feature["location"]["start"]["value"],
            "end": feature["location"]["end"]["value"],
            "description": feature.get("description") or None,
            "ligand_name": ligand.get("name"),
            "ligand_chebi": ligand.get("id"),
        })
    return sorted(rows, key=lambda r: (r["start"], r["end"]))


def main() -> None:
    args = sys.argv[1:]
    map_path = Path(args[0]) if len(args) > 0 else DEFAULT_MAP_PATH
    out_path = Path(args[1]) if len(args) > 1 else DEFAULT_OUT_PATH

    gene_map = pl.read_csv(map_path, separator="\t").drop_nulls("uniprot_accession")
    accessions = sorted(set(gene_map["uniprot_accession"].to_list()))
    print(f"{len(accessions)} accessions for {gene_map.height} genes", file=sys.stderr)

    by_accession = fetch_features(accessions)

    rows = []
    for gene in gene_map.iter_rows(named=True):
        accession = gene["uniprot_accession"]
        rows.extend(feature_rows(gene["gene_id"], accession, by_accession.get(accession, [])))

    with_features = {r["gene_id"] for r in rows}
    report_missing(
        "gene(s) with no topology or binding features",
        [g for g in gene_map["gene_id"].to_list() if g not in with_features],
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(rows, schema=SCHEMA).write_csv(out_path, separator="\t")

    counts = pl.DataFrame(rows)["feature_type"].value_counts().sort("feature_type")
    summary = ", ".join(f"{r['feature_type']}={r['count']}" for r in counts.iter_rows(named=True))
    print(f"wrote {len(rows)} features ({summary}) -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
