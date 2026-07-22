// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import { Box, IconButton, Link, Popover, Typography } from "@mui/material"
import type { SxProps, Theme } from "@mui/material/styles"
import { AttributionIcon } from "./icons"

const SOURCE_URL = "https://github.com/ebi-gene-expression-group/anatomogram"
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const LICENSE_PAGE_URL = "https://www.ebi.ac.uk/gxa/licence.html"

export default function AnatomogramAttribution({ sx }: { sx?: SxProps<Theme> }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <Box
      sx={{ position: "absolute", bottom: 8, right: 8, zIndex: 3, ...sx }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <IconButton
        component="a"
        href={LICENSE_PAGE_URL}
        target="_blank"
        rel="noopener noreferrer"
        size="small"
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={() => setAnchorEl(null)}
        sx={{
          color: "text.secondary",
          opacity: 0.55,
          "&:hover": { opacity: 1 },
        }}
      >
        <AttributionIcon sx={{ fontSize: 28 }} />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        disableRestoreFocus
        hideBackdrop
        disableScrollLock
        sx={{ pointerEvents: "none" }}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{ paper: { sx: { px: 1.5, py: "9px", mt: -1, maxWidth: 280 } } }}
      >
        <Typography variant="caption" component="p" sx={{ lineHeight: 1.5 }}>
          Anatomy figures adapted from the{" "}
          <Link href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            EBI Expression Atlas anatomogram
          </Link>{" "}
          (© EMBL-EBI), licensed under{" "}
          <Link href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
            CC BY 4.0
          </Link>
          .
        </Typography>
      </Popover>
    </Box>
  )
}
