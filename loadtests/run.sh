#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_K6="$ROOT/.tools/k6/k6"
if [[ -x "$LOCAL_K6" ]]; then
  export PATH="$(dirname "$LOCAL_K6"):$PATH"
fi

SCENARIO="${1:-full-stack}"
MODE="${2:-}"

export K6_BASE_URL="${K6_BASE_URL:-http://localhost:5234}"
SCRIPT="$ROOT/loadtests/scenarios/${SCENARIO}.js"

if [[ ! -f "$SCRIPT" ]]; then
  echo "Unknown scenario: $SCENARIO"
  echo "Use: api-employees | frontend-static | full-stack"
  exit 1
fi

if [[ "$MODE" == "docker" ]] || [[ "$SCENARIO" == "docker" ]]; then
  SCENARIO="${2:-full-stack}"
  if [[ "$SCENARIO" == "docker" ]]; then SCENARIO="full-stack"; fi
  SCRIPT="$ROOT/loadtests/scenarios/${SCENARIO}.js"
  export K6_BASE_URL="${K6_BASE_URL/http:\/\/localhost/host.docker.internal}"
  docker run --rm -i \
    -e K6_BASE_URL \
    --add-host=host.docker.internal:host-gateway \
    -v "$ROOT/loadtests:/loadtests:ro" \
    grafana/k6:latest run "/loadtests/scenarios/${SCENARIO}.js" "${@:3}"
  exit 0
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 not found. Run ./loadtests/install-k6.sh or ./loadtests/run.sh full-stack docker"
  exit 1
fi

echo "Scenario: $SCENARIO"
echo "URL: $K6_BASE_URL"
k6 run "$SCRIPT" "${@:3}"
