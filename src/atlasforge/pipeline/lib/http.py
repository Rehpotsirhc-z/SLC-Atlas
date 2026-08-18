# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Make rate-limited HTTP requests with retries and cancellation support."""

import email.utils
import json
import os
import random
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...config import PRODUCT_VERSION
from . import interrupt, reporting

MAX_ATTEMPTS = 5
THROTTLE_ATTEMPTS = 8
DEFAULT_TIMEOUT = 120
JSON_HEADERS = {"Accept": "application/json"}
CHUNK_BYTES = 1 << 20
RETRY_CODES = frozenset({429, 500, 502, 503, 504})
THROTTLE_CODES = frozenset({429, 503})
BACKOFF_MAX = 30
RETRY_AFTER_MAX = 120
PATIENCE = 5.0
JITTER_MAX = 0.5
HOST_WORKERS = 6

USER_AGENT = f"atlasforge/{PRODUCT_VERSION} (+https://donglab.org)"

# Values are (requests in flight, minimum interval)
# cspell:ignore eutils
HOST_POLICY = {
    "rest.ensembl.org": (4, 0.1),
    "eutils.ncbi.nlm.nih.gov": (1, 0.34),
    "rest.uniprot.org": (4, 0.1),
}


class _Host:
    """Coordinate concurrency, rate limits, and backoff for one host."""

    def __init__(self, limit: int, interval: float) -> None:
        self.gate = threading.Semaphore(limit)
        self.interval = interval
        self.next_slot = 0.0
        self.until = 0.0
        self.retries = 0
        self.gave_up = 0
        self.lock = threading.Lock()

    def hold(self, seconds: float) -> None:
        with self.lock:
            self.until = max(self.until, time.monotonic() + seconds)

    def wait(self) -> None:
        """Wait out any cool-off, then take the next slot in this host's rate."""
        with self.lock:
            now = time.monotonic()
            due = max(self.until, self.next_slot if self.interval else 0.0)
            if self.interval:
                self.next_slot = max(due, now) + self.interval
        wait = due - time.monotonic()
        # A latch is one deadline shared by every waiter, so without jitter they all resume on
        # the same microsecond, which is the lockstep the backoff jitter exists to avoid
        interrupt.pause(wait + random.uniform(0.0, JITTER_MAX) if wait > 0 else 0.0)


_hosts: dict[str, _Host] = {}
_hosts_lock = threading.Lock()


def _host(url: str) -> _Host:
    name = urllib.parse.urlsplit(url).netloc
    with _hosts_lock:
        if name not in _hosts:
            workers, interval = HOST_POLICY.get(name, (HOST_WORKERS, 0.0))
            _hosts[name] = _Host(workers, interval)
        return _hosts[name]


def retry_summary() -> list[str]:
    """One line per host that had to be retried, for the end-of-run summary."""
    with _hosts_lock:
        items = sorted(_hosts.items())
    lines = []
    for name, host in items:
        if host.retries:
            gave_up = f", {host.gave_up} gave up" if host.gave_up else ""
            lines.append(f"{name}: {reporting.count('retry/retries', host.retries)}{gave_up}")
    return lines


def _describe(e: urllib.error.HTTPError) -> str:
    body = e.read(300).decode("utf-8", "replace").strip()
    return f"{e.url} answered HTTP {e.code}" + (f": {body}" if body else "")


def _retry_after(error: Exception | None) -> float:
    """The wait the server asked for, in seconds, or 0 when it asked for nothing."""
    if not isinstance(error, urllib.error.HTTPError):
        return 0.0
    raw = (error.headers.get("Retry-After") or "").strip()
    if not raw:
        return 0.0
    if raw.isdigit():
        return min(float(raw), RETRY_AFTER_MAX)
    try:
        when = email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return 0.0
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return min(max((when - datetime.now(timezone.utc)).total_seconds(), 0.0), RETRY_AFTER_MAX)


def _delay(error: Exception | None, attempt: int) -> float:
    asked = _retry_after(error)
    if asked:
        # The server named a number, so wait at least that long rather than undercutting it
        return asked * random.uniform(1.0, 1.2)
    return random.uniform(0.0, min(2**attempt, BACKOFF_MAX))


def _status(error: Exception | None) -> str:
    if isinstance(error, urllib.error.HTTPError):
        return f"HTTP {error.code}"
    return type(error).__name__


def _pause(host: _Host, name: str, error: Exception | None, attempt: int, waited: float) -> float:
    delay = _delay(error, attempt)
    if isinstance(error, urllib.error.HTTPError) and error.code in THROTTLE_CODES:
        host.hold(delay)
    with host.lock:
        host.retries += 1
    if waited + delay > PATIENCE:
        reporting.record(
            reporting.WARN, f"{name} answered {_status(error)}, waiting {delay:.0f}s to try again"
        )
    interrupt.pause(delay)
    return waited + delay


def _request(url: str, **kwargs: Any) -> urllib.request.Request:
    headers = {"User-Agent": USER_AGENT, **kwargs.pop("headers", {})}
    return urllib.request.Request(url, headers=headers, **kwargs)


def _send(req: urllib.request.Request, timeout: int, absent: Iterable[int]) -> bytes | None:
    """Return the response body, or None if the server answered with a code listed in
    `absent`."""
    absent = set(absent)
    host, name = _host(req.full_url), urllib.parse.urlsplit(req.full_url).netloc
    error: Exception | None = None
    waited = 0.0
    attempt = 0
    limit = MAX_ATTEMPTS
    while attempt < limit:
        interrupt.check()
        host.wait()
        try:
            with host.gate, urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code in absent:
                return None
            if e.code not in RETRY_CODES:
                raise RuntimeError(_describe(e)) from e
            error = e
            if e.code in THROTTLE_CODES:
                limit = THROTTLE_ATTEMPTS
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            error = e
        attempt += 1
        if attempt < limit:
            waited = _pause(host, name, error, attempt, waited)
    with host.lock:
        host.gave_up += 1
    raise RuntimeError(
        f"{name} did not answer {req.full_url} after {reporting.count('attempt', limit)} "
        f"over {waited:.0f}s; the last was {_status(error)}: {error}"
    )


def _send_required(req: urllib.request.Request, timeout: int) -> bytes:
    body = _send(req, timeout, ())
    if body is None:
        raise RuntimeError(f"no response body from {req.full_url}")
    return body


def fetch_text(url: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    return _send_required(_request(url), timeout).decode("utf-8")


def fetch_bytes(url: str, timeout: int = DEFAULT_TIMEOUT) -> bytes:
    """Return the response body without decoding it, for the binary coordinate files that
    the structure steps download."""
    return _send_required(_request(url), timeout)


def get_json(url: str, timeout: int = DEFAULT_TIMEOUT, absent: Iterable[int] = ()) -> Any:
    body = _send(_request(url, headers=JSON_HEADERS), timeout, absent)
    return json.loads(body) if body is not None else None


def post_json(url: str, payload: dict, timeout: int = DEFAULT_TIMEOUT) -> Any:
    req = _request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **JSON_HEADERS},
    )
    return json.loads(_send_required(req, timeout))


def post_form(url: str, fields: dict[str, str], timeout: int = DEFAULT_TIMEOUT) -> str:
    req = _request(url, data=urllib.parse.urlencode(fields).encode("utf-8"))
    return _send_required(req, timeout).decode("utf-8")


def download(url: str, path: Path, on_bytes: Callable[[int, int], None] | None = None) -> None:
    """Stream the download into a .part file beside the destination and rename it once the
    download finishes, so that an interrupted download is never mistaken for a complete file
    by a caller that skips whatever is already on disk."""
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(path.suffix + ".part")
    host, name = _host(url), urllib.parse.urlsplit(url).netloc
    error: Exception | None = None
    waited = 0.0
    for attempt in range(1, MAX_ATTEMPTS + 1):
        interrupt.check()
        host.wait()
        try:
            with host.gate, urllib.request.urlopen(_request(url), timeout=DEFAULT_TIMEOUT) as resp:
                total = int(resp.headers.get("Content-Length") or 0)
                done = 0
                with part.open("wb") as out:
                    while chunk := resp.read(CHUNK_BYTES):
                        interrupt.check()
                        out.write(chunk)
                        done += len(chunk)
                        if on_bytes:
                            on_bytes(done, total)
        except urllib.error.HTTPError as e:
            if e.code not in RETRY_CODES:
                part.unlink(missing_ok=True)
                raise RuntimeError(_describe(e)) from e
            error = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            error = e
        except BaseException:
            # Canceled part way through, so the half-written file goes rather than lingering
            part.unlink(missing_ok=True)
            raise
        else:
            os.replace(part, path)
            return
        if attempt < MAX_ATTEMPTS:
            waited = _pause(host, name, error, attempt, waited)
    part.unlink(missing_ok=True)
    with host.lock:
        host.gave_up += 1
    raise RuntimeError(
        f"{name} did not send {url} after {reporting.count('attempt', MAX_ATTEMPTS)} "
        f"over {waited:.0f}s; the last was {_status(error)}: {error}"
    )
