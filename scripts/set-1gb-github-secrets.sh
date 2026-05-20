#!/bin/bash
# Однократная настройка секретов для deploy-1gb.yml (нужен: gh auth login)
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-znamenitost/ProdPlannerFinal}"
ENV_NAME="FTP_SERVER"

FTP_SERVER="${FTP_SERVER:-ftp.team-mainb6d.1gb.ru}"
FTP_USERNAME="${FTP_USERNAME:-1gb_team-mainb6d}"
FTP_SERVER_DIR="${FTP_SERVER_DIR:-/http/}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Установите GitHub CLI: brew install gh && gh auth login"
  exit 1
fi

if [ -z "${FTP_PASSWORD:-}" ]; then
  read -r -s -p "FTP пароль (1gb): " FTP_PASSWORD
  echo
fi

gh secret set FTP_SERVER --env "$ENV_NAME" --repo "$REPO" --body "$FTP_SERVER"
gh secret set FTP_USERNAME --env "$ENV_NAME" --repo "$REPO" --body "$FTP_USERNAME"
gh secret set FTP_PASSWORD --env "$ENV_NAME" --repo "$REPO" --body "$FTP_PASSWORD"
gh secret set FTP_SERVER_DIR --env "$ENV_NAME" --repo "$REPO" --body "$FTP_SERVER_DIR"

if [ -n "${POSTGRES_CONNECTION_STRING:-}" ]; then
  gh secret set POSTGRES_CONNECTION_STRING --env "$ENV_NAME" --repo "$REPO" --body "$POSTGRES_CONNECTION_STRING"
  echo "POSTGRES_CONNECTION_STRING записан."
else
  echo "Подсказка: POSTGRES_CONNECTION_STRING='Host=postgres82.1gb.ru;...' $0 — для PostgreSQL на 1gb"
fi

echo "Секреты записаны в Environment $ENV_NAME. Запустите Deploy to 1gb.ru в Actions."
