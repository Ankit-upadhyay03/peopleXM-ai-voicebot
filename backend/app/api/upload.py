"""File upload endpoint with complete RAG indexing flow.

Flow:
    POST /upload-faq
        ↓ Save file
        ↓ Extract text
        ↓ Split into chunks
        ↓ Generate embeddings
        ↓ Store in ChromaDB
        ↓ Success response
"""

from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from ..config import settings
from ..services.file_parser import FileParser
from ..services.text_splitter import TextSplitter
from ..services.embedding import EmbeddingService
from ..services.vector_store import VectorStore

router = APIRouter(prefix="/api/upload", tags=["upload"])

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}
UPLOAD_DIR = Path(__file__).resolve().parents[2] / settings.UPLOAD_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Initialize services
file_parser = FileParser()
text_splitter = TextSplitter(
    chunk_size=settings.CHUNK_SIZE,
    chunk_overlap=settings.CHUNK_OVERLAP,
)
embedding_service = EmbeddingService()
vector_store = VectorStore()


def validate_file_extension(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_EXTENSIONS


@router.post("/upload-faq")
async def upload_faq(file: UploadFile = File(...)):
    """
    Upload a FAQ file and index it into the vector store.

    Accepts: PDF, DOCX, TXT, CSV

    Flow: Save → Extract text → Split → Embed → Store in ChromaDB

    Returns:
        {
            "status": "success",
            "chunks": 238,
            "message": "FAQ indexed successfully"
        }
    """
    # 1. Validate file type
    if not validate_file_extension(file.filename):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed types: PDF, DOCX, TXT, CSV.",
        )

    destination = UPLOAD_DIR / Path(file.filename).name

    try:
        # 2. Save file to uploads folder
        with destination.open("wb") as buffer:
            buffer.write(await file.read())

        # 3. Extract text from file
        text = file_parser.parse(str(destination))

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="File is empty or text could not be extracted.",
            )

        # 4. Split text into chunks
        chunks = text_splitter.split(text)

        # 5. Generate embeddings for each chunk
        embeddings = embedding_service.embed_batch(chunks)

        # 6. Store in ChromaDB with metadata
        result = vector_store.store(
            chunks=chunks,
            embeddings=embeddings,
            source=destination.name,
        )

        # 7. Return success response
        return {
            "status": "success",
            "chunks": result["chunks_stored"],
            "message": "FAQ indexed successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}",
        )
