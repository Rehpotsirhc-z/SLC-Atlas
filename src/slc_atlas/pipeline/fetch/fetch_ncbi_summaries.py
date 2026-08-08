# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the short summary that NCBI publishes for each gene and write them out as a TSV.

The summaries come from the esummary endpoint of the NCBI E-utilities API.
"""

import csv
import time
from pathlib import Path

from ..lib.http import get_json
from ..lib.reporting import report_missing

ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
BATCH_SIZE = 200
REQUEST_INTERVAL = 0.4  # NCBI allows 3 requests a second without an API key


def read_ncbi_ids(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return [row["NCBI Gene ID"] for row in reader if row["NCBI Gene ID"].strip()]


def fetch_batch(ids: list[str]) -> dict:
    return get_json(f"{ESUMMARY_URL}?db=gene&id={','.join(ids)}&retmode=json")["result"]


def fetch_all(ids: list[str]) -> dict[str, str]:
    summaries: dict[str, str] = {}
    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i : i + BATCH_SIZE]
        result = fetch_batch(batch)
        for uid in result.get("uids", []):
            summaries[uid] = result[uid].get("summary", "")
        if i + BATCH_SIZE < len(ids):
            time.sleep(REQUEST_INTERVAL)

    report_missing(
        "NCBI gene id", "with no summary at NCBI", [i for i in ids if i not in summaries]
    )
    return summaries


def run(annotation_path: Path, out_path: Path) -> None:
    ids = read_ncbi_ids(annotation_path)
    summaries = fetch_all(ids)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(["NCBI Gene ID", "Summary"])
        for id_ in ids:
            writer.writerow([id_, summaries.get(id_, "")])
