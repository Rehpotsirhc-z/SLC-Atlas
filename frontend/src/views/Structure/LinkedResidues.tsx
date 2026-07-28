// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Typography } from "@mui/material"
import { formatSpans } from "./bindingSites"
import type { ResidueSpan } from "./molstar/types"

interface Props {
  highlightSpans: ResidueSpan[]
  focusedSpans: ResidueSpan[] | null
  linkable: boolean
}

const HINT = "Hover the topology figure to light up the same residues here, click to zoom to them"

export default function LinkedResidues({ highlightSpans, focusedSpans, linkable }: Props) {
  const spans = focusedSpans ?? highlightSpans
  const verb = focusedSpans ? "Focused" : "Highlighting"

  const text = !linkable
    ? "This entry has its own residue numbering, so the topology figure does not index it"
    : spans.length === 0
      ? HINT
      : `${verb} residue ${formatSpans(spans)}`

  return (
    <Typography variant="caption" color="text.secondary" data-testid="linked-residues">
      {text}
    </Typography>
  )
}
