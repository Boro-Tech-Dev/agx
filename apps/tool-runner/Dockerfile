FROM python:3.12-slim
WORKDIR /app
COPY apps/tool-runner/pyproject.toml .
RUN pip install --no-cache-dir \
    fastapi==0.115.6 \
    uvicorn[standard]==0.34.0 \
    pydantic==2.10.4 \
    prometheus-client==0.21.0 \
    prometheus-fastapi-instrumentator==7.0.0
COPY apps/tool-runner/tools ./tools
CMD ["uvicorn","tools.main:app","--host","0.0.0.0","--port","8090"]
