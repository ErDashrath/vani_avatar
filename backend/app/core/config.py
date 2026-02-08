"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Immutable application settings – read once, cache forever."""

    __slots__ = (
        "llm_api_url",
        "llm_model",
        "llm_max_tokens",
        "llm_temperature",
        "cors_origins",
        "host",
        "port",
        "rate_limit",
    )

    def __init__(self) -> None:
        self.llm_api_url = os.getenv("LLM_API_URL", "")
        if not self.llm_api_url:
            raise ValueError("LLM_API_URL environment variable is required")
        self.llm_model: str = os.getenv("LLM_MODEL", "Qwen2.5-1.5B-Instruct")
        self.llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "150"))
        self.llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.7"))
        self.cors_origins: list[str] = os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        ).split(",")
        self.host: str = os.getenv("HOST", "127.0.0.1")
        self.port: int = int(os.getenv("PORT", "8000"))
        # Rate limiting (only protection)
        self.rate_limit: str = os.getenv("RATE_LIMIT", "30/minute")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton settings instance."""
    return Settings()
