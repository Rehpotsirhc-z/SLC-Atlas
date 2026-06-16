// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export function formatRange(start: number, end: number): string {
  return `${start.toLocaleString()}–${end.toLocaleString()}`
}

export function formatPosition(chromosome: string, start: number, end: number): string {
  return `chr${chromosome}:${formatRange(start, end)}`
}
