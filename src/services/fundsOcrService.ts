import { runLocalOcr, OcrProgressInfo } from '../utils/localOcrEngine';
import { parseFundsOcrText, FundsOcrResult, FundsOcrItem } from '../utils/fundsRegexParser';
import { extractTextFromPdf, generateSampleBankStatementPdfBytes } from '../utils/pdfParser';

export type { FundsOcrResult, FundsOcrItem };
export { parseFundsOcrText, generateSampleBankStatementPdfBytes };

export interface FundsAnalysisOptions {
  filename?: string;
  isPdf?: boolean;
}

async function hasPdfMagicHeader(blob: Blob): Promise<boolean> {
  try {
    const slice = blob.slice(0, 5);
    const buf = await slice.arrayBuffer();
    const header = new TextDecoder('ascii').decode(new Uint8Array(buf));
    return header.startsWith('%PDF-');
  } catch {
    return false;
  }
}

/**
 * 100% Client-Side Local Funds / Earnings / Bank Statement Document Scanner:
 * Supports BOTH Images (PNG, JPG, WEBP, screenshots) and PDF Documents (bank statements, payout summaries, receipts).
 * - For PDFs: uses `pdfjs-dist` + native PDF stream decompression to extract digital text instantaneously across all pages, falling back to Tesseract.js canvas OCR for scanned receipts.
 * - For Images: uses offscreen canvas auto-contrast preprocessing and local Tesseract.js OCR.
 * Completely eliminates 503 errors and guarantees zero financial data leaves the client.
 */
export async function analyzeFundsDocument(
  fileOrInput: File | Blob | string,
  onProgress?: (progress: number, status: string) => void,
  options?: FundsAnalysisOptions
): Promise<FundsOcrResult> {
  let isPdf =
    Boolean(options?.isPdf) ||
    (fileOrInput instanceof File &&
      (fileOrInput.type === 'application/pdf' ||
        fileOrInput.name.toLowerCase().endsWith('.pdf'))) ||
    (fileOrInput instanceof Blob && fileOrInput.type === 'application/pdf') ||
    (typeof fileOrInput === 'string' && fileOrInput.toLowerCase().endsWith('.pdf'));

  if (!isPdf && fileOrInput instanceof Blob) {
    isPdf = await hasPdfMagicHeader(fileOrInput);
  }

  const filename =
    options?.filename || (fileOrInput instanceof File ? fileOrInput.name : undefined);

  // Branch A: Process PDF document
  if (isPdf) {
    if (onProgress) {
      onProgress(0.05, 'Initializing local PDF parser engine...');
    }

    const pdfResult = await extractTextFromPdf(
      fileOrInput as File | Blob,
      (progress, status) => {
        if (onProgress) onProgress(progress, status);
      },
      filename
    );

    const parsed = parseFundsOcrText(pdfResult.text);

    return {
      ...parsed,
      raw_text: pdfResult.text,
      isPdf: true,
      pageCount: pdfResult.pageCount,
      filename: pdfResult.filename || filename,
      isScannedPdf: pdfResult.isScannedPdf,
      confidence: pdfResult.isScannedPdf ? 88 : 98,
    };
  }

  // Branch B: Process Image screenshot
  let formattedInput: File | Blob | string = fileOrInput;
  if (
    typeof fileOrInput === 'string' &&
    !fileOrInput.startsWith('data:') &&
    !fileOrInput.startsWith('blob:') &&
    !fileOrInput.startsWith('http')
  ) {
    formattedInput = `data:image/png;base64,${fileOrInput}`;
  }

  const ocrOutput = await runLocalOcr(formattedInput, (info: OcrProgressInfo) => {
    if (onProgress) {
      onProgress(info.progress, info.status);
    }
  });

  const parsed = parseFundsOcrText(ocrOutput.text);

  return {
    ...parsed,
    raw_text: ocrOutput.text,
    confidence: ocrOutput.confidence,
    isPdf: false,
    filename: filename,
  };
}

/**
 * Backwards compatible alias for screenshot image scanning
 */
export async function analyzeFundsScreenshot(
  imageInput: File | Blob | string,
  onProgress?: (progress: number, status: string) => void
): Promise<FundsOcrResult> {
  return analyzeFundsDocument(imageInput, onProgress);
}

/**
 * Sample simulated Funds / Earnings OCR data for testing and offline preview.
 */
export function getSampleFundsOcrResult(): FundsOcrResult {
  const todayStr = new Date().toISOString().slice(0, 10);
  return {
    summary_total_displayed: '$148.50',
    summary_amount: 148.5,
    items: [
      {
        id: 'fund-sample-1',
        description: 'Base Pay (12 Deliveries)',
        amount: 54.0,
        type: 'income',
        category: 'Delivery / Gig',
        date: todayStr,
        selected: true,
      },
      {
        id: 'fund-sample-2',
        description: 'Customer Tips Breakdown',
        amount: 72.5,
        type: 'income',
        category: 'Customer Tips',
        date: todayStr,
        selected: true,
      },
      {
        id: 'fund-sample-3',
        description: 'Peak Pay & Promotional Boost',
        amount: 22.0,
        type: 'income',
        category: 'Promotions & Boost',
        date: todayStr,
        selected: true,
      },
      {
        id: 'fund-sample-4',
        description: 'Instant Cashout Processing Fee',
        amount: 1.99,
        type: 'expense',
        category: 'Processing Fees',
        date: todayStr,
        selected: true,
      },
      {
        id: 'fund-sample-5',
        description: 'Local Fuel Station Fill-Up',
        amount: 24.5,
        type: 'expense',
        category: 'Transportation',
        date: todayStr,
        selected: true,
      },
    ],
    total_net_amount: 122.01,
    total_income: 148.5,
    total_expense: 26.49,
    raw_text: `Weekly Delivery Payout Summary\nThursday, Oct 22\nTotal Earnings: $148.50\n\nBase Pay (12 Deliveries)\n$54.00\n\nCustomer Tips Breakdown\n$72.50\n\nPeak Pay & Promotional Boost\n$22.00\n\nInstant Cashout Processing Fee\n-$1.99\n\nLocal Fuel Station Fill-Up\n-$24.50`,
    confidence: 96,
  };
}
