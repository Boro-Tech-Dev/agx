from fastapi import APIRouter
from ..schemas.common import IngestText
from ..services import memory_service
router=APIRouter(prefix='/api/ingestion', tags=['ingestion'])
@router.post('/text')
async def ingest_text(payload:IngestText): return await memory_service.ingest_text(payload)
