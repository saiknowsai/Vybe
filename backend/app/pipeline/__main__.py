"""CLI for the event pipeline.

  python -m app.pipeline                       # all enabled cities, all sources
  python -m app.pipeline --city newcastle
  python -m app.pipeline --city newcastle --sources ticketmaster skiddle --dry-run

Schedule it once or twice a day (cron, GitHub Actions, or your host's scheduler).
"""
import argparse
import asyncio
import json
import logging
import sys

from ..cities import enabled_cities, get_city
from ..config import get_settings
from ..db import ensure_indexes, get_db
from .runner import ALL_SOURCES, run_city


async def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.pipeline")
    ap.add_argument("--city", action="append", help="city slug or name (repeatable); default: all enabled")
    ap.add_argument("--sources", nargs="+", choices=ALL_SOURCES, default=list(ALL_SOURCES))
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, don't write to the database")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    cities = [get_city(c) for c in args.city] if args.city else enabled_cities()
    if not all(cities):
        print(f"Unknown city in {args.city}", file=sys.stderr)
        return 2
    settings, db = get_settings(), get_db()
    if not args.dry_run:  # a dry run never touches the database
        await ensure_indexes(db)
    failed = False
    for city in cities:
        summary = await run_city(city, db, settings, tuple(args.sources), dry_run=args.dry_run)
        print(json.dumps(summary, indent=2, default=str))
        failed |= summary["status"] != "ok"
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
