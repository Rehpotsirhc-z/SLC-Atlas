# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Uniform stderr diagnostics for pipeline steps."""

import sys
from collections.abc import Iterable

MAX_LISTED = 20


def report_missing(label: str, items: Iterable, limit: int = MAX_LISTED) -> None:
    items = list(items)
    if not items:
        return
    print(f"{len(items)} {label}:", file=sys.stderr)
    for item in items[:limit]:
        print(f"  {item}", file=sys.stderr)
    if len(items) > limit:
        print(f"  ... and {len(items) - limit} more", file=sys.stderr)
