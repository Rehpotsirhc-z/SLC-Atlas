// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react"

interface NetworkInformation extends EventTarget {
  saveData: boolean
  effectiveType: "slow-2g" | "2g" | "3g" | "4g"
}

function readSlow(connection: NetworkInformation | undefined): boolean {
  return connection ? connection.saveData || connection.effectiveType !== "4g" : false
}

// The Network Information API is Chromium-only; Safari and Firefox always read as fast since
// there is no signal to defer on
export function useSlowConnection(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  const [slow, setSlow] = useState(() => readSlow(connection))

  useEffect(() => {
    if (!connection) return
    const update = () => setSlow(readSlow(connection))
    connection.addEventListener("change", update)
    return () => connection.removeEventListener("change", update)
  }, [connection])

  return slow
}
