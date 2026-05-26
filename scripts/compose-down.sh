#!/usr/bin/env sh
# Usage: ./scripts/compose-down.sh [docker compose down args, e.g. -v]
# Always passes --remove-orphans, then force-removes any containers still labeled for
# this project (covers partial down / Desktop quirks so the next `up` is clean).
set -eu
cd "$(dirname "$0")/.."
docker compose down --remove-orphans "$@"
"$(dirname "$0")/compose-reclaim.sh" after-down
