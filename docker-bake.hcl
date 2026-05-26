# Build all app images for GHCR. Used by .github/workflows/build-images.yml
#
#   docker buildx bake --push
#   IMAGE_TAG=sha-abc1234 REGISTRY=ghcr.io/boro-tech-dev docker buildx bake --push

variable "REGISTRY" {
  default = "ghcr.io/boro-tech-dev"
}

variable "IMAGE_TAG" {
  default = "main"
}

variable "COLBERT_WITH_ML" {
  default = "1"
}

group "default" {
  targets = [
    "agent-api",
    "agent-worker",
    "browser-runner",
    "ingestion-worker",
    "model-router",
    "reranker-colbert",
    "scenario-worker",
    "search-runner",
    "tool-runner",
    "veeva-suite-worker",
    "web-dashboard",
  ]
}

target "_common" {
  context = "."
  platforms = ["linux/amd64"]
}

target "agent-api" {
  inherits = ["_common"]
  dockerfile = "apps/agent-api/Dockerfile"
  tags = ["${REGISTRY}/agent-x-agent-api:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=agent-api"]
  cache-to = ["type=gha,mode=max,scope=agent-api"]
}

target "agent-worker" {
  inherits = ["_common"]
  dockerfile = "apps/agent-worker/Dockerfile"
  tags = ["${REGISTRY}/agent-x-agent-worker:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=agent-worker"]
  cache-to = ["type=gha,mode=max,scope=agent-worker"]
}

target "browser-runner" {
  inherits = ["_common"]
  dockerfile = "apps/browser-runner/Dockerfile"
  tags = ["${REGISTRY}/agent-x-browser-runner:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=browser-runner"]
  cache-to = ["type=gha,mode=max,scope=browser-runner"]
}

target "ingestion-worker" {
  inherits = ["_common"]
  dockerfile = "apps/ingestion-worker/Dockerfile"
  tags = ["${REGISTRY}/agent-x-ingestion-worker:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=ingestion-worker"]
  cache-to = ["type=gha,mode=max,scope=ingestion-worker"]
}

target "model-router" {
  inherits = ["_common"]
  dockerfile = "apps/model-router/Dockerfile"
  tags = ["${REGISTRY}/agent-x-model-router:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=model-router"]
  cache-to = ["type=gha,mode=max,scope=model-router"]
}

target "reranker-colbert" {
  inherits = ["_common"]
  dockerfile = "apps/reranker-colbert/Dockerfile"
  tags = ["${REGISTRY}/agent-x-reranker-colbert:${IMAGE_TAG}"]
  args = {
    COLBERT_WITH_ML = COLBERT_WITH_ML
  }
  cache-from = ["type=gha,scope=reranker-colbert"]
  cache-to = ["type=gha,mode=max,scope=reranker-colbert"]
}

target "scenario-worker" {
  inherits = ["_common"]
  dockerfile = "apps/scenario-worker/Dockerfile"
  tags = ["${REGISTRY}/agent-x-scenario-worker:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=scenario-worker"]
  cache-to = ["type=gha,mode=max,scope=scenario-worker"]
}

target "search-runner" {
  inherits = ["_common"]
  dockerfile = "apps/search-runner/Dockerfile"
  tags = ["${REGISTRY}/agent-x-search-runner:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=search-runner"]
  cache-to = ["type=gha,mode=max,scope=search-runner"]
}

target "tool-runner" {
  inherits = ["_common"]
  dockerfile = "apps/tool-runner/Dockerfile"
  tags = ["${REGISTRY}/agent-x-tool-runner:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=tool-runner"]
  cache-to = ["type=gha,mode=max,scope=tool-runner"]
}

target "veeva-suite-worker" {
  context = "apps/veeva-suite-worker"
  dockerfile = "Dockerfile"
  platforms = ["linux/amd64"]
  tags = ["${REGISTRY}/agent-x-veeva-suite-worker:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=veeva-suite-worker"]
  cache-to = ["type=gha,mode=max,scope=veeva-suite-worker"]
}

target "web-dashboard" {
  inherits = ["_common"]
  dockerfile = "apps/web-dashboard/Dockerfile"
  tags = ["${REGISTRY}/agent-x-web-dashboard:${IMAGE_TAG}"]
  cache-from = ["type=gha,scope=web-dashboard"]
  cache-to = ["type=gha,mode=max,scope=web-dashboard"]
}
