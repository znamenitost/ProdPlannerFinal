#!/usr/bin/env bash
# Установка Homebrew в систему (Terminal + пароль администратора).
# bash scripts/install-homebrew-macos.sh

set -euo pipefail

if command -v brew >/dev/null 2>&1; then
  echo "Homebrew уже установлен: $(command -v brew)"
  brew --version
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Только macOS."
  exit 1
fi

echo "Установка Homebrew..."
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

brew --version
echo 'Добавьте в ~/.zprofile: eval "$(/opt/homebrew/bin/brew shellenv)"'
