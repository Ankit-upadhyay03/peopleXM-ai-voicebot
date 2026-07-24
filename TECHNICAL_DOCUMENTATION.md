# VoiceBOT — Technical Documentation

## AI-Powered Multilingual FAQ Assistant with RAG Pipeline

---

## 1. Problem Statement

### Context

Organizations with large employee bases face a recurring challenge: support teams (HR, IT helpdesk) spend a significant portion of their time answering the same repetitive questions — password resets, leave policies, payslip downloads, profile updates. This leads to:

- **High support ticket volume** — 60-70% of tickets are FAQ-type queries with documented answers
- **Slow response times** — employees wait hours for answers already in policy documents
- **No voice-based self-service** — employees must type, navigate portals, or wait for human agents
- **Language barrier** — Hindi-speaking employees lack support in their native language, forcing them to interact in English or seek help from colleagues

### Problem Definition

Build an intelligent, voice-enabled FAQ assistant that:
1. Answers questions strictly from uploaded company documents (no hallucination)
2. Supports both Hindi and English — voice and text
3. Auto-detects the user's language and responds in the same language
4. Provides source citations (document name + page number) with every answer
5. Tracks real-time usage analytics derived from actual conversation data
6. Works with natural conversational language, not just exact keyword matches

### Target Users

- Employees seeking quick answers to HR/IT FAQs
- Administrators uploading knowledge base documents
- Management monitoring usage patterns via analytics dashboard

---

## 2. Design Approach

### 2.1 Architecture Overview

The system follows a **layered service-oriented architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────┐
│                FRONTEND (React)                   │
│   Chat Window | Upload | Analytics | Settings     │
└──────────────────────┬──────────────────────────┘
                       │ REST API + SSE
┌──────────────────────▼──────────────────────────┐
│                BACKEND (FastAPI)                   │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │           API Layer (Routers)                │ │
│  │   /ask  /voice  /upload  /analytics  /logs  │ │
│  └─────────────────────┬───────────────────────┘ │
│                        │                          │
│  ┌─────────────────────▼───────────────────────┐ │
│  │          Services Layer                      │ │
│  │  Embedding | LLM | Reranker | Whisper |      │ │
│  │  ElevenLabs | Memory | Analytics | Logger    │ │
│  └─────────────┬───────────────────┬───────────┘ │
│                │                   │              │
│  ┌─────────────▼─────┐  ┌────────▼───────────┐  │
│  │    ChromaDB        │  │     MongoDB        │  │
│  │  (Vector Store)    │  │  (Conversation     │  │
│  │                    │  │   Logs + Analytics) │  │
│  └────────────────────┘  └────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 2.2 RAG Pipeline (Retrieval-Augmented Generation)

The core intelligence of VoiceBOT is a RAG pipeline that ensures the LLM only answers from provided context, eliminating hallucination.

**Document Ingestion (One-time per document):**

```
File Upload → FileParser (PDF/DOCX/TXT/CSV)
    → TextSplitter (600-char chunks, 100-char overlap)
    → EmbeddingService (768-dimensional vectors)
    → ChromaDB (persistent storage with source metadata)
```

**Query Processing (Per user question):**

```
Question → EmbeddingService (768-dim query vector)
    → ChromaDB cosine similarity search (top 5 candidates)
    → Cross Encoder re-ranking (ms-marco-MiniLM-L-6-v2)
    → LLM (GPT-3.5-turbo with system prompt + conversation history + context)
    → Grounded answer + source citation + confidence score
```

### 2.3 Multilingual Design

**Challenge:** Supporting Hindi in a pipeline originally built for English.

**Solution — Multi-layer language handling:**

| Layer | English | Hindi |
|-------|---------|-------|
| Embedding | paraphrase-multilingual-mpnet-base-v2 | Same model (cross-lingual) |
| STT | Whisper (language="en") | Whisper (language="hi" + Devanagari prompt) |
| LLM | English system prompt | Separate Hindi system prompt (forces Devanagari output) |
| TTS | ElevenLabs flash model | ElevenLabs eleven_multilingual_v2 / gTTS |

**Cross-lingual retrieval:** A Hindi query like "पासवर्ड कैसे रीसेट करें?" maps to the same vector space as English FAQ content about password resets, enabling semantic matching across languages.

**Language detection strategy:**
1. If user explicitly sets language → use it
2. For voice: Whisper detects language, then dual-transcription verifies (tries Hindi, checks for Devanagari output)
3. For text: Unicode Devanagari character ratio (≥30% → Hindi)

### 2.4 Voice Pipeline

```
🎤 User speaks
    → MediaRecorder (WebM audio capture)
    → Web Audio API AnalyserNode (real-time volume monitoring)
    → Auto-stop after 1.8s silence (SILENCE_THRESHOLD=15, MIN_RECORDING=1000ms)
    → Send audio blob to backend
    → Whisper STT (auto-detect language, force Devanagari for Hindi)
    → [RAG Pipeline — same as text]
    → Answer text
    → ElevenLabs/gTTS (multilingual TTS)
    → Audio response played in browser
```

### 2.5 Real-Time Analytics

**Data flow:**
1. User asks question → backend processes and logs to MongoDB
2. After MongoDB insert → `notify_analytics_update()` signals all SSE listeners
3. SSE endpoint computes fresh aggregations from MongoDB
4. Frontend `EventSource` receives `analytics_update` event → updates dashboard state
5. React re-renders charts with animated transitions

**Semantic question clustering:**
- All unique questions embedded using multilingual model
- Greedy cosine similarity clustering (threshold: 0.75)
- Semantically similar questions grouped under one canonical label
- "how do i change my pass", "password kaise reset karu", "how to reset password" → all count as one topic

### 2.6 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Lazy initialization | Models (~1.2GB) load on first use, not import — prevents blocking app startup |
| Graceful degradation | MongoDB down → app still answers; ElevenLabs fails → gTTS fallback; LLM timeout → top chunk as answer |
| In-memory sessions | Fast read/write for conversation continuity; MongoDB for persistence |
| Cross Encoder re-ranking | Vector search returns approximate results; re-ranking improves precision significantly |
| SSE over WebSocket | Simpler, unidirectional (server→client), auto-reconnect built in, sufficient for analytics push |
| IST timestamps | All data stored and displayed in Indian Standard Time for local relevance |
| Character-based chunking with overlap | 600 chars balances context size vs. relevance; 100-char overlap preserves context at boundaries |

---

## 3. APIs Used

### 3.1 External APIs

| API | Purpose | Model/Version | Pricing |
|-----|---------|---------------|---------|
| **OpenAI Chat Completions** | LLM answer generation | gpt-3.5-turbo | Pay-per-token |
| **OpenAI Whisper** | Speech-to-text transcription | whisper-1 | $0.006/minute |
| **ElevenLabs TTS** | Text-to-speech (primary) | eleven_multilingual_v2, eleven_flash_v2_5 | Subscription |
| **Google TTS (gTTS)** | Text-to-speech (fallback) | Standard | Free |
| **HuggingFace Hub** | Model downloads (sentence-transformers) | — | Free |

### 3.2 Internal REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ask` | Text-based RAG question answering |
| POST | `/api/voice/ask` | Full voice pipeline (audio in → answer out) |
| POST | `/api/voice/transcribe` | Speech-to-text only |
| POST | `/api/voice/synthesize` | Text-to-speech only |
| POST | `/api/upload/upload-faq` | Upload and index a document |
| GET | `/api/analytics` | One-shot analytics fetch |
| GET | `/api/analytics/stream` | SSE real-time analytics stream |
| GET | `/api/logs` | Recent conversation logs |
| GET | `/api/logs/{session_id}` | Logs for a specific session |
| GET | `/api/health` | Health check |

### 3.3 Request/Response Examples

**POST /api/ask**
```json
// Request
{
  "question": "पासवर्ड कैसे रीसेट करें?",
  "session_id": "optional-uuid",
  "language": "auto"
}

// Response
{
  "answer": "लॉगिन पेज पर 'Forgot Password' पर क्लिक करें, अपना ईमेल वेरीफाई करें, और नया पासवर्ड बनाएं।",
  "confidence": 94,
  "source": {
    "document": "PeopleXM_FAQ_Knowledge_Base_100_FAQs.pdf",
    "page": 0
  },
  "session_id": "cbba838e-fc5d-453b-9b49-0888f0777a85",
  "language": "hi"
}
```

**GET /api/analytics**
```json
{
  "totalQuestions": 13,
  "avgConfidence": 79.0,
  "failedQueries": 0,
  "todayUsage": 13,
  "successRate": 100.0,
  "avgResponseTime": 53.2,
  "weeklyVolume": [
    {"day": "Mon", "queries": 0},
    {"day": "Tue", "queries": 0},
    {"day": "Wed", "queries": 0},
    {"day": "Thu", "queries": 0},
    {"day": "Fri", "queries": 13},
    {"day": "Sat", "queries": 0},
    {"day": "Sun", "queries": 0}
  ],
  "topQuestions": [
    {"question": "How do I reset my password?", "count": 7},
    {"question": "Where can I download payslips?", "count": 3}
  ],
  "confidenceDistribution": [
    {"name": "High (80-100%)", "value": 77, "color": "#10b981"},
    {"name": "Medium (50-79%)", "value": 0, "color": "#f59e0b"},
    {"name": "Low (0-49%)", "value": 23, "color": "#ef4444"}
  ]
}
```

### 3.4 ML Models Used (Local)

| Model | Source | Dimensions | Size | Purpose |
|-------|--------|-----------|------|---------|
| paraphrase-multilingual-mpnet-base-v2 | sentence-transformers | 768 | ~1.1GB | Text embeddings (50+ languages) |
| cross-encoder/ms-marco-MiniLM-L-6-v2 | sentence-transformers | — | ~90MB | Re-ranking search results |

### 3.5 Database Schemas

**MongoDB — conversation_logs collection:**
```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",
  "question": "user question text",
  "answer": "bot answer text",
  "confidence": 94,
  "source": "filename.pdf",
  "page": 0,
  "timestamp": "2026-07-24T17:10:04.413+05:30"
}
```

**ChromaDB — voicebot_documents collection:**
```json
{
  "id": "filename.pdf_chunk_0",
  "embedding": [0.023, -0.145, ...],  // 768 floats
  "document": "chunk text content...",
  "metadata": {
    "source": "filename.pdf",
    "page": 0,
    "chunk_id": 0
  }
}
```

---

## 4. Challenges Faced

### Challenge 1: Whisper Translating Hindi Speech to English

**Problem:** When a user spoke Hindi (especially conversational/Hinglish like "password kaise reset karu"), OpenAI Whisper's auto-detect mode would classify it as English and output "How do I reset my password?" — a translation, not a transcription.

**Root Cause:** Whisper's language detection is unreliable for Hinglish (Hindi with English loanwords). The model defaults to English and translates.

**Solution:** Implemented dual-transcription approach:
1. First call: verbose_json to get Whisper's language guess
2. Always try Hindi transcription regardless of detection
3. Check output for Devanagari characters (≥3 characters = Hindi)
4. Added Devanagari prompt hint: "हिंदी में बातचीत। देवनागरी लिपि में लिखें: प्रोफाइल, पासवर्ड, सेटिंग्स"
5. If Hindi transcription has Devanagari → user spoke Hindi; otherwise → English

**Trade-off:** Two API calls per voice request in auto-detect mode (slight latency increase, but accuracy is critical).

### Challenge 2: Embedding Model Mismatch

**Problem:** Initially used `all-mpnet-base-v2` (English-only). Hindi queries returned zero results from ChromaDB because the model couldn't map Hindi text to the same vector space as English FAQ content.

**Root Cause:** Monolingual embedding model produces unrelated vectors for different languages.

**Solution:** Switched to `paraphrase-multilingual-mpnet-base-v2` which maps 50+ languages to a shared 768-dimensional space. A Hindi query now finds relevant English chunks via cosine similarity.

**Impact:** Required re-indexing all documents (re-upload FAQ files after model change). Same 768 dimensions, so ChromaDB schema unchanged.

### Challenge 3: Cold Start Time (~90 seconds)

**Problem:** Server startup takes ~90 seconds because two transformer models (~1.2GB combined) load into RAM on first request.

**Root Cause:** `EmbeddingService()` and `Reranker()` instantiated at module level in API route files — triggers immediate model loading on import.

**Solution:**
- Lazy initialization (models load on first actual request, not import)
- Pre-downloaded models cached locally (no download on subsequent starts)
- Removed `--reload` flag in production (avoids double-loading)

**Production recommendation:** Use gunicorn with preloaded workers or FastAPI lifespan events for background model loading.

### Challenge 4: MongoDB Connection Caching False

**Problem:** If MongoDB Atlas was unreachable during the first connection attempt (network timeout at startup), `is_connected` cached `False` permanently. All subsequent writes silently failed.

**Root Cause:** Original code only checked connection once (`if self._connected is None`). After initial failure, it never retried.

**Solution:** Changed `is_connected` property to retry if previously failed:
```python
@property
def is_connected(self) -> bool:
    if self._connected is True:
        return True
    # Retry on every check if previously failed
    try:
        self.client.admin.command("ping")
        self._connected = True
    except Exception:
        self._connected = False
    return self._connected
```

### Challenge 5: Analytics Showing Different Questions as Separate Entries

**Problem:** "how do i change my pass", "how can i reset password", "password kaise reset karu" all appeared as separate entries in Top Questions — defeating the purpose of analytics.

**Root Cause:** Original aggregation used exact string grouping (`$group: {_id: "$question"}`).

**Solution:** Semantic clustering using embeddings:
1. Fetch all unique question strings from MongoDB
2. Embed them using the multilingual model
3. Greedy clustering with cosine similarity threshold (0.75)
4. All semantically similar questions merge into one cluster
5. Most common wording becomes the display label

### Challenge 6: Circular Import Between API and Services

**Problem:** `ask.py` needed to call `notify_analytics_update()` from `analytics.py`, but both were in the `api` package — creating import cycles.

**Solution:** Extracted the event signaling into a separate `services/analytics_events.py` module that both can import without circular dependency.

### Challenge 7: IST Timezone in MongoDB Aggregations

**Problem:** Timestamps stored in IST, but MongoDB's `$hour` operator extracts hours in UTC by default, causing hourly traffic chart to show wrong hours.

**Solution:** Used MongoDB's timezone-aware date operators:
```python
{"$hour": {"date": "$timestamp", "timezone": "Asia/Kolkata"}}
```

---

## 5. Future Improvements

### Short-term (Next Sprint)

- **Persistent sessions in MongoDB** — Currently in-memory; sessions lost on server restart
- **User authentication** — JWT-based login, role-based access (admin vs. employee)
- **Rate limiting** — Prevent API abuse, per-user request throttling
- **Response time tracking** — Store separate request/response timestamps for accurate measurement
- **Feedback mechanism** — Thumbs up/down on answers to improve retrieval quality

### Medium-term (1-2 Months)

- **More languages** — Tamil, Telugu, Bengali, Marathi (model already supports them)
- **Document versioning** — Track when FAQs are updated, re-index automatically
- **Conversation export** — Download chat history as PDF for records
- **Semantic search improvements** — Hybrid search (keyword + vector) for better precision
- **Streaming LLM responses** — Token-by-token output for faster perceived response time

### Long-term (Architecture Evolution)

- **Cloud deployment** — AWS ECS/Lambda with GPU instances for faster inference
- **Model fine-tuning** — Fine-tune embedding model on domain-specific FAQ data
- **Multi-tenant architecture** — Support multiple organizations with isolated data
- **Automated FAQ generation** — Analyze conversation logs to suggest new FAQ entries
- **Integration with HRMS** — Connect to existing HR systems (SAP, Workday) for dynamic answers
- **Mobile SDK** — Native iOS/Android integration via REST API
- **Offline mode** — Local small language model for basic queries without internet

### Performance Optimization

- **Model quantization** — INT8 quantization to reduce model size and inference time
- **Response caching** — Cache frequent question-answer pairs in Redis
- **Batch embedding** — Process multiple questions in a single GPU pass
- **Connection pooling** — MongoDB connection pool for concurrent requests
- **CDN for TTS audio** — Cache frequently spoken answers as static audio files

---

## Appendix: Project Structure

```
peoplexm-ai-voicebot/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ask.py              # Text Q&A endpoint
│   │   │   ├── voice.py            # Voice pipeline endpoints
│   │   │   ├── upload.py           # Document upload + indexing
│   │   │   ├── analytics.py        # SSE real-time analytics
│   │   │   ├── logs.py             # Conversation log retrieval
│   │   │   └── health.py           # Health check
│   │   ├── services/
│   │   │   ├── embedding.py        # Multilingual embeddings (768-dim)
│   │   │   ├── llm.py              # OpenAI GPT answer generation
│   │   │   ├── reranker.py         # Cross Encoder re-ranking
│   │   │   ├── whisper.py          # Speech-to-text (Whisper)
│   │   │   ├── elevenlabs.py       # Text-to-speech (multilingual)
│   │   │   ├── vector_store.py     # ChromaDB wrapper
│   │   │   ├── memory.py           # In-memory conversation sessions
│   │   │   ├── analytics.py        # MongoDB aggregation pipelines
│   │   │   ├── analytics_events.py # SSE event signaling
│   │   │   ├── conversation_logger.py # MongoDB logging
│   │   │   ├── language_detect.py  # Hindi/English detection
│   │   │   ├── file_parser.py      # PDF/DOCX/TXT/CSV extraction
│   │   │   └── text_splitter.py    # Character-based chunking
│   │   ├── database/
│   │   │   ├── mongodb.py          # MongoDB client (Atlas)
│   │   │   └── chroma_db.py        # ChromaDB client
│   │   ├── config.py               # Pydantic settings from .env
│   │   └── main.py                 # FastAPI app entry point
│   ├── requirements.txt
│   └── uploads/                    # Uploaded FAQ documents
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx      # Chat + voice recording + auto-stop
│   │   │   ├── Dashboard.jsx       # Real-time analytics (SSE)
│   │   │   ├── ChatMessage.jsx     # Message bubble + citations
│   │   │   ├── Sidebar.jsx         # Navigation
│   │   │   ├── Header.jsx          # Top bar
│   │   │   ├── UploadPanel.jsx     # Document upload UI
│   │   │   └── SettingsPanel.jsx   # Configuration
│   │   ├── services/
│   │   │   └── api.js              # Axios + EventSource
│   │   ├── context/
│   │   │   └── ThemeContext.jsx     # Dark mode
│   │   └── index.css               # Glassmorphism + dark theme
│   ├── tailwind.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

*Document Version: 1.0 | Last Updated: July 2026*
