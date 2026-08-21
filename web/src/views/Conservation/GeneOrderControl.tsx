// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import AccountTreeIcon from "@mui/icons-material/AccountTree"
import { Box, MenuItem, Select, Tooltip } from "@mui/material"
import {
  METRIC_LABEL,
  METRIC_ORDER,
  type TreeMetric,
  type TreeTissue,
} from "@/api/hooks/useClustering"

interface Props {
  metric: TreeMetric
  onMetricChange: (metric: TreeMetric) => void
  tissue: TreeTissue
  onTissueChange: (tissue: TreeTissue) => void
}

export default function GeneOrderControl({
  metric,
  onMetricChange,
  tissue,
  onTissueChange,
}: Props) {
  return (
    <Box sx={{ py: 1, pr: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Tooltip title="Choose the tree used to order gene rows" placement="top">
        <Select
          size="small"
          fullWidth
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as TreeMetric)}
          startAdornment={
            <AccountTreeIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.75 }} />
          }
        >
          {METRIC_ORDER.map((m) => (
            <MenuItem key={m} value={m}>
              {METRIC_LABEL[m]}
            </MenuItem>
          ))}
        </Select>
      </Tooltip>
      {metric === "rna" && (
        <Select
          size="small"
          fullWidth
          value={tissue}
          onChange={(e) => onTissueChange(e.target.value as TreeTissue)}
        >
          <MenuItem value="all">All tissues</MenuItem>
          <MenuItem value="brain">Brain</MenuItem>
        </Select>
      )}
    </Box>
  )
}
