import json
import logging
import os
import pathlib

import redis
from fastapi import HTTPException

from ..db import execute, fetch_one, j

log = logging.getLogger(__name__)

REDIS_URL=os.getenv('REDIS_URL','redis://redis:6379/0')
RUN_QUEUE=os.getenv('RUN_QUEUE','agent.runs')
PROCESSING_QUEUE=os.getenv('PROCESSING_QUEUE','agent.runs.processing')
DEAD_QUEUE=os.getenv('DEAD_QUEUE','agent.runs.dead')
ARTIFACT_ROOT=pathlib.Path(os.getenv('ARTIFACT_ROOT','/artifacts')).resolve()
UPLOAD_ROOT=pathlib.Path(os.getenv('UPLOAD_ROOT','/uploads')).resolve()
DOCUMENT_INGEST_QUEUE=os.getenv('DOCUMENT_INGEST_QUEUE','document.ingest')
DOCUMENT_INGEST_PROCESSING_QUEUE=os.getenv(
    'DOCUMENT_INGEST_PROCESSING_QUEUE', 'document.ingest.processing'
)

def rconn(): return redis.Redis.from_url(REDIS_URL, decode_responses=True)

def event(run_id, event_type, message, payload=None):
    try:
        execute(
            'insert into run_events(run_id,event_type,message,payload) values(%s,%s,%s,%s::jsonb)',
            (run_id, event_type, message, j(payload or {})),
        )
    except Exception:
        log.exception(
            'run_events insert failed run_id=%s event_type=%s message=%r',
            run_id,
            event_type,
            message,
        )

def artifact_path_from_row(row):
    p=pathlib.Path(row['storage_key']).resolve()
    try: p.relative_to(ARTIFACT_ROOT)
    except ValueError: raise HTTPException(403,'artifact path outside allowed root')
    return p

def get_run_or_404(run_id):
    row=fetch_one('select * from agent_runs where id=%s',(run_id,))
    if not row: raise HTTPException(404,'run not found')
    return row

def enqueue(payload:dict):
    rconn().lpush(RUN_QUEUE,json.dumps(payload,default=str))

def enqueue_document_ingest(document_id: str, mode: str | None = None):
    payload: dict = {'document_id': document_id}
    if mode:
        payload['mode'] = mode
    rconn().lpush(DOCUMENT_INGEST_QUEUE, json.dumps(payload))

def upload_path_from_row(row):
    if (row.get('storage_bucket') or '')!='local-uploads':
        raise HTTPException(403,'invalid upload bucket')
    key=(row.get('storage_key') or '').strip()
    if not key or '..' in key or key.startswith('/'):
        raise HTTPException(403,'invalid storage key')
    p=(UPLOAD_ROOT/key).resolve()
    try:
        p.relative_to(UPLOAD_ROOT)
    except ValueError:
        raise HTTPException(403,'upload path outside allowed root')
    return p
