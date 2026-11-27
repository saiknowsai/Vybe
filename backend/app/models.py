"""Data models. The Event shape matches what the Expo frontend already renders."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

Category = Literal["Music", "Food", "Arts", "Family", "Sports", "Comedy", "Markets", "Outdoors"]
EventStatus = Literal["scheduled", "cancelled", "postponed", "rescheduled"]


class SourceRef(BaseModel):
    """Where an event came from — every stored event has at least one."""
    provider: Literal["ticketmaster", "skiddle", "claude_web", "manual"]
    externalId: Optional[str] = None
    url: Optional[str] = None
    fetchedAt: str


class Event(BaseModel):
    id: str
    name: str
    description: str = ""
    city: str
    venue: str = ""
    address: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    date: str                       # YYYY-MM-DD (local)
    endDate: Optional[str] = None
    time: Optional[str] = None      # HH:MM (local), None if unknown
    category: Category = "Arts"
    price: Optional[float] = None   # lowest price in GBP, 0 = free, None = unknown
    priceMax: Optional[float] = None
    priceLabel: str = "See listing"
    imageUrl: Optional[str] = None
    ticketUrl: Optional[str] = None
    ticketProvider: Optional[str] = None
    ageSuitability: str = "All Ages"   # "All Ages" | "Family" | "18+" | "14+" ...
    isOutdoor: bool = False
    isSoldOut: bool = False
    isLimitedSpaces: bool = False
    isFeatured: bool = False
    isTrending: bool = False
    # Verified = came from an official listing (API) or Claude cited a source page.
    isVerified: bool = False
    status: EventStatus = "scheduled"
    tags: list[str] = Field(default_factory=list)

    # Detail tabs — filled by enrichment later; frontend handles missing/empty.
    food: dict = Field(default_factory=dict)
    parking: dict = Field(default_factory=dict)
    accessibility: dict = Field(default_factory=dict)
    ageGuide: dict = Field(default_factory=dict)

    # Social counters (owned by the app, not the pipeline)
    attendeeCount: int = 0
    averageRating: float = 0.0
    reviewCount: int = 0

    # Provenance
    source: str = "pipeline"           # primary provider name, kept for the frontend badge
    sources: list[SourceRef] = Field(default_factory=list)
    sourceUrl: Optional[str] = None
    dedupeKey: str = ""
    lastChecked: str = ""
    lastUpdated: str = ""


# ─── Request bodies (unchanged contract from the old server) ─────────────────

class UserProfileModel(BaseModel):
    user_id: str
    username: str
    display_name: str
    avatar_index: int = 0
    city: str = "Newcastle"
    bio: str = ""


class GoingEventModel(BaseModel):
    user_id: str
    username: str
    event_id: str
    privacy: Literal["public", "private"] = "public"


class FriendRequestModel(BaseModel):
    from_user_id: str
    from_username: str
    to_username: str


class AcceptRequestModel(BaseModel):
    user_id: str


class ReviewModel(BaseModel):
    user_id: str
    username: str
    event_id: str
    rating: int = Field(ge=1, le=5)
    text: str = Field(max_length=2000)
