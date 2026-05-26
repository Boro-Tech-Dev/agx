"""Extract UTF-8 plain text from uploads (direct read, pdftotext, or LibreOffice)."""

from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

_PLAIN = {'.txt', '.csv', '.md', '.tsv', '.json', '.log'}


def chunk_plain_text(text: str, size: int = 1800, overlap: int = 200) -> list[str]:
    text = re.sub(r'\s+', ' ', text or '').strip()
    chunks: list[str] = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += max(1, size - overlap)
    return chunks if chunks else ['']


def extract_plain_text(file_path: Path) -> str:
    ext = file_path.suffix.lower()
    if ext in _PLAIN:
        return file_path.read_text(encoding='utf-8', errors='replace')
    src = str(file_path.resolve())
    if ext == '.pdf':
        try:
            proc = subprocess.run(
                ['pdftotext', '-layout', '-q', src, '-'],
                check=True,
                timeout=120,
                capture_output=True,
            )
        except subprocess.CalledProcessError as e:
            err = (e.stderr or b'').decode('utf-8', errors='replace').strip()
            detail = err[:500] if err else f'exit code {e.returncode}'
            raise RuntimeError(f'pdftotext failed: {detail}') from e
        text = proc.stdout.decode('utf-8', errors='replace')
        if not text.strip():
            raise RuntimeError(
                'PDF contains no extractable text (scanned image PDFs need OCR)'
            )
        return text
    with tempfile.TemporaryDirectory(prefix='lo-') as tmp:
        tmpd = Path(tmp)
        subprocess.run(
            ['soffice', '--headless', '--convert-to', 'txt:Text', '--outdir', str(tmpd), src],
            check=True,
            timeout=300,
            capture_output=True,
        )
        base = file_path.stem
        out = tmpd / f'{base}.txt'
        if not out.is_file():
            matches = list(tmpd.glob('*.txt'))
            if not matches:
                raise RuntimeError('LibreOffice produced no text output')
            out = matches[0]
        return out.read_text(encoding='utf-8', errors='replace')
