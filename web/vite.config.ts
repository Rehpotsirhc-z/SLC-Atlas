// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { fileURLToPath, URL } from "node:url"
import { doomColors } from "./src/theme/palette"
import { resolveAtlasConfig, type AtlasConfig } from "./src/config/product"
import { ROUTES } from "./src/config/routes"

const doomScssVars = Object.entries(doomColors)
  .flatMap(([mode, colors]) =>
    Object.entries(colors).map(([name, value]) => `$doom-${mode}-${name}: ${value};`),
  )
  .join("\n")

const envDir = fileURLToPath(new URL("..", import.meta.url))

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const renderShell = (html: string, config: AtlasConfig) =>
  html
    .replaceAll("__ATLAS_APP_NAME__", escapeAttr(config.name))
    .replaceAll("__ATLAS_APP_DESCRIPTION__", escapeAttr(config.description))
    .replaceAll("__ATLAS_CONFIG_JSON__", JSON.stringify(config).replace(/</g, "\\u003c"))

export default defineConfig(({ mode }) => {
  const atlasConfig = resolveAtlasConfig(loadEnv(mode, envDir, "ATLAS_"))

  return {
    envDir,
    plugins: [
      react(),
      {
        name: "atlas-shell",
        apply: "serve",
        transformIndexHtml: (html: string) => renderShell(html, atlasConfig),
      },
      {
        name: "atlas-routes",
        apply: "build",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "routes.json",
            source: JSON.stringify(ROUTES.map((r) => r.path)),
          })
        },
      },
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: atlasConfig.name,
          short_name: atlasConfig.shortName,
          description: atlasConfig.description,
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: doomColors.light.bg,
          theme_color: doomColors.light.blue,
          icons: [],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,woff,woff2}"],
          // Keeps the Mol* chunk out of the precache, so it downloads on first use not on install
          globIgnores: ["**/MolstarViewer-*.js"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => /\/assets\/MolstarViewer-.*\.js$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "molstar-viewer",
                expiration: { maxEntries: 2 },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/api/") && !url.pathname.includes("/models/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [fileURLToPath(new URL("./node_modules", import.meta.url))],
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
  }
})
