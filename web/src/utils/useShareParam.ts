// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react"
import { paramIsDefault, type ShareParamDescriptor } from "./shareCodecs"
import { arrivalParam, clearShareParam, setShareParam } from "./shareUrl"

export function readArrival<T>(d: ShareParamDescriptor<T>): T {
  const raw = arrivalParam(d.key)
  if (raw !== undefined) {
    const parsed = d.codec.parse(raw)
    if (parsed !== undefined) return parsed
  }
  return d.defaultValue
}

interface MirrorOptions {
  mirrorDebounceMs?: number
}

export function useShareMirror<T>(d: ShareParamDescriptor<T>, value: T, opts?: MirrorOptions) {
  const debounce = opts?.mirrorDebounceMs
  useEffect(() => {
    const write = () => {
      if (paramIsDefault(d, value)) clearShareParam(d.key)
      else setShareParam(d.key, d.codec.format(value))
    }
    if (!debounce) {
      write()
      return
    }
    const timer = window.setTimeout(write, debounce)
    return () => clearTimeout(timer)
  }, [d, value, debounce])

  // Remove view-specific parameters when their owner unmounts
  useEffect(() => () => clearShareParam(d.key), [d.key])
}

export function useShareParam<T>(
  d: ShareParamDescriptor<T>,
  opts?: MirrorOptions,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readArrival(d))
  useShareMirror(d, value, opts)
  return [value, setValue]
}
