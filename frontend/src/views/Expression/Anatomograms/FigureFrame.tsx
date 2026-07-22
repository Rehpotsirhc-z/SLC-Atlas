// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { forwardRef } from "react"
import { Box } from "@mui/material"
import AnatomogramFigure, { type AnatomogramFigureProps } from "./AnatomogramFigure"

const FigureFrame = forwardRef<HTMLDivElement, AnatomogramFigureProps>(
  function FigureFrame(props, ref) {
    return (
      <Box
        ref={ref}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          px: 1.5,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <AnatomogramFigure key={props.view} {...props} />
      </Box>
    )
  },
)

export default FigureFrame
