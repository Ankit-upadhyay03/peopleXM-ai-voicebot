"""Conversation memory service for maintaining session context.

Stores conversation history per session so follow-up questions
have context of previous exchanges.

Example:
    User: How do I reset my password?
    Bot:  Go to Settings > Security > Reset Password...
    User: What if I forgot my email too?
    Bot:  (knows the context is about password reset)

Currently: In-memory storage (dict of session_id → messages)
Later: Will be persisted to MongoDB.
"""

import uuid
from typing import List, Dict, Any
from datetime import datetime


class ConversationMemory:
    """In-memory conversation history per session."""

    def __init__(self, max_history: int = 10):
        """
        Initialize conversation memory.

        Args:
            max_history: Maximum number of message pairs to keep per session.
                         Older messages are removed to prevent token overflow.
        """
        self.max_history = max_history
        self._sessions: Dict[str, List[Dict[str, str]]] = {}

    def create_session(self) -> str:
        """
        Create a new conversation session.

        Returns:
            session_id: Unique identifier for the session.
        """
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = []
        return session_id

    def get_history(self, session_id: str) -> List[Dict[str, str]]:
        """
        Get conversation history for a session.

        Args:
            session_id: The session identifier.

        Returns:
            List of messages: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
        """
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        return self._sessions[session_id]

    def add_message(self, session_id: str, role: str, content: str) -> None:
        """
        Add a message to session history.

        Args:
            session_id: The session identifier.
            role: Either "user" or "assistant".
            content: The message content.
        """
        if session_id not in self._sessions:
            self._sessions[session_id] = []

        self._sessions[session_id].append({
            "role": role,
            "content": content,
        })

        # Trim history to max_history pairs (user + assistant = 2 messages per pair)
        max_messages = self.max_history * 2
        if len(self._sessions[session_id]) > max_messages:
            self._sessions[session_id] = self._sessions[session_id][-max_messages:]

    def clear_session(self, session_id: str) -> None:
        """Clear conversation history for a session."""
        if session_id in self._sessions:
            self._sessions[session_id] = []

    def delete_session(self, session_id: str) -> None:
        """Delete a session entirely."""
        self._sessions.pop(session_id, None)

    def session_exists(self, session_id: str) -> bool:
        """Check if a session exists."""
        return session_id in self._sessions
