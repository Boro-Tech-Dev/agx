FROM python:3.11-slim
WORKDIR /srv
COPY apps/agent-worker/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir .
COPY apps/agent-worker/ ./
COPY config/scenario_planner ./config/scenario_planner
EXPOSE 8091
CMD ["uvicorn", "worker.main:app", "--host", "0.0.0.0", "--port", "8091"]
