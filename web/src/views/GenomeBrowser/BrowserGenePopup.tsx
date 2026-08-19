// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Show details and navigation for a selected browser gene

import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import MyLocationIcon from "@mui/icons-material/MyLocation"
import { useTheme } from "@mui/material"
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
  onReframe: (geneId: string, start: number, end: number) => void
  onClose: () => void
}

export default function BrowserGenePopup({ gene, chrom, onReframe, onClose }: Props) {
  const { palette } = useTheme()
  const navigate = useNavigate()
  const geneById = useGeneById()
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const pos = useUIStore((s) => s.popupPos)
  const setPos = useUIStore((s) => s.setPopupPos)
  const size = useUIStore((s) => s.popupSize)
  const setSize = useUIStore((s) => s.setPopupSize)

  const full = geneById.get(gene.geneId) ?? null
  const familyColor = full ? getFamilyColor(full.family, palette.mode) : palette.primary.main

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
    { label: "Biotype", value: gene.biotype?.replace(/_/g, " ") ?? "unknown" },
    { label: "Strand", value: strandLabel(gene.strand) },
    { label: "Location", value: formatLocus(chrom, gene.start, gene.end) },
    { label: "Structure", value: gene.structure },
  ]

  const reframe = () => {
    onReframe(gene.geneId, gene.start, gene.end)
    onClose()
  }
  const openInGenes = () => {
    setSelectedGeneId(gene.geneId)
    navigate("/genes")
  }

  return createPortal(
    <FloatingGenePanel
      symbol={full?.symbol ?? gene.label}
      geneId={gene.geneId}
      geneName={full?.name}
      familyColor={familyColor}
      statRows={statRows}
      ucscGene={full}
      onClose={onClose}
      onOpenInGenes={full ? openInGenes : undefined}
      primaryAction={{
        label: "View gene region",
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
