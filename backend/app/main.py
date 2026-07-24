from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import upload, health, ask, logs, voice, analytics
from .config import settings


app = FastAPI(
    title="PeopleXM Voice Bot",
    version="1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(ask.router)
app.include_router(logs.router)
app.include_router(voice.router)
app.include_router(analytics.router)


@app.get("/")
def root():
    return {
        "message": "PeopleXM AI Backend Running"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
