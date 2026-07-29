// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import ViewInArIcon from "@mui/icons-material/ViewInAr"
import { ListSubheader, MenuItem, Select, Tooltip } from "@mui/material"
import { entryLabel } from "./experimentalEntry"
import type { ExperimentalStructure } from "@/types/structure"

interface Props {
  entries: ExperimentalStructure[]
  selectedPdbId: string | null
  onSelect: (pdbId: string | null) => void
}

// An empty value would read to MUI as nothing selected and render a blank field
const PREDICTED = "predicted"

export default function ModelSwitcher({ entries, selectedPdbId, onSelect }: Props) {
  return (
    <Tooltip title="Model shown in the viewer" placement="top" arrow>
      <Select
        size="small"
        fullWidth
        value={selectedPdbId ?? PREDICTED}
        onChange={(e) => onSelect(e.target.value === PREDICTED ? null : e.target.value)}
        startAdornment={<ViewInArIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.75 }} />}
        inputProps={{ "data-testid": "model-switcher" }}
      >
        <ListSubheader>Predicted</ListSubheader>
        <MenuItem value={PREDICTED}>Predicted model (AlphaFold)</MenuItem>
        <ListSubheader>Experimental ({entries.length})</ListSubheader>
        {entries.map((entry) => (
          <MenuItem key={entry.pdb_id} value={entry.pdb_id}>
            {entryLabel(entry)}
          </MenuItem>
        ))}
      </Select>
    </Tooltip>
  )
}
