// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface RouteMeta {
  path: string
  label: string
  description: string
  // Whether the floating gene-info popup may show on this route
  popup?: boolean
  // Capability this route needs; the nav hides it when the dataset lacks that data
  capability?: string
}

// Preserves each literal path, which types the element map in routes.tsx
const route = <P extends string>(meta: RouteMeta & { path: P }) => meta

// Imported by vite.config.ts for the export's route pages, so nothing here may touch the DOM
export const ROUTES = [
  route({
    path: "/genes",
    label: "Genes",
    description: "Symbols, names, genomic coordinates, and transcript models for every gene",
  }),
  route({
    path: "/clustering",
    label: "Clustering",
    description:
      "Similarity trees by amino-acid, DNA (CDS), RNA co-expression, and ortholog identity",
    popup: true,
    capability: "clustering",
  }),
  route({
    path: "/conservation",
    label: "Conservation",
    description: "Ortholog sequence conservation across species",
    popup: true,
    capability: "conservation",
  }),
  route({
    path: "/browser",
    label: "Genome Browser",
    description: "Coverage tracks, trait associations, and gene models on one genomic axis",
    capability: "browser",
  }),
  route({
    path: "/expression",
    label: "Expression",
    description: "RNA abundance across tissues",
    popup: true,
    capability: "expression",
  }),
  route({
    path: "/structure",
    label: "Structure",
    description: "Predicted models, sequence features, and experimental structures",
    capability: "structure",
  }),
]

export type RoutePath = (typeof ROUTES)[number]["path"]

export const HOME_ROUTE = ROUTES[0]

export const POPUP_PATHS = new Set<string>(ROUTES.filter((r) => r.popup).map((r) => r.path))
