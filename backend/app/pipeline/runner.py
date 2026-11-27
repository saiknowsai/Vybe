"""Run the event pipeline for a city: fetch → normalise → dedupe → geocode → store."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from ..cities import City
from ..config import Settings
from ..models import Event
from ..util import now_iso
from .dedupe import dedupe
from .geocode import geocode_missing
from .sources import claude_web, skiddle, ticketmaster

log = logging.getLogger(__name__)

ALL_SOURCES = ("ticketmaster", "skiddle", "claude_web")
APP_OWNED = {"attendeeCount", "averageRating", "reviewCount", "isFeatured", "isTrending"}
ENRICHED = {"food", "parking", "accessibility", "ageGuide"}
LEGACY_SOURCES = ["seeded", "ai_generated"]  # made-up data from the old Emergent build


def _month_key() -> str:
    return "claude_web:" + datetime.now(timezone.utc).strftime("%Y-%m")


async def claude_searches_left(db, settings: Settings) -> int:
    doc = await db.pipeline_usage.find_one({"_id": _month_key()})
    used = (doc or {}).get("searches", 0)
    return max(0, settings.claude_monthly_search_budget - used)


async def _record_searches(db, n: int) -> None:
    if n:
        await db.pipeline_usage.update_one({"_id": _month_key()}, {"$inc": {"searches": n}}, upsert=True)


async def store(db, events: list[Event]) -> tuple[int, int]:
    """Upsert events. Matches on dedupeKey so an event keeps its id (and its
    reviews / 'going' counts) across runs and sources. Returns (inserted, updated)."""
    inserted = updated = 0
    for ev in events:
        doc = ev.model_dump()
        existing = await db.events.find_one({"city": ev.city, "dedupeKey": ev.dedupeKey})
        if existing is None:
            existing = await db.events.find_one({"id": ev.id})
        if existing is None:
            await db.events.insert_one(dict(doc))
            inserted += 1
            continue
        known = {(s.get("provider"), s.get("externalId"), s.get("url")) for s in doc["sources"]}
        doc["sources"] += [s for s in existing.get("sources", [])
                           if (s.get("provider"), s.get("externalId"), s.get("url")) not in known]
        update = {k: v for k, v in doc.items() if k not in APP_OWNED and k != "id"}
        for k in ENRICHED:  # never wipe enrichment with an empty value
            if not update.get(k) and existing.get(k):
                update.pop(k, None)
        await db.events.update_one({"_id": existing["_id"]}, {"$set": update})
        updated += 1
    return inserted, updated


async def cleanup(db, city: City) -> int:
    """Remove fake legacy events, and long-past events nobody interacted with."""
    removed = (await db.events.delete_many({"source": {"$in": LEGACY_SOURCES}})).deleted_count
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    removed += (await db.events.delete_many({
        "city": city.name, "date": {"$lt": cutoff},
        "$or": [{"endDate": None}, {"endDate": {"$lt": cutoff}}],
        "reviewCount": {"$in": [0, None]}, "attendeeCount": {"$in": [0, None]},
    })).deleted_count
    return removed


async def run_city(city: City, db, settings: Settings, sources: tuple[str, ...] = ALL_SOURCES,
                   dry_run: bool = False, http=None, anthropic_client=None) -> dict:
    started = now_iso()
    summary: dict = {"city": city.name, "startedAt": started, "sources": {}, "errors": {}}
    collected: list[Event] = []

    async def run(name, coro):
        try:
            result = await coro
            evs, searches = result if isinstance(result, tuple) else (result, 0)
            summary["sources"][name] = len(evs)
            if searches:
                summary["claudeSearches"] = searches
                if not dry_run:
                    await _record_searches(db, searches)
            collected.extend(evs)
        except Exception as e:  # one broken source must not stop the others
            log.exception("%s failed for %s", name, city.name)
            summary["errors"][name] = str(e)[:300]

    jobs = []
    if "ticketmaster" in sources:
        jobs.append(run("ticketmaster", ticketmaster.fetch(
            city, settings.ticketmaster_api_key, settings.lookahead_days, http)))
    if "skiddle" in sources:
        jobs.append(run("skiddle", skiddle.fetch(
            city, settings.skiddle_api_key, settings.lookahead_days, http)))
    if "claude_web" in sources:
        left = await claude_searches_left(db, settings)
        cap = min(settings.claude_max_searches_per_city, left)
        if cap == 0 and settings.anthropic_api_key:
            summary["errors"]["claude_web"] = "monthly search budget used up"
        jobs.append(run("claude_web", claude_web.fetch(
            city, api_key=settings.anthropic_api_key, model=settings.claude_model,
            max_searches=cap, lookahead_days=settings.lookahead_days, client=anthropic_client)))
    await asyncio.gather(*jobs)

    merged = dedupe(collected)
    summary["collected"] = len(collected)
    summary["afterDedupe"] = len(merged)
    summary["geocoded"] = await geocode_missing(merged, city, db, settings.contact_email,
                                                http) if not dry_run else 0

    if dry_run:
        summary["preview"] = [
            {k: e.model_dump()[k] for k in ("name", "date", "time", "venue", "category", "priceLabel", "source", "sourceUrl")}
            for e in sorted(merged, key=lambda e: (e.date, e.time or ""))]
    else:
        summary["inserted"], summary["updated"] = await store(db, merged)
        summary["removed"] = await cleanup(db, city)

    summary["finishedAt"] = now_iso()
    summary["status"] = "ok" if collected or not summary["errors"] else "failed"
    if not dry_run:
        await db.pipeline_runs.insert_one({k: v for k, v in summary.items() if k != "preview"})
    return summary
