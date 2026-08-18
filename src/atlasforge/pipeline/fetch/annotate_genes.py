# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Add two columns to an HGNC gene-list TSV, both of them read out of families.tsv.

The Family column holds the short key for the HGNC group the gene belongs to, and the
Functional family column holds the display name for that same group.
"""

import csv
from pathlib import Path

from ..lib.reporting import report_missing
from . import curation


def annotate(
    hgnc_path: Path,
    name_by_group: dict[str, str],
    family_key_by_group: dict[str, str],
    out_path: Path,
) -> None:
    with open(hgnc_path, encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        rows = list(reader)

    header, data_rows = rows[0], rows[1:]
    symbol_idx = header.index("Approved symbol")
    group_idx = header.index("Group name")
    header = [*header, "Family", "Functional family"]

    unmatched = []
    out_rows = [header]
    for row in data_rows:
        symbol = row[symbol_idx]
        group_name = row[group_idx].strip()
        family_key = family_key_by_group.get(group_name, "")
        functional_name = name_by_group.get(group_name, "")
        if not functional_name:
            unmatched.append(f"{symbol} ({group_name})")
        out_rows.append([*row, family_key, functional_name])

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerows(out_rows)

    report_missing("gene", "with no matching family name", unmatched)


def run(hgnc_path: Path, families_path: Path, out_path: Path) -> None:
    name_by_group, family_key_by_group = curation.read_families(families_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    annotate(hgnc_path, name_by_group, family_key_by_group, out_path)
