// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Typography } from "@mui/material"
import InfoTooltip from "@/components/InfoTooltip"
import type { TopologyMode } from "./useTopologyState"

const Para = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="caption" component="p">
    {children}
  </Typography>
)

export default function TopologyGuide({ mode }: { mode: TopologyMode | "features" }) {
  if (mode === "features") {
    return (
      <InfoTooltip label="How to read the sequence figure">
        <Para>
          The horizontal axis shows residue positions from the N-terminus to the C-terminus. The
          gray bar represents the protein chain.
        </Para>
        <Para>
          Filled circles mark glycosylation sites. Hollow circles mark cysteines involved in
          disulfide bonds. A colored block on the chain marks the signal peptide.
        </Para>
        <Para>
          Each Binds row shows one ligand-binding site. Its colored blocks mark the residues that
          contact that ligand. The Confidence row shows AlphaFold confidence along the sequence.
        </Para>
        <Para>
          Hover over a feature to highlight the same residues in the 3D model. Click it to center
          those residues in the model.
        </Para>
      </InfoTooltip>
    )
  }

  return (
    <InfoTooltip label="How to read the topology diagram">
      {mode === "regions" ? (
        <>
          <Para>
            The horizontal axis shows residue positions from the N-terminus to the C-terminus. Solid
            blocks crossing the membrane are transmembrane helices. Shorter, pale blocks are
            intramembrane segments that do not cross the membrane.
          </Para>
          <Para>
            The connecting line is the protein chain. Loops are drawn on their annotated side of the
            membrane, and taller loops contain more residues. A dashed section has uncertain
            orientation because the available annotations conflict.
          </Para>
          <Para>
            Each Binds row shows one ligand-binding site. The Confidence row shows AlphaFold
            confidence along the sequence. Hover over either row for residue-level details.
          </Para>
          <Para>
            Hover over a helix, loop, or binding site to highlight the same residues in the 3D
            model. Click it to center those residues in the model.
          </Para>
        </>
      ) : (
        <>
          <Para>
            Each circle is one amino acid. Circles inside the membrane form transmembrane or
            intramembrane segments; the connecting circles form loops on either side.
          </Para>
          <Para>
            Fill color shows AlphaFold confidence. A colored ring marks a residue in a
            ligand-binding site. A broken outline marks a region whose membrane orientation is
            uncertain.
          </Para>
          <Para>
            Hover over a residue to highlight it in the 3D model. Click it to center that residue in
            the model.
          </Para>
        </>
      )}
    </InfoTooltip>
  )
}
