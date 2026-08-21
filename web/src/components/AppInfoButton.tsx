// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import { IconButton, Tooltip } from "@mui/material"
import { useUIStore } from "@/store/uiStore"

export default function AppInfoButton() {
  const open = useUIStore((s) => s.aboutOpen)
  const setOpen = useUIStore((s) => s.setAboutOpen)

  return (
    <Tooltip title="About">
      <IconButton
        onClick={() => setOpen(!open)}
        size="small"
        color={open ? "secondary" : "inherit"}
        aria-label="About"
      >
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}
