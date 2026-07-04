"""Re-ranking service using Cross Encoder for improved accuracy.

Vector search sometimes returns irrelevant chunks.
Cross Encoder re-ranks them by scoring (question, chunk) pairs directly.

Model: cross-encoder/ms-marco-MiniLM-L-6-v2

Flow:
    Top 5 Chunks (from ChromaDB)
        ↓ Cross Encoder scores each (question, chunk) pair
        ↓ Sort by score descending
        ↓ Best Chunk (highest relevance)
"""

from typing import List, Dict, Any

try:
    from sentence_transformers import CrossEncoder
except ImportError:
    CrossEncoder = None


class Reranker:
    """Re-rank search results using Cross Encoder for better accuracy."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        """
        Initialize Reranker with Cross Encoder model.

        Args:
            model_name: HuggingFace model name for cross-encoder.
        """
        if CrossEncoder is None:
            raise ImportError(
                "sentence-transformers not installed. Install with: pip install sentence-transformers"
            )
        self.model_name = model_name
        self.model = CrossEncoder(model_name)

    def rerank(
        self,
        question: str,
        results: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Re-rank search results using Cross Encoder.

        Takes the question and candidate chunks, scores each (question, chunk)
        pair, and returns results sorted by relevance score (highest first).

        Args:
            question: The user's question.
            results: List of search results from VectorStore.search().
                     Each result has: {"text", "metadata", "id", "distance"}
            top_k: Number of top results to return after re-ranking.

        Returns:
            Re-ranked results with updated score from Cross Encoder.
            Each result: {"text", "score", "page", "source"}
        """
        if not results:
            return []

        # Create (question, chunk_text) pairs for Cross Encoder
        pairs = [[question, result["text"]] for result in results]

        # Score all pairs using Cross Encoder
        scores = self.model.predict(pairs)

        # Attach scores to results
        scored_results = []
        for i, result in enumerate(results):
            scored_results.append({
                "text": result["text"],
                "score": round(float(scores[i]), 4),
                "page": result["metadata"].get("page", 0),
                "source": result["metadata"].get("source", "unknown"),
            })

        # Sort by score descending (highest relevance first)
        scored_results.sort(key=lambda x: x["score"], reverse=True)

        # Return top_k results
        return scored_results[:top_k]
