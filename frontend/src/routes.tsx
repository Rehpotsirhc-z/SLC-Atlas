// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import Clustering from "./views/Clustering"
import Conservation from "./views/Conservation"
import Expression from "./views/Expression"
import GeneAnnotation from "./views/GeneAnnotation"
import GenomeBrowser from "./views/GenomeBrowser"
import PetScan from "./views/PetScan"
import Structure from "./views/Structure"

export interface AppRoute {
  path: string
  label: string
  element: ReactNode
  /** Whether the floating gene-info popup may show on this route */
  popup?: boolean
  /** Capability this route needs; the nav hides it when the dataset lacks that data */
  capability?: string
}

export const routes: AppRoute[] = [
  { path: "/genes", label: "Genes", element: <GeneAnnotation /> },
  { path: "/clustering", label: "Clustering", element: <Clustering />, popup: true },
  { path: "/conservation", label: "Conservation", element: <Conservation />, popup: true },
  { path: "/browser", label: "Genome Browser", element: <GenomeBrowser /> },
  { path: "/expression", label: "Expression", element: <Expression />, popup: true },
  { path: "/structure", label: "Structure", element: <Structure />, capability: "structure" },
  { path: "/pet", label: "PET-SCAN", element: <PetScan /> },
]

export const POPUP_PATHS = new Set(routes.filter((r) => r.popup).map((r) => r.path))
