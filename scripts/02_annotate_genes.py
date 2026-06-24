# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Add functional-family columns to an HGNC gene-list TSV.

Two columns are appended:
  Family          short key from the HGNC group name's family number
                  (e.g. 'Solute carrier family 40' -> 'SLC40'); see derive_family_keys
  Functional family  display name — the first '- ' bullet under each '## <group>'
                  heading in the family names Markdown file; falls back to the
                  HGNC group name

Usage:
    python scripts/02_annotate_genes.py \\
        [hgnc_genes.txt] [family_names.md] [output.tsv]

Defaults to backend/data/raw/SLC.txt, backend/data/raw/family_names.md,
and backend/data/raw/annotation.tsv.
"""

import csv
import sys
from pathlib import Path

from gene_family_utils import derive_family_keys

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_SLC_PATH = DATA_DIR / "raw" / "SLC.txt"
DEFAULT_NAMES_PATH = DATA_DIR / "raw" / "family_names.md"
DEFAULT_OUT_PATH = DATA_DIR / "raw" / "annotation.tsv"


def parse_family_names(path: str) -> dict[str, str]:
    """Map HGNC group name -> display name (the first '- ' bullet under each
    '## <group name>' heading in the family names Markdown file)."""
    name_by_group: dict[str, str] = {}
    group_name = None
    with open(path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip()
            if line.startswith("## "):
                group_name = line[3:].strip()
            elif line.startswith("- ") and group_name is not None and group_name not in name_by_group:
                name_by_group[group_name] = line[2:].strip()
    return name_by_group


def annotate(
    slc_path: str,
    name_by_group: dict[str, str],
    family_key_by_group: dict[str, str],
    out_path: str,
) -> None:
    with open(slc_path, encoding="utf-8", newline="") as f:
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

    if unmatched:
        print(f"{len(unmatched)} gene(s) had no matching family name:", file=sys.stderr)
        for entry in unmatched:
            print(f"  {entry}", file=sys.stderr)


def main() -> None:
    args = sys.argv[1:]
    slc_path = args[0] if len(args) > 0 else DEFAULT_SLC_PATH
    names_path = args[1] if len(args) > 1 else DEFAULT_NAMES_PATH
    out_path = args[2] if len(args) > 2 else DEFAULT_OUT_PATH

    with open(slc_path, encoding="utf-8", newline="") as f:
        all_rows = list(csv.DictReader(f, delimiter="\t"))

    family_key_by_group = derive_family_keys(all_rows)
    name_by_group = parse_family_names(names_path)
    annotate(slc_path, name_by_group, family_key_by_group, out_path)


if __name__ == "__main__":
    main()
