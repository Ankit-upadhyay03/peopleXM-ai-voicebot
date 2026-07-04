"""Text-to-Speech service with multilingual support (Hindi + English).

Primary: ElevenLabs API with multilingual model (eleven_multilingual_v2)
Fallback: gTTS (Google Text-to-Speech, supports Hindi)
Last resort: pyttsx3 (offline, Windows SAPI — English only)

Flow:
    Text answer + language → TTS engine → Audio bytes → 🔊 Play in browser
"""

import io
import tempfile
from pathlib import Path
from typing import Optional

from ..config import settings

ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"

VOICES = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "roger": "CwhRBWXzGAHq8TQ4Fs17",
    "adam": "pNInz6obpgDQGcFmaJgB",
}


class ElevenLabsService:
    """Text-to-Speech with multilingual support.

    Priority:
        1. ElevenLabs (eleven_multilingual_v2) — best quality, supports Hindi
        2. gTTS (Google TTS) — free, supports Hindi, needs internet
        3. pyttsx3 (offline) — English only fallback
    """

    def __init__(self, voice: str = "rachel"):
        self.voice_id = VOICES.get(voice, voice)

    def _try_elevenlabs(self, text: str, language: str = "en") -> Optional[bytes]:
        """Try ElevenLabs API with multilingual model. Returns audio bytes or None."""
        import requests

        api_key = settings.ELEVENLABS_API_KEY
        if not api_key or api_key == "your_api_key_here":
            return None

        url = f"{ELEVENLABS_API_URL}/{self.voice_id}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        }

        # Use multilingual model for Hindi, flash model for English
        if language == "hi":
            model_id = settings.ELEVENLABS_MULTILINGUAL_MODEL
        else:
            model_id = "eleven_flash_v2_5"

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.content
        except Exception:
            pass

        return None

    def _try_gtts(self, text: str, language: str = "en") -> Optional[bytes]:
        """Try Google TTS (gTTS). Supports Hindi. Returns MP3 bytes or None."""
        try:
            from gtts import gTTS

            tts = gTTS(text=text, lang=language, slow=False)
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            return audio_buffer.read()
        except Exception:
            return None

    def _use_offline_tts(self, text: str) -> bytes:
        """Offline TTS using pyttsx3 (Windows SAPI voices). English only."""
        import pyttsx3

        engine = pyttsx3.init()
        engine.setProperty("rate", 160)
        engine.setProperty("volume", 1.0)

        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_path = temp_file.name
        temp_file.close()

        try:
            engine.save_to_file(text, temp_path)
            engine.runAndWait()
            audio_bytes = Path(temp_path).read_bytes()
            return audio_bytes
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def synthesize(self, text: str, voice_id: Optional[str] = None, language: str = "en") -> bytes:
        """
        Convert text to speech audio bytes with multilingual support.

        Priority chain:
            1. ElevenLabs (multilingual model for Hindi)
            2. gTTS (Google TTS — supports Hindi, free)
            3. pyttsx3 (offline, English only)

        Args:
            text: The text to convert to speech (Hindi or English).
            voice_id: Optional override for ElevenLabs voice ID.
            language: Language code ("hi" for Hindi, "en" for English).

        Returns:
            Audio bytes (MP3 from ElevenLabs/gTTS, WAV from pyttsx3).
        """
        if not text.strip():
            raise ValueError("Text cannot be empty.")

        # Try ElevenLabs first (supports Hindi with multilingual model)
        if voice_id:
            old_voice = self.voice_id
            self.voice_id = voice_id

        audio = self._try_elevenlabs(text, language=language)

        if voice_id:
            self.voice_id = old_voice

        if audio:
            return audio

        # Fallback to gTTS (supports Hindi)
        audio = self._try_gtts(text, language=language)
        if audio:
            return audio

        # Last resort: offline pyttsx3 (English only)
        return self._use_offline_tts(text)
