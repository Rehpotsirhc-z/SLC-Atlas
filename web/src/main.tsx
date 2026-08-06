// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import "@fontsource/source-code-pro/400.css"
import "@fontsource/source-code-pro/500.css"
import "@fontsource/source-code-pro/600.css"
import "@fontsource/source-code-pro/700.css"
import "@fontsource/source-sans-3/400.css"
import "@fontsource/source-sans-3/500.css"
import "@fontsource/source-sans-3/600.css"
import "@fontsource/source-sans-3/700.css"
import AppThemeProvider from "./components/AppThemeProvider"
import App from "./App"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  </React.StrictMode>,
)
