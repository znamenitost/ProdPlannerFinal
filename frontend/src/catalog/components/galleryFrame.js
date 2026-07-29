/** Gallery square — primary media column. */
export const GALLERY_MAX_PX = 520;

/** Inner inset for artwork / mockup so the keychain sits smaller in the frame. */
export const GALLERY_INSET_PX = 48;

export const GALLERY_FRAME_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  bgcolor: 'background.paper',
  overflow: 'hidden',
  aspectRatio: '1',
  position: 'relative',
  width: '100%',
  maxWidth: GALLERY_MAX_PX
};

/** Content area inside the frame; optional inset for layout tabs. */
export const galleryContentSx = (padded = false) => ({
  position: 'absolute',
  inset: padded ? GALLERY_INSET_PX : 0
});

/**
 * Mockup-only: budl.svg viewBox letterboxed so artwork zone % align
 * with the print contour. Do not use for product photos.
 */
export const PRODUCT_STAGE_SX = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  height: '100%',
  aspectRatio: '763.35 / 1613.26',
  maxWidth: '100%'
};

/** Fills its parent; scales to fit while keeping aspect ratio. */
export const PRODUCT_IMAGE_SX = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center',
  display: 'block'
};
