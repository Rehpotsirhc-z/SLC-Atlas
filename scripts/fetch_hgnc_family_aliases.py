# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the "Also known as" aliases for every SLC family from genenames.org.

Walks the HGNC parent gene group 752 (Solute carrier families), then fetches each
child family group to read its `aliases` field. Writes an org file with one headline
per family and its aliases as bullets, in HGNC's listed order.

The downstream pipeline (annotate_slc_families.py) treats the FIRST bullet under each
family as that family's functional name, so reorder the bullets to choose a different
alias for a family.

Usage:
    python scripts/fetch_hgnc_family_aliases.py [output.org]

Defaults to backend/data/raw/hgnc_family_aliases.org.
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

from slc_family import derive_family

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_OUT_PATH = DATA_DIR / "raw" / "hgnc_family_aliases.org"

GROUP_URL = "https://www.genenames.org/cgi-bin/genegroup/group?id={id}"
SLC_PARENT_GROUP_ID = 752
REQUEST_INTERVAL = 0.2
ALIAS_RE = re.compile(r'"([^"]*)"')


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


def fetch_all() -> list[tuple[str, list[str]]]:
    subgroups = fetch_group(SLC_PARENT_GROUP_ID)["subGroups"]
    families: list[tuple[str, list[str]]] = []
    missing = []
    for sub in subgroups:
        family = derive_family(sub["groupName"].strip())
        time.sleep(REQUEST_INTERVAL)
        aliases = parse_aliases(fetch_group(sub["groupID"]).get("aliases"))
        if not aliases:
            missing.append(family)
        families.append((family, aliases))

    if missing:
        print(f"{len(missing)} family(ies) had no aliases:", file=sys.stderr)
        for family in missing:
            print(f"  {family}", file=sys.stderr)
    return families


def write_org(families: list[tuple[str, list[str]]], out_path: str) -> None:
    lines = [
        "# HGNC SLC family aliases, fetched from genenames.org gene group 752.",
        "# The FIRST bullet under each family is used as its functional name;",
        "# reorder bullets to choose a different alias.",
        "",
    ]
    for family, aliases in families:
        lines.append(f"* {family}")
        for alias in aliases:
            lines.append(f"- {alias}")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> None:
    args = sys.argv[1:]
    out_path = args[0] if len(args) > 0 else DEFAULT_OUT_PATH
    families = fetch_all()
    write_org(families, out_path)


if __name__ == "__main__":
    main()
