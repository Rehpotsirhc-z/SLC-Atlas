// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { Paper, Typography, useTheme } from "@mui/material"
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView"
import type { Gene } from "@/types/gene"
import { useUIStore } from "@/store/uiStore"
import { getFamilyColor } from "@/utils/familyColor"
import FamilyTreeItem from "./FamilyTreeItem"

interface FamilyTreeProps {
  genes: Gene[]
  familyFilter: string | null
  onSelectFamily: (family: string | null) => void
  onClose?: () => void
  width: number
  collapseSignal?: number
}

interface FamilyGroup {
  family: string
  label: string
  members: Gene[]
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
      label: `${family}${members[0].category ? ` · ${members[0].category}` : ""} (${members.length})`,
      members: [...members].sort((a, b) =>
        a.symbol.localeCompare(b.symbol, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, undefined, { numeric: true }))
}

const FamilyTree = memo(function FamilyTree({
  genes,
  familyFilter,
  onSelectFamily,
  onClose,
  width,
  collapseSignal,
}: FamilyTreeProps) {
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const { palette } = useTheme()
  const familyGroups = useMemo(() => buildFamilyGroups(genes), [genes])
  const [expandedItems, setExpandedItems] = useState<string[]>(familyFilter ? [familyFilter] : [])
  const [flashingFamily, setFlashingFamily] = useState<string | null>(null)
  const familyRefs = useRef(new Map<string, HTMLElement>())

  const selectedFamily = useMemo(
    () => genes.find((g) => g.id === selectedGeneId)?.family ?? null,
    [genes, selectedGeneId],
  )

  const registerRef = useCallback((family: string, el: HTMLElement | null) => {
    if (el) familyRefs.current.set(family, el)
    else familyRefs.current.delete(family)
  }, [])

  const handleExpandedChange = useCallback(
    (items: string[]) => {
      startTransition(() => setExpandedItems(items))
      if (!selectedFamily) return
      const opened = items.filter((family) => !expandedItems.includes(family))
      if (!items.includes(selectedFamily) || opened.some((family) => family !== selectedFamily)) {
        setSelectedGeneId(null)
      }
    },
    [expandedItems, selectedFamily, setSelectedGeneId],
  )

  const collapsedAt = useRef(collapseSignal)
  useEffect(() => {
    if (collapseSignal === collapsedAt.current) return
    collapsedAt.current = collapseSignal
    startTransition(() => setExpandedItems([]))
  }, [collapseSignal])

  useEffect(() => {
    if (!familyFilter || familyGroups.length === 0) return
    startTransition(() =>
      setExpandedItems((prev) => (prev.includes(familyFilter) ? prev : [...prev, familyFilter])),
    )
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
  }, [familyFilter, familyGroups]) // eslint-disable-line react-hooks/exhaustive-deps

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
        onExpandedItemsChange={(_, items) => handleExpandedChange(items)}
        slots={{ expandIcon: ChevronRightIcon, collapseIcon: ExpandMoreIcon }}
      >
        {familyGroups.map(({ family, label, members }) => (
          <FamilyTreeItem
            key={family}
            family={family}
            label={label}
            members={members}
            color={getFamilyColor(family, palette.mode)}
            isActive={familyFilter === family}
            isExpanded={expandedItems.includes(family)}
            isFlashing={flashingFamily === family}
            selectedGeneId={selectedFamily === family ? selectedGeneId : null}
            onSelectFamily={onSelectFamily}
            onSelectGene={setSelectedGeneId}
            onClose={onClose}
            registerRef={registerRef}
          />
        ))}
      </SimpleTreeView>
    </Paper>
  )
})

export default FamilyTree
