from fastapi import APIRouter
from typing import Any
from ..services import approval_service
router=APIRouter(prefix='/api/approvals', tags=['approvals'])
@router.get('')
def list_approvals(): return approval_service.list_approvals()
@router.post('/{approval_id}/approve')
def approve(approval_id:str,payload:dict[str,Any]|None=None): return approval_service.approve(approval_id,payload)
@router.post('/{approval_id}/reject')
def reject(approval_id:str,payload:dict[str,Any]|None=None): return approval_service.reject(approval_id,payload)
