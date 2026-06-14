#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/tools/CdrPreviewShell"
NATIVE_PROJECT="$ROOT/tools/CdrThumbnailNative"
BUILD_OUT="$PROJECT/bin/Release/net48"
RELEASES="$PROJECT/releases"
ZIP_NAME="CdrPreviewShell-win-x64.zip"

mkdir -p "$RELEASES"

dotnet build "$PROJECT/CdrPreviewShell.csproj" -c Release

NATIVE_DLL="$PROJECT/CdrThumbnailNative.dll"
if [[ ! -f "$NATIVE_DLL" ]]; then
  NATIVE_DLL="$NATIVE_PROJECT/bin/x64/Release/CdrThumbnailNative.dll"
fi
if [[ ! -f "$NATIVE_DLL" ]]; then
  echo "ERROR: CdrThumbnailNative.dll not found."
  echo "On Windows, run: powershell -ExecutionPolicy Bypass -File scripts/build-cdr-thumbnail-native.ps1"
  echo "Or build tools/CdrThumbnailNative/CdrThumbnailNative.vcxproj (Release|x64) and copy the DLL into tools/CdrPreviewShell/."
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp "$BUILD_OUT/CdrPreviewShell.dll" "$BUILD_OUT/CdrPreviewShell.dll.config" "$BUILD_OUT/SharpShell.dll" "$NATIVE_DLL" "$STAGE/"
cp "$PROJECT/install.ps1" "$PROJECT/install.bat" "$PROJECT/uninstall.ps1" "$PROJECT/uninstall.bat" "$PROJECT/stop-handlers.ps1" "$PROJECT/stop-handlers.bat" "$PROJECT/diagnose.ps1" "$PROJECT/diagnose.bat" "$PROJECT/test-com.ps1" "$PROJECT/test-com.bat" "$PROJECT/README.txt" "$STAGE/"

(
  cd "$STAGE"
  zip -r "$RELEASES/$ZIP_NAME" .
)

mkdir -p "$ROOT/wwwroot/downloads"
cp "$RELEASES/$ZIP_NAME" "$ROOT/wwwroot/downloads/$ZIP_NAME"

echo "Built $RELEASES/$ZIP_NAME"
echo "Copied to wwwroot/downloads/$ZIP_NAME"
