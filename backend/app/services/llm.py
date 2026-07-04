"""LLM service for RAG-based answer generation with conversation memory.

Uses OpenAI GPT to generate answers grounded in retrieved FAQ context.
Supports conversation history so follow-up questions have context.
Supports multilingual responses (Hindi + English).

Flow:
    Conversation history + Retrieved chunks + Current question + Language
        ↓ Build messages with system prompt + history + context
        ↓ Send to OpenAI GPT
        ↓ Grounded answer in detected language (no hallucination)

Example:
    User: How do I reset my password?
    Bot:  Go to Settings > Security...
    User: मेरा ईमेल भी भूल गया तो?
    Bot:  (responds in Hindi, understands context is about password reset)
"""

from typing import List, Dict, Any
from openai import OpenAI

from ..config import settings

SYSTEM_PROMPT_EN = """You are a PeopleXM support assistant.
Use ONLY the provided FAQ context to answer.
If the answer is not available in the FAQ, reply: "I couldn't find this information in the FAQ."
Do not make up information. Do not use any external knowledge.
Keep answers concise and helpful.
Use conversation history to understand follow-up questions.
Always respond in English."""

SYSTEM_PROMPT_HI = """You are a PeopleXM support assistant. You MUST respond ONLY in Hindi (Devanagari script).
Use ONLY the provided FAQ context to answer.
If the answer is not available in the FAQ, reply: "मुझे FAQ में यह जानकारी नहीं मिली।"
Do not make up information. Do not use any external knowledge.
Keep answers concise and helpful.
Use conversation history to understand follow-up questions.

CRITICAL RULES:
- You MUST reply in Hindi (Devanagari script like हिंदी). NEVER reply in English.
- Even if the context/FAQ is in English, translate your answer to Hindi.
- Even if the user's question is in romanized Hindi (like "password kaise reset karu"), ALWAYS respond in Devanagari Hindi.
- Think of yourself as a Hindi-speaking assistant. Respond naturally in Hindi like a normal conversation.
- Example: If FAQ says "Click Forgot Password on login page", you say "लॉगिन पेज पर 'Forgot Password' पर क्लिक करें"।
"""


class LLMService:
    """Generate answers using OpenAI GPT with RAG context and conversation memory."""

    def __init__(self, model: str = None):
        """
        Initialize LLM service.

        Args:
            model: OpenAI model name (gpt-3.5-turbo, gpt-4, etc.)
                   Defaults to LLM_MODEL from config.
        """
        self.model = model or settings.LLM_MODEL
        self._client = None

    @property
    def client(self) -> OpenAI:
        """Lazy-initialize OpenAI client on first use."""
        if self._client is None:
            if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your_api_key_here":
                raise ValueError(
                    "OPENAI_API_KEY not configured. Set it in .env file."
                )
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    def generate_answer(
        self,
        question: str,
        context_chunks: List[Dict[str, Any]],
        conversation_history: List[Dict[str, str]] = None,
        language: str = None,
    ) -> Dict[str, Any]:
        """
        Generate a grounded answer using retrieved FAQ chunks and conversation history.

        Automatically detects the user's language and responds in the same language.

        Args:
            question: The user's current question (Hindi or English).
            context_chunks: List of reranked chunks, each with "text", "score", "page", "source".
            conversation_history: Previous messages [{"role": "user"/"assistant", "content": "..."}]
            language: Optional language hint ("hi" or "en"). If provided, forces response language.

        Returns:
            {
                "answer": "पासवर्ड रीसेट करने के लिए Settings > Security पर जाएं...",
                "sources": [
                    {"source": "FAQ.pdf", "page": 12}
                ],
                "language": "hi"
            }
        """
        # Build context from retrieved chunks
        context_parts = []
        sources = []
        for i, chunk in enumerate(context_chunks):
            context_parts.append(f"[{i+1}] {chunk['text']}")
            source_info = {"source": chunk["source"], "page": chunk["page"]}
            if source_info not in sources:
                sources.append(source_info)

        context_text = "\n\n".join(context_parts)

        # Build messages array — use language-specific system prompt
        if language == "hi":
            system_prompt = SYSTEM_PROMPT_HI
        else:
            system_prompt = SYSTEM_PROMPT_EN

        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history (previous exchanges for context)
        if conversation_history:
            for msg in conversation_history:
                messages.append({"role": msg["role"], "content": msg["content"]})

        # Add current user message with FAQ context
        user_message = f"Context:\n{context_text}\n\nQuestion: {question}"
        if language == "hi":
            user_message += "\n\n[हिंदी में जवाब दें। English में जवाब मत दें।]"

        messages.append({"role": "user", "content": user_message})

        # Call OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.2,
            max_tokens=500,
        )

        answer = response.choices[0].message.content.strip()

        # Detect response language
        from .language_detect import detect_language
        detected_lang = language or detect_language(answer)

        return {
            "answer": answer,
            "sources": sources,
            "language": detected_lang,
        }
