import json
from datetime import date, timedelta
from types import SimpleNamespace

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

from app import db as dbmod
from app.config import Settings

D1 = (date.today() + timedelta(days=3)).isoformat()
D2 = (date.today() + timedelta(days=10)).isoformat()
PAST = (date.today() - timedelta(days=60)).isoformat()


@pytest.fixture(autouse=True)
def fast_and_isolated(monkeypatch, tmp_path):
    monkeypatch.setattr("app.pipeline.geocode.RATE_DELAY", 0)
    monkeypatch.setattr("app.pipeline.http.BASE_DELAY", 0)
    monkeypatch.setattr("app.pipeline.enrich.RATE_DELAY", 0)
    monkeypatch.setattr("app.pipeline.sources.skiddle.SAVED_DIR", tmp_path)

    async def no_sleep(*_):
        return None
    monkeypatch.setattr("app.pipeline.sources.skiddle.asyncio.sleep", no_sleep)


@pytest.fixture
def db():
    mock = AsyncMongoMockClient()["vybe_test"]
    dbmod.set_db(mock)
    yield mock
    dbmod.set_db(None)


@pytest.fixture
def settings():
    return Settings(mongo_url="mongodb://unused", ticketmaster_api_key="tm", skiddle_api_key="sk",
                    anthropic_api_key="ak", claude_max_searches_per_city=5,
                    claude_monthly_search_budget=100, contact_email="test@example.com")


def tm_payload():
    return {
        "_embedded": {"events": [
            {
                "id": "TM1", "name": "Sam Fender", "url": "https://www.ticketmaster.co.uk/event/TM1",
                "dates": {"start": {"localDate": D1, "localTime": "19:30:00"}, "status": {"code": "onsale"}},
                "classifications": [{"primary": True, "segment": {"name": "Music"}, "genre": {"name": "Rock"}}],
                "priceRanges": [{"type": "standard", "currency": "GBP", "min": 45.0, "max": 85.0}],
                "images": [{"ratio": "16_9", "url": "https://img/tm1-small.jpg", "width": 640},
                           {"ratio": "16_9", "url": "https://img/tm1-big.jpg", "width": 2048}],
                "_embedded": {"venues": [{"name": "Utilita Arena Newcastle", "postalCode": "NE4 7NA",
                                          "address": {"line1": "Arena Way"}, "city": {"name": "Newcastle upon Tyne"},
                                          "location": {"latitude": "54.9666", "longitude": "-1.6214"}}]},
            },
            {
                "id": "TM2", "name": "Comedy Night Live", "url": "https://www.ticketmaster.co.uk/event/TM2",
                "dates": {"start": {"localDate": D2, "localTime": "20:00:00"}, "status": {"code": "canceled"}},
                "classifications": [{"primary": True, "segment": {"name": "Arts & Theatre"}, "genre": {"name": "Comedy"}}],
                "_embedded": {"venues": [{"name": "Tyne Theatre"}]},
            },
        ]},
        "page": {"totalPages": 1},
    }


def sk_payload():
    return {"error": 0, "results": [
        {   # same Sam Fender gig as Ticketmaster → should be merged
            "id": 999, "EventCode": "LIVE", "eventname": "Sam Fender - Live",
            "venue": {"name": "Utilita Arena Newcastle", "town": "Newcastle", "postcode": "NE4 7NA",
                      "latitude": 54.9666, "longitude": -1.6214},
            "date": D1, "startdate": f"{D1}T19:30:00+00:00", "entryprice": "",
            "ticketpricing": {"minPrice": 45, "maxPrice": 45}, "genres": [{"genreid": "1", "name": "Indie"}],
            "link": "https://www.skiddle.com/e/999", "description": "Hometown gig.", "minage": "14",
        },
        {
            "id": 1000, "EventCode": "KIDS", "eventname": "Santa's Grotto Sing-along",
            "venue": {"name": "Eldon Square", "latitude": "54.9750", "longitude": "-1.6150"},
            "date": D2, "entryprice": "", "ticketpricing": {"minPrice": 0, "maxPrice": 0},
            "link": "https://www.skiddle.com/e/1000", "cancelled": "0",
        },
        {"id": 1002, "EventCode": "FOOD", "eventname": "Black Friday - Buzz Bingo Newcastle", "date": D2,
         "venue": {"name": "Buzz Bingo Newcastle"}, "link": "https://www.skiddle.com/e/1002"},
        {"id": 1003, "EventCode": "CLUB", "eventname": "Boxing Day Special", "date": D2,
         "venue": {"name": "NX Newcastle"}, "ticketpricing": {"minPrice": 0, "maxPrice": 12},
         "link": "https://www.skiddle.com/e/1003"},
        {"id": 1001, "EventCode": "DATE", "eventname": "Speed Dating", "date": D2, "venue": {}},
    ]}


OVERPASS_CALLS = []


def overpass_payload():
    """Shaped like a real Overpass response around Utilita Arena (54.9666, -1.6214)."""
    return {"elements": [
        {"type": "way", "id": 1, "center": {"lat": 54.9672, "lon": -1.6200},
         "tags": {"amenity": "parking", "name": "Arena Way car park"}},
        {"type": "way", "id": 2, "center": {"lat": 54.9660, "lon": -1.6190},
         "tags": {"amenity": "parking", "access": "private", "name": "Staff only"}},
        {"type": "node", "id": 3, "lat": 54.9740, "lon": -1.6210,
         "tags": {"railway": "station", "name": "St James", "network": "Tyne and Wear Metro"}},
        {"type": "node", "id": 4, "lat": 54.9684, "lon": -1.6174,
         "tags": {"railway": "station", "name": "Newcastle", "network": "National Rail"}},
        {"type": "node", "id": 5, "lat": 54.9670, "lon": -1.6220,
         "tags": {"highway": "bus_stop", "name": "Railway Street"}},
        {"type": "node", "id": 6, "lat": 54.9675, "lon": -1.6205,
         "tags": {"amenity": "restaurant", "name": "Pizza Punks"}},
        {"type": "node", "id": 7, "lat": 54.9677, "lon": -1.6200,
         "tags": {"amenity": "cafe", "name": "Arena Café"}},
        {"type": "way", "id": 8, "center": {"lat": 54.9666, "lon": -1.6214},
         "tags": {"name": "Utilita Arena Newcastle", "wheelchair": "yes"}},
    ]}


def http_client():
    def handler(req: httpx.Request):
        if "overpass" in req.url.host:
            OVERPASS_CALLS.append(req.content.decode())
            assert req.headers["User-Agent"].startswith("VybeEvents/")
            return httpx.Response(200, json=overpass_payload())
        if "ticketmaster" in req.url.host:
            assert req.url.params["apikey"] == "tm" and req.url.params["geoPoint"]
            return httpx.Response(200, json=tm_payload())
        if "skiddle" in req.url.host:
            assert req.headers["User-Agent"].startswith("VybeEvents/")
            return httpx.Response(200, json=sk_payload())
        if "nominatim" in req.url.host:
            return httpx.Response(200, json=[{"lat": "54.9735", "lon": "-1.6130"}])
        return httpx.Response(404)
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


class FakeAnthropic:
    """Mimics the Messages API response shape for a web-search turn."""

    def __init__(self):
        self.calls = 0
        self.messages = self

    async def create(self, **kwargs):
        self.calls += 1
        assert kwargs["tools"][0]["type"].startswith("web_search")
        events = [
            {"name": "Grainger Market Christmas Late", "date": D1, "endDate": None, "time": "17:00",
             "venue": "Grainger Market", "address": "Grainger St, NE1 5QQ", "category": "Markets",
             "price": 0, "priceLabel": "Free entry", "description": "Late-night shopping with food stalls.",
             "isOutdoor": False, "ageSuitability": "All Ages",
             "sourceUrl": "https://www.newcastlegateshead.com/whats-on/grainger-late"},
            {"name": "Made-up Festival", "date": D2, "venue": "Nowhere", "category": "Music",
             "description": "x", "sourceUrl": "https://example.com/not-in-search-results"},
            {"name": "Old Fair", "date": PAST, "venue": "Town Moor", "category": "Family",
             "sourceUrl": "https://www.newcastlegateshead.com/whats-on/grainger-late"},
        ]
        content = [
            SimpleNamespace(type="server_tool_use", name="web_search", input={"query": "newcastle markets"}),
            SimpleNamespace(type="web_search_tool_result", content=[
                SimpleNamespace(type="web_search_result", url="https://newcastlegateshead.com/whats-on/grainger-late/",
                                title="Grainger Market Late")]),
            SimpleNamespace(type="text", text=f"<events>{json.dumps(events)}</events>", citations=None),
        ]
        return SimpleNamespace(content=content, stop_reason="end_turn",
                               usage=SimpleNamespace(server_tool_use=SimpleNamespace(web_search_requests=3)))
