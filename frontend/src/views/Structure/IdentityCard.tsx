// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import { Alert, Box, Button, Link, Stack, Typography, useTheme } from "@mui/material"
import FamilyLabel from "@/components/FamilyLabel"
import { getFamilyColor } from "@/utils/familyColor"
import { alphafoldUrl, ensemblUrl, pdbeUrl, ucscUrl, uniprotUrl } from "@/utils/links"
import { RESOLUTION_DECIMALS } from "./constants"
import type { Gene } from "@/types/gene"
import type { StructureRecord } from "@/types/structure"

interface Props {
  structure: StructureRecord
  gene: Gene | null
}

const METHOD_LABEL: Record<string, string> = {
  "ELECTRON MICROSCOPY": "cryo-EM",
  "X-RAY DIFFRACTION": "X-ray",
  "SOLUTION NMR": "NMR",
}

const SEQ_AGREEMENT_DETAIL: Record<string, string> = {
  isoform: "matches an Ensembl isoform rather than the canonical one used elsewhere in the atlas",
  differs: "differs from the Ensembl sequence used elsewhere in the atlas",
  unknown: "could not be compared with the Ensembl sequence used elsewhere in the atlas",
}

function ExternalLink({ label, href }: { label: string; href: string }) {
  return (
    <Button
      size="small"
      variant="text"
      startIcon={<OpenInNewIcon />}
      component="a"
      href={href}
      target="_blank"
      rel="noopener"
    >
      {label}
    </Button>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  )
}

export default function IdentityCard({ structure, gene }: Props) {
  const { palette } = useTheme()
  const family = gene?.family ?? null
  const accession = structure.uniprot_accession

  const bestExperimental = [
    structure.best_pdb_id?.toUpperCase(),
    structure.best_resolution != null &&
      `${structure.best_resolution.toFixed(RESOLUTION_DECIMALS)} Å`,
    structure.best_method && METHOD_LABEL[structure.best_method],
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexWrap: "wrap" }}>
        <Typography variant="h6" fontWeight={700}>
          {structure.symbol ?? structure.gene_id}
        </Typography>
        {structure.uniprot_id && (
          <Typography variant="body2" color="text.secondary">
            {structure.uniprot_id}
          </Typography>
        )}
        {family && (
          <FamilyLabel
            label={family}
            color={getFamilyColor(family, palette.mode)}
            familyName={gene?.family_name}
            category={gene?.category}
          />
        )}
      </Stack>

      {gene?.name && (
        <Typography variant="body2" color="text.secondary">
          {gene.name}
        </Typography>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        }}
      >
        <Stat
          label="UniProt"
          value={
            accession ? (
              <Link href={uniprotUrl(accession)} target="_blank" rel="noopener">
                {accession}
              </Link>
            ) : (
              "unmapped"
            )
          }
        />
        <Stat label="Length" value={`${structure.uniprot_length ?? "?"} aa`} />
        <Stat
          label="TM helices"
          value={
            structure.n_intramembrane > 0
              ? `${structure.n_transmembrane} · ${structure.n_intramembrane} intramembrane`
              : structure.n_transmembrane
          }
        />
        <Stat
          label="Binding sites"
          value={
            structure.n_binding_sites > 0
              ? `${structure.n_binding_sites} · ${structure.n_binding_residues} residues`
              : "none annotated"
          }
        />
        <Stat
          label="Mean pLDDT"
          value={structure.mean_plddt != null ? structure.mean_plddt.toFixed(1) : "n/a"}
        />
        <Stat
          label="Best experimental"
          value={
            structure.best_pdb_id ? (
              <Link href={pdbeUrl(structure.best_pdb_id)} target="_blank" rel="noopener">
                {bestExperimental}
              </Link>
            ) : (
              "none solved"
            )
          }
        />
      </Box>

      {structure.seq_agreement && structure.seq_agreement !== "exact" && (
        <Alert severity="warning" variant="outlined">
          <Typography variant="body2">
            {`UniProt's sequence for this protein ${SEQ_AGREEMENT_DETAIL[structure.seq_agreement]}, so the residue numbers below will not line up with the Clustering view.`}
          </Typography>
        </Alert>
      )}

      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
        {accession && <ExternalLink label="AlphaFold DB" href={alphafoldUrl(accession)} />}
        <ExternalLink label="Ensembl" href={ensemblUrl(structure.gene_id)} />
        {gene && <ExternalLink label="UCSC" href={ucscUrl(gene)} />}
      </Stack>
    </Stack>
  )
}
