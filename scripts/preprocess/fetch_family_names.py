# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch each HGNC family's "Also known as" aliases into an editable Markdown file.

The first bullet under each heading is taken as the family's display name (the
`category` column), so reorder bullets to choose a different name. Never overwrites an
existing file (delete to re-fetch). The parent group defaults to 752 (SLC).
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import get_json
from lib.reporting import report_missing

REFERENCE_DIR = Path(__file__).resolve().parents[2] / "reference"
DEFAULT_OUT_PATH = REFERENCE_DIR / "family_names.md"
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
    return get_json(GROUP_URL.format(id=group_id))


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

    report_missing("family(ies) had no aliases", missing)
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
