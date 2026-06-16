# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch short gene-summary blurbs from NCBI E-utilities.

Looks up every NCBI Gene ID in SLC_annotation.tsv via esummary and caches
the id -> summary mapping as a TSV.

Usage:
    python scripts/fetch_ncbi_summaries.py [SLC_annotation.tsv] [output.tsv]

Defaults to backend/data/SLC_annotation.tsv -> backend/data/raw/ncbi_gene_summaries.tsv.
"""

import csv
import json
import sys
import time
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_IN_PATH = DATA_DIR / "SLC_annotation.tsv"
DEFAULT_OUT_PATH = DATA_DIR / "raw" / "ncbi_gene_summaries.tsv"

ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
BATCH_SIZE = 200
REQUEST_INTERVAL = 0.4  # NCBI allows 3 req/s without an API key


def read_ncbi_ids(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return [row["NCBI Gene ID"] for row in reader if row["NCBI Gene ID"].strip()]


def fetch_batch(ids: list[str]) -> dict:
    url = f"{ESUMMARY_URL}?db=gene&id={','.join(ids)}&retmode=json"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.load(resp)["result"]


def fetch_all(ids: list[str]) -> dict[str, str]:
    summaries: dict[str, str] = {}
    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i : i + BATCH_SIZE]
        result = fetch_batch(batch)
        for uid in result.get("uids", []):
            summaries[uid] = result[uid].get("summary", "")
        if i + BATCH_SIZE < len(ids):
            time.sleep(REQUEST_INTERVAL)

    missing = [id_ for id_ in ids if id_ not in summaries]
    if missing:
        print(f"{len(missing)} NCBI Gene ID(s) had no match:", file=sys.stderr)
        for id_ in missing:
            print(f"  {id_}", file=sys.stderr)
    return summaries


def main() -> None:
    args = sys.argv[1:]
    in_path = args[0] if len(args) > 0 else DEFAULT_IN_PATH
    out_path = args[1] if len(args) > 1 else DEFAULT_OUT_PATH

    ids = read_ncbi_ids(in_path)
    summaries = fetch_all(ids)

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(["NCBI Gene ID", "Summary"])
        for id_ in ids:
            writer.writerow([id_, summaries.get(id_, "")])


if __name__ == "__main__":
    main()
