import { FundEntry } from '../types';

export interface ParsedBankTransaction {
  id: string;
  importHash: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  isDuplicate: boolean;
  selected: boolean;
  rawLine?: string;
}

export interface BankCsvParseResult {
  headers: string[];
  transactions: ParsedBankTransaction[];
  totalFound: number;
  duplicatesCount: number;
  newCount: number;
  detectedColumns: {
    dateCol: number;
    descCol: number;
    amountCol: number;
    debitCol: number;
    creditCol: number;
    categoryCol?: number;
    typeCol?: number;
  };
}

/**
 * Robust RFC-4180 compliant CSV line parser handling quotes, escaped quotes, and commas
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l].trim();
    if (!line) continue;

    const row: string[] = [];
    let insideQuotes = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    if (row.length > 0 && row.some((f) => f.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse various date formats (MM/DD/YYYY, YYYY-MM-DD, M/D/YY, etc.) into YYYY-MM-DD
 */
export function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/['"]/g, '');

  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
    const [y, m, d] = cleaned.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY or M/D/YY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [_, m, d, y] = slashMatch;
    if (y.length === 2) {
      y = Number(y) > 70 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback to Date parser
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Clean monetary strings into float ($1,234.56, -45.00, (45.00))
 */
export function parseAmount(raw: string): { amount: number; isNegative: boolean } | null {
  if (!raw) return null;
  let str = raw.trim().replace(/['"$]/g, '');

  let isNegative = false;
  // Parentheses notation (45.20)
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1);
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1);
  } else if (str.endsWith('-')) {
    isNegative = true;
    str = str.slice(0, -1);
  }

  // Remove thousand separators
  str = str.replace(/,/g, '');
  const num = parseFloat(str);
  if (isNaN(num)) return null;

  return {
    amount: Math.abs(num),
    isNegative,
  };
}

/**
 * Smart categorization based on merchant/description patterns
 */
export function inferCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (/grocery|kroger|safeway|trader joe|whole foods|costco|aldi|market|food lion|wegmans|meijer/.test(d)) {
    return 'Groceries';
  }
  if (/starbucks|coffee|cafe|mcdonald|chipotle|uber eats|doordash|restaurant|diner|burger|taco|pizza/.test(d)) {
    return 'Dining & Food';
  }
  if (/aws|amazon web|github|digitalocean|cloudflare|google cloud|apple|openai|anthropic|server|hosting|cloud/.test(d)) {
    return 'Cloud & Engineering';
  }
  if (/shell|chevron|exxon|bp|gas|fuel|wawa|speedway|parking|uber|lyft|transit|subway|metro/.test(d)) {
    return 'Transportation';
  }
  if (/gym|fitness|crossfit|athletic|pharmacy|cvs|walgreens|doctor|hospital|health|dental|vision/.test(d)) {
    return 'Health & Fitness';
  }
  if (/payroll|salary|direct dep|client|stripe payout|consulting|dividend|interest|revenue|income/.test(d)) {
    return 'Client / Income';
  }
  if (/netflix|spotify|hulu|steam|nintendo|playstation|audible|youtube|patreon/.test(d)) {
    return 'Subscriptions & Entertainment';
  }
  return 'General';
}

/**
 * Deterministic hash for duplicate detection
 */
export function generateTransactionHash(
  date: string,
  amount: number,
  type: string,
  description: string
): string {
  const normDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  const rawKey = `${date}|${amount.toFixed(2)}|${type}|${normDesc}`;

  // Fast FNV-1a 32-bit hash converted to hex
  let hash = 0x811c9dc5;
  for (let i = 0; i < rawKey.length; i++) {
    hash ^= rawKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `tx-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Detect column indices from header row
 */
export function detectColumns(headers: string[]) {
  const lower = headers.map((h) => h.toLowerCase().trim());

  let dateCol = lower.findIndex((h) => /date|posting|trans.*date|posted/.test(h));
  let descCol = lower.findIndex((h) =>
    /description|desc|payee|merchant|details|memo|name|narrative/.test(h)
  );
  let amountCol = lower.findIndex((h) => /^amount$|trans.*amount|net.*amount|total/.test(h));
  let debitCol = lower.findIndex((h) => /debit|charge|withdrawal|paid out/.test(h));
  let creditCol = lower.findIndex((h) => /credit|deposit|paid in/.test(h));
  const categoryCol = lower.findIndex((h) => /^category$|cat|group|classification/.test(h));
  const typeCol = lower.findIndex((h) => /^type$|transaction\s*type|entry\s*type/.test(h));

  // Fallbacks if not detected by exact regex
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = lower.length > 1 ? 1 : 0;
  if (amountCol === -1 && debitCol === -1) {
    amountCol = lower.findIndex((h) => /amount|bal/.test(h));
    if (amountCol === -1 && lower.length > 2) amountCol = 2;
  }

  return { dateCol, descCol, amountCol, debitCol, creditCol, categoryCol, typeCol };
}

/**
 * Parse JSON bank/ledger export ([ { date, description, amount, type, category } ] or { funds: [...] })
 */
function parseBankJson(jsonText: string, existingHashes: Set<string>): BankCsvParseResult | null {
  try {
    const parsed = JSON.parse(jsonText);
    const rawItems: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.funds)
      ? parsed.funds
      : Array.isArray(parsed?.transactions)
      ? parsed.transactions
      : Array.isArray(parsed?.data?.funds)
      ? parsed.data.funds
      : [];

    if (rawItems.length === 0) return null;

    const transactions: ParsedBankTransaction[] = [];
    let duplicatesCount = 0;

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      if (!item || typeof item !== 'object') continue;

      const rawDate = String(item.date || item.transactionDate || item.postedDate || '');
      const date = normalizeDate(rawDate) || new Date().toISOString().slice(0, 10);
      const description = String(
        item.description || item.merchant || item.payee || item.title || item.name || ''
      ).trim();
      if (!description) continue;

      const rawAmt = item.amount ?? item.value ?? item.total;
      const parsedAmt =
        typeof rawAmt === 'number'
          ? { amount: Math.abs(rawAmt), isNegative: rawAmt < 0 }
          : parseAmount(String(rawAmt || ''));

      if (!parsedAmt || parsedAmt.amount <= 0) continue;

      const rawType = String(item.type || '').toLowerCase();
      let type: 'income' | 'expense';
      if (rawType === 'income' || rawType === 'credit' || rawType === 'deposit') {
        type = 'income';
      } else if (rawType === 'expense' || rawType === 'debit' || rawType === 'withdrawal') {
        type = 'expense';
      } else {
        type = parsedAmt.isNegative ? 'expense' : 'income';
      }

      const amount = Math.round(parsedAmt.amount * 100) / 100;
      const category = String(item.category || '').trim() || inferCategory(description);
      const importHash =
        item.importHash || generateTransactionHash(date, amount, type, description);
      const isDuplicate = existingHashes.has(importHash);

      if (isDuplicate) {
        duplicatesCount++;
      } else {
        existingHashes.add(importHash);
      }

      transactions.push({
        id: `imp-json-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        importHash,
        date,
        type,
        amount,
        description,
        category,
        isDuplicate,
        selected: !isDuplicate,
        rawLine: JSON.stringify(item),
      });
    }

    return {
      headers: ['Date', 'Description', 'Amount', 'Type', 'Category'],
      transactions,
      totalFound: transactions.length,
      duplicatesCount,
      newCount: transactions.length - duplicatesCount,
      detectedColumns: { dateCol: 0, descCol: 1, amountCol: 2, debitCol: -1, creditCol: -1 },
    };
  } catch {
    return null;
  }
}

/**
 * Parse full bank statement CSV or JSON with duplicate prevention
 */
export function parseBankCsv(
  csvText: string,
  existingFunds: FundEntry[] = [],
  customColIndices?: {
    dateCol?: number;
    descCol?: number;
    amountCol?: number;
    debitCol?: number;
    creditCol?: number;
  }
): BankCsvParseResult {
  const existingHashes = new Set<string>();
  for (const f of existingFunds) {
    if (f.importHash) {
      existingHashes.add(f.importHash);
    }
    const synHash = generateTransactionHash(f.date, f.amount, f.type, f.description);
    existingHashes.add(synHash);
  }

  const trimmed = (csvText || '').trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const jsonRes = parseBankJson(trimmed, existingHashes);
    if (jsonRes) return jsonRes;
  }

  // Parse standard RFC-4180 CSV
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return {
      headers: [],
      transactions: [],
      totalFound: 0,
      duplicatesCount: 0,
      newCount: 0,
      detectedColumns: { dateCol: 0, descCol: 1, amountCol: 2, debitCol: -1, creditCol: -1 },
    };
  }

  const headers = rows[0];
  const detected = customColIndices
    ? {
        dateCol: customColIndices.dateCol ?? 0,
        descCol: customColIndices.descCol ?? 1,
        amountCol: customColIndices.amountCol ?? 2,
        debitCol: customColIndices.debitCol ?? -1,
        creditCol: customColIndices.creditCol ?? -1,
        categoryCol: -1,
        typeCol: -1,
      }
    : detectColumns(headers);

  const transactions: ParsedBankTransaction[] = [];
  let duplicatesCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;

    const rawDate = row[detected.dateCol];
    const date = normalizeDate(rawDate);
    if (!date) continue; // Skip lines with invalid dates (summaries, headers, etc.)

    const sanitizeCsvField = (val: string, maxLen = 240): string => {
      const cleaned = (val || '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
      if (cleaned === '__proto__' || cleaned === 'constructor' || cleaned === 'prototype') {
        return 'Transaction';
      }
      return cleaned;
    };

    const description = sanitizeCsvField(row[detected.descCol] || 'Bank Transaction', 240);
    if (!description) continue;

    let type: 'income' | 'expense' = 'expense';
    let amount = 0;

    // Separate Debit/Credit columns
    if (detected.debitCol >= 0 || detected.creditCol >= 0) {
      const rawDebit = detected.debitCol >= 0 ? row[detected.debitCol] : '';
      const rawCredit = detected.creditCol >= 0 ? row[detected.creditCol] : '';

      const debitParsed = parseAmount(rawDebit);
      const creditParsed = parseAmount(rawCredit);

      if (creditParsed && creditParsed.amount > 0) {
        amount = creditParsed.amount;
        type = 'income';
      } else if (debitParsed && debitParsed.amount > 0) {
        amount = debitParsed.amount;
        type = 'expense';
      } else if (detected.amountCol >= 0) {
        const amtParsed = parseAmount(row[detected.amountCol]);
        if (amtParsed) {
          amount = amtParsed.amount;
          type = amtParsed.isNegative ? 'expense' : 'income';
        }
      }
    } else if (detected.amountCol >= 0) {
      const amtParsed = parseAmount(row[detected.amountCol]);
      if (amtParsed) {
        amount = amtParsed.amount;
        type = amtParsed.isNegative ? 'expense' : 'income';
      }
    }

    // Check explicit Type column if present
    if (detected.typeCol !== undefined && detected.typeCol >= 0 && row[detected.typeCol]) {
      const explicitType = row[detected.typeCol].toLowerCase().trim();
      if (explicitType === 'income' || explicitType === 'credit' || explicitType === 'deposit') {
        type = 'income';
      } else if (
        explicitType === 'expense' ||
        explicitType === 'debit' ||
        explicitType === 'withdrawal'
      ) {
        type = 'expense';
      }
    }

    if (amount <= 0) continue;

    const explicitCategory =
      detected.categoryCol !== undefined && detected.categoryCol >= 0
        ? sanitizeCsvField(row[detected.categoryCol] || '', 64)
        : '';
    const category = explicitCategory || inferCategory(description);

    const importHash = generateTransactionHash(date, amount, type, description);
    const isDuplicate = existingHashes.has(importHash);

    if (isDuplicate) {
      duplicatesCount++;
    } else {
      existingHashes.add(importHash); // prevent duplicates within the same CSV file
    }

    transactions.push({
      id: `imp-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
      importHash,
      date,
      type,
      amount,
      description,
      category,
      isDuplicate,
      selected: !isDuplicate, // auto-select new entries, leave duplicates unchecked
      rawLine: sanitizeCsvField(row.join(', '), 500),
    });
  }

  return {
    headers,
    transactions,
    totalFound: transactions.length,
    duplicatesCount,
    newCount: transactions.length - duplicatesCount,
    detectedColumns: detected,
  };
}
