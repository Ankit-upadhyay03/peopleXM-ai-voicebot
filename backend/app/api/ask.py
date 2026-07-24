"""Semantic search + LLM RAG endpoint with source citation, conversation memory, and multilingual support.

POST /api/ask
Input:
{
    "question": "How can I reset my password?",
    "session_id": "optional-uuid",
    "language": "auto"              (optional: "en", "hi", or "auto")
}

Flow:
    Question → Language Detection → Embedding → ChromaDB Top 5 → Cross Encoder Re-rank
        → LLM (RAG + conversation history + language) → Answer + Citation

Output:
{
    "answer": "Click on Forgot Password...",
    "confidence": 94,
    "source": {
        "document": "Employee_FAQ.pdf",
        "page": 12
    },
    "session_id": "uuid-of-session",
    "language": "en"
}
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from ..services.embedding import EmbeddingService
from ..services.vector_store import VectorStore
from ..services.reranker import Reranker
from ..services.llm import LLMService
from ..services.memory import ConversationMemory
from ..services.conversation_logger import ConversationLogger
from ..services.language_detect import detect_language
from ..services.analytics_events import notify_analytics_update

router = APIRouter(prefix="/api", tags=["ask"])

# Initialize services
embedding_service = EmbeddingService()
vector_store = VectorStore()
reranker = Reranker()
llm_service = LLMService()
memory = ConversationMemory(max_history=10)
conversation_logger = ConversationLogger()


class AskRequest(BaseModel):
    """Request body for /ask endpoint."""
    question: str = Field(..., min_length=1, description="The question to ask (Hindi or English)")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity. Omit to start new session.")
    language: Optional[str] = Field(None, description="Language hint: 'en', 'hi', or 'auto'. Defaults to auto-detection.")


class SourceCitation(BaseModel):
    """Source citation — which document and page the answer came from."""
    document: str
    page: int


class AskResponse(BaseModel):
    """Response body for /ask endpoint."""
    answer: str
    confidence: int
    source: SourceCitation
    session_id: str
    language: str = Field(description="Detected/used language: 'en' or 'hi'")


@router.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    """
    RAG-powered FAQ answering with conversation memory, source citation, and multilingual support.

    Supports Hindi and English. Auto-detects language from the question
    and responds in the same language.

    Flow:
        1. Detect language (or use provided hint)
        2. Get/create session for conversation continuity
        3. Question → Embedding (768-dim, multilingual)
        4. ChromaDB vector search → Top 5 candidates
        5. Cross Encoder re-rank → Best chunks
        6. LLM generates answer in detected language
        7. Save exchange to session memory
        8. Return answer + confidence + source + session_id + language
    """
    try:
        # 1. Detect language
        if request.language and request.language in ("en", "hi"):
            detected_lang = request.language
        else:
            detected_lang = detect_language(request.question)

        # 2. Get or create session
        if request.session_id and memory.session_exists(request.session_id):
            session_id = request.session_id
        else:
            session_id = memory.create_session()

        # Get conversation history for this session
        conversation_history = memory.get_history(session_id)

        # 3. Convert question into embedding (multilingual model handles Hindi)
        query_embedding = embedding_service.embed(request.question)

        # 4. Search ChromaDB for top 5 candidate chunks
        results = vector_store.search(query_embedding=query_embedding, top_k=5)

        if not results:
            if detected_lang == "hi":
                answer = "मुझे FAQ में यह जानकारी नहीं मिली।"
            else:
                answer = "I couldn't find this information in the FAQ."
            memory.add_message(session_id, "user", request.question)
            memory.add_message(session_id, "assistant", answer)
            return AskResponse(
                answer=answer,
                confidence=0,
                source=SourceCitation(document="N/A", page=0),
                session_id=session_id,
                language=detected_lang,
            )

        # 5. Re-rank using Cross Encoder for better accuracy
        reranked = reranker.rerank(
            question=request.question,
            results=results,
            top_k=5,
        )

        # 6. Generate answer using LLM with context + conversation history + language
        llm_result = llm_service.generate_answer(
            question=request.question,
            context_chunks=reranked,
            conversation_history=conversation_history,
            language=detected_lang,
        )

        # 7. Save this exchange to memory
        memory.add_message(session_id, "user", request.question)
        memory.add_message(session_id, "assistant", llm_result["answer"])

        # 8. Calculate confidence from top reranked chunk score
        top_score = reranked[0]["score"] if reranked else 0
        confidence = _calculate_confidence(top_score)

        # 9. Get source citation from top ranked chunk
        top_chunk = reranked[0]
        source = SourceCitation(
            document=top_chunk["source"],
            page=top_chunk["page"],
        )

        # 10. Log conversation to MongoDB
        try:
            conversation_logger.log(
                session_id=session_id,
                question=request.question,
                answer=llm_result["answer"],
                confidence=confidence,
                source=top_chunk["source"],
                page=top_chunk["page"],
            )
            # Notify SSE listeners that new data is available
            notify_analytics_update()
        except Exception:
            # Logging failure should not break the response
            pass

        return AskResponse(
            answer=llm_result["answer"],
            confidence=confidence,
            source=source,
            session_id=session_id,
            language=llm_result.get("language", detected_lang),
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing question: {str(e)}",
        )


def _calculate_confidence(cross_encoder_score: float) -> int:
    """
    Convert Cross Encoder score to confidence percentage (0-100).

    Cross Encoder (ms-marco-MiniLM-L-6-v2) scores:
        - High relevance: +5 to +12
        - Medium relevance: 0 to +5
        - Low relevance: -5 to 0
        - Irrelevant: -10 to -5

    Mapping:
        score >= 10  → 99
        score >= 5   → 85-99
        score >= 0   → 50-85
        score >= -5  → 20-50
        score < -5   → 0-20
    """
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
