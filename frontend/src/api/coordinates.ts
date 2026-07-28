// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export async function fetchCoordinates(urls: string[]): Promise<ArrayBuffer> {
  for (const url of urls) {
    const res = await fetch(url)
    if (res.ok) return await res.arrayBuffer()
  }
  throw new Error(`No coordinates at ${urls.join(" or ")}`)
}
