// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import DownloadIcon from "@mui/icons-material/Download"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import SearchIcon from "@mui/icons-material/Search"
import CloseIcon from "@mui/icons-material/Close"
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew"
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
  type TreeTissue,
} from "@/api/hooks/useClustering"
import { useExpressionMatrix } from "@/api/hooks/useExpression"
import { useGenes } from "@/api/hooks/useGenes"
import { triggerDownload } from "@/utils/download"
import { useTpmColorScale } from "@/utils/tpmColor"
import { useUIStore, RAIL_MIN_WIDTH } from "@/store/uiStore"
import type { PanelPos } from "@/utils/useDraggablePanel"
import type { Gene } from "@/types/gene"
import {
  acIndicatorSx,
  acInputSx,
  StyledPopper,
  VirtualListboxSm,
} from "@/components/VirtualListbox"
import ExpressionHeatmap, { type ExpressionHeatmapHandle } from "./ExpressionHeatmap"
import GeneExpressionPanel from "./GeneExpressionPanel"
import AnatomogramRail, { type RailView } from "./Anatomograms"

const acOptionStyle: React.CSSProperties = { padding: "0 12px", boxSizing: "border-box" }

const TISSUE_OPTIONS: { value: TreeTissue; label: string }[] = [
  { value: "all", label: "All tissues" },
  { value: "brain", label: "Brain" },
]

type TbState = "full" | "counterCompact" | "compact" | "wrapped"

const MIN_MAIN_CONTENT_WIDTH = 420
const RAIL_HANDLE_WIDTH = 7

export default function Expression() {
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [tbState, setTbState] = useState<TbState>("full")
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const metric = useUIStore((s) => s.expressionMetric)
  const setMetric = useUIStore((s) => s.setExpressionMetric)
  const tissue = useUIStore((s) => s.expressionTissue)
  const setTissue = useUIStore((s) => s.setExpressionTissue)
  const railOpen = useUIStore((s) => s.railOpen)
  const setRailOpen = useUIStore((s) => s.setRailOpen)
  const railWidth = useUIStore((s) => s.railWidth)
  const setRailWidth = useUIStore((s) => s.setRailWidth)
  const anatomogramSex = useUIStore((s) => s.anatomogramSex)
  const setAnatomogramSex = useUIStore((s) => s.setAnatomogramSex)
  const [railTissue, setRailTissue] = useState<string | null>(null)
  const railFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heatmapRef = useRef<ExpressionHeatmapHandle>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const measureCounterRef = useRef<HTMLElement>(null)
  const measureBtnsRef = useRef<HTMLDivElement>(null)
  const measureIconBtnsRef = useRef<HTMLDivElement>(null)
  const measureTogglesRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")

  const method = resolveClusterMethod(metric, tissue)
  const { data: rows, isLoading: el, error: ee } = useExpressionMatrix(tissue)
  const { data: clusterNodes, isLoading: tl, error: te } = useClustering(method)
  const { data: allGenes } = useGenes()

  const geneById = useMemo(() => {
    const m = new Map<string, Gene>()
    for (const g of allGenes ?? []) m.set(g.id, g)
    return m
  }, [allGenes])

  const selectedExpressionInfo = useMemo(() => {
    if (!rows || !selectedGeneId) return null
    const geneRows = rows.filter((r) => r.gene_id === selectedGeneId)
    if (!geneRows.length) return null
    const first = geneRows[0]
    return {
      geneId: selectedGeneId,
      symbol: first.symbol ?? selectedGeneId,
      family: first.family,
      gene: geneById.get(selectedGeneId) ?? null,
      rows: geneRows,
    }
  }, [rows, selectedGeneId, geneById])

  const families = useMemo(() => {
    if (!rows) return []
    return [...new Set(rows.filter((r) => r.family).map((r) => r.family as string))].sort()
  }, [rows])

  const genes = useMemo(() => {
    if (!rows) return []
    const seen = new Map<string, string>()
    for (const r of rows) if (r.symbol && !seen.has(r.gene_id)) seen.set(r.gene_id, r.symbol)
    return [...seen.entries()]
      .map(([id, symbol]) => ({ id, symbol }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [rows])

  const nGenes = genes.length
  const presentTissues = useMemo(() => new Set((rows ?? []).map((r) => r.tissue)), [rows])
  const nTissues = presentTissues.size
  const counterText = `${nGenes} genes · ${nTissues} tissues`

  const { domainMax } = useTpmColorScale(rows ?? [])
  const tpmByTissue = useMemo(() => {
    if (!selectedExpressionInfo) return null
    return new Map(selectedExpressionInfo.rows.map((r) => [r.tissue, r.tpm]))
  }, [selectedExpressionInfo])

  const railView: RailView = tissue === "brain" ? "brain" : anatomogramSex

  function pickTissue(tissues: string[]) {
    if (railFlashTimer.current) clearTimeout(railFlashTimer.current)
    setRailTissue(tissues[0] ?? null)
    heatmapRef.current?.focusTissue(tissues)
    railFlashTimer.current = setTimeout(() => setRailTissue(null), reduceMotion ? 900 : 1200)
  }

  useEffect(() => () => void (railFlashTimer.current && clearTimeout(railFlashTimer.current)), [])

  const railRowRef = useRef<HTMLDivElement>(null)
  const [rowWidth, setRowWidth] = useState(0)

  useEffect(() => {
    const el = railRowRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [railFillWidth, setRailFillWidth] = useState(Infinity)

  const maxAutoRailWidth = Math.max(
    RAIL_MIN_WIDTH,
    rowWidth - MIN_MAIN_CONTENT_WIDTH - RAIL_HANDLE_WIDTH,
  )
  const effRailWidth = Math.min(Math.max(railWidth, RAIL_MIN_WIDTH), railFillWidth)
  const handleAutoWidth = useCallback((px: number) => setRailWidth(px), [setRailWidth])
  const handleFillWidth = useCallback((px: number) => setRailFillWidth(px), [])

  function startRailResize(e: React.PointerEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = effRailWidth
    const onMove = (ev: PointerEvent) => setRailWidth(startW + (startX - ev.clientX))
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const isLoading = el || tl
  const error = ee || te
  const ready = rows && clusterNodes

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

  async function handleGeneTreeNewick() {
    setExportAnchor(null)
    const res = await fetch(`/api/clustering/newick?method=${method}`)
    if (!res.ok) return
    const text = await res.text()
    triggerDownload(new Blob([text], { type: "text/plain" }), "slc_expression_gene_tree.nwk")
  }

  function handleExport(format: "svg" | "png") {
    const base = `slc_expression_${tissue}`
    if (format === "svg") heatmapRef.current?.exportSvg(`${base}.svg`)
    else heatmapRef.current?.exportPng(`${base}.png`)
    setExportAnchor(null)
  }

  const floatBg = alpha(theme.palette.background.paper, 0.9)
  const showCounter = tbState === "full" || tbState === "counterCompact"
  const iconButtons = tbState === "compact" || tbState === "counterCompact"

  const geneOrderControl = (
    <Box sx={{ p: 1 }}>
      <Tooltip title="Tree used to order the gene rows" placement="top" arrow>
        <Select
          size="small"
          fullWidth
          value={metric}
          onChange={(e) => setMetric(e.target.value as TreeMetric)}
          startAdornment={
            <AccountTreeIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.75 }} />
          }
          sx={{
            fontSize: "0.8rem",
            "& .MuiSelect-select": {
              display: "flex",
              alignItems: "center",
              minHeight: "unset",
              py: "7px",
            },
          }}
        >
          {METRIC_ORDER.map((m) => (
            <MenuItem key={m} value={m}>
              {METRIC_LABEL[m]}
            </MenuItem>
          ))}
        </Select>
      </Tooltip>
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
          Expression
        </Typography>
        <Typography variant="body2" color="text.secondary">
          RNA abundance (TPM) of each SLC across GTEx tissues
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
            value={tissue}
            onChange={(_, v) => v && setTissue(v)}
            sx={{ width: tbState === "wrapped" ? "100%" : "auto" }}
          >
            {TISSUE_OPTIONS.map((t) => (
              <ToggleButton
                key={t.value}
                value={t.value}
                sx={{ minWidth: tbState === "wrapped" ? 0 : 120 }}
              >
                {t.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {!isMobile && (
            <Tooltip title={railOpen ? "Hide anatomograms" : "Show anatomograms"}>
              <ToggleButton
                size="small"
                value="anatomograms"
                selected={railOpen}
                onChange={() => setRailOpen(!railOpen)}
                sx={{
                  gap: "8px",
                  px: 1.5,
                  whiteSpace: "nowrap",
                  "& .MuiSvgIcon-root": { fontSize: 18 },
                }}
              >
                <AccessibilityNewIcon />
                {tbState === "full" && (
                  <Box component="span" sx={{ fontSize: "0.8125rem" }}>
                    Anatomograms
                  </Box>
                )}
              </ToggleButton>
            </Tooltip>
          )}

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
              <MenuItem onClick={handleGeneTreeNewick}>Gene tree (.nwk)</MenuItem>
            </Menu>
          </Box>
        </Box>
        <Divider />

        <Box ref={railRowRef} sx={{ flex: 1, minHeight: 0, display: "flex" }}>
          <Box sx={{ flex: 1, position: "relative", minHeight: 0, minWidth: 0 }}>
            {error ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="error">Failed to load expression data.</Alert>
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
                <ExpressionHeatmap
                  ref={heatmapRef}
                  rows={rows}
                  clusterNodes={clusterNodes}
                  familyFilter={familyFilter}
                  selectedGeneId={selectedGeneId}
                  onSelect={setSelectedGeneId}
                  geneById={geneById}
                  cornerSlot={geneOrderControl}
                />

                {selectedExpressionInfo && (
                  <GeneExpressionPanel
                    key={selectedExpressionInfo.geneId}
                    info={selectedExpressionInfo}
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
                      {searchOpen ? (
                        <CloseIcon fontSize="small" />
                      ) : (
                        <SearchIcon fontSize="small" />
                      )}
                    </IconButton>
                  </>
                )}
              </>
            )}
          </Box>

          {railOpen && !isMobile && (
            <>
              <Box
                onPointerDown={startRailResize}
                sx={{
                  flexShrink: 0,
                  width: `${RAIL_HANDLE_WIDTH}px`,
                  cursor: "col-resize",
                  borderLeft: 1,
                  borderColor: "divider",
                  transition: "background-color 0.15s",
                  "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.18) },
                  touchAction: "none",
                }}
              />
              <Box sx={{ width: effRailWidth, flexShrink: 0, minHeight: 0 }}>
                <AnatomogramRail
                  view={railView}
                  presentTissues={presentTissues}
                  selectedTissue={railTissue}
                  maxWidth={maxAutoRailWidth}
                  onAutoWidth={handleAutoWidth}
                  onFillWidth={handleFillWidth}
                  tpmByTissue={tpmByTissue}
                  domainMax={domainMax}
                  onPickSex={(sex) => {
                    setAnatomogramSex(sex)
                    setTissue("all")
                  }}
                  onPickBrain={() => setTissue("brain")}
                  onPickTissue={pickTissue}
                />
              </Box>
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
          {TISSUE_OPTIONS.map((t) => (
            <ToggleButton key={t.value} value={t.value} sx={{ minWidth: 120 }}>
              {t.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  )
}
