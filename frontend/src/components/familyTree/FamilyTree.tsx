// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { keyframes } from "@emotion/react"
import { useEffect, useMemo, useRef, useState } from "react"
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
  onClose?: () => void
  width: number
}

interface FamilyGroup {
  family: string
  label: string
  members: Gene[]
}

const familyFlash = keyframes`
  0%   { background-color: rgba(81, 175, 239, 0.45); }
  100% { background-color: transparent; }
`

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
      label: `${family}${members[0].category ? ` \u00B7 ${members[0].category}` : ""} (${members.length})`,
      members: [...members].sort((a, b) =>
        a.symbol.localeCompare(b.symbol, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, undefined, { numeric: true }))
}

export default function FamilyTree({
  genes,
  familyFilter,
  onSelectFamily,
  onClose,
  width,
}: FamilyTreeProps) {
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const { palette } = useTheme()
  const familyGroups = useMemo(() => buildFamilyGroups(genes), [genes])
  const [expandedItems, setExpandedItems] = useState<string[]>(familyFilter ? [familyFilter] : [])
  const [flashingFamily, setFlashingFamily] = useState<string | null>(null)
  const familyRefs = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    if (!familyFilter) return
    setExpandedItems((prev) => (prev.includes(familyFilter) ? prev : [...prev, familyFilter]))
    const el = familyRefs.current.get(familyFilter)
    if (!el) return
    const contentEl = el.closest<HTMLElement>(".MuiTreeItem-content") ?? el
    let fired = false
    const startFlash = () => {
      if (fired) return
      fired = true
      setFlashingFamily(familyFilter)
      setTimeout(() => setFlashingFamily(null), 1400)
    }
    let scrollParent = contentEl.parentElement
    while (scrollParent && scrollParent.scrollHeight <= scrollParent.clientHeight) {
      scrollParent = scrollParent.parentElement
    }
    scrollParent?.addEventListener("scrollend", startFlash, { once: true })
    contentEl.scrollIntoView({ block: "start", behavior: "smooth" })
    setTimeout(startFlash, 600)
  }, [familyFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper variant="outlined" sx={{ width, flexShrink: 0, overflowY: "auto", p: 1 }}>
      <Typography
        variant="overline"
        color="secondary"
        sx={{ pl: 1, display: "block", lineHeight: 1.6, mb: 0.5 }}
      >
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
          const isFlashing = flashingFamily === family
          const color = getFamilyColor(family, palette.mode)
          return (
            <TreeItem
              key={family}
              itemId={family}
              label={
                <Box
                  ref={(el: HTMLElement | null) => {
                    if (el) familyRefs.current.set(family, el)
                    else familyRefs.current.delete(family)
                  }}
                  sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}
                >
                  <Box
                    sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }}
                  />
                  <Typography variant="body2" noWrap>
                    {label}
                  </Typography>
                </Box>
              }
              onClick={() => {
                if (isActive) onSelectFamily(null)
                else if (!isExpanded) onSelectFamily(family)
              }}
              sx={{
                "& > .MuiTreeItem-content, & > .MuiTreeItem-content:hover, & > .MuiTreeItem-content.Mui-selected, & > .MuiTreeItem-content.Mui-selected:hover, & > .MuiTreeItem-content.Mui-focused, & > .MuiTreeItem-content.Mui-selected.Mui-focused":
                  {
                    borderLeft: `3px solid ${isExpanded ? color : "transparent"}`,
                    bgcolor: isExpanded ? `${color}22` : undefined,
                  },
                ...(isFlashing && {
                  "& > .MuiTreeItem-content": {
                    animation: `${familyFlash} 1.4s ease-out`,
                  },
                }),
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
                      onClose?.()
                    }}
                    sx={{
                      "& > .MuiTreeItem-content, & > .MuiTreeItem-content.Mui-focused, & > .MuiTreeItem-content.Mui-selected, & > .MuiTreeItem-content.Mui-selected:hover":
                        {
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
