// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { Box } from "@mui/material"
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView"
import { TreeItem } from "@mui/x-tree-view/TreeItem"
import type { Gene } from "@/types/gene"
import { useUIStore } from "@/store/uiStore"

interface FamilyTreeProps {
  genes: Gene[]
  familyFilter: string | null
  onSelectFamily: (family: string | null) => void
}

interface FamilyGroup {
  family: string
  label: string
  members: Gene[]
}

function familyCategoryLabel(members: Gene[]): string {
  const categories = new Set(members.map((g) => g.category).filter((c): c is string => c != null))
  if (categories.size === 1) return [...categories][0]
  if (categories.size === 0) return members[0].family_name
  return `${members[0].family_name} (mixed)`
}

function buildFamilyGroups(genes: Gene[]): FamilyGroup[] {
  const map = new Map<string, Gene[]>()
  for (const gene of genes) {
    const members = map.get(gene.family) ?? []
    members.push(gene)
    map.set(gene.family, members)
  }
  return [...map.entries()]
    .map(([family, members]) => ({
      family,
      label: `${family} — ${familyCategoryLabel(members)} (${members.length})`,
      members: [...members].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, undefined, { numeric: true }))
}

export default function FamilyTree({ genes, familyFilter, onSelectFamily }: FamilyTreeProps) {
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const familyGroups = useMemo(() => buildFamilyGroups(genes), [genes])

  return (
    <Box sx={{ width: 280, overflowY: "auto", flexShrink: 0 }}>
      <SimpleTreeView slots={{ expandIcon: ChevronRightIcon, collapseIcon: ExpandMoreIcon }}>
        {familyGroups.map(({ family, label, members }) => (
          <TreeItem
            key={family}
            itemId={family}
            label={label}
            onClick={() => onSelectFamily(familyFilter === family ? null : family)}
            sx={familyFilter === family ? { bgcolor: "action.selected" } : undefined}
          >
            {members.map((gene) => (
              <TreeItem
                key={gene.id}
                itemId={gene.id}
                label={gene.symbol}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedGeneId(gene.id)
                }}
              />
            ))}
          </TreeItem>
        ))}
      </SimpleTreeView>
    </Box>
  )
}
