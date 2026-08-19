// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface ParamCodec<T> {
  // Malformed values return undefined and are ignored
  parse: (raw: string) => T | undefined
  format: (value: T) => string
}

export interface ShareParamDescriptor<T> {
  key: string
  codec: ParamCodec<T>
  defaultValue: T
  // Default values are omitted from the URL
  isDefault?: (value: T) => boolean
}

export const paramIsDefault = <T>(d: ShareParamDescriptor<T>, value: T): boolean =>
  d.isDefault ? d.isDefault(value) : Object.is(value, d.defaultValue)

export function enumCodec<T extends string>(values: readonly T[]): ParamCodec<T> {
  return {
    parse: (raw) => (values.includes(raw as T) ? (raw as T) : undefined),
    format: (value) => value,
  }
}

export function intCodec(min: number, max: number): ParamCodec<number> {
  return {
    parse: (raw) => {
      const value = Number(raw)
      if (!Number.isInteger(value) || value < min || value > max) return undefined
      return value
    },
    format: (value) => String(Math.round(value)),
  }
}

export const floatCodec: ParamCodec<number> = {
  parse: (raw) => {
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : undefined
  },
  format: (value) => String(value),
}

export const boolCodec: ParamCodec<boolean> = {
  parse: (raw) => (raw === "1" ? true : raw === "0" ? false : undefined),
  format: (value) => (value ? "1" : "0"),
}

export const stringCodec: ParamCodec<string> = {
  parse: (raw) => raw,
  format: (value) => value,
}

export const nullableStringCodec: ParamCodec<string | null> = {
  parse: (raw) => (raw === "" ? undefined : raw),
  format: (value) => value ?? "",
}

export const listCodec: ParamCodec<string[]> = {
  parse: (raw) => raw.split(",").filter(Boolean),
  format: (value) => value.join(","),
}
