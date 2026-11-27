"""Skiddle API — strong UK coverage of gigs, club nights, comedy, festivals, family.

Docs: https://github.com/Skiddle/web-api  (free key on application)
The docs don't publish the response schema, so parsing is defensive. Check field
names against a real response once you have a key (run the pipeline with --dry-run).

TERMS (https://www.skiddle.com/api/join.php) — summary, read the full text:
- Non-commercial use only. Agree commercial terms with Skiddle before monetising.
- Don't modify their data: names, descriptions and prices are stored as given.
- Credit Skiddle by name and logo wherever their data is shown, and link with
  the event link from the API (`ticketUrl` / `sourceUrl`).
- Send a User-Agent naming the app, version and URL; one request at a time;
  short timeouts; back off on 429/5xx; cache, don't call per user.
"""
import asyncio
import json
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone

import httpx

from ...cities import City
from ...models import Event
from ..http import get_with_backoff, user_agent
from ..normalize import guess_category, make_event, parse_price

log = logging.getLogger(__name__)
URL = "https://www.skiddle.com/api/v1/events/search/"
PAGE_SIZE = 100   # API maximum
MAX_PAGES = 5
VERSION = "2.0"
SAVED_DIR = Path(__file__).resolve().parents[3] / ".cache"  # backend/.cache

# Skiddle EventCode -> fallback Vybe category. Names are still checked first for
# clearer signals (a "Christmas Market" tagged SEASONAL becomes Markets).
CODE_MAP = {"FEST": "Music", "LIVE": "Music", "CLUB": "Music", "THEATRE": "Arts",
            "COMEDY": "Comedy", "EXHIB": "Arts", "KIDS": "Family", "BARPUB": "Food",
            "FOOD": "Food", "SPORT": "Sports", "ARTS": "Arts", "EXPER": "Arts",
            "SEASONAL": "Arts", "CONF": "Arts", "RELIG": "Arts"}
CLEAR_CODES = {"LIVE", "CLUB", "COMEDY", "KIDS", "SPORT", "THEATRE"}
SKIP_CODES = {"DATE"}  # dating events — not what Vybe is for

# Skiddle's terms bar using their data on anything promoting gambling, so casino and
# bingo-hall listings are dropped. Corporate "party bookings" are dropped as noise.
BLOCKED_WORDS = ("casino", "buzz bingo", "mecca bingo", "party bookings")


def _blocked(item: dict) -> bool:
    text = f"{item.get('eventname', '')} {(item.get('venue') or {}).get('name', '')}".lower()
    return any(w in text for w in BLOCKED_WORDS)


def _price(item: dict) -> tuple[float | None, float | None, str | None]:
    """Price lives in ticketpricing {minPrice, maxPrice}; entryprice is usually empty."""
    tp = item.get("ticketpricing") or {}
    lo, hi = tp.get("minPrice"), tp.get("maxPrice")
    if isinstance(lo, (int, float)):
        lo, hi = float(lo), float(hi) if isinstance(hi, (int, float)) else float(lo)
        fmt = lambda v: f"£{v:,.2f}".replace(".00", "")
        if hi == 0:
            return 0.0, 0.0, "Free"
        if lo == hi:
            return lo, hi, fmt(lo)
        return lo, hi, f"{'Free' if lo == 0 else fmt(lo)} – {fmt(hi)}"
    raw = item.get("entryprice")
    if raw:
        v = parse_price(raw)
        return v, v, str(raw)
    return None, None, None


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
    if not name or not date or code in SKIP_CODES or _blocked(item):
        return None
    venue = item.get("venue") or {}
    addr = [venue.get("address"), venue.get("town"), venue.get("postcode")]
    minage = item.get("minage") or item.get("MinAge")
    try:
        min_age = int(minage) if minage not in (None, "", "0") else 0
    except (TypeError, ValueError):
        min_age = 0
    end = (item.get("enddate") or "")[:10] or None
    genres = " ".join(g.get("name", "") for g in item.get("genres") or [])
    if code in CLEAR_CODES:   # Skiddle's own category is specific enough to trust
        category = "Comedy" if "comedy" in name.lower() else CODE_MAP[code]
    else:
        category = guess_category(f"{name} {genres}", default=CODE_MAP.get(code, "Arts"))
    price, price_max, price_text = _price(item)
    status = "scheduled"
    if _truthy(item.get("cancelled")):
        status = "cancelled"
    elif item.get("rescheduledDate"):
        status = "rescheduled"
    return make_event(
        provider="skiddle", external_id=str(item.get("id")) if item.get("id") else None,
        url=item.get("link"), city=city.name, name=name, date=date,
        endDate=end if end and end != date else None,
        time=_time(item),
        description=item.get("description") or "",          # unmodified (Skiddle terms)
        venue=venue.get("name", ""),
        address=", ".join(str(p) for p in addr if p),
        lat=float(venue["latitude"]) if venue.get("latitude") else None,
        lng=float(venue["longitude"]) if venue.get("longitude") else None,
        category=category,
        price=price, max_price=price_max, priceLabel=price_text,
        imageUrl=item.get("xlargeimageurl") or item.get("largeimageurl") or item.get("imageurl"),
        ticketUrl=item.get("link"), ticketProvider="Skiddle",
        status=status,
        tags=[g.get("name", "").lower() for g in item.get("genres") or [] if g.get("name")][:6],
        ageSuitability=f"{min_age}+" if min_age else ("Family" if code == "KIDS" else "All Ages"),
        isVerified=True,
    )


def _saved_path(city: City) -> Path:
    return SAVED_DIR / f"skiddle_{city.slug}_{datetime.now(timezone.utc).date()}.json"


async def fetch(city: City, api_key: str, lookahead_days: int,
                client: httpx.AsyncClient | None = None, *, app_url: str = "",
                use_saved: bool = False) -> list[Event]:
    """use_saved: reuse today's saved raw response instead of calling the API
    (Skiddle asks developers to work against a saved copy while building)."""
    if not api_key:
        log.info("skiddle: no API key, skipping")
        return []
    saved = _saved_path(city)
    if use_saved and saved.exists():
        pages = json.loads(saved.read_text())
        log.info("skiddle: using saved response %s", saved.name)
    else:
        pages = await _download(city, api_key, lookahead_days, client, app_url)
        try:
            SAVED_DIR.mkdir(exist_ok=True)
            saved.write_text(json.dumps(pages))
        except OSError:
            pass
    events = [ev for page in pages for item in page.get("results") or [] if (ev := parse(item, city))]
    log.info("skiddle: %d events for %s", len(events), city.name)
    return events


async def _download(city: City, api_key: str, lookahead_days: int, client, app_url: str) -> list[dict]:
    today = datetime.now(timezone.utc).date()
    params = {
        "api_key": api_key, "latitude": city.lat, "longitude": city.lng,
        "radius": city.radius_miles, "country": "GB",
        "minDate": today.isoformat(), "maxDate": (today + timedelta(days=lookahead_days)).isoformat(),
        "order": "date", "description": 1, "limit": PAGE_SIZE,
    }
    headers = {"User-Agent": user_agent(VERSION, app_url or "https://github.com/saiknowsai/Vybe")}
    own = client is None
    client = client or httpx.AsyncClient()
    pages: list[dict] = []
    try:
        for page in range(MAX_PAGES):            # one request at a time, with a pause
            r = await get_with_backoff(client, URL, params=params | {"offset": page * PAGE_SIZE},
                                       headers=headers, timeout=8)
            data = r.json()
            if str(data.get("error", "0")) not in {"0", "False", "false"}:
                raise RuntimeError(f"skiddle error: {data.get('errormessage') or data.get('error')}")
            pages.append(data)
            if len(data.get("results") or []) < PAGE_SIZE:
                break
            await asyncio.sleep(1.0)
    finally:
        if own:
            await client.aclose()
    return pages
