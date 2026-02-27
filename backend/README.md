# EchoAI Voice Avatar - Backend API

FastAPI backend server for the EchoAI Voice Avatar application.

## Features

- ✅ FastAPI REST API with async support
- ✅ CORS enabled for frontend integration
- ✅ Streaming chat endpoint (SSE)
- ✅ Non-streaming chat endpoint
- ✅ Health check endpoint
- ✅ Automatic OpenAPI documentation
- ✅ Mock LLM responses (ready for real LLM integration)

## Endpoints

- `GET /api/health` - Health check
- `POST /api/chat` - Non-streaming chat
- `POST /api/chat/stream` - Streaming chat (SSE)
- `GET /api/docs` - Interactive API documentation
- `GET /` - API root info

## Setup

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the Server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --reload --port 8000
```

The server will start on http://localhost:8000

## Integration with Real LLM

Replace the `generate_response()` function in `main.py` with actual LLM API calls:

### OpenAI Example:

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def generate_response(message: str, history: List[ChatMessage], max_tokens: int, temperature: float) -> str:
    messages = [{"role": msg.role, "content": msg.content} for msg in history]
    messages.append({"role": "user", "content": message})
    
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature
    )
    
    return response.choices[0].message.content
```

### Anthropic Claude Example:

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

async def generate_response(message: str, history: List[ChatMessage], max_tokens: int, temperature: float) -> str:
    messages = [{"role": msg.role, "content": msg.content} for msg in history]
    messages.append({"role": "user", "content": message})
    
    response = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=max_tokens,
        temperature=temperature,
        messages=messages
    )
    
    return response.content[0].text
```

## API Documentation

Once the server is running, visit:
- http://localhost:8000/api/docs - Swagger UI
- http://localhost:8000/api/openapi.json - OpenAPI specification

## Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=8000
# Primary provider (existing internal endpoint by default)
LLM_BASE_URL=https://ai.nomineelife.com
LLM_MODEL=Qwen2.5-1.5B-Instruct-Q5_K_M
LLM_API_KEY=
```

## Testing

Test the endpoints:

```bash
# Health check
curl http://localhost:8000/api/health

# Chat request
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "history": [],
    "max_tokens": 150,
    "temperature": 0.7
  }'

# Streaming chat
curl -N http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me a story",
    "history": [],
    "max_tokens": 150,
    "temperature": 0.7
  }'
```

## Development

Run with hot reload:

```bash
uvicorn main:app --reload --port 8000
```

## Production Deployment

For production, use gunicorn with uvicorn workers:

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```
