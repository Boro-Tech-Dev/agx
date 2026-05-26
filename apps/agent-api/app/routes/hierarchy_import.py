from fastapi import APIRouter

from ..schemas.hierarchy_import import HierarchyImportRequest
from ..services import hierarchy_import_service

router = APIRouter(prefix='/api', tags=['hierarchy-import'])


@router.post('/hierarchy/import')
def import_hierarchy(req: HierarchyImportRequest):
    return hierarchy_import_service.run_import(req.csv_text, dry_run=req.dry_run, skip_existing=req.skip_existing)
