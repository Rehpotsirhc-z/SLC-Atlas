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

PROTEIN_CODING = "gene with protein product"
APPROVED = "Approved"

# REUSE-IgnoreStart
SPDX_HEADER = [
    "# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>",
    "#",
    "# SPDX-License-Identifier: Apache-2.0",
]
# REUSE-IgnoreEnd

FAMILIES_DOC = [
    "# This file names the gene families shown in the atlas. Each row has three",
    "# columns, which are separated by tabs:",
    "#   group_name     is the family's name at HGNC, exactly as it was",
    "#                  downloaded. Genes are matched to their family through",
    "#                  this column, so do not edit it.",
    "#   family_key     is the short label the atlas groups genes under, usually",
    "#                  the symbol prefix the members share (SLC1, H2A, and so on).",
    "#   display_name   is the family name the atlas displays. You can edit it",
    "#                  freely.",
    '# A line like "# also: ..." is another name that HGNC lists for the family',
    "# right above it. To use one of those names, copy it into that family's",
    "# display_name column.",
    "# Blank lines and lines starting with # are ignored.",
]
FAMILIES_HEADER = "group_name\tfamily_key\tdisplay_name"

EXCLUSIONS_DOC = [
    "# This file is for dropping genes from the dataset, for example pseudogenes",
    "# and non-coding members that HGNC still lists in the family.",
    "# List each gene by its HGNC Approved symbol, one gene per line. If you",
    "# rename a gene in symbol_overrides.tsv, you still have to use its Approved",
    "# symbol here.",
    "# Only the first word of a line counts, so a note after the symbol, like the",
    "# reasons in parentheses below, is fine to keep or to leave off.",
    "# Blank lines and lines starting with # are ignored.",
]
EXCLUSIONS_LEAD = [
    "# The entries below are the ones HGNC itself marks as non-coding or",
    "# unapproved, each with the reason in parentheses. They are only suggestions",
    '# and start out ignored: remove the "# " at the start of a line to drop that',
    "# gene. You can add any other gene the same way, by putting its symbol on a",
    "# line of its own.\n",
]

OVERRIDES_DOC = [
    "# This file is for showing a gene under a different symbol than its HGNC",
    "# Approved one, for when the name a gene is best known by is officially just",
    "# an alias. Each row has three columns, which are separated by tabs:",
    "#   gene_id          is the Ensembl gene id. It is what identifies the gene,",
    "#                    so it has to be right.",
    "#   approved_symbol  is the HGNC Approved symbol. It is only here to keep",
    "#                    the row readable, and changing it changes nothing.",
    "#   display_symbol   is the symbol the atlas shows instead.",
    "# The Approved symbol stays with the gene as an alias, so searching for it",
    "# still finds the gene.",
    "# Blank lines and lines starting with # are ignored.",
]
OVERRIDES_HEADER = "gene_id\tapproved_symbol\tdisplay_symbol"

UNIPROT_DOC = [
    "# This file is for fixing which UniProt protein a gene maps to, for when the",
    "# automatic mapping picks the wrong accession or finds none. Each row has",
    "# two columns, which are separated by tabs: first the Ensembl gene id, and",
    "# then the UniProt accession to use for it. The line below is an example:",
    '# remove its "# " and edit it.',
    "# Blank lines and lines starting with # are ignored.",
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
        ("uniprot_overrides.tsv", lambda: _document(SPDX_HEADER, UNIPROT_DOC, UNIPROT_BODY)),
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


def _family_key(symbols: list[str]) -> str:
    """Take the prefix the member symbols have in common and trim it back to its last
    digit, so that SLC1A1 and SLC1A2 together give SLC1."""
    prefix = commonprefix(symbols)
    trimmed = re.match(r"^(.*\d)", prefix)
    return trimmed.group(1) if trimmed else prefix


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
        key = (detail.get("rootSymbol") or "").strip() or _family_key(symbols.get(name, []))
        families.append((name, key, _parse_aliases(detail.get("aliases"))))
    return families


def _families_text(source: str, rows: list[dict]) -> str:
    symbols = _symbols_by_group(rows)
    families = (
        _group_families(source, symbols)
        if source.isdigit()
        else [(name, _family_key(members), []) for name, members in symbols.items()]
    )
    lines = []
    for name, key, aliases in families:
        lines.append("\t".join((name, key, aliases[0] if aliases else name)))
        lines.extend(f"# also: {alias}" for alias in aliases[1:])
    return _document(SPDX_HEADER, FAMILIES_DOC, [FAMILIES_HEADER, *lines])


def _exclusions_text(rows: list[dict]) -> str:
    suggestions = []
    for row in rows:
        locus, status = row["Locus type"].strip(), row["Status"].strip()
        if locus == PROTEIN_CODING and status == APPROVED:
            continue
        reason = locus if locus != PROTEIN_CODING else status.lower()
        suggestions.append(f"# {row['Approved symbol'].strip()}  ({reason})")
    return _document(
        SPDX_HEADER, EXCLUSIONS_DOC, [*EXCLUSIONS_LEAD, "", *suggestions] if suggestions else []
    )


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
    return _document(SPDX_HEADER, OVERRIDES_DOC, [OVERRIDES_HEADER, *lines])


def _species_text() -> str:
    template = resources.files("slc_atlas.pipeline") / "templates" / "species.tsv"
    return template.read_text(encoding="utf-8")
