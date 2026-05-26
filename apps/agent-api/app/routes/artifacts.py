from fastapi import APIRouter
from ..services import artifact_service
router=APIRouter(prefix='/api/artifacts', tags=['artifacts'])
@router.get('')
def list_artifacts(): return artifact_service.list_artifacts()
@router.get('/{artifact_id}')
def get_artifact(artifact_id:str): return artifact_service.get_artifact(artifact_id)
@router.get('/{artifact_id}/download')
def download_artifact(artifact_id:str): return artifact_service.download_artifact(artifact_id)
