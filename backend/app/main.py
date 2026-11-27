"""Vybe API. Run: uvicorn app.main:app --reload  (from the backend/ folder)"""
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from . import db as dbmod
from .config import get_settings
from .routers import events, social

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await dbmod.ensure_indexes(dbmod.get_db())
    yield
    dbmod.close()


app = FastAPI(title="Vybe API", version="2.0.0", lifespan=lifespan)

api = APIRouter(prefix="/api")
api.include_router(events.router)
api.include_router(social.router)


@api.get("/health")
async def health():
    return {"ok": True}


app.include_router(api)

origins = get_settings().cors_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials="*" not in origins,  # credentials + wildcard is invalid per CORS spec
    allow_methods=["*"],
    allow_headers=["*"],
)
