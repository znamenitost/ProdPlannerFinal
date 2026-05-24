#!/usr/bin/env bash
# Загрузка ./publish на 1gb.ru через lftp (обход timeout SamKirkland на passive data port).
# Поэтапно: wwwroot → ключевые бинарники → остальное mirror с retry.
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
set net:max-retries 5
set net:reconnect-interval-base 5
open ${FTP_HOST}
cd ${FTP_DIR}
$1
bye
EOF
  lftp -f "$LFTP_SCRIPT"
}

retry() {
  local label="$1"
  shift
  local attempt
  for attempt in 1 2 3 4 5; do
    echo "[$label] attempt $attempt/5"
    if "$@"; then
      echo "[$label] OK"
      return 0
    fi
    sleep "$((attempt * 15))"
  done
  echo "[$label] FAILED after 5 attempts" >&2
  return 1
}

put_file() {
  local rel="$1"
  local remote_dir
  remote_dir=$(dirname "$rel")
  [ "$remote_dir" = "." ] && remote_dir=""
  local mkdir_cmd=""
  [ -n "$remote_dir" ] && mkdir_cmd="mkdir -p ${remote_dir};"
  run_lftp "${mkdir_cmd} put ./publish/${rel} -o ${rel}"
}

echo "=== Phase 1: wwwroot (frontend) ==="
retry "wwwroot" run_lftp "mkdir -p wwwroot; lcd ./publish/wwwroot; mirror -R --verbose --parallel=1 . wwwroot"

echo "=== Phase 2: critical backend files ==="
CRITICAL_FILES=(
  ProductionPlanner.dll
  ProductionPlanner.exe
  ProductionPlanner.runtimeconfig.json
  ProductionPlanner.deps.json
  web.config
  appsettings.json
  appsettings.Production.json
  deploy-version.txt
)
for rel in "${CRITICAL_FILES[@]}"; do
  if [ -f "./publish/${rel}" ]; then
    retry "put ${rel}" put_file "$rel"
  fi
done

echo "=== Phase 3: remaining native/runtime files (optional) ==="
if ! retry "full-mirror" run_lftp "\
lcd ./publish; \
mirror -R --verbose --parallel=1 \
  -X wwwroot/ \
  -X logs/ \
  -X App_Data/ \
  -X glob:*.db \
  -X glob:*.db-shm \
  -X glob:*.db-wal \
  -X glob:*.pdb \
  -X app_offline.htm \
  -X .ftp-deploy-sync-state.json \
  . ."; then
  echo "::warning::Phase 3 incomplete — wwwroot and ProductionPlanner.* should still be updated"
fi

echo "FTP deploy completed (${FTP_HOST}${FTP_DIR})"
