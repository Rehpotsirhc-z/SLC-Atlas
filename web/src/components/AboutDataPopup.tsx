// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import { Box, Chip, Divider, Link, Typography, useTheme } from "@mui/material"
import FloatingPanel from "./FloatingPanel"
import { useAllSources } from "@/api/hooks/useSources"
import { useCapabilities } from "@/api/hooks/useCapabilities"
import { useTrackManifest } from "@/api/hooks/useBrowser"
import { useUIStore } from "@/store/uiStore"
import { DATA_DOMAINS } from "@/config/methodology"
import { atlas } from "@/config/atlas"
import { PRODUCT_NAME, PRODUCT_URL } from "@/config/product"
import type { PanelPos } from "@/utils/useDraggablePanel"
import type { PanelSize } from "@/utils/useResizablePanel"
import type { DataSourceRecord } from "@/types/structure"
import type { GwasStudy } from "@/types/browser"

const DEFAULT_WIDTH = 452
const DEFAULT_HEIGHT = 560

// Match FamilyChip's optical label alignment
function LicenseChip({ spdx }: { spdx: string | null }) {
  if (!spdx) return null
  return (
    <Chip
      label={spdx}
      size="small"
      variant="outlined"
      sx={{
        height: 19,
        fontSize: 11,
        color: "text.secondary",
        borderColor: "divider",
        fontWeight: 500,
        "& .MuiChip-label": { px: 0.75, transform: "translateY(0.75px)" },
      }}
    />
  )
}

function Entry({
  name,
  detail,
  spdx,
  url,
}: {
  name: string
  detail: string
  spdx: string | null
  url: string | null
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 26 }}>
      {url ? (
        <Link href={url} target="_blank" rel="noreferrer" variant="body2" sx={{ fontWeight: 600 }}>
          {name}
        </Link>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      {detail && (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          {detail}
        </Typography>
      )}
      <LicenseChip spdx={spdx} />
    </Box>
  )
}

function sourceDetail(rec: DataSourceRecord): string {
  return [rec.version, rec.assembly].filter(Boolean).join(" · ")
}

export default function AboutDataPopup() {
  const theme = useTheme()
  const open = useUIStore((s) => s.aboutOpen)
  const setOpen = useUIStore((s) => s.setAboutOpen)
  const [pos, setPos] = useState<PanelPos | null>(null)
  const [size, setSize] = useState<PanelSize | null>(null)

  const capabilities = useCapabilities().data
  const sources = useAllSources().data ?? []
  const studies = useTrackManifest().data?.studies ?? []

  if (!open) return null

  const domains = DATA_DOMAINS.filter((d) => !d.capability || capabilities?.[d.capability])
  const defaultPos = {
    x: Math.max(16, (window.innerWidth - DEFAULT_WIDTH) / 2),
    y: Math.max(16, (window.innerHeight - DEFAULT_HEIGHT) / 2),
  }

  return (
    <FloatingPanel
      accent={theme.palette.primary.main}
      title="About"
      nameLine={atlas.name}
      onClose={() => setOpen(false)}
      footer={
        <>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            This atlas was generated using{" "}
            <Link href={PRODUCT_URL} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
              {PRODUCT_NAME}
            </Link>
            , an open-source system that generates an interactive web atlas for any gene family.
          </Typography>
        </>
      }
      pos={pos}
      onPosChange={setPos}
      size={size}
      onSizeChange={setSize}
      defaultPos={defaultPos}
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      minWidth={340}
      minHeight={280}
      windowKey="about"
    >
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1.75, pt: 0.5, pb: 2 }}>
        {domains.map((domain, index) => {
          const records = sources.filter((s) => s.domain === domain.key)
          const gwas: GwasStudy[] = domain.key === "browser" ? studies : []
          return (
            <Box key={domain.key}>
              {index > 0 && <Divider sx={{ my: 1.75 }} />}
              <Typography
                variant="overline"
                sx={{
                  color: "secondary.main",
                  fontWeight: 700,
                  lineHeight: 1.6,
                  letterSpacing: 0.5,
                }}
              >
                {domain.label}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: "block", mb: 1, mt: 0.25, lineHeight: 1.45 }}
              >
                {domain.method}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {records.map((rec) => (
                  <Entry
                    key={`${rec.source}-${rec.url}`}
                    name={rec.source}
                    detail={sourceDetail(rec)}
                    spdx={rec.license_spdx}
                    url={rec.url}
                  />
                ))}
                {gwas.map((study) => (
                  <Box key={study.study_id} sx={{ py: 0.25 }}>
                    <Entry name={study.trait} detail="" spdx={study.license_spdx} url={null} />
                    {study.citation && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: -0.25 }}
                      >
                        {study.citation}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>
    </FloatingPanel>
  )
}
