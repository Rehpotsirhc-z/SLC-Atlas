// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, IconButton, Tooltip } from "@mui/material"
import AnatomogramAttribution from "./Attribution"
import AnatomogramHeader from "./AnatomogramHeader"
import FigureFrame from "./FigureFrame"
import { PopOutIcon } from "./icons"
import { useRailAutoWidth } from "./useRailAutoWidth"
import type { RailView } from "./tissueMaps"

export type { RailView }

interface RailProps {
  view: RailView
  presentTissues: Set<string>
  selectedTissue: string | null
  tpmByTissue: Map<string, number> | null
  domainMax: number
  maxWidth: number
  onAutoWidth: (px: number) => void
  onFillWidth: (px: number) => void
  onPickSex: (sex: "female" | "male") => void
  onPickBrain: () => void
  onPickTissue: (tissues: string[]) => void
  onPopOut: () => void
}

export default function AnatomogramRail({
  view,
  presentTissues,
  selectedTissue,
  tpmByTissue,
  domainMax,
  maxWidth,
  onAutoWidth,
  onFillWidth,
  onPickSex,
  onPickBrain,
  onPickTissue,
  onPopOut,
}: RailProps) {
  const { rootRef, headerRef, figureWrapRef } = useRailAutoWidth({
    view,
    maxWidth,
    onAutoWidth,
    onFillWidth,
  })

  return (
    <Box
      ref={rootRef}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <AnatomogramHeader
        ref={headerRef}
        view={view}
        onPickSex={onPickSex}
        onPickBrain={onPickBrain}
        actions={
          <Box sx={{ justifySelf: "end" }}>
            <Tooltip title="Pop out to a floating window" arrow>
              <IconButton
                size="small"
                onClick={onPopOut}
                sx={{ color: "text.secondary", p: "7px" }}
              >
                <PopOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      <FigureFrame
        ref={figureWrapRef}
        view={view}
        presentTissues={presentTissues}
        selectedTissue={selectedTissue}
        tpmByTissue={tpmByTissue}
        domainMax={domainMax}
        onPick={onPickTissue}
      />

      <AnatomogramAttribution />
    </Box>
  )
}
