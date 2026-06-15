#include "pch.h"

#include "Register.h"

#include <wrl/module.h>

HMODULE g_hModule = nullptr;

BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID /*reserved*/) {
    switch (reason) {
    case DLL_PROCESS_ATTACH:
        g_hModule = hModule;
        DisableThreadLibraryCalls(hModule);
        break;
    case DLL_PROCESS_DETACH:
        break;
    }
    return TRUE;
}

STDAPI DllCanUnloadNow() {
    return Microsoft::WRL::Module<Microsoft::WRL::InProc>::GetModule().Terminate ? S_OK : S_FALSE;
}

STDAPI DllGetClassObject(REFCLSID rclsid, REFIID riid, void** ppv) {
    return Microsoft::WRL::Module<Microsoft::WRL::InProc>::GetModule().GetClassObject(rclsid, riid, ppv);
}

STDAPI DllRegisterServer() {
    return RegisterThumbnailHandler(g_hModule);
}

STDAPI DllUnregisterServer() {
    return UnregisterThumbnailHandler();
}
