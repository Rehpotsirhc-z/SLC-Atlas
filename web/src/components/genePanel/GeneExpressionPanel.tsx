// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useRef } from "react"
import { Box, Tooltip, Typography, useTheme } from "@mui/material"
import FamilyLabel from "@/components/FamilyLabel"
import MiniBar from "@/components/MiniBar"
import { getFamilyColor } from "@/utils/familyColor"
import { formatTpm } from "@/utils/format"
import { displayTissue } from "@/utils/tissue"
import { tpmIntensity } from "@/utils/tpmColor"
import type { ExpressionGeneInfo } from "@/types/popup"
import type { PanelPos } from "@/utils/useDraggablePanel"
import { usePopupAutoWidth } from "@/utils/usePopupAutoWidth"
import type { PanelSize } from "@/utils/useResizablePanel"
import BarListGrid, { type BarListRow } from "./BarListGrid"
import FloatingGenePanel, { MIN_H, type StatRow } from "./FloatingGenePanel"

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

interface GeneExpressionPanelProps {
  info: ExpressionGeneInfo
  onClose: () => void
  onOpenInGenes: () => void
  pos: PanelPos | null
  onPosChange: (pos: PanelPos) => void
  size: PanelSize | null
  onSizeChange: (size: PanelSize) => void
}

export default function GeneExpressionPanel({ info, ...geometry }: GeneExpressionPanelProps) {
  const { geneId, symbol, family, gene, rows } = info
  const { palette, custom } = useTheme()
  const familyColor = getFamilyColor(family || "?", palette.mode)
  const gridRef = useRef<HTMLDivElement>(null)

  const sortedRows = [...rows].sort((a, b) => b.tpm - a.tpm)
  const maxRow = sortedRows[0] ?? null
  const medianTpm = median(rows.map((r) => r.tpm))
  const domainMax = Math.max(...rows.map((r) => Math.log2(r.tpm + 1)), 1)

  const currentX = geometry.pos?.x ?? 29
  const currentH = Math.max(geometry.size?.h ?? 520, MIN_H)
  usePopupAutoWidth(
    gridRef,
    sortedRows.map((r) => r.tissue).join("|"),
    currentX,
    currentH,
    geometry.onSizeChange,
  )

  const statRows: StatRow[] = [
    {
      label: "Family",
      value: <FamilyLabel label={family || "?"} color={familyColor} category={gene?.category} />,
    },
    { label: "Tissues shown", value: rows.length },
    {
      label: "Max TPM",
      value: maxRow ? `${formatTpm(maxRow.tpm)} (${displayTissue(maxRow.tissue)})` : "—",
    },
    { label: "Median TPM", value: medianTpm !== null ? formatTpm(medianTpm) : "—" },
  ]

  const barRows: BarListRow[] = sortedRows.map((r) => ({
    key: r.tissue,
    label: (
      <Typography
        variant="caption"
        sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {displayTissue(r.tissue)}
      </Typography>
    ),
    bar: (
      <Tooltip title={`${formatTpm(r.tpm)} TPM`} placement="top" arrow>
        <Box sx={{ pl: 5, minWidth: 0, display: "flex", alignItems: "center" }}>
          <MiniBar fraction={tpmIntensity(r.tpm, domainMax)} />
        </Box>
      </Tooltip>
    ),
    value: (
      <Typography
        variant="caption"
        sx={{
          textAlign: "right",
          fontFamily: custom.monoFontFamily,
          fontSize: custom.monoFontSize,
        }}
      >
        {formatTpm(r.tpm)}
      </Typography>
    ),
  }))

  return (
    <FloatingGenePanel
      {...geometry}
      symbol={symbol}
      geneId={geneId}
      geneName={gene?.name}
      familyColor={familyColor}
      statRows={statRows}
      ucscGene={gene}
      defaultWidth={420}
    >
      <BarListGrid gridRef={gridRef} rows={barRows} />
    </FloatingGenePanel>
  )
}
