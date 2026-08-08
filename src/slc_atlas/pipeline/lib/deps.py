# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Checks for the packages that only the pipeline needs, made just before a step runs.

Serving the app does not need any of them, so an installation without the pipeline extras
should print the command that installs them rather than raising an import error.
"""

import importlib


def require(modules: tuple[str, ...]) -> None:
    for module in modules:
        try:
            importlib.import_module(module)
        except ImportError:
            raise SystemExit(
                f"{module} is missing; install the pipeline extras: pip install 'slc-atlas[pipeline]'"
            ) from None
