# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities used across the pipeline."""

import re
from os.path import commonprefix

# Matches HGNC alias notation like SLC7A5(LAT1)
ALIAS_RE = re.compile(r"^([A-Za-z0-9]+)\(([A-Za-z0-9]+)\)$")


def derive_family_keys(rows: list[dict]) -> dict[str, str]:
    """Map HGNC 'Group name' -> short family key derived from the common symbol prefix.

    Groups all 'Approved symbol' values by 'Group name', finds the common prefix,
    then strips any trailing letters that follow the last digit:
      SLC1A1, SLC1A2, SLC1A3  ->  common prefix 'SLC1A'  ->  'SLC1'
      KCNQ1,  KCNQ2,  KCNQ3   ->  common prefix 'KCNQ'   ->  'KCNQ'
      SLCO1A2, SLCO2A1         ->  common prefix 'SLCO'   ->  'SLCO'
    """
    groups: dict[str, list[str]] = {}
    for row in rows:
        groups.setdefault(row["Group name"].strip(), []).append(row["Approved symbol"].strip())

    result: dict[str, str] = {}
    for group_name, symbols in groups.items():
        prefix = commonprefix(symbols)
        m = re.match(r"^(.*\d)", prefix)  # keep up to and including the last digit
        result[group_name] = m.group(1) if m else prefix
    return result
