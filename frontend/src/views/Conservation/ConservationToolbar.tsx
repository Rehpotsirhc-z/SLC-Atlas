// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { ToggleButton, ToggleButtonGroup } from "@mui/material"
import ToolbarMeasureProbe from "@/components/view/ToolbarMeasureProbe"
import ViewToolbar from "@/components/view/ViewToolbar"
import ViewToolbarActions, { type ExportItem } from "@/components/view/ViewToolbarActions"
import { useToolbarFit } from "@/components/view/useToolbarFit"
import { CELL_METRICS, type CellMetricKey } from "./ConservationHeatmap"

interface Props {
  cellMetric: CellMetricKey
  onCellMetricChange: (metric: CellMetricKey) => void
  counterText: string
  onResetView: () => void
  exportItems: ExportItem[]
}

export default function ConservationToolbar({
  cellMetric,
  onCellMetricChange,
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
            value={cellMetric}
            onChange={(_, v) => v && onCellMetricChange(v)}
            sx={{ width: wrapped ? "100%" : "auto" }}
          >
            {CELL_METRICS.map((m) => (
              <ToggleButton key={m.key} value={m.key} sx={{ minWidth: wrapped ? 0 : 120 }}>
                {m.label}
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
          {CELL_METRICS.map((m) => (
            <ToggleButton key={m.key} value={m.key} sx={{ minWidth: 120 }}>
              {m.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </ToolbarMeasureProbe>
    </>
  )
}
