import { test } from 'node:test';
import assert from 'node:assert';
import { parseCsvRows, normalizeDate, parseAmount, inferCategory, parseBankCsv, generateTransactionHash } from './bankCsvParser';
import { FundEntry } from '../types';

test('parseCsvRows handles quoted commas and empty lines correctly', () => {
  const csv = `Date,Description,Amount\n"10/12/2026","Trader Joe's, Grocery Store",-45.20\n2026-10-15,"Coffee, Tea & Co",-4.75\n`;
  const rows = parseCsvRows(csv);
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[1][1], "Trader Joe's, Grocery Store");
  assert.strictEqual(rows[1][2], "-45.20");
  assert.strictEqual(rows[2][1], "Coffee, Tea & Co");
});

test('normalizeDate parses multiple standard bank date strings', () => {
  assert.strictEqual(normalizeDate('10/21/2026'), '2026-10-21');
  assert.strictEqual(normalizeDate('2026-10-21'), '2026-10-21');
  assert.strictEqual(normalizeDate('1/5/2026'), '2026-01-05');
});

test('parseAmount parses currencies and signs', () => {
  assert.deepStrictEqual(parseAmount('$1,250.00'), { amount: 1250, isNegative: false });
  assert.deepStrictEqual(parseAmount('-$45.50'), { amount: 45.50, isNegative: true });
  assert.deepStrictEqual(parseAmount('(99.00)'), { amount: 99, isNegative: true });
});

test('inferCategory recognizes common merchants', () => {
  assert.strictEqual(inferCategory('Kroger Store #123'), 'Groceries');
  assert.strictEqual(inferCategory('Starbucks Downtown'), 'Dining & Food');
  assert.strictEqual(inferCategory('Amazon Web Services AWS'), 'Cloud & Engineering');
  assert.strictEqual(inferCategory('Client Direct Deposit Payroll'), 'Client / Income');
});

test('parseBankCsv correctly parses standard bank CSV and filters duplicates', () => {
  const csv = `Transaction Date,Description,Amount
10/20/2026,Trader Joe's Market,-42.50
10/21/2026,Client Consulting Wire,3500.00
10/20/2026,Trader Joe's Market,-42.50`;

  const existing: FundEntry[] = [
    {
      id: 'f1',
      date: '2026-10-20',
      type: 'expense',
      amount: 42.50,
      category: 'Groceries',
      description: "Trader Joe's Market",
      createdAt: 1000,
    },
  ];

  const res = parseBankCsv(csv, existing);
  assert.strictEqual(res.totalFound, 3);
  // The first Trader Joe row is marked duplicate due to existing ledger
  assert.strictEqual(res.transactions[0].isDuplicate, true);
  assert.strictEqual(res.transactions[0].selected, false);

  // The client wire is new and selected
  assert.strictEqual(res.transactions[1].type, 'income');
  assert.strictEqual(res.transactions[1].amount, 3500);
  assert.strictEqual(res.transactions[1].isDuplicate, false);
  assert.strictEqual(res.transactions[1].selected, true);

  // The 3rd row is also duplicate of the 1st
  assert.strictEqual(res.transactions[2].isDuplicate, true);
});

test('parseBankCsv supports JSON transaction arrays and explicit Category/Type CSV columns', () => {
  const csvWithCat = `Date,Description,Amount,Category,Type\n2026-10-21,"Local Grocery Market",58.40,Custom Provisions,expense\n`;
  const csvRes = parseBankCsv(csvWithCat, []);
  assert.strictEqual(csvRes.totalFound, 1);
  assert.strictEqual(csvRes.transactions[0].category, 'Custom Provisions');
  assert.strictEqual(csvRes.transactions[0].type, 'expense');
  assert.strictEqual(csvRes.transactions[0].amount, 58.4);

  const jsonPayload = JSON.stringify([
    {
      date: '2026-10-22',
      description: 'Axiom Client Wire',
      amount: 2400,
      type: 'income',
      category: 'Consulting',
    },
    {
      date: '2026-10-23',
      description: 'Cloud Compute Cluster',
      amount: -64.5,
    },
  ]);

  const jsonRes = parseBankCsv(jsonPayload, []);
  assert.strictEqual(jsonRes.totalFound, 2);
  assert.strictEqual(jsonRes.transactions[0].description, 'Axiom Client Wire');
  assert.strictEqual(jsonRes.transactions[0].type, 'income');
  assert.strictEqual(jsonRes.transactions[0].category, 'Consulting');
  assert.strictEqual(jsonRes.transactions[1].description, 'Cloud Compute Cluster');
  assert.strictEqual(jsonRes.transactions[1].type, 'expense');
  assert.strictEqual(jsonRes.transactions[1].amount, 64.5);
});

