# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Work out the UniProt accession of each gene, which is the id every structure source is
keyed by.

Two ways of doing this are tried in turn. The first uses the HGNC ids in
cache/annotation.tsv, if that file has been written, and finds the most accessions. The
second uses the Ensembl gene ids in source/genes.tsv, which is all that an atlas written
by hand has to offer. An accession given in the curated uniprot_overrides.tsv is used in
preference to whatever either of them found.

No later step joins on the gene symbol. Many of the symbols in a family are HGNC aliases
rather than approved symbols, so joining on the symbol would quietly lose those genes.
"""

import csv
import json
import sys
import time
from pathlib import Path

import polars as pl

from ..lib.http import fetch_text, get_json, post_form
from ..lib.reporting import count, report_missing

REST = "https://rest.uniprot.org"
MAP_BATCH = 400  # Small enough that every job's results fit on one 500-row page
ACCESSION_BATCH = 100  # The most accessions /uniprotkb/accessions accepts at once
POLL_SECONDS = 2
MAX_POLLS = 60

FIELDS = [
    "gene_id",
    "symbol",
    "uniprot_accession",
    "uniprot_id",
    "uniprot_length",
    "seq_agreement",  # One of exact, isoform, differs or unknown
    "id_route",  # Which of hgnc, ensembl or override the accession was found through
]


def read_fasta(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    sequences: dict[str, str] = {}
    key = None
    chunks: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(">"):
            if key:
                sequences[key] = "".join(chunks)
            key = line[1:].split()[0]
            chunks = []
        elif key:
            chunks.append(line.strip())
    if key:
        sequences[key] = "".join(chunks)
    return sequences


def read_hgnc_ids(path: Path) -> dict[str, str]:
    """Return the HGNC id of each gene, keyed by gene id, read from the cached annotation
    file if that file has been written."""
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    return {
        r["Ensembl gene ID"]: r["HGNC ID"]
        for r in rows
        if r.get("Ensembl gene ID") and r.get("HGNC ID")
    }


def read_overrides(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader((ln for ln in f if not ln.startswith("#")), delimiter="\t")
        return {r["gene_id"]: r["uniprot_accession"] for r in reader if r.get("uniprot_accession")}


def run_mapping(from_db: str, ids: list[str]) -> dict[str, list[str]]:
    """Return the UniProt accessions that each of the given ids maps to, using UniProt's
    ID-mapping service, which runs the job in the background and is polled for the
    result."""
    mapped: dict[str, list[str]] = {}
    for i in range(0, len(ids), MAP_BATCH):
        chunk = ids[i : i + MAP_BATCH]
        job = post_form(
            f"{REST}/idmapping/run",
            {"from": from_db, "to": "UniProtKB-Swiss-Prot", "ids": ",".join(chunk)},
        )
        job_id = json.loads(job)["jobId"]
        for _ in range(MAX_POLLS):
            # UniProt sometimes answers a valid poll with a bare 400, so treat it as not ready
            status = get_json(f"{REST}/idmapping/status/{job_id}", absent=(400,))
            if status is not None and status.get("jobStatus") in (None, "FINISHED"):
                break
            time.sleep(POLL_SECONDS)
        else:
            raise RuntimeError(f"UniProt mapping job {job_id} never finished")

        body = fetch_text(f"{REST}/idmapping/results/{job_id}?format=tsv&size=500")
        for line in body.splitlines()[1:]:
            src, _, acc = line.partition("\t")
            if acc:
                mapped.setdefault(src, []).append(acc.strip())
    return mapped


def fetch_entries(accessions: list[str]) -> dict[str, dict]:
    """Return the entry name, the sequence and its length for each accession."""
    entries: dict[str, dict] = {}
    for i in range(0, len(accessions), ACCESSION_BATCH):
        chunk = accessions[i : i + ACCESSION_BATCH]
        payload = get_json(
            f"{REST}/uniprotkb/accessions?accessions={','.join(chunk)}"
            f"&format=json&fields=accession,id,sequence"
        )
        for entry in payload.get("results", []):
            entries[entry["primaryAccession"]] = {
                "uniprot_id": entry.get("uniProtkbId"),
                "length": entry["sequence"]["length"],
                "sequence": entry["sequence"]["value"],
            }
    return entries


def matches_isoform(accession: str, sequence: str) -> bool:
    body = fetch_text(
        f"{REST}/uniprotkb/search?query=accession:{accession}&includeIsoform=true&format=fasta"
    )
    current: list[str] = []
    for line in body.splitlines():
        if line.startswith(">"):
            if "".join(current) == sequence:
                return True
            current = []
        else:
            current.append(line.strip())
    return "".join(current) == sequence


def pick_accession(candidates: list[str], entries: dict[str, dict], ensembl_seq: str | None) -> str:
    """Choose the accession whose canonical sequence is the one the source files already
    hold, so that the residues are numbered the same way in the structure view as they are
    everywhere else."""
    if ensembl_seq:
        for acc in candidates:
            if entries.get(acc, {}).get("sequence") == ensembl_seq:
                return acc
    return sorted(candidates)[0]


def resolve(genes: pl.DataFrame, hgnc_ids: dict[str, str], overrides: dict[str, str]) -> dict:
    gene_ids = genes["id"].to_list()

    # The annotation file is written before the exclusions are applied, so it still holds
    # the genes that were left out of genes.tsv
    hgnc_ids = {g: h for g, h in hgnc_ids.items() if g in set(gene_ids)}

    routes: dict[str, tuple[list[str], str]] = {}
    if hgnc_ids:
        by_hgnc = run_mapping("HGNC", sorted(set(hgnc_ids.values())))
        for gene_id, hgnc in hgnc_ids.items():
            if by_hgnc.get(hgnc):
                routes[gene_id] = (by_hgnc[hgnc], "hgnc")
        print(f"HGNC route mapped {len(routes)}/{len(gene_ids)} genes", file=sys.stderr)

    unmapped = [g for g in gene_ids if g not in routes]
    if unmapped:
        before = len(routes)
        by_ensembl = run_mapping("Ensembl", unmapped)
        for gene_id in unmapped:
            if by_ensembl.get(gene_id):
                routes[gene_id] = (by_ensembl[gene_id], "ensembl")
        print(f"Ensembl route added {len(routes) - before} genes", file=sys.stderr)

    for gene_id, accession in overrides.items():
        routes[gene_id] = ([accession], "override")
    if overrides:
        print(f"{count('override', len(overrides))} applied", file=sys.stderr)

    return routes


def run(
    genes_path: Path,
    protein_path: Path,
    annotation_path: Path,
    overrides_path: Path,
    out_path: Path,
) -> None:
    genes = pl.read_csv(genes_path, separator="\t", columns=["id", "symbol"])
    ensembl_proteins = read_fasta(protein_path)
    routes = resolve(genes, read_hgnc_ids(annotation_path), read_overrides(overrides_path))

    entries = fetch_entries(sorted({a for accs, _ in routes.values() for a in accs}))

    rows = []
    ambiguous = []
    for gene in genes.iter_rows(named=True):
        gene_id = gene["id"]
        candidates, route = routes.get(gene_id, ([], ""))
        if not candidates:
            rows.append(
                {
                    **dict.fromkeys(FIELDS),
                    "gene_id": gene_id,
                    "symbol": gene["symbol"],
                    "seq_agreement": "unknown",
                }
            )
            continue
        if len(candidates) > 1:
            ambiguous.append(f"{gene['symbol']} ({gene_id}): {', '.join(sorted(candidates))}")

        ensembl_seq = ensembl_proteins.get(gene_id)
        accession = pick_accession(candidates, entries, ensembl_seq)
        entry = entries.get(accession, {})

        if not ensembl_seq:
            agreement = "unknown"
        elif entry.get("sequence") == ensembl_seq:
            agreement = "exact"
        elif matches_isoform(accession, ensembl_seq):
            agreement = "isoform"
        else:
            agreement = "differs"

        rows.append(
            {
                "gene_id": gene_id,
                "symbol": gene["symbol"],
                "uniprot_accession": accession,
                "uniprot_id": entry.get("uniprot_id"),
                "uniprot_length": entry.get("length"),
                "seq_agreement": agreement,
                "id_route": route,
            }
        )

    report_missing(
        "gene",
        "with no UniProt accession",
        [r["gene_id"] for r in rows if not r["uniprot_accession"]],
    )
    report_missing("gene", "mapping to more than one accession", ambiguous)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(
        rows, schema={f: pl.Int64 if f == "uniprot_length" else pl.Utf8 for f in FIELDS}
    ).write_csv(out_path, separator="\t")

    counts = pl.DataFrame(rows)["seq_agreement"].value_counts().sort("seq_agreement")
    summary = ", ".join(f"{r['seq_agreement']}={r['count']}" for r in counts.iter_rows(named=True))
    print(f"wrote {len(rows)} rows ({summary}) -> {out_path}", file=sys.stderr)
