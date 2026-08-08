# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The `atlas` command.

atlas fetch <source>   download a gene family as plain, editable source files
atlas build            compile those source files into what the app serves
atlas serve            serve the app from a built dataset
atlas export <dir>     write the whole app to disk as static files
"""

import argparse
import os
from pathlib import Path

from .config import PRODUCT_NAME, PRODUCT_VERSION, Settings, refresh
from .pipeline.cli import add_parsers


def _add_settings_flags(parser: argparse.ArgumentParser) -> None:
    for name, field in Settings.model_fields.items():
        # A path default is wherever this copy happens to be installed, so it is not shown
        shown = "" if isinstance(field.default, Path) or field.default == "" else field.default
        env = f"ATLAS_{name.upper()}"
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
    from .export import export, report

    report(export(args.out_dir, settings.web_dir), args.out_dir)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="atlas",
        description=f"{PRODUCT_NAME} {PRODUCT_VERSION}. Turn a gene family into a browsable "
        "atlas: fetch the data, build it, then serve or export the site.",
    )
    parser.add_argument("--version", action="version", version=f"{PRODUCT_NAME} {PRODUCT_VERSION}")
    sub = parser.add_subparsers(dest="command", required=True)

    serve = sub.add_parser("serve", help="serve the app from a built dataset")
    _add_settings_flags(serve)
    serve.set_defaults(func=_serve)

    export = sub.add_parser("export", help="write the whole app to disk as static files")
    export.add_argument("out_dir", type=Path)
    _add_settings_flags(export)
    export.set_defaults(func=_export)

    add_parsers(sub)

    args = parser.parse_args()
    _apply_settings_flags(args)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
