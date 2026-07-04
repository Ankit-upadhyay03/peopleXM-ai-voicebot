# PeopleXM AI Voicebot

An AI-powered FAQ assistant for employee engagement — supports text and voice interactions using RAG (Retrieval-Augmented Generation) pipeline.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python FastAPI |
| Embedding | sentence-transformers (all-mpnet-base-v2, 768 dims) |
| Re-ranker | Cross Encoder (ms-marco-MiniLM-L-6-v2) |
| Vector DB | ChromaDB (persistent) |
| LLM | OpenAI GPT-3.5 Turbo |
| Speech-to-Text | OpenAI Whisper |
| Text-to-Speech | ElevenLabs |
| Database | MongoDB Atlas (conversation logs) |

## Project Structure

```
peoplexm-ai-voicebot/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ask.py          — POST /api/ask (RAG + LLM)
│   │   │   ├── upload.py       — POST /api/upload/upload-faq
│   │   │   ├── voice.py        — POST /api/voice/* (STT + TTS)
│   │   │   ├── logs.py         — GET /api/logs
│   │   │   └── health.py       — GET /api/health
│   │   ├── services/
│   │   │   ├── file_parser.py  — PDF/DOCX/TXT/CSV text extraction
│   │   │   ├── text_splitter.py — Character-based chunking (600 chars, 100 overlap)
│   │   │   ├── embedding.py    — 768-dim embeddings (all-mpnet-base-v2)
│   │   │   ├── vector_store.py — ChromaDB storage with metadata
│   │   │   ├── reranker.py     — Cross Encoder re-ranking
│   │   │   ├── llm.py          — OpenAI GPT RAG answer generation
│   │   │   ├── whisper.py      — Speech-to-Text (Whisper API)
│   │   │   ├── elevenlabs.py   — Text-to-Speech (ElevenLabs)
│   │   │   ├── memory.py       — In-memory conversation sessions
│   │   │   └── conversation_logger.py — MongoDB logging
│   │   ├── database/
│   │   │   ├── chroma_db.py    — ChromaDB client
│   │   │   └── mongodb.py      — MongoDB Atlas client
│   │   ├── config.py           — Pydantic settings from .env
│   │   └── main.py             — FastAPI app entry point
│   ├── requirements.txt
│   └── .env                    — API keys and config
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx  — Chat with auto-speak
│   │   │   ├── ChatMessage.jsx — Message bubbles + citations
│   │   │   ├── Dashboard.jsx   — Analytics (charts)
│   │   │   ├── UploadPanel.jsx — Drag & drop upload
│   │   │   ├── Sidebar.jsx     — Navigation
│   │   │   ├── Header.jsx      — Dark/light toggle
│   │   │   └── SettingsPanel.jsx
│   │   ├── services/api.js     — Axios API client
│   │   ├── context/ThemeContext.jsx — Dark/Light mode
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## How to Run

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/upload/upload-faq | Upload & index FAQ document |
| POST | /api/ask | Ask question (text) |
| POST | /api/voice/transcribe | Speech-to-Text |
| POST | /api/voice/synthesize | Text-to-Speech |
| POST | /api/voice/ask | Full voice pipeline |
| GET | /api/logs/ | View conversation logs |
| GET | /api/health/ | Health check |
