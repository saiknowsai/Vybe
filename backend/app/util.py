import re
import uuid
from datetime import datetime, timezone


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def clean(doc: dict | None) -> dict | None:
    """Drop Mongo's _id (and internal fields) before returning to the client."""
    if doc:
        doc.pop("_id", None)
    return doc


def exact_ci(value: str) -> dict:
    """Case-insensitive exact match, with the value regex-escaped."""
    return {"$regex": f"^{re.escape(value)}$", "$options": "i"}


def contains_ci(value: str) -> dict:
    return {"$regex": re.escape(value), "$options": "i"}
