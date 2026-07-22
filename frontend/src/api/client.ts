// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

const BASE = "/api"

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res
}

export const api = {
  get: async <T>(path: string): Promise<T> => (await request(path)).json() as Promise<T>,
  getText: async (path: string): Promise<string> => (await request(path)).text(),
}
