# 🎙️ Voice Avatar App

**Real-time AI voice conversation with animated avatar** – built with React + FastAPI.

## Architecture

```
User Voice  →  STT (Browser)  →  LLM API (Server)  →  TTS (Browser)  →  Animated Avatar
   ↓              ↓                    ↓                    ↓                  ↓
 Browser       Web Speech API     FastAPI + httpx      Web Speech API     Canvas 60fps
```

| Component   | Technology              | Location | Latency |
|-------------|-------------------------|----------|---------|
| **STT**     | Web Speech API          | Client   | <500ms  |
| **LLM**     | Nominee Life / Qwen2.5  | Server   | ~1–3s   |
| **TTS**     | Web Speech API          | Client   | Instant |
| **Avatar**  | Canvas + rAF            | Client   | 60fps   |

## Quick Start

```bash
# One-command dev start:
chmod +x scripts/dev.sh && ./scripts/dev.sh

# Or manually:

# Terminal 1 — Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npx vite
```

Open **http://localhost:5173** in Chrome or Edge.

## Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** – utility-first styling
- **Zustand** – lightweight state management
- **Web Speech API** – STT & TTS (zero network cost)
- **Canvas API** – 60fps avatar animation

### Backend
- **FastAPI** – async Python web framework
- **httpx** – async HTTP client with connection pooling
- **Pydantic** – request/response validation
- **GZip middleware** – compressed responses

## Skills.sh Best Practices Applied

| Skill | Key Rules |
|-------|-----------|
| **vercel-react-best-practices** | `rerender-use-ref-transient-values`, `rerender-memo`, `async-parallel`, `rendering-hoist-jsx`, `rerender-functional-setstate` |
| **anthropics/frontend-design** | Dark refined theme, DM Sans typography, intentional accent colors, not generic AI slop |
| **web-interface-guidelines** | `aria-label` on icon buttons, `focus-visible` rings, `prefers-reduced-motion`, semantic HTML, `touch-action: manipulation`, no `transition: all` |

## Project Structure

```
voice-avatar-app/
├── backend/
│   ├── app/
│   │   ├── api/routes/chat.py    # /api/chat + /api/chat/stream
│   │   ├── core/config.py        # Env settings (cached singleton)
│   │   ├── models/schemas.py     # Pydantic models
│   │   ├── services/llm_service.py # Async streaming LLM client
│   │   └── main.py               # FastAPI app factory
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Avatar/Avatar.tsx
│   │   │   ├── Chat/{ChatContainer,Message,TranscriptDisplay}.tsx
│   │   │   ├── Controls/{MicButton,StopButton,SettingsPanel}.tsx
│   │   │   └── UI/StatusIndicator.tsx
│   │   ├── hooks/
│   │   │   ├── useVoiceInput.ts
│   │   │   ├── useSpeechSynthesis.ts
│   │   │   ├── useChatAPI.ts
│   │   │   └── useAvatarAnimation.ts
│   │   ├── store/chatStore.ts
│   │   ├── types/index.ts
│   │   ├── utils/{constants,audioUtils}.ts
│   │   ├── App.tsx
│   │   └── styles/globals.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── scripts/{dev,build}.sh
```

## Keyboard Shortcut

| Key     | Action                |
|---------|-----------------------|
| `Space` | Toggle mic / Stop & Send |

## Performance Targets

```
STT latency:      < 500ms
API round-trip:    < 2s (streaming)
TTS start:         < 100ms
Animation:         60fps (16ms frames)
────────────────────────────
Total end-to-end:  < 3s
```
