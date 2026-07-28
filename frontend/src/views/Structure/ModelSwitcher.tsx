// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Chip, MenuItem, Stack, TextField } from "@mui/material"
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
    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
      <TextField
        select
        size="small"
        label="Showing"
        value={selectedPdbId ?? PREDICTED}
        onChange={(e) => onSelect(e.target.value === PREDICTED ? null : e.target.value)}
        slotProps={{ htmlInput: { "data-testid": "model-switcher" } }}
        sx={{ minWidth: 240, flex: 1 }}
      >
        <MenuItem value={PREDICTED}>Predicted model (AlphaFold)</MenuItem>
        {entries.map((entry) => (
          <MenuItem key={entry.pdb_id} value={entry.pdb_id}>
            {entryLabel(entry)}
          </MenuItem>
        ))}
      </TextField>

      <Chip
        size="small"
        variant="outlined"
        color={selectedPdbId ? "success" : "default"}
        label={selectedPdbId ? "Measured" : "Predicted"}
        data-testid="model-source-badge"
      />
    </Stack>
  )
}
