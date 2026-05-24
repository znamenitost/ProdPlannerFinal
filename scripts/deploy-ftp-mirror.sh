#!/usr/bin/env bash
# Загрузка ./publish на 1gb.ru через lftp mirror (обход timeout SamKirkland на passive data port).
set -euo pipefail

FTP_HOST="${1:?FTP host}"
FTP_USER="${2:?FTP user}"
FTP_PASS="${3:?FTP password}"
FTP_DIR="${4:?FTP remote dir}"

WORKDIR=$(mktemp -d)
LFTP_SCRIPT="${WORKDIR}/mirror.lftp"
NETRC="${WORKDIR}/.netrc"
trap 'rm -rf "$WORKDIR"' EXIT

chmod 700 "$WORKDIR"
printf 'machine %s\nlogin %s\npassword %s\n' "$FTP_HOST" "$FTP_USER" "$FTP_PASS" > "$NETRC"
chmod 600 "$NETRC"

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
lcd ./publish
cd ${FTP_DIR}
mirror -R --verbose --parallel=1 -X logs/ -X App_Data/ -X glob:*.db -X glob:*.db-shm -X glob:*.db-wal -X glob:*.pdb -X app_offline.htm -X .ftp-deploy-sync-state.json
bye
EOF

export HOME="$WORKDIR"
echo "lftp mirror → ${FTP_HOST}${FTP_DIR}"
lftp -f "$LFTP_SCRIPT"
echo "FTP mirror upload completed"
