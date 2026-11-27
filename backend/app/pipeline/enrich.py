"""Fill the Food, Parking, Accessibility and Age Guide tabs with real data.

- Age Guide: from the event's own minimum age. No lookups.
- Food / Parking / Accessibility: from OpenStreetMap via the Overpass API. ONE request
  per city downloads every car park, station, bus stop, eatery and wheelchair-tagged
  place around it; the snapshot is kept in Mongo (`osm_snapshots`) for 30 days and
  each venue's nearest places are worked out locally. Free, no key, and one call a
  month per city is far gentler on the public servers than one per venue.

Nothing is guessed: if OpenStreetMap has nothing near a venue, the tab stays empty
and the app shows "not available". OpenStreetMap data needs the credit
"© OpenStreetMap contributors" wherever it is shown, so it travels with the data.
"""
import asyncio
import logging
import math
import re
from datetime import datetime, timedelta, timezone

import httpx

from ..models import Event
from ..util import now_iso
from .http import request_with_backoff, user_agent

log = logging.getLogger(__name__)

# Public Overpass servers, tried in order. The main one often answers 502/504 when busy.
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
OSM_CREDIT = "© OpenStreetMap contributors"
REFRESH_DAYS = 30
SNAPSHOT_TIMEOUT = 150    # seconds; a city-wide query takes a while on a busy server
RATE_DELAY = 2.0          # seconds between servers
WALK_M_PER_MIN = 80       # ~4.8 km/h

# Search radius per thing, in metres
R_PARKING, R_STATION, R_BUS, R_FOOD, R_VENUE = 800, 1200, 350, 400, 80


# ─── Age guide ───────────────────────────────────────────────────────────────

def age_guide(age_label: str) -> dict:
    digits = "".join(ch for ch in age_label or "" if ch.isdigit())
    n = int(digits) if digits else 0
    if n >= 18:
        return {"suitableFor": f"Adults ({n}+)",
                "restrictions": f"{n}+ only. Bring photo ID: venues check at the door.", "sections": []}
    if n > 0:
        return {"suitableFor": f"Ages {n} and over",
                "restrictions": f"Minimum age {n}. Rules for under-18s vary by venue, so check the listing.",
                "sections": []}
    if (age_label or "").lower() == "family":
        return {"suitableFor": "Families and children", "restrictions": "No age limit listed.", "sections": []}
    return {"suitableFor": "All ages", "restrictions": "No age limit listed.", "sections": []}


# ─── OpenStreetMap lookups ───────────────────────────────────────────────────

def _metres(lat1, lng1, lat2, lng2) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _walk(m: float) -> str:
    return f"{max(1, math.ceil(m / WALK_M_PER_MIN))} min walk"


def _words(text: str) -> set[str]:
    stop = {"the", "newcastle", "and", "of", "bar", "club", "venue", "upon", "tyne"}
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if w not in stop and len(w) > 2}


def overpass_query(lat: float, lng: float) -> str:
    at = f"{lat:.6f},{lng:.6f}"
    return f"""[out:json][timeout:25];
(
  nwr(around:{R_PARKING},{at})["amenity"="parking"];
  nwr(around:{R_STATION},{at})["railway"~"^(station|halt)$"];
  node(around:{R_BUS},{at})["highway"="bus_stop"];
  nwr(around:{R_FOOD},{at})["amenity"~"^(restaurant|cafe|fast_food)$"]["name"];
  nwr(around:{R_VENUE},{at})["wheelchair"];
);
out center tags;"""


def city_query(lat: float, lng: float, radius_m: int) -> str:
    at = f"{lat:.5f},{lng:.5f}"
    return f"""[out:json][timeout:{SNAPSHOT_TIMEOUT - 10}];
(
  nwr(around:{radius_m},{at})["amenity"="parking"]["access"!~"^(private|no|customers)$"];
  nwr(around:{radius_m},{at})["railway"~"^(station|halt)$"];
  node(around:{radius_m},{at})["highway"="bus_stop"]["name"];
  nwr(around:{radius_m},{at})["amenity"~"^(restaurant|cafe|fast_food)$"]["name"];
  nwr(around:{radius_m},{at})["wheelchair"]["name"];
);
out center tags qt;"""


KEEP_TAGS = ("name", "amenity", "access", "parking", "railway", "station", "network",
             "operator", "highway", "wheelchair")


def compact(elements: list[dict]) -> list[dict]:
    """Keep only what summarise() reads, so a city fits comfortably in one Mongo document."""
    out = []
    for el in elements:
        c = el.get("center") or el
        if c.get("lat") is None or c.get("lon") is None:
            continue
        tags = {k: v for k, v in (el.get("tags") or {}).items() if k in KEEP_TAGS}
        out.append({"lat": round(c["lat"], 6), "lon": round(c["lon"], 6), "tags": tags})
    return out


def near(elements: list[dict], lat: float, lng: float, metres: float) -> list[dict]:
    dlat = metres / 111_000
    dlng = metres / (111_000 * max(0.2, math.cos(math.radians(lat))))
    return [e for e in elements if abs(e["lat"] - lat) <= dlat and abs(e["lon"] - lng) <= dlng]


def summarise(elements: list[dict], lat: float, lng: float, venue_name: str) -> dict:
    """Turn raw Overpass elements into the app's tab shapes."""
    def place(el):
        c = el.get("center") or el
        return c.get("lat"), c.get("lon")

    rows = []
    for el in elements:
        la, lo = place(el)
        if la is None or lo is None:
            continue
        rows.append((_metres(lat, lng, la, lo), el.get("tags") or {}))
    rows.sort(key=lambda r: r[0])
    limit = lambda t: (R_PARKING if t.get("amenity") == "parking" else
                       R_STATION if t.get("railway") else
                       R_BUS if t.get("highway") == "bus_stop" else
                       R_FOOD if t.get("amenity") in {"restaurant", "cafe", "fast_food"} else R_VENUE)
    rows = [(d, t) for d, t in rows if d <= limit(t)]

    car_parks, seen = [], set()
    for d, t in rows:
        if t.get("amenity") != "parking" or t.get("access") in {"private", "no", "customers"}:
            continue
        name = t.get("name") or ("Multi-storey car park" if t.get("parking") == "multi-storey" else None)
        if not name or name in seen:
            continue
        seen.add(name)
        car_parks.append(f"{name} ({_walk(d)})")
        if len(car_parks) == 3:
            break

    transport, seen = [], set()
    for d, t in rows:
        name = t.get("name")
        if not name or name in seen:
            continue
        if t.get("railway") in {"station", "halt"}:
            net = f"{t.get('network', '')} {t.get('operator', '')}".lower()
            metro = "metro" in net or "nexus" in net or t.get("station") in {"subway", "light_rail"}
            label = f"{'Metro' if metro else 'Train'}: {name}"
        elif t.get("highway") == "bus_stop":
            if sum(1 for x in transport if x.startswith("Bus")) >= 2:
                continue
            label = f"Bus stop: {name}"
        else:
            continue
        seen.add(name)
        transport.append(f"{label} ({_walk(d)})")
        if len(transport) == 5:
            break

    food, seen = [], set()
    for d, t in rows:
        if t.get("amenity") not in {"restaurant", "cafe", "fast_food"} or not t.get("name"):
            continue
        if t["name"] in seen or (_words(t["name"]) and _words(t["name"]) <= _words(venue_name)):
            continue  # skip the venue itself
        seen.add(t["name"])
        kind = {"restaurant": "restaurant", "cafe": "café", "fast_food": "takeaway"}[t["amenity"]]
        food.append(f"{t['name']}, {kind} ({_walk(d)})")
        if len(food) == 5:
            break

    # Wheelchair: only trust a tag on something that IS the venue (name overlap, within 80 m)
    wheel = None
    vwords = _words(venue_name)
    for d, t in rows:
        if d <= R_VENUE and t.get("wheelchair") and vwords & _words(t.get("name", "")):
            wheel = t["wheelchair"]
            break
    if wheel == "yes":
        details = "Wheelchair accessible, according to OpenStreetMap."
    elif wheel == "limited":
        details = "Limited wheelchair access, according to OpenStreetMap."
    elif wheel == "no":
        details = "Not wheelchair accessible, according to OpenStreetMap."
    else:
        details = "No accessibility details found yet. Contact the venue before you go."
    details += " Hearing loop, BSL and quiet-space details aren't known: check with the venue."

    return {
        "food": {"onSite": [], "nearby": food, "credit": OSM_CREDIT} if food else {},
        "parking": {"carParks": car_parks, "publicTransport": transport, "credit": OSM_CREDIT}
                   if (car_parks or transport) else {},
        "accessibility": {"wheelchair": wheel == "yes", "details": details,
                          "credit": OSM_CREDIT if wheel else None},
    }


async def _overpass(client: httpx.AsyncClient, query: str, headers: dict) -> list[dict]:
    """Try each public server once. Raise if all fail."""
    last: Exception | None = None
    for url in OVERPASS_URLS:
        try:
            r = await request_with_backoff(client, "POST", url, data={"data": query},
                                           headers=headers, timeout=SNAPSHOT_TIMEOUT, attempts=1)
            return r.json().get("elements", [])
        except (httpx.HTTPError, ValueError) as e:
            last = e
            log.info("overpass %s failed (%s), trying next server", url.split("/")[2], type(e).__name__)
            await asyncio.sleep(RATE_DELAY)
    raise last or RuntimeError("no overpass servers")


async def city_snapshot(city, db, client, headers) -> tuple[list[dict], str]:
    """Returns (elements, how) where how is 'cache', 'fresh', 'stale' or 'none'."""
    doc = await db.osm_snapshots.find_one({"_id": city.slug})
    fresh_after = (datetime.now(timezone.utc) - timedelta(days=REFRESH_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    if doc and doc.get("checkedAt", "") >= fresh_after:
        return doc["elements"], "cache"
    radius_m = int(city.radius_miles * 1609 + R_STATION)   # cover venues at the edge too
    try:
        elements = compact(await _overpass(client, city_query(city.lat, city.lng, radius_m), headers))
    except (httpx.HTTPError, ValueError, RuntimeError) as e:
        log.warning("OpenStreetMap servers busy (%s); using %s", type(e).__name__,
                    "the previous snapshot" if doc else "no enrichment this run")
        return (doc["elements"], "stale") if doc else ([], "none")
    await db.osm_snapshots.replace_one(
        {"_id": city.slug}, {"_id": city.slug, "checkedAt": now_iso(), "count": len(elements),
                             "elements": elements}, upsert=True)
    log.info("OpenStreetMap snapshot for %s: %d places", city.name, len(elements))
    return elements, "fresh"


def venue_key(ev: Event) -> str | None:
    if ev.lat is None or ev.lng is None or not ev.venue:
        return None
    slug = re.sub(r"[^a-z0-9]+", "-", ev.venue.lower()).strip("-")
    return f"{slug}@{ev.lat:.3f},{ev.lng:.3f}"


async def enrich(events: list[Event], db, *, city=None, app_url: str = "", dry_run: bool = False,
                 client: httpx.AsyncClient | None = None) -> dict:
    """Mutates events in place. Returns a small summary for the run log."""
    for ev in events:
        if not ev.ageGuide:
            ev.ageGuide = age_guide(ev.ageSuitability)

    venues: dict[str, Event] = {}
    for ev in events:
        k = venue_key(ev)
        if k:
            venues.setdefault(k, ev)
    summary = {"venues": len(venues), "venuesEnriched": 0, "snapshot": "skipped"}
    if dry_run or not venues or city is None:
        return summary

    own = client is None
    client = client or httpx.AsyncClient()
    try:
        elements, how = await city_snapshot(city, db, client, {"User-Agent": user_agent("2.0", app_url)})
    finally:
        if own:
            await client.aclose()
    summary["snapshot"] = how
    summary["places"] = len(elements)
    if not elements:
        return summary

    found = {k: summarise(near(elements, ev.lat, ev.lng, R_STATION), ev.lat, ev.lng, ev.venue)
             for k, ev in venues.items()}
    summary["venuesEnriched"] = sum(1 for i in found.values() if i["food"] or i["parking"])
    for ev in events:
        info = found.get(venue_key(ev) or "")
        if not info:
            continue
        for field in ("food", "parking", "accessibility"):
            if not getattr(ev, field) and info.get(field):
                setattr(ev, field, info[field])
    return summary
