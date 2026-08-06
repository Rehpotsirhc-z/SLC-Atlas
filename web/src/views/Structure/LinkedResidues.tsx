// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Typography } from "@mui/material"
import { formatSpans } from "./bindingSites"
import type { ResidueSpan } from "./molstar/types"

interface Props {
  highlightSpans: ResidueSpan[]
  linkable: boolean
}

const HINT = "Hover either view to light up the same residues in the other, click to zoom to them"

export default function LinkedResidues({ highlightSpans, linkable }: Props) {
  const text = !linkable
    ? "This entry has its own residue numbering, so the topology figure does not index it"
    : highlightSpans.length === 0
      ? HINT
      : `Highlighting residue ${formatSpans(highlightSpans)}`

  return (
    <Typography variant="caption" color="text.secondary" data-testid="linked-residues">
      {text}
    </Typography>
  )
}
