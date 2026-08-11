# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Copy the sliced coverage tracks from source/browser/coverage into app/browser/coverage.

Nothing is ever deleted here, so a track that an earlier slice left behind goes on being
served until somebody removes it themselves.
"""

import shutil
from pathlib import Path

PATTERN = "*.bw"


def copy_coverage(source_dir: Path, target_dir: Path) -> tuple[int, int]:
    if not source_dir.exists():
        return 0, 0
    target_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for track in source_dir.glob(PATTERN):
        target = target_dir / track.name
        if target.exists() and target.stat().st_size == track.stat().st_size:
            continue
        shutil.copy2(track, target)
        copied += 1
    return copied, len(list(target_dir.glob(PATTERN)))


def stale_coverage(source_dir: Path, target_dir: Path) -> list[str]:
    mirrored = {p.name for p in source_dir.glob(PATTERN)} if source_dir.exists() else set()
    return sorted(p.name for p in target_dir.glob(PATTERN) if p.name not in mirrored)
