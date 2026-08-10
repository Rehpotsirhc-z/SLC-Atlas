// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material"
import type { TreeTissue } from "@/api/hooks/useClustering"
import ToolbarMeasureProbe from "@/components/view/ToolbarMeasureProbe"
import ViewToolbar from "@/components/view/ViewToolbar"
import ViewToolbarActions, { type ExportItem } from "@/components/view/ViewToolbarActions"
import { useToolbarFit } from "@/components/view/useToolbarFit"
import { capLineSx } from "@/theme"

const TISSUE_OPTIONS: { value: TreeTissue; label: string }[] = [
  { value: "all", label: "All tissues" },
  { value: "brain", label: "Brain" },
]

interface Props {
  tissue: TreeTissue
  onTissueChange: (tissue: TreeTissue) => void
  counterText: string
  onResetView: () => void
  exportItems: ExportItem[]
}

export default function ExpressionToolbar({
  tissue,
  onTissueChange,
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
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth={wrapped}
            value={tissue}
            onChange={(_, v) => v && onTissueChange(v)}
            sx={{ width: wrapped ? "100%" : "auto" }}
          >
            {TISSUE_OPTIONS.map((t) => (
              <ToggleButton key={t.value} value={t.value} sx={{ minWidth: wrapped ? 0 : 120 }}>
                <Box component="span" sx={capLineSx}>
                  {t.label}
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
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
        <ToggleButtonGroup ref={probeRefs.registerToggle(0)} size="small">
          {TISSUE_OPTIONS.map((t) => (
            <ToggleButton key={t.value} value={t.value} sx={{ minWidth: 120 }}>
              <Box component="span" sx={capLineSx}>
                {t.label}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </ToolbarMeasureProbe>
    </>
  )
}
