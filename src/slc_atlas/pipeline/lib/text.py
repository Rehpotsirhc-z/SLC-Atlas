# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Ordering for gene and family labels."""

import re


def natural_key(s: str) -> list:
    """Split a label into runs of letters and runs of digits, so that SLC2 sorts before
    SLC10 rather than after it."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]
