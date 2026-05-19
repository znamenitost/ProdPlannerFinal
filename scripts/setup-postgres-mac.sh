#!/bin/zsh
set -e

DB_NAME="production_planner"
DB_USER="postgres"
DB_PASS="postgres"
CONN="Host=localhost;Port=5432;Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS}"

echo "=== ProductionPlanner: настройка PostgreSQL на macOS ==="
echo ""

if command -v docker >/dev/null 2>&1; then
  echo "Найден Docker. Запускаю контейнер..."
  cd "$(dirname "$0")/.."
  docker compose up -d
  echo "Готово. Строка подключения уже в appsettings."
  echo "$CONN"
  exit 0
fi

BREW=""
for p in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  [[ -x "$p" ]] && BREW="$p" && break
done

if [[ -n "$BREW" ]]; then
  echo "Найден Homebrew: $BREW"
  if ! "$BREW" list postgresql@16 &>/dev/null; then
    echo "Устанавливаю PostgreSQL 16 (это может занять несколько минут)..."
    "$BREW" install postgresql@16
  fi
  PG_BIN="$("$BREW" --prefix postgresql@16)/bin"
  export PATH="$PG_BIN:$PATH"
  "$BREW" services start postgresql@16
  sleep 2
  if ! psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
    psql postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' SUPERUSER;"
  fi
  if ! psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    psql postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  fi
  echo ""
  echo "PostgreSQL запущен через Homebrew."
  echo "Строка подключения (уже в appsettings.json):"
  echo "  $CONN"
  exit 0
fi

echo "Docker и Homebrew не найдены. Выберите один вариант:"
echo ""
echo "1) Postgres.app (проще всего для Mac без Docker)"
echo "   https://postgresapp.com/downloads.html"
echo "   - Установите и запустите сервер"
echo "   - В psql выполните:"
echo "       CREATE USER postgres WITH PASSWORD 'postgres' SUPERUSER;"
echo "       CREATE DATABASE production_planner OWNER postgres;"
echo ""
echo "2) Docker Desktop"
echo "   https://www.docker.com/products/docker-desktop/"
echo "   После установки: cd $(dirname "$0")/.. && docker compose up -d"
echo ""
echo "3) Homebrew"
echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
echo "   Затем снова запустите этот скрипт."
echo ""
exit 1
