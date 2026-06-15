#pragma once

#include "pch.h"

HRESULT DecodeImageToHBitmap(
    const uint8_t* data,
    size_t size,
    UINT maxSize,
    HBITMAP* outBitmap,
    WTS_ALPHATYPE* outAlpha);
