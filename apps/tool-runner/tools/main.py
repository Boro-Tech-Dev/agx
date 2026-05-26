from fastapi import FastAPI, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel
from pathlib import Path
import os, json, subprocess, fnmatch, re

app=FastAPI(title='DD Tool Runner', version='0.6.0')
WORKSPACE=Path(os.getenv('WORKSPACE_ROOT','/workspace')).resolve()
ARTIFACTS=Path(os.getenv('ARTIFACT_ROOT','/artifacts')).resolve()
ALLOW_SHELL=os.getenv('ALLOW_SHELL_COMMANDS','false').lower()=='true'
SECRET_PATTERNS=[
    re.compile(r'(?i)(api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]\s*["\']?[^"\'\s]+'),
    re.compile(r'-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----.*?-----END (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----', re.S),
]
SKIP_FILES={'.env','.env.local','.env.production','.env.development','id_rsa','id_ed25519'}
IGNORE_DIRS={'node_modules','.git','.next','dist','build','coverage','venv','.venv','__pycache__','.terraform'}

class PathPayload(BaseModel):
    path: str='.'
    pattern: str|None=None
    max_files: int=400
class ReadPayload(BaseModel):
    path: str
    max_chars: int=20000
class PatchArtifact(BaseModel):
    name: str
    patches: list[dict]
class SearchPayload(BaseModel):
    path: str='.'
    query: str
    max_matches: int=80
    max_file_size: int=250000

def redact(text:str)->str:
    out=text
    for pat in SECRET_PATTERNS:
        out=pat.sub(lambda m: m.group(0).split('=')[0].split(':')[0]+'=[REDACTED]', out)
    return out

def safe_path(rel: str, root: Path=WORKSPACE) -> Path:
    p=(root / rel.lstrip('/')).resolve()
    try:
        p.relative_to(root)
    except ValueError:
        raise HTTPException(400,'path escapes allowed root')
    return p

def safe_artifact(name: str) -> Path:
    clean=re.sub(r'[^a-zA-Z0-9_.-]+','-',name).strip('.-') or 'artifact'
    return safe_path(clean, ARTIFACTS)

def should_skip(p:Path)->bool:
    if any(part in IGNORE_DIRS for part in p.parts): return True
    if p.name in SKIP_FILES: return True
    if p.suffix in {'.pem','.key','.p12','.pfx'}: return True
    return False

@app.get('/health')
def health(): return {'ok':True,'workspace':str(WORKSPACE),'allow_shell':ALLOW_SHELL,'version':'0.6.0'}

@app.post('/tools/repo/list')
def list_files(payload: PathPayload):
    base=safe_path(payload.path)
    files=[]
    for p in base.rglob('*'):
        if should_skip(p): continue
        if p.is_file():
            rel=str(p.relative_to(WORKSPACE))
            if payload.pattern and not fnmatch.fnmatch(rel, payload.pattern): continue
            files.append({'path':rel,'size':p.stat().st_size})
            if len(files)>=payload.max_files: break
    return {'root':str(base),'files':files,'count':len(files)}

@app.post('/tools/repo/read')
def read_file(payload: ReadPayload):
    p=safe_path(payload.path)
    if should_skip(p): raise HTTPException(403,'file blocked by secret-safety policy')
    if not p.exists() or not p.is_file(): raise HTTPException(404,'file not found')
    text=redact(p.read_text(errors='replace')[:payload.max_chars])
    return {'path':str(p.relative_to(WORKSPACE)),'content':text,'truncated':p.stat().st_size>payload.max_chars,'redacted':True}

@app.post('/tools/repo/summarize')
def summarize(payload: PathPayload):
    base=safe_path(payload.path)
    files=list_files(PathPayload(path=payload.path,max_files=payload.max_files))['files']
    manifests={}
    for name in ['package.json','pyproject.toml','requirements.txt','docker-compose.yml','compose.yml','Dockerfile','README.md']:
        target=base/name
        if target.exists() and target.is_file() and not should_skip(target): manifests[name]=redact(target.read_text(errors='replace')[:4000])
    detected=[]
    if 'package.json' in manifests: detected.append('node')
    if 'pyproject.toml' in manifests or 'requirements.txt' in manifests: detected.append('python')
    if 'docker-compose.yml' in manifests or 'compose.yml' in manifests or 'Dockerfile' in manifests: detected.append('docker')
    return {'path':str(base.relative_to(WORKSPACE)),'detected_stack':detected,'file_count':len(files),'sample_files':files[:120],'manifests':manifests,'redacted':True}

@app.post('/tools/artifacts/patch')
def write_patch(payload: PatchArtifact):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    out=safe_artifact(f"{payload.name}.patch.json")
    out.write_text(json.dumps(payload.model_dump(), indent=2))
    return {'artifact_path':str(out),'patch_count':len(payload.patches)}

@app.post('/tools/shell/run')
def run_shell(payload: dict):
    if not ALLOW_SHELL: raise HTTPException(403,'shell commands disabled')
    cmd=payload.get('cmd')
    allowed=['npm test','npm run test','npm run lint','npm run build','pnpm test','pnpm lint','pnpm build','python -m pytest','docker compose config']
    if cmd not in allowed: raise HTTPException(403,'command not allowlisted')
    proc=subprocess.run(cmd, shell=True, cwd=str(WORKSPACE), capture_output=True, text=True, timeout=int(payload.get('timeout',120)))
    return {'returncode':proc.returncode,'stdout':redact(proc.stdout[-10000:]),'stderr':redact(proc.stderr[-10000:])}

@app.post('/tools/repo/search')
def search_repo(payload: SearchPayload):
    base = safe_path(payload.path)
    matches = []
    skipped_files: list[dict] = []
    max_skipped = 48
    needle = payload.query.lower()
    for p in base.rglob('*'):
        if should_skip(p):
            continue
        if not p.is_file() or p.stat().st_size > payload.max_file_size:
            continue
        try:
            text = p.read_text(errors='replace')
        except Exception as e:
            if len(skipped_files) < max_skipped:
                skipped_files.append({'path': str(p.relative_to(WORKSPACE)), 'reason': str(e)})
            continue
        for i, line in enumerate(text.splitlines(), start=1):
            if needle in line.lower():
                matches.append({'path': str(p.relative_to(WORKSPACE)), 'line': i, 'excerpt': redact(line[:300])})
                if len(matches) >= payload.max_matches:
                    return {
                        'query': payload.query,
                        'matches': matches,
                        'count': len(matches),
                        'skipped_files': skipped_files,
                        'redacted': True,
                    }
    return {
        'query': payload.query,
        'matches': matches,
        'count': len(matches),
        'skipped_files': skipped_files,
        'redacted': True,
    }

@app.post('/tools/repo/manifest')
def read_manifest(payload: PathPayload):
    base=safe_path(payload.path)
    names=['package.json','pyproject.toml','requirements.txt','docker-compose.yml','compose.yml','Dockerfile','README.md']
    found={}
    for name in names:
        p=base/name
        if p.exists() and p.is_file() and not should_skip(p): found[name]=redact(p.read_text(errors='replace')[:12000])
    return {'path':str(base.relative_to(WORKSPACE)),'manifests':found,'count':len(found),'redacted':True}


Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)
