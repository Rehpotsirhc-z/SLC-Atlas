// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { createRequire } from "node:module"
import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { PRESETS, PRESET_NAMES } from "./presets.mjs"
import { buildShots, fileStem, VIEWS } from "./shots.mjs"
import { buildUrl, movePopupAside, seedStorage, waitReady } from "./drivers.mjs"

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, "../..")

// Resolve Playwright from the frontend installation
const { chromium } = createRequire(resolve(REPO_ROOT, "web", "package.json"))("playwright")
const NAV_TIMEOUT = 45000
const READY_TIMEOUT = 30000
const POPUP_VIEWS = new Set(["clustering", "conservation", "expression"])

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const opts = {
    url: null,
    gene: "SLC6A4",
    noGene: false,
    views: null,
    sizes: null,
    theme: "both",
    out: null,
    settle: 1500,
    headed: false,
    keepPopup: false,
  }
  const list = (prev, raw) => (prev ?? []).concat(raw.split(",").filter(Boolean))
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) fail(`${arg} needs a value`)
      return value
    }
    if (arg === "--url") opts.url = next()
    else if (arg === "--gene") opts.gene = next()
    else if (arg === "--no-gene") opts.noGene = true
    else if (arg === "--view" || arg === "--views") opts.views = list(opts.views, next())
    else if (arg === "--size" || arg === "--sizes") opts.sizes = list(opts.sizes, next())
    else if (arg === "--theme") opts.theme = next()
    else if (arg === "--out") opts.out = next()
    else if (arg === "--settle") opts.settle = Number(next())
    else if (arg === "--keep-popup") opts.keepPopup = true
    else if (arg === "--headed") opts.headed = true
    else if (arg === "--help" || arg === "-h") {
      console.log(HELP)
      process.exit(0)
    } else fail(`unknown argument: ${arg}`)
  }
  return opts
}

const HELP = `capture.mjs — atlas screenshot matrix

  node scripts/screenshots/capture.mjs --url https://host [options]

  --url URL          atlas URL (required)
  --gene ID          gene symbol or Ensembl ID to select (default SLC6A4)
  --no-gene          capture views without a selected gene
  --view NAME        limit to view(s): ${VIEWS.join(", ")}
  --size NAME        limit to preset(s): ${PRESET_NAMES.join(", ")}
  --theme MODE       light | dark | both (default both)
  --out DIR          output directory (default <repo>/screenshots/<gene-or-no-gene>)
  --settle MS        extra wait after each view is ready (default 1500)
  --keep-popup       leave the gene card where it opens
  --headed           run headed (default headless)`

function resolveThemes(theme) {
  if (theme === "both") return ["light", "dark"]
  if (theme === "light" || theme === "dark") return [theme]
  fail(`--theme must be light, dark, or both (got ${theme})`)
}

function resolveSizes(sizes) {
  const chosen = sizes ?? PRESET_NAMES
  for (const name of chosen) if (!PRESETS[name]) fail(`unknown size: ${name}`)
  return chosen
}

function resolveViews(views) {
  if (!views) return null
  for (const name of views) if (!VIEWS.includes(name)) fail(`unknown view: ${name}`)
  return new Set(views)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.url) fail("--url is required")
  if (!Number.isFinite(opts.settle) || opts.settle < 0) fail("--settle must be a number")

  const gene = opts.noGene ? null : opts.gene
  const themes = resolveThemes(opts.theme)
  const sizes = resolveSizes(opts.sizes)
  const viewFilter = resolveViews(opts.views)
  const outDir = opts.out
    ? resolve(process.cwd(), opts.out)
    : resolve(REPO_ROOT, "screenshots", gene ?? "no-gene")

  let shots = buildShots(gene)
  if (viewFilter) shots = shots.filter((s) => viewFilter.has(s.view))
  if (!shots.length) fail("no shots match the selected views")

  await mkdir(outDir, { recursive: true })
  console.log(`atlas screenshots → ${outDir}`)
  console.log(`  url ${opts.url}  gene ${gene ?? "(none)"}`)
  console.log(`  sizes ${sizes.join(", ")}  themes ${themes.join(", ")}  shots ${shots.length}`)

  const browser = await chromium.launch({ headless: !opts.headed })
  let done = 0
  let failed = 0
  let skipped = 0
  try {
    for (const size of sizes) {
      const preset = PRESETS[size]
      for (const theme of themes) {
        for (const shot of shots) {
          const stem = fileStem(shot, size, theme)
          const path = resolve(outDir, `${stem}.png`)
          const context = await browser.newContext({
            viewport: { width: preset.width, height: preset.height },
            deviceScaleFactor: preset.deviceScaleFactor,
            isMobile: preset.isMobile,
            hasTouch: preset.hasTouch ?? preset.isMobile,
            colorScheme: theme,
          })
          try {
            await seedStorage(context, { themeMode: theme, anatomogramSex: shot.sex ?? "female" })
            const page = await context.newPage()
            await page.goto(buildUrl(opts.url, shot.route, shot.params), {
              waitUntil: "load",
              timeout: NAV_TIMEOUT,
            })
            const available = await waitReady(page, shot.view, {
              timeout: READY_TIMEOUT,
              settle: opts.settle,
            })
            if (!available) {
              console.warn(`  skip ${stem} (view not available for this dataset)`)
              skipped++
              continue
            }
            if (shot.post) await shot.post(page, { settle: opts.settle, timeout: READY_TIMEOUT })
            if (!opts.keepPopup && POPUP_VIEWS.has(shot.view)) await movePopupAside(page)
            await page.screenshot({ path, animations: "disabled" })
            done++
            console.log(`  ✓ ${stem}.png`)
          } catch (err) {
            failed++
            console.warn(`  ✗ ${stem}: ${err.message}`)
          } finally {
            await context.close()
          }
        }
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`done: ${done} written, ${skipped} skipped, ${failed} failed`)
  if (failed) process.exit(1)
}

main().catch((err) => fail(err.stack || err.message))
