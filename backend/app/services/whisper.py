"""Whisper Speech-to-Text service with multilingual support.

Converts audio recordings to text using OpenAI Whisper API.
Supports Hindi and English — always transcribes in original language (never translates).

Flow:
    🎤 Audio (webm/mp3/wav) → Whisper API → Text in original language + detected language

Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
Supported languages: English (en), Hindi (hi), auto-detect
"""

from pathlib import Path
from openai import OpenAI

from ..config import settings


class WhisperService:
    """Convert speech to text using OpenAI Whisper with Hindi + English support."""

    def __init__(self):
        self._client = None

    @property
    def client(self) -> OpenAI:
        """Lazy-initialize OpenAI client."""
        if self._client is None:
            if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your_api_key_here":
                raise ValueError("OPENAI_API_KEY not configured.")
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    def transcribe(self, audio_file_path: str, language: str = None) -> dict:
        """
        Transcribe audio file to text in original language (no translation).

        Strategy:
            - If language explicitly provided ("hi" or "en"), use it directly
            - If auto-detect: transcribe TWICE (once as Hindi, once as English)
              and use confidence/length heuristics to pick the best one.
              This prevents Whisper from translating Hindi speech to English.

        Args:
            audio_file_path: Path to the audio file.
            language: Language code ("en", "hi") or None for auto-detection.

        Returns:
            {
                "text": "मैं अपना प्रोफाइल पिक्चर कैसे बदलूं?",
                "language": "hi"
            }
        """
        audio_path = Path(audio_file_path)

        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

        if language and language != "auto":
            # Language explicitly provided — transcribe directly
            return self._transcribe_with_language(audio_path, language)

        # Auto-detection strategy:
        # Step 1: Try verbose_json to get Whisper's language guess
        with open(audio_path, "rb") as audio_file:
            detect_response = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
            )

        raw_lang = getattr(detect_response, "language", "english")

        # If Whisper confidently says Hindi, transcribe as Hindi
        if raw_lang in ("hindi", "hi"):
            return self._transcribe_with_language(audio_path, "hi")

        # If Whisper says English, it might still be Hindi spoken conversationally.
        # Transcribe as Hindi anyway and compare — if Hindi transcription has
        # Devanagari characters, the speaker was likely speaking Hindi.
        hindi_result = self._transcribe_with_language(audio_path, "hi")

        # Check if Hindi transcription contains Devanagari script
        import re
        devanagari_count = len(re.findall(r"[\u0900-\u097F]", hindi_result["text"]))

        if devanagari_count >= 3:
            # Has meaningful Devanagari content — speaker was speaking Hindi
            return hindi_result

        # No Devanagari — it's genuinely English
        english_result = self._transcribe_with_language(audio_path, "en")
        return english_result

    def _transcribe_with_language(self, audio_path: Path, language: str) -> dict:
        """Transcribe with a specific language forced."""
        with open(audio_path, "rb") as audio_file:
            response = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                response_format="text",
                prompt=self._get_language_prompt(language),
            )

        transcribed_text = response.strip() if isinstance(response, str) else response.text.strip()

        return {
            "text": transcribed_text,
            "language": language,
        }

    def _get_language_prompt(self, language: str) -> str:
        """
        Provide a prompt hint to Whisper to keep output in the correct language/script.

        The prompt biases Whisper towards outputting in the expected script.
        For Hindi, this ensures Devanagari output instead of romanized/translated text.
        """
        if language == "hi":
            return "हिंदी में बातचीत। देवनागरी लिपि में लिखें: प्रोफाइल, पासवर्ड, सेटिंग्स, अकाउंट।"
        return ""

    def transcribe_bytes(self, audio_bytes: bytes, filename: str = "audio.webm", language: str = None) -> dict:
        """
        Transcribe audio from bytes (for direct upload from frontend).

        Args:
            audio_bytes: Raw audio data bytes.
            filename: Filename with extension (used for format detection).
            language: Language code ("en", "hi") or None/auto for auto-detection.

        Returns:
            {"text": "पासवर्ड कैसे रीसेट करूं?", "language": "hi"}
        """
        temp_path = Path(settings.UPLOAD_DIR) / f"temp_{filename}"
        temp_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path.write_bytes(audio_bytes)

        try:
            result = self.transcribe(str(temp_path), language=language)
        finally:
            temp_path.unlink(missing_ok=True)

        return result
