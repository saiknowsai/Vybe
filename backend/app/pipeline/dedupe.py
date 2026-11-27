"""Merge the same event reported by several sources into one record."""
from ..models import Event
from .normalize import CATEGORY_IMAGES

# Higher = more trusted for core fields (time, price, venue, coordinates)
# Skiddle is top so its data is kept exactly as given (their terms forbid modifying it);
# other sources only fill fields Skiddle left empty.
PRIORITY = {"manual": 5, "skiddle": 4, "ticketmaster": 3, "claude_web": 1}


def _rank(ev: Event) -> int:
    return PRIORITY.get(ev.source, 0)


def _age_floor(label: str) -> int:
    """'18+' -> 18, 'All Ages'/'Family' -> 0."""
    digits = "".join(ch for ch in label or "" if ch.isdigit())
    return int(digits) if digits else 0


def merge(primary: Event, other: Event) -> Event:
    """Keep primary's fields, fill gaps from other, union the sources."""
    data = primary.model_dump()
    for field, value in other.model_dump().items():
        if field in {"id", "sources", "source", "dedupeKey"}:
            continue
        if data.get(field) in (None, "", [], {}) and value not in (None, "", [], {}):
            data[field] = value
    if primary.source != "skiddle" and len(other.description) > len(primary.description):
        data["description"] = other.description
    if primary.source != "skiddle" and _age_floor(other.ageSuitability) > _age_floor(primary.ageSuitability):
        data["ageSuitability"] = other.ageSuitability   # safety: strictest age limit wins
    if other.status == "cancelled":
        data["status"] = "cancelled"
    seen = {(s.provider, s.externalId, s.url) for s in primary.sources}
    data["sources"] = [s.model_dump() for s in primary.sources] + [
        s.model_dump() for s in other.sources if (s.provider, s.externalId, s.url) not in seen]
    data["tags"] = sorted(set(primary.tags) | set(other.tags))
    return Event(**data)


def dedupe(events: list[Event]) -> list[Event]:
    by_key: dict[str, Event] = {}
    for ev in sorted(events, key=_rank, reverse=True):
        if ev.dedupeKey in by_key:
            by_key[ev.dedupeKey] = merge(by_key[ev.dedupeKey], ev)
        else:
            by_key[ev.dedupeKey] = ev
    out = list(by_key.values())
    for ev in out:  # only now fall back to a stock photo, so real images from any source win
        ev.imageUrl = ev.imageUrl or CATEGORY_IMAGES[ev.category]
    return out
