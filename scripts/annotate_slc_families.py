# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Add functional-family columns to SLC.txt.

The 'Functional family' column is the family's functional name, taken from the HGNC
alias file (the first bullet under each family in hgnc_family_aliases.org) and assigned
by HGNC family key (derived from 'Group name'), so every gene is covered. The
'Subcategory' column carries the optional groups.org subfamily descriptor (only
SLC7/SLCO/SLC35 have these).

Usage:
    python scripts/annotate_slc_families.py \\
        [SLC.txt] [hgnc_family_aliases.org] [groups.org] [output.tsv]

Defaults to backend/data/raw/SLC.txt, backend/data/raw/hgnc_family_aliases.org,
backend/data/raw/groups.org, and backend/data/SLC_annotation.tsv.
"""

import csv
import re
import sys
from pathlib import Path

from slc_family import ALIAS_RE, derive_family

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_SLC_PATH = DATA_DIR / "raw" / "SLC.txt"
DEFAULT_HGNC_PATH = DATA_DIR / "raw" / "hgnc_family_aliases.org"
DEFAULT_GROUPS_PATH = DATA_DIR / "raw" / "groups.org"
DEFAULT_OUT_PATH = DATA_DIR / "SLC_annotation.tsv"

SUBFAMILY_RE = re.compile(r"^subfamily\s+(\S+)$", re.IGNORECASE)


def parse_family_names(path: str) -> dict[str, str]:
    """Map family key -> functional name (the first '- ' bullet under each '* KEY'
    headline in the HGNC alias file)."""
    name_by_family: dict[str, str] = {}
    family = None
    with open(path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip()
            if line.startswith("#") or not line.strip():
                continue
            if line.startswith("* "):
                family = line[2:].strip()
            elif line.startswith("- ") and family is not None and family not in name_by_family:
                name_by_family[family] = line[2:].strip()
    return name_by_family


def parse_subcategories(path: str) -> dict[str, str]:
    """Map gene symbol -> subfamily descriptor, for genes under a '**' subfamily line
    in groups.org (only SLC7/SLCO/SLC35 populate this)."""
    subfamily_by_symbol: dict[str, str] = {}
    subfamily_desc = None

    with open(path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            if line.startswith("**"):
                child_desc = line[2:].strip()
                m = SUBFAMILY_RE.match(child_desc)
                subfamily_desc = f"subfamily {m.group(1)}" if m else child_desc
                continue

            if line.startswith("*"):
                subfamily_desc = None
                continue

            if line.startswith("(") and subfamily_desc is not None:
                line = line[1:]
                if line.endswith(")"):
                    line = line[:-1]
                for token in line.split(","):
                    token = token.strip()
                    if not token:
                        continue
                    m = ALIAS_RE.match(token)
                    symbol = m.group(1) if m else token.strip("()")
                    subfamily_by_symbol[symbol] = subfamily_desc

    return subfamily_by_symbol


def annotate(
    slc_path: str,
    name_by_family: dict[str, str],
    subfamily_by_symbol: dict[str, str],
    out_path: str,
) -> None:
    with open(slc_path, encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        rows = list(reader)

    header, data_rows = rows[0], rows[1:]
    symbol_idx = header.index("Approved symbol")
    group_idx = header.index("Group name")
    header = [*header, "Functional family", "Subcategory"]

    unmatched = []
    out_rows = [header]
    for row in data_rows:
        symbol = row[symbol_idx]
        family_key = derive_family(row[group_idx].strip())
        family = name_by_family.get(family_key, "")
        if not family:
            unmatched.append(f"{symbol} ({family_key})")
        subcategory = subfamily_by_symbol.get(symbol, "")
        out_rows.append([*row, family, subcategory])

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerows(out_rows)

    if unmatched:
        print(f"{len(unmatched)} gene(s) had no matching family:", file=sys.stderr)
        for entry in unmatched:
            print(f"  {entry}", file=sys.stderr)


def main() -> None:
    args = sys.argv[1:]
    slc_path = args[0] if len(args) > 0 else DEFAULT_SLC_PATH
    hgnc_path = args[1] if len(args) > 1 else DEFAULT_HGNC_PATH
    groups_path = args[2] if len(args) > 2 else DEFAULT_GROUPS_PATH
    out_path = args[3] if len(args) > 3 else DEFAULT_OUT_PATH

    name_by_family = parse_family_names(hgnc_path)
    subfamily_by_symbol = parse_subcategories(groups_path)
    annotate(slc_path, name_by_family, subfamily_by_symbol, out_path)


if __name__ == "__main__":
    main()
