# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""HTTP helpers with retries, used by the fetch steps that call remote APIs.

A request that is answered with 429 waits for the interval the Retry-After header asks
for. A transient 5xx and a dropped connection are both retried after a growing delay, and
the request only fails once it has been attempted MAX_ATTEMPTS times. A response code
passed in `absent` returns None instead of raising an error, which suits the endpoints
that answer 404 for an id that is perfectly valid.
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable
from pathlib import Path
from typing import Any

MAX_ATTEMPTS = 5
DEFAULT_TIMEOUT = 120
JSON_HEADERS = {"Accept": "application/json"}
CHUNK_BYTES = 1 << 20
RETRY_CODES = frozenset({429, 500, 502, 503, 504})


def _describe(e: urllib.error.HTTPError) -> str:
    body = e.read(300).decode("utf-8", "replace").strip()
    return f"{e.url} answered HTTP {e.code}" + (f": {body}" if body else "")


def _pause(error: Exception | None, attempt: int) -> None:
    retry_after = ""
    if isinstance(error, urllib.error.HTTPError):
        retry_after = (error.headers.get("Retry-After") or "").strip()
    time.sleep(int(retry_after) + 1 if retry_after.isdigit() else 2**attempt)


def _send(req: urllib.request.Request, timeout: int, absent: Iterable[int]) -> bytes | None:
    """Return the response body, or None if the server answered with a code listed in
    `absent`."""
    absent = set(absent)
    error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code in absent:
                return None
            if e.code not in RETRY_CODES:
                raise RuntimeError(_describe(e)) from e
            error = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            error = e
        _pause(error, attempt)
    raise RuntimeError(f"giving up on {req.full_url} after {MAX_ATTEMPTS} attempts: {error}")


def _send_required(req: urllib.request.Request, timeout: int) -> bytes:
    body = _send(req, timeout, ())
    if body is None:
        raise RuntimeError(f"no response body from {req.full_url}")
    return body


def fetch_text(url: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    return _send_required(urllib.request.Request(url), timeout).decode("utf-8")


def fetch_bytes(url: str, timeout: int = DEFAULT_TIMEOUT) -> bytes:
    """Return the response body without decoding it, for the binary coordinate files that
    the structure steps download."""
    return _send_required(urllib.request.Request(url), timeout)


def get_json(url: str, timeout: int = DEFAULT_TIMEOUT, absent: Iterable[int] = ()) -> Any:
    body = _send(urllib.request.Request(url, headers=JSON_HEADERS), timeout, absent)
    return json.loads(body) if body is not None else None


def post_json(url: str, payload: dict, timeout: int = DEFAULT_TIMEOUT) -> Any:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **JSON_HEADERS},
    )
    return json.loads(_send_required(req, timeout))


def post_form(url: str, fields: dict[str, str], timeout: int = DEFAULT_TIMEOUT) -> str:
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode("utf-8"))
    return _send_required(req, timeout).decode("utf-8")


def download(url: str, path: Path) -> None:
    """Stream the download into a .part file beside the destination and rename it once the
    download finishes, so that an interrupted download is never mistaken for a complete
    file by a caller that skips whatever is already on disk."""
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(path.suffix + ".part")
    req = urllib.request.Request(url)
    error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            with (
                urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp,
                part.open("wb") as out,
            ):
                while chunk := resp.read(CHUNK_BYTES):
                    out.write(chunk)
        except urllib.error.HTTPError as e:
            if e.code not in RETRY_CODES:
                raise RuntimeError(_describe(e)) from e
            error = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            error = e
        else:
            os.replace(part, path)
            return
        _pause(error, attempt)
    raise RuntimeError(f"giving up on {url} after {MAX_ATTEMPTS} attempts: {error}")
