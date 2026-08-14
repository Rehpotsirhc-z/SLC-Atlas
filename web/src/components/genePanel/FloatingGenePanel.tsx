// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, type ReactNode } from "react"
import CloseIcon from "@mui/icons-material/Close"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import TableRowsIcon from "@mui/icons-material/TableRows"
import { Box, Button, Divider, IconButton, Paper, Typography, useTheme } from "@mui/material"
import ResizeHandles from "@/components/ResizeHandles"
import { capBoxSx, capButtonSx, glowFlash } from "@/theme"
import type { Gene } from "@/types/gene"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
import { useFloatingWindow } from "@/utils/useFloatingWindow"
import { useResizablePanel, type PanelSize } from "@/utils/useResizablePanel"

export const DEFAULT_POS: PanelPos = { x: 29, y: 325 }
export const MIN_W = 280
export const MIN_H = 320

export interface StatRow {
  label: string
  value: ReactNode
}

interface Props {
  symbol: string | null
  geneId: string | null
  geneName?: string | null
  familyColor: string
  statRows: StatRow[]
  ucscGene: Gene | null
  onClose: () => void
  onOpenInGenes: () => void
  pos: PanelPos | null
  onPosChange: (pos: PanelPos) => void
  size: PanelSize | null
  onSizeChange: (size: PanelSize) => void
  defaultWidth: number
  children?: ReactNode
}

export default function FloatingGenePanel({
  symbol,
  geneId,
  geneName,
  familyColor,
  statRows,
  ucscGene,
  onClose,
  onOpenInGenes,
  pos,
  onPosChange,
  size,
  onSizeChange,
  defaultWidth,
  children,
}: Props) {
  const { custom } = useTheme()
  const panelRef = useRef<HTMLDivElement>(null)
  const { currentPos, handleDragStart, handleTouchStart } = useDraggablePanel(
    panelRef,
    pos,
    onPosChange,
    DEFAULT_POS,
  )
  const currentSize = {
    w: Math.max(size?.w ?? defaultWidth, MIN_W),
    h: Math.max(size?.h ?? 520, MIN_H),
  }
  useLayoutEffect(() => {
    if (!size || size.w < MIN_W || size.h < MIN_H) onSizeChange(currentSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])
  const { startResize } = useResizablePanel(
    currentPos,
    onPosChange,
    currentSize,
    onSizeChange,
    MIN_W,
    MIN_H,
  )
  const { zIndex, focusProps } = useFloatingWindow("gene-popup")

  const dragProps = { onMouseDown: handleDragStart, onTouchStart: handleTouchStart }

  return (
    <Paper
      ref={panelRef}
      elevation={6}
      {...focusProps}
      sx={{
        position: "fixed",
        top: currentPos.y,
        left: currentPos.x,
        width: currentSize.w,
        height: currentSize.h,
        zIndex,
        border: 1,
        borderColor: "divider",
        animation: `${glowFlash} 0.8s ease-out`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        {...dragProps}
        sx={{
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          px: 1.5,
          py: 0.875,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
        }}
      >
        <Box sx={{ width: "52%", height: 3, borderRadius: 1.5, bgcolor: "divider" }} />
      </Box>

      <Box sx={{ px: 1.5, pt: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ color: familyColor, lineHeight: 1.2 }}
          >
            {symbol}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ mt: -0.5, mr: -0.5, color: "text.secondary" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            fontFamily: custom.monoFontFamily,
            fontSize: custom.monoFontSize,
          }}
        >
          {geneId}
        </Typography>
        {geneName && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {geneName}
          </Typography>
        )}

        <Divider sx={{ my: 1 }} />

        <Box
          sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, rowGap: 0.75 }}
        >
          {statRows.map((r) => (
            <Box key={r.label} sx={{ display: "contents" }}>
              <Typography variant="caption" color="text.secondary">
                {r.label}
              </Typography>
              <Typography variant="caption" sx={{ textAlign: "right" }}>
                {r.value}
              </Typography>
            </Box>
          ))}
        </Box>

        {children && <Divider sx={{ mt: 1, mb: 0.75 }} />}
      </Box>

      {children ?? <Box sx={{ flex: 1, minHeight: 0 }} />}

      <Box sx={{ px: 1.5, pb: 1.5, pt: children ? 0.75 : 1, flexShrink: 0 }}>
        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<TableRowsIcon />}
            onClick={onOpenInGenes}
            sx={capButtonSx}
          >
            <Box component="span" sx={capBoxSx}>
              Open in Genes view
            </Box>
          </Button>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {geneId && (
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon />}
                component="a"
                href={ensemblUrl(geneId)}
                target="_blank"
                rel="noopener"
                sx={{ flex: 1, ...capButtonSx }}
              >
                <Box component="span" sx={capBoxSx}>
                  Ensembl
                </Box>
              </Button>
            )}
            {ucscGene && (
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon />}
                component="a"
                href={ucscUrl(ucscGene)}
                target="_blank"
                rel="noopener"
                sx={{ flex: 1, ...capButtonSx }}
              >
                <Box component="span" sx={capBoxSx}>
                  UCSC
                </Box>
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      <ResizeHandles onResize={startResize} />
    </Paper>
  )
}
