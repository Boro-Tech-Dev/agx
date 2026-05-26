from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import socket
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI
from pydantic import BaseModel
from prometheus_fastapi_instrumentator import Instrumentator

from .consumer import start_consumer_thread
from .db_util import connection

_lvl_name = (os.getenv('LOG_LEVEL') or 'INFO').strip().upper()
_lvl = getattr(logging, _lvl_name, logging.INFO)
logging.basicConfig(level=_lvl, format='%(levelname)s %(name)s: %(message)s')
for _lg in ('ingestion', 'ingestion.consumer', 'ingestion.timeline_pipeline'):
    logging.getLogger(_lg).setLevel(_lvl)

IMPORT_ROOT = Path(os.getenv('IMPORT_ROOT', '/imports'))
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://dd_agent:dd_agent_dev@postgres:5432/dd_agents')
MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085')
EMBED_MODEL = os.getenv('EMBEDDING_MODEL', 'nomic-embed-text')
EMBEDDING_DIM = int(os.getenv('EMBEDDING_DIM', '0') or '0')


def _embedders_at_ingest() -> list[str]:
    raw = (os.getenv('EMBED_AT_INGEST', 'nomic-embed-text') or '').strip()
    return [x.strip() for x in raw.split(',') if x.strip()]

_consumer_stop = None
_consumer_thread = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _consumer_stop, _consumer_thread
    _consumer_thread, _consumer_stop = start_consumer_thread()
    yield
    if _consumer_stop:
        _consumer_stop.set()
    if _consumer_thread:
        _consumer_thread.join(timeout=15)


app = FastAPI(title='DD Ingestion Worker', lifespan=lifespan)


class IngestPath(BaseModel):
    path: str
    source_type: str = 'document'
    title: str | None = None
    workspace_key: str
    project_key: str | None = None


def chunk_text(text: str, size: int = 1800, overlap: int = 200):
    text = re.sub(r'\s+', ' ', text).strip()
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += max(1, size - overlap)
    return chunks


@app.get('/health')
def health():
    return {
        'ok': True,
        'consumer': bool(_consumer_thread and _consumer_thread.is_alive()),
        'hostname': socket.gethostname(),
        'pid': os.getpid(),
    }


@app.post('/ingest/path')
async def ingest_path(req: IngestPath):
    p = (IMPORT_ROOT / req.path.lstrip('/')).resolve()
    if not str(p).startswith(str(IMPORT_ROOT)) or not p.exists():
        return {'error': 'path not found or outside import root'}
    content = p.read_text(errors='replace')
    checksum = hashlib.sha256(content.encode()).hexdigest()
    title = req.title or p.name
    chunks = chunk_text(content)
    embeddings = []
    async with httpx.AsyncClient(timeout=240) as client:
        for c in chunks:
            res = await client.post(f'{MODEL_ROUTER_URL}/v1/embed', json={'input': c, 'model_override': EMBED_MODEL})
            data = res.json()
            if data.get('error'):
                return {'error': f"embedding_failed: {data.get('error')}"}
            vec = (data.get('embeddings') or [[]])[0]
            if not isinstance(vec, list) or not vec:
                return {'error': 'embedding_failed: empty embedding'}
            if EMBEDDING_DIM > 0 and len(vec) != EMBEDDING_DIM:
                return {'error': f'embedding_dim_mismatch: expected {EMBEDDING_DIM}, got {len(vec)}'}
            embeddings.append(vec)
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO source_documents(
                   title,source_type,source_uri,mime_type,checksum,ingested_at,
                   workspace_key,project_key,original_filename,processing_status,document_kind
               ) VALUES (%s,%s,%s,%s,%s,now(),%s,%s,%s,%s,%s) RETURNING id""",
            (
                title,
                req.source_type,
                str(p),
                'text/plain',
                checksum,
                req.workspace_key,
                req.project_key,
                title,
                'ready',
                'general',
            ),
        )
        doc_id = cur.fetchone()['id']
        for idx, c in enumerate(chunks):
            emb = embeddings[idx]
            cur.execute(
                'INSERT INTO document_chunks(document_id,chunk_index,content,token_estimate,embedding) VALUES(%s,%s,%s,%s,%s) RETURNING id',
                (doc_id, idx, c, max(1, len(c) // 4), json.dumps(emb)),
            )
            chunk_row = cur.fetchone()
            chunk_id = chunk_row['id'] if chunk_row else None
            if chunk_id:
                th = hashlib.sha256(c.encode()).hexdigest()
                vec_str = '[' + ','.join(str(float(x)) for x in emb) + ']'
                for eid in _embedders_at_ingest():
                    if eid == EMBED_MODEL or eid == 'nomic-embed-text':
                        cur.execute(
                            """INSERT INTO embeddings(source_type, source_id, embedder_id, dim, text_hash, embedding_768)
                               VALUES ('document_chunk', %s, %s, 768, %s, %s::vector)
                               ON CONFLICT (source_type, source_id, embedder_id) DO UPDATE SET
                                 text_hash = EXCLUDED.text_hash, embedding_768 = EXCLUDED.embedding_768""",
                            (chunk_id, eid, th, vec_str),
                        )
        cur.execute(
            """INSERT INTO memories(memory_type,title,body,confidence,workspace_key,project_key,source_document_id,metadata)
               VALUES(%s,%s,%s,%s,%s,%s,%s,%s::jsonb)""",
            (
                'note',
                title,
                content[:4000],
                'medium',
                req.workspace_key,
                req.project_key,
                doc_id,
                json.dumps({'ingested_from': str(p), 'chunks': len(chunks), 'document_kind': 'general'}),
            ),
        )
        conn.commit()
    return {'document_id': doc_id, 'chunks': len(chunks), 'checksum': checksum}


Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)
