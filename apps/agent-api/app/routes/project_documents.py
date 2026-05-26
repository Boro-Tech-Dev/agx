from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from ..services import project_document_service

router = APIRouter(prefix='/api/projects', tags=['project-documents'])


@router.get('/{project_key}/documents')
def list_documents(
    project_key: str,
    include_archived: bool = False,
    kind: list[str] = Query(default=[]),
):
    kinds = [k for k in kind if k]
    return project_document_service.list_project_documents(
        project_key, include_archived=include_archived, kinds=kinds or None
    )


@router.post('/{project_key}/documents')
def upload_document(
    project_key: str,
    file: UploadFile = File(...),
    document_kind: str | None = Form(None),
):
    try:
        return project_document_service.create_project_upload(project_key, file, document_kind)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch('/{project_key}/documents/{document_id}')
def patch_document(project_key: str, document_id: str, payload: dict[str, Any]):
    return project_document_service.patch_document(project_key, document_id, payload)


@router.delete('/{project_key}/documents/{document_id}')
def delete_document(project_key: str, document_id: str):
    return project_document_service.delete_document(project_key, document_id)


@router.get('/{project_key}/documents/{document_id}/download')
def download_document(project_key: str, document_id: str):
    row, path = project_document_service.download_row(project_key, document_id)
    name = row.get('original_filename') or row.get('title') or path.name
    return FileResponse(path, filename=name, media_type=row.get('mime_type') or 'application/octet-stream')
