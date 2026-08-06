# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Map dataset gene IDs to UniProt accessions, the key every structure source uses.

Two routes are tried in order: HGNC IDs from raw/annotation.tsv when that file exists
(the most complete route), then Ensembl gene IDs from the dataset itself, which is all a
hand-authored dataset needs. reference/uniprot_overrides.tsv wins over both.

Nothing downstream may join on gene symbol: many symbols in a family are HGNC aliases
rather than approved symbols, and a symbol join drops them silently.
"""

import csv
import json
import sys
import time
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import fetch_text, get_json, post_form
from lib.reporting import report_missing

ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = ROOT / "data" / "dataset"
DEFAULT_GENES_PATH = DATASET_DIR / "genes.tsv"
DEFAULT_PROTEIN_PATH = DATASET_DIR / "protein.fasta"
DEFAULT_OUT_PATH = DATASET_DIR / "structure" / "uniprot_map.tsv"
ANNOTATION_PATH = ROOT / "data" / "raw" / "annotation.tsv"
OVERRIDES_PATH = ROOT / "reference" / "uniprot_overrides.tsv"

REST = "https://rest.uniprot.org"
MAP_BATCH = 400  # keeps every job's result set inside one 500-row page
ACCESSION_BATCH = 100  # /uniprotkb/accessions hard limit
POLL_SECONDS = 2
MAX_POLLS = 60

FIELDS = [
    "gene_id",
    "symbol",
    "uniprot_accession",
    "uniprot_id",
    "uniprot_length",
    "seq_agreement",  # exact | isoform | differs | unknown
    "id_route",  # hgnc | ensembl | override
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
    """gene_id -> HGNC:nnn, from the preprocess annotation intermediate when present."""
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
    """source id -> accessions, via the asynchronous UniProt ID-mapping service."""
    mapped: dict[str, list[str]] = {}
    for i in range(0, len(ids), MAP_BATCH):
        chunk = ids[i : i + MAP_BATCH]
        job = post_form(
            f"{REST}/idmapping/run",
            {"from": from_db, "to": "UniProtKB-Swiss-Prot", "ids": ",".join(chunk)},
        )
        job_id = json.loads(job)["jobId"]
        for _ in range(MAX_POLLS):
            status = get_json(f"{REST}/idmapping/status/{job_id}")
            if status.get("jobStatus") in (None, "FINISHED"):
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
    """accession -> {uniprot_id, length, sequence}."""
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
    """Prefer the accession whose canonical sequence is the one the dataset already has,
    so residue numbering in the structure view matches the sequences used elsewhere."""
    if ensembl_seq:
        for acc in candidates:
            if entries.get(acc, {}).get("sequence") == ensembl_seq:
                return acc
    return sorted(candidates)[0]


def resolve(genes: pl.DataFrame, hgnc_ids: dict[str, str], overrides: dict[str, str]) -> dict:
    gene_ids = genes["id"].to_list()

    # annotation.tsv predates the pseudogene exclusions, so it carries genes the dataset dropped
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
        print(f"{len(overrides)} override(s) applied", file=sys.stderr)

    return routes


def main() -> None:
    args = sys.argv[1:]
    genes_path = Path(args[0]) if len(args) > 0 else DEFAULT_GENES_PATH
    protein_path = Path(args[1]) if len(args) > 1 else DEFAULT_PROTEIN_PATH
    out_path = Path(args[2]) if len(args) > 2 else DEFAULT_OUT_PATH

    genes = pl.read_csv(genes_path, separator="\t", columns=["id", "symbol"])
    ensembl_proteins = read_fasta(protein_path)
    routes = resolve(genes, read_hgnc_ids(ANNOTATION_PATH), read_overrides(OVERRIDES_PATH))

    entries = fetch_entries(sorted({a for accs, _ in routes.values() for a in accs}))

    rows = []
    ambiguous = []
    for gene in genes.iter_rows(named=True):
        gene_id = gene["id"]
        candidates, route = routes.get(gene_id, ([], ""))
        if not candidates:
            rows.append({**dict.fromkeys(FIELDS), "gene_id": gene_id, "symbol": gene["symbol"],
                         "seq_agreement": "unknown"})
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

        rows.append({
            "gene_id": gene_id,
            "symbol": gene["symbol"],
            "uniprot_accession": accession,
            "uniprot_id": entry.get("uniprot_id"),
            "uniprot_length": entry.get("length"),
            "seq_agreement": agreement,
            "id_route": route,
        })

    report_missing("gene(s) with no UniProt accession",
                   [r["gene_id"] for r in rows if not r["uniprot_accession"]])
    report_missing("gene(s) mapping to more than one accession", ambiguous)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(rows, schema={f: pl.Int64 if f == "uniprot_length" else pl.Utf8 for f in FIELDS}
                 ).write_csv(out_path, separator="\t")

    counts = pl.DataFrame(rows)["seq_agreement"].value_counts().sort("seq_agreement")
    summary = ", ".join(f"{r['seq_agreement']}={r['count']}" for r in counts.iter_rows(named=True))
    print(f"wrote {len(rows)} rows ({summary}) -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
