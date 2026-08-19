// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { enumCodec, nullableStringCodec, type ShareParamDescriptor } from "@/utils/shareCodecs"
import type { TopologyMode } from "./useTopologyState"

// Omitting pdb selects the AlphaFold model available for every gene
export const PDB_PARAM: ShareParamDescriptor<string | null> = {
  key: "pdb",
  codec: nullableStringCodec,
  defaultValue: null,
}

export const TOPO_PARAM: ShareParamDescriptor<TopologyMode> = {
  key: "topo",
  codec: enumCodec(["regions", "residues"]),
  defaultValue: "regions",
}
