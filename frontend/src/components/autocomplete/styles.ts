// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type React from "react"
import { autocompleteClasses, Popper, styled } from "@mui/material"
import { monoFontFamily, monoFontSize } from "@/theme"

export const acOptionStyle: React.CSSProperties = { padding: "0 12px", boxSizing: "border-box" }

export const acInputSx = {
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "primary.main" },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "primary.main",
  },
  "& .MuiOutlinedInput-input": {
    color: "primary.main",
    fontFamily: monoFontFamily,
    fontSize: monoFontSize,
  },
  "& .MuiOutlinedInput-input::placeholder": { color: "primary.main", opacity: 0.6 },
}

export const acIndicatorSx = {
  "& .MuiAutocomplete-clearIndicator": { color: "text.secondary" },
  "& .MuiAutocomplete-popupIndicator": { color: "text.secondary" },
}

export const StyledPopper = styled(Popper)(({ theme }) => ({
  [`& .${autocompleteClasses.paper}`]: {
    backgroundColor: theme.palette.background.default,
  },
  [`& .${autocompleteClasses.listbox}`]: {
    boxSizing: "border-box",
    maxHeight: "none", // react-window controls height; MUI's 40vh cap breaks it
    paddingBottom: 0,
    "& ul": { padding: 0, margin: 0, listStyle: "none" },
  },
  [`& .${autocompleteClasses.option}`]: {
    // renderOption sets inline padding; reset MUI's default to avoid double-padding
    padding: 0,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    // borderTop because react-window overscan breaks :last-child, but item 0 is always
    // the first DOM child
    borderTop: `1px solid ${theme.palette.divider}`,
    "&:first-child": { borderTop: "none" },
    "&:hover": { backgroundColor: theme.palette.action.hover },
    "&.Mui-focused": { backgroundColor: theme.palette.action.hover },
  },
}))
