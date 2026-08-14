// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState, type KeyboardEvent } from "react"
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown"
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp"
import { Box, IconButton, InputAdornment, TextField, Typography, useTheme } from "@mui/material"
import { doomColors, monoFontFamily } from "@/theme"
import { SETTINGS_FIELD_W } from "./constants"

interface Props {
  value: number
  onChange: (value: number) => void
}

const stepSx = {
  p: 0,
  height: 12,
  color: "text.secondary",
  "&:hover": { color: "secondary.main", backgroundColor: "transparent" },
}

// Keep the draft separate so the field can be cleared while entering a new value
// Empty or non-positive input leaves the last valid maximum unchanged
export default function FixedMaxField({ value, onChange }: Props) {
  const { palette } = useTheme()
  const [draft, setDraft] = useState(String(value))
  const [written, setWritten] = useState(value)

  if (value !== written) {
    setWritten(value)
    setDraft(String(value))
  }

  const commit = (next: number) => {
    setWritten(next)
    onChange(next)
  }

  const step = (delta: number) => {
    const next = (Number(draft) || value) + delta
    if (next <= 0) return
    setDraft(String(next))
    commit(next)
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary", flex: 1 }}>Maximum</Typography>
      <TextField
        size="small"
        type="number"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          const parsed = Number(next)
          if (next !== "" && Number.isFinite(parsed) && parsed > 0) commit(parsed)
        }}
        onBlur={() => setDraft(String(value))}
        sx={{
          width: SETTINGS_FIELD_W,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: palette.divider },
          "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: doomColors[palette.mode].base5,
          },
          "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: palette.secondary.main,
            borderWidth: 1,
          },
          "& .MuiOutlinedInput-input": {
            fontFamily: monoFontFamily,
            fontSize: 13,
            paddingTop: "7px",
            paddingBottom: "7px",
            MozAppearance: "textfield",
            "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
              WebkitAppearance: "none",
              margin: 0,
            },
          },
        }}
        slotProps={{
          htmlInput: {
            "aria-label": "Fixed signal maximum",
            onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") event.currentTarget.blur()
            },
          },
          input: {
            endAdornment: (
              <InputAdornment position="end" sx={{ ml: 0 }}>
                <Box sx={{ display: "flex", flexDirection: "column", mr: -0.75 }}>
                  <IconButton
                    size="small"
                    aria-label="Increase maximum"
                    onClick={() => step(1)}
                    sx={stepSx}
                  >
                    <ArrowDropUpIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Decrease maximum"
                    onClick={() => step(-1)}
                    sx={stepSx}
                  >
                    <ArrowDropDownIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  )
}
