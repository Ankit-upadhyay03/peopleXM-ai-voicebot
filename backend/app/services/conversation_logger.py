"""Conversation logging service — stores every Q&A exchange to MongoDB.

Each exchange is logged as:
{
    "session_id": "de0fc8f9-ac71-40d5-b672-54392b014e74",
    "question": "How can I reset my password?",
    "answer": "Go to Settings > Security > Reset Password...",
    "confidence": 94,
    "source": "Employee_FAQ.pdf",
    "page": 12,
    "timestamp": "2026-06-26T14:30:00.000Z"
}

This is useful for:
- Analytics (what questions are asked most)
- Debugging (why bot gave a wrong answer)
- Evaluation (confidence distribution)
- Audit trail
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional

from ..database.mongodb import mongo_client

COLLECTION_NAME = "conversation_logs"


class ConversationLogger:
    """Log conversation exchanges to MongoDB."""

    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        """Lazy-get MongoDB collection."""
        if self._collection is None:
            self._collection = mongo_client.db[COLLECTION_NAME]
        return self._collection

    def log(
        self,
        session_id: str,
        question: str,
        answer: str,
        confidence: int,
        source: str,
        page: int,
    ) -> str:
        """
        Log a single Q&A exchange to MongoDB.

        Args:
            session_id: The conversation session ID.
            question: User's question.
            answer: Bot's generated answer.
            confidence: Confidence score (0-100).
            source: Source document name.
            page: Page number in source document.

        Returns:
            The inserted document's ID as string, or empty string if MongoDB unavailable.
        """
        if not mongo_client.is_connected:
            return ""

        document = {
            "session_id": session_id,
            "question": question,
            "answer": answer,
            "confidence": confidence,
            "source": source,
            "page": page,
            "timestamp": datetime.now(timezone.utc),
        }

        result = self.collection.insert_one(document)
        return str(result.inserted_id)

    def get_session_logs(self, session_id: str):
        """
        Get all logs for a session, ordered by timestamp.

        Args:
            session_id: The session to retrieve logs for.

        Returns:
            List of log documents.
        """
        if not mongo_client.is_connected:
            return []

        cursor = self.collection.find(
            {"session_id": session_id}
        ).sort("timestamp", 1)

        logs = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["timestamp"] = doc["timestamp"].isoformat()
            logs.append(doc)
        return logs

    def get_recent_logs(self, limit: int = 50):
        """
        Get recent conversation logs across all sessions.

        Args:
            limit: Maximum number of logs to return.

        Returns:
            List of recent log documents.
        """
        if not mongo_client.is_connected:
            return []

        cursor = self.collection.find().sort("timestamp", -1).limit(limit)

        logs = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["timestamp"] = doc["timestamp"].isoformat()
            logs.append(doc)
        return logs
