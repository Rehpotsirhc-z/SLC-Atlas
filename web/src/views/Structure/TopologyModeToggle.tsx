// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material"
import { capLineSx } from "@/theme"
import type { TopologyMode } from "./useTopologyState"

const MODES: { value: TopologyMode; label: string; hint: string }[] = [
  {
    value: "regions",
    label: "Regions",
    hint: "One mark per helix or loop, on a residue axis, so a helix is as wide as it is long",
  },
  {
    value: "residues",
    label: "Residues",
    hint: "One bead per residue, threaded through the membrane",
  },
]

interface Props {
  mode: TopologyMode
  onChange: (mode: TopologyMode) => void
}

export default function TopologyModeToggle({ mode, onChange }: Props) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={mode}
      onChange={(_, next) => next && onChange(next)}
    >
      {/* The tooltip sits inside the button: the group hands its children props of its own */}
      {MODES.map((option) => (
        <ToggleButton key={option.value} value={option.value} sx={{ p: 0 }}>
          <Tooltip title={option.hint} arrow>
            <Box component="span" sx={{ ...capLineSx, px: 1.25, py: 0.25 }}>
              {option.label}
            </Box>
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
