"""Embedding service for generating vector representations.

Model: paraphrase-multilingual-mpnet-base-v2 (768 dimensions)
  - Supports 50+ languages including Hindi and English
  - Same 768-dim output as all-mpnet-base-v2
  - Works well for cross-lingual retrieval (Hindi query → English docs)

Usage:
    from app.services import EmbeddingService

    service = EmbeddingService()
    vector = service.embed("Hello world")                    # English
    vector = service.embed("मेरा पासवर्ड कैसे रीसेट करें?")  # Hindi
    vectors = service.embed_batch(["a", "b", "c"])           # batch
"""

from typing import List

from ..config import settings

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None


class EmbeddingService:
    """Generate embeddings for text chunks using sentence-transformers.

    Default model: paraphrase-multilingual-mpnet-base-v2 (768 dimensions).
    Supports Hindi, English, and 50+ other languages.
    Cross-lingual: A Hindi query will match relevant English documents and vice versa.
    """

    def __init__(self, model_name: str = None):
        if SentenceTransformer is None:
            raise ImportError(
                "sentence-transformers not installed. Install with: pip install sentence-transformers"
            )
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.model = SentenceTransformer(self.model_name)
        self.dimensions = self.model.get_embedding_dimension()

    def embed(self, text: str) -> List[float]:
        """Generate embedding vector for a single text.

        Works with both Hindi and English text. Cross-lingual similarity
        is preserved — a Hindi query will find relevant English chunks.

        Args:
            text: Input text string (any supported language).

        Returns:
            List of floats (768 dimensions).
        """
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (chunks).

        Args:
            texts: List of text chunks (can be mixed Hindi/English).

        Returns:
            List of embedding vectors, one per chunk.
        """
        if not texts:
            return []
        embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return [e.tolist() for e in embeddings]
