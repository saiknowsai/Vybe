"""Skiddle API — strong UK coverage of gigs, club nights, comedy, festivals, family.

Docs: https://github.com/Skiddle/web-api  (free key on application)
The docs don't publish the response schema, so parsing is defensive. Check field
names against a real response once you have a key (run the pipeline with --dry-run).
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from ...cities import City
from ...models import Event
from ..normalize import guess_category, make_event, parse_price

log = logging.getLogger(__name__)
URL = "https://www.skiddle.com/api/v1/events/search/"
PAGE_SIZE = 100   # API maximum
MAX_PAGES = 5

CODE_MAP = {"FEST": "Music", "LIVE": "Music", "CLUB": "Music", "THEATRE": "Arts",
            "COMEDY": "Comedy", "EXHIB": "Arts", "KIDS": "Family", "BARPUB": "Food",
            "SPORT": "Sports", "ARTS": "Arts"}
SKIP_CODES = {"DATE"}  # dating events — not what Vybe is for


def _truthy(v) -> bool:
    return str(v).strip().lower() in {"1", "true", "yes"}


def _time(item: dict) -> str | None:
    doors = (item.get("openingtimes") or {}).get("doorsopen")
    if doors:
        return str(doors)[:5]
    start = item.get("startdate") or ""
    return start[11:16] if len(start) >= 16 else None


def parse(item: dict, city: City) -> Event | None:
    code = (item.get("EventCode") or item.get("eventcode") or "").upper()
    name = item.get("eventname") or item.get("name")
    date = (item.get("date") or item.get("startdate") or "")[:10]
    if not name or not date or code in SKIP_CODES:
        return None
    venue = item.get("venue") or {}
    addr = [venue.get("address"), venue.get("town"), venue.get("postcode")]
    minage = item.get("minage") or item.get("MinAge")
    try:
        min_age = int(minage) if minage not in (None, "", "0") else 0
    except (TypeError, ValueError):
        min_age = 0
    end = (item.get("enddate") or "")[:10] or None
    category = CODE_MAP.get(code) or guess_category(name)
    if code == "FEST":
        category = guess_category(name, default="Music")
    return make_event(
        provider="skiddle", external_id=str(item.get("id")) if item.get("id") else None,
        url=item.get("link"), city=city.name, name=name, date=date,
        endDate=end if end and end != date else None,
        time=_time(item),
        description=(item.get("description") or "")[:600],
        venue=venue.get("name", ""),
        address=", ".join(str(p) for p in addr if p),
        lat=float(venue["latitude"]) if venue.get("latitude") else None,
        lng=float(venue["longitude"]) if venue.get("longitude") else None,
        category=category,
        price=parse_price(item.get("entryprice")),
        imageUrl=item.get("largeimageurl") or item.get("imageurl"),
        ticketUrl=item.get("link"), ticketProvider="Skiddle",
        status="cancelled" if _truthy(item.get("cancelled")) else "scheduled",
        ageSuitability=f"{min_age}+" if min_age else ("Family" if code == "KIDS" else "All Ages"),
        isVerified=True,
    )


async def fetch(city: City, api_key: str, lookahead_days: int,
                client: httpx.AsyncClient | None = None) -> list[Event]:
    if not api_key:
        log.info("skiddle: no API key, skipping")
        return []
    today = datetime.now(timezone.utc).date()
    params = {
        "api_key": api_key, "latitude": city.lat, "longitude": city.lng,
        "radius": city.radius_miles, "country": "GB",
        "minDate": today.isoformat(), "maxDate": (today + timedelta(days=lookahead_days)).isoformat(),
        "order": "date", "description": 1, "limit": PAGE_SIZE,
    }
    own = client is None
    client = client or httpx.AsyncClient(timeout=20)
    events: list[Event] = []
    try:
        for page in range(MAX_PAGES):
            r = await client.get(URL, params=params | {"offset": page * PAGE_SIZE})
            r.raise_for_status()
            data = r.json()
            if str(data.get("error", "0")) not in {"0", "False", "false"}:
                raise RuntimeError(f"skiddle error: {data.get('errormessage') or data.get('error')}")
            results = data.get("results") or []
            for item in results:
                ev = parse(item, city)
                if ev:
                    events.append(ev)
            if len(results) < PAGE_SIZE:
                break
            await asyncio.sleep(0.5)
    finally:
        if own:
            await client.aclose()
    log.info("skiddle: %d events for %s", len(events), city.name)
    return events
