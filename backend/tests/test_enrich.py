import pytest

from app.cities import CITIES
from app.pipeline.enrich import age_guide, summarise
from app.pipeline.runner import run_city

from .conftest import OVERPASS_CALLS, FakeAnthropic, http_client, overpass_payload

NCL = CITIES["newcastle"]


@pytest.mark.parametrize("label,suitable", [("18+", "Adults (18+)"), ("14+", "Ages 14 and over"),
                                            ("Family", "Families and children"), ("All Ages", "All ages")])
def test_age_guide(label, suitable):
    assert age_guide(label)["suitableFor"] == suitable


def test_summarise_real_shape():
    info = summarise(overpass_payload()["elements"], 54.9666, -1.6214, "Utilita Arena Newcastle")
    assert info["parking"]["carParks"] == ["Arena Way car park (2 min walk)"]          # private one skipped
    assert info["parking"]["publicTransport"][0].startswith("Bus stop: Railway Street")
    assert any(t.startswith("Metro: St James") for t in info["parking"]["publicTransport"])
    assert any(t.startswith("Train: Newcastle") for t in info["parking"]["publicTransport"])
    assert info["food"]["nearby"] == ["Pizza Punks, restaurant (2 min walk)", "Arena Café, café (2 min walk)"]
    assert info["accessibility"]["wheelchair"] is True
    assert info["food"]["credit"] == "© OpenStreetMap contributors"


def test_nothing_found_stays_empty():
    info = summarise([], 54.97, -1.61, "Somewhere")
    assert info["food"] == {} and info["parking"] == {}
    assert info["accessibility"]["wheelchair"] is False
    assert "Contact the venue" in info["accessibility"]["details"]


@pytest.mark.asyncio
async def test_one_snapshot_per_city_then_cached(db, settings):
    OVERPASS_CALLS.clear()
    s = await run_city(NCL, db, settings, http=http_client(), anthropic_client=FakeAnthropic())
    assert s["enrich"]["snapshot"] == "fresh" and len(OVERPASS_CALLS) == 1     # one call, not one per venue
    assert s["enrich"]["venues"] >= 3

    fender = await db.events.find_one({"name": "Sam Fender - Live"})
    assert fender["parking"]["carParks"] == ["Arena Way car park (2 min walk)"]
    assert fender["accessibility"]["wheelchair"] is True
    assert fender["ageGuide"]["suitableFor"] == "Ages 14 and over"

    OVERPASS_CALLS.clear()
    s2 = await run_city(NCL, db, settings, http=http_client(), anthropic_client=FakeAnthropic())
    assert s2["enrich"]["snapshot"] == "cache" and OVERPASS_CALLS == []
    assert (await db.events.find_one({"name": "Sam Fender - Live"}))["food"]["nearby"]


@pytest.mark.asyncio
async def test_far_venue_gets_nothing_from_snapshot(db, settings):
    """Places near the arena must not be attached to a venue 5 km away."""
    from app.pipeline import enrich as en
    from app.pipeline.normalize import make_event
    await db.osm_snapshots.insert_one({"_id": "newcastle", "checkedAt": "2999-01-01T00:00:00Z",
                                       "elements": en.compact(overpass_payload()["elements"])})
    far = make_event(provider="skiddle", external_id="9", url=None, city="Newcastle", name="Far gig",
                     date="2030-01-01", venue="Somewhere Else", lat=55.01, lng=-1.55)
    s = await en.enrich([far], db, city=NCL, app_url="x")
    assert s["snapshot"] == "cache" and far.food == {} and far.parking == {}


@pytest.mark.asyncio
async def test_dry_run_does_not_call_overpass(db, settings):
    OVERPASS_CALLS.clear()
    s = await run_city(NCL, db, settings, dry_run=True, http=http_client(), anthropic_client=FakeAnthropic())
    assert OVERPASS_CALLS == [] and s["enrich"]["snapshot"] == "skipped"


@pytest.mark.asyncio
async def test_falls_back_to_other_server_on_502(db, settings):
    import httpx
    from app.pipeline import enrich as en
    from app.pipeline.normalize import make_event
    hosts = []

    def handler(req):
        hosts.append(req.url.host)
        if req.url.host == "overpass-api.de":
            return httpx.Response(502)
        return httpx.Response(200, json=overpass_payload())
    ev = make_event(provider="skiddle", external_id="1", url=None, city="Newcastle", name="Gig",
                    date="2030-01-01", venue="Utilita Arena Newcastle", lat=54.9666, lng=-1.6214)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
        s = await en.enrich([ev], db, city=NCL, app_url="x", client=c)
    assert s["snapshot"] == "fresh" and ev.parking["carParks"]
    assert hosts == ["overpass-api.de", "overpass.private.coffee"]


@pytest.mark.asyncio
async def test_all_servers_down_keeps_old_snapshot_or_skips(db, settings):
    import httpx
    from app.pipeline import enrich as en
    from app.pipeline.normalize import make_event
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(504)
    ev = make_event(provider="skiddle", external_id="1", url=None, city="Newcastle", name="Gig",
                    date="2030-01-01", venue="Utilita Arena Newcastle", lat=54.9666, lng=-1.6214)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
        s = await en.enrich([ev], db, city=NCL, app_url="x", client=c)
        assert s["snapshot"] == "none" and len(calls) == 3 and ev.parking == {}
        await db.osm_snapshots.insert_one({"_id": "newcastle", "checkedAt": "2000-01-01T00:00:00Z",
                                           "elements": en.compact(overpass_payload()["elements"])})
        s = await en.enrich([ev], db, city=NCL, app_url="x", client=c)
    assert s["snapshot"] == "stale" and ev.parking["carParks"]          # old data beats none
