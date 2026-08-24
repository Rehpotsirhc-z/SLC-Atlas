// Measure the time until a browser view becomes visually stable
import { chromium } from "playwright"
import { createHash } from "node:crypto"
import { appendFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dir = dirname(fileURLToPath(import.meta.url))
const a = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const m = s.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [s.replace(/^--/, ""), true]
  }),
)
const { url, tool = "tool", label = tool, bucket = null, locus = null } = a
const reps = Number(a.reps || 3),
  width = Number(a.width || 1280),
  height = Number(a.height || 800)
const stable = Number(a.stable || 1000),
  minMs = Number(a.min || 1500),
  timeout = Number(a.timeout || 45000)
const interval = Number(a.interval || 150)
const out = resolve(__dir, a.out || "../results/browser_render.jsonl")
const saveFrames = a["save-frames"] ? resolve(a["save-frames"]) : null
const saveStill = a["save-still"] ? resolve(a["save-still"]) : null
const hash = (buf) => createHash("md5").update(buf).digest("hex")
const pad = (n) => String(n).padStart(4, "0")

// Measure from navigation to the final visual change
async function measure(page, captureDir) {
  const navStart = Date.now()
  await page.goto(url, { waitUntil: "commit", timeout }).catch(() => {})
  let prev = null,
    changes = 0,
    lastChange = navStart,
    done = false,
    i = 0
  const frames = []
  while (Date.now() - navStart < timeout) {
    const t = Date.now() - navStart
    let buf
    try {
      buf = await page.screenshot({ animations: "disabled" })
    } catch {
      await page.waitForTimeout(interval)
      continue
    }
    const h = hash(buf)
    if (h !== prev) {
      if (prev !== null) changes++
      prev = h
      lastChange = Date.now()
    }
    if (captureDir) {
      writeFileSync(join(captureDir, `frame_${pad(i)}.png`), buf)
      frames.push({ i, elapsed_ms: t })
      i++
    }
    const elapsed = Date.now() - navStart
    if (changes >= 1 && elapsed >= minMs && Date.now() - lastChange >= stable) {
      done = true
      break
    }
    await page.waitForTimeout(interval)
  }
  return { render_ms: lastChange - navStart, changes, done, frames }
}

const browser = await chromium.launch({ args: ["--no-sandbox"] })

if (saveFrames || saveStill) {
  if (saveFrames) {
    rmSync(saveFrames, { recursive: true, force: true })
    mkdirSync(saveFrames, { recursive: true })
  }
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  const m = await measure(page, saveFrames)
  if (saveFrames)
    writeFileSync(
      join(saveFrames, "manifest.json"),
      JSON.stringify({ tool, label, url, width, height, frames: m.frames }, null, 2),
    )
  if (saveStill) {
    mkdirSync(dirname(saveStill), { recursive: true })
    await page.screenshot({
      path: saveStill,
      fullPage: true,
      animations: "disabled",
    })
  }
  process.stderr.write(
    `[${label}] capture ${m.frames.length} frames, ${m.changes} changes, ${m.render_ms}ms${saveStill ? " + still" : ""}\n`,
  )
  await ctx.close()
} else {
  mkdirSync(dirname(out), { recursive: true })
  for (let rep = 0; rep < reps; rep++) {
    // Reuse the context for the warm run to retain its cache
    const ctx = await browser.newContext({ viewport: { width, height } })
    const page = await ctx.newPage()
    for (const phase of ["cold", "warm"]) {
      const m = await measure(page)
      const row = {
        tool,
        label,
        bucket,
        locus,
        phase,
        rep,
        render_ms: m.render_ms,
        changes: m.changes,
        done: m.done,
        url,
      }
      appendFileSync(out, JSON.stringify(row) + "\n")
      process.stderr.write(
        `[${label}] ${bucket} ${phase} rep${rep} ${m.done ? "ok" : "TIMEOUT"} render=${m.render_ms}ms\n`,
      )
    }
    await ctx.close()
  }
}
await browser.close()
