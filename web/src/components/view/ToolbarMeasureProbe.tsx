// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import DownloadIcon from "@mui/icons-material/Download"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import { Box, Button, Typography } from "@mui/material"
import { capBoxSx, capButtonSx } from "@/theme"
import type { ToolbarProbeRefs } from "./useToolbarFit"

interface Props {
  refs: ToolbarProbeRefs
  counterText: string
  children: ReactNode
}

export default function ToolbarMeasureProbe({ refs, counterText, children }: Props) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        left: "-9999px",
        visibility: "hidden",
        pointerEvents: "none",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <Typography
        ref={refs.counterRef as React.Ref<HTMLElement>}
        variant="body2"
        sx={{ whiteSpace: "nowrap" }}
      >
        {counterText}
      </Typography>
      <Box ref={refs.textButtonsRef} sx={{ display: "flex", gap: 1.5 }}>
        <Button size="small" variant="outlined" startIcon={<RestartAltIcon />} sx={capButtonSx}>
          <Box component="span" sx={capBoxSx}>
            Reset view
          </Box>
        </Button>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} sx={capButtonSx}>
          <Box component="span" sx={capBoxSx}>
            Export
          </Box>
        </Button>
      </Box>
      <Box ref={refs.iconButtonsRef} sx={{ display: "flex", gap: 1.5 }}>
        <Button size="small" variant="outlined" sx={{ minWidth: 0, px: "16px", py: "5px" }}>
          <RestartAltIcon fontSize="small" sx={{ display: "block" }} />
        </Button>
        <Button size="small" variant="outlined" sx={{ minWidth: 0, px: "16px", py: "5px" }}>
          <DownloadIcon fontSize="small" sx={{ display: "block" }} />
        </Button>
      </Box>
      {children}
    </Box>
  )
}
