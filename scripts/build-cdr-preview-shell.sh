#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/tools/CdrPreviewShell"
BUILD_OUT="$PROJECT/bin/Release/net48"
RELEASES="$PROJECT/releases"
ZIP_NAME="CdrPreviewShell-win-x64.zip"

mkdir -p "$RELEASES"

dotnet build "$PROJECT/CdrPreviewShell.csproj" -c Release

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp "$BUILD_OUT/CdrPreviewShell.dll" "$BUILD_OUT/SharpShell.dll" "$STAGE/"
cp "$PROJECT/install.ps1" "$PROJECT/install.bat" "$PROJECT/uninstall.ps1" "$PROJECT/uninstall.bat" "$PROJECT/README.txt" "$STAGE/"

(
  cd "$STAGE"
  zip -r "$RELEASES/$ZIP_NAME" .
)

mkdir -p "$ROOT/wwwroot/downloads"
cp "$RELEASES/$ZIP_NAME" "$ROOT/wwwroot/downloads/$ZIP_NAME"

echo "Built $RELEASES/$ZIP_NAME"
echo "Copied to wwwroot/downloads/$ZIP_NAME"
