// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export function formatRange(start: number, end: number): string {
  return `${start.toLocaleString()}–${end.toLocaleString()}`
}

export function formatPosition(chromosome: string, start: number, end: number): string {
  return `chr${chromosome}:${formatRange(start, end)}`
}

export function formatTpm(value: number): string {
  return value < 10 ? value.toFixed(2) : value.toFixed(1)
}

// Shorter form for axis and legend ticks, where the column is narrow
export function formatTpmCompact(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString()
  if (value >= 10) return value.toFixed(0)
  return value.toFixed(1)
}
