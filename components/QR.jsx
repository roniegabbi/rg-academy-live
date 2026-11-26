'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QR({ value, size = 600, className = '', style = {}, label = 'QR code para entrar no evento' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { margin: 1, width: size, errorCorrectionLevel: 'M', color: { dark: '#0B2238', light: '#FFFFFF' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value, size]);
  if (!src) return <div className={className} style={{ ...style, background: '#fff' }} aria-label={label} role="img" />;
  return <img src={src} alt={label} className={className} style={{ display: 'block', ...style }} />;
}

export function joinUrl(pin) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/p/${pin}`;
}
