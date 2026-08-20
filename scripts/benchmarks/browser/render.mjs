// Measure the time until a browser view becomes visually stable
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const a = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = s.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [s.replace(/^--/, ''), true]
}))
const { url, tool = 'tool', label = tool, bucket = null, locus = null } = a
const reps = Number(a.reps || 3), width = Number(a.width || 1280), height = Number(a.height || 800)
const stable = Number(a.stable || 1000), minMs = Number(a.min || 1500), timeout = Number(a.timeout || 45000)
const interval = Number(a.interval || 150)
const out = resolve(__dir, a.out || '../results/browser_render.jsonl')
mkdirSync(dirname(out), { recursive: true })
const hash = buf => createHash('md5').update(buf).digest('hex')

// Return the time from navigation to the last visual change
async function measure(page) {
  const navStart = Date.now()
  await page.goto(url, { waitUntil: 'commit', timeout }).catch(() => {})
  let prev = null, changes = 0, lastChange = navStart, done = false
  while (Date.now() - navStart < timeout) {
    let h
    try { h = hash(await page.screenshot({ animations: 'disabled' })) } catch { await page.waitForTimeout(interval); continue }
    if (h !== prev) { if (prev !== null) changes++; prev = h; lastChange = Date.now() }
    const elapsed = Date.now() - navStart
    if (changes >= 1 && elapsed >= minMs && Date.now() - lastChange >= stable) { done = true; break }
    await page.waitForTimeout(interval)
  }
  return { render_ms: lastChange - navStart, changes, done }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
for (let rep = 0; rep < reps; rep++) {
  // Reuse the context for the warm run to retain its cache
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  for (const phase of ['cold', 'warm']) {
    const m = await measure(page)
    const row = { tool, label, bucket, locus, phase, rep, ...m, url }
    appendFileSync(out, JSON.stringify(row) + '\n')
    process.stderr.write(`[${label}] ${bucket} ${phase} rep${rep} ${m.done ? 'ok' : 'TIMEOUT'} render=${m.render_ms}ms\n`)
  }
  await ctx.close()
}
await browser.close()
