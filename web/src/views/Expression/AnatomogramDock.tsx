// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import { Box, Tooltip } from "@mui/material"
import AnatomogramRail from "./Anatomograms"
import AnatomogramWindow from "./Anatomograms/AnatomogramWindow"
import { RAIL_EDGE_WIDTH, RAIL_RESIZE_GRIP_W, RAIL_TRANSITION } from "./constants"
import type { useExpressionRail } from "./useExpressionRail"

interface Props {
  rail: ReturnType<typeof useExpressionRail>
  presentTissues: Set<string>
  isMobile: boolean
  onScopeAll: () => void
  onScopeBrain: () => void
}

export default function AnatomogramDock({
  rail,
  presentTissues,
  isMobile,
  onScopeAll,
  onScopeBrain,
}: Props) {
  const {
    view,
    railOpen,
    setRailOpen,
    railFloating,
    setRailFloating,
    setAnatomogramSex,
    railTissue,
    pickTissue,
    effWidth,
    maxAutoWidth,
    setRailWidth,
    setFillWidth,
    startResize,
    tpmByTissue,
    domainMax,
    reduceMotion,
  } = rail

  const pickSex = (sex: "female" | "male") => {
    setAnatomogramSex(sex)
    onScopeAll()
  }

  const shared = {
    view,
    presentTissues,
    selectedTissue: railTissue,
    tpmByTissue,
    domainMax,
    onPickSex: pickSex,
    onPickBrain: onScopeBrain,
    onPickTissue: pickTissue,
  }

  const label = railOpen ? "Hide anatomograms" : "Show anatomograms"

  return (
    <>
      {!isMobile && !(railFloating && railOpen) && (
        <Box sx={{ flexShrink: 0, display: "flex", position: "relative" }}>
          <Tooltip title={label} placement="left">
            <Box
              role="button"
              aria-label={label}
              onClick={() => setRailOpen(!railOpen)}
              sx={{
                flexShrink: 0,
                width: `${RAIL_EDGE_WIDTH}px`,
                cursor: "pointer",
                borderLeft: 1,
                borderRight: railOpen ? 1 : 0,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "text.disabled",
                transition: "background-color 0.15s, color 0.15s",
                "&:hover": { color: "primary.main", bgcolor: "action.hover" },
              }}
            >
              {railOpen ? (
                <ChevronRightIcon fontSize="small" />
              ) : (
                <ChevronLeftIcon fontSize="small" />
              )}
            </Box>
          </Tooltip>

          {railOpen && (
            <Box
              onPointerDown={startResize}
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: RAIL_RESIZE_GRIP_W,
                cursor: "col-resize",
                touchAction: "none",
                zIndex: 1,
              }}
            />
          )}

          <Box
            sx={{
              width: railOpen ? effWidth : 0,
              flexShrink: 0,
              minHeight: 0,
              overflow: "hidden",
              transition: reduceMotion ? "none" : RAIL_TRANSITION,
            }}
          >
            <Box sx={{ width: effWidth, height: "100%", minHeight: 0 }}>
              <AnatomogramRail
                {...shared}
                maxWidth={maxAutoWidth}
                onAutoWidth={setRailWidth}
                onFillWidth={setFillWidth}
                onPopOut={() => setRailFloating(true)}
              />
            </Box>
          </Box>
        </Box>
      )}

      {railOpen && (isMobile || railFloating) && (
        <AnatomogramWindow
          {...shared}
          onClose={() => {
            setRailOpen(false)
            if (!isMobile) setRailFloating(false)
          }}
          onPopIn={() => setRailFloating(false)}
          hideDock={isMobile}
        />
      )}
    </>
  )
}
