#!/usr/bin/env sh
# Reclaim leftover containers for this Compose project so `up` / `down` behave as
# "start fresh" / "actually gone". An interrupted `docker compose up` often leaves
# stopped or Created containers that still hold Compose-generated names; the next
# `up` then fails with "already in use".
#
# Usage (from repo root, or this script cds to repo root):
#   ./scripts/compose-reclaim.sh before-up   # before docker compose up
#   ./scripts/compose-reclaim.sh after-down  # after docker compose down
set -eu
cd "$(dirname "$0")/.."

compose_project() {
  if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    printf '%s' "$COMPOSE_PROJECT_NAME"
    return
  fi
  if [ -f docker-compose.yml ]; then
    p=$(awk '/^name:/{gsub(/\r/,"",$2); print $2; exit}' docker-compose.yml)
    if [ -n "$p" ]; then
      printf '%s' "$p"
      return
    fi
  fi
  printf '%s' agent-x
}

proj=$(compose_project)

case "${1:-}" in
  before-up)
    docker compose rm -f >/dev/null 2>&1 || true
    for id in $(docker ps -aq --filter "label=com.docker.compose.project=${proj}" --filter "status=created" 2>/dev/null); do
      [ -z "$id" ] || docker rm -f "$id" >/dev/null 2>&1 || true
    done
    # Services removed from docker-compose.yml (e.g. cAdvisor) are not always
    # deleted unless every `up` uses --remove-orphans; prune known dropped images.
    for id in $(docker ps -aq --filter "label=com.docker.compose.project=${proj}" 2>/dev/null); do
      [ -z "$id" ] && continue
      img=$(docker inspect --format '{{.Config.Image}}' "$id" 2>/dev/null || true)
      case "$img" in
        *cadvisor/cadvisor*) docker rm -f "$id" >/dev/null 2>&1 || true ;;
      esac
    done
    ;;
  after-down)
    for id in $(docker ps -aq --filter "label=com.docker.compose.project=${proj}" 2>/dev/null); do
      [ -z "$id" ] || docker rm -f "$id" >/dev/null 2>&1 || true
    done
    # Raw `docker compose down` can leave the default network when a container
    # is still attached but no longer tracked in the same removal pass (Desktop quirks, Created state, etc.).
    net="${proj}_default"
    # `docker ps --filter network=…` is unreliable on some engines; inspect the network instead.
    for raw in $(docker network inspect "$net" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null); do
      [ -z "$raw" ] && continue
      n=$(printf '%s' "$raw" | sed 's|^/||')
      docker rm -f "$n" >/dev/null 2>&1 || true
    done
    docker network rm "$net" >/dev/null 2>&1 || true
    ;;
  *)
    echo "usage: $0 before-up | after-down" >&2
    exit 1
    ;;
esac
