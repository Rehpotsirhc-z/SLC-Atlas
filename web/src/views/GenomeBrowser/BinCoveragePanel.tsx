// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Show coverage across cell types for a selected genomic bin

import { Fragment } from "react"
import { createPortal } from "react-dom"
import { Box, Typography, useTheme } from "@mui/material"
import FloatingPanel, { type StatRow } from "@/components/FloatingPanel"
import MiniBar from "@/components/MiniBar"
import { useUIStore } from "@/store/uiStore"
import type { CoverageAssay } from "./browserPick"
import { BIN_POPUP_H, BIN_POPUP_W, POPUP_DEFAULT_POS, POPUP_MIN_H, POPUP_MIN_W } from "./constants"
import type { Bin } from "./drawCoverage"
import { formatLocus, formatPoint, formatSpan } from "./scale"
import { formatSignal } from "./yAxis"

interface Props {
  base: number
  chrom: string
  range: Bin | null
  assays: CoverageAssay[]
  onClose: () => void
}

interface Row {
  key: string
  label: string
  strand: "+" | "−" | null
  value: number | null
  color: string
}

function rowsFor(assay: CoverageAssay): Row[] {
  const rows: Row[] = []
  for (const cell of assay.cells) {
    if (cell.stranded) {
      rows.push({
        key: `${cell.trackId}+`,
        label: cell.label,
        strand: "+",
        value: cell.plus,
        color: cell.color,
      })
      rows.push({
        key: `${cell.trackId}-`,
        label: cell.label,
        strand: "−",
        value: cell.minus,
        color: cell.color,
      })
    } else {
      rows.push({
        key: cell.trackId,
        label: cell.label,
        strand: null,
        value: cell.plus,
        color: cell.color,
      })
    }
  }
  return rows
}

export default function BinCoveragePanel({ base, chrom, range, assays, onClose }: Props) {
  const { palette, custom } = useTheme()
  const pos = useUIStore((s) => s.popupPos)
  const setPos = useUIStore((s) => s.setPopupPos)
  const size = useUIStore((s) => s.popupSize)
  const setSize = useUIStore((s) => s.setPopupSize)

  const sections = assays.map((assay) => ({ group: assay.group, rows: rowsFor(assay) }))
  const allRows = sections.flatMap((s) => s.rows)
  const domainMax = Math.max(0, ...allRows.map((r) => r.value ?? 0)) || 1
  const cellCount = assays.reduce((n, assay) => n + assay.cells.length, 0)

  const peak = allRows.reduce<Row | null>(
    (best, r) => (r.value != null && (!best || r.value > (best.value ?? 0)) ? r : best),
    null,
  )
  const nameLine = peak
    ? `Highest in ${peak.label}${peak.strand ? ` (${peak.strand})` : ""} · ${formatSignal(peak.value ?? 0)}`
    : "No signal at this position"

  const statRows: StatRow[] = [
    { label: "Bin span", value: range ? formatSpan(range.end - range.start) : "—" },
    { label: "Cell types", value: cellCount },
  ]

  return createPortal(
    <FloatingPanel
      accent={palette.primary.main}
      title={range ? formatLocus(chrom, range.start, range.end) : formatPoint(chrom, base)}
      nameLine={nameLine}
      statRows={statRows}
      onClose={onClose}
      pos={pos}
      onPosChange={setPos}
      size={size}
      onSizeChange={setSize}
      defaultPos={POPUP_DEFAULT_POS}
      defaultWidth={BIN_POPUP_W}
      defaultHeight={BIN_POPUP_H}
      minWidth={POPUP_MIN_W}
      minHeight={POPUP_MIN_H}
      windowKey="gene-popup"
    >
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, pt: 0.75, pb: 1.5 }}>
        {sections.map((section) => (
          <Box key={section.group} sx={{ mb: 1.25 }}>
            <Typography
              noWrap
              sx={{
                fontSize: 11,
                lineHeight: 1.4,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                color: "secondary.main",
                mb: 0.5,
              }}
            >
              {section.group}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, max-content) minmax(40px, 1fr) max-content",
                alignItems: "center",
                columnGap: 1,
                rowGap: 0.5,
              }}
            >
              {section.rows.map((r) => (
                <Fragment key={r.key}>
                  <Box sx={{ minWidth: 0, display: "flex", alignItems: "baseline" }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {r.label}
                    </Typography>
                    {r.strand && (
                      <Typography
                        variant="caption"
                        sx={{ flexShrink: 0, ml: 0.5, color: "text.secondary" }}
                      >
                        ({r.strand})
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    {r.value != null && <MiniBar fraction={r.value / domainMax} color={r.color} />}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      textAlign: "right",
                      fontFamily: custom.monoFontFamily,
                      fontSize: custom.monoFontSize,
                      color: r.value == null ? "text.disabled" : "text.primary",
                    }}
                  >
                    {r.value == null ? "—" : formatSignal(r.value)}
                  </Typography>
                </Fragment>
              ))}
            </Box>
          </Box>
        ))}
        {sections.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No coverage tracks
          </Typography>
        )}
      </Box>
    </FloatingPanel>,
    document.body,
  )
}
