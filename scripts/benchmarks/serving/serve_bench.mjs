// Measure response sizes and throughput for each serving endpoint
import autocannon from 'autocannon'
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]
}))
const base = args.base
const mode = args.mode || 'unknown'
const out = resolve(__dir, args.out || '../results/serving.jsonl')
const connections = Number(args.connections || 10)
const duration = Number(args.duration || 8)
const warmup = Number(args.warmup || 3)
const label = args.label || mode
const endpoints = JSON.parse(readFileSync(resolve(__dir, 'endpoints.json'), 'utf8')).endpoints
mkdirSync(dirname(out), { recursive: true })

async function bodySizes(url) {
  const idn = await fetch(url, { headers: { 'accept-encoding': 'identity' } })
  const idBuf = Buffer.from(await idn.arrayBuffer())
  let gz = null
  try {
    const g = await fetch(url, { headers: { 'accept-encoding': 'gzip' } })
    const enc = g.headers.get('content-encoding')
    const cl = g.headers.get('content-length')
    gz = enc === 'gzip' && cl ? Number(cl) : null
  } catch {}
  return { status: idn.status, identity_bytes: idBuf.length, gzip_bytes: gz }
}

async function run(url, conns, dur) {
  const r = await autocannon({ url, connections: conns, duration: dur, pipelining: 1 })
  return {
    rps_mean: r.requests.mean, rps_p50: r.requests.p50,
    lat_mean: r.latency.mean, lat_p50: r.latency.p50, lat_p90: r.latency.p90, lat_p99: r.latency.p99,
    throughput_bytes_mean: r.throughput.mean, non2xx: r.non2xx, errors: r.errors, timeouts: r.timeouts
  }
}

for (const ep of endpoints) {
  const url = base + ep.path
  process.stderr.write(`[${label}] ${ep.key} ${ep.path} ... `)
  const sizes = await bodySizes(url)
  if (sizes.status !== 200) { process.stderr.write(`SKIP status=${sizes.status}\n`); continue }
  await autocannon({ url, connections: 5, duration: warmup, pipelining: 1 })
  const c1 = await run(url, 1, Math.max(5, Math.round(duration * 0.75)))
  const cN = await run(url, connections, duration)
  const row = { mode, label, key: ep.key, path: ep.path, weight: ep.weight,
                identity_bytes: sizes.identity_bytes, gzip_bytes: sizes.gzip_bytes,
                c1, [`c${connections}`]: cN, connections, duration }
  appendFileSync(out, JSON.stringify(row) + '\n')
  process.stderr.write(`size=${(sizes.identity_bytes/1024).toFixed(1)}KB c1_p50=${c1.lat_p50}ms cN_rps=${Math.round(cN.rps_mean)}\n`)
}
process.stderr.write(`[${label}] done -> ${out}\n`)
