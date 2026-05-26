from fastapi import APIRouter
from ..schemas.common import RunCreate
from ..services import run_service
router=APIRouter(prefix='/api/runs', tags=['runs'])
@router.post('')
def create_run(req:RunCreate): return run_service.create_run(req)
@router.get('')
def list_runs(): return run_service.list_runs()
@router.get('/{run_id}')
def get_run(run_id:str): return run_service.get_run(run_id)
@router.get('/{run_id}/detail')
def get_run_detail(run_id: str):
    return run_service.get_run_detail(run_id)
@router.get('/{run_id}/events')
def run_events(run_id:str): return run_service.run_events(run_id)
@router.post('/{run_id}/cancel')
def cancel_run(run_id:str): return run_service.cancel_run(run_id)
