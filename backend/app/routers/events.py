from typing import Optional

from fastapi import APIRouter, HTTPException

from ..cities import CITIES, enabled_cities, get_city
from ..db import get_db
from ..util import clean, contains_ci, today_iso

router = APIRouter()

BUDGET_MAX = {"under5": 5, "under10": 10, "under20": 20}


def _city_name(city: str) -> str:
    c = get_city(city)
    return c.name if c else city


async def _find_events(city: str, *, category=None, budget=None, search=None,
                       kids_mode=False, skip=0, limit=20) -> list[dict]:
    db = get_db()
    query: dict = {
        "city": _city_name(city),
        "status": {"$ne": "cancelled"},
        # Hide past events: keep anything ending today or later
        "$or": [{"endDate": {"$gte": today_iso()}}, {"endDate": None, "date": {"$gte": today_iso()}}],
    }
    if kids_mode:
        query["ageSuitability"] = {"$in": ["All Ages", "Family"]}
    if category and category != "All":
        query["category"] = category
    if budget == "free":
        query["price"] = 0
    elif budget in BUDGET_MAX:
        query["price"] = {"$lte": BUDGET_MAX[budget]}
    if search:
        query["$and"] = [{"$or": [{"name": contains_ci(search)},
                                  {"description": contains_ci(search)},
                                  {"venue": contains_ci(search)}]}]
    cursor = db.events.find(query).sort([("date", 1), ("time", 1)]).skip(skip).limit(limit)
    return [clean(e) for e in await cursor.to_list(length=limit)]


@router.get("/events")
async def list_events(city: str = "Newcastle", category: Optional[str] = None,
                      budget: Optional[str] = None, search: Optional[str] = None,
                      kids_mode: bool = False, page: int = 1, limit: int = 20):
    limit = max(1, min(limit, 100))
    page = max(1, page)
    return await _find_events(city, category=category, budget=budget, search=search,
                              kids_mode=kids_mode, skip=(page - 1) * limit, limit=limit)


@router.get("/events/featured")
async def featured_events(city: Optional[str] = None):
    q: dict = {"isFeatured": True, "date": {"$gte": today_iso()}}
    if city:
        q["city"] = _city_name(city)
    cursor = get_db().events.find(q).sort("date", 1).limit(50)
    return [clean(e) for e in await cursor.to_list(length=50)]


@router.get("/events/{event_id}")
async def get_event(event_id: str):
    event = await get_db().events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return clean(event)


@router.get("/cities")
async def list_cities():
    """Cities that are switched on. Kept as a plain list of names for the frontend."""
    return [c.name for c in enabled_cities()]


@router.get("/cities/all")
async def list_all_cities():
    return [{"slug": c.slug, "name": c.name, "enabled": c.enabled, "lat": c.lat, "lng": c.lng}
            for c in CITIES.values()]


@router.post("/ai/events")
async def ai_events_compat(body: dict):
    """
    Backwards-compatible endpoint for the current home screen.
    It NO LONGER generates events: it returns real events gathered by the pipeline.
    `force_refresh` is ignored — refreshing is the scheduled pipeline's job.
    """
    city = body.get("city") or "Newcastle"
    events = await _find_events(city, limit=50)
    last_run = await get_db().pipeline_runs.find_one(
        {"city": _city_name(city), "status": "ok"}, sort=[("startedAt", -1)])
    return {
        "events": events,
        "source": "live" if events else "empty",
        "count": len(events),
        "lastRefreshed": last_run.get("finishedAt") if last_run else None,
    }
