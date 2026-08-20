// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

const GATE_TEXT = "Not available for this dataset"

export function buildUrl(base, route, params) {
  const url = new URL(route, base)
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

// Apply non-URL settings before the first paint
export async function seedStorage(context, { themeMode, anatomogramSex }) {
  await context.addInitScript(
    (seed) => {
      try {
        const KEY = "atlas-ui"
        const existing = JSON.parse(localStorage.getItem(KEY) || "{}")
        const state = { ...(existing.state || {}) }
        if (seed.themeMode) state.themeMode = seed.themeMode
        if (seed.anatomogramSex) state.anatomogramSex = seed.anatomogramSex
        localStorage.setItem(KEY, JSON.stringify({ state, version: 1 }))
      } catch {}
    },
    { themeMode, anatomogramSex },
  )
}

const READY = {
  genes: "[data-gene-id]",
  clustering: ".MuiPaper-root svg[width][height]",
  conservation: ".MuiPaper-root canvas",
  browser: ".MuiPaper-root canvas",
  expression: ".MuiPaper-root canvas",
  structure: '[data-testid="topology-column"] svg',
}

export async function waitReady(page, view, { timeout, settle }) {
  await page.waitForFunction(() => document.fonts.ready.then(() => true)).catch(() => {})
  const selector = READY[view]
  if (!selector) return true

  const available = await Promise.race([
    page
      .locator(selector)
      .first()
      .waitFor({ state: "visible", timeout })
      .then(() => true),
    page
      .getByText(GATE_TEXT)
      .first()
      .waitFor({ state: "visible", timeout })
      .then(() => false),
  ])
  if (!available) return false

  await page.waitForTimeout(settle)
  return true
}

// Bring the lazy GWAS lane into view
export async function scrollLanesToBottom(page, { settle }) {
  await page.evaluate(() => {
    const scrollers = Array.from(document.querySelectorAll("div")).filter((el) => {
      const s = getComputedStyle(el)
      return (
        (s.overflowY === "auto" || s.overflowY === "scroll") &&
        el.scrollHeight - el.clientHeight > 4
      )
    })
    scrollers.sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight))
    if (scrollers[0]) scrollers[0].scrollTop = scrollers[0].scrollHeight
  })
  await page.waitForTimeout(settle)
}

// Keep the selected gene while uncovering the visualization
export async function movePopupAside(page) {
  const panel = page
    .locator(".MuiPaper-root")
    .filter({ has: page.locator('button:not([aria-label]):has([data-testid="CloseIcon"])') })
    .first()
  if (!(await panel.count())) return
  const box = await panel.boundingBox()
  const vp = page.viewportSize()
  if (!box || !vp) return
  const margin = 40
  const grabX = box.x + box.width / 2
  const grabY = box.y + 8
  const dx = margin - box.x
  const dy = Math.max(margin, vp.height - box.height - margin) - box.y
  await page.mouse.move(grabX, grabY)
  await page.mouse.down()
  await page.mouse.move(grabX + dx, grabY + dy, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(200)
}

// Wait for the lazy Mol* viewer, including its metered-connection prompt
export async function awaitMolstar(page, { timeout }) {
  const load = page.locator('[data-testid="load-3d"]')
  if (await load.count()) await load.click({ timeout: 5000 })

  const canvas = page.locator('[data-testid="molstar-canvas"]')
  await canvas.waitFor({ state: "visible", timeout })
  await canvas.locator("..").getByRole("progressbar").waitFor({ state: "hidden", timeout })
  await page.waitForTimeout(500)
}
