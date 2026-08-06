# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The `atlas` command.

atlas serve            run the app from a dataset directory
atlas export <dir>     write the whole app to disk for any web server
atlas build            turn a prepared dataset into the files the app serves
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

from .config import PRODUCT_NAME, PRODUCT_VERSION, Settings, refresh


def _add_settings_flags(parser: argparse.ArgumentParser) -> None:
    for name, field in Settings.model_fields.items():
        parser.add_argument(
            f"--{name.replace('_', '-')}",
            dest=name,
            default=None,
            help=f"ATLAS_{name.upper()} (default: {field.default})",
        )


def _apply_settings_flags(args: argparse.Namespace) -> None:
    for name in Settings.model_fields:
        value = getattr(args, name, None)
        if value is not None:
            os.environ[f"ATLAS_{name.upper()}"] = str(value)
    # Re-read the settings now that the flags are in the environment
    refresh()


def _serve(_: argparse.Namespace) -> int:
    import uvicorn

    from .config import settings
    from .main import app
    from .site import mount_site

    mount_site(app, settings.web_dir)
    uvicorn.run(app, host=settings.host, port=settings.port)
    return 0


def _export(args: argparse.Namespace) -> int:
    from .config import settings
    from .export import export

    stats = export(args.out_dir, settings.web_dir)
    print(f"{stats.files} files, {stats.bytes / 1e6:.1f} MB -> {args.out_dir}")
    print(
        f"{stats.changed} written, {stats.files - stats.changed} unchanged, {stats.removed} removed"
    )
    if stats.missing:
        print(f"{len(stats.missing)} endpoints had no record for their gene and were skipped")
    return 0


def _build(args: argparse.Namespace) -> int:
    run = Path(__file__).resolve().parents[2] / "scripts" / "build" / "run.py"
    if not run.is_file():
        print(f"the build phase needs the repository checkout, not found at {run}", file=sys.stderr)
        return 1
    return subprocess.call([sys.executable, str(run), *args.rest])


def main() -> int:
    parser = argparse.ArgumentParser(prog="atlas", description=f"{PRODUCT_NAME} {PRODUCT_VERSION}")
    parser.add_argument("--version", action="version", version=f"{PRODUCT_NAME} {PRODUCT_VERSION}")
    sub = parser.add_subparsers(dest="command", required=True)

    serve = sub.add_parser("serve", help="run the app live from Parquet")
    _add_settings_flags(serve)
    serve.set_defaults(func=_serve)

    export = sub.add_parser("export", help="write the whole app to disk as static files")
    export.add_argument("out_dir", type=Path)
    _add_settings_flags(export)
    export.set_defaults(func=_export)

    build = sub.add_parser("build", help="run the dataset build phase")
    build.add_argument("rest", nargs=argparse.REMAINDER)
    build.set_defaults(func=_build)

    args = parser.parse_args()
    _apply_settings_flags(args)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
