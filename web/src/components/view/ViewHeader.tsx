// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography } from "@mui/material"

interface Props {
  title: string
  subtitle: string
}

export default function ViewHeader({ title, subtitle }: Props) {
  return (
    <Box>
      <Typography variant="h5" color="primary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitle}
      </Typography>
    </Box>
  )
}
