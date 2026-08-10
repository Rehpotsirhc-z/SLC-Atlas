// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export type CoordinateSource = string | (() => Promise<string | null>)

export async function fetchCoordinates(sources: CoordinateSource[]): Promise<ArrayBuffer> {
  const tried: string[] = []
  for (const source of sources) {
    try {
      const url = typeof source === "string" ? source : await source()
      if (!url) continue
      tried.push(url)
      const res = await fetch(url)
      if (res.ok) return await res.arrayBuffer()
    } catch {
      // Cross-origin and offline failures reject instead of returning a response
    }
  }
  throw new Error(`No coordinates at ${tried.join(" or ")}`)
}
