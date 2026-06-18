# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Shared family-key derivation, so annotate_slc_families.py and build_gene_tables.py
agree on the same SLC family key (a divergence would silently break their join)."""

import re

FAMILY_RE = re.compile(r"^Solute carrier family (\d+)(?:,.*)?$")
ORGANIC_ANION_GROUP_NAME = "Solute carrier organic anion transporter family"

ALIAS_RE = re.compile(r"^([A-Za-z0-9]+)\(([A-Za-z0-9]+)\)$")


def derive_family(group_name: str) -> str:
    """Family key from an HGNC 'Group name', e.g. 'Solute carrier family 1' -> 'SLC1'."""
    m = FAMILY_RE.match(group_name)
    if m:
        return f"SLC{m.group(1)}"
    if group_name == ORGANIC_ANION_GROUP_NAME:
        return "SLCO"
    raise ValueError(f"Unrecognized HGNC group name: {group_name!r}")
