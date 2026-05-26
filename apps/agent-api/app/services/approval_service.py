import json, datetime, re
from fastapi import HTTPException
from .common import event, ARTIFACT_ROOT
from ..db import fetch, fetch_one, execute, j

def list_approvals(): return fetch('select * from approvals order by created_at desc limit 100')

def _write_approved_patch_artifact(row, note=None):
    action=row.get('requested_action') or {}
    ARTIFACT_ROOT.mkdir(parents=True,exist_ok=True)
    slug=re.sub(r'[^a-zA-Z0-9_-]+','-',str(action.get('workflow','builder-approval')))[:48] or 'builder-approval'
    path=ARTIFACT_ROOT/f"{datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')}__approved__{slug}.patch.json"
    body={'approval_id':str(row['id']),'run_id':str(row['run_id']),'approved_at':datetime.datetime.now().isoformat(),'note':note,'requested_action':action}
    path.write_text(json.dumps(body,indent=2,default=str))
    art=execute('insert into artifacts(run_id,title,artifact_type,storage_bucket,storage_key,mime_type,metadata) values(%s,%s,%s,%s,%s,%s,%s::jsonb) returning *',(row['run_id'],path.name,'approved_patch_bundle','local-artifacts',str(path),'application/json',j({'approval_id':str(row['id']),'action_type':action.get('type')})))
    event(row['run_id'],'approval.executed','Approval action staged as artifact',{'approval_id':str(row['id']),'artifact_id':str(art['id'])})
    return art

def approve(approval_id,payload=None):
    row=fetch_one('select * from approvals where id=%s',(approval_id,))
    if not row: raise HTTPException(404,'approval not found')
    if row['status']!='pending': return row
    note=(payload or {}).get('note')
    updated=execute('update approvals set status=%s,response_note=%s,resolved_at=now() where id=%s returning *',('approved',note,approval_id))
    event(row['run_id'],'approval.approved','Approval accepted',{'approval_id':approval_id})
    action=row.get('requested_action') or {}
    if action.get('type') in ('stage_builder_patch_bundle','apply_patch_preview'):
        _write_approved_patch_artifact(row,note)
        execute('update agent_runs set status=%s,completed_at=coalesce(completed_at,now()) where id=%s and status=%s',('completed',row['run_id'],'needs_approval'))
    return updated

def reject(approval_id,payload=None):
    row=fetch_one('select * from approvals where id=%s',(approval_id,))
    if not row: raise HTTPException(404,'approval not found')
    if row['status']!='pending': return row
    note=(payload or {}).get('note')
    updated=execute('update approvals set status=%s,response_note=%s,resolved_at=now() where id=%s returning *',('rejected',note,approval_id))
    event(row['run_id'],'approval.rejected','Approval rejected',{'approval_id':approval_id})
    execute('update agent_runs set status=%s,error_message=%s where id=%s and status=%s',('failed','Approval rejected',row['run_id'],'needs_approval'))
    return updated
