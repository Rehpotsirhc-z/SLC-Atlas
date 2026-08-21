// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useDeferredValue } from "react"

export function useDeferredReady(): boolean {
  return useDeferredValue(true, false)
}
