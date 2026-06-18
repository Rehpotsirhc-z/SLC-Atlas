# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pydantic import BaseModel


class Transcript(BaseModel):
    id: str
    gene_id: str
    name: str
    type: str
    start: int
    end: int
    length: int


class Gene(BaseModel):
    id: str
    symbol: str
    name: str
    chromosome: str
    start: int
    end: int
    strand: str
    length: int
    alias: str | None = None
    category: str
    subcategory: str | None = None
    family: str
    family_name: str
    function_brief: str | None = None
