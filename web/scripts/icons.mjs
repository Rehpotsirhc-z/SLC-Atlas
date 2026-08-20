// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { readFileSync, writeFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { Resvg } from "@resvg/resvg-js"

const LIGHT = "#4078f2"
const DARK = "#51afef"
const GROUND = "#282c34"

const DROP = 0.9
const FAVICON_FILL = 0.93
const OPAQUE_FILL = 0.74

const PUBLIC = new URL("../public/", import.meta.url)
const src = readFileSync(new URL("favicon.svg", PUBLIC), "utf8")
const glyph = src
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<style>[\s\S]*?<\/style>/, "")
  .replace(/<\/svg>\s*$/, "")

function alphaOf(buf, w, h) {
  let off = 8
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    if (buf.toString("ascii", off + 4, off + 8) === "IDAT")
      idat.push(buf.subarray(off + 8, off + 8 + len))
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = w * 4
  const out = new Uint8Array(w * h),
    prev = new Uint8Array(stride),
    cur = new Uint8Array(stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const f = raw[p++]
    for (let i = 0; i < stride; i++) {
      const x = raw[p + i],
        a = i >= 4 ? cur[i - 4] : 0,
        b = prev[i],
        c = i >= 4 ? prev[i - 4] : 0
      let v
      if (f === 0) v = x
      else if (f === 1) v = x + a
      else if (f === 2) v = x + b
      else if (f === 3) v = x + ((a + b) >> 1)
      else {
        const pp = a + b - c,
          pa = Math.abs(pp - a),
          pb = Math.abs(pp - b),
          pc = Math.abs(pp - c)
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      cur[i] = v & 0xff
    }
    p += stride
    for (let x = 0; x < w; x++) out[y * w + x] = cur[x * 4 + 3]
    prev.set(cur)
  }
  return out
}

// Use a fixed measurement window so repeated runs produce identical framing
const SC = 32
const box = [-8, -8, 80, 80]
const probe = new Resvg(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(" ")}">${glyph}</svg>`,
  { fitTo: { mode: "width", value: Math.round(box[2] * SC) }, background: "rgba(0,0,0,0)" },
).render()
const A = alphaOf(probe.asPng(), probe.width, probe.height),
  PW = probe.width
const ux = (px) => box[0] + px / SC
const uy = (py) => box[1] + py / SC

let x0 = Infinity,
  x1 = -Infinity,
  y0 = Infinity,
  y1 = -Infinity,
  sx = 0,
  sy = 0,
  mass = 0
for (let y = 0; y < probe.height; y++) {
  for (let x = 0; x < PW; x++) {
    if (A[y * PW + x] < 128) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
    sx += x
    sy += y
    mass++
  }
}
const INK = { x0: ux(x0), x1: ux(x1 + 1), y0: uy(y0), y1: uy(y1 + 1) }
if (x0 < SC || y0 < SC || x1 > PW - SC || y1 > probe.height - SC)
  throw new Error("the mark reaches the edge of the window it is measured through; widen `box`")
const WIDE = INK.x1 - INK.x0
const FRAME_CX = ux(sx / mass)
const FRAME_CY = (INK.y0 + INK.y1) / 2 - DROP
const MASS_CY = uy(sy / mass)

// Measure the final frame position so maskable icons remain inside circular crops
let reach = 0
for (let y = 0; y < probe.height; y++) {
  for (let x = 0; x < PW; x++) {
    if (A[y * PW + x] < 128) continue
    reach = Math.max(reach, Math.hypot(ux(x) - FRAME_CX, uy(y) - FRAME_CY))
  }
}

const boxAt = (fill) => {
  const side = WIDE / fill
  return [FRAME_CX - side / 2, FRAME_CY - side / 2, side, side].map(
    (n) => Math.round(n * 1e4) / 1e4,
  )
}
const framed = (fill, style, ground) => {
  const b = boxAt(fill)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.join(" ")}" role="img" aria-label="AtlasForge">` +
    style +
    (ground
      ? `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" fill="${ground}"/>`
      : "") +
    `${glyph}</svg>\n`
  )
}

const favicon = framed(
  FAVICON_FILL,
  `<style>svg{color:${LIGHT}}@media(prefers-color-scheme:dark){svg{color:${DARK}}}</style>`,
  null,
)
writeFileSync(new URL("favicon.svg", PUBLIC), favicon)

const icoPng = (size) =>
  new Resvg(framed(FAVICON_FILL, `<style>svg{color:${LIGHT}}</style>`, null), {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng()
const entries = [16, 32, 48].map((s) => ({ s, data: icoPng(s) }))
const dir = Buffer.alloc(6 + entries.length * 16)
dir.writeUInt16LE(1, 2)
dir.writeUInt16LE(entries.length, 4)
let at = dir.length
entries.forEach((e, i) => {
  const p = 6 + i * 16
  dir[p] = dir[p + 1] = e.s
  dir.writeUInt16LE(1, p + 4)
  dir.writeUInt16LE(32, p + 6)
  dir.writeUInt32LE(e.data.length, p + 8)
  dir.writeUInt32LE(at, p + 12)
  at += e.data.length
})
writeFileSync(new URL("favicon.ico", PUBLIC), Buffer.concat([dir, ...entries.map((e) => e.data)]))

// Keep maskable artwork inside the platform safe zone
const MASK_FILL = Math.min(OPAQUE_FILL, ((0.4 * WIDE) / reach) * 0.98)
const raster = (name, size, fill) => {
  const png = new Resvg(framed(fill, `<style>svg{color:${DARK}}</style>`, GROUND), {
    fitTo: { mode: "width", value: size },
    background: GROUND,
  })
    .render()
    .asPng()
  writeFileSync(new URL(name, PUBLIC), png)
  return png.length
}

const r3 = (n) => n.toFixed(3)
console.log(`ink x ${r3(INK.x0)}..${r3(INK.x1)}, y ${r3(INK.y0)}..${r3(INK.y1)}`)
console.log(
  `hung at x ${r3(FRAME_CX)} (ink box centre ${r3((INK.x0 + INK.x1) / 2)}), ` +
    `y ${r3(FRAME_CY)} (ink box centre ${r3((INK.y0 + INK.y1) / 2)}, ` +
    `full balance would be ${r3(MASS_CY)}, so DROP ${DROP} is ` +
    `${((DROP / ((INK.y0 + INK.y1) / 2 - MASS_CY)) * 100).toFixed(0)}% of the way)`,
)
console.log(
  `furthest ink from there ${r3(reach)}, so a circular crop clears at ${(MASK_FILL * 100).toFixed(1)}% fill`,
)
console.log(`favicon.svg              viewBox ${boxAt(FAVICON_FILL).join(" ")}`)
console.log(`favicon.ico              16, 32, 48 px`)
for (const [name, size, fill] of [
  ["apple-touch-icon.png", 180, OPAQUE_FILL],
  ["icon-192.png", 192, OPAQUE_FILL],
  ["icon-512.png", 512, OPAQUE_FILL],
  ["icon-maskable-512.png", 512, MASK_FILL],
]) {
  console.log(
    `${name.padEnd(24)} ${size}px, mark at ${(fill * 100) | 0}% of the width, ` +
      `${(raster(name, size, fill) / 1024).toFixed(1)} KB`,
  )
}
