// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Typography, useTheme } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"
import { plddtBand } from "@/types/structure"
import { clipSpans, formatSpans, siteName } from "./bindingSites"
import type { Hover } from "./useTopologyHover"
import type { TopologyLayout } from "./topologyLayout"

interface Props {
  hover: Hover
  layout: TopologyLayout
}

const UNRESOLVED =
  "sides unresolved: the annotation here cannot be satisfied by alternating helices"

export default function TopologyTooltip({ hover, layout }: Props) {
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
    <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
      {children}
    </Typography>
  )

  // So hovering a helix also tells you which of its residues line a binding site
  const bindingLines = (start: number, end: number) =>
    layout.sites
      .map((site) => ({ name: siteName(site), spans: clipSpans(site.spans, start, end) }))
      .filter((s) => s.spans.length > 0)
      .map((s) => `binds ${s.name}: ${formatSpans(s.spans)}`)

  const face = (side: "inside" | "outside") => layout.sideLabels[side].toLowerCase()

  return (
    <HoverTooltip x={hover.x} y={hover.y}>
      {hover.kind === "segment" && (
        <>
          <Title>{hover.item.name}</Title>
          <Line>
            {`residues ${hover.item.start}-${hover.item.end} · ${
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
          <Title>
            {hover.item.terminus
              ? `${hover.item.terminus}-terminus`
              : (hover.item.description ?? "Loop")}
          </Title>
          <Line>
            {`residues ${hover.item.start}-${hover.item.end} · ${(
              hover.item.description ?? layout.sideLabels[hover.item.side]
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
            sx={{ display: "block", fontFamily: custom.monoFontFamily, fontWeight: 600 }}
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
    </HoverTooltip>
  )
}
