// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { type ReactNode } from "react"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import { Box, Button, Divider } from "@mui/material"
import FloatingPanel, { type StatRow } from "@/components/FloatingPanel"
import { capBoxSx, capButtonSx } from "@/theme"
import type { Gene } from "@/types/gene"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import { type PanelPos } from "@/utils/useDraggablePanel"
import { type PanelSize } from "@/utils/useResizablePanel"

export const DEFAULT_POS: PanelPos = { x: 29, y: 325 }
export const MIN_W = 280
export const MIN_H = 320

export type { StatRow }

export interface PanelAction {
  label: string
  icon?: ReactNode
  onClick: () => void
}

interface Props {
  symbol: string | null
  geneId: string | null
  geneName?: string | null
  familyColor: string
  statRows: StatRow[]
  ucscGene: Pick<Gene, "chromosome" | "start" | "end"> | null
  onClose: () => void
  primaryAction?: PanelAction
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
  primaryAction,
  pos,
  onPosChange,
  size,
  onSizeChange,
  defaultWidth,
  children,
}: Props) {
  const footer = (
    <>
      <Divider sx={{ mb: 1.5 }} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {primaryAction && (
          <Button
            size="small"
            variant="outlined"
            startIcon={primaryAction.icon}
            onClick={primaryAction.onClick}
            sx={capButtonSx}
          >
            <Box component="span" sx={capBoxSx}>
              {primaryAction.label}
            </Box>
          </Button>
        )}
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
    </>
  )

  return (
    <FloatingPanel
      accent={familyColor}
      title={symbol}
      idLine={geneId}
      nameLine={geneName}
      statRows={statRows}
      footer={footer}
      onClose={onClose}
      pos={pos}
      onPosChange={onPosChange}
      size={size}
      onSizeChange={onSizeChange}
      defaultPos={DEFAULT_POS}
      defaultWidth={defaultWidth}
      defaultHeight={520}
      minWidth={MIN_W}
      minHeight={MIN_H}
      windowKey="gene-popup"
    >
      {children}
    </FloatingPanel>
  )
}
