"""
FastAPI Backend for EchoAI Voice Avatar
Provides chat endpoints with LLM integration and streaming support
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, AsyncGenerator
import logging
import os
import json
import httpx
from datetime import datetime
from dataclasses import dataclass

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI instance
app = FastAPI(
    title="EchoAI Voice Avatar API",
    description="Backend API for voice avatar chat with LLM integration",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: system, user, or assistant")
    content: str = Field(..., description="Message content")

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    history: List[ChatMessage] = Field(default_factory=list, description="Conversation history")
    max_tokens: Optional[int] = Field(150, description="Maximum tokens to generate")
    temperature: Optional[float] = Field(0.7, description="Temperature for generation")

class ChatResponse(BaseModel):
    response: str = Field(..., description="LLM response")
    model: str = Field("mock-model", description="Model used")
    tokens_used: int = Field(0, description="Tokens used")

# ── Real LLM config ──────────────────────────────────────────────
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://ai.nomineelife.com")
LLM_MODEL    = os.getenv("LLM_MODEL",    "Qwen2.5-1.5B-Instruct-Q5_K_M")
LLM_API_KEY  = os.getenv("LLM_API_KEY", "").strip()

SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are EchoAI, a helpful and friendly voice assistant. "
    "Keep responses concise and conversational (2-3 sentences max) "
    "since your replies will be spoken aloud."
)

@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str
    model: str
    api_key: Optional[str]

def build_chat_url(base_url: str) -> str:
    """Build OpenAI-compatible chat completions URL from a provider base URL."""
    normalized = base_url.rstrip("/")
    if normalized.endswith("/v1"):
        return f"{normalized}/chat/completions"
    return f"{normalized}/v1/chat/completions"

def provider_headers(api_key: Optional[str]) -> dict:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers

def provider_chain() -> List[ProviderConfig]:
    """Primary provider only."""
    providers: List[ProviderConfig] = [
        ProviderConfig(
            name="primary",
            base_url=LLM_BASE_URL,
            model=LLM_MODEL,
            api_key=LLM_API_KEY or None,
        )
    ]
    # Groq fallback intentionally disabled.
    # Re-enable by appending a second ProviderConfig here.
    return providers

def build_messages(message: str, history: List[ChatMessage]) -> list:
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history:
        msgs.append({"role": h.role, "content": h.content})
    msgs.append({"role": "user", "content": message})
    return msgs

def extract_message_content(data: dict) -> str:
    content = data["choices"][0]["message"]["content"]
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for part in content:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str):
                parts.append(text)
        if parts:
            return "".join(parts)
    raise ValueError("Unexpected provider response format.")

def extract_stream_token(chunk: dict) -> str:
    choices = chunk.get("choices", [])
    if not choices:
        return ""
    delta = choices[0].get("delta", {})
    content = delta.get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for part in content:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str):
                parts.append(text)
        return "".join(parts)
    return ""

async def generate_response(
    message: str,
    history: List[ChatMessage],
    max_tokens: int,
    temperature: float,
) -> tuple[str, str]:
    """Non-streaming chat with provider fallback."""
    payload = {
        "messages": build_messages(message, history),
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": False,
    }
    errors: List[str] = []

    for provider in provider_chain():
        request_payload = {**payload, "model": provider.model}
        url = build_chat_url(provider.base_url)
        headers = provider_headers(provider.api_key)
        try:
            logger.info("Trying non-streaming provider: %s", provider.name)
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=request_payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                content = extract_message_content(data).strip()
                if not content:
                    raise ValueError("Provider returned empty response content.")
                return content, provider.model
        except Exception as exc:
            logger.warning("Provider %s failed (non-streaming): %s", provider.name, str(exc))
            errors.append(f"{provider.name}: {exc}")

    raise RuntimeError("All providers failed (non-streaming): " + " | ".join(errors))

async def stream_response(
    message: str,
    history: List[ChatMessage],
    max_tokens: int,
    temperature: float,
) -> AsyncGenerator[str, None]:
    """Streaming SSE with provider fallback before first emitted token."""
    payload = {
        "messages": build_messages(message, history),
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True,
    }
    errors: List[str] = []

    for provider in provider_chain():
        request_payload = {**payload, "model": provider.model}
        url = build_chat_url(provider.base_url)
        headers = provider_headers(provider.api_key)
        emitted_token = False

        try:
            logger.info("Trying streaming provider: %s", provider.name)
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=request_payload, headers=headers) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if not raw:
                            continue
                        if raw == "[DONE]":
                            break
                        try:
                            chunk = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        token = extract_stream_token(chunk)
                        if not token:
                            continue
                        emitted_token = True
                        yield f"data: {token}\n\n"

            if not emitted_token:
                raise ValueError("Provider returned an empty streaming response.")

            yield "data: [DONE]\n\n"
            return
        except Exception as exc:
            logger.warning("Provider %s failed (streaming): %s", provider.name, str(exc))
            errors.append(f"{provider.name}: {exc}")
            if emitted_token:
                raise RuntimeError(
                    f"Streaming failed mid-response with provider {provider.name}: {exc}"
                ) from exc

    raise RuntimeError("All providers failed (streaming): " + " | ".join(errors))

# Health check endpoint
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Check if the API is running"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

# Non-streaming chat endpoint
@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    """
    Non-streaming chat endpoint
    Returns complete response at once
    """
    try:
        logger.info(f"Received chat request: {request.message[:50]}...")
        
        response_text, model_used = await generate_response(
            request.message,
            request.history,
            request.max_tokens,
            request.temperature
        )
        
        return ChatResponse(
            response=response_text,
            model=model_used,
            tokens_used=len(response_text.split())
        )
    
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating response: {str(e)}"
        )

# Streaming chat endpoint
@app.post("/api/chat/stream", tags=["Chat"])
async def chat_stream(request: ChatRequest):
    """
    Streaming chat endpoint
    Returns Server-Sent Events (SSE) stream
    """
    try:
        logger.info(f"Received streaming chat request: {request.message[:50]}...")
        
        async def event_generator():
            try:
                async for chunk in stream_response(
                    request.message,
                    request.history,
                    request.max_tokens,
                    request.temperature
                ):
                    yield chunk
            except Exception as e:
                logger.error(f"Error in stream: {str(e)}")
                yield f"data: [ERROR] {str(e)}\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    except Exception as e:
        logger.error(f"Error in chat stream endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting stream: {str(e)}"
        )

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root endpoint"""
    return {
        "message": "EchoAI Voice Avatar API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/chat",
            "chat_stream": "/api/chat/stream"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
