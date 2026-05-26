from fastapi import APIRouter, BackgroundTasks, Query
from typing import Any
from ..schemas.common import MemorySearch
from ..services import memory_service
from ..services.memory_embedding_service import embed_memory_record

router=APIRouter(prefix='/api/memory', tags=['memory'])
@router.post('/search')
async def search_memory(payload: MemorySearch):
    from ..services.retrieval_v2 import retrieve, should_use_retrieval_v2

    if should_use_retrieval_v2(payload.agent):
        results, warnings, debug = await retrieve(
            payload.agent,
            payload.query,
            payload.project_key,
            payload.workspace_key,
            payload.limit,
            payload.document_kinds,
            embedder_override=payload.embedder_override,
            reranker_override=payload.reranker_override,
        )
        return {'results': results, 'warnings': warnings, 'debug': debug}
    results, warnings = await memory_service.hybrid_memory(
        payload.query,
        payload.project_key,
        payload.workspace_key,
        payload.limit,
        payload.document_kinds,
    )
    return {'results': results, 'warnings': warnings}
@router.post('')
async def create_memory(payload: dict[str, Any], background_tasks: BackgroundTasks):
    row = memory_service.create_memory(payload)
    mid = str(row.get('id') or '')
    if mid:
        background_tasks.add_task(
            embed_memory_record,
            mid,
            str(row.get('title') or payload.get('title', '')),
            str(row.get('body') or payload.get('body', '')),
        )
    return row
@router.get('')
def list_memory(
    project_scoped_only: bool = Query(False, description='Only rows with project_key set'),
    limit: int = Query(150, ge=1, le=500),
):
    return memory_service.list_memory(project_scoped_only=project_scoped_only, limit=limit)
@router.patch('/{memory_id}')
def update_memory(memory_id:str,payload:dict[str,Any]): return memory_service.update_memory(memory_id,payload)
