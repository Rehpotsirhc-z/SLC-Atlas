# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Add a functional-family column to SLC.txt, sourced from groups.org.

Usage:
    python scripts/annotate_slc_families.py [SLC.txt] [groups.org] [output.tsv]

Defaults to backend/data/raw/SLC.txt, backend/data/raw/groups.org,
and backend/data/SLC_annotation.tsv.
"""

import csv
import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_SLC_PATH = DATA_DIR / "raw" / "SLC.txt"
DEFAULT_GROUPS_PATH = DATA_DIR / "raw" / "groups.org"
DEFAULT_OUT_PATH = DATA_DIR / "SLC_annotation.tsv"

ALIAS_RE = re.compile(r"^([A-Za-z0-9]+)\(([A-Za-z0-9]+)\)$")
SUBFAMILY_RE = re.compile(r"^subfamily\s+(\S+)$", re.IGNORECASE)


def parse_groups(path: str) -> dict[str, str]:
    family_by_symbol: dict[str, str] = {}
    parent_desc = None

    with open(path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            if line.startswith("**"):
                child_desc = line[2:].strip()
                m = SUBFAMILY_RE.match(child_desc)
                current_desc = f"{parent_desc} (subfamily {m.group(1)})" if m else child_desc
                continue

            if line.startswith("*"):
                parent_desc = line[1:].strip()
                current_desc = parent_desc
                continue

            if line.startswith("("):
                line = line[1:]
                if line.endswith(")"):
                    line = line[:-1]
                for token in line.split(","):
                    token = token.strip()
                    if not token:
                        continue
                    m = ALIAS_RE.match(token)
                    symbol = m.group(1) if m else token.strip("()")
                    family_by_symbol[symbol] = current_desc

    return family_by_symbol


def annotate(slc_path: str, family_by_symbol: dict[str, str], out_path: str) -> None:
    with open(slc_path, encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        rows = list(reader)

    header, data_rows = rows[0], rows[1:]
    symbol_idx = header.index("Approved symbol")
    header = [*header, "Functional family"]

    unmatched = []
    out_rows = [header]
    for row in data_rows:
        symbol = row[symbol_idx]
        family = family_by_symbol.get(symbol, "")
        if not family:
            unmatched.append(symbol)
        out_rows.append([*row, family])

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerows(out_rows)

    if unmatched:
        print(f"{len(unmatched)} symbol(s) had no matching family:", file=sys.stderr)
        for symbol in unmatched:
            print(f"  {symbol}", file=sys.stderr)


def main() -> None:
    args = sys.argv[1:]
    slc_path = args[0] if len(args) > 0 else DEFAULT_SLC_PATH
    groups_path = args[1] if len(args) > 1 else DEFAULT_GROUPS_PATH
    out_path = args[2] if len(args) > 2 else DEFAULT_OUT_PATH

    family_by_symbol = parse_groups(groups_path)
    annotate(slc_path, family_by_symbol, out_path)


if __name__ == "__main__":
    main()
