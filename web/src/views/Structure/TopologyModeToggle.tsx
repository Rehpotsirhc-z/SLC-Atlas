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
    hint: "Show each helix or loop as one mark on the residue axis",
  },
  {
    value: "residues",
    label: "Residues",
    hint: "Show each residue as a bead threaded through the membrane",
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
      {MODES.map((option) => (
        <ToggleButton key={option.value} value={option.value} sx={{ p: 0 }}>
          <Tooltip title={option.hint}>
            <Box component="span" sx={{ ...capLineSx, px: 1.25, py: 0.25 }}>
              {option.label}
            </Box>
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
