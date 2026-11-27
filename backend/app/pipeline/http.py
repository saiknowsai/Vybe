"""Polite HTTP for event APIs: identify ourselves, short timeouts, back off on errors."""
import asyncio
import logging
import random

import httpx

log = logging.getLogger(__name__)

RETRYABLE = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 4
BASE_DELAY = 2.0  # seconds; doubles each retry, plus jitter


def user_agent(version: str, app_url: str) -> str:
    return f"VybeEvents/{version} (+{app_url})"


async def get_with_backoff(client: httpx.AsyncClient, url: str, *, params: dict,
                           headers: dict | None = None, timeout: float = 8.0) -> httpx.Response:
    """GET with exponential backoff on 429/5xx/timeouts. Other 4xx errors are not retried."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            r = await client.get(url, params=params, headers=headers, timeout=timeout)
        except (httpx.TimeoutException, httpx.TransportError) as e:
            if attempt == MAX_ATTEMPTS:
                raise
            wait = BASE_DELAY * 2 ** (attempt - 1) + random.uniform(0, 1)
            log.warning("%s: %s, retrying in %.1fs", url, type(e).__name__, wait)
            await asyncio.sleep(wait)
            continue
        if r.status_code not in RETRYABLE or attempt == MAX_ATTEMPTS:
            r.raise_for_status()
            return r
        wait = BASE_DELAY * 2 ** (attempt - 1) + random.uniform(0, 1)
        retry_after = r.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            wait = max(wait, float(retry_after))
        log.warning("%s: HTTP %s, retrying in %.1fs", url, r.status_code, wait)
        await asyncio.sleep(wait)
    raise RuntimeError("unreachable")
