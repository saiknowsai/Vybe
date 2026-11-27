"""Minimal geohash encoder (Ticketmaster wants geoPoint instead of the deprecated latlong)."""
_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def encode(lat: float, lng: float, precision: int = 7) -> str:
    lat_rng, lng_rng = [-90.0, 90.0], [-180.0, 180.0]
    out, bits, bit_count, even = [], 0, 0, True
    while len(out) < precision:
        rng, val = (lng_rng, lng) if even else (lat_rng, lat)
        mid = (rng[0] + rng[1]) / 2
        if val >= mid:
            bits = (bits << 1) | 1
            rng[0] = mid
        else:
            bits <<= 1
            rng[1] = mid
        even = not even
        bit_count += 1
        if bit_count == 5:
            out.append(_BASE32[bits])
            bits, bit_count = 0, 0
    return "".join(out)
