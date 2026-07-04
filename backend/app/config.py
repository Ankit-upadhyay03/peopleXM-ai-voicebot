"""Application configuration settings."""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # API Configuration
    API_TITLE: str = "PeopleXM AI Voicebot API"
    API_VERSION: str = "1.0.0"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Database Configuration
    CHROMA_COLLECTION_NAME: str = "voicebot_documents"
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "peoplexm_voicebot"
    
    # File Upload Configuration
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
    
    # Service Configuration
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 100

    # API Keys
    OPENAI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""

    # LLM Configuration
    LLM_MODEL: str = "gpt-3.5-turbo"

    # Voice Configuration
    WHISPER_LANGUAGE: str = "en"
    ELEVENLABS_VOICE: str = "rachel"

    # Multilingual Configuration
    # Use "paraphrase-multilingual-mpnet-base-v2" for Hindi+English (1.1GB, first run downloads)
    # Use "all-mpnet-base-v2" for English-only (420MB, likely cached already)
    EMBEDDING_MODEL: str = "paraphrase-multilingual-mpnet-base-v2"
    SUPPORTED_LANGUAGES: List[str] = ["en", "hi"]
    DEFAULT_LANGUAGE: str = "en"
    ELEVENLABS_MULTILINGUAL_MODEL: str = "eleven_multilingual_v2"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
