# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The curation files that say which coverage tracks and GWAS studies a browser draws.

Which tissues to show signal for and which trait to plot beside a gene family are choices
no public source can make, so they live beside the other curated decisions rather than in
the pipeline. Both files seed from a template, and both can instead be seeded from a
directory of files that is already laid out the way portals in this field lay one out, so
that an existing dataset does not have to be retyped.
"""

import json
import re
import tomllib
from dataclasses import dataclass
from importlib import resources
from pathlib import Path

from .. import templates

TRACKS_FILE = "browser_tracks.tsv"
GWAS_FILE = "browser_gwas.tsv"

TRACKS_HEADER = "track_id\tlabel\tgroup\tstrand\tsource\tbin\tlocal"
GWAS_HEADER = "study_id\ttrait\tcitation\tsource\tassembly\tlicense_spdx"

# What a portal calls the file that maps a cell type to its bigWig, and the one that lists
# its GWAS studies
CELLTYPE_MANIFEST = "celltype_bigwig.json"
GWAS_MANIFEST = "gwas_datasets.toml"

PLUS, MINUS = "plus", "minus"
_SLUG = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class TrackRow:
    track_id: str
    label: str
    group: str
    strand: str
    source: str
    bin: int | None
    local: bool | None


@dataclass(frozen=True)
class GwasRow:
    study_id: str
    trait: str
    citation: str
    source: str
    assembly: str
    license_spdx: str


def slug(text: str) -> str:
    return _SLUG.sub("_", text.strip().lower()).strip("_")


def _cell(cells: list[str], index: int) -> str:
    return cells[index].strip() if len(cells) > index else ""


def _optional_bool(text: str) -> bool | None:
    if not text:
        return None
    return text.lower() in {"yes", "true", "y", "1"}


def read_tracks(rows) -> list[TrackRow]:
    out = []
    for cells in rows:
        track_id = _cell(cells, 0)
        if not track_id:
            continue
        size = _cell(cells, 5)
        out.append(
            TrackRow(
                track_id=track_id,
                label=_cell(cells, 1) or track_id,
                group=_cell(cells, 2),
                strand=_cell(cells, 3).lower(),
                source=_cell(cells, 4),
                bin=int(size) if size else None,
                local=_optional_bool(_cell(cells, 6)),
            )
        )
    return out


def read_gwas(rows) -> list[GwasRow]:
    out = []
    for cells in rows:
        study_id = _cell(cells, 0)
        if not study_id:
            continue
        out.append(
            GwasRow(
                study_id=study_id,
                trait=_cell(cells, 1) or study_id,
                citation=_cell(cells, 2),
                source=_cell(cells, 3),
                assembly=_cell(cells, 4) or "GRCh38",
                license_spdx=_cell(cells, 5),
            )
        )
    return out


def pairs(rows: list[TrackRow]) -> dict[str, dict[str, TrackRow]]:
    """Group the rows into tracks, one unstranded row or one row per strand.

    A stranded track drawn from a single strand would silently show half its signal, so a
    half-declared pair stops the run instead.
    """
    grouped: dict[str, dict[str, TrackRow]] = {}
    for row in rows:
        strand = row.strand if row.strand in (PLUS, MINUS) else ""
        by_strand = grouped.setdefault(row.track_id, {})
        if strand in by_strand:
            raise SystemExit(
                f"{TRACKS_FILE} declares track {row.track_id!r} twice"
                + (f" for the {strand} strand" if strand else "")
            )
        by_strand[strand] = row

    for track_id, by_strand in grouped.items():
        if set(by_strand) not in ({""}, {PLUS, MINUS}):
            have = ", ".join(sorted(s or "unstranded" for s in by_strand))
            raise SystemExit(
                f"{TRACKS_FILE} gives track {track_id!r} only {have}. A track needs either "
                f"one row with no strand, or one {PLUS} row and one {MINUS} row."
            )
    return grouped


def _template(name: str) -> str:
    return (resources.files(templates) / name).read_text(encoding="utf-8")


def _manifest(path: Path, filename: str) -> Path | None:
    if path.is_file():
        return path
    candidate = path / filename
    return candidate if candidate.is_file() else None


def tracks_text(tracks_dir: Path | None) -> str:
    """Seed the coverage tracks, from a portal's bigWig manifest when one was pointed at."""
    manifest = _manifest(tracks_dir, CELLTYPE_MANIFEST) if tracks_dir else None
    if manifest is None:
        return _template(TRACKS_FILE)

    base = manifest.parent
    group = base.parent.name or base.name
    lines = []
    for label, entry in json.loads(manifest.read_text(encoding="utf-8")).items():
        track_id = slug(label)
        files = entry if isinstance(entry, dict) else {"": entry}
        for strand in ("", PLUS, MINUS):
            name = files.get(strand)
            if name:
                lines.append(
                    "\t".join((track_id, label, group, strand, str(base / name), "", "yes"))
                )
    return _document(
        [
            f"# Seeded from {manifest}",
            "# Edit the labels freely; track_id is what the built manifest is keyed on",
            "# Separate columns with tabs; blank lines and comments are ignored",
        ],
        [TRACKS_HEADER, *lines],
    )


def gwas_text(gwas_dir: Path | None) -> str:
    """Seed the GWAS studies, from a portal's study list when one was pointed at."""
    manifest = _manifest(gwas_dir, GWAS_MANIFEST) if gwas_dir else None
    if manifest is None:
        return _template(GWAS_FILE)

    base = manifest.parent
    config = tomllib.loads(manifest.read_text(encoding="utf-8"))
    lines = []
    for study in config.get("datasets", []):
        study_id = str(study.get("id", "")).strip()
        if not study_id:
            continue
        lines.append(
            "\t".join(
                (
                    study_id,
                    str(study.get("trait", study_id)),
                    str(study.get("citation", "")),
                    str(base / study_id),
                    "GRCh38",
                    "",
                )
            )
        )
    return _document(
        [
            f"# Seeded from {manifest}",
            "# Check the assembly column against the genome the atlas genes come from",
            "# Separate columns with tabs; blank lines and comments are ignored",
        ],
        [GWAS_HEADER, *lines],
    )


def _document(*blocks: list[str]) -> str:
    return "\n\n".join("\n".join(block) for block in blocks if block) + "\n"
