// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useRef, type RefObject } from "react"
import CloseIcon from "@mui/icons-material/Close"
import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Switch,
  Typography,
} from "@mui/material"
import FloatingSurface from "@/components/view/FloatingSurface"
import { glowFlashSx } from "@/theme"
import type { CoverageTrack } from "@/types/browser"
import FixedMaxField from "./FixedMaxField"
import { usePanelDismiss } from "./usePanelDismiss"
import {
  LANE_HEIGHT_DEFAULT,
  LANE_HEIGHT_MAX,
  LANE_HEIGHT_MIN,
  SETTINGS_FIELD_W,
  SETTINGS_W,
} from "./constants"

export type YScaleMode = "auto" | "shared" | "fixed"

export interface BrowserPrefs {
  laneHeight: number
  yScale: YScaleMode
  yFixed: number
  showGwas: boolean
  showSignificance: boolean
  showGrid: boolean
  hidden: string[]
}

export const DEFAULT_PREFS: BrowserPrefs = {
  laneHeight: LANE_HEIGHT_DEFAULT,
  yScale: "auto",
  yFixed: 1,
  showGwas: true,
  showSignificance: true,
  showGrid: true,
  hidden: [],
}

interface Props {
  prefs: BrowserPrefs
  onChange: (next: Partial<BrowserPrefs>) => void
  onClose: () => void
  // Button excluded from outside-click dismissal
  anchorRef: RefObject<HTMLElement | null>
  tracks: CoverageTrack[]
  sx?: object
}

const rowSx = { fontSize: 13, m: 0, "& .MuiFormControlLabel-label": { fontSize: 13 } }

function BrowserSettings({ prefs, onChange, onClose, anchorRef, tracks, sx }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  usePanelDismiss({ panelRef, anchorRef, onClose })

  const groups = [...new Set(tracks.map((track) => track.group))]
  const toggle = (trackId: string) =>
    onChange({
      hidden: prefs.hidden.includes(trackId)
        ? prefs.hidden.filter((id) => id !== trackId)
        : [...prefs.hidden, trackId],
    })

  return (
    <FloatingSurface
      ref={panelRef}
      sx={{
        width: SETTINGS_W,
        p: 1.5,
        gap: 1,
        overflow: "auto",
        ...glowFlashSx,
        ...sx,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="overline" color="primary" sx={{ lineHeight: 1 }}>
          Display
        </Typography>
        <IconButton
          size="small"
          aria-label="Close display settings"
          onClick={onClose}
          sx={{ p: 0.25, my: -0.5, mr: -0.5, color: "text.secondary" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box>
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
          Track height · {prefs.laneHeight}px
        </Typography>
        <Slider
          size="small"
          min={LANE_HEIGHT_MIN}
          max={LANE_HEIGHT_MAX}
          step={2}
          value={prefs.laneHeight}
          onChange={(_event, value) => onChange({ laneHeight: value as number })}
        />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 13, color: "text.secondary", flex: 1 }}>
          Signal scale
        </Typography>
        <Select
          size="small"
          value={prefs.yScale}
          onChange={(event) => onChange({ yScale: event.target.value as YScaleMode })}
          sx={{ fontSize: 13, minWidth: SETTINGS_FIELD_W }}
        >
          <MenuItem value="auto">per track</MenuItem>
          <MenuItem value="shared">shared</MenuItem>
          <MenuItem value="fixed">fixed</MenuItem>
        </Select>
      </Box>
      {prefs.yScale === "fixed" && (
        <FixedMaxField value={prefs.yFixed} onChange={(yFixed) => onChange({ yFixed })} />
      )}

      <FormControlLabel
        sx={rowSx}
        control={
          <Switch
            size="small"
            checked={prefs.showGrid}
            onChange={(event) => onChange({ showGrid: event.target.checked })}
          />
        }
        label="Guide lines"
      />
      <FormControlLabel
        sx={rowSx}
        control={
          <Switch
            size="small"
            checked={prefs.showGwas}
            onChange={(event) => onChange({ showGwas: event.target.checked })}
          />
        }
        label="GWAS"
      />
      {prefs.showGwas && (
        <FormControlLabel
          sx={{ ...rowSx, ml: 2 }}
          control={
            <Switch
              size="small"
              checked={prefs.showSignificance}
              onChange={(event) => onChange({ showSignificance: event.target.checked })}
            />
          }
          label="Significance line"
        />
      )}

      <Divider sx={{ my: 0.5 }} />
      <Typography variant="overline" color="primary" sx={{ lineHeight: 1 }}>
        Tracks
      </Typography>
      {groups.map((group) => (
        <Box key={group}>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>{group}</Typography>
          {tracks
            .filter((track) => track.group === group)
            .map((track) => (
              <FormControlLabel
                key={track.track_id}
                sx={{ ...rowSx, display: "flex", ml: 0.5 }}
                control={
                  <Checkbox
                    size="small"
                    sx={{ p: 0.25, mr: 0.75 }}
                    checked={!prefs.hidden.includes(track.track_id)}
                    onChange={() => toggle(track.track_id)}
                  />
                }
                label={track.label}
              />
            ))}
        </Box>
      ))}
    </FloatingSurface>
  )
}

export default memo(BrowserSettings)
