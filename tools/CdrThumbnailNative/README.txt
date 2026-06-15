Native C++ IThumbnailProvider for .cdr files (Windows Explorer thumbnails).

Build (Windows, Visual Studio 2022 with C++ desktop workload):

    powershell -ExecutionPolicy Bypass -File ../../scripts/build-cdr-thumbnail-native.ps1

Output: bin/x64/Release/CdrThumbnailNative.dll (copied to ../CdrPreviewShell/).

CLSID: {3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}

The .NET CdrPreviewShell.dll handles only the preview pane; this DLL handles folder thumbnails.
