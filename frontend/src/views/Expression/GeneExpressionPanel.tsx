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
import MiniBar from "@/components/MiniBar"
import ResizeHandles from "@/components/ResizeHandles"
import { getFamilyColor } from "@/utils/familyColor"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import { displayTissue } from "@/utils/tissue"
import { tpmIntensity } from "@/utils/tpmColor"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
import { useResizablePanel, type PanelSize } from "@/utils/useResizablePanel"
import type { ExpressionRow } from "@/types/expression"
import type { Gene } from "@/types/gene"

const glowFlash = keyframes`
  0%   { outline: 2px solid rgba(144, 202, 249, 0.9); }
  100% { outline: 2px solid rgba(144, 202, 249, 0); }
`

export interface ExpressionGeneInfo {
  geneId: string
  symbol: string
  family: string | null
  gene: Gene | null
  rows: ExpressionRow[]
}

const DEFAULT_POS: PanelPos = { x: 12, y: 120 }
const DEFAULT_SIZE: PanelSize = { w: 340, h: 520 }
const MIN_W = 280
const MIN_H = 320

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatTpm(value: number): string {
  return value < 10 ? value.toFixed(2) : value.toFixed(1)
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

export default function GeneExpressionPanel({
  info,
  onClose,
  onOpenInGenes,
  pos,
  onPosChange,
  size,
  onSizeChange,
}: GeneExpressionPanelProps) {
  const { geneId, symbol, family, gene, rows } = info
  const { palette, custom } = useTheme()
  const familyColor = getFamilyColor(family ?? "?", palette.mode)
  const panelRef = useRef<HTMLDivElement>(null)
  const { currentPos, handleDragStart, handleTouchStart } = useDraggablePanel(
    panelRef,
    pos,
    onPosChange,
    DEFAULT_POS,
  )
  const currentSize = size ?? DEFAULT_SIZE
  const { startResize } = useResizablePanel(
    currentPos,
    onPosChange,
    currentSize,
    onSizeChange,
    MIN_W,
    MIN_H,
  )

  const sortedRows = [...rows].sort((a, b) => b.tpm - a.tpm)
  const maxRow = sortedRows[0] ?? null
  const medianTpm = median(rows.map((r) => r.tpm))
  const domainMax = Math.max(...rows.map((r) => Math.log2(r.tpm + 1)), 1)

  const statRows: { label: string; value: React.ReactNode }[] = [
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
              {family ?? "?"}
            </Box>
          </Box>
        </Tooltip>
      ),
    },
    { label: "Tissues shown", value: rows.length },
    {
      label: "Max TPM",
      value: maxRow ? `${formatTpm(maxRow.tpm)} (${displayTissue(maxRow.tissue)})` : "—",
    },
    { label: "Median TPM", value: medianTpm !== null ? formatTpm(medianTpm) : "—" },
  ]

  return (
    <Paper
      ref={panelRef}
      elevation={6}
      sx={{
        position: "fixed",
        top: currentPos.y,
        left: currentPos.x,
        width: currentSize.w,
        height: currentSize.h,
        zIndex: 5,
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
        {gene?.name && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {gene.name}
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

        <Divider sx={{ mt: 1, mb: 0.75 }} />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          display: "grid",
          gridTemplateColumns: "minmax(0, max-content) minmax(48px, 1fr) max-content",
          alignItems: "center",
          columnGap: 1,
          rowGap: 0.75,
          alignContent: "start",
        }}
      >
        {sortedRows.map((r) => (
          <Box key={r.tissue} sx={{ display: "contents" }}>
            <Typography
              variant="caption"
              sx={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayTissue(r.tissue)}
            </Typography>
            <Box sx={{ pl: 5, minWidth: 0, display: "flex", alignItems: "center" }}>
              <MiniBar
                fraction={tpmIntensity(r.tpm, domainMax)}
                title={`${formatTpm(r.tpm)} TPM`}
              />
            </Box>
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
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 1.5, pb: 1.5, pt: 0.75, flexShrink: 0 }}>
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
            <Button
              size="small"
              variant="text"
              startIcon={<OpenInNewIcon />}
              component="a"
              href={ensemblUrl(geneId)}
              target="_blank"
              rel="noopener"
              sx={{ flex: 1 }}
            >
              Ensembl
            </Button>
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
