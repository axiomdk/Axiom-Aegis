import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { shouldRegisterServiceWorker } from './utils/mobilePwaEngine';
import { ensureRuntimeEmblemAppIcons } from './utils/downloadApp';
import { APP_VERSION } from './utils/version';

// Suppress benign browser ResizeObserver loop notification events
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (
      event &&
      typeof event.message === 'string' &&
      event.message.includes('ResizeObserver')
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

// Ensure standalone file:// mode always has crisp PNG data URI app icons from the built-in Brand Emblem
ensureRuntimeEmblemAppIcons();

const ACTIVE_SW_CACHE_NAME = `axiom-aegis-pwa-${APP_VERSION}`;

// Purge any legacy Service Worker or Workbox caches so stale bundles never persist
if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
  window.caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (
            (key.startsWith('axiom-aegis-pwa-') || key.startsWith('workbox-')) &&
            key !== ACTIVE_SW_CACHE_NAME
          ) {
            return window.caches.delete(key);
          }
          return Promise.resolve(false);
        })
      )
    )
    .catch(() => {});
}

// Register Offline-Ready PWA Service Worker when served over http/https (cleanly bypassed on file:// or single-file index.html)
if (
  typeof window !== 'undefined' &&
  !(window as unknown as { __AXIOM_SINGLEFILE__?: boolean }).__AXIOM_SINGLEFILE__ &&
  shouldRegisterServiceWorker(window.location.protocol, 'serviceWorker' in navigator)
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Non-fatal in preview or restricted origins
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
