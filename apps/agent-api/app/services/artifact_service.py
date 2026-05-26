import mimetypes
from fastapi import HTTPException, Response
from .common import artifact_path_from_row
from ..db import fetch, fetch_one

def list_artifacts(): return fetch('select * from artifacts order by created_at desc limit 100')
def get_artifact(artifact_id):
    row = fetch_one('select * from artifacts where id=%s', (artifact_id,))
    if not row:
        raise HTTPException(404, 'artifact not found')
    p = artifact_path_from_row(row)
    try:
        row['content'] = p.read_text(errors='replace')
    except OSError as e:
        raise HTTPException(503, f'artifact file unreadable: {e}') from e
    except Exception as e:
        raise HTTPException(503, f'artifact read failed: {e}') from e
    return row
def download_artifact(artifact_id):
    row=fetch_one('select * from artifacts where id=%s',(artifact_id,))
    if not row: raise HTTPException(404,'artifact not found')
    p=artifact_path_from_row(row)
    if not p.exists(): raise HTTPException(404,'artifact file missing')
    mt=row.get('mime_type') or mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    return Response(p.read_bytes(),media_type=mt,headers={'Content-Disposition':f'attachment; filename="{p.name}"'})
