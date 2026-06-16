// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import { Collapse, IconButton, Link, TableCell, TableRow, Tooltip } from "@mui/material"
import type { Gene } from "@/types/gene"
import { formatPosition } from "@/utils/format"
import { ensemblUrl, ucscUrl } from "@/utils/links"
import TranscriptTable from "./TranscriptTable"

interface GeneRowProps {
  gene: Gene
  expanded: boolean
  onToggleExpand: (geneId: string) => void
  isSelected: boolean
}

export default function GeneRow({ gene, expanded, onToggleExpand, isSelected }: GeneRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (isSelected) {
      rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [isSelected])

  return (
    <>
      <TableRow
        ref={rowRef}
        hover
        selected={isSelected}
        sx={isSelected ? { outline: "2px solid", outlineColor: "secondary.main" } : undefined}
      >
        <TableCell padding="checkbox">
          <IconButton size="small" onClick={() => onToggleExpand(gene.id)}>
            {expanded ? (
              <KeyboardArrowDownIcon fontSize="small" />
            ) : (
              <KeyboardArrowRightIcon fontSize="small" />
            )}
          </IconButton>
        </TableCell>
        <TableCell>{gene.id}</TableCell>
        <TableCell>
          <strong>{gene.symbol}</strong>
        </TableCell>
        <TableCell>{gene.name}</TableCell>
        <TableCell>
          {formatPosition(gene.chromosome, gene.start, gene.end)} ({gene.strand})
        </TableCell>
        <TableCell align="right">{gene.length.toLocaleString()}</TableCell>
        <TableCell>{gene.category ?? gene.family_name}</TableCell>
        <TableCell>{gene.alias ?? "—"}</TableCell>
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
          <Collapse in={expanded} unmountOnExit>
            {expanded && <TranscriptTable geneId={gene.id} chromosome={gene.chromosome} />}
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}
