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

const webManifest = (config: AtlasConfig) =>
  JSON.stringify({
    name: config.name,
    short_name: config.shortName,
    description: config.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: doomColors.light.bg,
    theme_color: doomColors.light.blue,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  })

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
        configureServer(server) {
          server.middlewares.use("/manifest.webmanifest", (_req, res) => {
            res.setHeader("Content-Type", "application/manifest+json")
            res.end(webManifest(atlasConfig))
          })
        },
      },
      {
        name: "atlas-assets",
        apply: "build",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "routes.json",
            source: JSON.stringify(ROUTES.map((r) => r.path)),
          })
          this.emitFile({
            type: "asset",
            fileName: "manifest.webmanifest",
            source: webManifest(atlasConfig),
          })
        },
      },
      VitePWA({
        registerType: "autoUpdate",
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,woff,woff2}"],
          // Keeps the Mol* chunk out of the precache, so it downloads on first use not on install
          globIgnores: ["**/MolstarViewer-*.js"],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "shell", networkTimeoutSeconds: 3 },
            },
            {
              urlPattern: ({ url }) => url.pathname === "/manifest.webmanifest",
              handler: "NetworkFirst",
              options: { cacheName: "shell", networkTimeoutSeconds: 3 },
            },
            {
              urlPattern: ({ url }) => /\/assets\/MolstarViewer-.*\.js$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "molstar-viewer",
                expiration: { maxEntries: 2 },
              },
            },
            {
              // Bypass the service worker for byte-range responses
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/api/") &&
                !url.pathname.includes("/models/") &&
                !url.pathname.includes("/browser/coverage/"),
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
          // Allow parallel checkouts to use separate API servers
          target: process.env.ATLAS_API || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  }
})
