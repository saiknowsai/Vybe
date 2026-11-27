"""Turn source-specific data into Vybe Events, consistently."""
import hashlib
import re
import unicodedata

from ..models import Event, SourceRef
from ..util import now_iso

CATEGORY_IMAGES = {
    "Music": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
    "Food": "https://images.unsplash.com/photo-1551883709-2516220df0bc?w=800&q=80",
    "Arts": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
    "Family": "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&q=80",
    "Sports": "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80",
    "Comedy": "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&q=80",
    "Markets": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80",
    "Outdoors": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
}
CATEGORIES = tuple(CATEGORY_IMAGES)

_KEYWORDS = [  # checked in order against name/genre text when a source's category is vague
    ("Comedy", ("comedy", "stand-up", "standup", "comedian")),
    ("Markets", ("market", "craft fair", "car boot", "flea", "makers fair")),
    ("Food", ("food", "beer festival", "gin festival", "street food", "tasting", "brunch")),
    ("Family", ("family", "kids", "children", "panto", "pantomime", "santa", "storytime")),
    ("Sports", ("football", "rugby", "cricket", "boxing", "darts", "basketball", " vs ", " v ")),
    ("Outdoors", ("walk", "trail", "parkrun", "garden", "nature", "beach")),
    ("Music", ("concert", "gig", "live music", "dj", "orchestra", "festival")),
]


def guess_category(text: str, default: str = "Arts") -> str:
    t = f" {text.lower()} ".replace("boxing day", "")
    for cat, words in _KEYWORDS:
        if any(w in t for w in words):
            return cat
    return default


def price_label(price: float | None, max_price: float | None = None) -> str:
    if price is None:
        return "See listing"
    if price == 0:
        return "Free"
    lo = f"£{price:,.2f}".replace(".00", "")
    if max_price and max_price > price:
        return f"From {lo}"
    return lo


_PRICE_RE = re.compile(r"(\d+(?:\.\d{1,2})?)")


def parse_price(text) -> float | None:
    """'£10.00' -> 10.0, 'Free' -> 0, 'tbc' -> None. Takes the lowest number found."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    t = str(text).strip().lower()
    if not t:
        return None
    if t.startswith("free") or t in {"0", "0.00", "£0", "£0.00"}:
        return 0.0
    nums = [float(n) for n in _PRICE_RE.findall(t.replace(",", ""))]
    return min(nums) if nums else None


def _slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9 ]+", " ", text.lower())
    stop = {"the", "a", "an", "at", "live", "presents", "and", "with", "tour", "uk", "2025", "2026", "2027"}
    return " ".join(w for w in text.split() if w not in stop)


def dedupe_key(name: str, date: str, venue: str) -> str:
    """Same event from two sources should produce the same key."""
    venue_core = " ".join(_slug(venue).split()[:2])
    name_core = " ".join(sorted(_slug(name).split())[:6])
    raw = f"{date}|{venue_core}|{name_core}"
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def make_event(*, provider: str, external_id: str | None, url: str | None, city: str,
               name: str, date: str, **fields) -> Event:
    fetched = now_iso()
    category = fields.pop("category", None) or guess_category(name)
    if category not in CATEGORIES:
        category = guess_category(f"{name} {category}")
    ext = external_id or hashlib.sha1(f"{name}|{date}|{url}".encode()).hexdigest()[:12]
    price = fields.pop("price", None)
    max_price = fields.pop("max_price", None)
    ev = Event(
        id=f"{provider}_{ext}",
        name=name.strip(),
        city=city,
        date=date,
        category=category,
        price=price,
        priceMax=max_price if max_price is not None else price,
        priceLabel=fields.pop("priceLabel", None) or price_label(price, max_price),
        imageUrl=fields.pop("imageUrl", None),   # placeholder added after merging
        source=provider,
        sources=[SourceRef(provider=provider, externalId=external_id, url=url, fetchedAt=fetched)],
        sourceUrl=url,
        lastChecked=fetched,
        lastUpdated=fetched,
        **fields,
    )
    ev.dedupeKey = dedupe_key(ev.name, ev.date, ev.venue)
    return ev
