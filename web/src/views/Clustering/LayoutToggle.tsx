// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import HubIcon from "@mui/icons-material/Hub"
import { IconButton, Tooltip, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
import FloatingSurface from "@/components/view/FloatingSurface"
import type { Layout } from "./PhyloTree"

const LAYOUT_OPTIONS: { value: Layout; icon: ReactNode; label: string }[] = [
  {
    value: "rectangular",
    icon: <AccountTreeIcon sx={{ fontSize: 18 }} />,
    label: "Rectangular tree",
  },
  { value: "radial", icon: <HubIcon sx={{ fontSize: 18 }} />, label: "Radial tree" },
]

interface Props {
  layout: Layout
  onChange: (layout: Layout) => void
}

export default function LayoutToggle({ layout, onChange }: Props) {
  const theme = useTheme()
  const selectedColor = theme.palette.secondary.main

  return (
    <FloatingSurface sx={{ top: 12, right: 12, zIndex: 2, overflow: "hidden" }}>
      {LAYOUT_OPTIONS.map(({ value, icon, label }, i) => (
        <Tooltip key={value} title={label} placement="left" arrow>
          <IconButton
            size="small"
            onClick={() => onChange(value)}
            sx={{
              borderRadius: 0,
              px: 1.25,
              py: 1,
              color: layout === value ? selectedColor : "text.secondary",
              bgcolor: layout === value ? alpha(selectedColor, 0.15) : "transparent",
              "&:hover": {
                bgcolor:
                  layout === value
                    ? alpha(selectedColor, 0.27)
                    : alpha(theme.palette.action.active, 0.06),
              },
              ...(i < LAYOUT_OPTIONS.length - 1 && { borderBottom: 1, borderColor: "divider" }),
            }}
          >
            {icon}
          </IconButton>
        </Tooltip>
      ))}
    </FloatingSurface>
  )
}
