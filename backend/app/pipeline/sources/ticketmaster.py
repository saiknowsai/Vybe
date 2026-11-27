"""Ticketmaster Discovery API v2 — ticketed gigs, theatre, sport, comedy.

Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2
Default quota is 5,000 calls/day and 5 requests/second.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from ...cities import City
from ...models import Event
from ..geohash import encode
from ..normalize import guess_category, make_event

log = logging.getLogger(__name__)
URL = "https://app.ticketmaster.com/discovery/v2/events.json"
MAX_PAGES = 5
PAGE_SIZE = 100

SEGMENT_MAP = {"Music": "Music", "Sports": "Sports", "Family": "Family",
               "Arts & Theatre": "Arts", "Film": "Arts", "Miscellaneous": None}
STATUS_MAP = {"canceled": "cancelled", "cancelled": "cancelled",
              "postponed": "postponed", "rescheduled": "rescheduled"}


def _best_image(images: list[dict]) -> str | None:
    wide = [i for i in images or [] if i.get("ratio") == "16_9"] or (images or [])
    if not wide:
        return None
    return max(wide, key=lambda i: i.get("width") or 0).get("url")


def _category(item: dict) -> str:
    cls = next((c for c in item.get("classifications", []) if c.get("primary")),
               (item.get("classifications") or [{}])[0])
    segment = (cls.get("segment") or {}).get("name", "")
    genre = (cls.get("genre") or {}).get("name", "")
    if genre.lower() == "comedy":
        return "Comedy"
    mapped = SEGMENT_MAP.get(segment)
    return mapped or guess_category(f"{item.get('name', '')} {genre}")


def parse(item: dict, city: City) -> Event | None:
    start = (item.get("dates") or {}).get("start") or {}
    date = start.get("localDate")
    if not date or not item.get("name"):
        return None
    venue = ((item.get("_embedded") or {}).get("venues") or [{}])[0]
    loc = venue.get("location") or {}
    addr_parts = [(venue.get("address") or {}).get("line1"), (venue.get("city") or {}).get("name"),
                  venue.get("postalCode")]
    prices = [p for p in item.get("priceRanges") or [] if p.get("currency", "GBP") == "GBP"]
    lo = min((p["min"] for p in prices if p.get("min") is not None), default=None)
    hi = max((p["max"] for p in prices if p.get("max") is not None), default=None)
    status_code = ((item.get("dates") or {}).get("status") or {}).get("code", "")
    age = item.get("ageRestrictions") or {}
    desc = item.get("info") or item.get("pleaseNote") or ""
    if not desc:
        acts = [a.get("name") for a in (item.get("_embedded") or {}).get("attractions", []) if a.get("name")]
        desc = f"{', '.join(acts)} at {venue.get('name', 'the venue')}." if acts else ""
    time = start.get("localTime")
    return make_event(
        provider="ticketmaster", external_id=item.get("id"), url=item.get("url"), city=city.name,
        name=item["name"], date=date,
        time=time[:5] if time else None,
        description=desc[:600],
        venue=venue.get("name", ""),
        address=", ".join(p for p in addr_parts if p),
        lat=float(loc["latitude"]) if loc.get("latitude") else None,
        lng=float(loc["longitude"]) if loc.get("longitude") else None,
        category=_category(item),
        price=lo, max_price=hi,
        imageUrl=_best_image(item.get("images")),
        ticketUrl=item.get("url"), ticketProvider="Ticketmaster",
        status=STATUS_MAP.get(status_code, "scheduled"),
        ageSuitability="18+" if age.get("legalAgeEnforced") else "All Ages",
        isVerified=True,
    )


async def fetch(city: City, api_key: str, lookahead_days: int,
                client: httpx.AsyncClient | None = None) -> list[Event]:
    if not api_key:
        log.info("ticketmaster: no API key, skipping")
        return []
    now = datetime.now(timezone.utc).replace(microsecond=0)
    params = {
        "apikey": api_key,
        "geoPoint": encode(city.lat, city.lng),
        "radius": city.radius_miles, "unit": "miles",
        "countryCode": "GB", "locale": "*",
        "startDateTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDateTime": (now + timedelta(days=lookahead_days)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "size": PAGE_SIZE, "sort": "date,asc",
    }
    own = client is None
    client = client or httpx.AsyncClient(timeout=20)
    events: list[Event] = []
    try:
        for page in range(MAX_PAGES):
            r = await client.get(URL, params=params | {"page": page})
            r.raise_for_status()
            data = r.json()
            for item in (data.get("_embedded") or {}).get("events", []):
                ev = parse(item, city)
                if ev:
                    events.append(ev)
            total_pages = (data.get("page") or {}).get("totalPages", 0)
            if page + 1 >= total_pages:
                break
            await asyncio.sleep(0.25)  # stay well under 5 req/s
    finally:
        if own:
            await client.aclose()
    log.info("ticketmaster: %d events for %s", len(events), city.name)
    return events
