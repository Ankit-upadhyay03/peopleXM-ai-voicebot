"""Vector store service for storing embeddings in ChromaDB with metadata.

Flow:
    Chunk → Embedding → ChromaDB

Metadata stored per chunk:
    {
        "source": "Employee_FAQ.pdf",
        "page": 12,
        "chunk_id": 45
    }

This metadata helps in source citation later.
"""

from typing import List, Dict, Any
from ..database.chroma_db import ChromaDBClient
from ..config import settings


class VectorStore:
    """Store and retrieve text chunk embeddings from ChromaDB."""

    def __init__(
        self,
        collection_name: str = None,
        persist_dir: str = "vectorstore",
    ):
        """
        Initialize VectorStore with ChromaDB backend.

        Args:
            collection_name: ChromaDB collection name (defaults to config value).
            persist_dir: Directory path for ChromaDB persistence.
        """
        self.collection_name = collection_name or settings.CHROMA_COLLECTION_NAME
        self.persist_dir = persist_dir
        self.client = ChromaDBClient(
            collection_name=self.collection_name,
            persist_dir=self.persist_dir,
        )

    def store(
        self,
        chunks: List[str],
        embeddings: List[List[float]],
        source: str,
        pages: List[int] = None,
    ) -> Dict[str, Any]:
        """
        Store chunks with their embeddings and metadata into ChromaDB.

        Args:
            chunks: List of text chunks from TextSplitter.
            embeddings: List of embedding vectors (768-dim) from EmbeddingService.
            source: Source filename (e.g., "Employee_FAQ.pdf").
            pages: Optional list of page numbers corresponding to each chunk.
                   If not provided, defaults to 0 for all chunks.

        Returns:
            Dict with storage summary:
            {
                "source": "Employee_FAQ.pdf",
                "chunks_stored": 45,
                "collection": "voicebot_documents"
            }
        """
        if len(chunks) != len(embeddings):
            raise ValueError(
                f"Mismatch: {len(chunks)} chunks but {len(embeddings)} embeddings"
            )

        # Generate unique IDs for each chunk
        ids = [f"{source}_chunk_{i}" for i in range(len(chunks))]

        # Build metadata for each chunk — source, page, chunk_id
        metadatas = []
        for i in range(len(chunks)):
            metadata = {
                "source": source,
                "page": pages[i] if pages else 0,
                "chunk_id": i,
            }
            metadatas.append(metadata)

        # Store in ChromaDB
        self.client.add_documents(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadata=metadatas,
        )

        return {
            "source": source,
            "chunks_stored": len(chunks),
            "collection": self.collection_name,
        }

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar chunks using a query embedding.

        Args:
            query_embedding: 768-dim vector of the query text.
            top_k: Number of top similar results to return.

        Returns:
            List of results, each containing:
            {
                "id": "Employee_FAQ.pdf_chunk_12",
                "text": "chunk text...",
                "metadata": {"source": "Employee_FAQ.pdf", "page": 12, "chunk_id": 12},
                "distance": 0.23
            }
        """
        raw_results = self.client.query(
            query_embedding=query_embedding,
            n_results=top_k,
        )

        # Format results into a clean list
        results = []
        if raw_results["ids"] and raw_results["ids"][0]:
            for i in range(len(raw_results["ids"][0])):
                result = {
                    "id": raw_results["ids"][0][i],
                    "text": raw_results["documents"][0][i],
                    "metadata": raw_results["metadatas"][0][i],
                    "distance": raw_results["distances"][0][i] if raw_results.get("distances") else None,
                }
                results.append(result)

        return results

    def delete(self, source: str) -> None:
        """
        Delete all chunks belonging to a specific source file.

        Args:
            source: Source filename whose chunks should be removed.
        """
        # Get all IDs matching this source from the collection
        results = self.client.collection.get(
            where={"source": source}
        )
        if results["ids"]:
            self.client.collection.delete(ids=results["ids"])

    def delete_collection(self) -> None:
        """Delete the entire collection from ChromaDB."""
        self.client.delete_collection()
