# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The curation files that say which coverage tracks and GWAS studies a browser draws.

Which tissues to show signal for and which trait to plot beside a gene family are choices
no public source can make, so they live beside the other curated decisions rather than in
the pipeline. Both files seed from a template, and both can instead be seeded from files
that are already on the machine, which fills in the paths so that a directory of coverage
does not have to be retyped.

Nothing is assumed about how those files are named or arranged. A bigWig states no cell
type and a summary-statistics table states no trait, so the seed carries the paths, which
are known, and leaves the naming to whoever writes the file.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass
from importlib import resources
from pathlib import Path

from .. import templates

TRACKS_FILE = "browser_tracks.tsv"
GWAS_FILE = "browser_gwas.tsv"

TRACKS_HEADER = "track_id\tlabel\tgroup\tstrand\tsource\tbin\tlocal\tcitation\turl\tlicense_spdx"
GWAS_HEADER = "study_id\ttrait\tcitation\tsource\tassembly\tlicense_spdx"

BIGWIG_SUFFIXES = ("*.bw", "*.bigWig", "*.bigwig")

PLUS, MINUS = "plus", "minus"
_SLUG = re.compile(r"[^a-z0-9]+")

_SAFE_ID = re.compile(r"[A-Za-z0-9_-]+")

# Infer strand only from an explicit filename suffix
_STRAND_TOKENS = {
    "plus": PLUS,
    "fwd": PLUS,
    "forward": PLUS,
    "pos": PLUS,
    "minus": MINUS,
    "rev": MINUS,
    "reverse": MINUS,
    "neg": MINUS,
}
_SEPARATORS = re.compile(r"[._-]")


@dataclass(frozen=True)
class TrackRow:
    track_id: str
    label: str
    group: str
    strand: str
    source: str
    bin: int | None
    local: bool | None
    citation: str = ""
    url: str = ""
    license_spdx: str = ""


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


def _check_id(value: str, kind: str, file: str) -> str:
    """Validate an ID used in filenames and URL paths."""
    if not _SAFE_ID.fullmatch(value):
        raise SystemExit(
            f"{file} has an invalid {kind} ID {value!r}. Use only letters, digits, dashes, "
            "and underscores."
        )
    return value


def read_tracks(rows) -> list[TrackRow]:
    out = []
    for cells in rows:
        track_id = _cell(cells, 0)
        if not track_id:
            continue
        _check_id(track_id, "track", TRACKS_FILE)
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
                citation=_cell(cells, 7),
                url=_cell(cells, 8),
                license_spdx=_cell(cells, 9),
            )
        )
    return out


def read_gwas(rows) -> list[GwasRow]:
    out = []
    seen: set[str] = set()
    for cells in rows:
        study_id = _cell(cells, 0)
        if not study_id:
            continue
        _check_id(study_id, "study", GWAS_FILE)
        if study_id in seen:
            raise SystemExit(f"{GWAS_FILE} declares study {study_id!r} twice")
        seen.add(study_id)
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


def bigwigs(path: Path) -> list[Path]:
    """Return the bigWigs a seed argument stands for, one file or a directory of them."""
    if not path.exists():
        raise SystemExit(f"No bigWig at {path}")
    if path.is_file():
        return [path]
    found = sorted({p for pattern in BIGWIG_SUFFIXES for p in path.glob(pattern)})
    if not found:
        raise SystemExit(f"No bigWig in {path}")
    return found


def named_strand(stem: str) -> tuple[str, str]:
    """Remove a recognized strand suffix and return it separately."""
    head, last = _split_tail(stem)
    strand = _STRAND_TOKENS.get(last.lower(), "")
    return (head, strand) if strand else (stem, "")


def _split_tail(stem: str) -> tuple[str, str]:
    parts = _SEPARATORS.split(stem)
    return (stem[: -len(parts[-1]) - 1], parts[-1]) if len(parts) > 1 else (stem, "")


def tracks_text(tracks_dirs: Sequence[Path]) -> str:
    """Seed one coverage row for each bigWig, filling in known paths and filename hints."""
    if not tracks_dirs:
        return _template(TRACKS_FILE)

    lines: list[str] = []
    seen: dict[tuple[str, str], Path] = {}
    for path in tracks_dirs:
        for bigwig in bigwigs(path):
            label, strand = named_strand(bigwig.stem)
            track_id = slug(label)
            if (track_id, strand) in seen:
                raise SystemExit(
                    f"{bigwig} and {seen[(track_id, strand)]} would both be track "
                    f"{track_id!r}. Rename one, or seed them into separate runs."
                )
            seen[(track_id, strand)] = bigwig
            lines.append(
                "\t".join((track_id, label, "", strand, str(bigwig), "", "yes", "", "", ""))
            )

    return _document(
        [f"# Seeded from {p}" for p in tracks_dirs]
        + [
            "# Add a descriptive name and group for each track",
            "# Check any strand inferred from a file name",
            "# Add citation, url, and license_spdx for local tracks without a public accession",
            "# Separate columns with tabs; blank lines and comments are ignored",
        ],
        [TRACKS_HEADER, *lines],
    )


def gwas_text(gwas_dirs: Sequence[Path]) -> str:
    """Seed one study row for each summary-statistics file or directory."""
    if not gwas_dirs:
        return _template(GWAS_FILE)

    lines = []
    for path in gwas_dirs:
        if not path.exists():
            raise SystemExit(f"No GWAS summary statistics at {path}")
        name = path.name if path.is_dir() else path.name.split(".")[0]
        lines.append("\t".join((slug(name), name, "", str(path), "GRCh38", "")))

    return _document(
        [f"# Seeded from {p}" for p in gwas_dirs]
        + [
            "# Add the trait name and study citation",
            "# Check the assembly column against the genome the atlas genes come from",
            "# Separate columns with tabs; blank lines and comments are ignored",
        ],
        [GWAS_HEADER, *lines],
    )


def _document(*blocks: list[str]) -> str:
    return "\n\n".join("\n".join(block) for block in blocks if block) + "\n"
