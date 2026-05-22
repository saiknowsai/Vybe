"""Backend tests for NearbyEvents API"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')


# Events endpoints
class TestEventsAPI:
    """Tests for /api/events endpoints"""

    def test_get_london_events(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/events?city=London")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 2, f"Expected >= 2 London events, got {len(data)}"
        for e in data:
            assert e['city'].lower() == 'london'
            assert 'id' in e
            assert 'name' in e
            assert '_id' not in e

    def test_get_events_category_filter(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/events?city=London&category=Family")
        assert res.status_code == 200
        data = res.json()
        for e in data:
            assert e['category'] == 'Family'

    def test_get_events_budget_free(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/events?city=Newcastle&budget=free")
        assert res.status_code == 200
        data = res.json()
        for e in data:
            assert e['price'] == 0

    def test_get_specific_event_carnival(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/events/evt_carnival_2026")
        assert res.status_code == 200
        data = res.json()
        assert data['id'] == 'evt_carnival_2026'
        assert 'Notting Hill' in data['name']
        assert data['city'] == 'London'
        assert 'food' in data
        assert 'parking' in data
        assert 'accessibility' in data
        assert 'ageGuide' in data
        assert '_id' not in data

    def test_get_event_not_found(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/events/nonexistent_event_id")
        assert res.status_code == 404

    def test_get_featured_events(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/events/featured")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for e in data:
            assert e['isFeatured'] is True


# Cities endpoint
class TestCitiesAPI:
    """Tests for /api/cities endpoint"""

    def test_get_cities_returns_list(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/cities")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 10, f"Expected >= 10 cities, got {len(data)}"

    def test_get_cities_includes_london(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/cities")
        assert res.status_code == 200
        cities = res.json()
        assert 'London' in cities


# Reviews endpoints
class TestReviewsAPI:
    """Tests for /api/reviews endpoints"""

    def test_post_review_creates_review(self, api_client):
        payload = {
            "user_id": "TEST_user_123",
            "username": "TEST_reviewer",
            "event_id": "evt_carnival_2026",
            "rating": 5,
            "text": "TEST_Amazing event! Had a great time."
        }
        res = api_client.post(f"{BASE_URL}/api/reviews", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert 'id' in data
        assert data['rating'] == 5
        assert '_id' not in data

    def test_get_reviews_for_event(self, api_client):
        res = api_client.get(f"{BASE_URL}/api/reviews/evt_carnival_2026")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        # Should have the review we just created
        for r in data:
            assert '_id' not in r
            assert 'rating' in r
            assert 'text' in r

    def test_review_updates_event_rating(self, api_client):
        # Post a review
        payload = {
            "user_id": "TEST_rater_999",
            "username": "TEST_rater",
            "event_id": "evt_borough_2026",
            "rating": 4,
            "text": "TEST_Great food market!"
        }
        api_client.post(f"{BASE_URL}/api/reviews", json=payload)
        # Get event to verify rating updated
        res = api_client.get(f"{BASE_URL}/api/events/evt_borough_2026")
        assert res.status_code == 200
        event = res.json()
        assert 'averageRating' in event
        assert event['reviewCount'] >= 1


# User endpoints
class TestUserAPI:
    """Tests for /api/user endpoints"""

    def test_upsert_user_profile(self, api_client):
        payload = {
            "user_id": "TEST_user_abc",
            "username": "TEST_testuser_abc",
            "display_name": "Test User",
            "city": "London"
        }
        res = api_client.post(f"{BASE_URL}/api/user/profile", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data['user_id'] == 'TEST_user_abc'
        assert '_id' not in data

    def test_get_user_by_username(self, api_client):
        # First create
        payload = {
            "user_id": "TEST_user_xyz",
            "username": "TEST_userxyz",
            "display_name": "XYZ User",
            "city": "Manchester"
        }
        api_client.post(f"{BASE_URL}/api/user/profile", json=payload)
        # Then get
        res = api_client.get(f"{BASE_URL}/api/user/profile/TEST_userxyz")
        assert res.status_code == 200
        data = res.json()
        assert data['username'] == 'TEST_userxyz'

    def test_mark_going_event(self, api_client):
        payload = {
            "user_id": "TEST_going_user",
            "username": "TEST_goer",
            "event_id": "evt_carnival_2026",
            "privacy": "public"
        }
        res = api_client.post(f"{BASE_URL}/api/user/going", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data['success'] is True


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
