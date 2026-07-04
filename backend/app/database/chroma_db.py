"""ChromaDB database client and utilities."""

import chromadb
from typing import List, Dict, Any


class ChromaDBClient:
    """Client for ChromaDB vector database."""

    def __init__(self, collection_name: str = "documents", persist_dir: str = "vectorstore"):
        self.collection_name = collection_name
        self.persist_dir = persist_dir
        
        self.client = chromadb.PersistentClient(
            path=persist_dir,
        )
        self.collection = self.get_or_create_collection()

    def get_or_create_collection(self):
        """Get or create a collection in ChromaDB."""
        return self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(
        self, ids: List[str], embeddings: List[List[float]], documents: List[str], metadata: List[Dict[str, Any]] = None
    ) -> None:
        """Add documents to the collection."""
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadata or [{} for _ in ids],
        )

    def query(self, query_embedding: List[float], n_results: int = 5) -> Dict[str, Any]:
        """Query the collection."""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
        )
        return results

    def delete_collection(self) -> None:
        """Delete the collection."""
        self.client.delete_collection(name=self.collection_name)
