// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material"
import type { Theme } from "@mui/material/styles"
import {
  METRIC_LABEL,
  METRIC_ORDER,
  type TreeMetric,
  type TreeTissue,
} from "@/api/hooks/useClustering"
import ToolbarMeasureProbe from "@/components/view/ToolbarMeasureProbe"
import ViewToolbar from "@/components/view/ViewToolbar"
import ViewToolbarActions, { type ExportItem } from "@/components/view/ViewToolbarActions"
import { useToolbarFit } from "@/components/view/useToolbarFit"
import { capLineSx, doomColors } from "@/theme"

const wrappedMetricSx = (theme: Theme) => {
  const radius = theme.shape.borderRadius
  return {
    width: "100%",
    display: "flex",
    flexWrap: "wrap",
    columnGap: 0,
    rowGap: "8px",
    "& .MuiToggleButtonGroup-grouped": {
      flex: "1 1 30%",
    },
    "& .MuiToggleButtonGroup-grouped:nth-of-type(3)": {
      borderTopRightRadius: radius,
      borderBottomRightRadius: radius,
    },
    "& .MuiToggleButtonGroup-grouped:nth-of-type(4)": {
      marginLeft: 0,
      borderLeft: "1px solid",
      borderLeftColor: "divider",
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
    },
    "& .MuiToggleButtonGroup-grouped.Mui-selected": {
      borderColor: doomColors[theme.palette.mode].magenta,
    },
  }
}

const TISSUE_OPTIONS: { value: TreeTissue; label: string }[] = [
  { value: "all", label: "All tissues" },
  { value: "brain", label: "Brain" },
]

interface Props {
  metric: TreeMetric
  onMetricChange: (metric: TreeMetric) => void
  tissue: TreeTissue
  onTissueChange: (tissue: TreeTissue) => void
  leafCount: number
  onResetView: () => void
  exportItems: ExportItem[]
}

export default function ClusteringToolbar({
  metric,
  onMetricChange,
  tissue,
  onTissueChange,
  leafCount,
  onResetView,
  exportItems,
}: Props) {
  const showTissue = metric === "rna"
  const counterText = `${leafCount} genes`
  const { tbState, toolbarRef, probeRefs } = useToolbarFit({
    counterText,
    toggleCount: showTissue ? 2 : 1,
  })
  const wrapped = tbState === "wrapped"
  const toggleWidth = wrapped ? "100%" : "auto"
  const minWidth = wrapped ? 0 : 120

  return (
    <>
      <ViewToolbar
        toolbarRef={toolbarRef}
        tbState={tbState}
        toggles={
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              fullWidth={wrapped}
              value={metric}
              onChange={(_, v) => v && onMetricChange(v)}
              sx={wrapped ? wrappedMetricSx : { width: toggleWidth }}
            >
              {METRIC_ORDER.map((m) => (
                <ToggleButton key={m} value={m} sx={{ minWidth }}>
                  <Box component="span" sx={capLineSx}>
                    {METRIC_LABEL[m]}
                  </Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {showTissue && (
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth={wrapped}
                value={tissue}
                onChange={(_, v) => v && onTissueChange(v)}
                sx={{ width: toggleWidth }}
              >
                {TISSUE_OPTIONS.map((t) => (
                  <ToggleButton key={t.value} value={t.value} sx={{ minWidth }}>
                    <Box component="span" sx={capLineSx}>
                      {t.label}
                    </Box>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </>
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
          {METRIC_ORDER.map((m) => (
            <ToggleButton key={m} value={m} sx={{ minWidth: 120 }}>
              <Box component="span" sx={capLineSx}>
                {METRIC_LABEL[m]}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup ref={probeRefs.registerToggle(1)} size="small">
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
