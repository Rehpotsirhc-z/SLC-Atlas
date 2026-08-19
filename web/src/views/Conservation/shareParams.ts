// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { metricParam } from "@/store/shareArrival"
import type { CellMetricKey } from "@/types/conservation"
import { boolCodec, type ShareParamDescriptor } from "@/utils/shareCodecs"

export const CONSERVATION_ORDER = metricParam("order", "ortho")

// Use readable URL values instead of internal column names
export const CELL_PARAM: ShareParamDescriptor<CellMetricKey> = {
  key: "cell",
  codec: {
    parse: (raw) => (raw === "identity" ? "perc_id" : raw === "positives" ? "perc_pos" : undefined),
    format: (value) => (value === "perc_id" ? "identity" : "positives"),
  },
  defaultValue: "perc_id",
}

export const SPECIESTREE_PARAM: ShareParamDescriptor<boolean> = {
  key: "speciestree",
  codec: boolCodec,
  defaultValue: true,
}
