// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Search for a gene or genomic coordinate */

import { useCallback, useMemo, useState } from "react"
import SearchIcon from "@mui/icons-material/Search"
import { Autocomplete, InputAdornment, TextField, Typography } from "@mui/material"
import { acInputSx, StyledPopper } from "@/components/autocomplete/styles"
import { VirtualListbox } from "@/components/autocomplete/VirtualListbox"
import type { Gene } from "@/types/gene"

// Accept common colon, space, hyphen, and en dash coordinate formats
const LOCUS = /^(chr)?([0-9a-z]{1,5})[:\s]+([\d,]+)[-–\s]+([\d,]+)$/i
const POINT = /^(chr)?([0-9a-z]{1,5})[:\s]+([\d,]+)$/i

export interface Locus {
  chrom: string
  start: number
  end: number
}

const digits = (value: string) => Number(value.replace(/,/g, ""))

/** Parse a genomic coordinate from user input */
export function parseLocus(text: string, span: number): Locus | null {
  const trimmed = text.trim()
  const range = LOCUS.exec(trimmed)
  if (range) {
    const start = digits(range[3])
    const end = digits(range[4])
    if (end > start) return { chrom: range[0].split(/[:\s]/)[0], start, end }
  }
  const point = POINT.exec(trimmed)
  if (point) {
    const at = digits(point[3])
    return { chrom: point[0].split(/[:\s]/)[0], start: at - span / 2, end: at + span / 2 }
  }
  return null
}

interface Props {
  genes: Gene[]
  onSelectGene: (geneId: string) => void
  onGoToLocus: (locus: Locus) => void
  width?: number | string
}

export default function LocusSearch({ genes, onSelectGene, onGoToLocus, width = 320 }: Props) {
  const [text, setText] = useState("")

  const index = useMemo(
    () =>
      genes.map((gene) => ({
        gene,
        lc: `${gene.symbol}\u0000${gene.id}\u0000${gene.name}\u0000${gene.alias ?? ""}`.toLowerCase(),
        lcSymbol: gene.symbol.toLowerCase(),
      })),
    [genes],
  )

  const options = useMemo(() => {
    const query = text.trim().toLowerCase()
    if (!query) return genes.slice(0, 100)
    return index
      .filter((entry) => entry.lc.includes(query))
      .sort((a, b) => {
        const exact = Number(b.lcSymbol === query) - Number(a.lcSymbol === query)
        if (exact) return exact
        const prefix = Number(b.lcSymbol.startsWith(query)) - Number(a.lcSymbol.startsWith(query))
        if (prefix) return prefix
        return a.lcSymbol.localeCompare(b.lcSymbol, undefined, { numeric: true })
      })
      .map((entry) => entry.gene)
      .slice(0, 200)
  }, [text, index, genes])

  const submit = useCallback(
    (raw: string) => {
      const query = raw.trim()
      if (!query) return
      const named = genes.find(
        (gene) =>
          gene.symbol.toLowerCase() === query.toLowerCase() ||
          gene.id.toLowerCase() === query.toLowerCase(),
      )
      if (named) {
        onSelectGene(named.id)
        return
      }
      const locus = parseLocus(query, 100_000)
      if (locus) onGoToLocus(locus)
    },
    [genes, onSelectGene, onGoToLocus],
  )

  return (
    <Autocomplete<Gene, false, false, true>
      freeSolo
      size="small"
      sx={{ width, "& .MuiAutocomplete-clearIndicator": { color: "text.secondary" } }}
      disableListWrap
      options={options}
      inputValue={text}
      onInputChange={(_event, next) => setText(next)}
      onChange={(_event, next) => {
        if (next && typeof next !== "string") {
          onSelectGene(next.id)
          setText(next.symbol)
        } else if (typeof next === "string") {
          submit(next)
        }
      }}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.symbol)}
      filterOptions={(x) => x}
      slots={{ listbox: VirtualListbox, popper: StyledPopper }}
      renderOption={(props, option) => {
        const { key, ...rest } = props as { key: React.Key } & React.HTMLAttributes<HTMLLIElement>
        return (
          <li
            key={key}
            {...rest}
            style={{
              ...(rest.style as React.CSSProperties | undefined),
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
          placeholder="Gene or genomic location"
          color="primary"
          sx={acInputSx}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit(text)
          }}
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
