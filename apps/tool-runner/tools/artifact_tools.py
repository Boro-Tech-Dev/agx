from pathlib import Path
import os, datetime, re
ARTIFACT_ROOT=Path(os.getenv('ARTIFACT_ROOT','/artifacts'))

def slugify(value: str) -> str:
    return re.sub(r'[^a-zA-Z0-9._-]+','-',value).strip('-').lower()[:80] or 'artifact'

def create_markdown(title: str, content: str, prefix: str='manual'):
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    name=f"{datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')}__{prefix}__{slugify(title)}.md"
    path=ARTIFACT_ROOT/name
    path.write_text(content)
    return {'path': str(path), 'name': name, 'mime_type': 'text/markdown'}
