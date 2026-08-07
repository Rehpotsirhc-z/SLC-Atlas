// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import AccountTreeIcon from "@mui/icons-material/AccountTree"
import { Box, IconButton } from "@mui/material"
import GeneSearchBar from "@/components/autocomplete/GeneSearchBar"
import ToolbarMeasureProbe from "@/components/view/ToolbarMeasureProbe"
import ViewToolbar from "@/components/view/ViewToolbar"
import ViewToolbarActions, { type ExportItem } from "@/components/view/ViewToolbarActions"
import { useToolbarFit } from "@/components/view/useToolbarFit"
import type { Gene } from "@/types/gene"
import { SEARCH_WIDTH } from "./constants"

interface Props {
  genes: Gene[]
  showTreeButton: boolean
  familyFilter: string | null
  onOpenTree: () => void
  searchText: string
  onSearchChange: (value: string) => void
  counterText: string
  onResetView: () => void
  exportItems: ExportItem[]
}

export default function GeneAnnotationToolbar({
  genes,
  showTreeButton,
  familyFilter,
  onOpenTree,
  searchText,
  onSearchChange,
  counterText,
  onResetView,
  exportItems,
}: Props) {
  const { tbState, toolbarRef, probeRefs } = useToolbarFit({ counterText, toggleCount: 1 })
  const wrapped = tbState === "wrapped"

  return (
    <>
      <ViewToolbar
        toolbarRef={toolbarRef}
        tbState={tbState}
        toggles={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: wrapped ? 1 : "none" }}>
            {showTreeButton && (
              <IconButton
                onClick={onOpenTree}
                size="small"
                color={familyFilter ? "primary" : "default"}
              >
                <AccountTreeIcon fontSize="small" />
              </IconButton>
            )}
            <GeneSearchBar
              genes={genes}
              value={searchText}
              onChange={onSearchChange}
              width={wrapped ? "100%" : SEARCH_WIDTH}
            />
          </Box>
        }
        actions={
          <ViewToolbarActions
            tbState={tbState}
            counterText={counterText}
            onResetView={onResetView}
            exportItems={exportItems}
          />
        }
      />
      <ToolbarMeasureProbe refs={probeRefs} counterText={counterText}>
        <Box ref={probeRefs.registerToggle(0)} sx={{ width: SEARCH_WIDTH }} />
      </ToolbarMeasureProbe>
    </>
  )
}
