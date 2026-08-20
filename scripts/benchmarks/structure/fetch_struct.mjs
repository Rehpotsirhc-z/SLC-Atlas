// Compare local and remote structure-file transfers
import { appendFileSync, mkdirSync } from 'node:fs'

const OUT = '/workspace/scripts/benchmarks/results/structure.jsonl'
mkdirSync('/workspace/scripts/benchmarks/results', { recursive: true })
const REPS = Number(process.env.REPS || 5)
const LOCAL = process.env.LOCAL_BASE || 'http://127.0.0.1:8080'

async function afBcifUrl(acc) {
  try {
    const r = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${acc}`)
    const j = await r.json()
    const u = j[0]?.bcifUrl || j[0]?.cifUrl
    if (u) return u
  } catch {}
  return `https://alphafold.ebi.ac.uk/files/AF-${acc}-F1-model_v6.bcif`
}

async function timedGet(url) {
  const t0 = performance.now()
  const r = await fetch(url, { cache: 'no-store' })
  const buf = Buffer.from(await r.arrayBuffer())
  const ms = performance.now() - t0
  return { status: r.status, bytes: buf.length, ms }
}

async function measure(label, place, url, reps) {
  const runs = []
  for (let i = 0; i < reps; i++) {
    try { runs.push(await timedGet(url)) }
    catch (e) { runs.push({ status: 0, bytes: 0, ms: null, err: String(e) }) }
  }
  const ok = runs.filter(r => r.status === 200 && r.ms !== null)
  const times = ok.map(r => r.ms).sort((a, b) => a - b)
  const median = times.length ? times[Math.floor(times.length / 2)] : null
  const row = { label, place, url, reps, status: runs[0].status,
                bytes: ok[0]?.bytes ?? 0, median_ms: median === null ? null : Math.round(median),
                min_ms: times.length ? Math.round(times[0]) : null,
                max_ms: times.length ? Math.round(times[times.length - 1]) : null,
                err: runs.find(r => r.err)?.err || null }
  appendFileSync(OUT, JSON.stringify(row) + '\n')
  process.stderr.write(`[${label}/${place}] ${(row.bytes / 1024).toFixed(0)}KB median=${row.median_ms}ms (min ${row.min_ms}, max ${row.max_ms})${row.err ? ' ERR=' + row.err : ''}\n`)
  return row
}

const acc = 'Q8WV83'
await measure('predicted (Q8WV83)', 'local', `${LOCAL}/api/structure/models/${acc}.bcif`, REPS)
try {
  const afUrl = await afBcifUrl(acc)
  process.stderr.write(`  AlphaFold bcifUrl = ${afUrl}\n`)
  await measure('predicted (Q8WV83)', 'remote', afUrl, REPS)
} catch (e) { process.stderr.write(`  AlphaFold resolve failed: ${e}\n`) }

const pdb = '12oy'
await measure(`experimental (${pdb})`, 'local', `${LOCAL}/api/structure/models/pdb/${pdb}.bcif`, REPS)
await measure(`experimental (${pdb})`, 'remote', `https://models.rcsb.org/${pdb}.bcif`, REPS)

process.stderr.write(`done -> ${OUT}\n`)
