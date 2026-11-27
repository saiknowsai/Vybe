"""Claude + web search — grassroots events the ticket APIs miss (markets, community,
council, free family events).

Unlike the old code, Claude is NOT asked to invent events. It searches the web, and
every event it returns must cite a page that actually came back from its searches.
Anything without a verifiable source URL is dropped.

Cost control: searches are capped per run (max_uses) and per month (budget tracked
in Mongo). Web search is billed at $10 per 1,000 searches plus tokens.
"""
import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlsplit

from ...cities import City
from ...models import Event
from ..normalize import CATEGORIES, make_event, parse_price

log = logging.getLogger(__name__)

SYSTEM = """You find REAL upcoming local events by searching the web. You never invent events.
Rules:
- Only include an event if a page you found in your searches states its name and date.
- sourceUrl must be the exact URL of that page, copied from your search results.
- If a detail (time, price, venue address) is not on the page, use null. Do not guess.
- Write the description yourself in one or two plain sentences. Do not copy text from the page.
- Skip anything outside the requested date range or outside the city area."""

PROMPT = """Find upcoming events in and around {city} (within about {radius} miles), happening between {start} and {end}.

Focus on events that big ticketing sites tend to miss:
- markets, craft and makers fairs, food and drink festivals
- free and community events, council and library events
- family and kids activities, outdoor events, walks, seasonal events
Good places to look include: {sites}.
Skip big ticketed concerts, theatre and sport — we already have those.

Return up to 25 events as a JSON array inside <events></events> tags, nothing else after it.
Each item:
{{"name": str, "date": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" | null, "time": "HH:MM" | null,
  "venue": str, "address": str | null, "category": one of {cats},
  "price": number | null (0 if free), "priceLabel": str | null,
  "description": str, "isOutdoor": bool, "ageSuitability": "All Ages" | "Family" | "18+",
  "sourceUrl": str}}"""

_EVENTS_RE = re.compile(r"<events>(.*?)</events>", re.S)


def _norm_url(u: str) -> str:
    p = urlsplit(u.strip())
    return f"{p.netloc.lower().removeprefix('www.')}{p.path.rstrip('/')}"


def collect_result_urls(content: list) -> set[str]:
    """URLs that web search actually returned in this conversation."""
    urls: set[str] = set()
    for block in content:
        if _get(block, "type") == "web_search_tool_result":
            results = _get(block, "content")
            if isinstance(results, list):
                for r in results:
                    if _get(r, "url"):
                        urls.add(_norm_url(_get(r, "url")))
        if _get(block, "type") == "text":  # citations attached to text also count
            for c in _get(block, "citations") or []:
                if _get(c, "url"):
                    urls.add(_norm_url(_get(c, "url")))
    return urls


def _get(obj, key):
    return obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)


def parse_events(text: str, city: City, seen_urls: set[str], start: date, end: date) -> tuple[list[Event], int]:
    """Returns (events, rejected_count)."""
    m = _EVENTS_RE.search(text)
    if not m:
        return [], 0
    try:
        items = json.loads(m.group(1).strip())
    except json.JSONDecodeError:
        log.warning("claude_web: could not parse JSON")
        return [], 0
    events, rejected = [], 0
    for it in items if isinstance(items, list) else []:
        try:
            url = (it.get("sourceUrl") or "").strip()
            d = date.fromisoformat(it["date"])
            if not url or _norm_url(url) not in seen_urls:
                rejected += 1          # source not from real search results → don't trust it
                continue
            if not (start <= d <= end) and not (it.get("endDate") and date.fromisoformat(it["endDate"]) >= start):
                rejected += 1
                continue
            cat = it.get("category") if it.get("category") in CATEGORIES else None
            price = it.get("price")
            price = float(price) if isinstance(price, (int, float)) else parse_price(it.get("priceLabel"))
            events.append(make_event(
                provider="claude_web", external_id=None, url=url, city=city.name,
                name=it["name"], date=d.isoformat(),
                endDate=it.get("endDate") if it.get("endDate") != it["date"] else None,
                time=(it.get("time") or None),
                venue=it.get("venue") or "", address=it.get("address") or "",
                category=cat, price=price, priceLabel=it.get("priceLabel"),
                description=(it.get("description") or "")[:400],
                isOutdoor=bool(it.get("isOutdoor")),
                ageSuitability=it.get("ageSuitability") or "All Ages",
                ticketUrl=url, ticketProvider=urlsplit(url).netloc.removeprefix("www."),
                isVerified=True,  # verified = has a real cited source; coordinates come from geocoding
            ))
        except (KeyError, ValueError, TypeError):
            rejected += 1
    return events, rejected


async def fetch(city: City, *, api_key: str, model: str, max_searches: int,
                lookahead_days: int, client=None) -> tuple[list[Event], int]:
    """Returns (events, searches_used)."""
    if not api_key or max_searches <= 0:
        log.info("claude_web: disabled (no key or no search budget)")
        return [], 0
    if client is None:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=api_key)

    start = datetime.now(timezone.utc).date()
    end = start + timedelta(days=lookahead_days)
    messages = [{"role": "user", "content": PROMPT.format(
        city=city.name, radius=city.radius_miles, start=start, end=end,
        sites=", ".join(city.local_sites) or "local council and tourism sites",
        cats=", ".join(CATEGORIES))}]
    tools = [{
        "type": "web_search_20250305", "name": "web_search", "max_uses": max_searches,
        "user_location": {"type": "approximate", "city": city.name, "country": "GB",
                          "timezone": "Europe/London"},
    }]

    all_content: list = []
    searches = 0
    for _ in range(4):  # long searches can pause the turn; resume up to a few times
        resp = await client.messages.create(model=model, max_tokens=8000, system=SYSTEM,
                                            messages=messages, tools=tools)
        all_content.extend(resp.content)
        usage = getattr(resp, "usage", None)
        stu = _get(usage, "server_tool_use") if usage else None
        searches += (_get(stu, "web_search_requests") or 0) if stu else 0
        if resp.stop_reason != "pause_turn":
            break
        blocks = [b.model_dump(exclude_none=True) if hasattr(b, "model_dump") else b for b in resp.content]
        messages = messages + [{"role": "assistant", "content": blocks}]

    text = "".join(_get(b, "text") or "" for b in all_content if _get(b, "type") == "text")
    events, rejected = parse_events(text, city, collect_result_urls(all_content), start, end)
    log.info("claude_web: %d events for %s (%d rejected, %d searches)",
             len(events), city.name, rejected, searches)
    return events, searches
