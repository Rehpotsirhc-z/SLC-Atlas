// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { PaletteMode } from "@mui/material"
import { getFamilyColor } from "@/utils/familyColor"
import { GENE_LABEL_GAP, GENE_TREE_W, LEFT_W } from "./constants"
import type { GeneRow } from "./useGeneRows"

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

export const svgFontFamily = (monoFont: string) => monoFont.replace(/"/g, "&quot;")

export function cellRectsSvg(opts: {
  nRows: number
  nCols: number
  y0: number
  cellW: number
  cellH: number
  fillFor: (row: number, col: number) => string
}): string {
  const { nRows, nCols, y0, cellW, cellH, fillFor } = opts
  const rects: string[] = []
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      rects.push(
        `<rect x="${LEFT_W + c * cellW}" y="${y0 + r * cellH}" width="${cellW - 1}" height="${cellH - 1}" fill="${fillFor(r, c)}"/>`,
      )
    }
  }
  return rects.join("")
}

export function geneLabelsSvg(opts: {
  geneRows: GeneRow[]
  y0: number
  cellH: number
  geneDotR: number
  geneFont: number
  svgFont: string
  mode: PaletteMode
}): string {
  const { geneRows, y0, cellH, geneDotR, geneFont, svgFont, mode } = opts
  return geneRows
    .map((g, i) => {
      const color = getFamilyColor(g.family ?? "?", mode)
      const cy = y0 + i * cellH + cellH / 2
      return (
        `<circle cx="${GENE_TREE_W}" cy="${cy}" r="${geneDotR}" fill="${color}"/>` +
        `<text x="${GENE_TREE_W + GENE_LABEL_GAP}" y="${cy + geneFont * 0.28}" font-size="${geneFont}" font-family="${svgFont}" fill="${color}">${esc(g.symbol)}</text>`
      )
    })
    .join("")
}

export function columnLabelsSvg(opts: {
  labels: string[]
  y: number
  cellW: number
  font: number
  svgFont: string
  fill: string
}): string {
  const { labels, y, cellW, font, svgFont, fill } = opts
  return labels
    .map((label, i) => {
      const x = LEFT_W + i * cellW + cellW / 2
      return `<text x="${x}" y="${y}" font-size="${font}" font-family="${svgFont}" fill="${fill}" text-anchor="start" dominant-baseline="central" transform="rotate(90 ${x} ${y})">${esc(label)}</text>`
    })
    .join("")
}

export function figureSvgDocument(opts: {
  width: number
  height: number
  margin: number
  contentTop: number
  background: string
  body: string
}): string {
  const { width: w, height: h, margin, contentTop, background, body } = opts
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${background}"/>` +
    `<g transform="translate(${margin} ${margin - contentTop})">` +
    body +
    `</g>` +
    `</svg>`
  )
}

export function treePathSvg(edges: string, dx: number, dy: number, stroke: string): string {
  return `<path transform="translate(${dx} ${dy})" d="${edges}" stroke="${stroke}" stroke-width="0.7" fill="none"/>`
}
