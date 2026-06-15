#!/usr/bin/env bash
# Снять 503 после неудачного деплоя: удалить или переименовать app_offline.htm на 1gb.ru
# Использование:
#   FTP_PASSWORD='...' ./scripts/recover-site-1gb.sh
#   FTP_PASSWORD='...' FTP_SERVER=ftp.team-mainb6d.1gb.ru FTP_USERNAME=1gb_team-mainb6d ./scripts/recover-site-1gb.sh
set -euo pipefail

FTP_HOST="${FTP_SERVER:-ftp.team-mainb6d.1gb.ru}"
FTP_HOST="${FTP_HOST#ftp://}"
FTP_HOST="${FTP_HOST#ftps://}"
FTP_HOST="${FTP_HOST%%/*}"
FTP_USER="${FTP_USERNAME:-1gb_team-mainb6d}"
FTP_PASS="${FTP_PASSWORD:?Задайте FTP_PASSWORD (пароль FTP из панели 1gb, не PostgreSQL)}"
FTP_DIR="${FTP_SERVER_DIR:-/http/}"
case "$FTP_DIR" in
  */) ;;
  *) FTP_DIR="${FTP_DIR}/" ;;
esac

if ! command -v lftp >/dev/null 2>&1; then
  echo "Установите lftp: brew install lftp"
  exit 1
fi

lftp_cmd() {
  lftp -e "set ftp:passive-mode on; set ssl:force off; open -u '${FTP_USER}','${FTP_PASS}' ${FTP_HOST}; cd '${FTP_DIR}'; $1; bye"
}

echo "FTP: ${FTP_HOST}${FTP_DIR}"
echo "Проверяем app_offline.htm…"

if lftp_cmd "cls -1 app_offline.htm" 2>/dev/null | grep -qi 'app_offline\.htm'; then
  echo "Найден app_offline.htm — удаляем…"
  lftp_cmd "rm -f app_offline.htm" || true
  sleep 2
fi

if lftp_cmd "cls -1 app_offline.htm" 2>/dev/null | grep -qi 'app_offline\.htm'; then
  echo "rm не сработал — переименовываем (IIS снимает 503 при любом имени кроме app_offline.htm)…"
  lftp_cmd "mv -f app_offline.htm _app_offline_removed_$(date +%s).htm" || true
fi

echo ""
echo "Проверка сайта:"
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "http://team-mainb6d.1gb.ru/api/deploy-info" || echo "000")
echo "  /api/deploy-info → HTTP ${code}"

if [ "$code" = "503" ]; then
  echo ""
  echo "Всё ещё 503. Вручную в FileZilla / панели 1gb:"
  echo "  1. Откройте ${FTP_DIR}"
  echo "  2. Удалите или переименуйте app_offline.htm"
  echo "  3. Проверьте, что есть wwwroot/index.html (если нет — перезапустите зелёный Deploy to 1gb.ru)"
  exit 1
fi

if [ "$code" = "200" ] || [ "$code" = "401" ]; then
  echo "Сайт снова отвечает."
  exit 0
fi

echo "Неожиданный код ${code} — смотрите logs/app.log на FTP или перезапустите деплой."
exit 1
