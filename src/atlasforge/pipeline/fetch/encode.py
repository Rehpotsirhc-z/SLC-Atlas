# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Turn an ENCODE accession into the address of a coverage file.

ENCODE is the one public source of coverage that suits any gene family, so it is what the
coverage curation file seeds with. An experiment accession is what a person can look up and
cite, while the file inside it is reprocessed from time to time under a new accession, so
the curation file names the experiment and this resolves it afresh on every fetch.

The files are served with byte ranges and with cross-origin reads allowed, so a track left
remote is read by the browser directly and costs the export nothing.
"""

import re

from ..lib.http import get_json

PORTAL = "https://www.encodeproject.org"
DOWNLOAD = f"{PORTAL}/files/{{accession}}/@@download/{{accession}}.bigWig"

EXPERIMENT = re.compile(r"^ENCSR[0-9A-Z]{6}$")
FILE = re.compile(r"^ENCFF[0-9A-Z]{6}$")

# What the portal calls the signal a browser should show, best first. ENCODE marks one file
# of an experiment as preferred, and these are the fallbacks when it has not
OUTPUT_TYPES = ("fold change over control", "signal p-value", "read-depth normalized signal")

ASSEMBLY = "GRCh38"
LICENSE = "LicenseRef-ENCODE-terms"


def is_accession(text: str) -> bool:
    return bool(EXPERIMENT.match(text) or FILE.match(text))


def file_url(accession: str) -> str:
    return DOWNLOAD.format(accession=accession)


def _files(experiment: str) -> list[dict]:
    url = (
        f"{PORTAL}/search/?type=File&dataset=%2Fexperiments%2F{experiment}%2F"
        f"&file_format=bigWig&assembly={ASSEMBLY}&status=released"
        f"&limit=all&format=json&frame=object"
    )
    return get_json(url, absent=(404,)) or {}


def resolve(accession: str) -> tuple[str, str]:
    """Return the download address of a track, and the file accession it turned out to be."""
    if FILE.match(accession):
        return file_url(accession), accession

    graph = _files(accession).get("@graph", [])
    if not graph:
        raise SystemExit(
            f"ENCODE experiment {accession} has no released {ASSEMBLY} bigWig. "
            f"Check it at {PORTAL}/experiments/{accession}/ or name a file accession instead."
        )
    preferred = next((f for f in graph if f.get("preferred_default")), None)
    if preferred is None:
        by_type = {f.get("output_type"): f for f in graph}
        preferred = next((by_type[t] for t in OUTPUT_TYPES if t in by_type), graph[0])
    return file_url(preferred["accession"]), preferred["accession"]
