// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"
import type { Gene } from "@/types/gene"
import GeneSearchBar from "@/components/autocomplete/GeneSearchBar"
import { SEARCH_MAX_WIDTH } from "./constants"

interface Props {
  genes: Gene[]
  onSelectGene: (geneId: string) => void
}

export default function HomeSearch({ genes, onSelectGene }: Props) {
  return (
    <Box sx={{ width: "100%", maxWidth: SEARCH_MAX_WIDTH, mx: "auto" }}>
      <GeneSearchBar genes={genes} onSelect={onSelectGene} width="100%" />
    </Box>
  )
}
