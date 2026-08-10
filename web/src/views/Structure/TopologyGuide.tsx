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
            The x axis is the residue number, so every mark sits at the residues it covers and a
            helix is as wide as it is long. The curve threading the figure is the protein chain,
            N-terminus at left. The solid cylinders in the membrane band are transmembrane helices,
            numbered in order; the paler, half-height cylinders sit inside the membrane without
            crossing it. Between cylinders the chain loops onto whichever side of the membrane
            UniProt puts that stretch on.
          </Para>
          <Para>
            Each row under Binds is one binding site; the blocks in it are the residues that touch
            the ligand named in the key below. The Confidence strip is AlphaFold&apos;s per-residue
            score, banded in the same four colours as the 3D model; hover it for the score at a
            residue.
          </Para>
          <Para>
            A loop rises with the number of residues in it, so two helices with none between them
            are joined by a flat line.
          </Para>
        </>
      ) : (
        <>
          <Para>
            Each block crossing the membrane band is a transmembrane helix with chain loops on
            whichever side UniProt puts that stretch on. A bead is filled with AlphaFold&apos;s
            confidence at that residue, and ringed in its ligand&apos;s colour where it lines a
            binding site.
          </Para>
          <Para>
            Hovering a bead lights that residue in the 3D model, and clicking one brings it into
            view there.
          </Para>
        </>
      )}
      <Para>
        {mode === "regions"
          ? "A dashed line is one where UniProt's own compartments cannot all be reached by alternating helices, so the helices in it may be flipped."
          : "A bead with a broken outline is one whose stretch UniProt's own compartments cannot reach by alternating helices, so the helices in it may be flipped, and one drawn turning back into the face it came from is a helix that stretch leaves on the side it entered."}
      </Para>
    </InfoTooltip>
  )
}
