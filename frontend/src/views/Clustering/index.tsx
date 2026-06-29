// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import DownloadIcon from "@mui/icons-material/Download"
import HubIcon from "@mui/icons-material/Hub"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
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
import PhyloTree, { type Layout, type PhyloTreeHandle } from "./PhyloTree"
import GeneInfoPanel from "./GeneInfoPanel"

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

const METHOD_LABEL: Record<ClusterMethod, string> = {
  aa_sequence: "Amino-acid similarity",
  dna_sequence: "DNA (CDS) similarity",
  rna_coexpression_all: "RNA co-expression — all tissues",
  rna_coexpression_brain: "RNA co-expression — brain",
}

const acOptionStyle: React.CSSProperties = { padding: "0 12px", boxSizing: "border-box" }

const LAYOUT_OPTIONS: { value: Layout; icon: React.ReactNode; label: string }[] = [
  {
    value: "rectangular",
    icon: <AccountTreeIcon sx={{ fontSize: 18 }} />,
    label: "Rectangular tree",
  },
  { value: "radial", icon: <HubIcon sx={{ fontSize: 18 }} />, label: "Radial tree" },
]

export default function Clustering() {
  const [metric, setMetric] = useState<Metric>("aa")
  const [tissue, setTissue] = useState<Tissue>("all")
  const [layout, setLayout] = useState<Layout>("rectangular")
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const treeRef = useRef<PhyloTreeHandle>(null)
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

  const method = metric === "rna" ? METHOD[`rna:${tissue}`] : METHOD[metric]
  const { data, isLoading, error } = useClustering(method)
  const { data: allGenes } = useGenes() // gene coordinates

  const selectedInfo = useMemo(() => {
    if (!data || !selectedGeneId) return null
    const node = data.find((n) => n.gene_id === selectedGeneId)
    if (!node) return null
    let closestSymbol: string | null = null
    if (node.parent_id !== null) {
      const sibling = data.find((n) => n.parent_id === node.parent_id && n.node_id !== node.node_id)
      if (sibling?.gene_id) closestSymbol = sibling.symbol
    }
    const gene = allGenes?.find((g) => g.id === selectedGeneId) ?? null
    return { node, methodLabel: METHOD_LABEL[method], closestSymbol, gene }
  }, [data, selectedGeneId, method, allGenes])

  const geneById = useMemo(() => {
    const m = new Map<string, Gene>()
    for (const g of allGenes ?? []) m.set(g.id, g)
    return m
  }, [allGenes])

  const families = useMemo(() => {
    if (!data) return []
    return [...new Set(data.filter((n) => n.family).map((n) => n.family as string))].sort()
  }, [data])

  const genes = useMemo(() => {
    if (!data) return []
    return data
      .filter((n) => n.gene_id && n.symbol)
      .map((n) => ({ id: n.gene_id as string, symbol: n.symbol as string }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [data])

  useEffect(() => {
    if (familyFilter) treeRef.current?.focusFamily(familyFilter)
  }, [familyFilter])

  const leafCount = genes.length
  const filenameBase = `slc_${method}_${layout}`

  function handleExport(format: "svg" | "png") {
    if (format === "svg") treeRef.current?.exportSvg(`${filenameBase}.svg`)
    else treeRef.current?.exportPng(`${filenameBase}.png`)
    setExportAnchor(null)
  }

  async function handleNewick() {
    setExportAnchor(null)
    const res = await fetch(`/api/clustering/newick?method=${method}`)
    if (!res.ok) return
    const text = await res.text()
    triggerDownload(new Blob([text], { type: "text/plain" }), `slc_${method}.nwk`)
  }

  const floatBg = alpha(theme.palette.background.paper, 0.9)
  const selectedColor = theme.palette.secondary.main

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={600} color="primary">
          Clustering
        </Typography>
        <Typography variant="body2" color="text.secondary">
          SLC similarity trees by amino-acid, DNA (CDS), and GTEx RNA co-expression
        </Typography>
      </Box>

      <Paper
        variant="outlined"
        sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        <Box
          sx={{
            display: "flex",
            px: 2,
            py: 2,
            gap: 1.5,
            flexWrap: "wrap",
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth={isMobile}
            value={metric}
            onChange={(_, v) => v && setMetric(v)}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {(["aa", "dna", "rna"] as Metric[]).map((m) => (
              <ToggleButton key={m} value={m} sx={{ minWidth: { xs: 0, sm: 120 } }}>
                {METRIC_LABEL[m]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {metric === "rna" && (
            <ToggleButtonGroup
              size="small"
              exclusive
              fullWidth={isMobile}
              value={tissue}
              onChange={(_, v) => v && setTissue(v)}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              <ToggleButton value="all" sx={{ minWidth: { xs: 0, sm: 120 } }}>
                All tissues
              </ToggleButton>
              <ToggleButton value="brain" sx={{ minWidth: { xs: 0, sm: 120 } }}>
                Brain
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          <Box sx={{ flexGrow: 1, display: { xs: "none", sm: "block" } }} />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexWrap: "wrap",
              width: { xs: "100%", sm: "auto" },
            }}
          >
            <Typography
              variant="body2"
              color="success.main"
              sx={{ whiteSpace: "nowrap", flexBasis: { xs: "100%", sm: "auto" } }}
            >
              {leafCount} genes
            </Typography>
            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: { xs: "none", sm: "block" } }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={() => treeRef.current?.resetView()}
              sx={{ whiteSpace: "nowrap", flex: { xs: 1, sm: "none" } }}
            >
              Reset view
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={(e) => setExportAnchor(e.currentTarget)}
              sx={{ flex: { xs: 1, sm: "none" } }}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportAnchor}
              open={!!exportAnchor}
              onClose={() => setExportAnchor(null)}
            >
              <MenuItem onClick={() => handleExport("svg")}>Download SVG</MenuItem>
              <MenuItem onClick={() => handleExport("png")}>Download PNG</MenuItem>
              <MenuItem onClick={handleNewick}>Download Newick (.nwk)</MenuItem>
            </Menu>
          </Box>
        </Box>
        <Divider />

        <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
          {error ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">Failed to load clustering data.</Alert>
            </Box>
          ) : isLoading || !data ? (
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
              <PhyloTree
                ref={treeRef}
                data={data}
                layout={layout}
                familyFilter={familyFilter}
                selectedGeneId={selectedGeneId}
                onSelect={setSelectedGeneId}
                geneById={geneById}
              />

              {/* Floating search panel */}
              <Paper
                elevation={4}
                sx={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  zIndex: 2,
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
                <Autocomplete
                  size="small"
                  options={families}
                  value={familyFilter}
                  onChange={(_, v) => setFamilyFilter(v)}
                  sx={{ width: "100%", ...acIndicatorSx }}
                  slots={{ listbox: VirtualListboxSm, popper: StyledPopper }}
                  renderOption={(props, option) => {
                    const { key, ...rest } = props as {
                      key: React.Key
                    } & React.HTMLAttributes<HTMLLIElement>
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
                    if (v) treeRef.current?.focusGene(v.id)
                  }}
                  sx={{ width: "100%", ...acIndicatorSx }}
                  slots={{ listbox: VirtualListboxSm, popper: StyledPopper }}
                  renderOption={(props, option) => {
                    const { key, ...rest } = props as {
                      key: React.Key
                    } & React.HTMLAttributes<HTMLLIElement>
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
              </Paper>

              {/* Floating layout toggle */}
              <Paper
                elevation={4}
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  zIndex: 2,
                  bgcolor: floatBg,
                  backdropFilter: "blur(10px)",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {LAYOUT_OPTIONS.map(({ value, icon, label }, i) => (
                  <Tooltip key={value} title={label} placement="left" arrow>
                    <IconButton
                      size="small"
                      onClick={() => setLayout(value)}
                      sx={{
                        borderRadius: 0,
                        px: 1.25,
                        py: 1,
                        color: layout === value ? selectedColor : "text.secondary",
                        bgcolor: layout === value ? alpha(selectedColor, 0.15) : "transparent",
                        "&:hover": {
                          bgcolor:
                            layout === value
                              ? alpha(selectedColor, 0.27)
                              : alpha(theme.palette.action.active, 0.06),
                        },
                        ...(i < LAYOUT_OPTIONS.length - 1 && {
                          borderBottom: 1,
                          borderColor: "divider",
                        }),
                      }}
                    >
                      {icon}
                    </IconButton>
                  </Tooltip>
                ))}
              </Paper>

              {selectedInfo && (
                <GeneInfoPanel
                  key={selectedInfo.node.gene_id}
                  info={selectedInfo}
                  onClose={() => setSelectedGeneId(null)}
                  onOpenInGenes={() => navigate("/genes")}
                  pos={panelPos}
                  onPosChange={setPanelPos}
                />
              )}
            </>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
