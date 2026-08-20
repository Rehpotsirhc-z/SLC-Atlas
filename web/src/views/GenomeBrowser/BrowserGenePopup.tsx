// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Show details and navigation for a selected browser gene

import { createPortal } from "react-dom"
import MyLocationIcon from "@mui/icons-material/MyLocation"
import { Box, useTheme } from "@mui/material"
import { useGeneById } from "@/api/hooks/useGenes"
import FamilyLabel from "@/components/FamilyLabel"
import FloatingGenePanel, { type StatRow } from "@/components/genePanel/FloatingGenePanel"
import { useUIStore } from "@/store/uiStore"
import { getFamilyColor } from "@/utils/familyColor"
import { strandLabel } from "./BrowserTooltip"
import type { GenePick } from "./browserPick"
import { formatLocus } from "./scale"

interface Props {
  gene: GenePick
  chrom: string
  ensemblChrom: string | null
  onReframe: (geneId: string, start: number, end: number) => void
  onClose: () => void
}

export default function BrowserGenePopup({ gene, chrom, ensemblChrom, onReframe, onClose }: Props) {
  const { palette, custom } = useTheme()
  const geneById = useGeneById()
  const pos = useUIStore((s) => s.popupPos)
  const setPos = useUIStore((s) => s.setPopupPos)
  const size = useUIStore((s) => s.popupSize)
  const setSize = useUIStore((s) => s.setPopupSize)

  const full = geneById.get(gene.geneId) ?? null
  const familyColor = full ? getFamilyColor(full.family, palette.mode) : palette.primary.main

  // UCSC uses one-based inclusive coordinates
  const ucscGene =
    full ??
    (ensemblChrom ? { chromosome: ensemblChrom, start: gene.start + 1, end: gene.end } : null)

  const isTranscript = gene.transcriptId !== null
  const geneLabel = full?.symbol ?? gene.label
  const monoSx = { fontFamily: custom.monoFontFamily, fontSize: custom.monoFontSize }

  const statRows: StatRow[] = [
    ...(full
      ? [
          {
            label: "Family",
            value: (
              <FamilyLabel
                label={full.family_name || full.family}
                color={familyColor}
                category={full.category}
              />
            ),
          },
        ]
      : []),
    ...(isTranscript
      ? [
          { label: "Gene", value: geneLabel },
          {
            label: "Gene ID",
            value: (
              <Box component="span" sx={monoSx}>
                {gene.geneId}
              </Box>
            ),
          },
        ]
      : []),
    { label: "Biotype", value: gene.biotype?.replace(/_/g, " ") ?? "unknown" },
    { label: "Strand", value: strandLabel(gene.strand) },
    { label: "Location", value: formatLocus(chrom, gene.start, gene.end) },
    { label: "Structure", value: gene.structure },
  ]

  const reframe = () => {
    onReframe(gene.geneId, gene.start, gene.end)
    onClose()
  }

  return createPortal(
    <FloatingGenePanel
      symbol={isTranscript ? (gene.transcriptName ?? gene.transcriptId) : geneLabel}
      geneId={isTranscript ? (gene.transcriptName ? gene.transcriptId : null) : gene.geneId}
      geneName={full?.name}
      familyColor={familyColor}
      statRows={statRows}
      ucscGene={ucscGene}
      onClose={onClose}
      primaryAction={{
        label: "Zoom to this region",
        icon: <MyLocationIcon fontSize="small" />,
        onClick: reframe,
      }}
      pos={pos}
      onPosChange={setPos}
      size={size}
      onSizeChange={setSize}
      defaultWidth={360}
    />,
    document.body,
  )
}
