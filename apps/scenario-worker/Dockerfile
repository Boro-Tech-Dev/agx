FROM python:3.11-slim
WORKDIR /srv

RUN pip install --no-cache-dir \
    "fastapi==0.115.6" \
    "uvicorn[standard]==0.34.0" \
    "pydantic==2.10.4" \
    "prometheus-client==0.21.0" \
    "prometheus-fastapi-instrumentator==7.0.0"

COPY apps/agent-worker/worker/__init__.py ./worker/__init__.py
COPY apps/agent-worker/worker/scenario_planning.py ./worker/scenario_planning.py
COPY apps/agent-worker/worker/scenario_engine ./worker/scenario_engine
COPY apps/scenario-worker/scenario_worker ./scenario_worker
COPY config/scenario_planner ./config/scenario_planner

ENV PYTHONPATH=/srv

EXPOSE 8093
CMD ["uvicorn", "scenario_worker.main:app", "--host", "0.0.0.0", "--port", "8093"]
