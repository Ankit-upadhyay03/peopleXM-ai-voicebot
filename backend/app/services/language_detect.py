"""Language detection service for Hindi + English multilingual support.

Detects whether input text is Hindi (Devanagari script) or English.
Uses Unicode range detection — fast, no external dependencies.

Hindi Unicode range: \u0900-\u097F (Devanagari)

Examples:
    detect_language("How do I reset my password?")  → "en"
    detect_language("मेरा पासवर्ड कैसे रीसेट करें?") → "hi"
    detect_language("Mera password kaise reset kare?") → "en"  (Hinglish → treated as English)
"""

import re
from typing import Literal

# Devanagari Unicode block
DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")


def detect_language(text: str) -> Literal["hi", "en"]:
    """
    Detect if text is Hindi or English based on script.

    Uses proportion of Devanagari characters to determine language.
    If >= 30% of alphabetic characters are Devanagari, classify as Hindi.
    Otherwise, classify as English.

    Note: Hinglish (Hindi written in Latin script) is treated as English
    since the embedding model handles it well in that form.

    Args:
        text: Input text to classify.

    Returns:
        "hi" for Hindi, "en" for English.
    """
    if not text or not text.strip():
        return "en"

    devanagari_chars = len(DEVANAGARI_PATTERN.findall(text))
    # Count total alphabetic characters (Latin + Devanagari)
    alpha_chars = sum(1 for c in text if c.isalpha())

    if alpha_chars == 0:
        return "en"

    hindi_ratio = devanagari_chars / alpha_chars

    return "hi" if hindi_ratio >= 0.3 else "en"
