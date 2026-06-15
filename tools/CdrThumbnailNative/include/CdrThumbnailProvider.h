#pragma once

#include "CdrPreviewExtractor.h"
#include "WicLoader.h"
#include "Guid.h"

#include <wrl/module.h>
#include <wrl/implements.h>

class CdrThumbnailProvider final
    : public Microsoft::WRL::RuntimeClass<
          Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,
          IInitializeWithStream,
          IThumbnailProvider> {
public:
    IFACEMETHODIMP Initialize(IStream* stream, DWORD grfMode);
    IFACEMETHODIMP GetThumbnail(UINT cx, HBITMAP* phbmp, WTS_ALPHATYPE* pdwAlpha);

private:
    Microsoft::WRL::ComPtr<IStream> stream_;
    std::vector<uint8_t> cachedBytes_;
};
