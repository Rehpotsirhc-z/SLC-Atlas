// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import CloseIcon from "@mui/icons-material/Close"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import TableRowsIcon from "@mui/icons-material/TableRows"
import { keyframes } from "@mui/system"
import { Box, Button, Divider, IconButton, Paper, Typography, useTheme } from "@mui/material"
import { useLayoutEffect, useRef } from "react"
import FamilyLabel from "@/components/FamilyLabel"
import ResizeHandles from "@/components/ResizeHandles"
import { getFamilyColor } from "@/utils/familyColor"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
import { useFloatingWindow } from "@/utils/useFloatingWindow"
import { useResizablePanel, type PanelSize } from "@/utils/useResizablePanel"
import type { ClusterNode } from "@/types/clustering"
import type { Gene } from "@/types/gene"

const glowFlash = keyframes`
  0%   { outline: 2px solid rgba(144, 202, 249, 0.9); }
  100% { outline: 2px solid rgba(144, 202, 249, 0); }
`

export interface GeneInfo {
  node: ClusterNode
  methodLabel: string
  closestSymbol: string | null
  gene: Gene | null
}

export type { PanelPos }

const DEFAULT_POS: PanelPos = { x: 29, y: 325 }
const DEFAULT_SIZE: PanelSize = { w: 340, h: 520 }
const MIN_W = 280
const MIN_H = 320

interface GeneInfoPanelProps {
  info: GeneInfo
  onClose: () => void
  onOpenInGenes: () => void
  pos: PanelPos | null
  onPosChange: (pos: PanelPos) => void
  size: PanelSize | null
  onSizeChange: (size: PanelSize) => void
}

export default function GeneInfoPanel({
  info,
  onClose,
  onOpenInGenes,
  pos,
  onPosChange,
  size,
  onSizeChange,
}: GeneInfoPanelProps) {
  const { node, methodLabel, closestSymbol, gene } = info
  const { palette, custom } = useTheme()
  const family = gene?.family ?? node.family ?? "?"
  const familyColor = getFamilyColor(family, palette.mode)
  const panelRef = useRef<HTMLDivElement>(null)
  const { currentPos, handleDragStart, handleTouchStart } = useDraggablePanel(
    panelRef,
    pos,
    onPosChange,
    DEFAULT_POS,
  )
  const currentSize = {
    w: Math.max(size?.w ?? DEFAULT_SIZE.w, MIN_W),
    h: Math.max(size?.h ?? DEFAULT_SIZE.h, MIN_H),
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

  const rows: { label: string; value: React.ReactNode }[] = [
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
      {/* Drag handle */}
      <Box
        onMouseDown={handleDragStart}
        onTouchStart={handleTouchStart}
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
        <Box
          sx={{
            width: "52%",
            height: 3,
            borderRadius: 1.5,
            bgcolor: "divider",
          }}
        />
      </Box>

      <Box sx={{ px: 1.5, pt: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ color: familyColor, lineHeight: 1.2 }}
          >
            {node.symbol}
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
          {node.gene_id}
        </Typography>
        {gene?.name && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {gene.name}
          </Typography>
        )}

        <Divider sx={{ my: 1 }} />

        <Box
          sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, rowGap: 0.75 }}
        >
          {rows.map((r) => (
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
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }} />

      <Box sx={{ px: 1.5, pb: 1.5, pt: 1, flexShrink: 0 }}>
        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<TableRowsIcon />}
            onClick={onOpenInGenes}
          >
            Open in Genes view
          </Button>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {node.gene_id && (
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon />}
                component="a"
                href={ensemblUrl(node.gene_id)}
                target="_blank"
                rel="noopener"
                sx={{ flex: 1 }}
              >
                Ensembl
              </Button>
            )}
            {gene && (
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon />}
                component="a"
                href={ucscUrl(gene)}
                target="_blank"
                rel="noopener"
                sx={{ flex: 1 }}
              >
                UCSC
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      <ResizeHandles onResize={startResize} />
    </Paper>
  )
}
