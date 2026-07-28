# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Subprocess runners for the phase orchestrators.

A failing step always raises SystemExit, whether it ran alone or in a parallel group.
"""

import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path


def run_script(path: Path, args: Sequence[str] = (), label: str | None = None) -> None:
    print(f"\n=== {label or path.stem} ===", flush=True)
    if subprocess.run([sys.executable, str(path), *args]).returncode:
        raise SystemExit(f"Step(s) failed: {label or path.stem}")


def run_parallel(jobs: Sequence[tuple[Path, Sequence[str]]]) -> None:
    procs = []
    for path, args in jobs:
        print(f"\n=== {path.stem} (started) ===", flush=True)
        procs.append((path.stem, subprocess.Popen([sys.executable, str(path), *args])))
    failed = [name for name, proc in procs if proc.wait() != 0]
    if failed:
        raise SystemExit("Step(s) failed: " + ", ".join(failed))
