// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useUIStore } from "@/store/uiStore"
import GeneInfoPanel from "@/views/Clustering/GeneInfoPanel"
import GeneConservationPanel from "@/views/Conservation/GeneConservationPanel"
import GeneExpressionPanel from "@/views/Expression/GeneExpressionPanel"

const POPUP_ROUTES = new Set(["/clustering", "/conservation", "/expression"])

export default function GeneInfoPopup() {
  const content = useUIStore((s) => s.popupContent)
  const setContent = useUIStore((s) => s.setPopupContent)
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const pos = useUIStore((s) => s.popupPos)
  const setPos = useUIStore((s) => s.setPopupPos)
  const size = useUIStore((s) => s.popupSize)
  const setSize = useUIStore((s) => s.setPopupSize)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!selectedGeneId) setContent(null)
  }, [selectedGeneId, setContent])

  if (!content || !POPUP_ROUTES.has(pathname)) return null

  const onClose = () => setSelectedGeneId(null)
  const onOpenInGenes = () => navigate("/genes")
  const geometry = {
    pos,
    onPosChange: setPos,
    size,
    onSizeChange: setSize,
    onClose,
    onOpenInGenes,
  }

  switch (content.kind) {
    case "clustering":
      return <GeneInfoPanel key={content.info.node.gene_id} info={content.info} {...geometry} />
    case "conservation":
      return (
        <GeneConservationPanel
          key={content.info.geneId}
          info={content.info}
          metric={content.metric}
          {...geometry}
        />
      )
    case "expression":
      return (
        <GeneExpressionPanel key={content.info.geneId} info={content.info} {...geometry} />
      )
  }
}
