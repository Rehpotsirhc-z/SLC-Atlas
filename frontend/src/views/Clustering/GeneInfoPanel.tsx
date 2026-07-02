// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import CloseIcon from "@mui/icons-material/Close"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import TableRowsIcon from "@mui/icons-material/TableRows"
import { keyframes } from "@mui/system"
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { useRef } from "react"
import { getFamilyColor } from "@/utils/familyColor"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
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

const DEFAULT_POS: PanelPos = { x: 12, y: 120 }

interface GeneInfoPanelProps {
  info: GeneInfo
  onClose: () => void
  onOpenInGenes: () => void
  pos: PanelPos | null
  onPosChange: (pos: PanelPos) => void
}

export default function GeneInfoPanel({
  info,
  onClose,
  onOpenInGenes,
  pos,
  onPosChange,
}: GeneInfoPanelProps) {
  const { node, methodLabel, closestSymbol, gene } = info
  const { palette, custom } = useTheme()
  const familyColor = getFamilyColor(node.family ?? "?", palette.mode)
  const panelRef = useRef<HTMLDivElement>(null)
  const { currentPos, handleDragStart, handleTouchStart } = useDraggablePanel(
    panelRef,
    pos,
    onPosChange,
    DEFAULT_POS,
  )

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Family",
      value: (
        <Tooltip
          placement="left"
          disableHoverListener={!gene?.category}
          slotProps={{
            tooltip: {
              sx: {
                bgcolor: "background.default",
                color: "text.primary",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                boxShadow: 3,
                py: 1,
                px: 1.25,
                m: 0,
                maxWidth: 240,
                fontSize: "0.7rem",
                lineHeight: 1.45,
              },
            },
          }}
          title={
            gene?.category ? (
              <>
                {gene.family_name && (
                  <Box sx={{ fontWeight: 600, display: "block" }}>{gene.family_name}</Box>
                )}
                <Box sx={{ color: "text.secondary", display: "block" }}>{gene.category}</Box>
              </>
            ) : (
              ""
            )
          }
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0.75,
              cursor: gene?.category ? "help" : "default",
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: familyColor }} />
            <Box component="span" sx={{ transform: "translateY(1px)" }}>
              {node.family}
            </Box>
          </Box>
        </Tooltip>
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
      sx={{
        position: "absolute",
        top: currentPos.y,
        left: currentPos.x,
        width: 260,
        maxWidth: "calc(100% - 24px)",
        zIndex: 3,
        border: 1,
        borderColor: "divider",
        animation: `${glowFlash} 0.8s ease-out`,
        overflow: "hidden",
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

      <Box sx={{ p: 1.5 }}>
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
          sx={{ fontFamily: custom.monoFontFamily, fontSize: custom.monoFontSize }}
        >
          {node.gene_id}
        </Typography>

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

        <Divider sx={{ mt: 1, mb: 1.5 }} />

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
    </Paper>
  )
}
