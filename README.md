# Vybe — find your vybe 🎯

Local events discovery for the UK. Expo (iOS, Android, web) + FastAPI + MongoDB.
Launching with Newcastle; London, Manchester, Birmingham and Edinburgh are set up
and switched off in `backend/app/cities.py`.

## How events get in

Events come from real listings, never from a model's imagination:

```
Ticketmaster ─┐
Skiddle ──────┼─► normalise ─► merge duplicates ─► geocode ─► MongoDB ─► API ─► app
Claude + web ─┘   (categories,   (same gig from     (OSM,
search            prices, ages)   two sources)       cached)
```

- **Ticketmaster / Skiddle**: official listings, so they're marked verified.
- **Claude + web search**: finds markets, community, council and family events the
  ticket sites miss. Every event must cite a page that actually came back from the
  search, or it's dropped. Searches are capped per run and per month.
- The pipeline runs on a schedule (twice a day via GitHub Actions), **not per user**,
  so running costs scale with cities, not users.

## Run it locally (Windows / macOS / Linux)

You need Python 3.11+, Node 20+, and MongoDB (local, or a free Atlas cluster).

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env  — then add your keys
python -m app.pipeline --city newcastle --dry-run   # preview events, writes nothing
python -m app.pipeline --city newcastle             # fetch and store
uvicorn app.main:app --reload --port 8000           # API at http://localhost:8000/docs

# Frontend (new terminal)
cd frontend
copy .env.example .env
npm install
npx expo start                  # press w for web, or scan the QR with Expo Go
```

Tests: `cd backend && pytest`.

## Layout

```
backend/app/
  main.py            FastAPI app
  config.py          settings from .env
  cities.py          covered cities (flip `enabled`)
  models.py          Event model (matches the frontend)
  routers/           events + social (users, going, friends, reviews)
  pipeline/
    sources/         ticketmaster.py, skiddle.py, claude_web.py
    normalize.py     categories, prices, dedupe keys
    dedupe.py        merge the same event across sources
    geocode.py       OSM coordinates, cached
    runner.py        run_city(): the whole pipeline
frontend/            Expo Router app
```

## Known gaps

- No real authentication yet: the API trusts the `user_id` the app sends.
- Food / Parking / Accessibility / Age Guide tabs aren't filled in yet (next: an enrichment step).
- The Skiddle response fields aren't documented publicly, so check a `--dry-run` once you have a key.
- The map is interactive on web only; mobile shows a list.
