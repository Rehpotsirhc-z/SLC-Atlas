// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Typography, useTheme } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"
import { clipSpans, formatSpans, siteName } from "./bindingSites"
import { elementAtResidue, isSegmentModel, type ChainModel } from "./chainModel"
import { plddtBand } from "./confidenceColor"
import type { TopologyTarget } from "./topologyTargets"

interface Props {
  hover: TopologyTarget
  point: { x: number; y: number }
  model: ChainModel
}

const UNRESOLVED =
  "sides unresolved: the annotation here cannot be satisfied by alternating helices"

export default function TopologyTooltip({ hover, point, model }: Props) {
  const { custom } = useTheme()

  const Title = ({ children }: { children: string }) => (
    <Typography
      variant="caption"
      sx={{ fontFamily: custom.monoFontFamily, display: "block", fontWeight: 600, fontSize: 13 }}
    >
      {children}
    </Typography>
  )
  const Line = ({ children }: { children: string }) => (
    <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontSize: 13 }}>
      {children}
    </Typography>
  )

  // So hovering a helix also tells you which of its residues line a binding site
  const bindingLines = (start: number, end: number) =>
    model.sites
      .map((site) => ({ name: siteName(site), spans: clipSpans(site.spans, start, end) }))
      .filter((s) => s.spans.length > 0)
      .map((s) => `binds ${s.name}: ${formatSpans(s.spans)}`)

  const face = (side: "inside" | "outside") => model.sideLabels[side].toLowerCase()

  const gapName = (gap: { terminus: "N" | "C" | null; description: string | null }) =>
    gap.terminus ? `${gap.terminus}-terminus` : (gap.description ?? "Loop")

  return (
    <HoverTooltip x={point.x} y={point.y}>
      {hover.kind === "segment" && (
        <>
          <Title>{hover.item.name}</Title>
          <Line>
            {`residues ${hover.item.start}–${hover.item.end} · ${
              hover.item.entrySide === hover.item.exitSide
                ? `enters and leaves on the ${face(hover.item.entrySide)} face`
                : `enters from the ${face(hover.item.entrySide)} face`
            }`}
          </Line>
          {hover.item.description && <Line>{hover.item.description}</Line>}
          {hover.item.unresolved && <Line>{UNRESOLVED}</Line>}
          {bindingLines(hover.item.start, hover.item.end).map((line) => (
            <Line key={line}>{line}</Line>
          ))}
        </>
      )}

      {hover.kind === "arc" && (
        <>
          <Title>{gapName(hover.item)}</Title>
          <Line>
            {`residues ${hover.item.start}–${hover.item.end} · ${(
              hover.item.description ?? model.sideLabels[hover.item.side]
            ).toLowerCase()}${hover.item.description ? "" : " face"}`}
          </Line>
          {!hover.item.description && <Line>side inferred, not annotated</Line>}
          {hover.item.unresolved && <Line>{UNRESOLVED}</Line>}
          {bindingLines(hover.item.start, hover.item.end).map((line) => (
            <Line key={line}>{line}</Line>
          ))}
        </>
      )}

      {hover.kind === "site" && (
        <>
          <Title>{siteName(hover.item)}</Title>
          <Line>
            {`${hover.item.residues} residue${hover.item.residues === 1 ? "" : "s"}${
              hover.item.elements.length ? ` in ${hover.item.elements.join(", ")}` : ""
            }`}
          </Line>
          <Typography
            variant="caption"
            sx={{ display: "block", fontFamily: custom.monoFontFamily, fontWeight: 600, fontSize: 13 }}
          >
            {formatSpans(hover.item.spans)}
          </Typography>
        </>
      )}

      {hover.kind === "confidence" && (
        <>
          <Title>{`pLDDT ${hover.score}`}</Title>
          <Line>{`residue ${hover.residue} · ${plddtBand(hover.score)}`}</Line>
        </>
      )}

      {hover.kind === "residue" &&
        (() => {
          const element = elementAtResidue(model, hover.residue)
          return (
            <>
              <Title>{`${hover.letter ?? ""}${hover.residue}`}</Title>
              {element && <Line>{isSegmentModel(element) ? element.name : gapName(element)}</Line>}
              {hover.score !== null && (
                <Line>{`pLDDT ${hover.score} · ${plddtBand(hover.score)}`}</Line>
              )}
              {bindingLines(hover.residue, hover.residue).map((line) => (
                <Line key={line}>{line}</Line>
              ))}
            </>
          )
        })()}
    </HoverTooltip>
  )
}
