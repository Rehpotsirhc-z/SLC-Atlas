# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

# cspell:ignore signum EINTR
"""Coordinate prompt cancellation across pipeline workers."""

import os
import signal
import sys
import threading
import time
from collections.abc import Generator
from typing import NoReturn
from contextlib import contextmanager

SETTLE_SECONDS = 0.3

WRITE_WAIT_SECONDS = 10.0

EXIT_DEADLINE_SECONDS = 2.0

_stop = threading.Event()
_writes = 0
_writes_lock = threading.Lock()
_writes_done = threading.Event()
_cleanups: list = []
_cleanups_lock = threading.Lock()


class Stopped(BaseException):
    """Signal cancellation without being caught by ordinary item-level error handlers."""


def request() -> None:
    _stop.set()


def requested() -> bool:
    return _stop.is_set()


def reset() -> None:
    _stop.clear()


def check() -> None:
    """Give up here if the run has been canceled, from whichever thread is asking."""
    if _stop.is_set():
        raise Stopped("canceled")


def pause(seconds: float) -> None:
    """Sleep, giving up here if the run is canceled before or during the wait."""
    if seconds > 0:
        _stop.wait(seconds)
    check()


@contextmanager
def writing() -> Generator[None]:
    """Delay a canceled exit until the current write finishes."""
    global _writes
    with _writes_lock:
        _writes += 1
    try:
        yield
    finally:
        with _writes_lock:
            _writes -= 1
            if _writes == 0:
                _writes_done.set()


def _wait_for_writes() -> None:
    deadline = time.monotonic() + WRITE_WAIT_SECONDS
    while time.monotonic() < deadline:
        with _writes_lock:
            if _writes == 0:
                return
            _writes_done.clear()
        _writes_done.wait(0.05)


@contextmanager
def closing(shutdown) -> Generator[None]:
    """Register cleanup that must run before a forced process exit."""
    with _cleanups_lock:
        _cleanups.append(shutdown)
    try:
        yield
    finally:
        with _cleanups_lock:
            if shutdown in _cleanups:
                _cleanups.remove(shutdown)


def _close_all() -> None:
    with _cleanups_lock:
        pending, _cleanups[:] = list(_cleanups), []
    for shutdown in pending:
        try:
            shutdown()
        except Exception:
            pass


def pending_writes() -> int:
    """How many tables are being written straight to their destination right now."""
    with _writes_lock:
        return _writes


def settle() -> None:
    """Give active writes and responsive workers time to finish."""
    _wait_for_writes()
    time.sleep(SETTLE_SECONDS)


def claim() -> None:
    """Restore Python's SIGINT handler after third-party imports."""
    signal.signal(signal.SIGINT, signal.default_int_handler)


@contextmanager
def handler() -> Generator[None]:
    """Notify workers when Ctrl-C cancels a pipeline phase."""
    previous = signal.getsignal(signal.SIGINT)
    _stop.clear()

    def on_sigint(signum, frame) -> None:
        _stop.set()
        # Stays installed after this block unwinds, so the second press is always the hard one
        signal.signal(signal.SIGINT, _leave_now)
        raise KeyboardInterrupt

    try:
        signal.signal(signal.SIGINT, on_sigint)
    except ValueError:
        # Not the main thread, so there is no handler to install and nothing to undo
        yield
        return
    try:
        yield
    finally:
        if not _stop.is_set():
            signal.signal(signal.SIGINT, previous)


def _leave_now(signum, frame) -> NoReturn:
    """Exit immediately after a second Ctrl-C."""
    _deadline(EXIT_DEADLINE_SECONDS)
    _close_all()
    os._exit(130)


def _deadline(seconds: float) -> None:
    """Set a hard deadline for process cleanup."""
    try:
        signal.signal(signal.SIGALRM, lambda *_: os._exit(130))
        signal.setitimer(signal.ITIMER_REAL, seconds)
    except (AttributeError, ValueError):
        # No SIGALRM, or not the main thread, so the exit runs unguarded
        pass


def leave(code: int = 130, wait: bool = True) -> NoReturn:
    """Exit without waiting indefinitely for blocked worker threads."""
    if wait:
        settle()
    _deadline(EXIT_DEADLINE_SECONDS)
    _close_all()
    sys.stderr.write("\x1b[?25h")
    sys.stderr.flush()
    sys.stdout.flush()
    os._exit(code)
