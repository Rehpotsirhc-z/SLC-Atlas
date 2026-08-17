# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Show shared progress bars in terminals and periodic updates in logs."""

import os
import threading
import time
from collections.abc import Generator, Iterable, Iterator
from contextlib import contextmanager

from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeElapsedColumn,
)

from . import console, interrupt

REFRESH_PER_SECOND = 4

UNKNOWN_STRIDE = 5000

QUIET_SECONDS = 5.0

_progress: Progress | None = None
_running = 0
_lock = threading.Lock()


def disabled() -> bool:
    return bool(os.environ.get("ATLAS_NO_PROGRESS")) or not console.console.is_terminal


def _columns() -> tuple:
    return (
        SpinnerColumn(),
        TextColumn("{task.description}", markup=False),
        BarColumn(),
        MofNCompleteColumn(),
        TaskProgressColumn(),
        TimeElapsedColumn(),
    )


@contextmanager
def display() -> Generator[None]:
    """Provide a lazily started progress display for a pipeline phase."""
    global _progress, _running
    if _progress is not None:
        yield
        return
    _progress = Progress(
        *_columns(),
        console=console.console,
        transient=True,
        auto_refresh=True,
        refresh_per_second=REFRESH_PER_SECOND,
        disable=disabled(),
    )
    try:
        yield
    finally:
        with _lock:
            if _running:
                _progress.stop()
            _running = 0
        _progress = None


def _acquire() -> Progress | None:
    global _running
    if _progress is None or disabled():
        return None
    with _lock:
        if _running == 0:
            _progress.start()
        _running += 1
    return _progress


def _release() -> None:
    global _running
    if _progress is None:
        return
    with _lock:
        _running = max(0, _running - 1)
        if _running == 0:
            _progress.stop()


class Bar:
    """A count of work in progress that reports itself whether or not anyone is watching."""

    def __init__(self, label: str, total: int | None, noun: str) -> None:
        self.label = label
        self.total = total
        self.noun = noun
        self.done = 0
        self._pending = 0
        self._spoke = 0.0
        self._stride = max(1, total // 500) if total else UNKNOWN_STRIDE
        self._id = None
        self._owner = None
        owner = _acquire()
        try:
            if owner is not None:
                self._id = owner.add_task(label, total=total)
            self._owner = owner
        except BaseException:
            if owner is not None:
                _release()
            raise

    def advance(self, amount: int = 1) -> None:
        """Advance the exact count while updating the display at intervals."""
        interrupt.check()
        self.done += amount
        self._pending += amount
        if self._pending < self._stride:
            return
        self._pending = 0
        if self._id is not None and self._owner is not None:
            self._owner.update(self._id, completed=self.done)
        elif time.monotonic() - self._spoke >= QUIET_SECONDS:
            self._spoke = time.monotonic()
            console.detail(f"{self.label}: {self.done}/{self.total or '?'} {self.noun}")

    def describe(self, label: str) -> None:
        if self._id is not None and self._owner is not None:
            self._owner.update(self._id, description=label)

    def set_total(self, total: int) -> None:
        """Fill in a total that was not known until the first response arrived."""
        self.total = total
        if self._id is not None and self._owner is not None:
            self._owner.update(self._id, total=total)

    def close(self) -> None:
        if self._id is not None and self._owner is not None:
            self._owner.remove_task(self._id)
            self._id = None
            _release()
        self._owner = None


@contextmanager
def bar(label: str, total: int | None = None, noun: str = "done") -> Generator[Bar]:
    counter = Bar(label, total, noun)
    try:
        yield counter
    finally:
        counter.close()


def _size(n: float) -> str:
    for unit in ("B", "KiB", "MiB"):
        if n < 1024:
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} GiB"


@contextmanager
def bytes_bar(label: str) -> Generator:
    """Track a download whose size becomes known after the response arrives."""
    with bar(label, total=None, noun="bytes") as counter:

        def on_bytes(done: int, total: int) -> None:
            if total and counter.total != total:
                counter.set_total(total)
            counter.advance(done - counter.done)
            got = _size(done)
            counter.describe(f"{label}  {got} of {_size(total)}" if total else f"{label}  {got}")

        yield on_bytes


def each(results: Iterable, total: int, label: str, noun: str) -> Iterator:
    """Yield results while counting them."""
    with bar(label, total, noun) as counter:
        for item in results:
            counter.advance()
            yield item
