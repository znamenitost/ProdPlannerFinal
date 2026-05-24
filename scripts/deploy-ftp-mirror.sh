#!/usr/bin/env bash
# Загрузка ./publish на 1gb.ru: по одному файлу через lftp put + retry.
# SamKirkland/mirror падают на passive data-port timeout; одиночный put в CI работает.
set -euo pipefail

FTP_HOST="${1:?FTP host}"
FTP_USER="${2:?FTP user}"
FTP_PASS="${3:?FTP password}"
FTP_DIR="${4:?FTP remote dir}"

WORKDIR=$(mktemp -d)
LFTP_SCRIPT="${WORKDIR}/cmd.lftp"
NETRC="${WORKDIR}/.netrc"
trap 'rm -rf "$WORKDIR"' EXIT

chmod 700 "$WORKDIR"
printf 'machine %s\nlogin %s\npassword %s\n' "$FTP_HOST" "$FTP_USER" "$FTP_PASS" > "$NETRC"
chmod 600 "$NETRC"
export HOME="$WORKDIR"

run_lftp() {
  cat > "$LFTP_SCRIPT" <<EOF
set ftp:passive-mode on
set ftp:prefer-epsv off
set ftp:ignore-pasv-ip on
set ftp:use-feat off
set ssl:force off
set net:timeout 120
set net:max-retries 3
set net:reconnect-interval-base 5
open ${FTP_HOST}
cd ${FTP_DIR}
$1
bye
EOF
  lftp -f "$LFTP_SCRIPT"
}

retry_put() {
  local rel="$1"
  local remote_dir
  remote_dir=$(dirname "$rel")
  [ "$remote_dir" = "." ] && remote_dir=""
  local mkdir_cmd=""
  [ -n "$remote_dir" ] && mkdir_cmd="mkdir -p ${remote_dir};"

  local attempt
  for attempt in 1 2 3 4 5; do
    if run_lftp "${mkdir_cmd} put ./publish/${rel} -o ${rel}"; then
      return 0
    fi
    echo "  retry ${rel} (${attempt}/5)" >&2
    sleep "$((attempt * 10))"
  done
  echo "  FAILED: ${rel}" >&2
  return 1
}

upload_files() {
  local label="$1"
  shift
  local total=0
  local ok=0
  local failed=0
  local rel

  while IFS= read -r rel; do
    [ -z "$rel" ] && continue
    total=$((total + 1))
    if retry_put "$rel"; then
      ok=$((ok + 1))
    else
      failed=$((failed + 1))
    fi
    # Прогресс каждые 25 файлов
    if [ $((total % 25)) -eq 0 ]; then
      echo "[$label] ${ok}/${total} uploaded (${failed} failed)"
    fi
  done < <("$@")

  echo "[$label] done: ${ok}/${total} ok, ${failed} failed"
  [ "$failed" -eq 0 ]
}

echo "=== Phase 1: wwwroot ==="
upload_files "wwwroot" find ./publish/wwwroot -type f | sed 's|^\./publish/||'

echo "=== Phase 2: root binaries and config ==="
upload_files "root" find ./publish -maxdepth 1 -type f | sed 's|^\./publish/||'

echo "=== Phase 3: nested runtime folders (ru/, runtimes/, …) ==="
if ! upload_files "rest" find ./publish -mindepth 2 -type f \
  ! -path './publish/wwwroot/*' \
  ! -path './publish/logs/*' \
  ! -path './publish/App_Data/*' \
  ! -name '*.db' \
  ! -name '*.db-shm' \
  ! -name '*.db-wal' \
  ! -name '*.pdb' \
  ! -name 'app_offline.htm' \
  | sed 's|^\./publish/||'; then
  echo "::warning::Phase 3 had failures — core app and wwwroot should still be updated"
fi

echo "FTP deploy completed (${FTP_HOST}${FTP_DIR})"
