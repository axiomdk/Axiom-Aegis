import { APP_VERSION, sanitizeLegacyVersionStrings } from './version';
import { isFileProtocol } from './mobilePwaEngine';

export function getVersionFileSlug(): string {
  return APP_VERSION.trim().replace(/\s+/g, '-');
}

export const PORTABLE_STORAGE_KEYS = [
  'axioms_dailies_state',
  'axiom_dailies_encrypted_vault',
  'axioms_dailies_vault',
  'axioms_dailies_layout_v2',
  'axioms_dailies_theme',
  'axioms_dailies_custom_accent',
  'axioms_dailies_text_color',
  'axiom_accounts_registry_v1',
  'axiom_local_accounts_cache_v1',
  '__axiom_sync_origin__',
];

export const SEED_START_MARKER = '<' + '!--AXIOM_PORTABLE_SEED_START--' + '>';
export const SEED_END_MARKER = '<' + '!--AXIOM_PORTABLE_SEED_END--' + '>';

/**
 * Escapes HTML-sensitive characters (<, >, &, U+2028, U+2029) inside a JSON string
 * so arbitrary user note content (e.g. "</SCRIPT>", "<!--", "<script>") can never
 * break out of an inline <script> tag when generating a Portable HTML executable.
 */
export function escapeJsonForHtmlScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Collects the user's workspace data and backend sync origin for portable export.
 * CRITICAL: Active authentication session tokens and unlocked session keys are NEVER
 * included in the export so that opening the HTML strictly forces the user to log in.
 */
export function collectLiveVaultStorageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  if (typeof window === 'undefined' || !window.localStorage) {
    return snapshot;
  }
  try {
    for (const key of PORTABLE_STORAGE_KEYS) {
      const val = window.localStorage.getItem(key);
      if (val !== null) {
        snapshot[key] = val;
      }
    }
    if (
      window.location &&
      typeof window.location.origin === 'string' &&
      /^https?:\/\//i.test(window.location.origin)
    ) {
      snapshot['__axiom_sync_origin__'] = window.location.origin;
    }
  } catch (err) {
    console.warn('Could not read localStorage for portable snapshot:', err);
  }
  return snapshot;
}

/**
 * Reads embedded vault snapshot from `<script id="axiom-embedded-vault">` in the document.
 */
export function readEmbeddedVaultSnapshot(): Record<string, string> | null {
  if (typeof document === 'undefined') return null;
  try {
    const el =
      document.getElementById('axiom-embedded-vault') ||
      document.getElementById('axiom-portable-state-seed');
    if (!el) return null;
    const text = el.textContent || '';
    if (!text.trim()) return null;
    if (text.trim().startsWith('{')) {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
    const seedMatch = text.match(/var\s+seed\s*=\s*(\{[\s\S]*?\});/);
    if (seedMatch && seedMatch[1]) {
      return JSON.parse(seedMatch[1]) as Record<string, string>;
    }
  } catch (err) {
    console.warn('Could not parse embedded vault snapshot:', err);
  }
  return null;
}

export function buildPortableSeedScript(customSnapshot?: Record<string, string>): string {
  const rawSnapshot = customSnapshot || collectLiveVaultStorageSnapshot();
  const snapshot: Record<string, string> = {};
  for (const k of Object.keys(rawSnapshot)) {
    if (
      k === 'axiom_account_session_v1' ||
      k === 'axiom_session_vault_key' ||
      k === 'axiom_unified_account_v1' ||
      k === 'axiom_remembered_device_key_v1' ||
      k === 'axiom_active_encryption_key_hex'
    ) {
      continue;
    }
    snapshot[k] = rawSnapshot[k];
  }
  const serialized = escapeJsonForHtmlScript(JSON.stringify(snapshot));

  const jsonTag =
    '<' + 'script id="axiom-embedded-vault" type="application/json">' + serialized + '<' + '/script>';
  const seedTag =
    '<' +
    'script id="axiom-portable-state-seed">\n' +
    '(function() {\n' +
    '  try {\n' +
    '    var seed = ' +
    serialized +
    ';\n' +
    '    if (seed["__axiom_sync_origin__"]) {\n' +
    '      window.__AXIOM_SYNC_ORIGIN__ = seed["__axiom_sync_origin__"];\n' +
    '    }\n' +
    '    var keys = Object.keys(seed);\n' +
    '    for (var i = 0; i < keys.length; i++) {\n' +
    '      var k = keys[i];\n' +
    '      if (k === "axiom_account_session_v1" || k === "axiom_session_vault_key" || k === "axiom_unified_account_v1") continue;\n' +
    '      window.localStorage.setItem(k, seed[k]);\n' +
    '    }\n' +
    '  } catch (e) {\n' +
    '    console.warn("Portable state seed skipped:", e);\n' +
    '  }\n' +
    '})();\n' +
    '<' +
    '/script>';

  return [SEED_START_MARKER, jsonTag, seedTag, SEED_END_MARKER].join('\n');
}

export function injectPortableSeedIntoHtml(
  rawHtml: string,
  includeCurrentData: boolean,
  customSnapshot?: Record<string, string>
): string {
  let htmlText = rawHtml;

  // 1. Safely strip any previous seed block between SEED_START_MARKER and SEED_END_MARKER
  const headCloseIdx = htmlText.indexOf('</head>');
  const startIdx = htmlText.indexOf(SEED_START_MARKER);
  const endIdx = htmlText.indexOf(SEED_END_MARKER);
  if (
    startIdx !== -1 &&
    endIdx !== -1 &&
    endIdx > startIdx &&
    (headCloseIdx === -1 || endIdx < headCloseIdx)
  ) {
    htmlText =
      htmlText.slice(0, startIdx) +
      htmlText.slice(endIdx + SEED_END_MARKER.length);
  }

  // 2. Also strip any standalone #axiom-embedded-vault or #axiom-portable-state-seed script tags
  // strictly inside <head> (never touching the main body bundle)
  const currentHeadEnd = htmlText.indexOf('</head>');
  if (currentHeadEnd !== -1) {
    let headSlice = htmlText.slice(0, currentHeadEnd);
    headSlice = headSlice.replace(
      /<script\b[^<>]*\bid=["']axiom-embedded-vault["'][^<>]*>[\s\S]*?<\/script>\s*/gi,
      ''
    );
    headSlice = headSlice.replace(
      /<script\b[^<>]*\bid=["']axiom-portable-state-seed["'][^<>]*>[\s\S]*?<\/script>\s*/gi,
      ''
    );
    htmlText = headSlice + htmlText.slice(currentHeadEnd);
  }

  // 3. Clear any pre-rendered DOM inside <div id="root"> so the HTML bundle starts in an empty container
  htmlText = htmlText.replace(
    /<div\b[^<>]*\bid=["']root["'][^<>]*>[\s\S]*?<\/div>/i,
    '<div id="root"></div>'
  );

  // 4. Scrub any legacy v1.x.x BETA/ALPHA strings and normalize title & singlefile runtime flag
  htmlText = sanitizeLegacyVersionStrings(htmlText);
  htmlText = htmlText.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>Axiom Aegis (AA) — ${APP_VERSION}</title>`
  );
  htmlText = htmlText.replace(
    /window\.__AXIOM_SINGLEFILE__\s*=\s*(?:true|!0)\s*;/g,
    'window.__AXIOM_SINGLEFILE__=(typeof location!=="undefined"&&location.protocol==="file:");'
  );

  if (includeCurrentData) {
    const seedScript = buildPortableSeedScript(customSnapshot);
    const currentHeadCloseIdx = htmlText.indexOf('</head>');
    if (currentHeadCloseIdx !== -1) {
      htmlText =
        htmlText.slice(0, currentHeadCloseIdx) +
        seedScript +
        '\n  </head>' +
        htmlText.slice(currentHeadCloseIdx + 7);
    } else {
      htmlText = seedScript + '\n' + htmlText;
    }
  }

  return htmlText;
}

/**
 * Triggers the download of the clean, 100% self-contained standalone single-file HTML program named `index.html`.
 * Always strips any personal seed or session state so only a clean HTML copy is downloaded.
 */
export async function downloadStandaloneApp(_includeCurrentData: boolean = false): Promise<boolean> {
  const filename = 'index.html';

  try {
    let htmlText = '';
    const isLocalFile =
      typeof window !== 'undefined' && isFileProtocol(window.location.protocol);
    const cacheBuster = `v=${encodeURIComponent(APP_VERSION)}&t=${Date.now()}`;

    if (isLocalFile) {
      htmlText = '<!doctype html>\n' + document.documentElement.outerHTML;
    } else {
      const response = await fetch(`/api/standalone-html?${cacheBuster}`, {
        cache: 'no-store',
      }).catch(() => fetch(`/Axiom-Aegis.html?${cacheBuster}`, { cache: 'no-store' }));
      if (response && response.ok) {
        const candidate = await response.text();
        if (candidate.includes('id="root"')) {
          htmlText = candidate;
        }
      }
      if (!htmlText) {
        const fallbackResp = await fetch(`/Axiom-Aegis.html?${cacheBuster}`, {
          cache: 'no-store',
        }).catch(() => null);
        if (fallbackResp && fallbackResp.ok) {
          const candidate = await fallbackResp.text();
          if (candidate.includes('id="root"')) {
            htmlText = candidate;
          }
        }
      }
      if (!htmlText && typeof document !== 'undefined' && document.documentElement) {
        htmlText = '<!doctype html>\n' + document.documentElement.outerHTML;
      }
    }

    if (htmlText) {
      // Strictly export ONLY the clean HTML copy (never embedding personal data)
      const finalHtml = injectPortableSeedIntoHtml(htmlText, false);

      const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    }
  } catch (err) {
    console.warn('Direct fetch of standalone bundle failed, falling back:', err);
  }

  const a = document.createElement('a');
  a.href = `/Axiom-Aegis.html?v=${encodeURIComponent(APP_VERSION)}&t=${Date.now()}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

/**
 * Downloads a pure, flat Windows Batch Launcher (.bat) with zero PowerShell or multi-line caret escaping.
 * Automatically checks the current directory (%~dp0) and %USERPROFILE%\Downloads, and opens the standalone HTML
 * program directly via Windows ShellExecute (start "").
 */
export function downloadWindowsDesktopLauncher(): boolean {
  const slug = getVersionFileSlug();
  const fallbackOrigin =
    typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.origin
      : 'https://ais-pre-zl25njmvg2bdhkjmcbcg4t-513092688134.us-west1.run.app';

  const batContent = [
    '@echo off',
    'title Axiom Aegis Launcher',
    'cd /d "%~dp0"',
    '',
    'if exist "%~dp0Axiom-Aegis-' + slug + '-Portable.html" goto :launch_portable',
    'if exist "%~dp0Axiom-Aegis-' + slug + '.html" goto :launch_clean',
    'if exist "%~dp0Axiom-Aegis.html" goto :launch_base',
    'if exist "%USERPROFILE%\\Downloads\\Axiom-Aegis-' + slug + '-Portable.html" goto :launch_dl_portable',
    'if exist "%USERPROFILE%\\Downloads\\Axiom-Aegis-' + slug + '.html" goto :launch_dl_clean',
    '',
    'for %%F in ("%~dp0Axiom-Aegis*.html") do (',
    '  start "" "%%~fF"',
    '  exit /b 0',
    ')',
    '',
    'start "" "' + fallbackOrigin + '"',
    'exit /b 0',
    '',
    ':launch_portable',
    'start "" "%~dp0Axiom-Aegis-' + slug + '-Portable.html"',
    'exit /b 0',
    '',
    ':launch_clean',
    'start "" "%~dp0Axiom-Aegis-' + slug + '.html"',
    'exit /b 0',
    '',
    ':launch_base',
    'start "" "%~dp0Axiom-Aegis.html"',
    'exit /b 0',
    '',
    ':launch_dl_portable',
    'start "" "%USERPROFILE%\\Downloads\\Axiom-Aegis-' + slug + '-Portable.html"',
    'exit /b 0',
    '',
    ':launch_dl_clean',
    'start "" "%USERPROFILE%\\Downloads\\Axiom-Aegis-' + slug + '.html"',
    'exit /b 0',
  ].join('\r\n');

  const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Launch-Axiom-Aegis.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

export interface IcoFrameInput {
  width: number;
  height: number;
  pngBytes: Uint8Array;
}

export const ICO_STANDARD_SIZES = [256, 64, 32, 16] as const;

const BUILTIN_BRAND_EMBLEM_MASTER_SRC =
  '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__2__e45572b5.jpg';

/**
 * Pure binary builder that packs multiple PNG buffers (e.g. 256x256, 64x64, 32x32, 16x16)
 * into a standards-compliant Windows .ico binary file.
 */
export function buildMultiSizeIcoFromPngBuffers(frames: IcoFrameInput[]): Uint8Array {
  if (!frames || frames.length === 0) {
    throw new Error('At least one PNG frame is required to build a Windows .ico file');
  }

  const count = frames.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirTableSize = count * dirEntrySize;
  const totalPngBytes = frames.reduce((sum, f) => sum + f.pngBytes.byteLength, 0);

  const output = new Uint8Array(headerSize + dirTableSize + totalPngBytes);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);

  // ICONDIR header (6 bytes)
  view.setUint16(0, 0, true); // Reserved = 0
  view.setUint16(2, 1, true); // Type = 1 (ICO)
  view.setUint16(4, count, true); // Image count

  let payloadOffset = headerSize + dirTableSize;

  for (let i = 0; i < count; i++) {
    const frame = frames[i];
    const entryOffset = headerSize + i * dirEntrySize;
    const widthByte = frame.width >= 256 ? 0 : frame.width & 0xff;
    const heightByte = frame.height >= 256 ? 0 : frame.height & 0xff;

    output[entryOffset + 0] = widthByte;
    output[entryOffset + 1] = heightByte;
    output[entryOffset + 2] = 0; // Color palette (0 for 32bpp PNG)
    output[entryOffset + 3] = 0; // Reserved
    view.setUint16(entryOffset + 4, 1, true); // Color planes = 1
    view.setUint16(entryOffset + 6, 32, true); // Bits per pixel = 32
    view.setUint32(entryOffset + 8, frame.pngBytes.byteLength, true); // Size of PNG data
    view.setUint32(entryOffset + 12, payloadOffset, true); // Offset to PNG data

    output.set(frame.pngBytes, payloadOffset);
    payloadOffset += frame.pngBytes.byteLength;
  }

  return output;
}

function dataUriToUint8Array(dataUri: string): Uint8Array {
  const base64Idx = dataUri.indexOf(';base64,');
  const b64 = base64Idx !== -1 ? dataUri.slice(base64Idx + 8) : dataUri;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function loadBrandEmblemImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function renderSquareEmblemPngBytes(img: HTMLImageElement, size: number): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const nw = img.naturalWidth || img.width || size;
  const nh = img.naturalHeight || img.height || size;
  const side = Math.min(nw, nh);
  const sx = Math.floor((nw - side) / 2);
  const sy = Math.floor((nh - side) / 2);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  const dataUri = canvas.toDataURL('image/png');
  return dataUriToUint8Array(dataUri);
}

/**
 * Generates and downloads a real multi-size Windows .ico file (256x256, 64x64, 32x32, 16x16)
 * directly from the built-in Axiom Aegis Brand Emblem so users can assign it to their desktop shortcut.
 */
export async function downloadAxiomAegisIco(): Promise<boolean> {
  const filename = 'Axiom-Aegis.ico';
  let icoBytes: Uint8Array | null = null;

  try {
    if (typeof document !== 'undefined') {
      const img = await loadBrandEmblemImage(BUILTIN_BRAND_EMBLEM_MASTER_SRC);
      const frames: IcoFrameInput[] = ICO_STANDARD_SIZES.map((sz) => ({
        width: sz,
        height: sz,
        pngBytes: renderSquareEmblemPngBytes(img, sz),
      }));
      icoBytes = buildMultiSizeIcoFromPngBuffers(frames);
    }
  } catch {
    // Fallback to pre-rendered /Axiom-Aegis.ico if canvas rendering fails
  }

  if (!icoBytes && typeof window !== 'undefined' && !isFileProtocol(window.location.protocol)) {
    try {
      const resp = await fetch('/Axiom-Aegis.ico', { cache: 'no-store' });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        icoBytes = new Uint8Array(buf);
      }
    } catch {
      // Ignore fetch fallback error
    }
  }

  if (!icoBytes) {
    return false;
  }

  // Prefer native Desktop File System Access API (showSaveFilePicker) when available in top-level window
  const anyWin = typeof window !== 'undefined' ? (window as any) : null;
  if (
    anyWin &&
    typeof anyWin.showSaveFilePicker === 'function' &&
    anyWin.self === anyWin.top
  ) {
    try {
      const handle = await anyWin.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Windows Icon File (.ico)',
            accept: { 'image/x-icon': ['.ico'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(icoBytes);
      await writable.close();
      return true;
    } catch (pickerErr: any) {
      if (pickerErr && pickerErr.name === 'AbortError') {
        return false;
      }
      // Fall through to standard <a download> blob fallback
    }
  }

  const blob = new Blob([icoBytes as unknown as BlobPart], { type: 'image/x-icon' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

/**
 * Runtime canvas fallback for standalone file:// mode: ensures <link rel="apple-touch-icon">
 * and <link rel="icon"> always resolve to a crisp PNG data URI of the Axiom Aegis Brand Emblem
 * even when running offline from a local file without a web server.
 */
export function ensureRuntimeEmblemAppIcons(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!isFileProtocol(window.location.protocol)) return;

  loadBrandEmblemImage(BUILTIN_BRAND_EMBLEM_MASTER_SRC)
    .then((img) => {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const nw = img.naturalWidth || img.width || 180;
      const nh = img.naturalHeight || img.height || 180;
      const side = Math.min(nw, nh);
      ctx.drawImage(
        img,
        Math.floor((nw - side) / 2),
        Math.floor((nh - side) / 2),
        side,
        side,
        0,
        0,
        180,
        180
      );
      const pngDataUri = canvas.toDataURL('image/png');

      let appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.sizes = '180x180';
        document.head.appendChild(appleLink);
      }
      if (!appleLink.href.startsWith('data:image/png')) {
        appleLink.href = pngDataUri;
      }

      let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        iconLink.type = 'image/png';
        document.head.appendChild(iconLink);
      }
      if (!iconLink.href.startsWith('data:image/png')) {
        iconLink.type = 'image/png';
        iconLink.href = pngDataUri;
      }
    })
    .catch(() => {
      // Non-fatal in headless or restricted environments
    });
}

