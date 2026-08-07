# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Write the whole app to disk as static files, ready for any web server.

Every API response is fetched from the app in-process and saved at the same URL the
frontend already asks for, so a plain file server behaves like the running app. Each of the
frontend's routes gets a page of its own for the same reason, so a host that cannot rewrite
an unmatched path still answers a deep link.

Re-exporting over an existing directory only touches what actually differs, and deletes
what the dataset no longer produces. Files that did not change keep their timestamps, so
rsync skips them and browsers keep their cached copies.
"""

import asyncio
import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from .config import settings
from .main import app
from .models.clustering import ClusterMethod
from .models.expression import TissueScope
from .shell import render

# Coordinate files are copied wholesale rather than fetched one URL at a time
NOT_EXPORTED = {"/api/structure/models/{filename}"}

# How many responses to render at once
CONCURRENCY = 8

# Directories the export owns completely, and may therefore delete from
MANAGED = ("api", "assets")

ROUTES_FILE = "routes.json"


@dataclass
class ExportStats:
    files: int = 0
    bytes: int = 0
    changed: int = 0
    removed: int = 0
    missing: list[str] = field(default_factory=list)


def _write(path: Path, data: bytes) -> bool:
    """Write only when the contents differ, and report whether anything was written."""
    if path.is_file() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def _copy(src: Path, dst: Path) -> bool:
    """Copy only when size or timestamp differ, the same test rsync makes by default."""
    if dst.is_file():
        a, b = src.stat(), dst.stat()
        if a.st_size == b.st_size and int(a.st_mtime) == int(b.st_mtime):
            return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def _prune(out_dir: Path, keep: set[Path]) -> int:
    """Delete files the dataset no longer produces, within the directories we own."""
    removed = 0
    for name in MANAGED:
        root = out_dir / name
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path not in keep:
                path.unlink()
                removed += 1
        for path in sorted(root.rglob("*"), reverse=True):
            if path.is_dir() and not any(path.iterdir()):
                path.rmdir()
    return removed


def _routes(source: Path) -> list[str]:
    """Route paths as directory names, dropping the root, whose page is index.html itself."""
    return [path.strip("/") for path in json.loads(source.read_text()) if path.strip("/")]


def _write_pages(out_dir: Path, routes: list[str], shell: bytes) -> int:
    """Give every route a file of its own, so a deep link needs no rewrite rule behind it."""
    changed = sum(_write(out_dir / route / "index.html", shell) for route in routes)
    return changed + _write(out_dir / "404.html", shell)


def _prune_pages(out_dir: Path, previous: list[str], routes: list[str]) -> int:
    """Drop the pages of routes an earlier export wrote and this one no longer has."""
    removed = 0
    for route in set(previous) - set(routes):
        page = out_dir / route / "index.html"
        if page.is_file():
            page.unlink()
            removed += 1
        if page.parent.is_dir() and not any(page.parent.iterdir()):
            page.parent.rmdir()
    return removed


async def _get(client: httpx.AsyncClient, url: str) -> httpx.Response:
    return await client.get(url)


def _plan(capabilities: dict[str, bool], gene_ids: list[str]) -> list[str]:
    urls = [
        "/api/capabilities.json",
        "/api/genes.json",
        "/api/conservation.json",
        "/api/conservation/species-tree.json",
        "/api/conservation/species-tree.nwk",
    ]
    urls += [f"/api/expression/{scope.value}.json" for scope in TissueScope]
    for method in ClusterMethod:
        urls += [f"/api/clustering/{method.value}.json", f"/api/clustering/{method.value}.nwk"]
    urls += [f"/api/genes/{gid}/transcripts.json" for gid in gene_ids]
    if capabilities.get("structure"):
        urls += [
            "/api/structure.json",
            "/api/structure/sources.json",
            "/api/structure/topology.json",
        ]
        for gid in gene_ids:
            urls += [
                f"/api/structure/{gid}.json",
                f"/api/structure/{gid}/features.json",
                f"/api/structure/{gid}/experimental.json",
            ]
    return urls


def _template_regex(template: str) -> re.Pattern[str]:
    literals = re.split(r"\{[^}]+\}", template)
    return re.compile("^" + "[^/]+".join(re.escape(part) for part in literals) + "$")


def _uncovered(urls: list[str], capabilities: dict[str, bool]) -> set[str]:
    """Return the API routes the plan never reaches, so a new endpoint cannot be missed."""
    templates = {
        path: _template_regex(path)
        for path, methods in app.openapi()["paths"].items()
        if "get" in methods and path.startswith("/api")
    }
    # A dataset built without an optional view has nothing to export for it
    if not capabilities.get("structure"):
        templates = {p: r for p, r in templates.items() if not p.startswith("/api/structure")}
    hit = {path for path, regex in templates.items() for u in urls if regex.match(u)}
    return set(templates) - hit - NOT_EXPORTED


async def _dump(out_dir: Path, keep: set[Path]) -> ExportStats:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://export") as client:
        capabilities = (await _get(client, "/api/capabilities.json")).json()
        gene_ids = [g["id"] for g in (await _get(client, "/api/genes.json")).json()]
        urls = _plan(capabilities, gene_ids)

        uncovered = _uncovered(urls, capabilities)
        if uncovered:
            raise RuntimeError(f"endpoints missing from the export plan: {sorted(uncovered)}")

        stats = ExportStats()
        semaphore = asyncio.Semaphore(CONCURRENCY)

        async def write(url: str) -> None:
            async with semaphore:
                response = await _get(client, url)
            # Genes with no structure record 404 in the running app too
            if response.status_code == 404:
                stats.missing.append(url)
                return
            response.raise_for_status()
            path = out_dir / url.lstrip("/")
            keep.add(path)
            stats.changed += _write(path, response.content)
            stats.files += 1
            stats.bytes += len(response.content)

        await asyncio.gather(*(write(url) for url in urls))
        return stats


def _copy_models(data_dir: Path, out_dir: Path, keep: set[Path]) -> tuple[int, int, int]:
    """Copy any mirrored 3D coordinates into the site."""
    models = data_dir / "structure" / "models"
    if not models.is_dir():
        return 0, 0, 0
    files = size = changed = 0
    for src in models.rglob("*"):
        if not src.is_file():
            continue
        dst = out_dir / "api" / "structure" / "models" / src.relative_to(models)
        keep.add(dst)
        changed += _copy(src, dst)
        files += 1
        size += src.stat().st_size
    return files, size, changed


def _copy_frontend(web_dir: Path, out_dir: Path, keep: set[Path]) -> tuple[int, int, int]:
    files = size = changed = 0
    for src in web_dir.rglob("*"):
        if not src.is_file() or src.name in {"index.html", "index.html.template", ROUTES_FILE}:
            continue
        dst = out_dir / src.relative_to(web_dir)
        keep.add(dst)
        changed += _copy(src, dst)
        files += 1
        size += src.stat().st_size
    return files, size, changed


def export(out_dir: Path, web_dir: Path) -> ExportStats:
    """Render the shell, copy the built frontend, and dump every endpoint under api/."""
    out_dir.mkdir(parents=True, exist_ok=True)

    template = web_dir / "index.html.template"
    source = template if template.is_file() else web_dir / "index.html"
    if not source.is_file():
        raise FileNotFoundError(f"no built frontend at {web_dir}")

    manifest = web_dir / ROUTES_FILE
    if not manifest.is_file():
        raise FileNotFoundError(f"no {ROUTES_FILE} at {web_dir}, run `npm --prefix web run build`")
    routes = _routes(manifest)
    # Only pages a previous export recorded are ours to remove
    served = out_dir / ROUTES_FILE
    previous = _routes(served) if served.is_file() else []

    keep: set[Path] = set()
    web_files, web_size, changed = _copy_frontend(web_dir, out_dir, keep)
    shell = render(source.read_text()).encode()
    changed += _write(out_dir / "index.html", shell)
    changed += _write(out_dir / "index.html.template", source.read_bytes())
    changed += _write_pages(out_dir, routes, shell)
    changed += _write(served, manifest.read_bytes())

    stats = asyncio.run(_dump(out_dir, keep))
    model_files, model_size, model_changes = _copy_models(settings.data_dir, out_dir, keep)

    # The route pages and the root files sit outside MANAGED, so _prune leaves them alone
    pages = len(routes) + 1
    stats.files += web_files + model_files + pages + 3
    stats.bytes += web_size + model_size + len(shell) * (pages + 1) + source.stat().st_size
    stats.bytes += manifest.stat().st_size
    stats.changed += changed + model_changes
    stats.removed = _prune(out_dir, keep) + _prune_pages(out_dir, previous, routes)
    return stats


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=export.__doc__)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--web-dir", type=Path, required=True, help="the built frontend")
    args = parser.parse_args()

    stats = export(args.out_dir, args.web_dir)
    print(f"{stats.files} files, {stats.bytes / 1e6:.1f} MB -> {args.out_dir}")
    if stats.missing:
        print(f"{len(stats.missing)} endpoints had no record and were skipped")


if __name__ == "__main__":
    main()
