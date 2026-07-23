// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useRef } from "react"
import { Box, Tooltip, Typography, useTheme } from "@mui/material"
import FamilyLabel from "@/components/FamilyLabel"
import MiniBar from "@/components/MiniBar"
import { getFamilyColor } from "@/utils/familyColor"
import { ensemblUrl } from "@/utils/links"
import type { ConservationCell } from "@/types/conservation"
import { CELL_METRICS, type CellMetricKey } from "@/types/conservation"
import type { ConservationGeneInfo } from "@/types/popup"
import type { PanelPos } from "@/utils/useDraggablePanel"
import { usePopupAutoWidth } from "@/utils/usePopupAutoWidth"
import type { PanelSize } from "@/utils/useResizablePanel"
import BarListGrid, { type BarListRow } from "./BarListGrid"
import FloatingGenePanel, { MIN_H, type StatRow } from "./FloatingGenePanel"

const ORTHOLOGY_LABEL: Record<string, string> = {
  ortholog_one2one: "1:1",
  ortholog_one2many: "1:many",
  ortholog_many2many: "n:n",
}

interface GeneConservationPanelProps {
  info: ConservationGeneInfo
  metric: CellMetricKey
  onClose: () => void
  onOpenInGenes: () => void
  pos: PanelPos | null
  onPosChange: (pos: PanelPos) => void
  size: PanelSize | null
  onSizeChange: (size: PanelSize) => void
}

export default function GeneConservationPanel({
  info,
  metric,
  ...geometry
}: GeneConservationPanelProps) {
  const { geneId, symbol, family, gene, cells } = info
  const { palette, custom } = useTheme()
  const familyColor = getFamilyColor(family ?? "?", palette.mode)
  const gridRef = useRef<HTMLDivElement>(null)

  const metricDef = CELL_METRICS.find((m) => m.key === metric) ?? CELL_METRICS[0]
  const field = metricDef.field as keyof Pick<ConservationCell, "perc_id" | "perc_pos">

  const oneToOneCount = cells.filter((c) => c.orthology_type === "ortholog_one2one").length
  const values = cells.map((c) => c[field]).filter((v): v is number => v !== null)
  const avgValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

  const sortedCells = [...cells].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return bv - av
  })

  const currentX = geometry.pos?.x ?? 29
  const currentH = Math.max(geometry.size?.h ?? 520, MIN_H)
  usePopupAutoWidth(
    gridRef,
    sortedCells.map((c) => c.species).join("|"),
    currentX,
    currentH,
    geometry.onSizeChange,
  )

  const statRows: StatRow[] = [
    {
      label: "Family",
      value: (
        <FamilyLabel
          label={family ?? "?"}
          color={familyColor}
          familyName={gene?.family_name}
          category={gene?.category}
        />
      ),
    },
    { label: "Species compared", value: cells.length },
    { label: "1:1 orthologs", value: oneToOneCount },
    { label: `Avg ${metricDef.label}`, value: avgValue !== null ? `${avgValue.toFixed(1)}%` : "—" },
  ]

  const barRows: BarListRow[] = sortedCells.map((c) => {
    const value = c[field]
    const orthoLabel = c.orthology_type
      ? (ORTHOLOGY_LABEL[c.orthology_type] ?? c.orthology_type)
      : null
    const speciesName = c.species_label ?? c.species
    return {
      key: c.species,
      label: c.target_gene_id ? (
        <Tooltip
          title={
            <Box component="span" sx={{ display: "block", transform: "translateY(1px)" }}>
              {c.target_gene_id}
            </Box>
          }
          placement="right"
          arrow
        >
          <Typography
            variant="caption"
            component="a"
            href={ensemblUrl(c.target_gene_id, c.species)}
            target="_blank"
            rel="noopener"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "text.primary",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline", color: "primary.main" },
            }}
          >
            {speciesName}
          </Typography>
        </Tooltip>
      ) : (
        <Typography
          variant="caption"
          sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {speciesName}
        </Typography>
      ),
      bar: (
        <Tooltip
          title={orthoLabel ? `${orthoLabel} ortholog` : "No ortholog"}
          placement="top"
          arrow
        >
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, pl: 5 }}>
            <MiniBar fraction={value !== null ? value / 100 : 0} />
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
          {value !== null ? `${value.toFixed(1)}%` : "—"}
        </Typography>
      ),
    }
  })

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
