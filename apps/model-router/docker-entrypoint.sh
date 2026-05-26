#!/bin/sh
set -e
# Wait for Ollama before uvicorn binds.
python /srv/wait_backends.py
WORKERS="${UVICORN_WORKERS:-1}"
exec uvicorn router.main:app --host 0.0.0.0 --port 8085 --workers "${WORKERS}"
