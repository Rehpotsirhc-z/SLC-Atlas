// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { triggerDownload } from "@/utils/download"
import { api } from "./client"
import type { ClusterMethod } from "./hooks/useClustering"

async function download(path: string, filename: string) {
  const text = await api.getText(path)
  triggerDownload(new Blob([text], { type: "text/plain" }), filename)
}

export const downloadGeneTreeNewick = (method: ClusterMethod, filename: string) =>
  download(`/clustering/newick?method=${method}`, filename)

export const downloadSpeciesTreeNewick = (filename: string) =>
  download("/conservation/species-tree/newick", filename)
