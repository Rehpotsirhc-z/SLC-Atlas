// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { doomColors } from "./src/theme/palette"

// Sass cannot read the theme module, and the Mol* skins are compiled rather than themed at
// runtime, so the palette is handed to them here instead of being transcribed into each skin
const doomScssVars = Object.entries(doomColors)
  .flatMap(([mode, colors]) =>
    Object.entries(colors).map(([name, value]) => `$doom-${mode}-${name}: ${value};`),
  )
  .join("\n")

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Mol*'s skin partials import each other by bare package path
        loadPaths: [fileURLToPath(new URL("./node_modules", import.meta.url))],
        // Declarations are legal ahead of @use, which is where the skins consume them
        additionalData: `${doomScssVars}\n`,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 4000,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
