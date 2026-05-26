# ColBERT reranker service (TEI-compatible /rerank endpoint).
# COLBERT_WITH_ML=1 (default): install torch/transformers/pylate for real scoring.
# COLBERT_WITH_ML=0: slim stub-only image for fast local/CI builds.
FROM python:3.11-slim

ARG COLBERT_WITH_ML=1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir \
    fastapi==0.115.6 \
    "uvicorn[standard]==0.34.0" \
    pydantic==2.10.4 \
    prometheus-client==0.21.0 \
    prometheus-fastapi-instrumentator==7.0.0

COPY apps/reranker-colbert/pyproject.toml ./pyproject.toml
COPY apps/reranker-colbert/server ./server

RUN if [ "$COLBERT_WITH_ML" = "1" ]; then \
      pip install --no-cache-dir \
        "torch>=2.2" \
        "transformers>=4.45" \
        "pylate>=1.1.0"; \
    fi

EXPOSE 8097

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8097"]
