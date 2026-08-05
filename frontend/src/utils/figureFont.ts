// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import monoRegular from "@fontsource/source-code-pro/files/source-code-pro-latin-400-normal.woff2?url"
import sansBold from "@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2?url"
import sansRegular from "@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?url"
import sansSemibold from "@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2?url"

const FACES = [
  { family: "Source Sans 3", weight: 400, url: sansRegular },
  { family: "Source Sans 3", weight: 600, url: sansSemibold },
  { family: "Source Sans 3", weight: 700, url: sansBold },
  { family: "Source Code Pro", weight: 400, url: monoRegular },
]

async function base64(url: string): Promise<string> {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function build(): Promise<string> {
  const rules = await Promise.all(
    FACES.map(async (face) => {
      const data = await base64(face.url)
      return (
        `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};` +
        `src:url("data:font/woff2;base64,${data}") format("woff2")}`
      )
    }),
  )
  return `<style>${rules.join("")}</style>`
}

let style: Promise<string> | null = null

export function figureFontStyle(): Promise<string> {
  style ??= build().catch(() => "")
  return style
}
