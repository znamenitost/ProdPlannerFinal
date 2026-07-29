import { Box, Typography } from '@mui/material';
import { GALLERY_FRAME_SX, PRODUCT_IMAGE_SX, galleryContentSx } from './galleryFrame';

export default function ProductGallery({ mainImageUrl, caption, padded = false }) {
  return (
    <Box>
      <Box sx={GALLERY_FRAME_SX}>
        <Box sx={galleryContentSx(padded)}>
          {mainImageUrl ? (
            <Box component="img" src={mainImageUrl} alt="" sx={PRODUCT_IMAGE_SX} />
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Нет изображения
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
}
