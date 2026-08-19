// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { enumCodec, stringCodec, type ShareParamDescriptor } from "@/utils/shareCodecs"
import type { SortDirection, SortKey } from "./useGeneAnnotationState"

export const SEARCH_MIRROR_MS = 300

export const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

export const SEARCH_PARAM: ShareParamDescriptor<string> = {
  key: "q",
  codec: stringCodec,
  defaultValue: "",
}

export const SORT_PARAM: ShareParamDescriptor<SortKey> = {
  key: "sort",
  codec: enumCodec(["id", "symbol", "name", "position", "length", "category", "family"]),
  defaultValue: "symbol",
}

export const DIR_PARAM: ShareParamDescriptor<SortDirection> = {
  key: "dir",
  codec: enumCodec(["asc", "desc"]),
  defaultValue: "asc",
}

export const ROWS_PARAM: ShareParamDescriptor<number> = {
  key: "rows",
  codec: {
    parse: (raw) => {
      const value = Number(raw)
      return ROWS_PER_PAGE_OPTIONS.includes(value) ? value : undefined
    },
    format: String,
  },
  defaultValue: 50,
}
