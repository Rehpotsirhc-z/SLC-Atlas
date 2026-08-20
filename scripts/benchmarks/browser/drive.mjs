// Measure browser requests and transferred bytes for a selected resource
import { chromium } from 'playwright'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const a = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = s.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [s.replace(/^--/, ''), true]
}))
const url = a.url, match = a.match, tool = a.tool || 'tool', label = a.label || tool
const reps = Number(a.reps || 5), width = Number(a.width || 1280), height = Number(a.height || 800)
const settle = Number(a.settle || 2500), timeout = Number(a.timeout || 45000)
const minObserve = Number(a['min-observe'] || 3500)
const readyFlag = a['ready-flag'] || null
const extraMatch = a['extra-match'] || null
const out = resolve(__dir, a.out || '../results/browser.jsonl')
mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({ args: ['--no-sandbox'] })
for (let rep = 0; rep < reps; rep++) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  let navStart = null
  let trackBytes = 0, trackReqs = 0, trackFirst = null, trackLast = null
  let extraBytes = 0, extraReqs = 0, totalBytes = 0
  let lastActivity = Date.now()
  page.on('requestfinished', async req => {
    const u = req.url()
    const isTrack = u.includes(match)
    const isExtra = extraMatch && u.includes(extraMatch)
    let n = 0
    try { const r = await req.response(); const cl = r && r.headers()['content-length']; n = cl ? Number(cl) : 0 } catch {}
    totalBytes += n
    if (isTrack) {
      trackBytes += n; trackReqs++; lastActivity = Date.now()
      if (trackFirst === null) trackFirst = Date.now(); trackLast = Date.now()
    }
    if (isExtra) { extraBytes += n; extraReqs++; lastActivity = Date.now() }
  })
  navStart = Date.now()
  await page.goto(url, { waitUntil: 'commit', timeout }).catch(() => {})
  const navDone = Date.now()
  let done = false
  while (Date.now() - navStart < timeout) {
    await page.waitForTimeout(200)
    const flagOk = !readyFlag || (await page.evaluate(f => window[f] === true, readyFlag).catch(() => false))
    const observed = Date.now() - navDone >= minObserve
    const idle = Date.now() - lastActivity >= settle
    if (trackReqs > 0 && observed && idle && flagOk) { done = true; break }
  }
  await page.waitForTimeout(700)
  const err = await page.evaluate(() => window.__err || null).catch(() => null)
  const row = { tool, label, bucket: a.bucket || null, locus: a.locus || null, match, rep, done, err,
                track_bytes: trackBytes, track_requests: trackReqs,
                fetch_ms: (trackFirst !== null && trackLast !== null) ? (trackLast - trackFirst) : null,
                total_ms: (trackLast !== null) ? (trackLast - navStart) : null,
                extra_match: extraMatch, extra_bytes: extraBytes, extra_requests: extraReqs,
                page_total_bytes: totalBytes, url }
  appendFileSync(out, JSON.stringify(row) + '\n')
  process.stderr.write(`[${label}] rep${rep} ${done ? 'ok' : 'TIMEOUT'} bytes=${(trackBytes / 1024).toFixed(1)}KB reqs=${trackReqs} fetch=${row.fetch_ms}ms${err ? ' ERR=' + err : ''}\n`)
  await ctx.close()
}
await browser.close()
