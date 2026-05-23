#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
K6_DIR="${ROOT}/.tools/k6"
mkdir -p "${K6_DIR}"

if [[ -x "${K6_DIR}/k6" ]]; then
  "${K6_DIR}/k6" version
  exit 0
fi

if command -v k6 >/dev/null 2>&1; then
  k6 version
  exit 0
fi

ARCH=$(uname -m)
case "$ARCH" in arm64) SUFFIX=macos-arm64;; x86_64) SUFFIX=macos-amd64;; *) echo "unsupported: $ARCH"; exit 1;; esac
VER="${K6_VERSION:-1.6.1}"
ZIP="k6-v${VER}-${SUFFIX}.zip"
URL="https://github.com/grafana/k6/releases/download/v${VER}/${ZIP}"
echo "Downloading ${URL}..."
curl -fsSL "$URL" -o "/tmp/${ZIP}"
unzip -qo "/tmp/${ZIP}" -d "${K6_DIR}"
BIN=$(find "${K6_DIR}" -name k6 -type f | head -1)
cp "$BIN" "${K6_DIR}/k6"
chmod +x "${K6_DIR}/k6"
"${K6_DIR}/k6" version
echo ""
echo "k6 installed: ${K6_DIR}/k6"
echo "Run: ./loadtests/run.sh api-employees"
