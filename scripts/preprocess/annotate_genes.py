# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Append two columns to an HGNC gene-list TSV:
  Family            short family key from the HGNC group name (see derive_family_keys)
  Functional family display name (first bullet under each heading in family_names.md)
"""

import csv
import sys
from pathlib import Path

from gene_family_utils import derive_family_keys

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "backend" / "data"
REFERENCE_DIR = ROOT / "reference"
DEFAULT_HGNC_PATH = DATA_DIR / "raw" / "hgnc_family.txt"
DEFAULT_NAMES_PATH = REFERENCE_DIR / "family_names.md"
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
    hgnc_path: str,
    name_by_group: dict[str, str],
    family_key_by_group: dict[str, str],
    out_path: str,
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

    if unmatched:
        print(f"{len(unmatched)} gene(s) had no matching family name:", file=sys.stderr)
        for entry in unmatched:
            print(f"  {entry}", file=sys.stderr)


def main() -> None:
    args = sys.argv[1:]
    hgnc_path = args[0] if len(args) > 0 else DEFAULT_HGNC_PATH
    names_path = args[1] if len(args) > 1 else DEFAULT_NAMES_PATH
    out_path = args[2] if len(args) > 2 else DEFAULT_OUT_PATH

    with open(hgnc_path, encoding="utf-8", newline="") as f:
        all_rows = list(csv.DictReader(f, delimiter="\t"))

    family_key_by_group = derive_family_keys(all_rows)
    name_by_group = parse_family_names(names_path)
    annotate(hgnc_path, name_by_group, family_key_by_group, out_path)


if __name__ == "__main__":
    main()
