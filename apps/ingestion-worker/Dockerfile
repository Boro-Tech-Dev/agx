FROM python:3.11-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        poppler-utils \
        libreoffice-writer \
        libreoffice-calc \
        libreoffice-impress \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY apps/ingestion-worker/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir .
COPY apps/ingestion-worker/ ./
EXPOSE 8092
CMD ["uvicorn", "ingestion.main:app", "--host", "0.0.0.0", "--port", "8092"]
