FROM python:3.11-slim
WORKDIR /srv
COPY apps/model-router/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir .
COPY apps/agent-worker/worker/workflows/schemas.py ./vendor/agent_worker_schemas.py
COPY apps/model-router/ ./
RUN chmod +x /srv/docker-entrypoint.sh
EXPOSE 8085
ENV UVICORN_WORKERS=1
CMD ["/srv/docker-entrypoint.sh"]
