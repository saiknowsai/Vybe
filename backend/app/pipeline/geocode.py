"""Fill in map coordinates for events that don't have them (mostly claude_web ones).

Uses OpenStreetMap Nominatim: free, but max 1 request/second and a real User-Agent
are required by its usage policy. Results are cached in Mongo so each venue is
looked up once. Coordinates from a language model are never trusted.
"""
import asyncio
import logging

import httpx

from ..cities import City
from ..models import Event

log = logging.getLogger(__name__)
URL = "https://nominatim.openstreetmap.org/search"
MAX_LOOKUPS_PER_RUN = 40
RATE_DELAY = 1.1  # seconds between requests (Nominatim allows 1/s)


def _within(city: City, lat: float, lng: float) -> bool:
    # ~1 degree lat ≈ 69 miles; loose box check is enough to reject wrong-town matches
    return abs(lat - city.lat) * 69 <= city.radius_miles * 1.5 and abs(lng - city.lng) * 40 <= city.radius_miles * 1.5


async def geocode_missing(events: list[Event], city: City, db, contact_email: str = "",
                          client: httpx.AsyncClient | None = None) -> int:
    todo = [e for e in events if (e.lat is None or e.lng is None) and (e.venue or e.address)]
    if not todo:
        return 0
    own = client is None
    client = client or httpx.AsyncClient(timeout=15, headers={"User-Agent": f"VybeEventsApp/2.0 ({contact_email or 'no-contact-set'})"})
    filled, lookups = 0, 0
    try:
        for ev in todo:
            q = ", ".join(p for p in [ev.venue, ev.address, city.name, "UK"] if p)
            cached = await db.geocache.find_one({"q": q})
            if cached is None:
                if lookups >= MAX_LOOKUPS_PER_RUN:
                    continue
                lookups += 1
                try:
                    r = await client.get(URL, params={"q": q, "format": "json", "limit": 1, "countrycodes": "gb"})
                    r.raise_for_status()
                    hits = r.json()
                    cached = {"q": q, "lat": float(hits[0]["lat"]), "lng": float(hits[0]["lon"])} if hits else {"q": q}
                except (httpx.HTTPError, ValueError, KeyError) as e:
                    log.warning("geocode failed for %r: %s", q, e)
                    cached = None
                if cached is not None:
                    await db.geocache.replace_one({"q": q}, cached, upsert=True)
                await asyncio.sleep(RATE_DELAY)
            if cached and cached.get("lat") is not None and _within(city, cached["lat"], cached["lng"]):
                ev.lat, ev.lng = cached["lat"], cached["lng"]
                filled += 1
    finally:
        if own:
            await client.aclose()
    return filled
