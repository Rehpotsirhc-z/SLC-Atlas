# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities used across the pipeline."""

import re
from os.path import commonprefix

# Matches HGNC alias notation like SLC7A5(LAT1)
ALIAS_RE = re.compile(r"^([A-Za-z0-9]+)\(([A-Za-z0-9]+)\)$")


SLC_FAMILY_RE = re.compile(r"^Solute carrier family (\d+)\b")


def derive_family_keys(rows: list[dict]) -> dict[str, str]:
    """Map HGNC 'Group name' -> short family key.

    The HGNC group name carries the family number directly, so for solute carrier
    families the key is taken from there ('Solute carrier family 40' -> 'SLC40').
    This is exact even for single-member families and for families whose gene isn't
    named SLC* (e.g. family 53 is gene XPR1, but the key is still 'SLC53').

    Group names without a family number (e.g. 'Solute carrier organic anion
    transporter family', or any non-SLC family fetched via a different parent group)
    fall back to the common prefix of the member symbols, trimmed to the last digit:
      SLCO1A2, SLCO2A1  ->  common prefix 'SLCO'  ->  'SLCO'
      KCNQ1,  KCNQ2     ->  common prefix 'KCNQ'  ->  'KCNQ'
    """
    groups: dict[str, list[str]] = {}
    for row in rows:
        groups.setdefault(row["Group name"].strip(), []).append(row["Approved symbol"].strip())

    result: dict[str, str] = {}
    for group_name, symbols in groups.items():
        m = SLC_FAMILY_RE.match(group_name)
        if m:
            result[group_name] = f"SLC{m.group(1)}"
            continue
        prefix = commonprefix(symbols)
        suffix = re.match(r"^(.*\d)", prefix)  # keep up to and including the last digit
        result[group_name] = suffix.group(1) if suffix else prefix
    return result
