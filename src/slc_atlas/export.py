# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Export the app and API as files that any web server can serve."""

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
from .site import ROUTES_FILE, read_manifest

NOT_EXPORTED = {
    "/api/structure/models/{filename}",
    "/api/browser/coverage/{filename}",
    "/api/browser/models.bb",
    "/api/browser/gwas/{study_id}.bb",
}

COPIED_TREES = (
    (("structure", "models"), ("api", "structure", "models")),
    (("browser", "coverage"), ("api", "browser", "coverage")),
    (("browser", "gwas"), ("api", "browser", "gwas")),
)

COPIED_FILES = ((("browser", "models.bb"), ("api", "browser", "models.bb")),)

CONCURRENCY = 8

EXPORT_HEADERS = {"Accept-Encoding": "identity"}

MANAGED = ("api", "assets")

NOT_COPIED = {"index.html", "index.html.template", "manifest.webmanifest", ROUTES_FILE}


@dataclass
class ExportStats:
    files: int = 0
    bytes: int = 0
    changed: int = 0
    removed: int = 0
    missing: list[str] = field(default_factory=list)


def _write(path: Path, data: bytes) -> bool:
    if path.is_file() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def _copy(src: Path, dst: Path) -> bool:
    if dst.is_file():
        a, b = src.stat(), dst.stat()
        if a.st_size == b.st_size and int(a.st_mtime) == int(b.st_mtime):
            return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def _prune(out_dir: Path, keep: set[Path]) -> int:
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
    return [path.strip("/") for path in json.loads(source.read_text()) if path.strip("/")]


def _write_pages(out_dir: Path, routes: list[str], shell: bytes) -> int:
    """Write the app shell for direct links and the static 404 fallback."""
    changed = sum(_write(out_dir / route / "index.html", shell) for route in routes)
    return changed + _write(out_dir / "404.html", shell)


def _prune_pages(out_dir: Path, previous: list[str], routes: list[str]) -> int:
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
    if capabilities.get("browser"):
        urls += ["/api/browser/tracks.json", "/api/browser/sources.json"]
        urls += [f"/api/browser/{gid}/region.json" for gid in gene_ids]
    return urls


def _template_regex(template: str) -> re.Pattern[str]:
    literals = re.split(r"\{[^}]+\}", template)
    return re.compile("^" + "[^/]+".join(re.escape(part) for part in literals) + "$")


def _uncovered(urls: list[str], capabilities: dict[str, bool]) -> set[str]:
    """Return API routes missing from the export plan."""
    templates = {
        path: _template_regex(path)
        for path, methods in app.openapi()["paths"].items()
        if "get" in methods and path.startswith("/api")
    }
    for view, prefix in (("structure", "/api/structure"), ("browser", "/api/browser")):
        if not capabilities.get(view):
            templates = {p: r for p, r in templates.items() if not p.startswith(prefix)}
    hit = {path for path, regex in templates.items() for u in urls if regex.match(u)}
    return set(templates) - hit - NOT_EXPORTED


async def _dump(out_dir: Path, keep: set[Path]) -> ExportStats:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://export", headers=EXPORT_HEADERS
    ) as client:
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


def _copy_binaries(app_dir: Path, out_dir: Path, keep: set[Path]) -> tuple[int, int, int]:
    files = size = changed = 0
    for source_parts, url_parts in COPIED_FILES:
        src = app_dir.joinpath(*source_parts)
        if not src.is_file():
            continue
        dst = out_dir.joinpath(*url_parts)
        keep.add(dst)
        changed += _copy(src, dst)
        files += 1
        size += src.stat().st_size
    for source_parts, url_parts in COPIED_TREES:
        root = app_dir.joinpath(*source_parts)
        if not root.is_dir():
            continue
        for src in root.rglob("*"):
            if not src.is_file():
                continue
            dst = out_dir.joinpath(*url_parts, src.relative_to(root))
            keep.add(dst)
            changed += _copy(src, dst)
            files += 1
            size += src.stat().st_size
    return files, size, changed


def _copy_frontend(web_dir: Path, out_dir: Path, keep: set[Path]) -> tuple[int, int, int]:
    files = size = changed = 0
    for src in web_dir.rglob("*"):
        if not src.is_file() or src.name in NOT_COPIED:
            continue
        dst = out_dir / src.relative_to(web_dir)
        keep.add(dst)
        changed += _copy(src, dst)
        files += 1
        size += src.stat().st_size
    return files, size, changed


def export(out_dir: Path, web_dir: Path) -> ExportStats:
    """Export the frontend, API responses, and binary assets."""
    out_dir.mkdir(parents=True, exist_ok=True)

    template = web_dir / "index.html.template"
    source = template if template.is_file() else web_dir / "index.html"
    if not source.is_file():
        raise FileNotFoundError(
            f"No built frontend was found at {web_dir}. Run `npm --prefix web run build`."
        )

    manifest = web_dir / ROUTES_FILE
    if not manifest.is_file():
        raise FileNotFoundError(
            f"No {ROUTES_FILE} was found at {web_dir}. Run `npm --prefix web run build`."
        )
    routes = _routes(manifest)
    served = out_dir / ROUTES_FILE
    previous = _routes(served) if served.is_file() else []

    keep: set[Path] = set()
    web_files, web_size, changed = _copy_frontend(web_dir, out_dir, keep)
    shell = render(source.read_text()).encode()
    changed += _write(out_dir / "index.html", shell)
    changed += _write(out_dir / "index.html.template", source.read_bytes())
    changed += _write_pages(out_dir, routes, shell)
    changed += _write(served, manifest.read_bytes())
    rendered = read_manifest(web_dir)
    rendered_manifest = rendered.encode() if rendered is not None else None
    webmanifest_out = out_dir / "manifest.webmanifest"
    stale_manifest = 0
    if rendered_manifest is not None:
        changed += _write(webmanifest_out, rendered_manifest)
    elif webmanifest_out.is_file():
        webmanifest_out.unlink()
        stale_manifest = 1

    stats = asyncio.run(_dump(out_dir, keep))
    model_files, model_size, model_changes = _copy_binaries(settings.app_dir, out_dir, keep)

    pages = len(routes) + 1
    stats.files += web_files + model_files + pages + 3
    stats.bytes += web_size + model_size + len(shell) * (pages + 1) + source.stat().st_size
    stats.bytes += manifest.stat().st_size
    if rendered_manifest is not None:
        stats.files += 1
        stats.bytes += len(rendered_manifest)
    stats.changed += changed + model_changes
    stats.removed = _prune(out_dir, keep) + _prune_pages(out_dir, previous, routes) + stale_manifest
    return stats


def report(stats: ExportStats, out_dir: Path) -> None:
    print(f"{stats.files} files, {stats.bytes / 1024**2:.1f} MiB -> {out_dir}")
    print(
        f"{stats.changed} written, {stats.files - stats.changed} unchanged, {stats.removed} removed"
    )
    if stats.missing:
        print(f"Skipped {len(stats.missing)} missing gene records")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=export.__doc__)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--web-dir", type=Path, required=True, help="the built frontend")
    args = parser.parse_args()

    report(export(args.out_dir, args.web_dir), args.out_dir)


if __name__ == "__main__":
    main()
