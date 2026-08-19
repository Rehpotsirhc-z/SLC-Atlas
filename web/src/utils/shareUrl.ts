// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Track shareable state and batch updates to the address bar
// Initial query parameters remain available until navigation so late views can read them

let arrivalParams: URLSearchParams | null = null
let arrivalPathname = ""
let navigated = false

// Seed live parameters from the initial URL so early updates preserve unread values
const params = new Map<string, string>()
const claimed = new Set<string>()
let flushQueued = false

// Leave locus and list separators readable in shared URLs
const encodeValue = (value: string) =>
  encodeURIComponent(value).replace(/%3A/gi, ":").replace(/%2C/gi, ",")

function flush() {
  flushQueued = false
  const parts: string[] = []
  for (const [key, value] of params) parts.push(`${key}=${encodeValue(value)}`)
  const query = parts.length ? `?${parts.join("&")}` : ""
  const { pathname, hash } = window.location
  window.history.replaceState(null, "", pathname + query + hash)
}

function schedule() {
  if (flushQueued) return
  flushQueued = true
  queueMicrotask(flush)
}

export function captureArrival() {
  arrivalPathname = window.location.pathname
  arrivalParams = new URLSearchParams(window.location.search)
  for (const [key, value] of arrivalParams) params.set(key, value)
}

const arrivalStands = () =>
  arrivalParams !== null && !navigated && window.location.pathname === arrivalPathname

export function arrivalParam(key: string): string | undefined {
  if (!arrivalStands()) return undefined
  return arrivalParams?.get(key) ?? undefined
}

export function arrivalHasAny(keys: readonly string[]): boolean {
  if (!arrivalStands()) return false
  return keys.some((key) => arrivalParams?.has(key))
}

// Restore registered parameters after the router drops the query string during navigation
// The first navigation also removes invalid or unused initial parameters
export function markNavigated() {
  if (!navigated) {
    navigated = true
    for (const key of params.keys()) if (!claimed.has(key)) params.delete(key)
  }
  schedule()
}

export function setShareParam(key: string, value: string) {
  claimed.add(key)
  if (params.get(key) === value) return
  params.set(key, value)
  schedule()
}

export function clearShareParam(key: string) {
  claimed.add(key)
  if (!params.has(key)) return
  params.delete(key)
  schedule()
}

// Delay browser locus restoration until the global gene selection is ready
let geneSettled = false
const geneListeners = new Set<() => void>()

export function settleGeneArrival() {
  if (geneSettled) return
  geneSettled = true
  for (const listener of geneListeners) listener()
}

export const geneArrivalSettled = () => geneSettled

export function subscribeGeneArrival(listener: () => void): () => void {
  geneListeners.add(listener)
  return () => {
    geneListeners.delete(listener)
  }
}
