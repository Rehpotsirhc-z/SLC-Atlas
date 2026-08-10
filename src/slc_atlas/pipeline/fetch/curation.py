# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The editable files that hold everything specific to the gene family being built.

No part of the pipeline knows a gene family by name. The names each family is displayed
under, the genes to leave out, and the symbols to show in place of the ones HGNC approved
are all read from these files. The first fetch run writes them using the HGNC table it has
just downloaded, filling in the values it can work out and leaving the rest commented out
as suggestions. A file that already exists is never written over.
"""

import csv
import re
from collections.abc import Callable, Iterator
from importlib import resources
from os.path import commonprefix
from pathlib import Path

from . import hgnc
from .. import templates

PROTEIN_CODING = "gene with protein product"
APPROVED = "Approved"

FAMILIES_DOC = [
    "# Name the gene families shown in the atlas",
    "# Keep group_name unchanged because it matches genes to their HGNC family",
    "# Use family_key for the short group label, such as SLC1 or H2A",
    '# Edit display_name freely; lines beginning with "# also:" list names suggested by HGNC',
    "# Separate columns with tabs; blank lines and comments are ignored",
]
FAMILIES_HEADER = "group_name\tfamily_key\tdisplay_name"

EXCLUSIONS_DOC = [
    "# List genes that should not appear in the atlas",
    "# Use one HGNC approved symbol per line, even if the display symbol changes elsewhere",
    "# You may add a note after the symbol; blank lines and comments are ignored",
]
EXCLUSIONS_LEAD = [
    "# HGNC marks the genes below as non-coding or unapproved",
    '# Remove the leading "# " to exclude a suggested gene\n',
]

OVERRIDES_DOC = [
    "# Choose a different display symbol for a gene",
    "# Keep gene_id accurate; approved_symbol is included only to make the row readable",
    "# The approved symbol remains searchable after the display symbol changes",
    "# Separate columns with tabs; blank lines and comments are ignored",
]
OVERRIDES_HEADER = "gene_id\tapproved_symbol\tdisplay_symbol"

UNIPROT_DOC = [
    "# Correct a missing or incorrect automatic UniProt match",
    "# Enter the Ensembl gene ID and UniProt accession, separated by a tab",
    "# Copy or uncomment the example below, then replace both values",
    "# Blank lines and comments are ignored",
]
UNIPROT_BODY = ["gene_id\tuniprot_accession", "# ENSG00000106688\tP43005"]

ALIAS_RE = re.compile(r'"([^"]*)"')

_Family = tuple[str, str, list[str]]


def _rows(path: Path, header: str) -> Iterator[list[str]]:
    """Split each data row of the file on tabs, skipping blank lines, comment lines and the
    header row."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        cells = line.split("\t")
        if cells[0].strip() != header:
            yield cells


def read_families(path: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Return the display name and the family key of every family, each of them keyed by
    the name of the HGNC group."""
    names: dict[str, str] = {}
    keys: dict[str, str] = {}
    for cells in _rows(path, "group_name"):
        group = cells[0].strip()
        keys[group] = cells[1].strip() if len(cells) > 1 else ""
        names[group] = cells[2].strip() if len(cells) > 2 else ""
    return names, keys


def read_exclusions(path: Path) -> frozenset[str]:
    """Read the excluded symbols, one per line. The first word of a line is the symbol and
    anything after it is a note the reader wrote for themselves."""
    if not path.exists():
        return frozenset()
    words = (line.split("#", 1)[0].split() for line in path.read_text().splitlines())
    return frozenset(parts[0] for parts in words if parts)


def read_symbol_overrides(path: Path) -> dict[str, str]:
    """Return the display symbol to use for each gene, keyed by gene id."""
    overrides: dict[str, str] = {}
    for cells in _rows(path, "gene_id"):
        if len(cells) > 2 and cells[0].strip() and cells[2].strip():
            overrides[cells[0].strip()] = cells[2].strip()
    return overrides


def seed(source: str, hgnc_path: Path, curation_dir: Path, *, promote_prefix: str) -> list[Path]:
    """Write the curation files that do not exist yet and return the paths of the ones that
    were written, so an empty list means the user had already written all of them."""
    rows = _read_hgnc(hgnc_path)
    builders: list[tuple[str, Callable[[], str]]] = [
        ("families.tsv", lambda: _families_text(source, rows)),
        ("exclusions.txt", lambda: _exclusions_text(rows)),
        ("symbol_overrides.tsv", lambda: _overrides_text(rows, promote_prefix)),
        ("species.tsv", _species_text),
        ("uniprot_overrides.tsv", lambda: _document(UNIPROT_DOC, UNIPROT_BODY)),
    ]
    curation_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, build in builders:
        path = curation_dir / name
        if path.exists():
            continue
        path.write_text(build(), encoding="utf-8")
        written.append(path)
    return written


def _read_hgnc(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def _document(*blocks: list[str]) -> str:
    return "\n\n".join("\n".join(block) for block in blocks if block) + "\n"


def _parse_aliases(raw: str | None) -> list[str]:
    """Read the alternate names of a group, which HGNC returns as a comma-separated list of
    quoted strings."""
    if not raw:
        return []
    return [alias.strip() for alias in ALIAS_RE.findall(raw) if alias.strip()]


def _alias_parts(raw: str) -> list[str]:
    return [alias.strip() for alias in raw.split(",") if alias.strip()]


def _family_key(symbols: list[str], fallback: str) -> str:
    """Take the prefix the member symbols have in common and trim it back to its last
    digit, so that SLC1A1 and SLC1A2 together give SLC1. Symbols with no common prefix
    fall back on the group name, so the key is never empty."""
    prefix = commonprefix(symbols)
    trimmed = re.match(r"^(.*\d)", prefix)
    return (trimmed.group(1) if trimmed else prefix) or fallback


def _symbols_by_group(rows: list[dict]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for row in rows:
        groups.setdefault(row["Group name"].strip(), []).append(row["Approved symbol"].strip())
    return groups


def _group_families(group_id: str, symbols: dict[str, list[str]]) -> list[_Family]:
    """Return one family per subgroup of the HGNC group, or a single family for the group
    itself when it has no subgroups."""
    parent = hgnc.fetch_group_json(int(group_id))
    subgroups = parent.get("subGroups") or []
    details = [hgnc.fetch_group_json(sub["groupID"]) for sub in subgroups] or [parent]
    families = []
    for detail in details:
        name = detail["groupName"].strip()
        key = (detail.get("rootSymbol") or "").strip() or _family_key(symbols.get(name, []), name)
        families.append((name, key, _parse_aliases(detail.get("aliases"))))
    return families


def _families_text(source: str, rows: list[dict]) -> str:
    symbols = _symbols_by_group(rows)
    families = (
        _group_families(source, symbols)
        if source.isdigit()
        else [(name, _family_key(members, name), []) for name, members in symbols.items()]
    )
    lines = []
    for name, key, aliases in families:
        lines.append("\t".join((name, key, aliases[0] if aliases else name)))
        lines.extend(f"# also: {alias}" for alias in aliases[1:])
    return _document(FAMILIES_DOC, [FAMILIES_HEADER, *lines])


def _exclusions_text(rows: list[dict]) -> str:
    suggestions = []
    for row in rows:
        locus, status = row["Locus type"].strip(), row["Status"].strip()
        if locus == PROTEIN_CODING and status == APPROVED:
            continue
        reason = locus if locus != PROTEIN_CODING else status.lower()
        suggestions.append(f"# {row['Approved symbol'].strip()}  ({reason})")
    return _document(EXCLUSIONS_DOC, [*EXCLUSIONS_LEAD, "", *suggestions] if suggestions else [])


def _overrides_text(rows: list[dict], promote_prefix: str) -> str:
    lines = []
    if promote_prefix:
        for row in rows:
            approved = row["Approved symbol"].strip()
            if approved.startswith(promote_prefix):
                continue
            gene_id = row["Ensembl gene ID"].strip()
            promoted = next(
                (a for a in _alias_parts(row["Alias symbols"]) if a.startswith(promote_prefix)), ""
            )
            if promoted and gene_id:
                lines.append("\t".join((gene_id, approved, promoted)))
    return _document(OVERRIDES_DOC, [OVERRIDES_HEADER, *lines])


def _species_text() -> str:
    template = resources.files(templates) / "species.tsv"
    return template.read_text(encoding="utf-8")
