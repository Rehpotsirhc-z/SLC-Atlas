// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { triggerDownload } from "./download"

const SVG_MIME = "image/svg+xml;charset=utf-8"

export function downloadSvg(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: SVG_MIME }), filename)
}

export function downloadPng(svg: string, filename: string, scale = 2): void {
  const url = URL.createObjectURL(new Blob([svg], { type: SVG_MIME }))
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth * scale
    canvas.height = img.naturalHeight * scale
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
      if (svg) downloadSvg(svg, filename)
    },
    exportPng: (filename) => {
      const svg = build()
      if (svg) downloadPng(svg, filename)
    },
  }
}
