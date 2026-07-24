"""Voice endpoints — Speech-to-Text (Whisper) and Text-to-Speech (ElevenLabs) with multilingual support.

POST /api/voice/transcribe  — Upload audio, get text transcription (Hindi/English auto-detect)
POST /api/voice/synthesize  — Send text + language, get audio back
POST /api/voice/ask         — Full voice pipeline: Audio in → Answer audio out (any language)
"""

from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import Response
from typing import Optional

from ..services.whisper import WhisperService
from ..services.elevenlabs import ElevenLabsService
from ..services.embedding import EmbeddingService
from ..services.vector_store import VectorStore
from ..services.reranker import Reranker
from ..services.llm import LLMService
from ..services.memory import ConversationMemory
from ..services.conversation_logger import ConversationLogger
from ..services.language_detect import detect_language
from ..services.analytics_events import notify_analytics_update
from ..config import settings

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Initialize services
whisper_service = WhisperService()
elevenlabs_service = ElevenLabsService()
embedding_service = EmbeddingService()
vector_store = VectorStore()
reranker = Reranker()
llm_service = LLMService()
memory = ConversationMemory(max_history=10)
conversation_logger = ConversationLogger()

SUPPORTED_AUDIO_FORMATS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"}


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form(default="auto"),
):
    """
    Speech-to-Text: Upload audio file, get text transcription.

    Supports Hindi and English with auto-detection.

    Args:
        audio: Audio file (mp3, wav, webm, m4a, ogg, mp4)
        language: "en", "hi", or "auto" (default: auto-detect)

    Returns: {"text": "मेरा पासवर्ड कैसे रीसेट करें?", "language": "hi"}
    """
    # Validate audio format
    ext = Path(audio.filename).suffix.lower() if audio.filename else ".webm"
    if ext not in SUPPORTED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format. Allowed: {', '.join(SUPPORTED_AUDIO_FORMATS)}",
        )

    try:
        audio_bytes = await audio.read()
        # Pass None for auto-detection, or specific language code
        lang = None if language == "auto" else language
        result = whisper_service.transcribe_bytes(
            audio_bytes=audio_bytes,
            filename=audio.filename or "audio.webm",
            language=lang,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")


@router.post("/synthesize")
async def synthesize_speech(
    text: str = Form(...),
    voice: Optional[str] = Form(default=None),
    language: str = Form(default="auto"),
):
    """
    Text-to-Speech: Send text, get audio back. Supports Hindi.

    Args:
        text: Text to synthesize (Hindi or English)
        voice: Optional ElevenLabs voice ID override
        language: "en", "hi", or "auto" (auto-detects from text)

    Returns: audio/mpeg binary
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # Auto-detect language from text if not specified
    if language == "auto":
        lang = detect_language(text)
    else:
        lang = language

    try:
        audio_bytes = elevenlabs_service.synthesize(text=text, voice_id=voice, language=lang)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=response.mp3"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech synthesis error: {str(e)}")


@router.post("/ask")
async def voice_ask(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(default=None),
    language: str = Form(default="auto"),
):
    """
    Full voice pipeline: Audio question in → Answer + audio out.
    Supports Hindi and English with auto-detection.

    Flow:
        🎤 Audio → Whisper (STT, auto-detect language) → RAG Pipeline
        → LLM (responds in detected language) → Answer text
        → ElevenLabs (TTS in same language) → 🔊 Audio response

    Returns:
    {
        "transcription": "मेरा पासवर्ड कैसे रीसेट करें?",
        "answer": "पासवर्ड रीसेट करने के लिए Settings > Security पर जाएं...",
        "confidence": 94,
        "source": {"document": "FAQ.pdf", "page": 1},
        "session_id": "uuid",
        "language": "hi"
    }
    """
    # 1. Transcribe audio to text (with language auto-detection)
    try:
        audio_bytes = await audio.read()
        lang = None if language == "auto" else language
        transcription = whisper_service.transcribe_bytes(
            audio_bytes=audio_bytes,
            filename=audio.filename or "audio.webm",
            language=lang,
        )
        question = transcription["text"]
        detected_lang = transcription["language"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

    if not question.strip():
        raise HTTPException(status_code=400, detail="Could not transcribe audio. Please try again.")

    # 2. Get/create session
    if session_id and memory.session_exists(session_id):
        sid = session_id
    else:
        sid = memory.create_session()

    conversation_history = memory.get_history(sid)

    # 3. RAG pipeline
    try:
        query_embedding = embedding_service.embed(question)
        results = vector_store.search(query_embedding=query_embedding, top_k=5)

        if not results:
            if detected_lang == "hi":
                answer = "मुझे FAQ में यह जानकारी नहीं मिली।"
            else:
                answer = "I couldn't find this information in the FAQ."
            confidence = 0
            source_doc = "N/A"
            source_page = 0
        else:
            reranked = reranker.rerank(question=question, results=results, top_k=5)

            # Generate answer via LLM (in detected language)
            try:
                llm_result = llm_service.generate_answer(
                    question=question,
                    context_chunks=reranked,
                    conversation_history=conversation_history,
                    language=detected_lang,
                )
                answer = llm_result["answer"]
            except Exception:
                # LLM failed (quota etc.), use top chunk as fallback
                answer = reranked[0]["text"]

            # Confidence
            top_score = reranked[0]["score"]
            confidence = _calculate_confidence(top_score)
            source_doc = reranked[0]["source"]
            source_page = reranked[0]["page"]

        # 4. Save to memory
        memory.add_message(sid, "user", question)
        memory.add_message(sid, "assistant", answer)

        # 5. Log to MongoDB
        try:
            conversation_logger.log(
                session_id=sid,
                question=question,
                answer=answer,
                confidence=confidence,
                source=source_doc,
                page=source_page,
            )
            notify_analytics_update()
        except Exception:
            pass

        return {
            "transcription": question,
            "answer": answer,
            "confidence": confidence,
            "source": {"document": source_doc, "page": source_page},
            "session_id": sid,
            "language": detected_lang,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing voice question: {str(e)}")


def _calculate_confidence(cross_encoder_score: float) -> int:
    """Convert Cross Encoder score to confidence percentage (0-100)."""
    if cross_encoder_score >= 10:
        confidence = 99
    elif cross_encoder_score >= 5:
        confidence = int(85 + (cross_encoder_score - 5) * (14 / 5))
    elif cross_encoder_score >= 0:
        confidence = int(50 + cross_encoder_score * (35 / 5))
    elif cross_encoder_score >= -5:
        confidence = int(20 + (cross_encoder_score + 5) * (30 / 5))
    else:
        confidence = max(0, int(20 + (cross_encoder_score + 5) * 4))
    return max(0, min(99, confidence))
