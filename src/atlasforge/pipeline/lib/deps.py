# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Checks for the packages that only the pipeline needs, made just before a step runs.

Serving the app does not need any of them, so an installation without the pipeline extras
should print the command that installs them rather than raising an import error.
"""

import importlib

from ...config import DISTRIBUTION_NAME


def require(modules: tuple[str, ...]) -> None:
    for module in modules:
        try:
            importlib.import_module(module)
        except ImportError:
            raise SystemExit(
                f"The {module} package is required for this step. Install the pipeline "
                f"dependencies with `pip install '{DISTRIBUTION_NAME}[pipeline]'`."
            ) from None
