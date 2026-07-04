"""Text splitting service for chunking documents."""

from typing import List


class TextSplitter:
    """Split text into character-based chunks with overlap to preserve context."""

    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 100):
        """
        Initialize TextSplitter.

        Args:
            chunk_size: Maximum characters per chunk (recommended: 500-800).
            chunk_overlap: Overlapping characters between chunks to preserve context.
        """
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split(self, text: str) -> List[str]:
        """
        Split text into overlapping chunks based on character count.

        Tries to break at sentence boundaries (. ! ?) or newlines to keep
        chunks meaningful. Falls back to word boundaries if no sentence
        break is found within the chunk window.

        Args:
            text: The full text to split.

        Returns:
            List of text chunks.
        """
        if not text or not text.strip():
            return []

        text = text.strip()
        chunks: List[str] = []
        start = 0

        while start < len(text):
            end = start + self.chunk_size

            # If we've reached the end of the text
            if end >= len(text):
                chunk = text[start:].strip()
                if chunk:
                    chunks.append(chunk)
                break

            # Try to find a natural break point (sentence end or newline)
            chunk_text = text[start:end]
            break_point = self._find_break_point(chunk_text)

            if break_point > 0:
                chunk = text[start : start + break_point].strip()
            else:
                chunk = chunk_text.strip()
                break_point = len(chunk_text)

            if chunk:
                chunks.append(chunk)

            # Move forward by (break_point - overlap) to create overlap
            step = max(1, break_point - self.chunk_overlap)
            start += step

        return chunks

    def _find_break_point(self, text: str) -> int:
        """
        Find the best break point in text, searching from the end.

        Priority: newline > sentence end (. ! ?) > word boundary (space)
        """
        # Search in the last 20% of the chunk for a natural break
        search_start = int(len(text) * 0.8)

        # Try newline first
        pos = text.rfind("\n", search_start)
        if pos > 0:
            return pos + 1

        # Try sentence endings
        for sep in [". ", "! ", "? "]:
            pos = text.rfind(sep, search_start)
            if pos > 0:
                return pos + len(sep)

        # Fall back to last space (word boundary)
        pos = text.rfind(" ", search_start)
        if pos > 0:
            return pos + 1

        # No good break found, use full chunk
        return len(text)
