# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Provide the `atlas` commands for creating, serving, and exporting a gene-family site"""

import argparse
import os
from pathlib import Path

from .config import COMMAND_NAME, PRODUCT_NAME, PRODUCT_VERSION, Settings, refresh
from .pipeline.cli import add_parsers


def _add_settings_flags(parser: argparse.ArgumentParser) -> None:
    for name, field in Settings.model_fields.items():
        shown = "" if isinstance(field.default, Path) or field.default == "" else field.default
        env = f"ATLASFORGE_{name.upper()}"
        parser.add_argument(
            f"--{name.replace('_', '-')}",
            dest=name,
            default=None,
            help=f"{field.description} ({env}{f', default {shown}' if shown != '' else ''})",
        )


def _apply_settings_flags(args: argparse.Namespace) -> None:
    for name in Settings.model_fields:
        value = getattr(args, name, None)
        if value is not None:
            os.environ[f"ATLASFORGE_{name.upper()}"] = str(value)
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
    from .export import export, report

    report(export(args.out_dir, settings.web_dir), args.out_dir)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog=COMMAND_NAME,
        description=f"{PRODUCT_NAME} {PRODUCT_VERSION}. Turn a gene family into a browsable "
        "atlas: fetch its data, build the dataset, then serve or export the site.",
    )
    parser.add_argument("--version", action="version", version=f"{PRODUCT_NAME} {PRODUCT_VERSION}")
    sub = parser.add_subparsers(dest="command", required=True)

    serve = sub.add_parser(
        "serve",
        help="serve a built atlas on a local server",
        description="Serve the API and built frontend from a local web server.",
    )
    _add_settings_flags(serve)
    serve.set_defaults(func=_serve)

    export = sub.add_parser(
        "export",
        help="export a complete atlas for static hosting",
        description="Write a self-contained static site for deployment to any file server.",
    )
    export.add_argument("out_dir", type=Path, help="directory that will receive the static site")
    _add_settings_flags(export)
    export.set_defaults(func=_export)

    add_parsers(sub)

    args = parser.parse_args()
    _apply_settings_flags(args)
    from .pipeline.lib import console, interrupt

    interrupt.claim()

    try:
        return args.func(args)
    except (KeyboardInterrupt, interrupt.Stopped):
        console.blank()
        if interrupt.pending_writes():
            console.warn("Stopping after the current table writes finish.")
        else:
            console.warn("Stopping.")
        console.detail("Press Ctrl-C again to leave without waiting")
        interrupt.settle()
        console.warn("Stopped. Completed work is on disk and will be reused next time.")
        interrupt.leave(130, wait=False)


if __name__ == "__main__":
    raise SystemExit(main())
