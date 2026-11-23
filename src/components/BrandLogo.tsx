import React, { useEffect, useState } from 'react';
import {
  getCachedTransparentLogoDataUri,
  getTransparentLogoDataUri,
} from '../utils/logoTransparency';

export type BrandLogoResolution = 32 | 64 | 128 | 256;

export const BRAND_LOGO_ASSETS: Record<BrandLogoResolution, string> = {
  32: '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__1__93b00a1f.jpg',
  64: '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__1__93b00a1f.jpg',
  128: '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw_31b1850b.jpg',
  256: '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__2__e45572b5.jpg',
};

export const BRAND_LOGO_SRCSET = `${BRAND_LOGO_ASSETS[32]} 32w, ${BRAND_LOGO_ASSETS[64]} 64w, ${BRAND_LOGO_ASSETS[128]} 128w, ${BRAND_LOGO_ASSETS[256]} 256w`;

export const BRAND_LOGO_ALT = 'Axiom Aegis Brand Emblem';

interface BrandLogoProps {
  className?: string;
  size?: number;
  resolution?: BrandLogoResolution;
  primaryColor?: string;
  accentColor?: string;
  variant?: 'dark' | 'light' | 'monochrome';
  zoom?: number;
  alt?: string;
}

/**
 * BrandLogo renders the official Axiom Aegis shield emblem assets with the
 * dark blue background stripped to transparent alpha so only the Icon and
 * "AXIOM AEGIS" Words are visible.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'w-9 h-9',
  resolution = 128,
  zoom = 1,
  alt = BRAND_LOGO_ALT,
}) => {
  const rawSrc = BRAND_LOGO_ASSETS[resolution] || BRAND_LOGO_ASSETS[128];
  const [transparentSrc, setTransparentSrc] = useState<string>(
    () => getCachedTransparentLogoDataUri(rawSrc) || rawSrc
  );

  useEffect(() => {
    let active = true;
    const cached = getCachedTransparentLogoDataUri(rawSrc);
    if (cached) {
      setTransparentSrc(cached);
      return;
    }
    getTransparentLogoDataUri(rawSrc).then((processedUri) => {
      if (active) {
        setTransparentSrc(processedUri);
      }
    });
    return () => {
      active = false;
    };
  }, [rawSrc]);

  return (
    <span
      className={`${className} inline-flex items-center justify-center overflow-hidden select-none bg-transparent shrink-0`}
    >
      <img
        src={transparentSrc}
        alt={alt}
        data-testid="brand-logo-img"
        data-raw-src={rawSrc}
        data-resolution={resolution}
        data-zoom={zoom}
        style={{
          backgroundColor: 'transparent',
          ...(zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: 'center center' } : {}),
        }}
        className="w-full h-full object-contain select-none bg-transparent transition-transform duration-200"
        draggable={false}
      />
    </span>
  );
};
