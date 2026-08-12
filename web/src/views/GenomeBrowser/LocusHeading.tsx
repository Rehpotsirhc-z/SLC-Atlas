// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Display the current genomic location */

import { memo, useEffect, useRef } from "react"
import { Box, Typography, useTheme } from "@mui/material"
import { EDGE_PAD } from "./constants"
import { formatLocus, formatSpan, type Viewport } from "./scale"
import type { Painter } from "./useBrowserView"

interface Props {
  chrom: string
  symbol: string | null
  subscribe: (paint: Painter) => () => void
}

export const locusText = (chrom: string, view: Viewport) =>
  `${formatLocus(chrom, view.start, view.end)} · ${formatSpan(view.end - view.start)}`

function LocusHeading({ chrom, symbol, subscribe }: Props) {
  const { custom } = useTheme()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(
    () =>
      subscribe((view) => {
        if (ref.current) ref.current.textContent = locusText(chrom, view)
      }),
    [subscribe, chrom],
  )

  return (
    <Box sx={{ px: `${EDGE_PAD}px`, pt: 1.25, pb: 0.5 }}>
      <Typography
        sx={{
          fontFamily: custom.monoFontFamily,
          fontSize: 15,
          fontWeight: 600,
          color: "primary.main",
          lineHeight: 1.3,
        }}
      >
        {symbol && (
          <Box component="span" sx={{ mr: 1 }}>
            {symbol} ·
          </Box>
        )}
        <Box component="span" ref={ref} />
      </Typography>
    </Box>
  )
}

export default memo(LocusHeading)
