#include "Register.h"
#include "Guid.h"

#include <strsafe.h>

namespace {

constexpr wchar_t kApprovedKey[] =
    L"Software\\Microsoft\\Windows\\CurrentVersion\\Shell Extensions\\Approved";
constexpr wchar_t kHandlerName[] = L"CDR Native Thumbnail";

HRESULT SetKeyDefaultValue(HKEY root, const wchar_t* subKey, const wchar_t* value) {
    HKEY key = nullptr;
    LONG result = RegCreateKeyExW(root, subKey, 0, nullptr, 0, KEY_WRITE, nullptr, &key, nullptr);
    if (result != ERROR_SUCCESS) {
        return HRESULT_FROM_WIN32(result);
    }

    const DWORD size = static_cast<DWORD>((wcslen(value) + 1) * sizeof(wchar_t));
    result = RegSetValueExW(key, nullptr, 0, REG_SZ, reinterpret_cast<const BYTE*>(value), size);
    RegCloseKey(key);
    return result == ERROR_SUCCESS ? S_OK : HRESULT_FROM_WIN32(result);
}

HRESULT RegisterThumbnailAssociation(const wchar_t* classKey) {
    wchar_t subKey[512]{};
    StringCchPrintfW(subKey, ARRAYSIZE(subKey),
                     L"%s\\ShellEx\\{E357FCCD-A995-4576-B01F-234630154E96}", classKey);
    return SetKeyDefaultValue(HKEY_CLASSES_ROOT, subKey, L"{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}");
}

} // namespace

HRESULT RegisterThumbnailHandler(HMODULE module) {
    wchar_t modulePath[MAX_PATH]{};
    if (!GetModuleFileNameW(module, modulePath, ARRAYSIZE(modulePath))) {
        return HRESULT_FROM_WIN32(GetLastError());
    }

    wchar_t clsidKey[256]{};
    StringCchPrintfW(clsidKey, ARRAYSIZE(clsidKey),
                       L"CLSID\\{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}");
    RETURN_IF_FAILED(SetKeyDefaultValue(HKEY_CLASSES_ROOT, clsidKey, kHandlerName));

    wchar_t inprocKey[256]{};
    StringCchPrintfW(inprocKey, ARRAYSIZE(inprocKey), L"%s\\InprocServer32", clsidKey);
    RETURN_IF_FAILED(SetKeyDefaultValue(HKEY_CLASSES_ROOT, inprocKey, modulePath));

    HKEY inproc = nullptr;
    if (RegOpenKeyExW(HKEY_CLASSES_ROOT, inprocKey, 0, KEY_SET_VALUE, &inproc) == ERROR_SUCCESS) {
        const wchar_t apartment[] = L"Apartment";
        RegSetValueExW(inproc, L"ThreadingModel", 0, REG_SZ,
                       reinterpret_cast<const BYTE*>(apartment),
                       static_cast<DWORD>(sizeof(apartment)));
        RegCloseKey(inproc);
    }

    HKEY approved = nullptr;
    if (RegCreateKeyExW(HKEY_LOCAL_MACHINE, kApprovedKey, 0, nullptr, 0, KEY_WRITE, nullptr, &approved,
                        nullptr) == ERROR_SUCCESS) {
        const wchar_t clsid[] = L"{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}";
        RegSetValueExW(approved, clsid, 0, REG_SZ, reinterpret_cast<const BYTE*>(kHandlerName),
                       static_cast<DWORD>((wcslen(kHandlerName) + 1) * sizeof(wchar_t)));
        RegCloseKey(approved);
    }

    RETURN_IF_FAILED(RegisterThumbnailAssociation(L".cdr"));
    RETURN_IF_FAILED(RegisterThumbnailAssociation(L"SystemFileAssociations\\.cdr"));
    RETURN_IF_FAILED(RegisterThumbnailAssociation(L"cdr.1"));
    return S_OK;
}

HRESULT UnregisterThumbnailHandler() {
    RegDeleteTreeW(HKEY_CLASSES_ROOT, L"CLSID\\{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}");
    RegDeleteKeyW(HKEY_CLASSES_ROOT, L".cdr\\ShellEx\\{E357FCCD-A995-4576-B01F-234630154E96}");
    RegDeleteKeyW(HKEY_CLASSES_ROOT, L"SystemFileAssociations\\.cdr\\ShellEx\\{E357FCCD-A995-4576-B01F-234630154E96}");
    RegDeleteKeyW(HKEY_CLASSES_ROOT, L"cdr.1\\ShellEx\\{E357FCCD-A995-4576-B01F-234630154E96}");
    RegDeleteKeyW(HKEY_LOCAL_MACHINE, L"Software\\Microsoft\\Windows\\CurrentVersion\\Shell Extensions\\Approved\\{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}");
    return S_OK;
}
