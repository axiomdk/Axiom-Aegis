import { TabType } from '../types';

export const MOBILE_BREAKPOINT_PX = 768;
export const MOBILE_MIN_TOUCH_TARGET_PX = 44;
export const MOBILE_MIN_INPUT_FONT_PX = 16;
export const MAX_MOBILE_DEVICE_PIXEL_RATIO = 2;

export interface MobileNavItem {
  id: string;
  label: string;
  tab?: TabType;
  isDrawerToggle?: boolean;
}

export const MOBILE_BOTTOM_NAV_ITEMS: MobileNavItem[] = [
  { id: 'dashboard', label: 'Home', tab: 'dashboard' },
  { id: 'calendar', label: 'Calendar', tab: 'calendar' },
  { id: 'notes', label: 'Notes', tab: 'notes' },
  { id: 'funds', label: 'Funds', tab: 'funds' },
  { id: 'goals', label: 'Goals', tab: 'goals' },
  { id: 'menu', label: 'Menu', isDrawerToggle: true },
];

export function isMobileViewport(widthPx: number): boolean {
  return Number.isFinite(widthPx) && widthPx < MOBILE_BREAKPOINT_PX;
}

export function getMobileGridColumns(widthPx: number, desktopColumns: 2 | 3 | 4): number {
  if (isMobileViewport(widthPx)) {
    return 1;
  }
  return desktopColumns;
}

/**
 * Detects whether the application is running directly from the local filesystem (file:// protocol)
 */
export function isFileProtocol(protocol?: string): boolean {
  const resolved =
    protocol !== undefined
      ? protocol
      : typeof window !== 'undefined' && window.location
      ? window.location.protocol
      : '';
  return resolved.trim().toLowerCase() === 'file:';
}

/**
 * Determines whether the PWA Service Worker should be registered.
 * Cleanly bypasses registration on file:// protocol to prevent console/SecurityError exceptions.
 */
export function shouldRegisterServiceWorker(
  protocol?: string,
  hasServiceWorkerApi?: boolean
): boolean {
  const swAvailable =
    hasServiceWorkerApi !== undefined
      ? hasServiceWorkerApi
      : typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  if (!swAvailable) return false;
  if (isFileProtocol(protocol)) return false;
  return true;
}

/**
 * Caps canvas devicePixelRatio at 2x on high-DPI mobile screens to prevent GPU thermal throttling.
 */
export function getCappedDevicePixelRatio(rawDpr?: number): number {
  const dpr =
    rawDpr !== undefined
      ? rawDpr
      : typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
  return Math.min(Math.max(1, dpr || 1), MAX_MOBILE_DEVICE_PIXEL_RATIO);
}

/**
 * Pure lifecycle decision helper for pausing canvas requestAnimationFrame loops
 * when scrolled off-screen, when the browser tab is hidden, or when manually paused.
 */
export function shouldRunCanvasAnimation(state: {
  isIntersecting: boolean;
  isDocumentVisible: boolean;
  isPaused: boolean;
}): boolean {
  return Boolean(state.isIntersecting && state.isDocumentVisible && !state.isPaused);
}

export interface PwaMetaChecklist {
  hasViewportFitCover: boolean;
  hasAppleMobileWebAppCapable: boolean;
  hasMobileWebAppCapable: boolean;
  hasFlatBlackThemeColor: boolean;
  hasManifestLink: boolean;
}

export function verifyHtmlPwaMetaTags(htmlContent: string): PwaMetaChecklist {
  return {
    hasViewportFitCover:
      /name=["']viewport["'][^>]*content=["'][^"']*viewport-fit=cover/i.test(htmlContent),
    hasAppleMobileWebAppCapable:
      /name=["']apple-mobile-web-app-capable["'][^>]*content=["']yes["']/i.test(htmlContent),
    hasMobileWebAppCapable:
      /name=["']mobile-web-app-capable["'][^>]*content=["']yes["']/i.test(htmlContent),
    hasFlatBlackThemeColor:
      /name=["']theme-color["'][^>]*content=["']#000000["']/i.test(htmlContent),
    hasManifestLink: /rel=["']manifest["'][^>]*href=["']\/manifest\.json["']/i.test(htmlContent),
  };
}
