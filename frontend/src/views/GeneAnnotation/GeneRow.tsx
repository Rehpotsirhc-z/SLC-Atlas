// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { keyframes } from "@emotion/react"
import { memo, useEffect, useRef, useState } from "react"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight"
import {
  Collapse,
  IconButton,
  Link,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import FamilyChip from "@/components/FamilyChip"
import type { Gene } from "@/types/gene"
import { formatPosition } from "@/utils/format"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import TranscriptTable from "./TranscriptTable"

interface GeneRowProps {
  gene: Gene
  isSelected: boolean
  autoExpand: boolean
}

const rowFlash = keyframes`
  0%   { background-color: rgba(81, 175, 239, 0.35); }
  100% { background-color: transparent; }
`

function GeneRow({ gene, isSelected, autoExpand }: GeneRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const { custom } = useTheme()

  useEffect(() => {
    if (!isSelected) return
    setExpanded(true)
    const t = setTimeout(() => {
      if (!rowRef.current) return
      let fired = false
      const startFlash = () => {
        if (fired) return
        fired = true
        setFlashing(true)
        setTimeout(() => setFlashing(false), 1400)
      }
      let scrollParent = rowRef.current.parentElement
      while (scrollParent && scrollParent.scrollHeight <= scrollParent.clientHeight) {
        scrollParent = scrollParent.parentElement
      }
      scrollParent?.addEventListener("scrollend", startFlash, { once: true })
      rowRef.current.scrollIntoView({ block: "start", behavior: "smooth" })
      setTimeout(startFlash, 600)
    }, 300)
    return () => clearTimeout(t)
  }, [isSelected])

  useEffect(() => {
    if (autoExpand) setExpanded(true)
  }, [autoExpand])

  return (
    <>
      <TableRow
        ref={rowRef}
        hover
        onClick={() => setExpanded((e) => !e)}
        sx={{
          cursor: "pointer",
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
        <TableCell sx={{ fontFamily: custom.monoFontFamily }}>{gene.id}</TableCell>
        <TableCell sx={{ fontFamily: custom.monoFontFamily }}>
          <Typography variant="body2" component="span" fontWeight={700} fontFamily="inherit">
            {gene.symbol}
          </Typography>
        </TableCell>
        <TableCell sx={{ fontFamily: custom.monoFontFamily }}>{gene.name}</TableCell>
        <TableCell sx={{ fontFamily: custom.monoFontFamily }}>
          {formatPosition(gene.chromosome, gene.start, gene.end)} ({gene.strand})
        </TableCell>
        <TableCell align="right" sx={{ fontFamily: custom.monoFontFamily }}>
          {gene.length.toLocaleString()}
        </TableCell>
        <TableCell>
          <FamilyChip family={gene.family} label={gene.category ?? gene.family_name} />
        </TableCell>
        <TableCell sx={{ fontFamily: custom.monoFontFamily }}>
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
        <TableCell>
          <Link href={ensemblUrl(gene.id)} target="_blank" rel="noopener">
            Ensembl
          </Link>
          {" / "}
          <Link href={ucscUrl(gene)} target="_blank" rel="noopener">
            UCSC
          </Link>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={10} sx={{ p: 0, borderBottom: expanded ? undefined : "none" }}>
          <Collapse in={expanded} mountOnEnter unmountOnExit>
            <TranscriptTable geneId={gene.id} chromosome={gene.chromosome} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default memo(GeneRow)
