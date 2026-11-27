import pytest

from app.cities import CITIES
from app.pipeline.geohash import encode
from app.pipeline.normalize import dedupe_key, parse_price
from app.pipeline.runner import run_city

from .conftest import D1, D2, FakeAnthropic, http_client

NCL = CITIES["newcastle"]


def test_geohash_known_value():
    assert encode(57.64911, 10.40744, 11) == "u4pruydqqvj"   # reference value from the geohash spec


@pytest.mark.parametrize("text,expected", [("£10.00", 10.0), ("Free", 0.0), ("From £8.50 - £12", 8.5),
                                           ("tbc", None), (None, None), (0, 0.0)])
def test_parse_price(text, expected):
    assert parse_price(text) == expected


def test_dedupe_key_matches_across_sources():
    assert dedupe_key("Sam Fender", D1, "Utilita Arena Newcastle") == \
           dedupe_key("Sam Fender - Live", D1, "Utilita Arena")


@pytest.mark.asyncio
async def test_full_run(db, settings):
    fake = FakeAnthropic()
    s = await run_city(NCL, db, settings, http=http_client(), anthropic_client=fake)

    assert s["status"] == "ok", s
    assert s["errors"] == {}
    assert s["sources"] == {"ticketmaster": 2, "skiddle": 2, "claude_web": 1}
    assert s["afterDedupe"] == 4               # Sam Fender merged across TM + Skiddle

    events = {e["name"]: e async for e in db.events.find({})}
    fender = events["Sam Fender"]
    assert {x["provider"] for x in fender["sources"]} == {"ticketmaster", "skiddle"}
    assert fender["imageUrl"] == "https://img/tm1-big.jpg"
    assert fender["priceLabel"] == "From £45" and fender["time"] == "19:30"
    assert fender["description"] == "Hometown gig."   # filled from Skiddle

    assert events["Comedy Night Live"]["status"] == "cancelled"
    assert events["Comedy Night Live"]["category"] == "Comedy"
    assert events["Santa's Grotto Sing-along"]["category"] == "Family"
    assert events["Santa's Grotto Sing-along"]["price"] == 0

    market = events["Grainger Market Christmas Late"]
    assert market["source"] == "claude_web" and market["category"] == "Markets"
    assert market["lat"] == pytest.approx(54.9735)          # geocoded, not model-supplied
    assert "Made-up Festival" not in events                 # source URL never appeared in search results
    assert "Old Fair" not in events                         # outside date range
    assert "Speed Dating" not in events

    usage = await db.pipeline_usage.find_one({})
    assert usage["searches"] == 3


@pytest.mark.asyncio
async def test_rerun_keeps_ids_and_social_counts(db, settings):
    await run_city(NCL, db, settings, http=http_client(), anthropic_client=FakeAnthropic())
    fender = await db.events.find_one({"name": "Sam Fender"})
    await db.events.update_one({"_id": fender["_id"]}, {"$set": {"attendeeCount": 7, "reviewCount": 2}})

    s = await run_city(NCL, db, settings, http=http_client(), anthropic_client=FakeAnthropic())
    assert s["inserted"] == 0 and s["updated"] == 4
    again = await db.events.find_one({"name": "Sam Fender"})
    assert again["id"] == fender["id"]
    assert again["attendeeCount"] == 7 and again["reviewCount"] == 2
    assert await db.events.count_documents({}) == 4


@pytest.mark.asyncio
async def test_legacy_fake_events_removed(db, settings):
    await db.events.insert_one({"id": "evt_x", "name": "Fake", "city": "Newcastle", "date": D2, "source": "ai_generated"})
    await db.events.insert_one({"id": "evt_y", "name": "Seed", "city": "London", "date": D2, "source": "seeded"})
    await run_city(NCL, db, settings, sources=("skiddle",), http=http_client())
    assert await db.events.count_documents({"source": {"$in": ["seeded", "ai_generated"]}}) == 0


@pytest.mark.asyncio
async def test_claude_budget_respected(db, settings):
    await db.pipeline_usage.insert_one({"_id": __import__("app.pipeline.runner", fromlist=["x"])._month_key(),
                                        "searches": 100})
    fake = FakeAnthropic()
    s = await run_city(NCL, db, settings, sources=("claude_web",), anthropic_client=fake)
    assert fake.calls == 0
    assert "budget" in s["errors"]["claude_web"]


@pytest.mark.asyncio
async def test_missing_keys_skip_sources(db, settings):
    settings.ticketmaster_api_key = settings.skiddle_api_key = settings.anthropic_api_key = ""
    s = await run_city(NCL, db, settings, http=http_client())
    assert s["sources"] == {"ticketmaster": 0, "skiddle": 0, "claude_web": 0}


@pytest.mark.asyncio
async def test_dry_run_writes_nothing(db, settings):
    s = await run_city(NCL, db, settings, dry_run=True, http=http_client(), anthropic_client=FakeAnthropic())
    assert len(s["preview"]) == 4
    assert await db.events.count_documents({}) == 0
    assert await db.pipeline_runs.count_documents({}) == 0
