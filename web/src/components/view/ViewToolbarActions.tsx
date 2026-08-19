// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import DownloadIcon from "@mui/icons-material/Download"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import { Box, Button, Divider, Menu, MenuItem, Tooltip, Typography } from "@mui/material"
import { capBoxSx, capButtonSx } from "@/theme"
import type { TbState } from "./useToolbarFit"

export interface ExportItem {
  label: string
  onClick: () => void
}

interface Props {
  tbState: TbState
  counterText: string
  onResetView?: () => void
  exportItems: ExportItem[]
}

export default function ViewToolbarActions({
  tbState,
  counterText,
  onResetView,
  exportItems,
}: Props) {
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const wrapped = tbState === "wrapped"
  const showCounter =
    (tbState === "full" || tbState === "counterCompact") && counterText.trim().length > 0
  const iconButtons = tbState === "compact" || tbState === "counterCompact"

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        width: wrapped ? "100%" : "auto",
      }}
    >
      <Typography
        variant="body2"
        color="success.main"
        sx={{ whiteSpace: "nowrap", display: showCounter ? "block" : "none" }}
      >
        {counterText}
      </Typography>
      <Divider orientation="vertical" flexItem sx={{ display: showCounter ? "block" : "none" }} />
      {iconButtons ? (
        <>
          {onResetView && (
            <Tooltip title="Reset view">
              <Button
                size="small"
                variant="outlined"
                onClick={onResetView}
                sx={{ minWidth: 0, px: "16px", py: "5px" }}
              >
                <RestartAltIcon fontSize="small" sx={{ display: "block" }} />
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Export">
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => setExportAnchor(e.currentTarget)}
              sx={{ minWidth: 0, px: "16px", py: "5px" }}
            >
              <DownloadIcon fontSize="small" sx={{ display: "block" }} />
            </Button>
          </Tooltip>
        </>
      ) : (
        <>
          {onResetView && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={onResetView}
              sx={{
                whiteSpace: "nowrap",
                flex: wrapped ? 1 : "none",
                gap: "6px",
                ...capButtonSx,
                "& .MuiButton-startIcon": { margin: 0 },
              }}
            >
              <Box component="span" sx={capBoxSx}>
                Reset view
              </Box>
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportAnchor(e.currentTarget)}
            sx={{
              flex: wrapped ? 1 : "none",
              gap: "6px",
              ...capButtonSx,
              "& .MuiButton-startIcon": { margin: 0 },
            }}
          >
            <Box component="span" sx={capBoxSx}>
              Export
            </Box>
          </Button>
        </>
      )}
      <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
        {exportItems.map((item) => (
          <MenuItem
            key={item.label}
            onClick={() => {
              setExportAnchor(null)
              item.onClick()
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
