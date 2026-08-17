# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run fetch and build steps while tracking dependencies and failures."""

import threading
import traceback
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

from . import console, deps, http, interrupt, reporting
from .reporting import count

OK = "ok"
KEPT = "kept"
PARTIAL = "partial"
FAILED = "failed"
BLOCKED = "blocked"
MISSING_INPUT = "needs input"

LEVELS = {
    OK: "success",
    KEPT: "detail",
    PARTIAL: "warn",
    FAILED: "error",
    BLOCKED: "error",
    MISSING_INPUT: "warn",
}


@dataclass(frozen=True)
class Step:
    name: str
    run: Callable[[], None]
    label: str = ""
    requires: tuple[str, ...] = ()
    inputs: tuple[Path, ...] = ()
    outputs: tuple[Path, ...] = ()
    skip_when_present: bool = True

    @property
    def heading(self) -> str:
        return self.label or self.name

    @property
    def retry(self) -> str:
        return f"--step {self.name}"


@dataclass
class Result:
    step: Step
    status: str
    detail: str = ""
    findings: list = field(default_factory=list)

    @property
    def name(self) -> str:
        return self.step.name


class Ledger:
    """What every step in a phase came to, in the order they were attempted."""

    def __init__(self) -> None:
        self._results: dict[str, Result] = {}
        self._lock = threading.Lock()

    def add(self, result: Result) -> None:
        with self._lock:
            self._results[result.name] = result

    def get(self, name: str) -> Result | None:
        with self._lock:
            return self._results.get(name)

    @property
    def results(self) -> list[Result]:
        with self._lock:
            return list(self._results.values())

    def failed_outputs(self) -> set[Path]:
        """Every file a step was meant to write and did not finish writing."""
        return {
            path
            for result in self.results
            if result.status in (FAILED, BLOCKED, MISSING_INPUT)
            for path in result.step.outputs
        }

    @property
    def unusable(self) -> bool:
        """Whether any requested step failed to produce its output."""
        return any(r.status in (FAILED, BLOCKED, MISSING_INPUT) for r in self.results)


def complete(path: Path) -> bool:
    """A zero-byte output is what a run killed mid-write leaves, so it does not count."""
    try:
        return path.exists() and (path.is_dir() or path.stat().st_size > 0)
    except OSError:
        return False


def kept(step: Step, forced: frozenset[str]) -> bool:
    """Whether the step's work is already on disk and --step did not ask for it again."""
    if not step.skip_when_present or not step.outputs or step.name in forced:
        return False
    return all(complete(path) for path in step.outputs)


def _blockers(step: Step, spoiled: set[Path]) -> tuple[str, list[str]]:
    """Why the step cannot run, as a status and the inputs to blame."""
    ruined = [str(p) for p in step.inputs if p in spoiled]
    if ruined:
        return BLOCKED, ruined
    absent = [str(p) for p in step.inputs if not complete(p)]
    if absent:
        return MISSING_INPUT, absent
    return "", []


def _run_one(step: Step, among_others: bool = False) -> Result:
    with console.named(step.name, among_others=among_others):
        return _attempt(step)


def _attempt(step: Step) -> Result:
    try:
        step.run()
    except interrupt.Stopped:
        raise
    except SystemExit as e:
        message = str(e).strip()
        console.paragraph(message, "error")
        return Result(step, FAILED, message.splitlines()[0] if message else "stopped")
    except Exception as e:
        console.error(f"{type(e).__name__}: {e}")
        if console.traceback_wanted():
            console.paragraph(traceback.format_exc(), "detail")
        else:
            console.detail("Set ATLAS_TRACEBACK=1 to see where this came from")
        return Result(step, FAILED, f"{type(e).__name__}: {e}")
    status = PARTIAL if reporting.failed(step.name) else OK
    return Result(step, status, findings=reporting.findings(step.name))


def run_stage(steps: Sequence[Step], ledger: Ledger, forced: frozenset[str]) -> None:
    """Run one stage, leaving out whatever cannot run, and record what each step came to."""
    runnable = []
    spoiled = ledger.failed_outputs()
    for step in steps:
        if kept(step, forced):
            console.heading(step.heading)
            console.note("Already available (delete its files to fetch it again)")
            ledger.add(Result(step, KEPT))
            continue
        status, blame = _blockers(step, spoiled)
        if status:
            ledger.add(Result(step, status, ", ".join(blame)))
            continue
        runnable.append(step)

    if not runnable:
        return
    among_others = len(runnable) > 1
    if among_others:
        console.heading(f"{count('step', len(runnable))} at once")
        for step in runnable:
            console.detail(f"{step.name}: {step.heading}", indent=2)
    else:
        console.heading(runnable[0].heading)

    # Keep the main thread available to handle Ctrl-C
    pool = ThreadPoolExecutor(max_workers=len(runnable))
    try:
        started = [pool.submit(_run_one, step, among_others) for step in runnable]
        for future in started:
            ledger.add(future.result())
    except (KeyboardInterrupt, interrupt.Stopped):
        interrupt.request()
        pool.shutdown(wait=False, cancel_futures=True)
        raise
    finally:
        pool.shutdown(wait=not interrupt.requested())


def preflight(steps: Sequence[Step]) -> None:
    required = {module for step in steps for module in step.requires}
    deps.require(tuple(sorted(required)))


def summarize(ledger: Ledger, phase: str, command: str) -> None:
    """List what every step came to, then everything worth acting on."""
    console.rule(f"{phase} summary")
    rows = []
    for result in ledger.results:
        note = result.detail
        if result.status == MISSING_INPUT:
            note = f"missing {_names(note)}"
        elif result.status == BLOCKED:
            note = f"dependency failed: {_names(note)}"
        rows.append([result.name, console.styled(result.status, LEVELS[result.status]), note])
    console.table(["Step", "Result", "Note"], rows)

    _list_findings()
    retried = http.retry_summary()
    if retried:
        console.blank()
        console.note("Retried remote services:")
        for line in retried:
            console.detail(line, indent=2)

    stuck = [r for r in ledger.results if r.status in (FAILED, BLOCKED, PARTIAL)]
    if stuck:
        console.blank()
        console.warn("Retry failed or incomplete steps:")
        console.detail(f"{command} {' '.join(sorted(r.step.retry for r in stuck))}", indent=2)


def _names(paths: str) -> str:
    return ", ".join(Path(p.strip()).name for p in paths.split(",") if p.strip())


def _list_findings() -> None:
    headings = {
        reporting.FAILURE: ("Could not be fetched:", console.error),
        reporting.WARN: ("Warnings:", console.warn),
    }
    for severity, (title, emit) in headings.items():
        found = [a for a in reporting.findings() if a.severity == severity]
        if not found:
            continue
        console.blank()
        emit(title)
        for anomaly in found:
            where = f"{anomaly.step}: " if anomaly.step else ""
            console.detail(f"{where}{anomaly.headline}", indent=2)


__all__ = [
    "BLOCKED",
    "FAILED",
    "KEPT",
    "Ledger",
    "MISSING_INPUT",
    "OK",
    "PARTIAL",
    "Result",
    "Step",
    "complete",
    "kept",
    "preflight",
    "run_stage",
    "summarize",
]
