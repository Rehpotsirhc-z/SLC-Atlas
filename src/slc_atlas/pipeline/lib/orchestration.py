# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The step runner that drives both the fetch phase and the build phase.

A step that fails raises SystemExit, whether it ran on its own or as part of a parallel
group. Every step in a group runs to completion before a failure is reported, so one
network error does not discard the work the other steps have already finished.
"""

import sys
import traceback
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from . import deps


@dataclass(frozen=True)
class Step:
    name: str
    run: Callable[[], None]
    label: str = ""
    requires: tuple[str, ...] = ()
    outputs: tuple[Path, ...] = ()

    @property
    def heading(self) -> str:
        return self.label or self.name

    @property
    def failure(self) -> str:
        return f"{self.heading} (--step {self.name})" if self.label else self.name


def _run_one(step: Step) -> bool:
    print(f"\n=== {step.heading} ===", flush=True)
    try:
        step.run()
    except SystemExit as e:
        print(e, file=sys.stderr, flush=True)
        return False
    except Exception:
        traceback.print_exc()
        return False
    return True


def run_stage(steps: Sequence[Step]) -> None:
    if not steps:
        return
    if len(steps) == 1:
        failed = [] if _run_one(steps[0]) else [steps[0].failure]
    else:
        with ThreadPoolExecutor(max_workers=len(steps)) as pool:
            started = [(step.failure, pool.submit(_run_one, step)) for step in steps]
            failed = [label for label, future in started if not future.result()]
    if failed:
        raise SystemExit(
            "Stopped, because this did not finish: "
            + "; ".join(failed)
            + "\nThe error is printed above. Fix it, then run the same command again."
        )


def preflight(steps: Sequence[Step]) -> None:
    required = {module for step in steps for module in step.requires}
    deps.require(tuple(sorted(required)))
