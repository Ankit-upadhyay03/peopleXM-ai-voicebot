"""Real-time analytics endpoints using Server-Sent Events (SSE).

GET /api/analytics          — One-shot: fetch current analytics from DB
GET /api/analytics/stream   — SSE: real-time stream that pushes updates after each query

The SSE stream emits an 'analytics_update' event whenever a new conversation
is logged. The frontend listens to this stream and updates the dashboard live.
"""

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..services.analytics import analytics_service
from ..services.analytics_events import get_listeners

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/")
async def get_analytics():
    """
    One-shot analytics fetch. Returns all metrics computed from MongoDB.
    If DB is empty, all values are 0.
    """
    return analytics_service.get_full_analytics()


@router.get("/stream")
async def analytics_stream(request: Request):
    """
    Server-Sent Events stream for real-time analytics updates.

    The client opens an EventSource connection to this endpoint.
    On connect, it receives the current state immediately.
    After that, it receives updates whenever a new query is processed.
    """
    return StreamingResponse(
        _event_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _event_generator(request: Request) -> AsyncGenerator[str, None]:
    """Generate SSE events for analytics updates."""
    listeners = get_listeners()
    event = asyncio.Event()
    listeners.append(event)

    try:
        # Send initial state immediately on connect
        data = analytics_service.get_full_analytics()
        yield f"event: analytics_update\ndata: {json.dumps(data)}\n\n"

        while True:
            try:
                await asyncio.wait_for(event.wait(), timeout=30.0)
                event.clear()

                if await request.is_disconnected():
                    break

                # Compute fresh analytics from DB and push
                data = analytics_service.get_full_analytics()
                yield f"event: analytics_update\ndata: {json.dumps(data)}\n\n"

            except asyncio.TimeoutError:
                # Heartbeat — keep connection alive
                if await request.is_disconnected():
                    break
                yield f": heartbeat\n\n"

    finally:
        listeners.remove(event)
