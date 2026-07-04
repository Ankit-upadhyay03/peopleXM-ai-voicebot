"""Conversation logs endpoint — view logged Q&A exchanges from MongoDB.

GET /api/logs              → Recent 50 logs
GET /api/logs/{session_id} → All logs for a specific session
"""

from fastapi import APIRouter, HTTPException
from typing import List

from ..services.conversation_logger import ConversationLogger

router = APIRouter(prefix="/api/logs", tags=["logs"])

logger = ConversationLogger()


@router.get("/")
async def get_recent_logs(limit: int = 50):
    """Get recent conversation logs across all sessions."""
    try:
        logs = logger.get_recent_logs(limit=limit)
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching logs: {str(e)}")


@router.get("/{session_id}")
async def get_session_logs(session_id: str):
    """Get all conversation logs for a specific session."""
    try:
        logs = logger.get_session_logs(session_id=session_id)
        return {"session_id": session_id, "logs": logs, "count": len(logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching session logs: {str(e)}")
