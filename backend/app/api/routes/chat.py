"""Chat endpoint – proxies user messages to the LLM and returns the response."""

import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.schemas import ChatRequest, ChatResponse
from app.services.llm_service import get_completion, stream_completion
from app.core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Rate limiter (only protection - no API key auth)
limiter = Limiter(key_func=get_remote_address)


@router.post("/api/chat", response_model=ChatResponse)
@limiter.limit(lambda: get_settings().rate_limit)
async def chat(request: Request, chat_request: ChatRequest) -> ChatResponse:
    """Return a full aggregated LLM response (non-streaming)."""
    try:
        text, tokens = await get_completion(
            message=chat_request.message,
            history=chat_request.history,
            max_tokens=chat_request.max_tokens,
            temperature=chat_request.temperature,
        )
        return ChatResponse(response=text, model="Qwen2.5-1.5B-Instruct", tokens_used=tokens)
    except httpx.TimeoutException:
        logger.error("LLM request timed out")
        raise HTTPException(status_code=504, detail="LLM service timed out. Please try again.")
    except httpx.HTTPStatusError as exc:
        logger.error("LLM upstream error: %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail=f"LLM returned {exc.response.status_code}") from exc
    except Exception as exc:
        logger.exception("Chat completion failed")
        raise HTTPException(status_code=502, detail=f"LLM service error: {exc}") from exc


@router.post("/api/chat/stream")
@limiter.limit(lambda: get_settings().rate_limit)
async def chat_stream(request: Request, chat_request: ChatRequest) -> StreamingResponse:
    """Stream SSE chunks to the browser for progressive rendering."""

    async def _event_generator():
        try:
            async for chunk in stream_completion(
                message=chat_request.message,
                history=chat_request.history,
                max_tokens=chat_request.max_tokens,
                temperature=chat_request.temperature,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.exception("Streaming failed")
            yield f"data: [ERROR] {exc}\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/health")
async def health():
    """Lightweight health-check for monitoring."""
    return {"status": "ok"}
