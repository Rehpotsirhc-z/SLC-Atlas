// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from "react"
import SearchIcon from "@mui/icons-material/Search"
import { Autocomplete, InputAdornment, TextField, Typography } from "@mui/material"
import { debounce } from "@mui/material/utils"
import type { Gene } from "@/types/gene"
import { useUIStore } from "@/store/uiStore"
import { acInputSx, StyledPopper } from "@/components/autocomplete/styles"
import { VirtualListbox } from "@/components/autocomplete/VirtualListbox"

interface SearchBarProps {
  genes: Gene[]
  /** Only needed by views that filter their own content by the query text */
  value?: string
  onChange?: (value: string) => void
  width?: number | string
}

function buildIndex(genes: Gene[]) {
  return genes.map((g) => ({
    gene: g,
    lc_symbol: g.symbol.toLowerCase(),
    lc_id: g.id.toLowerCase(),
    lc_name: g.name.toLowerCase(),
    lc_alias: (g.alias ?? "").toLowerCase(),
  }))
}

export default function GeneSearchBar({
  genes,
  value = "",
  onChange = () => {},
  width = 360,
}: SearchBarProps) {
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const [inputValue, setInputValue] = useState(value)

  const index = useMemo(() => buildIndex(genes), [genes])

  const debouncedOnChange = useMemo(() => debounce(onChange, 150), [onChange])

  const options = useMemo(() => {
    const q = inputValue.trim().toLowerCase()
    if (!q) return genes.slice(0, 100)
    return index
      .filter(
        (item) =>
          item.lc_symbol.startsWith(q) ||
          item.lc_symbol.includes(q) ||
          item.lc_id.includes(q) ||
          item.lc_name.includes(q) ||
          item.lc_alias.includes(q),
      )
      .sort((a, b) => {
        // Exact symbol match first, then symbol prefix, then rest
        const aExact = a.lc_symbol === q
        const bExact = b.lc_symbol === q
        if (aExact !== bExact) return aExact ? -1 : 1
        const aPrefix = a.lc_symbol.startsWith(q)
        const bPrefix = b.lc_symbol.startsWith(q)
        if (aPrefix !== bPrefix) return aPrefix ? -1 : 1
        return a.lc_symbol.localeCompare(b.lc_symbol, undefined, { numeric: true })
      })
      .map((item) => item.gene)
      .slice(0, 200)
  }, [inputValue, index, genes])

  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, newInput: string) => {
      setInputValue(newInput)
      setSelectedGeneId(null)
      if (!newInput) {
        debouncedOnChange.clear()
        onChange("")
      } else {
        debouncedOnChange(newInput)
      }
    },
    [onChange, debouncedOnChange, setSelectedGeneId],
  )

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: Gene | string | null) => {
      if (newValue && typeof newValue !== "string") {
        setSelectedGeneId(newValue.id)
        setInputValue(newValue.symbol)
        onChange(newValue.symbol)
      } else if (newValue === null) {
        onChange("")
      }
    },
    [onChange, setSelectedGeneId],
  )

  return (
    <Autocomplete<Gene, false, false, true>
      freeSolo
      size="small"
      sx={{ width, "& .MuiAutocomplete-clearIndicator": { color: "text.secondary" } }}
      disableListWrap
      options={options}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.symbol)}
      filterOptions={(x) => x}
      slots={{ listbox: VirtualListbox, popper: StyledPopper }}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props as {
          key: React.Key
        } & React.HTMLAttributes<HTMLLIElement>
        return (
          <li
            key={key}
            {...optionProps}
            style={{
              ...(optionProps.style as React.CSSProperties | undefined),
              padding: "0 12px",
              boxSizing: "border-box",
            }}
          >
            <div>
              <Typography
                component="div"
                variant="body2"
                fontWeight={600}
                sx={{ m: 0, lineHeight: 1.2, fontSize: "0.9rem" }}
              >
                {option.symbol}
              </Typography>
              <Typography
                component="div"
                variant="caption"
                color="text.secondary"
                sx={{ m: 0, lineHeight: 1.2, fontSize: "0.8125rem" }}
              >
                {option.name}
              </Typography>
            </div>
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder="Search Ensembl ID, symbol, name, or family…"
          color="primary"
          sx={acInputSx}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start" sx={{ ml: 0.75, mr: 0 }}>
                    <SearchIcon sx={{ fontSize: 16 }} color="primary" />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}
