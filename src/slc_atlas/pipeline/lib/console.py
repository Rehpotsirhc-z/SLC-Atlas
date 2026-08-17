# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Write consistent pipeline output to stderr."""

# cspell:ignore initargs
import os
import threading
from collections.abc import Generator, Sequence
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager

from rich.console import Console
from rich.table import Table
from rich.text import Text

STYLES = {
    "heading": "bold cyan",
    "detail": "",
    "note": "dim",
    "warn": "yellow",
    "error": "bold red",
    "success": "green",
}

MARKERS = {
    "heading": "==",
    "detail": "  ",
    "note": " ℹ",
    "warn": " ⚠",
    "error": " ✖",
    "success": " ✔",
}

ASCII_MARKERS = {
    "heading": "==",
    "detail": "  ",
    "note": " i",
    "warn": " !",
    "error": " x",
    "success": " +",
}

console = Console(stderr=True, markup=False, highlight=False, emoji=False, soft_wrap=True)


def _marks() -> dict[str, str]:
    """Return Unicode markers when the output encoding supports them."""
    encoding = getattr(console.file, "encoding", None) or "ascii"
    try:
        "".join(MARKERS.values()).encode(encoding)
    except (LookupError, UnicodeEncodeError):
        return ASCII_MARKERS
    return MARKERS


_MARKS = _marks()

_sink = threading.local()


def _write(level: str, text: str, indent: int = 0) -> None:
    where = getattr(_sink, "prefix", "")
    body = f"{_MARKS[level]} {' ' * indent}{where}{text}"
    console.print(Text(body, style=STYLES[level]))


def heading(text: str) -> None:
    """Announce a step, with a blank line above so the run reads as blocks."""
    console.print()
    _write("heading", text)


def detail(text: str, indent: int = 0) -> None:
    _write("detail", text, indent)


def note(text: str, indent: int = 0) -> None:
    """Something worth knowing that does not reduce what the run produces."""
    _write("note", text, indent)


def warn(text: str, indent: int = 0) -> None:
    """Something that makes the output less complete than it would otherwise be."""
    _write("warn", text, indent)


def error(text: str, indent: int = 0) -> None:
    _write("error", text, indent)


def success(text: str, indent: int = 0) -> None:
    _write("success", text, indent)


def blank() -> None:
    console.print()


def bullets(items: Sequence, limit: int) -> None:
    """List the items under whatever was just reported, cut off at a readable length."""
    for item in items[:limit]:
        detail(str(item), indent=2)
    if len(items) > limit:
        detail(f"... and {len(items) - limit} more", indent=2)


def paragraph(text: str, level: str = "detail") -> None:
    """Write a multi-line remediation message with every line marked the same way."""
    for line in text.splitlines():
        _write(level, line)


def rule(text: str) -> None:
    """Separate the run from the summary that follows it."""
    console.print()
    console.rule(Text(text, style=STYLES["heading"]), style=STYLES["heading"])


def table(columns: Sequence[str], rows: Sequence[Sequence[Text | str]]) -> None:
    grid = Table(box=None, pad_edge=False, show_header=True, header_style="bold")
    for column in columns:
        grid.add_column(column, overflow="fold")
    for row in rows:
        grid.add_row(*row)
    console.print(grid)


def styled(text: str, level: str) -> Text:
    """A cell for `table`, colored the same way a line of that severity would be."""
    return Text(text, style=STYLES[level])


def traceback_wanted() -> bool:
    """Whether a failing step should print its Python traceback rather than one line."""
    return bool(os.environ.get("ATLAS_TRACEBACK"))


def current_step() -> str:
    """The step whose thread is writing, for attributing an anomaly to it."""
    return getattr(_sink, "step", "") or ""


def _adopt(step: str, prefix: str) -> None:
    _sink.step, _sink.prefix = step, prefix


def pool(max_workers: int) -> ThreadPoolExecutor:
    """Create a thread pool whose workers inherit the current step name."""
    step, prefix = current_step(), getattr(_sink, "prefix", "")
    return ThreadPoolExecutor(max_workers=max_workers, initializer=_adopt, initargs=(step, prefix))


@contextmanager
def named(step: str, *, label: str = "", among_others: bool = False) -> Generator[None]:
    """Attribute output from the current thread to a pipeline step."""
    _sink.step = step
    _sink.prefix = f"{label or step}: " if among_others else ""
    try:
        yield
    finally:
        _sink.step, _sink.prefix = "", ""
