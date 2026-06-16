// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, type ReactNode } from "react"
import { CssBaseline, ThemeProvider } from "@mui/material"
import { useUIStore } from "@/store/uiStore"
import { darkTheme, lightTheme } from "@/theme"

interface AppThemeProviderProps {
  children: ReactNode
}

export default function AppThemeProvider({ children }: AppThemeProviderProps) {
  const mode = useUIStore((s) => s.themeMode)
  const theme = useMemo(() => (mode === "dark" ? darkTheme : lightTheme), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
