// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import CapabilityGate from "./components/view/CapabilityGate"
import { ROUTES, type RouteMeta, type RoutePath } from "./config/routes"
import Clustering from "./views/Clustering"
import Conservation from "./views/Conservation"
import Expression from "./views/Expression"
import GeneAnnotation from "./views/GeneAnnotation"
import GenomeBrowser from "./views/GenomeBrowser"
import Structure from "./views/Structure"

export interface AppRoute extends RouteMeta {
  element: ReactNode
}

const ELEMENTS: Record<RoutePath, ReactNode> = {
  "/genes": <GeneAnnotation />,
  "/clustering": <Clustering />,
  "/conservation": <Conservation />,
  "/browser": <GenomeBrowser />,
  "/expression": <Expression />,
  "/structure": <Structure />,
}

export const routes: AppRoute[] = ROUTES.map((r) => ({
  ...r,
  element: (
    <CapabilityGate capability={r.capability} label={r.label}>
      {ELEMENTS[r.path]}
    </CapabilityGate>
  ),
}))
