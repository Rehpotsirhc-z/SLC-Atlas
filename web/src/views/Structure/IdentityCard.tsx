// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import { Alert, Box, Button, Link, Stack, Typography, useTheme } from "@mui/material"
import FamilyLabel from "@/components/FamilyLabel"
import { capBoxSx } from "@/theme"
import { getFamilyColor } from "@/utils/familyColor"
import { alphafoldUrl, ensemblUrl, pdbeUrl, ucscUrl, uniprotUrl } from "@/utils/links"
import {
  IDENTITY_GRID_COLUMNS,
  IDENTITY_SECONDARY_EM,
  LINK_ROW_GAP,
  LINK_ROW_INK_INSET,
  LINK_ROW_WRAPPED_COLUMNS,
} from "./constants"
import { methodLabel, resolutionLabel } from "./experimentalEntry"
import type { MarkKind } from "./sequenceFeatures"
import { useRowFits } from "./useRowFits"
import type { Gene } from "@/types/gene"
import type { StructureRecord } from "@/types/structure"

interface Props {
  structure: StructureRecord
  gene: Gene | null
  hasMembrane: boolean
  marks: { kind: MarkKind; count: number }[]
  signal: boolean
}

const SEQ_AGREEMENT_DETAIL: Record<string, string> = {
  isoform: "matches an Ensembl isoform rather than the canonical one used elsewhere in the atlas",
  differs: "differs from the Ensembl sequence used elsewhere in the atlas",
  unknown: "could not be compared with the Ensembl sequence used elsewhere in the atlas",
}

interface LinkOut {
  label: string
  href: string
}

function ExternalLink({ label, href }: LinkOut) {
  return (
    <Button
      size="small"
      variant="text"
      startIcon={<OpenInNewIcon />}
      component="a"
      href={href}
      target="_blank"
      rel="noopener"
      sx={{
        p: 0.75,
        minWidth: 0,
        lineHeight: 1,
        justifyContent: "flex-start",
        "& .MuiButton-startIcon": { ml: 0 },
      }}
    >
      <Box component="span" sx={capBoxSx}>
        {label}
      </Box>
    </Button>
  )
}

const MARK_LABELS: Record<MarkKind, string> = {
  glycosylation: "glycosylation",
  disulfide_bond: "disulfide",
}

function markSummary(marks: { kind: MarkKind; count: number }[], signal: boolean): string {
  const parts = marks.map(({ kind, count }) => `${count} ${MARK_LABELS[kind]}`)
  if (signal) parts.push("signal peptide")
  return parts.join(" · ") || "none annotated"
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

export default function IdentityCard({ structure, gene, hasMembrane, marks, signal }: Props) {
  const { palette, custom } = useTheme()
  const family = gene?.family ?? null
  const accession = structure.uniprot_accession

  const bestExperimental = [
    structure.best_pdb_id?.toUpperCase(),
    resolutionLabel(structure.best_resolution),
    methodLabel(structure.best_method),
  ]
    .filter(Boolean)
    .join(" · ")

  const links: LinkOut[] = [
    ...(accession ? [{ label: "AlphaFold DB", href: alphafoldUrl(accession) }] : []),
    { label: "Ensembl", href: ensemblUrl(structure.gene_id) },
    ...(gene ? [{ label: "UCSC", href: ucscUrl(gene) }] : []),
    ...(structure.alphafill_page_url
      ? [{ label: "AlphaFill ligands", href: structure.alphafill_page_url }]
      : []),
  ]

  const [linkRowRef, linkRowFits] = useRowFits(links.length, LINK_ROW_GAP)

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-end"
        sx={{ flexWrap: "wrap", fontFamily: custom.monoFontFamily }}
      >
        <Typography
          component="span"
          fontWeight={700}
          sx={{ ...capBoxSx, fontFamily: "inherit", fontSize: "inherit" }}
        >
          {structure.symbol ?? structure.gene_id}
        </Typography>
        {structure.uniprot_id && (
          <Typography
            component="span"
            color="text.secondary"
            sx={{ ...capBoxSx, fontFamily: "inherit", fontSize: IDENTITY_SECONDARY_EM }}
          >
            {structure.uniprot_id}
          </Typography>
        )}
        {family && (
          <Box sx={{ fontSize: IDENTITY_SECONDARY_EM, color: "text.secondary" }}>
            <FamilyLabel
              label={family}
              color={getFamilyColor(family, palette.mode)}
              category={gene?.category}
            />
          </Box>
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
          gridTemplateColumns: IDENTITY_GRID_COLUMNS,
          justifyContent: "start",
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
        {hasMembrane ? (
          <Stat
            label="TM helices"
            value={
              structure.n_intramembrane > 0
                ? `${structure.n_transmembrane} · ${structure.n_intramembrane} intramembrane`
                : structure.n_transmembrane
            }
          />
        ) : (
          <Stat label="Marked residues" value={markSummary(marks, signal)} />
        )}
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

      <Box
        ref={linkRowRef}
        sx={{
          position: "relative",
          left: `${-LINK_ROW_INK_INSET}px`,
          gap: `${LINK_ROW_GAP}px`,
          ...(linkRowFits
            ? { display: "flex", flexWrap: "wrap" }
            : { display: "grid", gridTemplateColumns: LINK_ROW_WRAPPED_COLUMNS }),
        }}
      >
        {links.map((link) => (
          <ExternalLink key={link.label} {...link} />
        ))}
      </Box>

      {structure.afdb_entry_id && !structure.model_is_canonical && (
        <Alert severity="info" variant="outlined">
          <Typography variant="body2">
            This AlphaFold model uses a different sequence from the one currently listed by UniProt.
            Its per-residue confidence scores therefore cannot be mapped to the topology figure,
            which shows the residues as unscored. The 3D model still shows confidence using its own
            residue numbering, but highlighting is not linked between the two views.
          </Typography>
        </Alert>
      )}
    </Stack>
  )
}
