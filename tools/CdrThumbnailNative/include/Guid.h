#pragma once

#include <guiddef.h>

// {3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}
#ifdef INITGUID
DEFINE_GUID(CLSID_CdrThumbnailNative,
    0x3f8a2c1d, 0x4e5b, 0x6a7c, 0x8d, 0x9e, 0x0f, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e);
#else
extern "C" const GUID CLSID_CdrThumbnailNative;
#endif

// {E357FCCD-A995-4576-B01F-234630154E96}
#ifdef INITGUID
DEFINE_GUID(CLSID_ShellThumbnailHandler,
    0xe357fccd, 0xa995, 0x4576, 0xb0, 0x1f, 0x23, 0x46, 0x30, 0x15, 0x4e, 0x96);
#else
extern "C" const GUID CLSID_ShellThumbnailHandler;
#endif
