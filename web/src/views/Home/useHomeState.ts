// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useGenes } from "@/api/hooks/useGenes"
import { useCapabilities } from "@/api/hooks/useCapabilities"
import { ROUTES } from "@/config/routes"
import { useUIStore } from "@/store/uiStore"

export type HomeTile = (typeof ROUTES)[number]

export function useHomeState() {
  const navigate = useNavigate()
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const { data: genes } = useGenes()
  const { data: capabilities } = useCapabilities()

  const tiles = useMemo(
    () => ROUTES.filter((r) => !r.capability || capabilities?.[r.capability] === true),
    [capabilities],
  )

  const onSelectGene = useCallback(
    (geneId: string) => {
      setSelectedGeneId(geneId)
      navigate("/genes")
    },
    [setSelectedGeneId, navigate],
  )

  const onOpenView = useCallback((path: string) => navigate(path), [navigate])

  return { genes: genes ?? [], tiles, onSelectGene, onOpenView }
}
