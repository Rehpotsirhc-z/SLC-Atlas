# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the list of structures available for every accession the genes map to.

3D-Beacons reports the records from AlphaFold DB, AlphaFill, PDBe and SWISS-MODEL in one
format, so they are all read from there. The AlphaFold DB API is then asked separately for
the binary-CIF URL and the breakdown of the pLDDT bands, which only it publishes.

Every model URL is stored exactly as the API reported it. AlphaFold puts its release
version in the filename and withdraws the previous one, so a URL that was assembled by
hand with a `_v6` in it stops working as soon as the next release comes out.

Which model to use is decided by comparing sequences rather than by trusting the entry
named after the accession. Whether the chosen model turned out to be the canonical sequence
is recorded in model_is_canonical, and it governs everything that needs the model
and the figure to be numbered alike: the confidence URL is left empty when it is
false, so no unplaceable score is ever fetched, and the app stands the figure
down from indexing the 3D viewer.
"""

from pathlib import Path

import polars as pl

from ..lib import console, progress

from ..lib.http import get_json
from ..lib.reporting import FAILURE, attempt, report_missing

BEACONS = "https://www.ebi.ac.uk/pdbe/pdbe-kb/3dbeacons/api/v2/uniprot/summary"
ALPHAFOLD = "https://alphafold.ebi.ac.uk/api/prediction"
ALPHAFOLD_ENTRY = "https://alphafold.ebi.ac.uk/entry"
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
    "model_is_canonical",
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

STRUCTURE_TYPES = {"afdb_version": pl.Int64, "model_is_canonical": pl.Boolean}
STRUCTURE_SCHEMA = {
    f: STRUCTURE_TYPES.get(f, pl.Float64 if f.startswith(("mean_", "frac_")) else pl.Utf8)
    for f in STRUCTURE_FIELDS
}
EXPERIMENTAL_SCHEMA = {
    f: (
        pl.Int64
        if f in ("uniprot_start", "uniprot_end")
        else pl.Float64 if f in ("resolution", "coverage") else pl.Utf8
    )
    for f in EXPERIMENTAL_FIELDS
}


def fetch_accession(accession: str) -> dict:
    beacons = get_json(f"{BEACONS}/{accession}.json", absent=(404,)) or {}
    prediction = get_json(f"{ALPHAFOLD}/{accession}", absent=(404,))
    return {
        "structures": beacons.get("structures", []),
        "predictions": prediction if isinstance(prediction, list) else [],
    }


def read_canonical(path: Path) -> dict[str, str]:
    """Return the UniProt canonical sequence of every accession in sequences.tsv.

    The file is absent when a dataset was fetched without that step, in which case there is
    nothing to compare a model against and no confidence scores can be placed.
    """
    if not path.exists():
        return {}
    sequences = pl.read_csv(path, separator="\t").drop_nulls("sequence")
    return dict(zip(sequences["uniprot_accession"], sequences["sequence"]))


def choose_entry(predictions: list[dict], accession: str, canonical: str | None) -> dict:
    """Return the predicted model whose sequence is the one the rest of the view counts in.

    AlphaFold builds a model from whatever sequence UniProt published at the time and does
    not rebuild it when UniProt revises the entry, so the model named after the accession is
    not always the canonical sequence that the features and the residue plot are numbered
    against. The isoform models AlphaFold publishes alongside it often are, so the model is
    chosen by comparing sequences.

    Nothing is ever aligned or shifted to make a model fit. A model that does not carry the
    canonical sequence exactly is still the best one to show in 3D, where it is numbered
    consistently with itself, so it is returned anyway and the caller declines its scores.
    """
    default = next((p for p in predictions if p.get("entryId") == f"AF-{accession}-F1"), {})
    if not canonical:
        return default
    ordered = [default, *(p for p in predictions if p is not default)]
    return next((p for p in ordered if p.get("uniprotSequence") == canonical), default)


def page_url(afdb: dict, beacon: dict) -> str | None:
    """Return the AlphaFold entry page for the model that was chosen.

    3D-Beacons answers with several AlphaFold summaries for some accessions, naming the same
    model by an internal numeric id in some of them, and in an order that is not stable
    between runs, so taking its page URL makes the file flap. AlphaFold's own entry id names
    the model that was actually chosen, and an entry page carries no release version, unlike
    a model file, so deriving the page from it is both stable and safe.
    """
    entry_id = afdb.get("entryId")
    return f"{ALPHAFOLD_ENTRY}/{entry_id}" if entry_id else beacon.get("model_page_url")


def summaries(structures: list[dict], provider: str) -> list[dict]:
    return [s["summary"] for s in structures if s["summary"].get("provider") == provider]


def entity_values(summary: dict, entity_type: str, category: str) -> list[str]:
    return [
        e["identifier"]
        for e in summary.get("entities", [])
        if e.get("entity_type") == entity_type and e.get("identifier_category") == category
    ]


def structure_row(gene_id: str, accession: str, payload: dict, canonical: str | None) -> dict:
    afdb = choose_entry(payload["predictions"], accession, canonical)
    beacon = next(iter(summaries(payload["structures"], "AlphaFold DB")), {})
    alphafill = next(iter(summaries(payload["structures"], "AlphaFill")), {})
    placeable = bool(canonical) and afdb.get("uniprotSequence") == canonical
    return {
        "gene_id": gene_id,
        "uniprot_accession": accession,
        "afdb_entry_id": afdb.get("entryId") or beacon.get("model_identifier"),
        "afdb_version": afdb.get("latestVersion"),
        "model_url": afdb.get("bcifUrl") or beacon.get("model_url"),
        "model_format": "BCIF" if afdb.get("bcifUrl") else beacon.get("model_format"),
        "model_page_url": page_url(afdb, beacon),
        "mean_plddt": afdb.get("globalMetricValue") or beacon.get("confidence_avg_local_score"),
        "frac_plddt_very_high": afdb.get("fractionPlddtVeryHigh"),
        "frac_plddt_confident": afdb.get("fractionPlddtConfident"),
        "frac_plddt_low": afdb.get("fractionPlddtLow"),
        "frac_plddt_very_low": afdb.get("fractionPlddtVeryLow"),
        "model_created": afdb.get("modelCreatedDate") or beacon.get("created"),
        "model_is_canonical": placeable,
        "confidence_url": afdb.get("plddtDocUrl") if placeable else None,
        "alphafill_url": alphafill.get("model_url"),
        "alphafill_page_url": alphafill.get("model_page_url"),
    }


def experimental_rows(gene_id: str, accession: str, payload: dict) -> list[dict]:
    rows = []
    for summary in summaries(payload["structures"], "PDBe"):
        # 3D-Beacons returns chain lists in an unstable order, so sorting keeps refetches diffable
        chains = sorted(
            chain
            for e in summary.get("entities", [])
            if e.get("identifier") == accession
            for chain in e.get("chain_ids", [])
        )
        rows.append(
            {
                "gene_id": gene_id,
                "uniprot_accession": accession,
                "pdb_id": summary.get("model_identifier"),
                "method": summary.get("experimental_method"),
                "resolution": summary.get("resolution"),
                "coverage": summary.get("coverage"),
                "uniprot_start": summary.get("uniprot_start"),
                "uniprot_end": summary.get("uniprot_end"),
                "chains": ",".join(chains) or None,
                "ligand_ccd": ",".join(sorted(entity_values(summary, "NON-POLYMER", "CCD")))
                or None,
                "model_url": summary.get("model_url"),
                "model_page_url": summary.get("model_page_url"),
                "created": summary.get("created"),
            }
        )
    return sorted(rows, key=lambda r: r["pdb_id"] or "")


def run(
    map_path: Path, sequences_path: Path, structures_path: Path, experimental_path: Path
) -> None:
    gene_map = pl.read_csv(map_path, separator="\t").drop_nulls("uniprot_accession")
    canonical = read_canonical(sequences_path)
    accessions = sorted(set(gene_map["uniprot_accession"].to_list()))
    console.detail(f"Querying 3D-Beacons and AlphaFold DB for {len(accessions)} accessions")

    refused: list[str] = []
    empty = {"structures": [], "predictions": []}
    with progress.bar("structures", total=len(accessions), noun="accessions") as bar:
        with console.pool(WORKERS) as pool:
            fetched = pool.map(
                lambda acc: attempt(acc, lambda: fetch_accession(acc), refused) or empty,
                accessions,
            )
            payloads = {}
            for accession, payload in zip(accessions, fetched):
                payloads[accession] = payload
                bar.advance()
    report_missing(
        "accession",
        "that 3D-Beacons or AlphaFold would not answer for, so they have no structures here",
        refused,
        severity=FAILURE,
        checked=len(accessions),
    )

    structure_rows, experimental = [], []
    for gene in gene_map.iter_rows(named=True):
        gene_id, accession = gene["gene_id"], gene["uniprot_accession"]
        payload = payloads.get(accession, {"structures": [], "predictions": []})
        structure_rows.append(structure_row(gene_id, accession, payload, canonical.get(accession)))
        experimental.extend(experimental_rows(gene_id, accession, payload))

    report_missing(
        "gene",
        "with no predicted model",
        [r["gene_id"] for r in structure_rows if not r["model_url"]],
    )
    report_missing(
        "gene",
        "whose model is an isoform entry, the entry named after the accession not carrying "
        "the canonical sequence",
        [
            f"{r['gene_id']} {r['uniprot_accession']}: {r['afdb_entry_id']}"
            for r in structure_rows
            if r["afdb_entry_id"] and r["afdb_entry_id"] != f"AF-{r['uniprot_accession']}-F1"
        ],
    )
    report_missing(
        "gene",
        "whose predicted model is built from a different sequence than the UniProt canonical, "
        "so it was given no per-residue confidence scores",
        [
            f"{r['gene_id']} {r['uniprot_accession']}"
            for r in structure_rows
            if r["model_url"] and not r["confidence_url"]
        ],
    )

    structures_path.parent.mkdir(parents=True, exist_ok=True)
    experimental_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(structure_rows, schema=STRUCTURE_SCHEMA).write_csv(structures_path, separator="\t")
    pl.DataFrame(experimental, schema=EXPERIMENTAL_SCHEMA).write_csv(
        experimental_path, separator="\t"
    )

    n_with_experimental = len({r["gene_id"] for r in experimental})
    n_alphafill = sum(1 for r in structure_rows if r["alphafill_url"])
    console.success(
        f"Wrote {len(structure_rows)} models ({n_alphafill} with AlphaFill) -> {structures_path}"
    )
    console.success(
        f"Wrote {len(experimental)} experimental entries for {n_with_experimental} genes "
        f"-> {experimental_path}"
    )
