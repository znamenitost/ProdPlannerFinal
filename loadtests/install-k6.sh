#!/usr/bin/env bash
set -euo pipefail

if command -v k6 >/dev/null 2>&1; then
  echo "k6 already installed:"
  k6 version
  exit 0
fi

echo "Installing k6..."

if command -v brew >/dev/null 2>&1; then
  brew install grafana/k6/k6
  k6 version
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  echo "Homebrew not found. Use Docker:"
  echo "  ./loadtests/run.sh full-stack docker"
  exit 0
fi

echo "Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/"
exit 1
