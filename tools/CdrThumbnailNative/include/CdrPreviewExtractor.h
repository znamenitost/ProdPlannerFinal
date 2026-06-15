#pragma once

#include "pch.h"

// Returns PNG/BMP/DISP image bytes ready for WIC decode.
std::optional<std::vector<uint8_t>> ExtractPreviewImageBytes(const std::vector<uint8_t>& fileBytes);

std::vector<uint8_t> ReadAllBytesFromStream(IStream* stream);
