// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import DownloadIcon from "@mui/icons-material/Download"
import { Button, Menu, MenuItem } from "@mui/material"
import type { Gene } from "@/types/gene"
import { triggerDownload } from "@/utils/download"

interface DownloadButtonProps {
  genes: Gene[]
}

const COLUMNS: (keyof Gene)[] = [
  "id",
  "symbol",
  "name",
  "chromosome",
  "start",
  "end",
  "strand",
  "length",
  "alias",
  "category",
  "subcategory",
  "family",
  "family_name",
  "function_brief",
]

function genesToTsvBlob(genes: Gene[]): Blob {
  const header = COLUMNS.join("\t")
  const rows = genes.map((g) => COLUMNS.map((col) => g[col] ?? "").join("\t"))
  return new Blob([[header, ...rows].join("\n")], { type: "text/tab-separated-values" })
}

function genesToJsonBlob(genes: Gene[]): Blob {
  return new Blob([JSON.stringify(genes, null, 2)], { type: "application/json" })
}

export default function DownloadButton({ genes }: DownloadButtonProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  function handleDownload(format: "txt" | "json") {
    const blob = format === "txt" ? genesToTsvBlob(genes) : genesToJsonBlob(genes)
    triggerDownload(blob, `slc_genes.${format}`)
    setAnchorEl(null)
  }

  return (
    <>
      <Button
        startIcon={<DownloadIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        variant="outlined"
        size="small"
        sx={{ whiteSpace: "nowrap" }}
      >
        Download ({genes.length} genes)
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handleDownload("txt")}>Download as .txt (tab-separated)</MenuItem>
        <MenuItem onClick={() => handleDownload("json")}>Download as .json</MenuItem>
      </Menu>
    </>
  )
}
