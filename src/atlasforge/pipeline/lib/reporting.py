# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Report pipeline findings consistently and retain them for the run summary."""

import threading
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any

from . import console

MAX_LISTED = 20

NOTE = "note"
WARN = "warn"
FAILURE = "error"


@dataclass(frozen=True)
class Anomaly:
    step: str
    severity: str
    headline: str
    items: tuple[str, ...] = field(default=())


_lock = threading.Lock()
_anomalies: list[Anomaly] = []


def count(noun: str, n: int) -> str:
    """A count and its noun agreeing in number, "entry/entries" giving an irregular plural."""
    singular, _, irregular = noun.partition("/")
    return f"{n} {singular if n == 1 else irregular or singular + 's'}"


def report_missing(
    noun: str,
    clause: str,
    items: Iterable,
    limit: int = MAX_LISTED,
    *,
    severity: str = WARN,
    checked: int = 0,
    clean: str = "",
) -> int:
    """Report the items and return how many there were.

    The clause is a noun phrase, so that it reads the same however many items there are.
    Passing `checked` gives the count a denominator, and `clean` is the sentence to print
    when there are no items at all, for a check whose silence would otherwise be
    indistinguishable from never having run.
    """
    items = [str(item) for item in items]
    if not items:
        if clean:
            console.note(clean)
        return 0
    # The denominator carries the noun, so the count in front of it stays a bare number
    headline = (
        f"{len(items)} of {count(noun, checked)} {clause}"
        if checked
        else f"{count(noun, len(items))} {clause}"
    )
    _emit(severity, headline)
    console.bullets(items, limit)
    record(severity, headline, items)
    return len(items)


def attempt(label: str, work: Callable[[], Any], failures: list[str]) -> Any:
    """Do one item's worth of work, keeping a failure rather than ending the step.

    SystemExit is left alone because a step raises it for something the user has to fix, which
    is not made better by carrying on through it.
    """
    try:
        return work()
    except SystemExit:
        raise
    except Exception as error:
        failures.append(f"{label}: {error}")
        return None


def record(severity: str, headline: str, items: Sequence[str] = ()) -> None:
    """Keep a finding for the end-of-run summary without printing it again."""
    with _lock:
        _anomalies.append(
            Anomaly(console.current_step(), severity, headline, tuple(items[:MAX_LISTED]))
        )


def findings(step: str = "") -> list[Anomaly]:
    with _lock:
        return [a for a in _anomalies if not step or a.step == step]


def failed(step: str) -> bool:
    """Whether the step lost something it was meant to fetch, which makes it partial."""
    return any(a.severity == FAILURE for a in findings(step))


def reset() -> None:
    with _lock:
        _anomalies.clear()


def _emit(severity: str, headline: str) -> None:
    if severity == NOTE:
        console.note(headline)
    elif severity == FAILURE:
        console.error(headline)
    else:
        console.warn(headline)
