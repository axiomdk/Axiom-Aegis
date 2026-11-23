// Polyfill ES2025 Promise.try & Promise.withResolvers required by pdfjs-dist v6 MessageHandler
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function <T>(
    callback: (...args: any[]) => T | PromiseLike<T>,
    ...args: any[]
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      resolve(callback(...args));
    });
  };
}

if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import * as pdfjsLib from 'pdfjs-dist';
import { runLocalOcr } from './localOcrEngine';

const PDFJS_VERSION = pdfjsLib.version || '6.4.299';
const CDN_WORKER_URLS = [
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
  `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
];

function configurePdfWorker(preferCdn = false): void {
  if (typeof window === 'undefined') return;

  const isSingleFileOrFileProtocol =
    Boolean((window as unknown as { __AXIOM_SINGLEFILE__?: boolean }).__AXIOM_SINGLEFILE__) ||
    window.location.protocol === 'file:';

  if (preferCdn || isSingleFileOrFileProtocol) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_WORKER_URLS[0];
    return;
  }

  try {
    const resolved = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    if (resolved.startsWith('file:') || resolved.endsWith('.html')) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_WORKER_URLS[0];
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = resolved;
    }
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_WORKER_URLS[0];
  }
}

configurePdfWorker(false);

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  isScannedPdf: boolean;
  filename?: string;
  fileSizeBytes?: number;
}

export type PdfProgressCallback = (progress: number, status: string) => void;

/**
 * Decodes a PDF literal string inside (...) handling escapes and octal codes.
 */
function decodePdfLiteralString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    i++;
    if (i >= raw.length) break;
    const next = raw[i];
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === 'b') out += '\b';
    else if (next === 'f') out += '\f';
    else if (next === '(' || next === ')' || next === '\\') out += next;
    else if (next === '\r' || next === '\n') {
      if (next === '\r' && raw[i + 1] === '\n') i++;
    } else if (next >= '0' && next <= '7') {
      let octal = next;
      if (raw[i + 1] >= '0' && raw[i + 1] <= '7') {
        octal += raw[++i];
        if (raw[i + 1] >= '0' && raw[i + 1] <= '7') {
          octal += raw[++i];
        }
      }
      const code = parseInt(octal, 8);
      if (code >= 32 && code <= 126) {
        out += String.fromCharCode(code);
      } else if (code === 9 || code === 10 || code === 13) {
        out += ' ';
      }
    } else {
      out += next;
    }
  }
  return out;
}

/**
 * Decodes a PDF hex string inside <...> (supports ASCII hex and UTF-16BE).
 */
function decodePdfHexString(hexRaw: string): string {
  const clean = hexRaw.replace(/[^0-9A-Fa-f]/g, '');
  if (!clean) return '';
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    bytes[i / 2] = parseInt(padded.slice(i, i + 2), 16);
  }

  // Check UTF-16BE BOM (FE FF) or alternating 0x00 high bytes
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      if (code >= 32) out += String.fromCharCode(code);
    }
    return out;
  }

  let zeroHighBytes = 0;
  const pairs = Math.floor(bytes.length / 2);
  if (pairs >= 2) {
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] >= 32 && bytes[i + 1] <= 126) {
        zeroHighBytes++;
      }
    }
    if (zeroHighBytes >= pairs * 0.7) {
      let out = '';
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const code = (bytes[i] << 8) | bytes[i + 1];
        if (code >= 32) out += String.fromCharCode(code);
      }
      return out;
    }
  }

  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      out += String.fromCharCode(b);
    }
  }
  return out;
}

/**
 * Decompresses a /FlateDecode byte stream using standard Web DecompressionStream.
 */
async function inflatePdfStreamBytes(compressed: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;

  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(compressed)).catch(() => {});
      writer.close().catch(() => {});
      const response = new Response(ds.readable);
      const ab = await response.arrayBuffer();
      if (ab && ab.byteLength > 0) {
        return new Uint8Array(ab);
      }
    } catch {
      // Try next format or skip
    }
  }
  return null;
}

/**
 * Extracts text tokens from a decompressed PDF content stream (BT ... ET or whole stream).
 */
function parsePdfContentStreamText(streamStr: string): string {
  const lines: string[] = [];
  let currentLine = '';

  const pushCurrentLine = () => {
    const trimmed = currentLine.replace(/\s+/g, ' ').trim();
    if (trimmed) {
      lines.push(trimmed);
    }
    currentLine = '';
  };

  // Extract parenthesized or hex tokens inside BT ... ET blocks (or fallback to entire stream)
  const btBlocks = streamStr.match(/BT[\s\S]*?ET/g);
  const blocksToScan = btBlocks && btBlocks.length > 0 ? btBlocks : [streamStr];

  for (const block of blocksToScan) {
    let i = 0;
    let lastTmY: number | null = null;
    const len = block.length;

    while (i < len) {
      const ch = block[i];

      // 1. Array of strings/kerning for TJ operator: [ (text) -200 (more) ] TJ
      if (ch === '[') {
        i++;
        let arrText = '';
        while (i < len && block[i] !== ']') {
          if (block[i] === '(') {
            i++;
            let depth = 1;
            let lit = '';
            while (i < len && depth > 0) {
              if (block[i] === '\\') {
                lit += block[i] + (block[i + 1] || '');
                i += 2;
                continue;
              }
              if (block[i] === '(') depth++;
              else if (block[i] === ')') {
                depth--;
                if (depth === 0) {
                  i++;
                  break;
                }
              }
              lit += block[i++];
            }
            arrText += decodePdfLiteralString(lit);
          } else if (block[i] === '<' && block[i + 1] !== '<') {
            i++;
            let hex = '';
            while (i < len && block[i] !== '>') {
              hex += block[i++];
            }
            if (block[i] === '>') i++;
            arrText += decodePdfHexString(hex);
          } else if (block[i] === '-' || (block[i] >= '0' && block[i] <= '9')) {
            let numStr = '';
            while (i < len && /[-0-9.]/.test(block[i])) {
              numStr += block[i++];
            }
            const kern = parseFloat(numStr);
            if (!isNaN(kern) && kern < -120 && !arrText.endsWith(' ')) {
              arrText += ' ';
            }
          } else {
            i++;
          }
        }
        if (block[i] === ']') i++;
        if (arrText) {
          currentLine += (currentLine && !currentLine.endsWith(' ') ? ' ' : '') + arrText;
        }
        continue;
      }

      // 2. Single parenthesized string: (text) Tj or ' or "
      if (ch === '(') {
        i++;
        let depth = 1;
        let lit = '';
        while (i < len && depth > 0) {
          if (block[i] === '\\') {
            lit += block[i] + (block[i + 1] || '');
            i += 2;
            continue;
          }
          if (block[i] === '(') depth++;
          else if (block[i] === ')') {
            depth--;
            if (depth === 0) {
              i++;
              break;
            }
          }
          lit += block[i++];
        }
        const decoded = decodePdfLiteralString(lit);
        // Check if followed by ' or " operator which implies a new line first
        const restAfter = block.slice(i, i + 12);
        if (/^\s*['"]/.test(restAfter)) {
          pushCurrentLine();
        }
        if (decoded) {
          currentLine += (currentLine && !currentLine.endsWith(' ') ? ' ' : '') + decoded;
        }
        continue;
      }

      // 3. Hex string <...> Tj
      if (ch === '<' && block[i + 1] !== '<') {
        i++;
        let hex = '';
        while (i < len && block[i] !== '>') {
          hex += block[i++];
        }
        if (block[i] === '>') i++;
        const afterHex = block.slice(i, i + 10);
        if (/^\s*Tj\b/.test(afterHex)) {
          const decoded = decodePdfHexString(hex);
          if (decoded) {
            currentLine += (currentLine && !currentLine.endsWith(' ') ? ' ' : '') + decoded;
          }
        }
        continue;
      }

      // 4. Detect line-break positioning operators: T*, Td, TD, Tm
      const windowSlice = block.slice(i, i + 64);

      const tStarMatch = windowSlice.match(/^T\*(?=\s|$|[([<])/);
      if (tStarMatch) {
        pushCurrentLine();
        i += 2;
        continue;
      }

      const tdMatch = windowSlice.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+T[dD]\b/);
      if (tdMatch) {
        const ty = parseFloat(tdMatch[2]);
        if (!isNaN(ty) && Math.abs(ty) > 1.5) {
          pushCurrentLine();
        } else if (currentLine && !currentLine.endsWith(' ')) {
          currentLine += ' ';
        }
        i += tdMatch[0].length;
        continue;
      }

      const tmMatch = windowSlice.match(
        /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm\b/
      );
      if (tmMatch) {
        const y = parseFloat(tmMatch[6]);
        if (!isNaN(y)) {
          if (lastTmY !== null && Math.abs(y - lastTmY) > 3) {
            pushCurrentLine();
          } else if (currentLine && !currentLine.endsWith(' ')) {
            currentLine += ' ';
          }
          lastTmY = y;
        }
        i += tmMatch[0].length;
        continue;
      }

      i++;
    }

    pushCurrentLine();
  }

  return lines.join('\n').trim();
}

/**
 * 100% Zero-Worker Native PDF Stream Extractor Fallback.
 * Works offline, on file://, and in single-file HTML bundles even if Web Workers are blocked.
 */
export async function extractTextFromPdfBufferNative(
  arrayBuffer: ArrayBuffer
): Promise<{ text: string; pageCount: number }> {
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('latin1');
  const rawPdf = decoder.decode(bytes);

  const pageMatches = rawPdf.match(/\/Type\s*\/Page\b/g);
  const pageCount = Math.max(1, pageMatches ? pageMatches.length : 1);

  const extractedChunks: string[] = [];
  let searchPos = 0;

  while (searchPos < rawPdf.length) {
    const streamIdx = rawPdf.indexOf('stream', searchPos);
    if (streamIdx === -1) break;

    // Ensure 'stream' is not part of 'endstream'
    if (streamIdx >= 3 && rawPdf.slice(streamIdx - 3, streamIdx) === 'end') {
      searchPos = streamIdx + 6;
      continue;
    }

    // Advance past 'stream' and its newline (\r\n or \n)
    let dataStart = streamIdx + 6;
    if (rawPdf[dataStart] === '\r' && rawPdf[dataStart + 1] === '\n') {
      dataStart += 2;
    } else if (rawPdf[dataStart] === '\n' || rawPdf[dataStart] === '\r') {
      dataStart += 1;
    } else {
      // Not a valid stream keyword boundary
      searchPos = streamIdx + 6;
      continue;
    }

    const endStreamIdx = rawPdf.indexOf('endstream', dataStart);
    if (endStreamIdx === -1) break;

    let dataEnd = endStreamIdx;
    if (rawPdf[dataEnd - 2] === '\r' && rawPdf[dataEnd - 1] === '\n') {
      dataEnd -= 2;
    } else if (rawPdf[dataEnd - 1] === '\n' || rawPdf[dataEnd - 1] === '\r') {
      dataEnd -= 1;
    }

    const headerLookback = rawPdf.slice(Math.max(0, streamIdx - 350), streamIdx);
    const isFlate = /\/FlateDecode\b|\/Fl\b/.test(headerLookback);
    const isImageOrFont = /\/Subtype\s*\/Image\b|\/FontFile\d*\b|\/Metadata\b/.test(headerLookback);

    if (!isImageOrFont && dataEnd > dataStart) {
      const streamBytes = bytes.subarray(dataStart, dataEnd);
      let contentStr = '';

      if (isFlate) {
        const inflated = await inflatePdfStreamBytes(streamBytes);
        if (inflated) {
          contentStr = decoder.decode(inflated);
        }
      } else {
        contentStr = rawPdf.slice(dataStart, dataEnd);
      }

      if (contentStr && (contentStr.includes('Tj') || contentStr.includes('TJ') || contentStr.includes('BT'))) {
        const parsed = parsePdfContentStreamText(contentStr);
        if (parsed) {
          extractedChunks.push(parsed);
        }
      }
    }

    searchPos = endStreamIdx + 9;
  }

  return {
    text: extractedChunks.join('\n').trim(),
    pageCount,
  };
}

/**
 * Reconstructs clean horizontal lines from pdfjs page.getTextContent().items
 * by sorting items top-to-bottom (Y descending) and left-to-right (X ascending).
 */
function reconstructPageLinesFromTextItems(items: any[]): string {
  interface PositionedItem {
    str: string;
    x: number;
    y: number;
    hasEOL?: boolean;
  }

  const positioned: PositionedItem[] = [];
  for (const item of items) {
    const str = typeof item?.str === 'string' ? item.str : '';
    if (!str.trim() && !item?.hasEOL) continue;
    const transform = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    const x = typeof transform[4] === 'number' ? transform[4] : 0;
    const y = typeof transform[5] === 'number' ? transform[5] : 0;
    positioned.push({
      str: str.trim(),
      x,
      y,
      hasEOL: Boolean(item?.hasEOL),
    });
  }

  if (positioned.length === 0) return '';

  // Group into horizontal rows using a Y-coordinate tolerance of 4.5 units
  const rows: { y: number; items: PositionedItem[] }[] = [];
  for (const pt of positioned) {
    if (!pt.str) continue;
    let matchedRow = rows.find((r) => Math.abs(r.y - pt.y) <= 4.5);
    if (!matchedRow) {
      matchedRow = { y: pt.y, items: [] };
      rows.push(matchedRow);
    }
    matchedRow.items.push(pt);
  }

  // Sort rows top-to-bottom (PDF Y origin is bottom-left, so higher Y is higher on page)
  rows.sort((a, b) => b.y - a.y);

  const lines: string[] = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const lineText = row.items
      .map((i) => i.str)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (lineText) {
      lines.push(lineText);
    }
  }

  return lines.join('\n').trim();
}

/**
 * Loads a PDF document with pdfjs-dist, retrying with CDN workers or disableWorker if needed.
 */
async function loadPdfDocumentWithFallback(dataBytes: Uint8Array): Promise<any> {
  const attempts: Array<() => Promise<any>> = [
    () =>
      pdfjsLib.getDocument({
        data: new Uint8Array(dataBytes),
        useSystemFonts: true,
      }).promise,
    () => {
      if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_WORKER_URLS[0];
      }
      return pdfjsLib.getDocument({
        data: new Uint8Array(dataBytes),
        useSystemFonts: true,
      }).promise;
    },
    () => {
      if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_WORKER_URLS[1];
      }
      return pdfjsLib.getDocument({
        data: new Uint8Array(dataBytes),
        useSystemFonts: true,
      }).promise;
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Extracts digital text or runs local Tesseract OCR on scanned PDF pages.
 * Step A: Direct fast digital text extraction via page.getTextContent() (sorted by Y/X coordinates)
 * Step B: If pdfjs worker fails or returns empty text, falls back to Native PDF Stream Extractor
 * Step C: If page text is still negligible (< 35 chars), renders page to offscreen canvas and runs local Tesseract OCR
 */
export async function extractTextFromPdf(
  fileOrBuffer: File | Blob | ArrayBuffer | Uint8Array,
  onProgress?: PdfProgressCallback,
  filename?: string
): Promise<PdfExtractionResult> {
  let arrayBuffer: ArrayBuffer;
  let fileSizeBytes = 0;

  if (fileOrBuffer instanceof File) {
    filename = filename || fileOrBuffer.name;
    fileSizeBytes = fileOrBuffer.size;
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Blob) {
    fileSizeBytes = fileOrBuffer.size;
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    arrayBuffer = fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    ) as ArrayBuffer;
    fileSizeBytes = fileOrBuffer.byteLength;
  } else {
    arrayBuffer = fileOrBuffer;
    fileSizeBytes = fileOrBuffer.byteLength;
  }

  if (onProgress) {
    onProgress(0.05, 'Reading PDF structure...');
  }

  try {
    const pdfDoc = await loadPdfDocumentWithFallback(new Uint8Array(arrayBuffer));
    const numPages = pdfDoc.numPages;
    const pageTexts: string[] = [];
    let isScannedPdf = false;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageProgressBase = (pageNum - 1) / numPages;
      if (onProgress) {
        onProgress(
          pageProgressBase * 0.9,
          `Processing PDF page ${pageNum} of ${numPages}...`
        );
      }

      const page = await pdfDoc.getPage(pageNum);

      // Step A: Attempt direct digital text extraction with coordinate row sorting
      const textContent = await page.getTextContent();
      let combinedPageText = '';

      if (textContent && Array.isArray(textContent.items)) {
        combinedPageText = reconstructPageLinesFromTextItems(textContent.items as any[]);
      }

      // Step B: If digital text is missing or negligible (< 35 chars), check native stream parser before slow OCR
      if (combinedPageText.length < 35 && pageNum === 1) {
        const nativeRes = await extractTextFromPdfBufferNative(arrayBuffer);
        if (nativeRes.text.length >= 35) {
          combinedPageText = nativeRes.text;
        }
      }

      // Step C: If still negligible (< 35 chars), fallback to local Canvas + Tesseract OCR
      if (
        combinedPageText.length < 35 &&
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      ) {
        isScannedPdf = true;
        if (onProgress) {
          onProgress(
            pageProgressBase * 0.9 + 0.05,
            `Scanned page detected on page ${pageNum}: Running local OCR...`
          );
        }

        try {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport,
              canvas: canvas as any,
            }).promise;

            const canvasDataUrl = canvas.toDataURL('image/png');
            const ocrResult = await runLocalOcr(canvasDataUrl, (info) => {
              if (onProgress) {
                const scaled = pageProgressBase * 0.9 + (info.progress / numPages) * 0.9;
                onProgress(
                  scaled,
                  `OCR scanning page ${pageNum} (${Math.round(info.progress * 100)}%)...`
                );
              }
            });

            if (ocrResult && ocrResult.text.trim()) {
              combinedPageText = ocrResult.text.trim();
            }
          }
        } catch (ocrErr) {
          console.warn(`Fallback OCR failed on PDF page ${pageNum}:`, ocrErr);
        }
      }

      if (combinedPageText) {
        pageTexts.push(`--- Page ${pageNum} ---\n${combinedPageText}`);
      }
    }

    if (onProgress) {
      onProgress(1.0, 'Parsing statement transactions...');
    }

    return {
      text: pageTexts.join('\n\n'),
      pageCount: numPages,
      isScannedPdf,
      filename,
      fileSizeBytes,
    };
  } catch (pdfjsError) {
    console.warn('PDF.js worker extraction failed; running native PDF stream parser fallback:', pdfjsError);
    if (onProgress) {
      onProgress(0.5, 'Using built-in native PDF stream extractor...');
    }

    const nativeResult = await extractTextFromPdfBufferNative(arrayBuffer);

    if (onProgress) {
      onProgress(1.0, 'Parsing statement transactions...');
    }

    return {
      text: nativeResult.text ? `--- Page 1 ---\n${nativeResult.text}` : '',
      pageCount: nativeResult.pageCount,
      isScannedPdf: false,
      filename,
      fileSizeBytes,
    };
  }
}

/**
 * Generates a valid, standards-compliant sample Bank Statement PDF as a Uint8Array
 * so users and automated tests can verify PDF extraction and transaction parsing immediately.
 */
export function generateSampleBankStatementPdfBytes(customLines?: string[]): Uint8Array {
  const statementLines = customLines || [
    'AXIOM AEGIS CHECKING ACCOUNT STATEMENT',
    'Statement Period: 10/01/2026 to 10/31/2026',
    'Beginning Balance $2,450.00',
    'Additions and Deposits',
    '10/14/2026 Direct Deposit Payroll +$1,850.00',
    '10/18/2026 DoorDash Weekly Payout +$412.50',
    '10/22/2026 Customer Tip Adjustment +$38.00',
    'Subtractions and Card Purchases',
    '10/15/2026 Speedway Fuel Station -$46.80',
    '10/19/2026 Meijer Groceries & Provisions -$124.35',
    '10/24/2026 Cloud Server Subscription -$29.00',
    'Ending Balance $4,550.35',
  ];

  const streamOps: string[] = ['BT', '/F1 11 Tf', '50 750 Td'];
  statementLines.forEach((line, idx) => {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    if (idx > 0) {
      streamOps.push('0 -18 Td');
    }
    streamOps.push(`(${escaped}) Tj`);
  });
  streamOps.push('ET');
  const streamContent = streamOps.join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj'
  );
  objects.push(
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj'
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
