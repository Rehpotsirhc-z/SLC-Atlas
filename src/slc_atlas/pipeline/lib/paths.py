# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The directories the pipeline reads and writes, all derived from the data directory and
the curation directory that the user chooses.
"""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PipelinePaths:
    data_dir: Path
    curation_dir: Path

    @property
    def cache(self) -> Path:
        return self.data_dir / "cache"

    @property
    def source(self) -> Path:
        return self.data_dir / "source"

    @property
    def structure_source(self) -> Path:
        return self.source / "structure"

    @property
    def models_dir(self) -> Path:
        return self.structure_source / "models"

    @property
    def browser_source(self) -> Path:
        return self.source / "browser"

    @property
    def coverage_dir(self) -> Path:
        return self.browser_source / "coverage"

    @property
    def app(self) -> Path:
        return self.data_dir / "app"

    @property
    def work(self) -> Path:
        return self.cache / "work"
