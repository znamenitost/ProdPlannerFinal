#!/bin/bash
# Перенос SQLite → PostgreSQL на 1gb.ru
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f appsettings.Production.local.json ]; then
  export DOTNET_ENVIRONMENT=Production
fi

CONN="${POSTGRES_CONNECTION_STRING:-}"
if [ -z "$CONN" ] && [ -f appsettings.Production.local.json ]; then
  CONN=$(python3 -c "import json; print(json.load(open('appsettings.Production.local.json'))['ConnectionStrings']['DefaultConnection'])" 2>/dev/null || true)
fi

if [ -z "$CONN" ]; then
  echo "Создайте appsettings.Production.local.json из appsettings.Production.local.json.example"
  echo "или задайте POSTGRES_CONNECTION_STRING"
  exit 1
fi

SQLITE="${SQLITE_PATH:-App_Data/ProductionPlanner.db}"
CLEAR_FLAG=""
if [ "${1:-}" = "--clear" ]; then
  CLEAR_FLAG="--clear"
fi

dotnet run --project ProductionPlanner.csproj -- migrate-sqlite-to-postgres --sqlite "$SQLITE" --postgres "$CONN" $CLEAR_FLAG
