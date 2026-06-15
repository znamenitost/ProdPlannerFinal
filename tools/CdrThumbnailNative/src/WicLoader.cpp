#include "WicLoader.h"

namespace {

class MemoryStream final : public IStream {
public:
    explicit MemoryStream(const uint8_t* data, size_t size)
        : refCount_(1), data_(data), size_(size), position_(0) {}

    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv) override {
        if (!ppv) {
            return E_POINTER;
        }
        if (riid == IID_IUnknown || riid == IID_IStream || riid == IID_ISequentialStream) {
            *ppv = static_cast<IStream*>(this);
            AddRef();
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }

    IFACEMETHODIMP_(ULONG) AddRef() override { return ++refCount_; }
    IFACEMETHODIMP_(ULONG) Release() override {
        const ULONG count = --refCount_;
        if (count == 0) {
            delete this;
        }
        return count;
    }

    IFACEMETHODIMP Read(void* pv, ULONG cb, ULONG* pcbRead) override {
        if (!pv) {
            return STG_E_INVALIDPOINTER;
        }
        const size_t available = size_ > position_ ? size_ - position_ : 0;
        const size_t toRead = std::min(static_cast<size_t>(cb), available);
        if (toRead > 0) {
            memcpy(pv, data_ + position_, toRead);
            position_ += toRead;
        }
        if (pcbRead) {
            *pcbRead = static_cast<ULONG>(toRead);
        }
        return S_OK;
    }

    IFACEMETHODIMP Write(const void*, ULONG, ULONG*) override { return E_NOTIMPL; }
    IFACEMETHODIMP Seek(LARGE_INTEGER dlibMove, DWORD dwOrigin, ULARGE_INTEGER* plibNewPosition) override {
        size_t newPos = 0;
        switch (dwOrigin) {
        case STREAM_SEEK_SET:
            newPos = static_cast<size_t>(dlibMove.QuadPart);
            break;
        case STREAM_SEEK_CUR:
            newPos = position_ + static_cast<size_t>(dlibMove.QuadPart);
            break;
        case STREAM_SEEK_END:
            newPos = size_ + static_cast<size_t>(dlibMove.QuadPart);
            break;
        default:
            return STG_E_INVALIDFUNCTION;
        }
        if (newPos > size_) {
            return STG_E_INVALIDFUNCTION;
        }
        position_ = newPos;
        if (plibNewPosition) {
            plibNewPosition->QuadPart = position_;
        }
        return S_OK;
    }

    IFACEMETHODIMP SetSize(ULARGE_INTEGER) override { return E_NOTIMPL; }
    IFACEMETHODIMP CopyTo(IStream*, ULARGE_INTEGER, ULARGE_INTEGER*, ULARGE_INTEGER*) override { return E_NOTIMPL; }
    IFACEMETHODIMP Commit(DWORD) override { return S_OK; }
    IFACEMETHODIMP Revert() override { return E_NOTIMPL; }
    IFACEMETHODIMP LockRegion(ULARGE_INTEGER, ULARGE_INTEGER, DWORD) override { return E_NOTIMPL; }
    IFACEMETHODIMP UnlockRegion(ULARGE_INTEGER, ULARGE_INTEGER, DWORD) override { return E_NOTIMPL; }
    IFACEMETHODIMP Stat(STATSTG* pstatstg, DWORD grfStatFlag) override {
        if (!pstatstg) {
            return STG_E_INVALIDPOINTER;
        }
        ZeroMemory(pstatstg, sizeof(STATSTG));
        pstatstg->type = STGTY_STREAM;
        pstatstg->cbSize.QuadPart = size_;
        if ((grfStatFlag & STATFLAG_NONAME) == 0) {
            return STG_E_INSUFFICIENTMEMORY;
        }
        return S_OK;
    }
    IFACEMETHODIMP Clone(IStream**) override { return E_NOTIMPL; }

private:
    ULONG refCount_;
    const uint8_t* data_;
    size_t size_;
    size_t position_;
};

HRESULT CreateScaled32bppSource(IWICImagingFactory* factory, IWICBitmapSource* source, UINT maxSize,
                                IWICBitmapSource** outSource) {
    *outSource = nullptr;
    UINT width = 0;
    UINT height = 0;
    if (FAILED(source->GetSize(&width, &height)) || width == 0 || height == 0) {
        return E_FAIL;
    }

    double scale = 1.0;
    if (width > maxSize || height > maxSize) {
        scale = std::min(static_cast<double>(maxSize) / width, static_cast<double>(maxSize) / height);
    }
    const UINT targetW = std::max(1u, static_cast<UINT>(width * scale));
    const UINT targetH = std::max(1u, static_cast<UINT>(height * scale));

    IWICBitmapScaler* scaler = nullptr;
    HRESULT hr = factory->CreateBitmapScaler(&scaler);
    if (SUCCEEDED(hr)) {
        hr = scaler->Initialize(source, targetW, targetH, WICBitmapInterpolationModeHighQualityCubic);
    }

    IWICFormatConverter* converter = nullptr;
    if (SUCCEEDED(hr)) {
        hr = factory->CreateFormatConverter(&converter);
    }
    if (SUCCEEDED(hr)) {
        hr = converter->Initialize(scaler, GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone,
                                   nullptr, 0.0, WICBitmapPaletteTypeCustom);
    }
    if (SUCCEEDED(hr)) {
        *outSource = converter;
        (*outSource)->AddRef();
    }

    if (converter) {
        converter->Release();
    }
    if (scaler) {
        scaler->Release();
    }
    return hr;
}

HRESULT WicSourceToHBitmap(IWICBitmapSource* source, HBITMAP* outBitmap) {
    UINT width = 0;
    UINT height = 0;
    if (FAILED(source->GetSize(&width, &height)) || width == 0 || height == 0) {
        return E_FAIL;
    }

    const UINT stride = width * 4;
    const UINT bufSize = stride * height;
    std::vector<uint8_t> pixels(bufSize);
    WICRect rect{0, 0, static_cast<INT>(width), static_cast<INT>(height)};
    HRESULT hr = source->CopyPixels(&rect, stride, bufSize, pixels.data());
    if (FAILED(hr)) {
        return hr;
    }

    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = static_cast<LONG>(width);
    bmi.bmiHeader.biHeight = -static_cast<LONG>(height);
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    void* bits = nullptr;
    HBITMAP hbmp = CreateDIBSection(nullptr, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (!hbmp || !bits) {
        return E_OUTOFMEMORY;
    }

    memcpy(bits, pixels.data(), bufSize);
    *outBitmap = hbmp;
    return S_OK;
}

} // namespace

HRESULT DecodeImageToHBitmap(
    const uint8_t* data,
    size_t size,
    UINT maxSize,
    HBITMAP* outBitmap,
    WTS_ALPHATYPE* outAlpha) {
    if (!data || size == 0 || !outBitmap || !outAlpha) {
        return E_INVALIDARG;
    }

    *outBitmap = nullptr;
    *outAlpha = WTSAT_ARGB;

    MemoryStream* memStream = new MemoryStream(data, size);
    IWICImagingFactory* factory = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
                                  IID_PPV_ARGS(&factory));
    if (FAILED(hr)) {
        memStream->Release();
        return hr;
    }

    IWICBitmapDecoder* decoder = nullptr;
    hr = factory->CreateDecoderFromStream(memStream, nullptr, WICDecodeMetadataCacheOnLoad, &decoder);
    memStream->Release();
    if (FAILED(hr)) {
        factory->Release();
        return hr;
    }

    IWICBitmapFrameDecode* frame = nullptr;
    hr = decoder->GetFrame(0, &frame);
    decoder->Release();
    if (FAILED(hr)) {
        factory->Release();
        return hr;
    }

    IWICBitmapSource* scaledSource = nullptr;
    hr = CreateScaled32bppSource(factory, frame, maxSize, &scaledSource);
    frame->Release();
    factory->Release();
    if (FAILED(hr)) {
        return hr;
    }

    hr = WicSourceToHBitmap(scaledSource, outBitmap);
    scaledSource->Release();
    return hr;
}
