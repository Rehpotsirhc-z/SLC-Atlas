// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"
import { alpha, useTheme } from "@mui/material/styles"

interface TissueFlashOverlayProps {
  spans: [number, number][]
  cellW: number
  gridH: number
  reduceMotion: boolean
}

export default function TissueFlashOverlay({
  spans,
  cellW,
  gridH,
  reduceMotion,
}: TissueFlashOverlayProps) {
  const accent = useTheme().palette.secondary.main
  return (
    <>
      {spans.map(([start, end]) => (
        <Box
          key={start}
          sx={{
            position: "absolute",
            left: start * cellW,
            top: 0,
            width: (end - start + 1) * cellW,
            height: gridH,
            pointerEvents: "none",
            zIndex: 1,
            boxShadow: `inset 0 0 0 2px ${accent}`,
            bgcolor: alpha(accent, 0.12),
            ...(reduceMotion
              ? {}
              : {
                  animation: "tissueFlash 1.2s ease-out",
                  "@keyframes tissueFlash": {
                    "0%": { opacity: 0 },
                    "15%": { opacity: 1 },
                    "70%": { opacity: 0.55 },
                    "100%": { opacity: 0 },
                  },
                }),
          }}
        />
      ))}
    </>
  )
}
