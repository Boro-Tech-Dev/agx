FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir \
    fastapi==0.115.6 \
    "uvicorn[standard]==0.34.0" \
    pydantic==2.10.4 \
    httpx==0.28.1 \
    prometheus-client==0.21.0 \
    prometheus-fastapi-instrumentator==7.0.0
COPY apps/search-runner/tools ./tools
EXPOSE 8092
ENV SEARXNG_URL=http://searxng:8080
CMD ["uvicorn", "tools.main:app", "--host", "0.0.0.0", "--port", "8092"]
