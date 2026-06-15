#pragma once

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <wincodec.h>
#include <shlwapi.h>
#include <thumbcache.h>
#include <propvarutil.h>
#include <objbase.h>
#include <comdef.h>

#include <algorithm>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#pragma comment(lib, "windowscodecs.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "uuid.lib")

#ifndef RETURN_IF_FAILED
#define RETURN_IF_FAILED(hr) \
    do { \
        const HRESULT _hr = (hr); \
        if (FAILED(_hr)) { \
            return _hr; \
        } \
    } while (0)
#endif
