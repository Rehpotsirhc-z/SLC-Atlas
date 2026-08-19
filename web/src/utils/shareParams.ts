// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { boolCodec, nullableStringCodec, type ShareParamDescriptor } from "./shareCodecs"

export const FAMILY_PARAM: ShareParamDescriptor<string | null> = {
  key: "family",
  codec: nullableStringCodec,
  defaultValue: null,
}

export const GENETREE_PARAM: ShareParamDescriptor<boolean> = {
  key: "genetree",
  codec: boolCodec,
  defaultValue: true,
}
