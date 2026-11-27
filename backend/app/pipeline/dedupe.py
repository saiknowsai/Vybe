"""Merge the same event reported by several sources into one record."""
from ..models import Event

# Higher = more trusted for core fields (time, price, venue, coordinates)
PRIORITY = {"ticketmaster": 3, "skiddle": 3, "manual": 4, "claude_web": 1}


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
    if len(other.description) > len(primary.description) and _rank(other) >= 1:
        data["description"] = other.description
    if _age_floor(other.ageSuitability) > _age_floor(primary.ageSuitability):
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
    return list(by_key.values())
