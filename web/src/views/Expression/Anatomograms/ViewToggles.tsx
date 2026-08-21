// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import FemaleIcon from "@mui/icons-material/Female"
import MaleIcon from "@mui/icons-material/Male"
import PsychologyIcon from "@mui/icons-material/Psychology"
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material"
import type { RailView } from "./tissueMaps"

interface Props {
  view: RailView
  onPickSex: (sex: "female" | "male") => void
  onPickBrain: () => void
}

export default function AnatomogramViewToggles({ view, onPickSex, onPickBrain }: Props) {
  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: 1 }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={view === "brain" ? null : view}
        onChange={(_, v) => v && onPickSex(v)}
      >
        <ToggleButton value="female" sx={{ px: 1.5 }}>
          <Tooltip title="Show female body">
            <FemaleIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="male" sx={{ px: 1.5 }}>
          <Tooltip title="Show male body">
            <MaleIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      <ToggleButton
        size="small"
        value="brain"
        selected={view === "brain"}
        onChange={() => onPickBrain()}
        sx={{ px: 1.5, gap: 0.5 }}
      >
        <PsychologyIcon fontSize="small" />
      </ToggleButton>
    </Box>
  )
}
