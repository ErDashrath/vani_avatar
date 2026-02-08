
"""Async LLM service – streams SSE from Nominee Life API and aggregates the response."""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator

import httpx

from app.core.config import get_settings
from app.models.schemas import ChatMessage

logger = logging.getLogger(__name__)

# Reuse a single async client across requests (connection pooling).
_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=30.0, write=5.0, pool=5.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            verify=False,  # Nominee Life API – skip cert verification for speed
        )
    return _client


async def close_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None


def _build_messages(
    message: str,
    history: list[ChatMessage],
) -> list[dict[str, str]]:
    """Build the messages array for the LLM, keeping context short."""
    system_msg = {
        "role": "system",
        "content": (
            "You are a helpful voice assistant. Keep responses concise "
            "(1-2 sentences max) for natural conversation. Be friendly and direct."
        ),
    }
    msgs: list[dict[str, str]] = [system_msg]
    # Only keep the last 6 history messages to bound token usage.
    for m in history[-6:]:
        msgs.append({"role": m.role, "content": m.content})
    msgs.append({"role": "user", "content": message})
    return msgs


async def stream_completion(
    message: str,
    history: list[ChatMessage],
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> AsyncGenerator[str, None]:
    """Yield SSE chunks as they arrive from the upstream LLM."""
    settings = get_settings()
    client = await _get_client()

    payload = {
        "model": settings.llm_model,
        "messages": _build_messages(message, history),
        "max_tokens": max_tokens if max_tokens is not None else settings.llm_max_tokens,
        "temperature": temperature if temperature is not None else settings.llm_temperature,
        "stream": True,
    }

    async with client.stream(
        "POST",
        settings.llm_api_url,
        json=payload,
        headers={"Accept": "text/event-stream", "Content-Type": "application/json"},
    ) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line.startswith("data: "):
                continue
            data = line[6:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
                delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if delta:
                    yield delta
            except json.JSONDecodeError:
                continue


async def get_completion(
    message: str,
    history: list[ChatMessage],
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> tuple[str, int]:
    """Aggregate full response from the stream. Returns (text, approx_tokens)."""
    parts: list[str] = []
    async for chunk in stream_completion(message, history, max_tokens, temperature):
        parts.append(chunk)
    text = "".join(parts).strip() or "I understand. Can you tell me more?"
    return text, len(parts)
