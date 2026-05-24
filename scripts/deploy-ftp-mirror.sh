#!/usr/bin/env bash
# Загрузка ./publish на 1gb.ru: по одному файлу через lftp put + retry.
# wwwroot: содержимое ./publish/wwwroot/ -> /http/wwwroot/ (без publish/wwwroot на сервере).
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
  local local_file="$1"
  local remote_path="$2"
  local remote_dir
  remote_dir=$(dirname "$remote_path")
  [ "$remote_dir" = "." ] && remote_dir=""
  local mkdir_cmd=""
  [ -n "$remote_dir" ] && mkdir_cmd="mkdir -p ${remote_dir};"

  local attempt
  for attempt in 1 2 3 4 5; do
    if run_lftp "${mkdir_cmd} put ${local_file} -o ${remote_path}"; then
      return 0
    fi
    echo "  retry ${remote_path} (${attempt}/5)" >&2
    sleep "$((attempt * 10))"
  done
  echo "  FAILED: ${remote_path}" >&2
  return 1
}

upload_files() {
  local label="$1"
  shift
  local total=0
  local ok=0
  local failed=0

  while IFS=$'\t' read -r local_file remote_path; do
    [ -z "$local_file" ] && continue
    total=$((total + 1))
    if retry_put "$local_file" "$remote_path"; then
      ok=$((ok + 1))
    else
      failed=$((failed + 1))
    fi
    if [ $((total % 25)) -eq 0 ]; then
      echo "[$label] ${ok}/${total} uploaded (${failed} failed)"
    fi
  done < <("$@")

  echo "[$label] done: ${ok}/${total} ok, ${failed} failed"
  [ "$failed" -eq 0 ]
}

wwwroot_file_list() {
  find ./publish/wwwroot -type f -print | while IFS= read -r file; do
  rel="${file#./publish/wwwroot/}"
  rel="${rel#publish/wwwroot/}"
  printf '%s\twwwroot/%s\n' "$file" "$rel"
  done
}

root_file_list() {
  find ./publish -maxdepth 1 -type f -print | while IFS= read -r file; do
  rel="${file#./publish/}"
  rel="${rel#publish/}"
  printf '%s\t%s\n' "$file" "$rel"
  done
}

runtime_file_list() {
  find ./publish -mindepth 2 -type f \
    ! -path './publish/wwwroot/*' \
    ! -path './publish/logs/*' \
    ! -path './publish/App_Data/*' \
    ! -name '*.db' \
    ! -name '*.db-shm' \
    ! -name '*.db-wal' \
    ! -name '*.pdb' \
    ! -name 'app_offline.htm' \
    -print | while IFS= read -r file; do
  rel="${file#./publish/}"
  rel="${rel#publish/}"
  printf '%s\t%s\n' "$file" "$rel"
  done
}

echo "=== Phase 1: wwwroot (publish/wwwroot/* -> wwwroot/*) ==="
upload_files "wwwroot" wwwroot_file_list

echo "=== Phase 2: root binaries and config ==="
upload_files "root" root_file_list

echo "=== Phase 3: nested runtime folders (ru/, runtimes/, …) ==="
if ! upload_files "rest" runtime_file_list; then
  echo "::warning::Phase 3 had failures — core app and wwwroot should still be updated"
fi

echo "FTP deploy completed (${FTP_HOST}${FTP_DIR})"
