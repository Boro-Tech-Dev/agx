#!/usr/bin/env sh
# Wrapper for `docker compose up` that clears stopped/Created service containers first.
# Prevents "container name ... is already in use" after a partial or failed prior `up`.
# Usage: ./scripts/compose-up.sh [same args as docker compose up, e.g. -d --build]
set -eu
cd "$(dirname "$0")/.."
"$(dirname "$0")/compose-reclaim.sh" before-up

# Always passes --remove-orphans so services removed from compose.yml are dropped.
exec docker compose up --remove-orphans "$@"
