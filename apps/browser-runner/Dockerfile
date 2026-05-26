# Playwright base includes Chromium and OS deps (~1–2 GB RSS typical for light screenshots/crawl).
# Optional WEB_BROWSER_ENGINE=firefox|webkit adds ~300–500 MB RSS; install extra browsers below.
FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

WORKDIR /app

# Pin playwright to the image tag so bundled Chromium stays compatible.
RUN pip install --no-cache-dir \
    playwright==1.49.1 \
    fastapi==0.115.6 \
    "uvicorn[standard]==0.34.0" \
    pydantic==2.10.4 \
    httpx==0.28.1 \
    trafilatura==1.12.0 \
    prometheus-client==0.21.0 \
    prometheus-fastapi-instrumentator==7.0.0

COPY apps/browser-runner/tools ./tools

# Firefox/WebKit for WEB_BROWSER_ENGINE (Chromium is preinstalled in the base image).
RUN playwright install firefox webkit

# Internal port 8094 (8093 is scenario-worker in this stack).
EXPOSE 8094
ENV WEB_NAV_TIMEOUT_MS=45000

CMD ["uvicorn", "tools.main:app", "--host", "0.0.0.0", "--port", "8094"]
