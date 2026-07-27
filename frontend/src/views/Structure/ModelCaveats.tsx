// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import LaunchIcon from "@mui/icons-material/Launch"
import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material"
import { molstarViewerUrl } from "@/utils/links"
import type { StructureRecord } from "@/types/structure"

interface Props {
  structure: StructureRecord
}

export default function ModelCaveats({ structure }: Props) {
  const accession = structure.uniprot_accession

  return (
    <Stack spacing={1.5}>
      <Alert severity="info" variant="outlined">
        <AlertTitle>How to read the predicted model</AlertTitle>
        <Typography variant="body2">
          AlphaFold returns a single static conformation. Transporters work by cycling between
          conformations, and the model has no membrane, lipids, substrate, or partner subunits.
          Treat it as one plausible state, not the structure. It is not validated for clinical use.
        </Typography>
      </Alert>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        {accession && (
          <Button
            size="small"
            variant="outlined"
            endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
            href={molstarViewerUrl(accession)}
            target="_blank"
            rel="noopener"
          >
            Open 3D viewer
          </Button>
        )}
        {structure.alphafill_page_url && (
          <Button
            size="small"
            variant="outlined"
            endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
            href={structure.alphafill_page_url}
            target="_blank"
            rel="noopener"
          >
            AlphaFill ligands
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
