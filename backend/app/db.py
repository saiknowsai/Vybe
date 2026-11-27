"""Mongo connection. Swappable in tests via set_db()."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        s = get_settings()
        _client = AsyncIOMotorClient(s.mongo_url)
        _db = _client[s.db_name]
    return _db


def set_db(db) -> None:
    """Inject a database (e.g. mongomock) — used by tests."""
    global _db
    _db = db


async def ensure_indexes(db) -> None:
    await db.events.create_index("id", unique=True)
    await db.events.create_index([("city", 1), ("date", 1)])
    await db.events.create_index("category")
    await db.events.create_index("dedupeKey")
    await db.users.create_index("username", unique=True, sparse=True)
    await db.users.create_index("user_id", unique=True)
    await db.friend_requests.create_index([("from_user_id", 1), ("to_username", 1)])
    await db.going_events.create_index([("user_id", 1), ("event_id", 1)], unique=True)
    await db.reviews.create_index("event_id")
    await db.pipeline_runs.create_index([("city", 1), ("startedAt", -1)])


def close() -> None:
    if _client is not None:
        _client.close()
