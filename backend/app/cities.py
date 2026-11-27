"""Cities Vybe covers. Flip `enabled` to switch a city on for the pipeline and the app."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class City:
    slug: str
    name: str              # stored on events as `city` — must match what the app sends
    lat: float
    lng: float
    radius_miles: int
    enabled: bool = False
    # Names that should map to this city (venue town fields vary between sources)
    aliases: tuple[str, ...] = field(default_factory=tuple)
    # Local sites the Claude source should prefer for grassroots events
    local_sites: tuple[str, ...] = field(default_factory=tuple)


CITIES: dict[str, City] = {
    c.slug: c
    for c in [
        City(
            "newcastle", "Newcastle", 54.9783, -1.6178, 10, enabled=True,
            aliases=("Newcastle upon Tyne", "Gateshead", "Gosforth", "Jesmond", "Heaton",
                     "Tynemouth", "Whitley Bay", "North Shields", "South Shields", "Wallsend"),
            local_sites=("newcastlegateshead.com", "newcastle.gov.uk", "gateshead.gov.uk",
                         "thechronicle.co.uk", "visitnorthumberland.com"),
        ),
        City("london", "London", 51.5074, -0.1278, 12,
             local_sites=("london.gov.uk", "timeout.com", "visitlondon.com")),
        City("manchester", "Manchester", 53.4808, -2.2426, 10, aliases=("Salford",),
             local_sites=("manchester.gov.uk", "visitmanchester.com", "manchestereveningnews.co.uk")),
        City("birmingham", "Birmingham", 52.4862, -1.8904, 10,
             local_sites=("birmingham.gov.uk", "visitbirmingham.com")),
        City("edinburgh", "Edinburgh", 55.9533, -3.1883, 8, aliases=("Leith",),
             local_sites=("edinburgh.gov.uk", "edinburghguide.com", "thelist.co.uk")),
    ]
}


def get_city(name_or_slug: str) -> City | None:
    key = (name_or_slug or "").strip().lower()
    if key in CITIES:
        return CITIES[key]
    for c in CITIES.values():
        if key == c.name.lower() or key in (a.lower() for a in c.aliases):
            return c
    return None


def enabled_cities() -> list[City]:
    return [c for c in CITIES.values() if c.enabled]
