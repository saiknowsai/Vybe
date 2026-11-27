"""App settings, loaded from environment / backend/.env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Database
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "vybe"

    # API
    cors_origins: str = "*"  # comma-separated in production

    # Event sources (leave a key blank to skip that source)
    ticketmaster_api_key: str = ""
    skiddle_api_key: str = ""

    # Claude web-search source (grassroots events). Off unless a key is set.
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5-5"
    claude_max_searches_per_city: int = 8       # hard cap per pipeline run
    claude_monthly_search_budget: int = 600     # ~$6/month at $10 per 1,000 searches, plus tokens

    # Pipeline
    app_url: str = "https://github.com/saiknowsai/Vybe"  # sent in User-Agent headers
    contact_email: str = ""   # sent to OpenStreetMap geocoder, required by its usage policy
    lookahead_days: int = 30

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
