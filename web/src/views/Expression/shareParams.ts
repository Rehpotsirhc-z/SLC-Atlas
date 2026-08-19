// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { metricParam, tissueParam } from "@/store/shareArrival"

export const EXPRESSION_ORDER = metricParam("order", "rna")

// Expression tissue always controls the matrix, regardless of the ordering metric
export const EXPRESSION_TISSUE = tissueParam("tissue")
