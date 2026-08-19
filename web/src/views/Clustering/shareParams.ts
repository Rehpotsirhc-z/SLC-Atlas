// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { metricParam } from "@/store/shareArrival"
import { enumCodec, type ShareParamDescriptor } from "@/utils/shareCodecs"
import type { Layout } from "./phyloLayout"

export const CLUSTERING_METRIC = metricParam("metric", "aa")

export const LAYOUT_PARAM: ShareParamDescriptor<Layout> = {
  key: "layout",
  codec: enumCodec(["rectangular", "radial"]),
  defaultValue: "rectangular",
}
