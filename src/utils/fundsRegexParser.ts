export interface FundsOcrItem {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date?: string; // YYYY-MM-DD
  selected?: boolean; // defaults to true
  raw_line?: string;
}

export interface FundsOcrResult {
  summary_total_displayed: string;
  summary_amount: number | null;
  items: FundsOcrItem[];
  total_net_amount: number;
  total_income: number;
  total_expense: number;
  raw_text?: string;
  confidence?: number;
  isPdf?: boolean;
  pageCount?: number;
  filename?: string;
  isScannedPdf?: boolean;
}

/**
 * Regex detecting total/net payout summary headers, e.g.:
 * "Total Earnings: $148.50"
 * "Total Payout: $96.50"
 * "Net Earnings $254.12"
 * "Grand Total: $84.20"
 * "Total: $120.00"
 */
const SUMMARY_REGEX =
  /\b(?:total(?:\s+(?:earnings|payout|pay|income|amount|balance|deposit|net|gross))?|net(?:\s+payout|\s+earnings)?|grand\s+total)\b[\s:•·\-|—]*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})\b/i;

/**
 * Regex detecting bank statement balance headers, account summaries, section headers, and non-transaction rows
 * so they are never double counted or ingested as corrupted ledger items.
 */
export const STATEMENT_HEADER_REGEX =
  /\b(?:beginning\s+balance|starting\s+balance|opening\s+balance|previous\s+balance|ending\s+balance|new\s+balance|closing\s+balance|statement\s+period|account\s+summary|total\s+deposits|total\s+withdrawals|total\s+additions|total\s+subtractions|additions\s+totaling|subtractions\s+totaling|date\s+amount\s+description|amount\s+description|total\s+credits|total\s+debits|total\s+checks|total\s+fees|checks\s+paid|interest\s+summary|average\s+daily\s+balance|minimum\s+balance|balance\s+summary|daily\s+ending\s+balance|service\s+charge\s+summary)\b/i;

/**
 * Regex detecting multi-column numeric balance summary rows (e.g. "620.59 596.74 16.85 7.00" or "620.59 596.74 16.85")
 */
const MULTI_DECIMAL_NUMBERS_REGEX = /[+-]?\$?\d{1,3}(?:,\d{3})*\.\d{2}\b/g;

/**
 * Checks if a line or description is a multi-column balance summary row (3+ decimal numbers)
 */
export function isMultiColumnBalanceRow(text: string): boolean {
  if (!text) return false;
  const decimalMatches = text.match(MULTI_DECIMAL_NUMBERS_REGEX) || [];
  if (decimalMatches.length >= 3) {
    return true;
  }
  return false;
}

/**
 * Checks whether a transaction description/title is a corrupted statement artifact,
 * summary table header, multi-column number sequence, or orphan punctuation/decimal fragment.
 */
export function isMalformedFundDescription(description: string, rawLine?: string): boolean {
  const combined = `${description || ''} ${rawLine || ''}`.trim();
  if (!description || !description.trim()) return true;

  const clean = description.trim();

  // 1. Reject known statement summary/column headers
  if (STATEMENT_HEADER_REGEX.test(clean) || STATEMENT_HEADER_REGEX.test(combined)) {
    return true;
  }

  // Reject explicit header combinations like "Additions totaling . Date Amount Description" or standalone "Service charge" header rows
  if (
    /\b(?:additions\s+totaling|subtractions\s+totaling|date\s+amount\s+description)\b/i.test(clean) ||
    /^service\s+charge(?:\s+[\d.,$+-]+)?$/i.test(clean)
  ) {
    return true;
  }

  // 2. Reject multi-column balance summary rows (e.g. "620.59 596.74 16.85" or "620.59 596.74 16.85 7.00")
  if (isMultiColumnBalanceRow(clean) || (rawLine && isMultiColumnBalanceRow(rawLine))) {
    return true;
  }

  // Also reject descriptions that consist of 2+ decimal numbers with no alphabetic merchant words
  const decimalMatches = clean.match(/\d+\.\d{2}/g) || [];
  const alphaWords = clean.match(/[a-zA-Z]{2,}/g) || [];
  if (decimalMatches.length >= 2 && alphaWords.length === 0) {
    return true;
  }

  // 3. Reject orphan punctuation / decimal fragments (e.g. ".75", "0.00", "-14.50", "...")
  if (/^[\d\s.,$+\-−•·|/\\:;()[\]#%*]+$/.test(clean)) {
    return true;
  }

  // 4. Require at least one alphabetic word of 2+ characters (and reject generic fallback "Line Item X" or page markers)
  if (
    alphaWords.length === 0 ||
    /^line\s+item\s+\d+$/i.test(clean) ||
    /^page\s+\d+(?:\s+of\s+\d+)?$/i.test(clean)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a stored FundEntry is malformed/corrupted and should be purged during sanitization.
 */
export function isMalformedFundEntry(entry: {
  description?: string;
  amount?: number;
  category?: string;
}): boolean {
  if (!entry || typeof entry !== 'object') return true;
  const amt = Number(entry.amount);
  if (isNaN(amt) || amt <= 0) return true;
  return isMalformedFundDescription(entry.description || '');
}

/**
 * Filters an array of FundEntry items, removing any corrupted statement summary or numeric fragment rows.
 */
export function sanitizeFundEntries<
  T extends { description?: string; amount?: number; category?: string }
>(entries: T[]): { sanitized: T[]; removedCount: number } {
  if (!Array.isArray(entries)) return { sanitized: [], removedCount: 0 };
  const sanitized = entries.filter((entry) => !isMalformedFundEntry(entry));
  return {
    sanitized,
    removedCount: entries.length - sanitized.length,
  };
}

/**
 * Regex detecting dates in statements (YYYY-MM-DD, MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY, DD Mon YYYY, Month DD, or MM/DD)
 */
const DATE_PATTERNS = [
  // 0: YYYY-MM-DD or YYYY/MM/DD
  /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/,
  // 1: MM/DD/YYYY or M/D/YYYY or MM.DD.YYYY
  /\b(0?[1-9]|1[0-2])[/.](0?[1-9]|[12]\d|3[01])[/.](20\d{2}|\d{2})\b/,
  // 2: MM-DD-YYYY
  /\b(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])-(20\d{2}|\d{2})\b/,
  // 3: Month DD, YYYY or Month DD (e.g. Oct 21, 2026 or Oct 21)
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(20\d{2}))?\b/i,
  // 4: DD Month YYYY or DD Month (e.g. 21 Oct 2026 or 15 Oct)
  /\b(0?[1-9]|[12]\d|3[01])\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?(?:,?\s+(20\d{2}))?\b/i,
  // 5: Short MM/DD or M/D (e.g. 09/15 or 10/04 in bank statements)
  /(?:^|\s)(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])(?=\s|$)/,
  // 6: Short MM-DD at start of line (e.g. "10-15 Speedway")
  /^(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])(?=\s|$)/,
];

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Extracts a normalized date (YYYY-MM-DD) from a string if present
 */
export function extractDateFromLine(text: string, fallbackYear?: string): string | null {
  if (!text) return null;
  const defaultYear = fallbackYear || String(new Date().getFullYear());

  // Pattern 0: YYYY-MM-DD
  const m0 = text.match(DATE_PATTERNS[0]);
  if (m0) {
    const y = m0[1];
    const m = m0[2].padStart(2, '0');
    const d = m0[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Pattern 1: MM/DD/YYYY or MM/DD/YY
  const m1 = text.match(DATE_PATTERNS[1]);
  if (m1) {
    const m = m1[1].padStart(2, '0');
    const d = m1[2].padStart(2, '0');
    let y = m1[3];
    if (y.length === 2) {
      y = Number(y) > 70 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  // Pattern 2: MM-DD-YYYY
  const m2 = text.match(DATE_PATTERNS[2]);
  if (m2) {
    const m = m2[1].padStart(2, '0');
    const d = m2[2].padStart(2, '0');
    let y = m2[3];
    if (y.length === 2) {
      y = Number(y) > 70 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  // Pattern 3: Month DD, YYYY
  const m3 = text.match(DATE_PATTERNS[3]);
  if (m3) {
    const monPrefix = m3[1].toLowerCase().slice(0, 3);
    const m = MONTH_MAP[monPrefix] || '01';
    const d = m3[2].padStart(2, '0');
    const y = m3[3] || defaultYear;
    return `${y}-${m}-${d}`;
  }

  // Pattern 4: DD Month YYYY
  const m4 = text.match(DATE_PATTERNS[4]);
  if (m4) {
    const d = m4[1].padStart(2, '0');
    const monPrefix = m4[2].toLowerCase().slice(0, 3);
    const m = MONTH_MAP[monPrefix] || '01';
    const y = m4[3] || defaultYear;
    return `${y}-${m}-${d}`;
  }

  // Pattern 5: Short MM/DD (e.g. 09/15 or 10/04)
  const m5 = text.match(DATE_PATTERNS[5]);
  if (m5) {
    const m = m5[1].padStart(2, '0');
    const d = m5[2].padStart(2, '0');
    return `${defaultYear}-${m}-${d}`;
  }

  // Pattern 6: Short MM-DD at start of line
  const m6 = text.match(DATE_PATTERNS[6]);
  if (m6) {
    const m = m6[1].padStart(2, '0');
    const d = m6[2].padStart(2, '0');
    return `${defaultYear}-${m}-${d}`;
  }

  return null;
}

/**
 * Regex detecting standard currency amounts with $ sign, or negative/parenthetical:
 * "$48.50", "$ 1,250.00", "-$12.50", "+$420.00", "($14.00)", "45.20-"
 */
const CURRENCY_WITH_SIGN_PATTERN =
  /(?:[+\-−]\s*)?\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})(?:\s*[-−])?\b/;

/**
 * Known Income / Earnings keywords
 */
const INCOME_KEYWORDS = [
  'earnings',
  'payout',
  'base pay',
  'trip fare',
  'delivery fee',
  'tip',
  'tips',
  'customer tip',
  'bonus',
  'boost',
  'promotions',
  'promotion',
  'incentive',
  'deposit',
  'direct dep',
  'payroll',
  'salary',
  'refund',
  'reimbursement',
  'income',
  'dividend',
  'cash back',
  'transfer in',
  'credit',
  'sales',
  'door dash',
  'doordash',
  'uber',
  'lyft',
  'instacart',
  'grubhub',
  'stipend',
  'zelle from',
  'venmo cashout',
];

/**
 * Known Expense / Cost / Withdrawal keywords
 */
const EXPENSE_KEYWORDS = [
  'expense',
  'fee',
  'instant cashout fee',
  'cashout fee',
  'service fee',
  'service charge',
  'tax',
  'withholding',
  'deduction',
  'gas',
  'fuel',
  'groceries',
  'provisions',
  'supplies',
  'meal',
  'restaurant',
  'order total',
  'spent',
  'bill',
  'subscription',
  'charge',
  'debit',
  'withdrawal',
  'subtraction',
  'pos ',
  'purchase',
  'card ',
  'checkcard',
  'autopay',
  'ach debit',
  'atm',
  'insurance',
  'payment to',
  'online pmt',
  'bill pay',
  'cost',
  'toll',
  'parking',
  'maintenance',
  'check #',
  'target',
  'walmart',
  'meijer',
  'kroger',
  'speedway',
  'shell',
  'bp',
  'exxon',
  'chevron',
  'mcdonald',
  'starbucks',
  'amazon',
  'netflix',
  'spotify',
  'apple.com',
  'cvs',
  'walgreens',
  'costco',
  'whole foods',
  'trader joe',
];

/**
 * Cleans string removing OCR noise or bullet artifacts
 */
function cleanOcrText(text: string): string {
  return text
    .replace(/[•·|\-—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips leading/inline date tokens from a transaction description so only merchant/activity text remains
 */
function stripDateTokens(text: string): string {
  return text
    .replace(/\b20\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\b(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01])[/.-](?:20\d{2}|\d{2})\b/g, ' ')
    .replace(
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:,?\s+20\d{2})?\b/gi,
      ' '
    )
    .replace(
      /\b(?:0?[1-9]|[12]\d|3[01])\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?(?:,?\s+20\d{2})?\b/gi,
      ' '
    )
    .replace(/(?:^|\s)(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])(?=\s|$)/g, ' ')
    .replace(/^(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses numeric currency string (handling commas like "1,250.00")
 */
export function parseCurrencyAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const sanitized = amountStr.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const num = parseFloat(sanitized);
  if (isNaN(num) || num <= 0) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Calculates net funds, total income, and total expense from items list.
 * Only includes selected items (item.selected !== false).
 */
export function recalculateFundsTotal(items: FundsOcrItem[]): {
  totalNet: number;
  totalIncome: number;
  totalExpense: number;
  selectedCount: number;
  totalCount: number;
} {
  let totalIncome = 0;
  let totalExpense = 0;
  let selectedCount = 0;

  for (const item of items) {
    if (item.selected === false) continue;
    selectedCount++;
    const amt = Number(item.amount) || 0;
    if (item.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
    }
  }

  const roundedIncome = Math.round(totalIncome * 100) / 100;
  const roundedExpense = Math.round(totalExpense * 100) / 100;
  const totalNet = Math.round((roundedIncome - roundedExpense) * 100) / 100;

  return {
    totalNet,
    totalIncome: roundedIncome,
    totalExpense: roundedExpense,
    selectedCount,
    totalCount: items.length,
  };
}

/**
 * Classifies transaction type and category based on line text and optional statement section context
 */
export function classifyTransaction(
  lineText: string,
  sectionContext?: 'income' | 'expense' | null
): {
  type: 'income' | 'expense';
  category: string;
} {
  const lower = lineText.toLowerCase();

  // Explicit negative signs, trailing minus, DR suffix, or accounting parentheses -> expense
  if (
    /[-−]\s*\$?([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2}|[0-9]+\.[0-9]{2})/.test(lineText) ||
    /\$?(?:[0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2}|[0-9]+\.[0-9]{2})\s*[-−](?!\d)/.test(lineText) ||
    /\(\s*\$?[0-9,]+\.[0-9]{2}\s*\)/.test(lineText)
  ) {
    for (const kw of EXPENSE_KEYWORDS) {
      if (lower.includes(kw)) {
        if (
          kw === 'gas' ||
          kw === 'fuel' ||
          kw === 'toll' ||
          kw === 'parking' ||
          kw === 'speedway' ||
          kw === 'shell' ||
          kw === 'chevron'
        ) {
          return { type: 'expense', category: 'Transportation' };
        }
        if (
          kw === 'groceries' ||
          kw === 'provisions' ||
          kw === 'meal' ||
          kw === 'meijer' ||
          kw === 'kroger' ||
          kw === 'walmart' ||
          kw === 'target' ||
          kw === 'whole foods' ||
          kw === 'trader joe' ||
          kw === 'costco'
        ) {
          return { type: 'expense', category: 'Groceries' };
        }
        if (kw.includes('fee') || kw.includes('charge')) {
          return { type: 'expense', category: 'Processing Fees' };
        }
      }
    }
    return { type: 'expense', category: 'Expense & Fees' };
  }

  // Check expense keywords
  for (const kw of EXPENSE_KEYWORDS) {
    if (lower.includes(kw)) {
      if (
        kw === 'gas' ||
        kw === 'fuel' ||
        kw === 'toll' ||
        kw === 'parking' ||
        kw === 'speedway' ||
        kw === 'shell' ||
        kw === 'chevron'
      ) {
        return { type: 'expense', category: 'Transportation' };
      }
      if (
        kw === 'groceries' ||
        kw === 'provisions' ||
        kw === 'meal' ||
        kw === 'meijer' ||
        kw === 'kroger' ||
        kw === 'walmart' ||
        kw === 'target' ||
        kw === 'whole foods' ||
        kw === 'trader joe' ||
        kw === 'costco'
      ) {
        return { type: 'expense', category: 'Groceries' };
      }
      if (kw.includes('fee') || kw.includes('charge')) {
        return { type: 'expense', category: 'Processing Fees' };
      }
      return { type: 'expense', category: 'General Expense' };
    }
  }

  // Check income keywords
  for (const kw of INCOME_KEYWORDS) {
    if (lower.includes(kw)) {
      if (kw === 'tip' || kw === 'tips' || kw === 'customer tip') {
        return { type: 'income', category: 'Customer Tips' };
      }
      if (kw === 'bonus' || kw === 'boost' || kw === 'promotions' || kw === 'promotion') {
        return { type: 'income', category: 'Promotions & Boost' };
      }
      if (kw.includes('pay') || kw.includes('fare') || kw.includes('delivery')) {
        return { type: 'income', category: 'Delivery / Gig' };
      }
      if (kw === 'deposit' || kw === 'direct dep' || kw === 'salary') {
        return { type: 'income', category: 'Direct Deposit / Salary' };
      }
      return { type: 'income', category: 'Income' };
    }
  }

  // Explicit +$ sign -> income
  if (/\+\s*\$?[0-9,]+\.[0-9]{2}/.test(lineText)) {
    return { type: 'income', category: 'General Income' };
  }

  // If inside a bank statement subtractions/withdrawals section or dated bank row without income keywords, classify as expense
  if (sectionContext === 'expense') {
    return { type: 'expense', category: 'General Expense' };
  }

  return { type: 'income', category: 'General Income' };
}

/**
 * Parses raw OCR or PDF text output into structured Funds / Earnings line items and summaries.
 * Strictly rejects bank statement summary tables, section headers, multi-column balance rows,
 * and orphan decimal/punctuation fragments.
 */
export function parseFundsOcrText(rawText: string): FundsOcrResult {
  if (!rawText || !rawText.trim()) {
    return {
      summary_total_displayed: '$0.00',
      summary_amount: null,
      items: [],
      total_net_amount: 0,
      total_income: 0,
      total_expense: 0,
      raw_text: '',
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^---\s*Page\s+\d+\s*---$/i.test(l));

  // Infer statement year from any header or date containing 20XX
  let inferredStatementYear: string | undefined;
  for (const l of lines) {
    const yearMatch = l.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      inferredStatementYear = yearMatch[1];
      break;
    }
  }

  // Detect whether this document is a bank statement vs a gig/receipt summary
  const isBankStatement = lines.some(
    (l) =>
      STATEMENT_HEADER_REGEX.test(l) ||
      /\b(?:transaction\s+detail|checking\s+summary|statement\s+of\s+account|additions\s+totaling|subtractions\s+totaling)\b/i.test(
        l
      )
  );

  let summaryAmount: number | null = null;
  let summaryDisplayed = '';
  let summaryLineIndex = -1;

  // 1. Scan for Total Earnings / Payout / Grand Total summary line first (skip bank statement headers)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (STATEMENT_HEADER_REGEX.test(line) || isMultiColumnBalanceRow(line)) continue;
    const match = line.match(SUMMARY_REGEX);
    if (match) {
      const amt = parseCurrencyAmount(match[1]);
      if (amt > 0) {
        summaryAmount = amt;
        summaryDisplayed = `$${amt.toFixed(2)}`;
        summaryLineIndex = i;
        break;
      }
    }
  }

  // 2. Scan lines for individual financial line items
  const detectedItems: FundsOcrItem[] = [];
  const consumedLineIndices = new Set<number>();
  const todayStr = new Date().toISOString().slice(0, 10);
  let activeSectionContext: 'income' | 'expense' | null = isBankStatement ? 'expense' : null;

  for (let i = 0; i < lines.length; i++) {
    // Skip the line identified as total summary to prevent double counting!
    if (i === summaryLineIndex) continue;

    const line = lines[i];

    // Track bank statement section transitions (Additions/Deposits vs Subtractions/Withdrawals/Debits)
    if (
      /\b(?:subtractions|withdrawals|debits|checks\s+paid|atm\s+&\s+debit|card\s+purchases|other\s+subtractions|electronic\s+withdrawals)\b/i.test(
        line
      ) &&
      !/\b(?:additions|deposits)\b/i.test(line)
    ) {
      activeSectionContext = 'expense';
    } else if (
      /\b(?:additions|deposits\s+and\s+additions|credits)\b/i.test(line) &&
      !/\b(?:subtractions|withdrawals)\b/i.test(line)
    ) {
      activeSectionContext = 'income';
    }

    // Filter out statement summary headers (Beginning Balance, Ending Balance, Additions totaling, Date Amount Description, Service charge, etc.)
    if (
      STATEMENT_HEADER_REGEX.test(line) ||
      /^service\s+charge\b/i.test(line) ||
      /\bdate\s+amount\s+description\b/i.test(line)
    ) {
      continue;
    }

    // Filter out multi-column balance summary rows (3+ decimal numbers on a single line)
    if (isMultiColumnBalanceRow(line)) {
      continue;
    }

    // Filter out obvious false positives (dates, times without $, ratings, battery, order IDs)
    if (
      (/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(line) && !line.includes('$')) ||
      /^\d{4}-\d{2}-\d{2}$/.test(line) ||
      /\b\d+(\.\d+)?%\b/.test(line) || // percentages
      /\b\d+\s*(?:mi|miles|km|min|mins|hrs?)\b/i.test(line) || // mileage/time
      /\b\d+\s*deliver(?:y|ies)\b/i.test(line) || // delivery count
      /\brating\b|\bacceptance\b/i.test(line) // gig stats
    ) {
      continue;
    }

    // Match currency amounts: $XX.XX or XX.XX
    const currencyMatch = line.match(CURRENCY_WITH_SIGN_PATTERN);
    if (!currencyMatch) continue;

    const amt = parseCurrencyAmount(currencyMatch[1]);
    if (amt <= 0) continue;

    // Filter out if this line is an exact match to the summary and line text mentions total
    if (summaryAmount !== null && Math.abs(amt - summaryAmount) < 0.01 && /total/i.test(line)) {
      continue;
    }

    // Extract Date if present on same line or preceding 1-2 lines (for multi-line PDF cells)
    const lineDate = extractDateFromLine(line, inferredStatementYear);
    let detectedDate = lineDate;
    if (!detectedDate && i > 0 && !consumedLineIndices.has(i - 1)) {
      detectedDate = extractDateFromLine(lines[i - 1], inferredStatementYear);
    }
    if (!detectedDate && i > 1 && !consumedLineIndices.has(i - 2)) {
      const twoBack = lines[i - 2];
      // Only pull date from i - 2 if i - 2 was a standalone date cell
      if (!CURRENCY_WITH_SIGN_PATTERN.test(twoBack)) {
        detectedDate = extractDateFromLine(twoBack, inferredStatementYear);
      }
    }

    // For bank statements, require a recognizable transaction date on the row or its immediate multi-line cell group
    if (isBankStatement && !detectedDate) {
      continue;
    }

    const finalDate = detectedDate || todayStr;

    // Extract Description: text on same line without the transaction amount
    // Also strip any trailing running balance column if the row has [Amount] [Running Balance]
    let descWithoutFirstAmount = line.replace(currencyMatch[0], ' ');
    const secondCurrencyMatch = descWithoutFirstAmount.match(
      /[+\-−]?\s*\$?\s*(?:[0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2}|[0-9]+\.[0-9]{2})\s*$/
    );
    if (secondCurrencyMatch) {
      const alphaCheck = descWithoutFirstAmount.match(/[a-zA-Z]{2,}/g) || [];
      if (alphaCheck.length >= 1) {
        descWithoutFirstAmount = descWithoutFirstAmount.replace(secondCurrencyMatch[0], ' ');
      }
    }

    let desc = descWithoutFirstAmount
      .replace(/[\$+\-−()]/g, ' ')
      .trim();

    desc = cleanOcrText(stripDateTokens(desc));

    // If description is empty or too short (multi-line PDF cell or gig payout screenshot), check preceding line
    if (desc.length < 2 && i > 0 && !consumedLineIndices.has(i - 1)) {
      const prevRaw = lines[i - 1];
      if (
        !STATEMENT_HEADER_REGEX.test(prevRaw) &&
        !isMultiColumnBalanceRow(prevRaw) &&
        !CURRENCY_WITH_SIGN_PATTERN.test(prevRaw)
      ) {
        const prevClean = cleanOcrText(stripDateTokens(prevRaw));
        if (prevClean.length >= 2) {
          desc = prevClean;
          consumedLineIndices.add(i - 1);
        }
      }
    }

    // Strictly reject rows whose cleaned description is numeric-only, punctuation-only, or a header artifact
    if (isMalformedFundDescription(desc, line)) {
      continue;
    }

    if (desc.length > 70) {
      desc = desc.slice(0, 67) + '...';
    }

    // Classify transaction type and category (in bank statements, rows without income keywords default to activeSectionContext / expense)
    const effectiveContext =
      activeSectionContext || (detectedDate && !line.includes('$') ? 'expense' : null);
    const { type, category } = classifyTransaction(`${line} ${desc}`, effectiveContext);

    const itemId = `ocr-fund-${Date.now()}-${detectedItems.length}-${Math.random()
      .toString(36)
      .substring(2, 6)}`;

    consumedLineIndices.add(i);
    detectedItems.push({
      id: itemId,
      description: desc,
      amount: amt,
      type,
      category,
      date: finalDate,
      selected: true,
      raw_line: line,
    });
  }

  // Calculate live net totals
  const { totalNet, totalIncome, totalExpense } = recalculateFundsTotal(detectedItems);

  // If no individual items were found, but a summary total was detected, provide a single item
  let finalNet = totalNet;
  if (detectedItems.length === 0 && summaryAmount !== null && summaryAmount > 0) {
    finalNet = summaryAmount;
  }

  return {
    summary_total_displayed: summaryDisplayed || `$${finalNet.toFixed(2)}`,
    summary_amount: summaryAmount,
    items: detectedItems,
    total_net_amount: finalNet,
    total_income: detectedItems.length > 0 ? totalIncome : summaryAmount || 0,
    total_expense: totalExpense,
    raw_text: rawText,
  };
}
