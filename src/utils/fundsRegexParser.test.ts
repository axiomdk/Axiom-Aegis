import { test } from 'node:test';
import assert from 'node:assert';
import {
  parseCurrencyAmount,
  recalculateFundsTotal,
  classifyTransaction,
  parseFundsOcrText,
  FundsOcrItem,
} from './fundsRegexParser';

test('1. parseCurrencyAmount parses plain and comma-separated dollar amounts', () => {
  assert.strictEqual(parseCurrencyAmount('$48.50'), 48.5);
  assert.strictEqual(parseCurrencyAmount('$1,250.00'), 1250);
  assert.strictEqual(parseCurrencyAmount('36.25'), 36.25);
  assert.strictEqual(parseCurrencyAmount('-$12.00'), 12);
  assert.strictEqual(parseCurrencyAmount('$0.00'), 0);
  assert.strictEqual(parseCurrencyAmount('invalid'), 0);
});

test('2. recalculateFundsTotal accurately computes totalNet, totalIncome, and totalExpense', () => {
  const items: FundsOcrItem[] = [
    { id: '1', description: 'Base Pay', amount: 48.5, type: 'income', category: 'Delivery' },
    { id: '2', description: 'Customer Tips', amount: 36.0, type: 'income', category: 'Tips' },
    { id: '3', description: 'Gas Fill-Up', amount: 24.5, type: 'expense', category: 'Transportation' },
    { id: '4', description: 'Instant Cashout Fee', amount: 1.99, type: 'expense', category: 'Fees' },
  ];

  const { totalNet, totalIncome, totalExpense } = recalculateFundsTotal(items);
  assert.strictEqual(totalIncome, 84.5);
  assert.strictEqual(totalExpense, 26.49);
  assert.strictEqual(totalNet, 58.01);
});

test('3. classifyTransaction distinguishes earnings from deductions and expenses', () => {
  assert.strictEqual(classifyTransaction('Base Pay delivery fare').type, 'income');
  assert.strictEqual(classifyTransaction('Customer Tip from order').type, 'income');
  assert.strictEqual(classifyTransaction('Peak Boost promotions').type, 'income');
  assert.strictEqual(classifyTransaction('Instant Cashout Fee').type, 'expense');
  assert.strictEqual(classifyTransaction('Shell Gas Station Fuel').type, 'expense');
  assert.strictEqual(classifyTransaction('Trader Joe Groceries Provisions').type, 'expense');
  assert.strictEqual(classifyTransaction('-$14.50 service charge').type, 'expense');
});

test('4. parseFundsOcrText extracts Total Earnings header and excludes it from line items to prevent double-counting', () => {
  const earningsScreenshotText = `
DoorDash Dasher Payout Summary
Thursday, Oct 22
Total Earnings: $148.50

Base Pay
$54.00

Customer Tips
$72.50

Peak Pay Promotions
$22.00

Instant Cashout Fee
-$1.99
`;

  const parsed = parseFundsOcrText(earningsScreenshotText);

  // Summary detected
  assert.strictEqual(parsed.summary_amount, 148.5);
  assert.strictEqual(parsed.summary_total_displayed, '$148.50');

  // Should have 4 items (Base Pay, Customer Tips, Peak Pay, Instant Cashout Fee)
  // And NOT 5 (Total Earnings must be excluded to prevent double-counting)
  assert.strictEqual(parsed.items.length, 4);

  // Verify amounts
  assert.strictEqual(parsed.items[0].amount, 54.0);
  assert.strictEqual(parsed.items[0].type, 'income');

  assert.strictEqual(parsed.items[1].amount, 72.5);
  assert.strictEqual(parsed.items[1].type, 'income');

  assert.strictEqual(parsed.items[2].amount, 22.0);
  assert.strictEqual(parsed.items[2].type, 'income');

  assert.strictEqual(parsed.items[3].amount, 1.99);
  assert.strictEqual(parsed.items[3].type, 'expense');

  // Net amount = 54 + 72.5 + 22 - 1.99 = 146.51
  assert.strictEqual(parsed.total_net_amount, 146.51);
});

test('5. parseFundsOcrText filters out non-currency numbers like ratings, timestamps, and order counts', () => {
  const noisyReceiptText = `
Deliveries: 12
Rating: 4.95
Acceptance: 92%
Completed at 6:45 PM
Order #883921
Subtotal: $34.20
Tax: $2.80
Tip: $8.00
`;

  const parsed = parseFundsOcrText(noisyReceiptText);

  // Should only extract lines with currency amounts
  assert.ok(parsed.items.length >= 3);
  for (const item of parsed.items) {
    assert.ok(item.amount > 0);
  }
});

test('6. parseFundsOcrText handles empty text gracefully', () => {
  const empty = parseFundsOcrText('');
  assert.strictEqual(empty.total_net_amount, 0);
  assert.strictEqual(empty.items.length, 0);
  assert.strictEqual(empty.summary_amount, null);
});

test('7. parseFundsOcrText excludes bank statement summary lines (Beginning/Ending balance, Total Deposits) and extracts dates', () => {
  const bankStatementText = `
CHASE TOTAL CHECKING
Statement Period: Oct 01, 2026 to Oct 31, 2026
Beginning Balance $1,450.00
Total Deposits and Additions $2,850.00
Total Withdrawals and Subtractions $620.00
Ending Balance $3,680.00

TRANSACTION DETAIL
2026-10-05 DoorDash Direct Dep $420.00
10/12/2026 Speedway Fuel -$45.20
Oct 18, 2026 Meijer Groceries -$115.50
2026-10-22 Uber Trip Earnings $180.00
`;

  const parsed = parseFundsOcrText(bankStatementText);

  // Beginning Balance, Ending Balance, Total Deposits, and Total Withdrawals must NOT be in items
  const descriptions = parsed.items.map((i) => i.description.toLowerCase());
  assert.strictEqual(descriptions.some((d) => d.includes('beginning balance')), false);
  assert.strictEqual(descriptions.some((d) => d.includes('ending balance')), false);
  assert.strictEqual(descriptions.some((d) => d.includes('total deposits')), false);
  assert.strictEqual(descriptions.some((d) => d.includes('total withdrawals')), false);

  // Should have exactly 4 transaction items
  assert.strictEqual(parsed.items.length, 4);

  // Check extracted dates
  const doordash = parsed.items.find((i) => i.description.toLowerCase().includes('doordash'));
  assert.ok(doordash);
  assert.strictEqual(doordash.date, '2026-10-05');
  assert.strictEqual(doordash.amount, 420.0);
  assert.strictEqual(doordash.type, 'income');

  const speedway = parsed.items.find((i) => i.description.toLowerCase().includes('speedway'));
  assert.ok(speedway);
  assert.strictEqual(speedway.date, '2026-10-12');
  assert.strictEqual(speedway.amount, 45.2);
  assert.strictEqual(speedway.type, 'expense');

  const meijer = parsed.items.find((i) => i.description.toLowerCase().includes('meijer'));
  assert.ok(meijer);
  assert.strictEqual(meijer.date, '2026-10-18');
  assert.strictEqual(meijer.amount, 115.5);
  assert.strictEqual(meijer.type, 'expense');
});

test('8. recalculateFundsTotal dynamically recomputes totals when items are checked or unchecked', () => {
  const items: FundsOcrItem[] = [
    { id: '1', description: 'Base Pay', amount: 100, type: 'income', category: 'Gig', selected: true },
    { id: '2', description: 'Stray Number', amount: 50, type: 'income', category: 'Gig', selected: false }, // unchecked
    { id: '3', description: 'Gas', amount: 30, type: 'expense', category: 'Fuel', selected: true },
  ];

  const totals = recalculateFundsTotal(items);
  assert.strictEqual(totals.totalIncome, 100); // 50 skipped
  assert.strictEqual(totals.totalExpense, 30);
  assert.strictEqual(totals.totalNet, 70);
  assert.strictEqual(totals.selectedCount, 2);
  assert.strictEqual(totals.totalCount, 3);
});

test('9. parseFundsOcrText strictly rejects multi-column balance rows, header fragments, and orphan decimals while classifying withdrawals as expense', async () => {
  const { sanitizeFundEntries, isMalformedFundDescription } = await import('./fundsRegexParser');

  const corruptedStatementText = `
Summary of Account Activity
Beginning balance Total additions Total subtractions Ending balance
620.59 596.74 16.85 7.00
Additions totaling . Date Amount Description
.75
0.00
Subtractions totaling $16.85
Date Amount Description
10/14 $596.74 Gusto Payroll Direct Deposit
10/16 $16.85 Spotify USA Subscription
`;

  const parsed = parseFundsOcrText(corruptedStatementText);
  assert.strictEqual(parsed.items.length, 2);
  assert.strictEqual(parsed.items[0].description, 'Gusto Payroll Direct Deposit');
  assert.strictEqual(parsed.items[0].type, 'income');
  assert.strictEqual(parsed.items[1].description, 'Spotify USA Subscription');
  assert.strictEqual(parsed.items[1].type, 'expense');

  assert.strictEqual(isMalformedFundDescription('620.59 596.74 16.85'), true);
  assert.strictEqual(isMalformedFundDescription('.75'), true);
  assert.strictEqual(isMalformedFundDescription('Additions totaling . Date Amount Description'), true);
  assert.strictEqual(isMalformedFundDescription('Gusto Payroll Direct Deposit'), false);

  const rawLedger = [
    {
      id: 'bad-1',
      date: '2026-10-20',
      amount: 7.0,
      type: 'income' as const,
      category: 'General Income',
      description: '620.59 596.74 16.85',
      createdAt: 1,
    },
    {
      id: 'bad-2',
      date: '2026-10-20',
      amount: 0.75,
      type: 'income' as const,
      category: 'General Income',
      description: '.75',
      createdAt: 2,
    },
    {
      id: 'bad-3',
      date: '2026-10-20',
      amount: 596.74,
      type: 'income' as const,
      category: 'General Income',
      description: 'Additions totaling . Date Amount Description',
      createdAt: 3,
    },
    {
      id: 'good-1',
      date: '2026-10-21',
      amount: 3400,
      type: 'income' as const,
      category: 'Client / Consulting',
      description: 'Axiom Consulting Retainer',
      createdAt: 4,
    },
  ];

  const { sanitized, removedCount } = sanitizeFundEntries(rawLedger);
  assert.strictEqual(sanitized.length, 1);
  assert.strictEqual(removedCount, 3);
  assert.strictEqual(sanitized[0].id, 'good-1');
});

test('10. parseFundsOcrText strips trailing running balance columns and supports multi-line PDF cells', () => {
  const runningBalanceStatement = `
WELLS FARGO CHECKING STATEMENT
Statement Period: 10/01/2026 - 10/31/2026
Beginning Balance $2,000.00
Transaction Detail
10/05 Direct Deposit Payroll $1,800.00 $3,800.00
10/12 Speedway Fuel -$45.20 $3,754.80
10/18
Meijer Groceries
-$112.40
Ending Balance $3,642.40
`;

  const parsed = parseFundsOcrText(runningBalanceStatement);
  assert.strictEqual(parsed.items.length, 3);

  assert.strictEqual(parsed.items[0].description, 'Direct Deposit Payroll');
  assert.strictEqual(parsed.items[0].amount, 1800.0);
  assert.strictEqual(parsed.items[0].type, 'income');
  assert.strictEqual(parsed.items[0].date, '2026-10-05');

  assert.strictEqual(parsed.items[1].description, 'Speedway Fuel');
  assert.strictEqual(parsed.items[1].amount, 45.2);
  assert.strictEqual(parsed.items[1].type, 'expense');
  assert.strictEqual(parsed.items[1].date, '2026-10-12');

  assert.strictEqual(parsed.items[2].description, 'Meijer Groceries');
  assert.strictEqual(parsed.items[2].amount, 112.4);
  assert.strictEqual(parsed.items[2].type, 'expense');
  assert.strictEqual(parsed.items[2].date, '2026-10-18');
});

test('11. extractTextFromPdfBufferNative and extractTextFromPdf extract transactions from generated PDF statement bytes', async () => {
  const {
    generateSampleBankStatementPdfBytes,
    extractTextFromPdfBufferNative,
    extractTextFromPdf,
  } = await import('./pdfParser');

  const pdfBytes = generateSampleBankStatementPdfBytes();
  const nativeExtracted = await extractTextFromPdfBufferNative(
    pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
  );

  assert.strictEqual(nativeExtracted.pageCount, 1);
  assert.ok(nativeExtracted.text.includes('Direct Deposit Payroll'));
  assert.ok(nativeExtracted.text.includes('Speedway Fuel Station'));

  const fullPdfResult = await extractTextFromPdf(pdfBytes, undefined, 'Statement.pdf');
  const parsed = parseFundsOcrText(fullPdfResult.text);

  assert.strictEqual(parsed.items.length, 6);
  assert.strictEqual(parsed.total_income, 2300.5);
  assert.strictEqual(parsed.total_expense, 200.15);
  assert.strictEqual(parsed.total_net_amount, 2100.35);
});


