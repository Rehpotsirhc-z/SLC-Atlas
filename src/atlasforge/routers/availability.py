# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from collections.abc import Callable
from typing import TypeVar

from fastapi import HTTPException

T = TypeVar("T")


def unavailable_guard(message: str) -> Callable[[T | None], T]:
    """Return a guard that raises 404 when optional data is unavailable."""

    def require(value: T | None) -> T:
        if value is None:
            raise HTTPException(404, message)
        return value

    return require
