# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Helpers that let every pipeline step report its problems to stderr in the same way."""

import sys
from collections.abc import Iterable

MAX_LISTED = 20


def count(noun: str, n: int) -> str:
    """A count and its noun agreeing in number, "entry/entries" giving an irregular plural."""
    singular, _, irregular = noun.partition("/")
    return f"{n} {singular if n == 1 else irregular or singular + 's'}"


def report_missing(noun: str, clause: str, items: Iterable, limit: int = MAX_LISTED) -> None:
    """The clause is a noun phrase, so that it reads the same however many items there are."""
    items = list(items)
    if not items:
        return
    print(f"{count(noun, len(items))} {clause}:", file=sys.stderr)
    for item in items[:limit]:
        print(f"  {item}", file=sys.stderr)
    if len(items) > limit:
        print(f"  ... and {len(items) - limit} more", file=sys.stderr)
