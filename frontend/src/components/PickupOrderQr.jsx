import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import QRCode from 'qrcode';

/** QR на абсолютный URL страницы конкретного заказа. */
export default function PickupOrderQr({ value, size = 168 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const text = String(value || '').trim();
    if (!text) {
      setSrc('');
      return undefined;
    }

    QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return null;

  return (
    <Box
      component="img"
      src={src}
      alt=""
      width={size}
      height={size}
      sx={{
        display: 'block',
        mx: 'auto',
        borderRadius: 1,
        bgcolor: 'common.white'
      }}
    />
  );
}

export function buildOrderPageUrl(token, pickupCode) {
  const url = new URL(`/t/${token}`, window.location.origin);
  const code = String(pickupCode || '').trim();
  if (code) url.searchParams.set('c', code);
  return url.toString();
}
