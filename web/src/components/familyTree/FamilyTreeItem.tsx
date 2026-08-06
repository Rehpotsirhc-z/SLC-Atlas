// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { keyframes } from "@emotion/react"
import { memo, useCallback } from "react"
import { Box, Typography } from "@mui/material"
import { TreeItem } from "@mui/x-tree-view/TreeItem"
import type { Gene } from "@/types/gene"

const familyFlash = keyframes`
  0%   { background-color: rgba(81, 175, 239, 0.45); }
  100% { background-color: transparent; }
`

interface Props {
  family: string
  label: string
  members: Gene[]
  color: string
  isActive: boolean
  isExpanded: boolean
  isFlashing: boolean
  selectedGeneId: string | null
  onSelectFamily: (family: string | null) => void
  onSelectGene: (geneId: string) => void
  onClose?: () => void
  registerRef: (family: string, el: HTMLElement | null) => void
}

const FamilyTreeItem = memo(function FamilyTreeItem({
  family,
  label,
  members,
  color,
  isActive,
  isExpanded,
  isFlashing,
  selectedGeneId,
  onSelectFamily,
  onSelectGene,
  onClose,
  registerRef,
}: Props) {
  const setRef = useCallback(
    (el: HTMLElement | null) => registerRef(family, el),
    [family, registerRef],
  )

  return (
    <TreeItem
      itemId={family}
      label={
        <Box ref={setRef} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
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
              onSelectGene(gene.id)
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
})

export default FamilyTreeItem
