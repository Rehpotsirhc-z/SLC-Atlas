// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import AccountTreeIcon from "@mui/icons-material/AccountTree"
import { Box, MenuItem, Select, Tooltip } from "@mui/material"
import { METRIC_LABEL, METRIC_ORDER, type TreeMetric } from "@/api/hooks/useClustering"

interface Props {
  metric: TreeMetric
  onChange: (metric: TreeMetric) => void
}

export default function GeneOrderSelect({ metric, onChange }: Props) {
  return (
    <Box sx={{ py: 1, pr: 1.5 }}>
      <Tooltip title="Tree used to order the gene rows" placement="top" arrow>
        <Select
          size="small"
          fullWidth
          value={metric}
          onChange={(e) => onChange(e.target.value as TreeMetric)}
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
    </Box>
  )
}
