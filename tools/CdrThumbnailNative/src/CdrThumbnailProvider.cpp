#include "CdrThumbnailProvider.h"

IFACEMETHODIMP CdrThumbnailProvider::Initialize(IStream* stream, DWORD /*grfMode*/) {
    if (!stream) {
        return E_INVALIDARG;
    }

    stream_ = stream;
    cachedBytes_ = ReadAllBytesFromStream(stream);
    return cachedBytes_.empty() ? E_FAIL : S_OK;
}

IFACEMETHODIMP CdrThumbnailProvider::GetThumbnail(UINT cx, HBITMAP* phbmp, WTS_ALPHATYPE* pdwAlpha) {
    if (!phbmp || !pdwAlpha || cx == 0) {
        return E_INVALIDARG;
    }

    *phbmp = nullptr;
    *pdwAlpha = WTSAT_UNKNOWN;

    if (cachedBytes_.empty() && stream_) {
        cachedBytes_ = ReadAllBytesFromStream(stream_.Get());
    }

    const auto imageBytes = ExtractPreviewImageBytes(cachedBytes_);
    if (!imageBytes || imageBytes->empty()) {
        return E_FAIL;
    }

    return DecodeImageToHBitmap(imageBytes->data(), imageBytes->size(), cx, phbmp, pdwAlpha);
}

CoCreatableClass(CdrThumbnailProvider);
