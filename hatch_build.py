# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

import re
from pathlib import Path

from hatchling.metadata.plugin.interface import MetadataHookInterface

RAW = "https://raw.githubusercontent.com/TheDongLab/AtlasForge/main/"
BLOB = "https://github.com/TheDongLab/AtlasForge/blob/main/"

_absolute = re.compile(r"^(https?:|mailto:|#)")


def _relative(url):
    return not _absolute.match(url)


def _absolutize(md):
    md = re.sub(r'<span class="todo[^"]*">[^<]*</span>\s*', "", md)

    def src(m):
        url = m.group(1)
        return f'src="{RAW + url}"' if _relative(url) else m.group(0)

    def href(m):
        url = m.group(1)
        return f'href="{BLOB + url}"' if _relative(url) else m.group(0)

    def link(m):
        bang, text, url = m.groups()
        if not _relative(url):
            return m.group(0)
        return f"{bang}[{text}]({(RAW if bang else BLOB) + url})"

    md = re.sub(r'src="([^"]+)"', src, md)
    md = re.sub(r'href="([^"]+)"', href, md)
    md = re.sub(r"(!?)\[([^\]]*)\]\(([^)]+)\)", link, md)
    return md


class ReadmeMetadataHook(MetadataHookInterface):
    def update(self, metadata):
        import pypandoc

        source = Path(self.root, "README.org")
        markdown = pypandoc.convert_file(str(source), "gfm")
        metadata["readme"] = {
            "content-type": "text/markdown",
            "text": _absolutize(markdown),
        }
