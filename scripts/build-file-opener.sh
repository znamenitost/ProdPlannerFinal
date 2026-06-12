#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/tools/ProductionPlanner.FileOpener"
PUBLISH="$PROJECT/publish/win-x64"
RELEASES="$PROJECT/releases"
ZIP_NAME="ProductionPlanner-FileOpener-win-x64.zip"

rm -rf "$PUBLISH"
mkdir -p "$RELEASES"

dotnet publish "$PROJECT/ProductionPlanner.FileOpener.csproj" \
  -c Release \
  -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:IncludeNativeLibrariesForSelfExtract=true \
  -o "$PUBLISH"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp "$PUBLISH/ProductionPlanner.FileOpener.exe" "$STAGE/"
cp "$PROJECT/install.ps1" "$PROJECT/install.bat" "$PROJECT/uninstall.ps1" "$PROJECT/README.txt" "$STAGE/"

(
  cd "$STAGE"
  zip -r "$RELEASES/$ZIP_NAME" .
)

mkdir -p "$ROOT/wwwroot/downloads"
cp "$RELEASES/$ZIP_NAME" "$ROOT/wwwroot/downloads/$ZIP_NAME"

echo "Built $RELEASES/$ZIP_NAME"
echo "Copied to wwwroot/downloads/$ZIP_NAME"
