#include "CdrPreviewExtractor.h"

#include "../third_party/miniz.h"

#include <cstring>

namespace {

bool MatchEntryName(const char* name, const char* pattern) {
    if (!name || !pattern) {
        return false;
    }

    std::string n(name);
    for (auto& ch : n) {
        if (ch == '\\') {
            ch = '/';
        }
    }

    const std::string p(pattern);
    if (p.find('*') != std::string::npos) {
        const auto pos = p.find('*');
        const std::string prefix = p.substr(0, pos);
        const std::string suffix = p.substr(pos + 1);
        if (n.size() < prefix.size() + suffix.size()) {
            return false;
        }
        if (n.compare(0, prefix.size(), prefix) != 0) {
            return false;
        }
        return n.compare(n.size() - suffix.size(), suffix.size(), suffix) == 0;
    }

    return _stricmp(n.c_str(), p.c_str()) == 0;
}

const char* kZipEntryPatterns[] = {
    "previews/thumbnail.png",
    "metadata/thumbnails/thumbnail.bmp",
    "previews/thumbnail.bmp",
    "metadata/thumbnails/thumbnail.png",
    "previews/page1.png",
    "metadata/thumbnails/page1.bmp",
    "*thumbnail*.png",
    "*thumbnail*.bmp",
    "*thumbnail*.jpg",
    "*thumbnail*.jpeg",
};

std::optional<std::vector<uint8_t>> FromZip(const std::vector<uint8_t>& bytes) {
    if (bytes.size() < 4 || bytes[0] != 0x50 || bytes[1] != 0x4B) {
        return std::nullopt;
    }

    mz_zip_archive zip{};
    if (!mz_zip_reader_init_mem(&zip, bytes.data(), bytes.size(), 0)) {
        return std::nullopt;
    }

    std::optional<std::vector<uint8_t>> result;
    const int count = static_cast<int>(mz_zip_reader_get_num_files(&zip));
    for (const char* pattern : kZipEntryPatterns) {
        for (int i = 0; i < count; ++i) {
            char filename[512]{};
            if (!mz_zip_reader_get_filename(&zip, i, filename, sizeof(filename))) {
                continue;
            }
            if (!MatchEntryName(filename, pattern)) {
                continue;
            }

            size_t uncompSize = 0;
            void* heap = mz_zip_reader_extract_to_heap(&zip, i, &uncompSize, 0);
            if (!heap || uncompSize < 100) {
                mz_free(heap);
                continue;
            }

            std::vector<uint8_t> data(uncompSize);
            memcpy(data.data(), heap, uncompSize);
            mz_free(heap);
            result = std::move(data);
            break;
        }
        if (result) {
            break;
        }
    }

    mz_zip_reader_end(&zip);
    return result;
}

std::optional<std::vector<uint8_t>> ExtractFromDisp(const std::vector<uint8_t>& bytes) {
    if (bytes.size() < 12) {
        return std::nullopt;
    }
    if (!(bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F')) {
        return std::nullopt;
    }

    size_t offset = 12;
    while (offset + 8 <= bytes.size()) {
        char id[5]{};
        memcpy(id, bytes.data() + offset, 4);
        const uint32_t size = *reinterpret_cast<const uint32_t*>(bytes.data() + offset + 4);
        const size_t dataStart = offset + 8;
        const size_t dataEnd = dataStart + size;

        if (strcmp(id, "DISP") == 0 && dataEnd <= bytes.size() && size > 44) {
            const int w = static_cast<int>(*reinterpret_cast<const uint32_t*>(bytes.data() + dataStart + 8));
            const int h = static_cast<int>(*reinterpret_cast<const uint32_t*>(bytes.data() + dataStart + 12));
            const size_t paletteStart = dataStart + 8 + 4 + 4 + 28;
            const size_t pixelsStart = paletteStart + 1024;

            if (w > 0 && h > 0 && w < 4096 && h < 4096 &&
                pixelsStart + static_cast<size_t>(w) * static_cast<size_t>(h) <= dataEnd) {
                // Build 32bpp BMP in memory for WIC.
                const uint32_t rowSize = ((static_cast<uint32_t>(w) * 3 + 3) / 4) * 4;
                const uint32_t pixelDataSize = rowSize * static_cast<uint32_t>(h);
                const uint32_t fileSize = 14 + 40 + pixelDataSize;
                std::vector<uint8_t> bmp(fileSize);
                auto* header = bmp.data();
                header[0] = 'B';
                header[1] = 'M';
                *reinterpret_cast<uint32_t*>(header + 2) = fileSize;
                *reinterpret_cast<uint32_t*>(header + 10) = 14 + 40;
                *reinterpret_cast<uint32_t*>(header + 14) = 40;
                *reinterpret_cast<int32_t*>(header + 18) = w;
                *reinterpret_cast<int32_t*>(header + 22) = -h;
                *reinterpret_cast<uint16_t*>(header + 26) = 1;
                *reinterpret_cast<uint16_t*>(header + 28) = 24;
                *reinterpret_cast<uint32_t*>(header + 34) = pixelDataSize;

                uint8_t* dst = bmp.data() + 54;
                for (int y = 0; y < h; ++y) {
                    for (int x = 0; x < w; ++x) {
                        const size_t p = static_cast<size_t>(y) * static_cast<size_t>(w) + static_cast<size_t>(x);
                        const uint8_t idx = bytes[pixelsStart + p];
                        const size_t pal = paletteStart + static_cast<size_t>(idx) * 4;
                        dst[x * 3 + 0] = bytes[pal + 0];
                        dst[x * 3 + 1] = bytes[pal + 1];
                        dst[x * 3 + 2] = bytes[pal + 2];
                    }
                    dst += rowSize;
                }

                return bmp;
            }
        }

        offset = dataEnd + (size % 2);
        if (offset <= 12) {
            break;
        }
    }

    return std::nullopt;
}

std::optional<std::vector<uint8_t>> FindBmpInBuffer(const std::vector<uint8_t>& bytes, size_t maxScan) {
    const size_t limit = std::min(maxScan, bytes.size());
    for (size_t i = 0; i + 6 < limit; ++i) {
        if (bytes[i] == 0x42 && bytes[i + 1] == 0x4D) {
            const int32_t size = *reinterpret_cast<const int32_t*>(bytes.data() + i + 2);
            if (size > 1000 && size < static_cast<int32_t>(bytes.size() - i)) {
                return std::vector<uint8_t>(bytes.begin() + static_cast<std::ptrdiff_t>(i),
                                            bytes.begin() + static_cast<std::ptrdiff_t>(i + size));
            }
        }
    }
    return std::nullopt;
}

} // namespace

std::vector<uint8_t> ReadAllBytesFromStream(IStream* stream) {
    std::vector<uint8_t> bytes;
    if (!stream) {
        return bytes;
    }

    STATSTG stat{};
    if (SUCCEEDED(stream->Stat(&stat, STATFLAG_NONAME)) && stat.cbSize.QuadPart > 0) {
        bytes.resize(static_cast<size_t>(stat.cbSize.QuadPart));
        LARGE_INTEGER zero{};
        stream->Seek(zero, STREAM_SEEK_SET, nullptr);
        ULONG read = 0;
        if (SUCCEEDED(stream->Read(bytes.data(), static_cast<ULONG>(bytes.size()), &read))) {
            bytes.resize(read);
            return bytes;
        }
        bytes.clear();
    }

    LARGE_INTEGER zero{};
    stream->Seek(zero, STREAM_SEEK_SET, nullptr);
    uint8_t buffer[65536];
    ULONG read = 0;
    while (SUCCEEDED(stream->Read(buffer, sizeof(buffer), &read)) && read > 0) {
        bytes.insert(bytes.end(), buffer, buffer + read);
    }
    return bytes;
}

std::optional<std::vector<uint8_t>> ExtractPreviewImageBytes(const std::vector<uint8_t>& fileBytes) {
    if (fileBytes.size() < 4) {
        return std::nullopt;
    }

    if (fileBytes[0] == 0x50 && fileBytes[1] == 0x4B) {
        if (auto zip = FromZip(fileBytes)) {
            return zip;
        }
    }

    if (fileBytes[0] == 'R' && fileBytes[1] == 'I' && fileBytes[2] == 'F' && fileBytes[3] == 'F') {
        if (auto disp = ExtractFromDisp(fileBytes)) {
            return disp;
        }
        if (auto bmp = FindBmpInBuffer(fileBytes, 256 * 1024)) {
            return bmp;
        }
    } else if (auto bmp = FindBmpInBuffer(fileBytes, 256 * 1024)) {
        return bmp;
    }

    return std::nullopt;
}
