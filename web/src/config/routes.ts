// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface RouteMeta {
  path: string
  label: string
  /** Whether the floating gene-info popup may show on this route */
  popup?: boolean
  /** Capability this route needs; the nav hides it when the dataset lacks that data */
  capability?: string
}

// Preserves each literal path, which types the element map in routes.tsx
const route = <P extends string>(meta: RouteMeta & { path: P }) => meta

// Imported by vite.config.ts for the export's route pages, so nothing here may touch the DOM
export const ROUTES = [
  route({ path: "/genes", label: "Genes" }),
  route({ path: "/clustering", label: "Clustering", popup: true }),
  route({ path: "/conservation", label: "Conservation", popup: true }),
  route({ path: "/browser", label: "Genome Browser", capability: "browser" }),
  route({ path: "/expression", label: "Expression", popup: true }),
  route({ path: "/structure", label: "Structure", capability: "structure" }),
  route({ path: "/pet", label: "PET-SCAN" }),
]

export type RoutePath = (typeof ROUTES)[number]["path"]

export const HOME_ROUTE = ROUTES[0]

export const POPUP_PATHS = new Set<string>(ROUTES.filter((r) => r.popup).map((r) => r.path))
