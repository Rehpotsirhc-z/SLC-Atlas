// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import React, { useMemo, useRef, useState } from "react"
import DownloadIcon from "@mui/icons-material/Download"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import SearchIcon from "@mui/icons-material/Search"
import CloseIcon from "@mui/icons-material/Close"
import { alpha } from "@mui/material/styles"
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { useClustering, type ClusterMethod } from "@/api/hooks/useClustering"
import { useConservation, useSpeciesTree } from "@/api/hooks/useConservation"
import { useGenes } from "@/api/hooks/useGenes"
import { triggerDownload } from "@/utils/download"
import { useUIStore } from "@/store/uiStore"
import type { Gene } from "@/types/gene"
import {
  acIndicatorSx,
  acInputSx,
  StyledPopper,
  VirtualListboxSm,
} from "@/components/VirtualListbox"
import ConservationHeatmap, {
  CELL_METRICS,
  type CellMetricKey,
  type ConservationHeatmapHandle,
} from "./ConservationHeatmap"

type Metric = "aa" | "dna" | "rna"
type Tissue = "all" | "brain"

const METHOD: Record<string, ClusterMethod> = {
  aa: "aa_sequence",
  dna: "dna_sequence",
  "rna:all": "rna_coexpression_all",
  "rna:brain": "rna_coexpression_brain",
}

const METRIC_LABEL: Record<Metric, string> = {
  aa: "Amino acid",
  dna: "DNA",
  rna: "Co-expression",
}

const acOptionStyle: React.CSSProperties = { padding: "0 12px", boxSizing: "border-box" }

export default function Conservation() {
  const [metric, setMetric] = useState<Metric>("aa")
  const [tissue, setTissue] = useState<Tissue>("all")
  const [cellMetric, setCellMetric] = useState<CellMetricKey>("perc_id")
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const heatmapRef = useRef<ConservationHeatmapHandle>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

  const method = metric === "rna" ? METHOD[`rna:${tissue}`] : METHOD[metric]
  const { data: cells, isLoading: cl, error: ce } = useConservation()
  const { data: speciesNodes, isLoading: sl, error: se } = useSpeciesTree()
  const { data: clusterNodes, isLoading: tl, error: te } = useClustering(method)
  const { data: allGenes } = useGenes()

  const geneById = useMemo(() => {
    const m = new Map<string, Gene>()
    for (const g of allGenes ?? []) m.set(g.id, g)
    return m
  }, [allGenes])

  const families = useMemo(() => {
    if (!cells) return []
    return [...new Set(cells.filter((c) => c.family).map((c) => c.family as string))].sort()
  }, [cells])

  const genes = useMemo(() => {
    if (!cells) return []
    const seen = new Map<string, string>()
    for (const c of cells) if (c.symbol && !seen.has(c.gene_id)) seen.set(c.gene_id, c.symbol)
    return [...seen.entries()]
      .map(([id, symbol]) => ({ id, symbol }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [cells])

  const isLoading = cl || sl || tl
  const error = ce || se || te
  const ready = cells && speciesNodes && clusterNodes

  async function handleNewick(kind: "species" | "gene") {
    setExportAnchor(null)
    const url =
      kind === "species"
        ? "/api/conservation/species-tree/newick"
        : `/api/clustering/newick?method=${method}`
    const res = await fetch(url)
    if (!res.ok) return
    const text = await res.text()
    triggerDownload(new Blob([text], { type: "text/plain" }), `slc_${kind}_tree.nwk`)
  }

  function handleExport(format: "svg" | "png") {
    const base = `slc_conservation_${cellMetric}`
    if (format === "svg") heatmapRef.current?.exportSvg(`${base}.svg`)
    else heatmapRef.current?.exportPng(`${base}.png`)
    setExportAnchor(null)
  }

  const floatBg = alpha(theme.palette.background.paper, 0.9)

  const searchPanel = (
    <>
      <Autocomplete
        size="small"
        options={families}
        value={familyFilter}
        onChange={(_, v) => {
          setFamilyFilter(v)
          if (v) heatmapRef.current?.focusFamily(v)
        }}
        sx={{ width: "100%", ...acIndicatorSx }}
        slots={{ listbox: VirtualListboxSm, popper: StyledPopper }}
        renderOption={(props, option) => {
          const { key, ...rest } = props as { key: React.Key } & React.HTMLAttributes<HTMLLIElement>
          return (
            <li key={key} {...rest} style={{ ...rest.style, ...acOptionStyle }}>
              <Typography variant="body2" fontWeight={600}>
                {option}
              </Typography>
            </li>
          )
        }}
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
        onChange={(_, v) => {
          setSelectedGeneId(v?.id ?? null)
          if (v) heatmapRef.current?.focusGene(v.id)
        }}
        sx={{ width: "100%", ...acIndicatorSx }}
        slots={{ listbox: VirtualListboxSm, popper: StyledPopper }}
        renderOption={(props, option) => {
          const { key, ...rest } = props as { key: React.Key } & React.HTMLAttributes<HTMLLIElement>
          return (
            <li key={key} {...rest} style={{ ...rest.style, ...acOptionStyle }}>
              <Typography variant="body2" fontWeight={600}>
                {option.symbol}
              </Typography>
            </li>
          )
        }}
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={600} color="primary">
          Conservation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ortholog sequence conservation of each SLC across vertebrate species
        </Typography>
      </Box>

      <Paper
        variant="outlined"
        sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        <Box
          sx={{ display: "flex", px: 2, py: 2, gap: 1.5, flexWrap: "wrap", alignItems: "center" }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={metric}
            onChange={(_, v) => v && setMetric(v)}
          >
            {(["aa", "dna", "rna"] as Metric[]).map((m) => (
              <ToggleButton key={m} value={m} sx={{ minWidth: 120 }}>
                {METRIC_LABEL[m]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {metric === "rna" && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={tissue}
              onChange={(_, v) => v && setTissue(v)}
            >
              <ToggleButton value="all" sx={{ minWidth: 120 }}>
                All tissues
              </ToggleButton>
              <ToggleButton value="brain" sx={{ minWidth: 120 }}>
                Brain
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <ToggleButtonGroup
            size="small"
            exclusive
            value={cellMetric}
            onChange={(_, v) => v && setCellMetric(v)}
          >
            {CELL_METRICS.map((m) => (
              <ToggleButton key={m.key} value={m.key} sx={{ minWidth: 120 }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {isMobile ? (
            <>
              <Tooltip title="Reset view">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => heatmapRef.current?.resetView()}
                  sx={{ minWidth: 0, px: "16px", py: "5px" }}
                >
                  <RestartAltIcon fontSize="small" sx={{ display: "block" }} />
                </Button>
              </Tooltip>
              <Tooltip title="Export">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => setExportAnchor(e.currentTarget)}
                  sx={{ minWidth: 0, px: "16px", py: "5px" }}
                >
                  <DownloadIcon fontSize="small" sx={{ display: "block" }} />
                </Button>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={() => heatmapRef.current?.resetView()}
                sx={{ whiteSpace: "nowrap" }}
              >
                Reset view
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={(e) => setExportAnchor(e.currentTarget)}
              >
                Export
              </Button>
            </>
          )}
          <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
            <MenuItem onClick={() => handleExport("svg")}>Download SVG</MenuItem>
            <MenuItem onClick={() => handleExport("png")}>Download PNG</MenuItem>
            <MenuItem onClick={() => handleNewick("gene")}>Gene tree (.nwk)</MenuItem>
            <MenuItem onClick={() => handleNewick("species")}>Species tree (.nwk)</MenuItem>
          </Menu>
        </Box>
        <Divider />

        <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
          {error ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">Failed to load conservation data.</Alert>
            </Box>
          ) : isLoading || !ready ? (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <>
              <ConservationHeatmap
                ref={heatmapRef}
                cells={cells}
                clusterNodes={clusterNodes}
                speciesNodes={speciesNodes}
                metric={cellMetric}
                familyFilter={familyFilter}
                selectedGeneId={selectedGeneId}
                onSelect={setSelectedGeneId}
                geneById={geneById}
              />

              {!isMobile && (
                <Paper
                  elevation={4}
                  sx={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 4,
                    bgcolor: floatBg,
                    backdropFilter: "blur(10px)",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    width: 216,
                  }}
                >
                  {searchPanel}
                </Paper>
              )}

              {isMobile && (
                <>
                  {searchOpen && (
                    <Paper
                      elevation={4}
                      sx={{
                        position: "absolute",
                        bottom: 64,
                        right: 12,
                        zIndex: 4,
                        bgcolor: floatBg,
                        backdropFilter: "blur(10px)",
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 2,
                        p: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.75,
                        width: 216,
                      }}
                    >
                      {searchPanel}
                    </Paper>
                  )}
                  <IconButton
                    onClick={() => setSearchOpen((v) => !v)}
                    sx={{
                      position: "absolute",
                      bottom: 12,
                      right: 12,
                      zIndex: 4,
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      boxShadow: 4,
                      backdropFilter: "blur(10px)",
                      bgcolor: floatBg,
                      border: 1,
                      borderColor: "divider",
                      color: searchOpen ? "text.secondary" : "primary.main",
                      "&:hover": { bgcolor: alpha(theme.palette.action.active, 0.06) },
                    }}
                  >
                    {searchOpen ? <CloseIcon fontSize="small" /> : <SearchIcon fontSize="small" />}
                  </IconButton>
                </>
              )}
            </>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
