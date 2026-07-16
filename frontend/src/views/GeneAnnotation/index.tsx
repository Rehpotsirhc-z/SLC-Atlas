// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import {
  Alert,
  Box,
  Divider,
  Drawer,
  IconButton,
  Paper,
  TablePagination,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { useUIStore } from "@/store/uiStore"
import DownloadButton from "./DownloadButton"
import FamilyTree from "./FamilyTree"
import GeneTable from "./GeneTable"
import GeneTableSkeleton from "./GeneTableSkeleton"
import SearchBar from "./SearchBar"
import { useGeneAnnotationState } from "./useGeneAnnotationState"

export default function GeneAnnotation() {
  const {
    genes,
    isLoading,
    error,
    visibleGenes,
    searchText,
    setSearchText,
    familyFilter,
    setFamilyFilter,
    sortKey,
    sortDirection,
    toggleSort,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
  } = useGeneAnnotationState()

  const paginatedGenes = visibleGenes.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const handledGeneIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedGeneId || handledGeneIdRef.current === selectedGeneId) return
    const idx = visibleGenes.findIndex((g) => g.id === selectedGeneId)
    if (idx === -1) return
    const targetPage = Math.floor(idx / rowsPerPage)
    if (page !== targetPage) {
      setPage(targetPage)
      return
    }
    const row = tableScrollRef.current?.querySelector<HTMLElement>(
      `[data-gene-id="${CSS.escape(selectedGeneId)}"]`,
    )
    if (!row) return
    handledGeneIdRef.current = selectedGeneId
    // Wait for the Collapse animation to finish before centering so that it
    // doesn't get pushed down by the expanded content
    const t = setTimeout(() => {
      row.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 300)
    return () => clearTimeout(t)
  }, [selectedGeneId, visibleGenes, rowsPerPage, page])

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hideCounter, setHideCounter] = useState(false)
  const [compactDownload, setCompactDownload] = useState(false)
  const [useSidebarDrawer, setUseSidebarDrawer] = useState(false)

  const [treeWidth, setTreeWidth] = useState(280)
  const dragging = useRef(false)
  const outerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLElement | null>(null)
  const downloadWrapperRef = useRef<HTMLSpanElement | null>(null)
  const treeWidthRef = useRef(treeWidth)
  const thresholds = useRef({ full: 0, noCounter: 0, compact: 0 })

  useEffect(() => {
    treeWidthRef.current = treeWidth
  }, [treeWidth])

  useLayoutEffect(() => {
    if (isLoading) return
    const el = tableScrollRef.current
    const table = el?.querySelector<HTMLElement>("table")
    if (!el || !table) return
    // Temporarily clear width to measure the table's natural minimum content width
    const prev = table.style.width
    table.style.width = "auto"
    const naturalWidth = table.offsetWidth
    table.style.width = prev
    table.style.minWidth = `${naturalWidth}px`
    const slack = el.clientWidth - naturalWidth
    if (slack > 0) setTreeWidth(Math.min(600, 280 + slack))
  }, [isLoading])

  useLayoutEffect(() => {
    if (isLoading || isMobile) return
    const outer = outerRef.current
    const toolbar = toolbarRef.current
    if (!outer || !toolbar) return

    // Measure thresholds once: natural widths of toolbar at full config
    if (!thresholds.current.full) {
      const prevW = toolbar.style.width
      toolbar.style.width = "max-content"
      thresholds.current.full = toolbar.offsetWidth
      const counterW = counterRef.current ? counterRef.current.offsetWidth + 16 : 0
      thresholds.current.noCounter = thresholds.current.full - counterW
      const dlFullW = downloadWrapperRef.current ? downloadWrapperRef.current.offsetWidth : 0
      thresholds.current.compact = thresholds.current.noCounter - Math.max(0, dlFullW - 52)
      toolbar.style.width = prevW
    }

    const ICON_BTN_OVERHEAD = 46

    const checkFit = () => {
      const outerW = outer.clientWidth
      const treeW = treeWidthRef.current
      const t = thresholds.current

      const applyForPaperW = (paperW: number, hasIcon: boolean) => {
        const offset = hasIcon ? ICON_BTN_OVERHEAD : 0
        if (paperW >= t.full + offset) {
          setHideCounter(false)
          setCompactDownload(false)
        } else if (paperW >= t.noCounter + offset) {
          setHideCounter(true)
          setCompactDownload(false)
        } else {
          setHideCounter(true)
          setCompactDownload(true)
        }
      }

      // Try inline sidebar at current tree width
      const paperW = outerW - treeW - 16
      if (paperW >= t.compact) {
        setUseSidebarDrawer(false)
        applyForPaperW(paperW, false)
        return
      }

      // Try inline sidebar at minimum tree width (200px)
      const minPaperW = outerW - 200 - 16
      if (minPaperW >= t.compact) {
        if (treeW > 200) setTreeWidth(200)
        setUseSidebarDrawer(false)
        applyForPaperW(minPaperW, false)
        return
      }

      // Fall back to drawer
      setUseSidebarDrawer(true)
      applyForPaperW(outerW, true)
    }

    checkFit()
    const ro = new ResizeObserver(checkFit)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [isLoading, isMobile])

  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true
    const startX = e.clientX
    const startWidth = treeWidth
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setTreeWidth(Math.max(200, Math.min(600, startWidth + ev.clientX - startX)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={600} color="primary">
          Genes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          SLC superfamily gene and transcript annotation browser
        </Typography>
      </Box>
      <Box ref={outerRef} sx={{ display: "flex", flex: 1, gap: 0, minHeight: 0 }}>
        {isMobile || useSidebarDrawer ? (
          <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <FamilyTree
              genes={genes}
              familyFilter={familyFilter}
              onSelectFamily={setFamilyFilter}
              onClose={() => setDrawerOpen(false)}
              width={280}
            />
          </Drawer>
        ) : (
          <>
            <FamilyTree
              genes={genes}
              familyFilter={familyFilter}
              onSelectFamily={setFamilyFilter}
              width={treeWidth}
            />
            <Box
              onMouseDown={onDragStart}
              sx={{
                width: 16,
                flexShrink: 0,
                cursor: "col-resize",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                "&::after": {
                  content: '""',
                  display: "block",
                  width: 2,
                  height: "40%",
                  borderRadius: 1,
                  bgcolor: "divider",
                  transition: "background-color 0.15s",
                },
                "&:hover::after": { bgcolor: "text.disabled" },
                userSelect: "none",
              }}
            />
          </>
        )}
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <Box ref={toolbarRef} sx={{ display: "flex", alignItems: "center", p: 2, gap: 2 }}>
            {(isMobile || useSidebarDrawer) && (
              <IconButton
                onClick={() => setDrawerOpen(true)}
                size="small"
                color={familyFilter ? "primary" : "default"}
              >
                <AccountTreeIcon fontSize="small" />
              </IconButton>
            )}
            <SearchBar genes={genes} value={searchText} onChange={setSearchText} />
            <Box sx={{ flexGrow: 1 }} />
            <Typography
              ref={counterRef as React.Ref<HTMLElement>}
              variant="body2"
              color="success.main"
              sx={{
                whiteSpace: "nowrap",
                display: isMobile || hideCounter ? "none" : { xs: "none", sm: "block" },
              }}
            >
              {visibleGenes.length} of {genes.length} genes
            </Typography>
            <Divider orientation="vertical" flexItem />
            <span ref={downloadWrapperRef} style={{ display: "flex" }}>
              <DownloadButton genes={visibleGenes} compact={isMobile || compactDownload} />
            </span>
          </Box>
          <Divider />
          {error ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">Failed to load genes.</Alert>
            </Box>
          ) : (
            <>
              <Box ref={tableScrollRef} sx={{ flex: 1, overflow: "auto" }}>
                {isLoading ? (
                  <GeneTableSkeleton />
                ) : (
                  <GeneTable
                    genes={paginatedGenes}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    scrollToGeneId={selectedGeneId}
                    autoExpandGeneId={selectedGeneId}
                    onFamilyClick={setFamilyFilter}
                  />
                )}
              </Box>
              <TablePagination
                component="div"
                count={visibleGenes.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value))
                  setPage(0)
                }}
                rowsPerPageOptions={[25, 50, 100]}
                sx={{ borderTop: 1, borderColor: "divider", flexShrink: 0, mr: 0.5 }}
              />
            </>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
