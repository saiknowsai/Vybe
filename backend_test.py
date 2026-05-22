"""
Vybe backend API tests.

Focus: POST /api/ai/events (cache, fresh fetch, force_refresh, fallback)
plus smoke tests for events, cities, user profile, friends.

Note: the public preview proxy has a ~60s timeout, but Claude calls can take
90-120s. We therefore call the fresh-AI path against http://localhost:8001
(internal) but verify cache hits via the public proxy URL.
"""
import sys
import time
import uuid
import requests

PROXY_URL = "https://whats-on-near.preview.emergentagent.com/api"
LOCAL_URL = "http://localhost:8001/api"

REQUIRED_AI_EVENT_FIELDS = [
    "id", "name", "description", "city", "venue", "address", "lat", "lng",
    "date", "time", "category", "price", "priceLabel", "imageUrl",
    "ageSuitability", "tags", "source",
]


def banner(t):
    print("\n" + "=" * 70 + f"\n{t}\n" + "=" * 70)


def ok(msg): print(f"  ✅ {msg}")
def fail(msg): print(f"  ❌ {msg}")


results = {"pass": [], "fail": []}


def record(name, passed, note=""):
    if passed:
        results["pass"].append(name)
        ok(f"{name} — {note}")
    else:
        results["fail"].append(f"{name}: {note}")
        fail(f"{name} — {note}")


# ─── Sanity: FastAPI title ───────────────────────────────────────────────────
def test_openapi_title():
    banner("Sanity: FastAPI title via /openapi.json (localhost)")
    try:
        r = requests.get("http://localhost:8001/openapi.json", timeout=10)
        title = r.json().get("info", {}).get("title", "")
        record("openapi_title", title == "Vybe API", f"title='{title}'")
    except Exception as e:
        record("openapi_title", False, f"err={e}")


# ─── Smoke tests (via PROXY) ─────────────────────────────────────────────────
def test_events_list_london():
    banner("Smoke: GET /api/events?city=London (proxy)")
    try:
        r = requests.get(f"{PROXY_URL}/events", params={"city": "London"}, timeout=30)
        evts = r.json() if r.status_code == 200 else []
        london_only = isinstance(evts, list) and len(evts) > 0 and \
            all(e.get("city", "").lower() == "london" for e in evts)
        record("events_list_london", london_only, f"count={len(evts)}")
    except Exception as e:
        record("events_list_london", False, f"err={e}")


def test_event_detail_carnival():
    banner("Smoke: GET /api/events/evt_carnival_2026 (proxy)")
    try:
        r = requests.get(f"{PROXY_URL}/events/evt_carnival_2026", timeout=15)
        ev = r.json() if r.status_code == 200 else {}
        record("event_detail_carnival",
               ev.get("name", "").lower().startswith("notting hill"),
               f"name='{ev.get('name')}'")
    except Exception as e:
        record("event_detail_carnival", False, f"err={e}")


def test_cities():
    banner("Smoke: GET /api/cities (proxy)")
    try:
        r = requests.get(f"{PROXY_URL}/cities", timeout=15)
        cities = r.json() if r.status_code == 200 else []
        expected = {"London", "Manchester", "Edinburgh", "Birmingham", "Leeds",
                    "Liverpool", "Cardiff", "Bristol", "Glasgow", "Newcastle"}
        record("cities", len(expected.intersection(set(cities))) >= 8,
               f"cities={cities}")
    except Exception as e:
        record("cities", False, f"err={e}")


def test_user_profile_and_friends():
    banner("Smoke: User profile + Friend request flow (proxy)")
    suffix = uuid.uuid4().hex[:6]
    alice_id = f"user_alice_{suffix}"
    bob_id = f"user_bob_{suffix}"
    alice_username = f"alice_{suffix}"
    bob_username = f"bob_{suffix}"

    try:
        r = requests.post(f"{PROXY_URL}/user/profile", json={
            "user_id": alice_id, "username": alice_username,
            "display_name": "Alice Smith", "avatar_index": 1,
            "city": "London", "bio": "Lover of jazz and street food."
        }, timeout=15)
        record("create_alice_profile", r.status_code == 200, f"status={r.status_code}")
    except Exception as e:
        record("create_alice_profile", False, f"err={e}")
        return

    try:
        r = requests.post(f"{PROXY_URL}/user/profile", json={
            "user_id": bob_id, "username": bob_username,
            "display_name": "Bob Jones", "avatar_index": 2,
            "city": "Manchester", "bio": "Indie music fan."
        }, timeout=15)
        record("create_bob_profile", r.status_code == 200, f"status={r.status_code}")
    except Exception as e:
        record("create_bob_profile", False, f"err={e}")
        return

    try:
        r = requests.get(f"{PROXY_URL}/user/profile/{alice_username}", timeout=15)
        record("get_alice_by_username",
               r.status_code == 200 and r.json().get("user_id") == alice_id,
               f"status={r.status_code}")
    except Exception as e:
        record("get_alice_by_username", False, f"err={e}")

    request_id = None
    try:
        r = requests.post(f"{PROXY_URL}/friends/request", json={
            "from_user_id": alice_id, "from_username": alice_username,
            "to_username": bob_username
        }, timeout=15)
        if r.status_code == 200:
            request_id = r.json().get("id")
            record("send_friend_request", True, f"request_id={request_id}")
        else:
            record("send_friend_request", False, f"status={r.status_code}")
    except Exception as e:
        record("send_friend_request", False, f"err={e}")

    if request_id:
        try:
            r = requests.put(f"{PROXY_URL}/friends/request/{request_id}/accept",
                             json={"user_id": bob_id}, timeout=15)
            record("accept_friend_request", r.status_code == 200, f"status={r.status_code}")
        except Exception as e:
            record("accept_friend_request", False, f"err={e}")

        try:
            r = requests.get(f"{PROXY_URL}/friends/{alice_id}", timeout=15)
            friends = r.json() if r.status_code == 200 else []
            record("alice_has_bob_friend",
                   any(f.get("username") == bob_username for f in friends),
                   f"friends={len(friends)}")
        except Exception as e:
            record("alice_has_bob_friend", False, f"err={e}")


# ─── AI events: validate shape helper ─────────────────────────────────────────
def _validate_ai_shape(payload, label):
    if not isinstance(payload, dict):
        record(label, False, f"not a dict")
        return False
    if "events" not in payload or "source" not in payload:
        record(label, False, f"missing keys: {list(payload.keys())}")
        return False
    evs = payload["events"]
    if not isinstance(evs, list) or len(evs) == 0:
        record(label, False, f"events list empty")
        return False
    first = evs[0]
    missing = [k for k in REQUIRED_AI_EVENT_FIELDS if k not in first]
    if missing:
        record(label, False, f"missing fields on event[0]: {missing}")
        return False
    record(label, True, f"source={payload['source']} count={len(evs)}")
    return True


# ─── AI tests ────────────────────────────────────────────────────────────────
def test_ai_cached_via_proxy(city, label_prefix):
    """Manchester & London should already be cached → fast & source='cached'."""
    banner(f"AI: POST /api/ai/events — cached hit for {city} (proxy)")
    payload = {"city": city, "interests": ["Music", "Food"],
               "age_group": "adult", "force_refresh": False}
    t0 = time.time()
    try:
        r = requests.post(f"{PROXY_URL}/ai/events", json=payload, timeout=30)
        elapsed = time.time() - t0
        if r.status_code != 200:
            record(f"{label_prefix}_call", False,
                   f"status={r.status_code} body={r.text[:200]} elapsed={elapsed:.2f}s")
            return
        data = r.json()
        print(f"  ⏱  {city} cached call: {elapsed:.3f}s, source={data.get('source')}")
        _validate_ai_shape(data, f"{label_prefix}_shape")
        record(f"{label_prefix}_source_cached",
               data.get("source") == "cached",
               f"source='{data.get('source')}'")
        record(f"{label_prefix}_speed_under_2s",
               elapsed < 2.0,
               f"elapsed={elapsed:.3f}s")
    except Exception as e:
        record(f"{label_prefix}_call", False, f"err={e}")


def test_ai_fresh_via_localhost(city="Leeds"):
    """Use localhost (no proxy 60s limit) so Claude has time. Then verify cache."""
    banner(f"AI: POST /api/ai/events — FRESH for {city} via localhost (long timeout)")
    payload = {"city": city, "interests": ["Music", "Arts"],
               "age_group": "adult", "force_refresh": True}
    t0 = time.time()
    try:
        r = requests.post(f"{LOCAL_URL}/ai/events", json=payload, timeout=200)
        elapsed = time.time() - t0
        print(f"  ⏱  {city} fresh call: {elapsed:.2f}s, status={r.status_code}")
        if r.status_code != 200:
            record(f"ai_fresh_{city}", False,
                   f"status={r.status_code} body={r.text[:300]}")
            return
        data = r.json()
        print(f"      source={data.get('source')} count={len(data.get('events', []))}")
        if data.get("source") == "fallback":
            print(f"      ⚠ fallback triggered. error={(data.get('error') or '')[:200]}")
        _validate_ai_shape(data, f"ai_fresh_{city}_shape")
        # source must be either ai_generated or fallback (no 500)
        record(f"ai_fresh_{city}_source",
               data.get("source") in ("ai_generated", "fallback"),
               f"source='{data.get('source')}'")
    except requests.exceptions.Timeout:
        record(f"ai_fresh_{city}", False, "TIMEOUT after 200s")
        return
    except Exception as e:
        record(f"ai_fresh_{city}", False, f"err={e}")
        return

    # Immediately call again (no force_refresh) — must be cached
    banner(f"AI: POST /api/ai/events — verify {city} now cached")
    payload2 = {"city": city, "interests": ["Music"],
                "age_group": "adult", "force_refresh": False}
    t1 = time.time()
    try:
        r = requests.post(f"{LOCAL_URL}/ai/events", json=payload2, timeout=30)
        elapsed = time.time() - t1
        print(f"  ⏱  {city} 2nd call: {elapsed:.3f}s, source={r.json().get('source') if r.status_code==200 else 'ERR'}")
        if r.status_code == 200:
            data = r.json()
            record(f"ai_{city}_now_cached",
                   data.get("source") == "cached",
                   f"source={data.get('source')} elapsed={elapsed:.3f}s")
            record(f"ai_{city}_cache_fast",
                   elapsed < 2.0, f"elapsed={elapsed:.3f}s")
        else:
            record(f"ai_{city}_now_cached", False, f"status={r.status_code}")
    except Exception as e:
        record(f"ai_{city}_now_cached", False, f"err={e}")


def test_ai_no_500_contract():
    """Endpoint must never return 500 — bad inputs/missing keys still return events."""
    banner("AI: POST /api/ai/events — no 500 contract (empty body)")
    try:
        # Empty body should default to London which is cached → 200
        r = requests.post(f"{PROXY_URL}/ai/events", json={}, timeout=30)
        if r.status_code == 200:
            data = r.json()
            ok_shape = ("events" in data and "source" in data
                        and isinstance(data["events"], list))
            record("ai_events_no_500", ok_shape,
                   f"source={data.get('source')} count={len(data.get('events', []))}")
        else:
            record("ai_events_no_500", False, f"status={r.status_code}")
    except Exception as e:
        record("ai_events_no_500", False, f"err={e}")


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    print(f"PROXY_URL = {PROXY_URL}")
    print(f"LOCAL_URL = {LOCAL_URL}")
    test_openapi_title()
    test_events_list_london()
    test_event_detail_carnival()
    test_cities()
    test_user_profile_and_friends()
    test_ai_cached_via_proxy("Manchester", "ai_manchester_cached")
    test_ai_cached_via_proxy("London", "ai_london_cached")
    test_ai_no_500_contract()
    test_ai_fresh_via_localhost("Leeds")

    banner("RESULTS")
    print(f"  PASSED: {len(results['pass'])}")
    for n in results["pass"]:
        print(f"    ✅ {n}")
    print(f"  FAILED: {len(results['fail'])}")
    for n in results["fail"]:
        print(f"    ❌ {n}")
    sys.exit(0 if not results["fail"] else 1)


if __name__ == "__main__":
    main()
