// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useMemo } from "react"
import { Typography } from "@mui/material"
import { TreeItem } from "@mui/x-tree-view/TreeItem"
import type { Gene } from "@/types/gene"

interface Props {
  gene: Gene
  color: string
  isSelected: boolean
  onSelectFamily: (family: string | null) => void
  onSelectGene: (geneId: string) => void
  onClose?: () => void
}

const GeneTreeItem = memo(function GeneTreeItem({
  gene,
  color,
  isSelected,
  onSelectFamily,
  onSelectGene,
  onClose,
}: Props) {
  const sx = useMemo(
    () => ({
      "& > .MuiTreeItem-content, & > .MuiTreeItem-content.Mui-focused, & > .MuiTreeItem-content.Mui-selected, & > .MuiTreeItem-content.Mui-selected:hover":
        {
          bgcolor: isSelected ? `${color}50` : `${color}18`,
        },
      "& > .MuiTreeItem-content:hover": {
        bgcolor: isSelected ? `${color}60` : `${color}30`,
      },
    }),
    [color, isSelected],
  )

  return (
    <TreeItem
      itemId={gene.id}
      label={
        <Typography variant="body2" noWrap fontWeight={isSelected ? 700 : 400}>
          {gene.symbol}
        </Typography>
      }
      onClick={(e) => {
        e.stopPropagation()
        onSelectGene(gene.id)
        onSelectFamily(gene.family)
        onClose?.()
      }}
      sx={sx}
    />
  )
})

export default GeneTreeItem
