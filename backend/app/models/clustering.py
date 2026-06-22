# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pydantic import BaseModel


class ClusterNode(BaseModel):
    method: str
    node_id: int
    parent_id: int | None = None
    branch_length: float
    gene_id: str | None = None
    symbol: str | None = None
    family: str | None = None
