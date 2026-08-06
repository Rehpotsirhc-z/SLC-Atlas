# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from enum import StrEnum
from pydantic import BaseModel


class TissueScope(StrEnum):
    ALL = "all"
    BRAIN = "brain"


class ExpressionCell(BaseModel):
    gene_id: str
    symbol: str | None = None
    family: str | None = None
    tissue: str
    tpm: float
