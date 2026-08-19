// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { useGeneById, useGenes } from "@/api/hooks/useGenes"
import { useUIStore } from "@/store/uiStore"
import {
  clearShareParam,
  markNavigated,
  arrivalParam,
  setShareParam,
  settleGeneArrival,
} from "@/utils/shareUrl"

// Keeps the global gene selection in sync with the URL
export default function ShareUrlSync() {
  const { pathname } = useLocation()
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const genesQuery = useGenes()
  const geneById = useGeneById()

  const lastPathname = useRef(pathname)
  useEffect(() => {
    if (pathname === lastPathname.current) return
    lastPathname.current = pathname
    markNavigated()
  }, [pathname])

  const resolved = useRef(false)
  useEffect(() => {
    if (resolved.current) return
    const raw = arrivalParam("gene")
    if (raw === undefined) {
      resolved.current = true
      settleGeneArrival()
      return
    }
    const genes = genesQuery.data
    if (!genes) return
    const wanted = raw.toLowerCase()
    const match = genes.find(
      (gene) => gene.symbol.toLowerCase() === wanted || gene.id.toLowerCase() === wanted,
    )
    if (match) setSelectedGeneId(match.id)
    else clearShareParam("gene")
    resolved.current = true
    settleGeneArrival()
  }, [genesQuery.data, setSelectedGeneId])

  useEffect(() => {
    if (!resolved.current) return
    // This effect can run before the store subscription receives the resolved gene
    const id = useUIStore.getState().selectedGeneId
    if (id) setShareParam("gene", geneById.get(id)?.symbol ?? id)
    else clearShareParam("gene")
  }, [selectedGeneId, geneById])

  return null
}
