"""File parsing service for various document formats."""

from pathlib import Path


def extract_text(file_path: str) -> str:
    """Convenience function — auto-detects file type and returns text."""
    parser = FileParser()
    return parser.parse(file_path)


class FileParser:
    """Parser for extracting text from different file formats."""

    def parse(self, file_path: str) -> str:
        """Parse file and return extracted text."""
        file_path_obj = Path(file_path)
        suffix = file_path_obj.suffix.lower()

        if suffix == ".txt":
            return self._parse_txt(file_path_obj)
        if suffix == ".csv":
            return self._parse_csv(file_path_obj)
        if suffix == ".docx":
            return self._parse_docx(file_path_obj)
        if suffix == ".pdf":
            return self._parse_pdf(file_path_obj)

        raise ValueError(f"Unsupported file format: {suffix}")

    def _parse_txt(self, file_path: Path) -> str:
        return file_path.read_text(encoding="utf-8", errors="ignore")

    def _parse_csv(self, file_path: Path) -> str:
        import pandas as pd

        df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
        rows = [", ".join(map(str, row)) for row in df.values]
        return "\n".join(rows)

    def _parse_docx(self, file_path: Path) -> str:
        from docx import Document

        document = Document(file_path)
        return "\n".join(p.text for p in document.paragraphs if p.text)

    def _parse_pdf(self, file_path: Path) -> str:
        from PyPDF2 import PdfReader

        reader = PdfReader(str(file_path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
