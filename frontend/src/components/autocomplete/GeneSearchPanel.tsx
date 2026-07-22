// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type React from "react"
import { Autocomplete, TextField, Typography } from "@mui/material"
import { StyledPopper, acIndicatorSx, acInputSx, acOptionStyle } from "./styles"
import { VirtualListboxSm } from "./VirtualListbox"

export interface GeneOption {
  id: string
  symbol: string
}

interface Props {
  families: string[]
  genes: GeneOption[]
  familyFilter: string | null
  onFamilyChange: (family: string | null) => void
  selectedGeneId: string | null
  onGeneChange: (gene: GeneOption | null) => void
}

type OptionProps = { key: React.Key } & React.HTMLAttributes<HTMLLIElement>

function renderOption(props: object, label: string) {
  const { key, ...rest } = props as OptionProps
  return (
    <li key={key} {...rest} style={{ ...rest.style, ...acOptionStyle }}>
      <Typography variant="body2" fontWeight={600}>
        {label}
      </Typography>
    </li>
  )
}

export default function GeneSearchPanel({
  families,
  genes,
  familyFilter,
  onFamilyChange,
  selectedGeneId,
  onGeneChange,
}: Props) {
  return (
    <>
      <Autocomplete
        size="small"
        options={families}
        value={familyFilter}
        onChange={(_, v) => onFamilyChange(v)}
        sx={{ width: "100%", ...acIndicatorSx }}
        slots={{ listbox: VirtualListboxSm, popper: StyledPopper }}
        renderOption={(props, option) => renderOption(props, option)}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Family…"
            color="primary"
            sx={acInputSx}
          />
        )}
      />
      <Autocomplete
        size="small"
        options={genes}
        getOptionLabel={(o) => o.symbol}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        value={genes.find((g) => g.id === selectedGeneId) ?? null}
        onChange={(_, v) => onGeneChange(v)}
        sx={{ width: "100%", ...acIndicatorSx }}
        slots={{ listbox: VirtualListboxSm, popper: StyledPopper }}
        renderOption={(props, option) => renderOption(props, option.symbol)}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Find gene…"
            color="primary"
            sx={acInputSx}
          />
        )}
      />
    </>
  )
}
