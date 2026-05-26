"""Wait for TCP backends before uvicorn starts.

Waits for Ollama so uvicorn does not race first requests against inference
still binding.
"""
from __future__ import annotations

import os
import socket
import sys
import time
import urllib.parse


def _parse_host_port(url: str) -> tuple[str, int]:
    u = url.strip()
    if not u:
        raise ValueError('empty url')
    if '://' not in u:
        u = f'http://{u}'
    p = urllib.parse.urlparse(u)
    if not p.hostname:
        raise ValueError(f'no hostname in {url!r}')
    port = p.port
    if port is None:
        port = 443 if p.scheme == 'https' else 80
    return p.hostname, port


def _wait_tcp(host: str, port: int, label: str, deadline: float) -> None:
    last: OSError | None = None
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=3.0):
                print(f'model-router: {label} ready at {host}:{port}', flush=True)
            return
        except OSError as e:
            last = e
            time.sleep(2.0)
    print(f'model-router: timeout waiting for {label} {host}:{port}: {last}', file=sys.stderr, flush=True)
    sys.exit(1)


def main() -> None:
    per = float(os.environ.get('WAIT_BACKENDS_SEC', '300'))
    ollama_url = os.environ.get('OLLAMA_BASE_URL', 'http://ollama:11434').rstrip('/')
    h, p = _parse_host_port(ollama_url)
    _wait_tcp(h, p, 'ollama', time.time() + per)


if __name__ == '__main__':
    main()
