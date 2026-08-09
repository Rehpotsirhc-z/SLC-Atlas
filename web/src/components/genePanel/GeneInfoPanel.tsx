// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useTheme } from "@mui/material"
import FamilyLabel from "@/components/FamilyLabel"
import { getFamilyColor } from "@/utils/familyColor"
import type { GeneInfo } from "@/types/popup"
import type { PanelPos } from "@/utils/useDraggablePanel"
import type { PanelSize } from "@/utils/useResizablePanel"
import FloatingGenePanel, { type StatRow } from "./FloatingGenePanel"

interface GeneInfoPanelProps {
  info: GeneInfo
  onClose: () => void
  onOpenInGenes: () => void
  pos: PanelPos | null
  onPosChange: (pos: PanelPos) => void
  size: PanelSize | null
  onSizeChange: (size: PanelSize) => void
}

export default function GeneInfoPanel({ info, ...geometry }: GeneInfoPanelProps) {
  const { node, methodLabel, closestSymbol, gene } = info
  const { palette } = useTheme()
  const family = gene?.family || node.family || "?"
  const familyColor = getFamilyColor(family, palette.mode)

  const statRows: StatRow[] = [
    {
      label: "Family",
      value: (
        <FamilyLabel
          label={family}
          color={familyColor}
          familyName={gene?.family_name}
          category={gene?.category}
        />
      ),
    },
    { label: "Metric", value: methodLabel },
    { label: "Branch length", value: node.branch_length.toFixed(3) },
    ...(closestSymbol ? [{ label: "Closest relative", value: closestSymbol }] : []),
  ]

  return (
    <FloatingGenePanel
      {...geometry}
      symbol={node.symbol}
      geneId={node.gene_id}
      geneName={gene?.name}
      familyColor={familyColor}
      statRows={statRows}
      ucscGene={gene}
      defaultWidth={340}
    />
  )
}
