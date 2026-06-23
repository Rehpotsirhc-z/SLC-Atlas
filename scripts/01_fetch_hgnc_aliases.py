# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the "Also known as" aliases for every family in an HGNC gene group.

Walks the HGNC parent gene group, then fetches each child family group to read
its `aliases` field. Writes an editable Markdown file with one heading per
family (the HGNC group name) and its aliases as bullets, in HGNC's listed order.

The downstream pipeline (02_annotate_genes.py) treats the FIRST bullet under
each family as that family's display name (the `category` column), so move your
preferred line to the top to choose a different name.

To preserve manual edits, this script never overwrites an existing names file:
if the output already exists it leaves it untouched. Delete it first to re-fetch.

Usage:
    python scripts/01_fetch_hgnc_aliases.py [parent_group_id] [output.md]

    parent_group_id  HGNC gene group ID for the parent family (default: 752 = SLC)
    output.md        defaults to backend/data/raw/family_names.md

Examples:
    python scripts/01_fetch_hgnc_aliases.py                  # SLC families
    python scripts/01_fetch_hgnc_aliases.py 278              # voltage-gated ion channels
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_OUT_PATH = DATA_DIR / "raw" / "family_names.md"
DEFAULT_PARENT_GROUP_ID = 752  # HGNC: Solute carrier families

GROUP_URL = "https://www.genenames.org/cgi-bin/genegroup/group?id={id}"
REQUEST_INTERVAL = 0.2
ALIAS_RE = re.compile(r'"([^"]*)"')

HEADER_LINES = [
    "# Family display names",
    "",
    "The **first** bullet under each family heading below is the name shown in the",
    "atlas (the `category` column). To change a family's name, move the preferred",
    "line to the top of its list or just edit the text and then save and re-run the",
    "pipeline. You can edit this file at any time and re-run.",
    "",
]


def fetch_group(group_id: int) -> dict:
    req = urllib.request.Request(
        GROUP_URL.format(id=group_id), headers={"Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def parse_aliases(raw: str | None) -> list[str]:
    """HGNC returns aliases as a comma-separated list of quoted strings."""
    if not raw:
        return []
    return [a.strip() for a in ALIAS_RE.findall(raw) if a.strip()]


def fetch_all(parent_group_id: int) -> list[tuple[str, list[str]]]:
    subgroups = fetch_group(parent_group_id)["subGroups"]
    families: list[tuple[str, list[str]]] = []
    missing = []
    for sub in subgroups:
        group_name = sub["groupName"].strip()
        time.sleep(REQUEST_INTERVAL)
        aliases = parse_aliases(fetch_group(sub["groupID"]).get("aliases"))
        if not aliases:
            missing.append(group_name)
        families.append((group_name, aliases))

    if missing:
        print(f"{len(missing)} family(ies) had no aliases:", file=sys.stderr)
        for name in missing:
            print(f"  {name}", file=sys.stderr)
    return families


def write_markdown(families: list[tuple[str, list[str]]], out_path: str) -> None:
    lines = list(HEADER_LINES)
    for group_name, aliases in families:
        lines.append(f"## {group_name}")
        for alias in aliases:
            lines.append(f"- {alias}")
        lines.append("")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def main() -> None:
    args = sys.argv[1:]
    parent_group_id = int(args[0]) if len(args) > 0 else DEFAULT_PARENT_GROUP_ID
    out_path = Path(args[1]) if len(args) > 1 else DEFAULT_OUT_PATH

    if out_path.exists():
        print(f"{out_path} already exists; leaving it untouched to preserve your edits.")
        print("Delete it first to re-fetch family names from HGNC.")
        return

    families = fetch_all(parent_group_id)
    write_markdown(families, out_path)
    print(f"Wrote {out_path} ({len(families)} families).")


if __name__ == "__main__":
    main()
