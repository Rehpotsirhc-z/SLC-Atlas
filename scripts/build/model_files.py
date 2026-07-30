# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Moving coordinate files from the dataset into the served tree.

Copying never deletes, so files an earlier --download-* run left behind keep
being served until someone removes them.
"""

import shutil
from pathlib import Path


def copy_models(source_dir: Path, target_dir: Path) -> tuple[int, int]:
    if not source_dir.exists():
        return 0, 0
    target_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for model in source_dir.glob("*.*cif"):
        target = target_dir / model.name
        if target.exists() and target.stat().st_size == model.stat().st_size:
            continue
        shutil.copy2(model, target)
        copied += 1
    return copied, len(list(target_dir.glob("*.*cif")))


def stale_models(source_dir: Path, target_dir: Path) -> list[str]:
    mirrored = {p.name for p in source_dir.glob("*.*cif")} if source_dir.exists() else set()
    return sorted(p.name for p in target_dir.glob("*.*cif") if p.name not in mirrored)
