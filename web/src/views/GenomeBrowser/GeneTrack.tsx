// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, useRef, useState } from "react"
import { Box, Typography, useTheme } from "@mui/material"
import type { TranscriptModel } from "@/types/browser"
import { biotypeColor } from "@/utils/biotypeColor"
import BrowserTooltip, { strandLabel, TipLine, TipTitle } from "./BrowserTooltip"
import {
  GENE_ROW_H,
  GENE_TRACK_MAX_H,
  GENE_TRACK_MIN_H,
  GENE_TRACK_PAD,
  MAX_GENE_ROWS,
  EDGE_PAD,
} from "./constants"
import { drawGenes, drawTranscripts, type GeneInk } from "./drawGenes"
import {
  collapseToGenes,
  itemAt,
  layoutGenes,
  layoutTranscripts,
  type GeneSpan,
} from "./geneLayout"
import { scaleFor, type Scale, type Viewport } from "./scale"
import { useLaneCanvas } from "./useLaneCanvas"
import type { Painter } from "./useBrowserView"

export type GeneTrackMode = "transcripts" | "genes"

interface Props {
  transcripts: TranscriptModel[]
  mode: GeneTrackMode
  gap: number
  empty: boolean
  width: number
  gutter: number
  subscribe: (paint: Painter) => () => void
  liveView: () => Viewport
}

type Target = TranscriptModel | GeneSpan

const isTranscript = (item: Target): item is TranscriptModel => "transcript_id" in item

interface Hovered {
  item: Target
  x: number
  y: number
}

const sameHover = (next: Hovered | null) => (current: Hovered | null) =>
  current?.item === next?.item && current?.x === next?.x ? current : next

function GeneTrack({ transcripts, mode, gap, empty, width, gutter, subscribe, liveView }: Props) {
  const { palette, custom } = useTheme()
  const [hover, setHover] = useState<Hovered | null>(null)

  const layout = useMemo(
    () =>
      mode === "transcripts"
        ? layoutTranscripts(transcripts, gap, MAX_GENE_ROWS)
        : layoutGenes(collapseToGenes(transcripts), gap, MAX_GENE_ROWS),
    [transcripts, mode, gap],
  )

  // The canvas is as tall as the models need; the lane it sits in is capped and scrolls, so a
  // gene with more transcripts than fit is still all there rather than drawn past the edge
  const contentHeight = Math.max(GENE_TRACK_MIN_H, layout.rows * GENE_ROW_H + GENE_TRACK_PAD * 2)
  const laneHeight = Math.min(GENE_TRACK_MAX_H, contentHeight)

  const ink = useMemo<GeneInk>(
    () => ({
      colorOf: (biotype) => biotypeColor(biotype, palette.mode),
      label: palette.text.secondary,
      highlight: palette.secondary.main,
      font: custom.monoFontFamily,
    }),
    [palette, custom],
  )

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, scale: Scale) => {
      const frame = { ctx, scale, height: contentHeight, top: GENE_TRACK_PAD, ink }
      if (mode === "transcripts") {
        drawTranscripts({ ...frame, layout: layout as ReturnType<typeof layoutTranscripts> })
      } else {
        drawGenes({ ...frame, layout: layout as ReturnType<typeof layoutGenes> })
      }
    },
    [layout, mode, contentHeight, ink],
  )

  const canvasRef = useLaneCanvas(subscribe, liveView, width, contentHeight, paint)
  const scrollRef = useRef<HTMLDivElement>(null)

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.buttons !== 0) return
      const box = event.currentTarget.getBoundingClientRect()
      const scale = scaleFor(liveView(), width)
      const scrolled = event.currentTarget.scrollTop
      const row = Math.floor((event.clientY - box.top + scrolled - GENE_TRACK_PAD) / GENE_ROW_H)
      const base = scale.toBase(event.clientX - box.left)
      // A little slack so a feature drawn at its minimum width is still catchable
      const slack = scale.basesPerPixel * 3
      const found = itemAt(layout as never, row, base, slack) as Target | null
      setHover(sameHover(found ? { item: found, x: event.clientX, y: event.clientY } : null))
    },
    [layout, liveView, width],
  )

  const clear = useCallback(() => setHover(sameHover(null)), [])

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        borderTop: 1,
        borderColor: "divider",
        pr: `${EDGE_PAD}px`,
        pb: 1,
      }}
    >
      <Box
        sx={{
          width: gutter,
          flexShrink: 0,
          pl: `${EDGE_PAD}px`,
          pr: 1,
          pt: 1,
          overflow: "hidden",
        }}
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.3 }}>Genes</Typography>
        <Typography
          sx={{ fontSize: 11.5, fontFamily: custom.monoFontFamily, color: "text.secondary" }}
        >
          {mode === "transcripts" ? `${layout.items.length} tx` : `${layout.items.length} genes`}
          {layout.hidden > 0 ? ` +${layout.hidden}` : ""}
        </Typography>
      </Box>
      <Box
        ref={scrollRef}
        sx={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          height: laneHeight,
          overflowY: "auto",
          overflowX: "hidden",
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={clear}
      >
        <canvas ref={canvasRef} style={{ display: "block", width, height: contentHeight }} />
        {empty && (
          <Typography
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "text.disabled",
              pointerEvents: "none",
            }}
          >
            no gene models were sliced for this stretch
          </Typography>
        )}
      </Box>
      {hover && (
        <BrowserTooltip x={hover.x} y={hover.y}>
          <TipTitle>
            {isTranscript(hover.item)
              ? hover.item.gene_name || hover.item.transcript_id
              : hover.item.label}
          </TipTitle>
          {isTranscript(hover.item) && (
            <TipLine>
              {hover.item.transcript_id +
                (hover.item.transcript_version ? `.${hover.item.transcript_version}` : "")}
            </TipLine>
          )}
          <TipLine>
            {`${hover.item.biotype?.replace(/_/g, " ") ?? "unknown biotype"}, ${strandLabel(
              hover.item.strand,
            )}`}
          </TipLine>
          <TipLine>
            {`${hover.item.start.toLocaleString()}\u2013${hover.item.end.toLocaleString()} · ${
              isTranscript(hover.item)
                ? `${hover.item.exons.length} exons`
                : `${(hover.item as GeneSpan).transcripts} transcripts`
            }`}
          </TipLine>
        </BrowserTooltip>
      )}
    </Box>
  )
}

export default memo(GeneTrack)
