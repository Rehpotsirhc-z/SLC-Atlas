// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import ViewInArIcon from "@mui/icons-material/ViewInAr"
import { ListSubheader, MenuItem, Select, Tooltip } from "@mui/material"
import { PREDICTED_ID, type ModelOption } from "./modelOptions"

interface Props {
  options: ModelOption[]
  selectedPdbId: string | null
  onSelect: (pdbId: string | null) => void
}

export default function ModelSwitcher({ options, selectedPdbId, onSelect }: Props) {
  const predicted = options.filter((option) => option.id === PREDICTED_ID)
  const experimental = options.filter((option) => option.id !== PREDICTED_ID)

  return (
    <Tooltip title="Model shown in the viewer" placement="top" arrow>
      <Select
        size="small"
        fullWidth
        value={selectedPdbId ?? PREDICTED_ID}
        onChange={(e) => onSelect(e.target.value === PREDICTED_ID ? null : e.target.value)}
        startAdornment={<ViewInArIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.75 }} />}
        inputProps={{ "data-testid": "model-switcher" }}
      >
        {predicted.length > 0 && <ListSubheader>Predicted</ListSubheader>}
        {predicted.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.label}
          </MenuItem>
        ))}
        {experimental.length > 0 && (
          <ListSubheader>Experimental ({experimental.length})</ListSubheader>
        )}
        {experimental.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </Tooltip>
  )
}
