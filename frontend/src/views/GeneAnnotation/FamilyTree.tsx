// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { Box, Paper, Typography, useTheme } from "@mui/material"
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView"
import { TreeItem } from "@mui/x-tree-view/TreeItem"
import type { Gene } from "@/types/gene"
import { useUIStore } from "@/store/uiStore"
import { getFamilyColor } from "@/utils/familyColor"

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
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const { palette } = useTheme()
  const familyGroups = useMemo(() => buildFamilyGroups(genes), [genes])
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  return (
    <Paper variant="outlined" sx={{ width: 280, flexShrink: 0, overflowY: "auto", p: 1 }}>
      <Typography variant="overline" color="secondary" sx={{ pl: 1 }}>
        Families
      </Typography>
      <SimpleTreeView
        expandedItems={expandedItems}
        onExpandedItemsChange={(_, items) => setExpandedItems(items)}
        slots={{ expandIcon: ChevronRightIcon, collapseIcon: ExpandMoreIcon }}
      >
        {familyGroups.map(({ family, label, members }) => {
          const isActive = familyFilter === family
          const isExpanded = expandedItems.includes(family)
          const color = getFamilyColor(family, palette.mode)
          return (
            <TreeItem
              key={family}
              itemId={family}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}>
                  <Box
                    sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }}
                  />
                  <Typography variant="body2" noWrap>
                    {label}
                  </Typography>
                </Box>
              }
              onClick={() => onSelectFamily(isActive ? null : family)}
              sx={{
                "& > .MuiTreeItem-content, & > .MuiTreeItem-content:hover, & > .MuiTreeItem-content.Mui-selected, & > .MuiTreeItem-content.Mui-selected:hover, & > .MuiTreeItem-content.Mui-focused, & > .MuiTreeItem-content.Mui-selected.Mui-focused": {
                  borderLeft: `3px solid ${isExpanded ? color : "transparent"}`,
                  bgcolor: isExpanded ? `${color}22` : undefined,
                },
              }}
            >
              {members.map((gene) => {
                const isGeneSelected = gene.id === selectedGeneId
                return (
                  <TreeItem
                    key={gene.id}
                    itemId={gene.id}
                    label={
                      <Typography variant="body2" noWrap fontWeight={isGeneSelected ? 700 : 400}>
                        {gene.symbol}
                      </Typography>
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedGeneId(gene.id)
                      if (!isActive) onSelectFamily(family)
                    }}
                    sx={{
                      "& > .MuiTreeItem-content, & > .MuiTreeItem-content.Mui-focused, & > .MuiTreeItem-content.Mui-selected, & > .MuiTreeItem-content.Mui-selected:hover": {
                        bgcolor: isGeneSelected ? `${color}50` : `${color}18`,
                      },
                      "& > .MuiTreeItem-content:hover": {
                        bgcolor: isGeneSelected ? `${color}60` : `${color}30`,
                      },
                    }}
                  />
                )
              })}
            </TreeItem>
          )
        })}
      </SimpleTreeView>
    </Paper>
  )
}
