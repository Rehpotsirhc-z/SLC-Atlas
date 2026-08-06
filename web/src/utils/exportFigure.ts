// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { triggerDownload } from "./download"
import { figureFontStyle } from "./figureFont"

const SVG_MIME = "image/svg+xml;charset=utf-8"

// A figure is laid out in CSS pixels, which are 96 to the inch, so this is what prints at 300
export const PNG_DPI_SCALE = 300 / 96

const MAX_PNG_PIXELS = 120_000_000

export const pngScale = (width: number, height: number) =>
  Math.min(PNG_DPI_SCALE, Math.sqrt(MAX_PNG_PIXELS / (width * height)))

export function withBackground(svg: string, color: string): string {
  const openTag = /^<svg[^>]*>/.exec(svg)?.[0]
  if (!openTag) return svg
  return `${openTag}<rect width="100%" height="100%" fill="${color}"/>${svg.slice(openTag.length)}`
}

async function embedFonts(svg: string): Promise<string> {
  const openTag = /^<svg[^>]*>/.exec(svg)?.[0]
  if (!openTag) return svg
  return openTag + (await figureFontStyle()) + svg.slice(openTag.length)
}

export async function downloadSvg(svg: string, filename: string): Promise<void> {
  triggerDownload(new Blob([await embedFonts(svg)], { type: SVG_MIME }), filename)
}

export async function downloadPng(svg: string, filename: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([await embedFonts(svg)], { type: SVG_MIME }))
  const img = new Image()
  img.onload = () => {
    const scale = pngScale(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext("2d")!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename)
      URL.revokeObjectURL(url)
    }, "image/png")
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}

export function figureExportHandlers(build: () => string | null): {
  exportSvg: (filename: string) => void
  exportPng: (filename: string) => void
} {
  return {
    exportSvg: (filename) => {
      const svg = build()
      if (svg) void downloadSvg(svg, filename)
    },
    exportPng: (filename) => {
      const svg = build()
      if (svg) void downloadPng(svg, filename)
    },
  }
}
