import httpx
import pytest

from app.cities import CITIES
from app.main import app
from app.pipeline.runner import run_city

from .conftest import FakeAnthropic, PAST, http_client


@pytest.fixture
async def client(db, settings):
    await run_city(CITIES["newcastle"], db, settings, http=http_client(), anthropic_client=FakeAnthropic())
    await db.events.insert_one({"id": "old", "name": "Past Gig", "city": "Newcastle", "date": PAST,
                                "endDate": None, "status": "scheduled", "source": "skiddle"})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


@pytest.mark.asyncio
async def test_events_list_filters(client):
    r = await client.get("/api/events", params={"city": "newcastle"})
    names = [e["name"] for e in r.json()]
    assert r.status_code == 200
    assert "Past Gig" not in names and "Comedy Night Live" not in names   # past + cancelled hidden
    dates = [e["date"] for e in r.json()]
    assert dates == sorted(dates)
    assert all("_id" not in e for e in r.json())

    free = (await client.get("/api/events", params={"city": "Newcastle", "budget": "free"})).json()
    assert {e["name"] for e in free} == {"Santa's Grotto Sing-along", "Grainger Market Christmas Late"}

    kids = (await client.get("/api/events", params={"city": "Newcastle", "kids_mode": True})).json()
    assert "Sam Fender - Live" not in {e["name"] for e in kids}   # Skiddle says 14+

    # regex characters in search must not break the query
    assert (await client.get("/api/events", params={"city": "Newcastle", "search": "(("})).status_code == 200


@pytest.mark.asyncio
async def test_ai_compat_endpoint_never_generates(client):
    r = await client.post("/api/ai/events", json={"city": "Newcastle", "force_refresh": True})
    body = r.json()
    assert body["source"] == "live" and body["count"] == 4
    assert body["lastRefreshed"]
    assert all(e["source"] != "ai_generated" for e in body["events"])


@pytest.mark.asyncio
async def test_cities_only_enabled(client):
    assert (await client.get("/api/cities")).json() == ["Newcastle"]


@pytest.mark.asyncio
async def test_social_flow(client):
    for uid, name in [("u1", "alice"), ("u2", "bob")]:
        r = await client.post("/api/user/profile", json={"user_id": uid, "username": name, "display_name": name.title()})
        assert r.status_code == 200
    assert (await client.post("/api/user/profile", json={"user_id": "u3", "username": "alice",
                                                         "display_name": "x"})).status_code == 409

    ev = (await client.get("/api/events", params={"city": "Newcastle"})).json()[0]["id"]
    for _ in range(2):  # marking twice must not double count
        await client.post("/api/user/going", json={"user_id": "u1", "username": "alice", "event_id": ev})
    assert (await client.get(f"/api/events/{ev}")).json()["attendeeCount"] == 1
    await client.delete(f"/api/user/going/u1/{ev}")
    assert (await client.get(f"/api/events/{ev}")).json()["attendeeCount"] == 0

    req = (await client.post("/api/friends/request", json={"from_user_id": "u1", "from_username": "alice",
                                                          "to_username": "bob"})).json()
    assert (await client.post("/api/friends/request", json={"from_user_id": "u2", "from_username": "bob",
                                                           "to_username": "alice"})).status_code == 400
    assert (await client.put(f"/api/friends/request/{req['id']}/accept", json={"user_id": "u1"})).status_code == 404
    assert (await client.put(f"/api/friends/request/{req['id']}/accept", json={"user_id": "u2"})).status_code == 200
    friends = (await client.get("/api/friends/u1")).json()
    assert friends[0]["username"] == "bob" and friends[0]["displayName"] == "Bob"

    for rating in (5, 3):  # second review from same user replaces the first
        await client.post("/api/reviews", json={"user_id": "u1", "username": "alice", "event_id": ev,
                                                 "rating": rating, "text": "ok"})
    e = (await client.get(f"/api/events/{ev}")).json()
    assert e["reviewCount"] == 1 and e["averageRating"] == 3.0
    assert (await client.post("/api/reviews", json={"user_id": "u1", "username": "a", "event_id": "nope",
                                                     "rating": 4, "text": "x"})).status_code == 404
