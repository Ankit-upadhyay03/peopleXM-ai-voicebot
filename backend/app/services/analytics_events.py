"""Analytics event signaling — decouples the notification from the SSE endpoint.

This module provides a simple pub/sub mechanism:
- API routes call notify_analytics_update() after logging a conversation
- The SSE endpoint listens for these signals and pushes fresh data to clients
"""

import asyncio
from typing import List

# Global list of asyncio.Event objects — one per active SSE connection
_listeners: List[asyncio.Event] = []


def get_listeners() -> List[asyncio.Event]:
    """Get the list of active SSE listeners."""
    return _listeners


def notify_analytics_update():
    """
    Signal all active SSE listeners that new analytics data is available.
    Call this after a conversation is logged to MongoDB.
    """
    for event in _listeners:
        event.set()
