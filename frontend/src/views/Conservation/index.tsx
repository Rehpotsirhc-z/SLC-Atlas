// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import React, { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
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
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import {
  useClustering,
  resolveClusterMethod,
  METRIC_LABEL,
  METRIC_ORDER,
  type TreeMetric,
} from "@/api/hooks/useClustering"
import { useConservation, useSpeciesTree } from "@/api/hooks/useConservation"
import { useGenes } from "@/api/hooks/useGenes"
import { triggerDownload } from "@/utils/download"
import { useUIStore } from "@/store/uiStore"
import type { PanelPos } from "@/utils/useDraggablePanel"
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
import GeneConservationPanel from "./GeneConservationPanel"

type Metric = TreeMetric
type Tissue = "all" | "brain"

const acOptionStyle: React.CSSProperties = { padding: "0 12px", boxSizing: "border-box" }

type TbState = "full" | "counterCompact" | "compact" | "wrapped"

export default function Conservation() {
  const [cellMetric, setCellMetric] = useState<CellMetricKey>("perc_id")
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [tbState, setTbState] = useState<TbState>("full")
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null)
  const [showSpeciesTree, setShowSpeciesTree] = useState(true)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const metric = useUIStore((s) => s.treeMetric)
  const setMetric = useUIStore((s) => s.setTreeMetric)
  const tissue = useUIStore((s) => s.treeTissue)
  const setTissue = useUIStore((s) => s.setTreeTissue)
  const heatmapRef = useRef<ConservationHeatmapHandle>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const measureCounterRef = useRef<HTMLElement>(null)
  const measureBtnsRef = useRef<HTMLDivElement>(null)
  const measureIconBtnsRef = useRef<HTMLDivElement>(null)
  const measureTogglesRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

  const method = resolveClusterMethod(metric, tissue)
  const { data: cells, isLoading: cl, error: ce } = useConservation()
  const { data: speciesNodes, isLoading: sl, error: se } = useSpeciesTree()
  const { data: clusterNodes, isLoading: tl, error: te } = useClustering(method)
  const { data: allGenes } = useGenes()

  const geneById = useMemo(() => {
    const m = new Map<string, Gene>()
    for (const g of allGenes ?? []) m.set(g.id, g)
    return m
  }, [allGenes])

  const selectedConservationInfo = useMemo(() => {
    if (!cells || !selectedGeneId) return null
    const first = cells.find((c) => c.gene_id === selectedGeneId)
    if (!first) return null
    const geneCells = cells.filter(
      (c) => c.gene_id === selectedGeneId && c.orthology_type !== "self",
    )
    return {
      geneId: selectedGeneId,
      symbol: first.symbol ?? selectedGeneId,
      family: first.family,
      gene: geneById.get(selectedGeneId) ?? null,
      cells: geneCells,
    }
  }, [cells, selectedGeneId, geneById])

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

  const nGenes = genes.length
  const nSpecies = useMemo(
    () => (speciesNodes ? speciesNodes.filter((n) => n.species).length : 0),
    [speciesNodes],
  )
  const counterText = `${nGenes} genes · ${nSpecies} species`

  const isLoading = cl || sl || tl
  const error = ce || se || te
  const ready = cells && speciesNodes && clusterNodes

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    let threshFull = 0
    let threshCounterCompact = 0
    let threshCompact = 0

    function computeThresholds() {
      const counterW = measureCounterRef.current?.offsetWidth ?? 0
      const textBtnsW = measureBtnsRef.current?.offsetWidth ?? 0
      const iconBtnsW = measureIconBtnsRef.current?.offsetWidth ?? 0
      const toggleW = measureTogglesRef.current?.offsetWidth ?? 0
      const toolbarPadding = 32
      const toolbarGaps = 2 * 12
      const counterChunk = counterW + 25
      threshFull = toolbarPadding + toggleW + toolbarGaps + counterChunk + textBtnsW
      threshCounterCompact = toolbarPadding + toggleW + toolbarGaps + counterChunk + iconBtnsW
      threshCompact = toolbarPadding + toggleW + toolbarGaps + iconBtnsW
    }

    function check() {
      const el = toolbarRef.current
      if (!el) return
      const w = el.clientWidth
      if (w >= threshFull) setTbState("full")
      else if (w >= threshCounterCompact) setTbState("counterCompact")
      else if (w >= threshCompact) setTbState("compact")
      else setTbState("wrapped")
    }

    computeThresholds()
    check()
    document.fonts.ready.then(() => {
      computeThresholds()
      check()
    })

    const ro = new ResizeObserver(check)
    ro.observe(toolbar)
    return () => ro.disconnect()
  }, [counterText])

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
  const showCounter = tbState === "full" || tbState === "counterCompact"
  const iconButtons = tbState === "compact" || tbState === "counterCompact"

  const selectSx = {
    fontSize: "0.8rem",
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      minHeight: "unset",
      py: "7px",
    },
  }
  const geneOrderControl = (
    <Box sx={{ py: 1, pr: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Tooltip title="Tree used to order the gene rows" placement="top" arrow>
        <Select
          size="small"
          fullWidth
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
          startAdornment={
            <AccountTreeIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.75 }} />
          }
          sx={selectSx}
        >
          {METRIC_ORDER.map((m) => (
            <MenuItem key={m} value={m}>
              {METRIC_LABEL[m]}
            </MenuItem>
          ))}
        </Select>
      </Tooltip>
      {metric === "rna" && (
        <Select
          size="small"
          fullWidth
          value={tissue}
          onChange={(e) => setTissue(e.target.value as Tissue)}
          sx={selectSx}
        >
          <MenuItem value="all">All tissues</MenuItem>
          <MenuItem value="brain">Brain</MenuItem>
        </Select>
      )}
    </Box>
  )

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
          ref={toolbarRef}
          sx={{
            display: "flex",
            px: 2,
            py: 2,
            gap: 1.5,
            flexWrap: "wrap",
            alignItems: tbState === "wrapped" ? "stretch" : "center",
          }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth={tbState === "wrapped"}
            value={cellMetric}
            onChange={(_, v) => v && setCellMetric(v)}
            sx={{ width: tbState === "wrapped" ? "100%" : "auto" }}
          >
            {CELL_METRICS.map((m) => (
              <ToggleButton
                key={m.key}
                value={m.key}
                sx={{ minWidth: tbState === "wrapped" ? 0 : 120 }}
              >
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {tbState !== "wrapped" && <Box sx={{ flexGrow: 1 }} />}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              width: tbState === "wrapped" ? "100%" : "auto",
            }}
          >
            <Typography
              variant="body2"
              color="success.main"
              sx={{ whiteSpace: "nowrap", display: showCounter ? "block" : "none" }}
            >
              {counterText}
            </Typography>
            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: showCounter ? "block" : "none" }}
            />
            {iconButtons ? (
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
                  sx={{
                    whiteSpace: "nowrap",
                    flex: tbState === "wrapped" ? 1 : "none",
                    gap: "6px",
                    "& .MuiButton-startIcon": { margin: 0 },
                  }}
                >
                  Reset view
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={(e) => setExportAnchor(e.currentTarget)}
                  sx={{
                    flex: tbState === "wrapped" ? 1 : "none",
                    gap: "6px",
                    "& .MuiButton-startIcon": { margin: 0 },
                  }}
                >
                  Export
                </Button>
              </>
            )}
            <Menu
              anchorEl={exportAnchor}
              open={!!exportAnchor}
              onClose={() => setExportAnchor(null)}
            >
              <MenuItem onClick={() => handleExport("svg")}>Download SVG</MenuItem>
              <MenuItem onClick={() => handleExport("png")}>Download PNG</MenuItem>
              <MenuItem onClick={() => handleNewick("gene")}>Gene tree (.nwk)</MenuItem>
              <MenuItem onClick={() => handleNewick("species")}>Species tree (.nwk)</MenuItem>
            </Menu>
          </Box>
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
                cornerSlot={geneOrderControl}
                showSpeciesTree={showSpeciesTree}
                onToggleSpeciesTree={() => setShowSpeciesTree((v) => !v)}
              />

              {selectedConservationInfo && (
                <GeneConservationPanel
                  key={selectedConservationInfo.geneId}
                  info={selectedConservationInfo}
                  metric={cellMetric}
                  onClose={() => setSelectedGeneId(null)}
                  onOpenInGenes={() => navigate("/genes")}
                  pos={panelPos}
                  onPosChange={setPanelPos}
                />
              )}

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

      <Box
        aria-hidden
        sx={{
          position: "fixed",
          left: "-9999px",
          visibility: "hidden",
          pointerEvents: "none",
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <Typography
          ref={measureCounterRef as React.Ref<HTMLElement>}
          variant="body2"
          sx={{ whiteSpace: "nowrap" }}
        >
          {counterText}
        </Typography>
        <Box ref={measureBtnsRef} sx={{ display: "flex", gap: 1.5 }}>
          <Button size="small" variant="outlined" startIcon={<RestartAltIcon />}>
            Reset view
          </Button>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />}>
            Export
          </Button>
        </Box>
        <Box ref={measureIconBtnsRef} sx={{ display: "flex", gap: 1.5 }}>
          <Button size="small" variant="outlined" sx={{ minWidth: 0, px: "16px", py: "5px" }}>
            <RestartAltIcon fontSize="small" sx={{ display: "block" }} />
          </Button>
          <Button size="small" variant="outlined" sx={{ minWidth: 0, px: "16px", py: "5px" }}>
            <DownloadIcon fontSize="small" sx={{ display: "block" }} />
          </Button>
        </Box>
        <ToggleButtonGroup ref={measureTogglesRef} size="small">
          {CELL_METRICS.map((m) => (
            <ToggleButton key={m.key} value={m.key} sx={{ minWidth: 120 }}>
              {m.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  )
}
