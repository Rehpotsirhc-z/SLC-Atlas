# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from enum import StrEnum
from pydantic import BaseModel
from .tree import TreeNodeBase


class ClusterMethod(StrEnum):
    AA_SEQUENCE = "aa_sequence"
    DNA_SEQUENCE = "dna_sequence"
    RNA_COEXPRESSION_ALL = "rna_coexpression_all"
    RNA_COEXPRESSION_BRAIN = "rna_coexpression_brain"
    ORTHOLOG_IDENTITY = "ortholog_identity"
    FAMILY_GROUPING = "family_grouping"


class _MethodField(BaseModel):
    method: str


# reverse-MRO field collection keeps `method` ahead of the tree fields on the wire
class ClusterNode(TreeNodeBase, _MethodField):
    gene_id: str | None = None
    symbol: str | None = None
    family: str | None = None
