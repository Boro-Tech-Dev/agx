import subprocess, shlex, os
ALLOW=os.getenv('ALLOW_SHELL_COMMANDS','false').lower() == 'true'
ALLOWLIST=('npm test','npm run test','npm run lint','npm run build','pnpm test','pnpm lint','pnpm build','python -m pytest','docker compose config')

def run_safe_command(command: str, cwd: str='/workspace', timeout: int=120):
    if not ALLOW:
        return {'blocked': True, 'reason': 'ALLOW_SHELL_COMMANDS=false'}
    if not any(command.startswith(a) for a in ALLOWLIST):
        return {'blocked': True, 'reason': 'command not allowlisted'}
    proc=subprocess.run(shlex.split(command), cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return {'returncode': proc.returncode, 'stdout': proc.stdout[-10000:], 'stderr': proc.stderr[-10000:]}
