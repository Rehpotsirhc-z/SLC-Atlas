# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the structure manifest for every mapped accession.

3D-Beacons returns AlphaFold DB, AlphaFill, PDBe and SWISS-MODEL records under one
schema; the AlphaFold DB API is then asked for the binary-CIF URL and the pLDDT band
breakdown it alone carries.

Model URLs are stored exactly as the APIs report them. AlphaFold rolls its release
version into the filename and retires the old one, so a hand-built `_v6` URL becomes a
404 on the next release.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import get_json
from lib.reporting import report_missing

STRUCTURE_DIR = Path(__file__).resolve().parents[2] / "backend" / "data" / "dataset" / "structure"
DEFAULT_MAP_PATH = STRUCTURE_DIR / "uniprot_map.tsv"
DEFAULT_STRUCTURES_PATH = STRUCTURE_DIR / "structures.tsv"
DEFAULT_EXPERIMENTAL_PATH = STRUCTURE_DIR / "experimental.tsv"

BEACONS = "https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons/api/v2/uniprot/summary"
ALPHAFOLD = "https://alphafold.ebi.ac.uk/api/prediction"
WORKERS = 6

STRUCTURE_FIELDS = [
    "gene_id",
    "uniprot_accession",
    "afdb_entry_id",
    "afdb_version",
    "model_url",
    "model_format",
    "model_page_url",
    "mean_plddt",
    "frac_plddt_very_high",
    "frac_plddt_confident",
    "frac_plddt_low",
    "frac_plddt_very_low",
    "model_created",
    "confidence_url",
    "alphafill_url",
    "alphafill_page_url",
]

EXPERIMENTAL_FIELDS = [
    "gene_id",
    "uniprot_accession",
    "pdb_id",
    "method",
    "resolution",
    "coverage",
    "uniprot_start",
    "uniprot_end",
    "chains",
    "ligand_ccd",
    "model_url",
    "model_page_url",
    "created",
]

STRUCTURE_SCHEMA = {
    f: pl.Int64 if f == "afdb_version" else pl.Float64 if f.startswith(("mean_", "frac_")) else pl.Utf8
    for f in STRUCTURE_FIELDS
}
EXPERIMENTAL_SCHEMA = {
    f: pl.Int64 if f in ("uniprot_start", "uniprot_end")
    else pl.Float64 if f in ("resolution", "coverage")
    else pl.Utf8
    for f in EXPERIMENTAL_FIELDS
}


def fetch_accession(accession: str) -> dict:
    beacons = get_json(f"{BEACONS}/{accession}.json", absent=(404,)) or {}
    prediction = get_json(f"{ALPHAFOLD}/{accession}", absent=(404,))
    entry = None
    if isinstance(prediction, list):
        entry = next((p for p in prediction if p.get("entryId") == f"AF-{accession}-F1"), None)
    return {"structures": beacons.get("structures", []), "afdb": entry or {}}


def summaries(structures: list[dict], provider: str) -> list[dict]:
    return [s["summary"] for s in structures if s["summary"].get("provider") == provider]


def entity_values(summary: dict, entity_type: str, category: str) -> list[str]:
    return [
        e["identifier"]
        for e in summary.get("entities", [])
        if e.get("entity_type") == entity_type and e.get("identifier_category") == category
    ]


def structure_row(gene_id: str, accession: str, payload: dict) -> dict:
    afdb = payload["afdb"]
    beacon = next(iter(summaries(payload["structures"], "AlphaFold DB")), {})
    alphafill = next(iter(summaries(payload["structures"], "AlphaFill")), {})
    return {
        "gene_id": gene_id,
        "uniprot_accession": accession,
        "afdb_entry_id": afdb.get("entryId") or beacon.get("model_identifier"),
        "afdb_version": afdb.get("latestVersion"),
        "model_url": afdb.get("bcifUrl") or beacon.get("model_url"),
        "model_format": "BCIF" if afdb.get("bcifUrl") else beacon.get("model_format"),
        "model_page_url": beacon.get("model_page_url"),
        "mean_plddt": afdb.get("globalMetricValue") or beacon.get("confidence_avg_local_score"),
        "frac_plddt_very_high": afdb.get("fractionPlddtVeryHigh"),
        "frac_plddt_confident": afdb.get("fractionPlddtConfident"),
        "frac_plddt_low": afdb.get("fractionPlddtLow"),
        "frac_plddt_very_low": afdb.get("fractionPlddtVeryLow"),
        "model_created": afdb.get("modelCreatedDate") or beacon.get("created"),
        "confidence_url": afdb.get("plddtDocUrl"),
        "alphafill_url": alphafill.get("model_url"),
        "alphafill_page_url": alphafill.get("model_page_url"),
    }


def experimental_rows(gene_id: str, accession: str, payload: dict) -> list[dict]:
    rows = []
    for summary in summaries(payload["structures"], "PDBe"):
        chains = [
            chain
            for e in summary.get("entities", [])
            if e.get("identifier") == accession
            for chain in e.get("chain_ids", [])
        ]
        rows.append({
            "gene_id": gene_id,
            "uniprot_accession": accession,
            "pdb_id": summary.get("model_identifier"),
            "method": summary.get("experimental_method"),
            "resolution": summary.get("resolution"),
            "coverage": summary.get("coverage"),
            "uniprot_start": summary.get("uniprot_start"),
            "uniprot_end": summary.get("uniprot_end"),
            "chains": ",".join(chains) or None,
            "ligand_ccd": ",".join(entity_values(summary, "NON-POLYMER", "CCD")) or None,
            "model_url": summary.get("model_url"),
            "model_page_url": summary.get("model_page_url"),
            "created": summary.get("created"),
        })
    return sorted(rows, key=lambda r: r["pdb_id"] or "")


def main() -> None:
    args = sys.argv[1:]
    map_path = Path(args[0]) if len(args) > 0 else DEFAULT_MAP_PATH
    structures_path = Path(args[1]) if len(args) > 1 else DEFAULT_STRUCTURES_PATH
    experimental_path = Path(args[2]) if len(args) > 2 else DEFAULT_EXPERIMENTAL_PATH

    gene_map = pl.read_csv(map_path, separator="\t").drop_nulls("uniprot_accession")
    accessions = sorted(set(gene_map["uniprot_accession"].to_list()))
    print(f"{len(accessions)} accessions; querying 3D-Beacons and AlphaFold DB...", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        payloads = dict(zip(accessions, pool.map(fetch_accession, accessions)))

    structure_rows, experimental = [], []
    for gene in gene_map.iter_rows(named=True):
        gene_id, accession = gene["gene_id"], gene["uniprot_accession"]
        payload = payloads.get(accession, {"structures": [], "afdb": {}})
        structure_rows.append(structure_row(gene_id, accession, payload))
        experimental.extend(experimental_rows(gene_id, accession, payload))

    report_missing("gene(s) with no predicted model",
                   [r["gene_id"] for r in structure_rows if not r["model_url"]])

    structures_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(structure_rows, schema=STRUCTURE_SCHEMA).write_csv(structures_path, separator="\t")
    pl.DataFrame(experimental, schema=EXPERIMENTAL_SCHEMA).write_csv(
        experimental_path, separator="\t"
    )

    n_with_experimental = len({r["gene_id"] for r in experimental})
    n_alphafill = sum(1 for r in structure_rows if r["alphafill_url"])
    print(f"wrote {len(structure_rows)} models ({n_alphafill} with AlphaFill) -> {structures_path}",
          file=sys.stderr)
    print(f"wrote {len(experimental)} experimental entries for {n_with_experimental} genes "
          f"-> {experimental_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
