# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Get hold of the HGNC gene table that every later fetch step reads.

Given a group id, the table is downloaded from HGNC as it stands. Given a list of genes,
each one is looked up in the bulk hgnc_complete_set.txt and the results are written out
with the same thirteen columns, so that no later step has to know which of the two the
table came from.
"""

import csv
import shutil
import time
from pathlib import Path

from ..lib import console, interrupt, progress
from ..lib.http import download, fetch_text, get_json
from ..lib.reporting import report_missing

GROUP_TSV_URL = "https://www.genenames.org/cgi-bin/genegroup/download?id={id}&type={kind}"
GROUP_URL = "https://www.genenames.org/cgi-bin/genegroup/group?id={id}"
COMPLETE_SET_URL = (
    "https://storage.googleapis.com/public-download-files/hgnc/tsv/tsv/hgnc_complete_set.txt"
)
COMPLETE_SET_NAME = "hgnc_complete_set.txt"
REQUEST_INTERVAL = 0.2
GROUP_TSV_HEADER = "HGNC ID\t"

COLUMNS = (
    "HGNC ID",
    "Approved symbol",
    "Approved name",
    "Status",
    "Locus type",
    "Previous symbols",
    "Alias symbols",
    "Chromosome",
    "NCBI Gene ID",
    "Ensembl gene ID",
    "Vega gene ID",
    "Group ID",
    "Group name",
)

# The bulk-file column each of the columns above comes from, apart from the last two
BULK_FIELDS = (
    "hgnc_id",
    "symbol",
    "name",
    "status",
    "locus_type",
    "prev_symbol",
    "alias_symbol",
    "location",
    "entrez_id",
    "ensembl_gene_id",
    "vega_id",
)
BULK_MULTI = frozenset({"prev_symbol", "alias_symbol"})
LIST_GROUP_ID = "0"

NO_GENES = (
    "HGNC group {id} has no downloadable genes; check the id at "
    "https://www.genenames.org/data/genegroup/#!/group/{id}"
)
NOTHING_RESOLVED = (
    "none of the names in {path} matched an HGNC gene; the file should hold one approved "
    "symbol or Ensembl gene id per line"
)

_last_group_call = 0.0


def acquire(source: str, dest: Path) -> Path:
    """Write the gene table to dest unless it is already there, in which case delete it
    first to fetch it again."""
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    if source.isdigit():
        dest.write_text(_group_tsv(source), encoding="utf-8", newline="")
        return dest
    path = Path(source)
    if _is_group_tsv(path):
        shutil.copyfile(path, dest)
        return dest
    _write_group_tsv(dest, _resolve_list(path, dest.parent))
    return dest


def fetch_group_json(group_id: int) -> dict:
    global _last_group_call
    pause = REQUEST_INTERVAL - (time.monotonic() - _last_group_call)
    if pause > 0:
        interrupt.pause(pause)
    _last_group_call = time.monotonic()
    return get_json(GROUP_URL.format(id=group_id))


def _group_tsv(group_id: str) -> str:
    """Download the gene table of a group. A group with subgroups answers a request for its
    branch with all of them, and a group without any only answers a request for its node."""
    for kind in ("branch", "node"):
        body = fetch_text(GROUP_TSV_URL.format(id=group_id, kind=kind))
        if len([line for line in body.splitlines() if line.strip()]) > 1:
            return body
    raise SystemExit(NO_GENES.format(id=group_id))


def _is_group_tsv(path: Path) -> bool:
    with path.open(encoding="utf-8", errors="replace") as handle:
        return handle.readline().startswith(GROUP_TSV_HEADER)


def _write_group_tsv(dest: Path, rows: list[list[str]]) -> None:
    with dest.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(COLUMNS)
        writer.writerows(rows)


def _clean(value: str | None) -> str:
    """Strip the quotes the bulk file puts around a value that contains a pipe or a
    comma."""
    return (value or "").strip().strip('"')


def _parts(value: str | None) -> list[str]:
    return [part.strip() for part in _clean(value).split("|") if part.strip()]


def _read_names(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    lines = (line.split("#", 1)[0].strip() for line in text.splitlines())
    return [line for line in lines if line]


def _index(path: Path) -> tuple[dict[str, dict], list[dict[str, list[dict]]]]:
    """Index the bulk file, first by the keys that identify a gene exactly, which are its
    approved symbol and its Ensembl id, and then by the keys to fall back on, in the order
    they should be tried."""
    exact: dict[str, dict] = {}
    fallbacks: list[dict[str, list[dict]]] = [{}, {}]
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t", quoting=csv.QUOTE_NONE):
            for key in (_clean(row["symbol"]), _clean(row["ensembl_gene_id"])):
                if key:
                    exact[key] = row
            for table, field in zip(fallbacks, ("prev_symbol", "alias_symbol"), strict=True):
                for name in _parts(row[field]):
                    table.setdefault(name, []).append(row)
    return exact, fallbacks


def _matches(
    name: str, exact: dict[str, dict], fallbacks: list[dict[str, list[dict]]]
) -> list[dict]:
    row = exact.get(name)
    if row:
        return [row]
    for table in fallbacks:
        if name in table:
            return table[name]
    return []


def _group_row(row: dict, group_name: str) -> list[str]:
    values = [
        ", ".join(_parts(row[field])) if field in BULK_MULTI else _clean(row[field])
        for field in BULK_FIELDS
    ]
    return [*values, LIST_GROUP_ID, group_name]


def _resolve_list(path: Path, cache_dir: Path) -> list[list[str]]:
    complete_set = cache_dir / COMPLETE_SET_NAME
    if not complete_set.exists():
        console.detail(f"Downloading {COMPLETE_SET_NAME}")
        with progress.bytes_bar(COMPLETE_SET_NAME) as on_bytes:
            download(COMPLETE_SET_URL, complete_set, on_bytes)

    exact, fallbacks = _index(complete_set)
    rows: list[list[str]] = []
    ambiguous: list[str] = []
    missing: list[str] = []
    for name in _read_names(path):
        found = _matches(name, exact, fallbacks)
        if len(found) == 1:
            rows.append(_group_row(found[0], path.stem))
        elif found:
            ambiguous.append(f"{name}: {', '.join(sorted(_clean(r['symbol']) for r in found))}")
        else:
            missing.append(name)

    report_missing("name", "matching more than one gene, skipped", ambiguous)
    report_missing("name", "with no HGNC match", missing)
    if not rows:
        raise SystemExit(NOTHING_RESOLVED.format(path=path))
    return rows
