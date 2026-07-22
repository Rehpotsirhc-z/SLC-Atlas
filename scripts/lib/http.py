# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Retrying HTTP helpers shared by the network-facing preprocess scripts.

Every request retries on 429 for MAX_ATTEMPTS, honouring Retry-After. Codes listed in
`absent` resolve to None instead of raising, for endpoints that 404 on a valid id.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable

MAX_ATTEMPTS = 5
DEFAULT_TIMEOUT = 120
JSON_HEADERS = {"Accept": "application/json"}


def _send(req: urllib.request.Request, timeout: int, absent: Iterable[int]) -> str | None:
    absent = set(absent)
    for _ in range(MAX_ATTEMPTS):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After", "2")) + 1)
                continue
            if e.code in absent:
                return None
            raise
    raise RuntimeError(f"giving up on {req.full_url} after repeated 429s")


def fetch_text(url: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    return _send(urllib.request.Request(url), timeout, ())


def get_json(url: str, timeout: int = DEFAULT_TIMEOUT, absent: Iterable[int] = ()) -> object | None:
    body = _send(urllib.request.Request(url, headers=JSON_HEADERS), timeout, absent)
    return json.loads(body) if body is not None else None


def post_json(url: str, payload: dict, timeout: int = DEFAULT_TIMEOUT) -> object:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **JSON_HEADERS},
    )
    return json.loads(_send(req, timeout, ()))


def post_form(url: str, fields: dict[str, str], timeout: int = DEFAULT_TIMEOUT) -> str:
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode("utf-8"))
    return _send(req, timeout, ())
