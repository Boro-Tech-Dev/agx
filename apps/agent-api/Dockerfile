FROM python:3.11-slim
WORKDIR /srv
COPY apps/agent-api/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir .
COPY apps/agent-api/ ./
COPY config/learning ./config/learning
COPY config/scenario_planner ./config/scenario_planner
COPY config/agent_lanes.json ./config/agent_lanes.json
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
