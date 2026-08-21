// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { keyframes } from "@emotion/react"
import { memo, useEffect, useRef, useState } from "react"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight"
import {
  Chip,
  Collapse,
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import FamilyChip from "@/components/FamilyChip"
import { useUIStore } from "@/store/uiStore"
import type { Gene } from "@/types/gene"
import { formatPosition } from "@/utils/format"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import { SELECTED_ROW_TOP_GAP } from "./constants"
import ExternalLink from "./ExternalLink"
import TranscriptTable from "./TranscriptTable"

interface GeneRowProps {
  gene: Gene
  isSelected: boolean
  expanded: boolean
  onToggleExpanded: (geneId: string) => void
  onFamilyClick?: (family: string) => void
}

const rowFlash = keyframes`
  0%   { background-color: rgba(81, 175, 239, 0.35); }
  100% { background-color: transparent; }
`

function GeneRow({ gene, isSelected, expanded, onToggleExpanded, onFamilyClick }: GeneRowProps) {
  const [flashing, setFlashing] = useState(false)
  const rowRef = useRef<HTMLTableRowElement>(null)
  const transcriptCellRef = useRef<HTMLTableCellElement>(null)
  const theme = useTheme()
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)

  const chipSx = {
    fontFamily: "inherit",
    fontSize: "inherit",
    ml: "-7px",
    border: "1px solid transparent",
    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.22) : "transparent",
    color: isSelected ? "primary.main" : "text.primary",
    "&:hover": { bgcolor: alpha(theme.palette.primary.main, isSelected ? 0.3 : 0.1) },
    "& .MuiChip-label": { px: 0.75 },
  }

  const handleSelectClick = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    setSelectedGeneId(isSelected ? null : gene.id)
  }

  useEffect(() => {
    if (!isSelected) return
    const row = rowRef.current
    if (!row) return
    let scrollContainer = row.parentElement
    while (scrollContainer && scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
      scrollContainer = scrollContainer.parentElement
    }
    const alignRow = () => {
      if (!scrollContainer) {
        row.scrollIntoView({ block: "start", behavior: "smooth" })
        return
      }
      const headerHeight = scrollContainer.querySelector<HTMLElement>("thead")?.offsetHeight ?? 0
      const rowTop = row.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top
      scrollContainer.scrollTo({
        top: scrollContainer.scrollTop + rowTop - headerHeight - SELECTED_ROW_TOP_GAP,
        behavior: "smooth",
      })
    }
    let hasFlashed = false
    const flashOnce = () => {
      if (hasFlashed) return
      hasFlashed = true
      setFlashing(true)
      window.setTimeout(() => setFlashing(false), 1400)
    }
    let alignmentTimer = 0
    const scheduleAlignment = () => {
      window.clearTimeout(alignmentTimer)
      alignmentTimer = window.setTimeout(() => {
        alignRow()
        flashOnce()
      }, 120)
    }
    const resizeObserver = new ResizeObserver(scheduleAlignment)
    if (transcriptCellRef.current) resizeObserver.observe(transcriptCellRef.current)
    scheduleAlignment()
    const observerTimer = window.setTimeout(() => resizeObserver.disconnect(), 2500)
    return () => {
      resizeObserver.disconnect()
      window.clearTimeout(alignmentTimer)
      window.clearTimeout(observerTimer)
    }
  }, [isSelected])

  return (
    <>
      <TableRow
        ref={rowRef}
        hover
        data-gene-id={gene.id}
        onClick={() => onToggleExpanded(gene.id)}
        sx={{
          cursor: "pointer",
          ...(isSelected && { bgcolor: alpha(theme.palette.primary.main, 0.08) }),
          ...(flashing && { animation: `${rowFlash} 1.4s ease-out forwards` }),
        }}
      >
        <TableCell padding="checkbox">
          <IconButton size="small" tabIndex={-1}>
            {expanded ? (
              <KeyboardArrowDownIcon fontSize="small" sx={{ color: "primary.main" }} />
            ) : (
              <KeyboardArrowRightIcon fontSize="small" sx={{ color: "primary.main" }} />
            )}
          </IconButton>
        </TableCell>
        <TableCell className="mono">
          <Chip size="small" label={gene.id} onClick={handleSelectClick} sx={chipSx} />
        </TableCell>
        <TableCell className="mono">
          <Chip
            size="small"
            label={gene.symbol}
            onClick={handleSelectClick}
            sx={{
              ...chipSx,
              "& .MuiChip-label": { ...chipSx["& .MuiChip-label"], fontWeight: 700 },
            }}
          />
        </TableCell>
        <TableCell className="mono">{gene.name}</TableCell>
        <TableCell className="mono">
          {formatPosition(gene.chromosome, gene.start, gene.end)} ({gene.strand})
        </TableCell>
        <TableCell className="mono" align="right">
          {gene.length.toLocaleString()}
        </TableCell>
        <TableCell
          onClick={
            onFamilyClick
              ? (e) => {
                  e.stopPropagation()
                  onFamilyClick(gene.family)
                }
              : undefined
          }
        >
          <FamilyChip
            family={gene.family}
            label={gene.category}
            onClick={onFamilyClick ? () => {} : undefined}
          />
        </TableCell>
        <TableCell className="mono">
          {gene.alias ?? (
            <Typography component="span" color="text.disabled" fontFamily="inherit">
              —
            </Typography>
          )}
        </TableCell>
        <TableCell padding="checkbox">
          {gene.function_brief && (
            <Tooltip title={gene.function_brief} placement="left">
              <InfoOutlinedIcon
                fontSize="small"
                sx={{ color: "text.secondary", cursor: "help", display: "block" }}
              />
            </Tooltip>
          )}
        </TableCell>
        <TableCell className="gene-links" onClick={(e) => e.stopPropagation()}>
          <ExternalLink href={ensemblUrl(gene.id)}>Ensembl</ExternalLink>
          <ExternalLink href={ucscUrl(gene)}>UCSC</ExternalLink>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          ref={transcriptCellRef}
          colSpan={10}
          sx={{ p: 0, borderBottom: expanded ? undefined : "none" }}
        >
          <Collapse in={expanded} mountOnEnter unmountOnExit>
            <TranscriptTable geneId={gene.id} chromosome={gene.chromosome} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default memo(GeneRow)
