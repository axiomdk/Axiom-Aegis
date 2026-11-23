import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  FundEntry,
  FundsColumnId,
  CustomTableColumnDef,
  RecurrenceFrequency,
  BillEntry,
  BillFrequency,
} from '../types';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Edit2,
  Search,
  SlidersHorizontal,
  X,
  Columns,
  RotateCcw,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Camera,
  ChevronDown,
  Wrench,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  calculateFundsSummary,
  reconcileGoalsWithNetBalance,
  calculateBillsSummary,
  evaluateBillDueStatus,
} from '../utils/calculations';
import { calculateFinancialRunwayAndBurn } from '../utils/aegisUpgradesEngine';
import { sanitizeFundEntries } from '../utils/fundsRegexParser';
import { InlineCategoryBadge } from './InlineCategoryBadge';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { isFormStateDirty } from '../utils/modalGuardEngine';

const DEFAULT_FUNDS_COLUMNS: FundsColumnId[] = [
  'date',
  'type',
  'category',
  'description',
  'amount',
  'actions',
];

const COLUMN_LABELS: Record<string, string> = {
  date: 'Date',
  type: 'Type',
  category: 'Category',
  description: 'Description',
  amount: 'Amount (USD)',
  actions: 'Actions',
};

export const FundsView: React.FC = () => {
  const {
    appData,
    updateAppData,
    isEditMode,
    isColumnEditMode,
    layoutConfig,
    updateLayoutConfig,
    openQuickAdd,
    openImportHub,
    accent,
    showNotification,
  } = useVault();

  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedStatementMonth, setSelectedStatementMonth] = useState<string>('auto');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingEntry, setEditingEntry] = useState<FundEntry | null>(null);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showUtilityMenu, setShowUtilityMenu] = useState(false);
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);
  const [tempStartingBalance, setTempStartingBalance] = useState<string>(
    String(appData?.settings?.startingBalance || 0)
  );

  useEffect(() => {
    if (!showUtilityMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(e.target as Node)) {
        setShowUtilityMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUtilityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showUtilityMenu]);

  const startingBalance = appData?.settings?.startingBalance || 0;
  const funds = appData?.funds || [];
  const bills = appData?.bills || [];

  // Bills Subsection State
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState('15');
  const [billFrequency, setBillFrequency] = useState<BillFrequency>('monthly');
  const [billCategory, setBillCategory] = useState('Utilities');
  const [billAutoPay, setBillAutoPay] = useState(false);
  const [billIsPaid, setBillIsPaid] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [billFilter, setBillFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  const billsSummary = useMemo(() => calculateBillsSummary(bills), [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (billFilter === 'unpaid' && b.isPaid) return false;
      if (billFilter === 'paid' && !b.isPaid) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.name.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          String(b.amount).includes(q) ||
          b.dueDate.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bills, billFilter, searchQuery]);

  const resetBillForm = () => {
    setBillName('');
    setBillAmount('');
    setBillDueDate('15');
    setBillFrequency('monthly');
    setBillCategory('Utilities');
    setBillAutoPay(false);
    setBillIsPaid(false);
    setEditingBillId(null);
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = billName.trim();
    const parsedAmount = parseFloat(billAmount);
    if (!trimmedName || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      showNotification('Enter a valid bill name and amount', 'error');
      return;
    }

    const now = Date.now();
    if (editingBillId) {
      await updateAppData((prev) => ({
        ...prev,
        bills: (prev.bills || []).map((b) =>
          b.id === editingBillId
            ? {
                ...b,
                name: trimmedName,
                amount: Math.round(parsedAmount * 100) / 100,
                dueDate: billDueDate.trim() || '1',
                frequency: billFrequency,
                category: billCategory.trim() || 'General',
                autoPay: billAutoPay,
                isPaid: billIsPaid,
                lastPaidDate: billIsPaid ? b.lastPaidDate || new Date().toISOString().slice(0, 10) : undefined,
              }
            : b
        ),
      }));
      showNotification(`Updated bill "${trimmedName}"`, 'success');
    } else {
      const newBill: BillEntry = {
        id: `bill_${now}_${Math.random().toString(36).slice(2, 7)}`,
        name: trimmedName,
        amount: Math.round(parsedAmount * 100) / 100,
        dueDate: billDueDate.trim() || '1',
        frequency: billFrequency,
        category: billCategory.trim() || 'General',
        autoPay: billAutoPay,
        isPaid: billIsPaid,
        lastPaidDate: billIsPaid ? new Date().toISOString().slice(0, 10) : undefined,
        createdAt: now,
      };
      await updateAppData((prev) => ({
        ...prev,
        bills: [newBill, ...(prev.bills || [])],
      }));
      showNotification(`Added bill "${trimmedName}"`, 'success');
    }

    resetBillForm();
  };

  const handleStartEditBill = (bill: BillEntry) => {
    setEditingBillId(bill.id);
    setBillName(bill.name);
    setBillAmount(String(bill.amount));
    setBillDueDate(bill.dueDate);
    setBillFrequency(bill.frequency || 'monthly');
    setBillCategory(bill.category || 'Utilities');
    setBillAutoPay(Boolean(bill.autoPay));
    setBillIsPaid(Boolean(bill.isPaid));
  };

  const handleToggleBillPaid = async (bill: BillEntry) => {
    const nextPaid = !bill.isPaid;
    await updateAppData((prev) => ({
      ...prev,
      bills: (prev.bills || []).map((b) =>
        b.id === bill.id
          ? {
              ...b,
              isPaid: nextPaid,
              lastPaidDate: nextPaid ? new Date().toISOString().slice(0, 10) : undefined,
            }
          : b
      ),
    }));
    showNotification(
      `Marked "${bill.name}" as ${nextPaid ? 'PAID' : 'UNPAID'}`,
      nextPaid ? 'success' : 'info'
    );
  };

  const handleToggleBillAutoPay = async (bill: BillEntry) => {
    const nextAuto = !bill.autoPay;
    await updateAppData((prev) => ({
      ...prev,
      bills: (prev.bills || []).map((b) =>
        b.id === bill.id ? { ...b, autoPay: nextAuto } : b
      ),
    }));
    showNotification(
      `Auto-Pay ${nextAuto ? 'enabled' : 'disabled'} for "${bill.name}"`,
      'info'
    );
  };

  const handleDeleteBill = async (bill: BillEntry) => {
    await updateAppData((prev) => ({
      ...prev,
      bills: (prev.bills || []).filter((b) => b.id !== bill.id),
    }));
    if (editingBillId === bill.id) {
      resetBillForm();
    }
    showNotification(`Removed bill "${bill.name}"`, 'info');
  };

  const isBalanceDirty =
    showBalanceEditor && String(tempStartingBalance).trim() !== String(startingBalance);

  const balanceGuard = useModalGuard({
    isOpen: showBalanceEditor,
    isDirty: isBalanceDirty,
    onClose: () => setShowBalanceEditor(false),
  });

  const originalFundEntry = useMemo(() => {
    if (!editingEntry) return null;
    return funds.find((f) => f.id === editingEntry.id) || null;
  }, [editingEntry?.id, funds]);

  const isEditFundDirty = useMemo(() => {
    if (!editingEntry || !originalFundEntry) return false;
    return isFormStateDirty(
      originalFundEntry as unknown as Record<string, unknown>,
      editingEntry as unknown as Record<string, unknown>
    );
  }, [editingEntry, originalFundEntry]);

  const editFundGuard = useModalGuard({
    isOpen: Boolean(editingEntry),
    isDirty: isEditFundDirty,
    onClose: () => setEditingEntry(null),
  });

  const visibleColumnsOrder: FundsColumnId[] = DEFAULT_FUNDS_COLUMNS;

  const getColLabel = (colId: FundsColumnId) => COLUMN_LABELS[colId] || colId;

  const availableStatementMonths = useMemo(() => {
    const months = new Set<string>();
    for (const f of funds) {
      if (typeof f.date === 'string' && /^\d{4}-\d{2}/.test(f.date)) {
        months.add(f.date.slice(0, 7));
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [funds]);

  const summary = useMemo(
    () =>
      calculateFundsSummary(
        funds,
        startingBalance,
        selectedStatementMonth === 'auto' ? undefined : selectedStatementMonth
      ),
    [funds, startingBalance, selectedStatementMonth]
  );

  const runwaySummary = useMemo(
    () => calculateFinancialRunwayAndBurn(funds, startingBalance),
    [funds, startingBalance]
  );

  // Group by category for an analytical distribution bar
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of funds) {
      if (f.type === 'expense') {
        map[f.category] = (map[f.category] || 0) + f.amount;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [funds]);

  const filteredFunds = useMemo(() => {
    return funds.filter((item) => {
      if (
        selectedStatementMonth !== 'all' &&
        typeof item.date === 'string' &&
        !item.date.startsWith(summary.activeStatementMonth)
      ) {
        return false;
      }
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          String(item.amount).includes(q)
        );
      }
      return true;
    });
  }, [funds, typeFilter, searchQuery, selectedStatementMonth, summary.activeStatementMonth]);

  const handleDelete = async (id: string, desc: string) => {
    await updateAppData((prev) => ({
      ...prev,
      funds: prev.funds.filter((f) => f.id !== id),
    }));
    showNotification(`Transaction "${desc}" deleted.`, 'info');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    await updateAppData((prev) => ({
      ...prev,
      funds: prev.funds.map((f) => (f.id === editingEntry.id ? editingEntry : f)),
    }));

    showNotification('Transaction updated!', 'success');
    setEditingEntry(null);
  };

  const handleSaveStartingBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempStartingBalance);
    if (isNaN(val)) return;

    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        startingBalance: val,
      },
    }));

    showNotification(`Starting balance updated to $${val.toFixed(2)} USD`, 'success');
    setShowBalanceEditor(false);
  };

  const handlePurgeMalformedRows = async () => {
    const currentFunds = appData?.funds || [];
    const { sanitized, removedCount } = sanitizeFundEntries(currentFunds);
    const nextSummary = calculateFundsSummary(sanitized, startingBalance);

    await updateAppData((prev) => {
      const cleaned = sanitizeFundEntries(prev.funds || []).sanitized;
      const netBal = calculateFundsSummary(
        cleaned,
        prev.settings?.startingBalance || 0
      ).currentBalance;
      return {
        ...prev,
        funds: cleaned,
        goals: reconcileGoalsWithNetBalance(prev.goals || [], netBal),
      };
    });

    if (removedCount > 0) {
      showNotification(
        `Purged ${removedCount} malformed ledger row${
          removedCount === 1 ? '' : 's'
        } • Net Funds Balance recalculated to $${nextSummary.currentBalance.toFixed(2)} USD`,
        'success'
      );
    } else {
      showNotification(
        `Ledger verified clean • 0 malformed rows found (Net Balance: $${nextSummary.currentBalance.toFixed(
          2
        )} USD)`,
        'info'
      );
    }
  };

  // Cell renderer according to column ID
  const renderCell = (colId: FundsColumnId, entry: FundEntry) => {
    switch (colId) {
      case 'date':
        return <span className="font-mono text-zinc-400">{entry.date}</span>;
      case 'type':
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono bg-[#000000] border border-[#1E222B] ${
              entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {entry.type === 'income' ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {entry.type}
          </span>
        );
      case 'category':
        return (
          <InlineCategoryBadge
            domain="funds"
            category={entry.category}
            size="xs"
            className="bg-[#000000] text-zinc-300 border-[#1E222B] font-medium"
          />
        );
      case 'description':
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{entry.description}</span>
            {entry.recurrence && entry.recurrence !== 'none' && (
              <span
                data-testid={`fund-recurring-badge-${entry.id}`}
                className="px-1.5 py-0.5 rounded bg-[#000000] border border-cyan-500/40 text-[10px] font-mono font-bold uppercase text-cyan-300"
              >
                RECURRING · {entry.recurrence}
              </span>
            )}
          </div>
        );
      case 'amount':
        return (
          <span
            className={`font-mono font-bold ${
              entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {entry.type === 'income' ? '+' : '-'}${entry.amount.toFixed(2)}
          </span>
        );
      case 'actions':
        return isEditMode ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditingEntry(entry)}
              data-testid={`mobile-edit-btn-fund-${entry.id}`}
              className="max-md:min-h-[40px] max-md:px-2.5 p-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-zinc-300 hover:text-white flex items-center gap-1"
              title="Edit Transaction"
            >
              <Edit2 className="w-3 h-3" />
              <span className="md:hidden text-[11px] font-mono">[Edit]</span>
            </button>
            <button
              onClick={() => handleDelete(entry.id, entry.description)}
              className="max-md:min-h-[40px] max-md:min-w-[40px] p-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-rose-400 hover:border-rose-500/40 flex items-center justify-center"
              title="Delete Transaction"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-600 font-mono">Locked</span>
        );
      default:
        return <span className="font-mono text-zinc-400">—</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-amber-400" />
            <span>Financial Ledger &amp; Account Reconciliation</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            USD currency • Net Balance:{' '}
            <strong className="font-mono text-emerald-400">
              ${(summary.currentBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>{' '}
            • Configurable table columns &amp; real-time reconciliation
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Unified Secondary Utility Dropdown Menu: Import CSV/JSON, Scan Screenshot OCR */}
          <div className="relative" ref={utilityMenuRef}>
            <button
              type="button"
              data-testid="funds-utility-menu-btn"
              onClick={() => setShowUtilityMenu((prev) => !prev)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showUtilityMenu
                  ? 'bg-[#1F232E] border-purple-500/40 text-purple-200 shadow-sm'
                  : 'bg-[#181B24] border-[#232732] text-zinc-300 hover:text-white hover:bg-[#1F232E]'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-purple-400" />
              <span>Ledger Tools</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                  showUtilityMenu ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>

            {showUtilityMenu && (
              <div
                data-testid="funds-utility-dropdown"
                className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#12141C] border border-[#262B38] shadow-2xl p-1.5 z-40 space-y-1"
              >
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-b border-[#1E222B]">
                  Utilities &amp; Data Ingestion
                </div>

                <button
                  type="button"
                  data-testid="funds-import-csv-btn"
                  onClick={() => {
                    setShowUtilityMenu(false);
                    openImportHub('bank_csv');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-left text-xs text-zinc-200 hover:bg-[#1A1E29] hover:text-white flex items-start gap-2.5 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold">Import CSV / JSON</div>
                    <div className="text-[10px] text-zinc-400">
                      Bank statements &amp; JSON with hash deduplication
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  data-testid="funds-scan-ocr-btn"
                  onClick={() => {
                    setShowUtilityMenu(false);
                    openImportHub('funds_ocr');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-left text-xs text-zinc-200 hover:bg-[#1A1E29] hover:text-white flex items-start gap-2.5 transition-colors"
                >
                  <Camera className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold">Scan PDF Statement / Receipt</div>
                    <div className="text-[10px] text-zinc-400">
                      PDF bank statement reader &amp; local Tesseract OCR
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  data-testid="funds-purge-malformed-menu-btn"
                  onClick={() => {
                    setShowUtilityMenu(false);
                    handlePurgeMalformedRows();
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-left text-xs text-zinc-200 hover:bg-[#1A1E29] hover:text-white flex items-start gap-2.5 transition-colors border-t border-[#1E222B]"
                >
                  <Trash2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold">Purge Malformed Rows</div>
                    <div className="text-[10px] text-zinc-400">
                      Remove corrupted PDF summary/numeric fragment rows
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Direct PDF Statement / Receipt Reader Quick Action */}
          <button
            type="button"
            data-testid="funds-open-pdf-reader-btn"
            onClick={() => openImportHub('funds_ocr')}
            title="Open Funds PDF Statement & Receipt Scanner"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[#000000] hover:border-cyan-500/50 border border-[#1E222B] text-cyan-300 hover:text-cyan-200 transition-all shadow-sm cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-cyan-400" />
            <span>Scan PDF / Receipt</span>
          </button>

          {/* Purge Malformed Rows Quick Action */}
          <button
            type="button"
            data-testid="funds-purge-malformed-btn"
            onClick={handlePurgeMalformedRows}
            title="Scan ledger for corrupted statement summary or numeric fragment rows and recalculate Net Balance"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[#000000] hover:border-rose-500/40 border border-[#1E222B] text-zinc-300 hover:text-white transition-all shadow-sm cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Purge Malformed Rows</span>
          </button>

          {/* Primary Action 1: Prominent Baseline / Balance Adjustment */}
          <button
            type="button"
            data-testid="funds-set-base-btn"
            onClick={() => setShowBalanceEditor(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#000000] hover:border-amber-500/50 border border-[#1E222B] text-amber-300 hover:text-amber-200 transition-all shadow-sm cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Set Base:</span>
            <span className="font-mono font-bold text-white">${startingBalance.toFixed(2)}</span>
          </button>

          {/* Primary Action 2: High-Impact + Record Entry CTA */}
          <button
            type="button"
            data-testid="funds-record-entry-btn"
            onClick={() => openQuickAdd('funds')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer ${accent.primaryBg}`}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Record Entry</span>
          </button>
        </div>
      </div>

      {/* Monthly Statement Financial Cycle Strip */}
      <div
        data-testid="funds-runway-burn-strip"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <div className="p-4 rounded-xl bg-[#000000] border border-[#1E222B] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Safe-to-Spend Balance</span>
            <span className="text-emerald-400 font-bold">STATEMENT NET</span>
          </div>
          <div
            data-testid="funds-safe-to-spend-val"
            className="text-lg font-black font-mono text-white tabular-nums"
          >
            $
            {runwaySummary.safeToSpendBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Net Balance minus ${runwaySummary.upcoming30dRecurringExpenses.toFixed(2)} fixed bills
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#000000] border border-[#1E222B] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Monthly Statement Outflow</span>
            <span className="text-rose-400 font-bold">{summary.activeStatementMonthLabel}</span>
          </div>
          <div
            data-testid="funds-daily-burn-val"
            className="text-lg font-black font-mono text-rose-400 tabular-nums"
          >
            ${summary.monthlyStatementExpense.toFixed(2)}
            <span className="text-xs text-zinc-400 font-normal">/mo</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Statement Inflow: +${summary.monthlyStatementIncome.toFixed(2)} ({summary.monthlyStatementCount} txns)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#000000] border border-[#1E222B] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Monthly Statement Net</span>
            <span
              className={
                summary.monthlyStatementNet >= 0
                  ? 'text-emerald-400 font-bold'
                  : 'text-amber-400 font-bold'
              }
            >
              {summary.activeStatementMonthLabel}
            </span>
          </div>
          <div
            data-testid="funds-monthly-velocity-val"
            className={`text-lg font-black font-mono tabular-nums ${
              summary.monthlyStatementNet >= 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {summary.monthlyStatementNet >= 0 ? '+' : '-'}$
            {Math.abs(summary.monthlyStatementNet).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <span className="text-xs text-zinc-400 font-normal">/mo</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {runwaySummary.runwayMonths !== null && runwaySummary.runwayMonths !== undefined
              ? `Est. Reserve Runway: ${runwaySummary.runwayMonths} mos`
              : 'Cashflow positive — infinite runway'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#000000] border border-[#1E222B] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Statement Cycle Filter</span>
            <span className="text-cyan-400 font-bold">MONTHLY</span>
          </div>
          <div className="pt-0.5">
            <select
              data-testid="funds-statement-month-select"
              value={selectedStatementMonth}
              onChange={(e) => setSelectedStatementMonth(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-[#1E222B] text-xs font-mono text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="auto">
                Active Statement ({summary.activeStatementMonthLabel})
              </option>
              <option value="all">All Statements ({funds.length} txns)</option>
              {availableStatementMonths.map((ym) => (
                <option key={ym} value={ym}>
                  Statement {ym}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[11px] font-mono text-zinc-500 truncate">
            Derived strictly from uploaded/logged monthly statements
          </div>
        </div>
      </div>

      {/* Unique Expense Distribution Analysis with Inline Category Rename */}
      {categoryTotals.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-300">
              Top Outflow Categories (Double-click or click pencil to rename across ledger)
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              Total Outflows: ${summary.totalExpense.toFixed(2)} USD
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {categoryTotals.slice(0, 6).map(([cat, amt]) => {
              const pct = Math.round((amt / (summary.totalExpense || 1)) * 100);
              return (
                <div
                  key={cat}
                  className="px-2.5 py-1.5 rounded-xl bg-[#000000] border border-[#1E222B] text-xs flex items-center gap-2"
                >
                  <InlineCategoryBadge
                    domain="funds"
                    category={cat}
                    size="xs"
                    isSelected={searchQuery.toLowerCase() === cat.toLowerCase()}
                    onSelect={() =>
                      setSearchQuery((prev) =>
                        prev.toLowerCase() === cat.toLowerCase() ? '' : cat
                      )
                    }
                    onRenamed={(oldName, newName) => {
                      if (searchQuery.toLowerCase() === oldName.toLowerCase()) {
                        setSearchQuery(newName);
                      }
                    }}
                  />
                  <span className="font-mono text-rose-400 font-bold">${amt.toFixed(2)}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Starting Balance Modal */}
      {showBalanceEditor && (
        <div
          onDoubleClick={balanceGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B] mb-4">
              <h3 className="text-sm font-bold text-white">Configure Starting Balance (USD)</h3>
              <button
                type="button"
                onClick={balanceGuard.requestExplicitClose}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <UnsavedChangesBanner
              isOpen={balanceGuard.showConfirmClose}
              onKeepEditing={balanceGuard.cancelClose}
              onDiscardAndClose={balanceGuard.confirmDiscardAndClose}
            />
            <form onSubmit={handleSaveStartingBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Baseline / Starting Balance ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tempStartingBalance}
                  onChange={(e) => setTempStartingBalance(e.target.value)}
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Net Balance = Starting Balance + Inflows - Outflows
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={balanceGuard.requestExplicitClose}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${accent.primaryBg}`}
                >
                  Save Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bills & Recurring Obligations Subsection */}
      <div
        data-testid="funds-bills-subsection"
        className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E222B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Bills &amp; Recurring Obligations
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {bills.length} {bills.length === 1 ? 'BILL' : 'BILLS'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                Track monthly obligations, due dates, auto-pay status, and paid vs. remaining cycle balances
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#000000] border border-[#1E222B] rounded-lg self-start sm:self-auto">
            <button
              type="button"
              data-testid="bills-filter-all"
              onClick={() => setBillFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                billFilter === 'all'
                  ? 'bg-[#121620] text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              All ({bills.length})
            </button>
            <button
              type="button"
              data-testid="bills-filter-unpaid"
              onClick={() => setBillFilter('unpaid')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                billFilter === 'unpaid'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              Unpaid ({billsSummary.unpaidCount})
            </button>
            <button
              type="button"
              data-testid="bills-filter-paid"
              onClick={() => setBillFilter('paid')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                billFilter === 'paid'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              Paid ({billsSummary.paidCount})
            </button>
          </div>
        </div>

        {/* Bills Summary KPI Strip */}
        <div
          data-testid="bills-kpi-strip"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400">
              <span>Total Monthly Bills</span>
              <span className="text-cyan-400 font-bold">EST. MONTHLY</span>
            </div>
            <div
              data-testid="bills-total-monthly-val"
              className="text-base font-black font-mono text-white tabular-nums"
            >
              $
              {billsSummary.totalMonthlyBills.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {billsSummary.autoPayCount} on Auto-Pay
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400">
              <span>Paid Balance</span>
              <span className="text-emerald-400 font-bold">CLEARED</span>
            </div>
            <div
              data-testid="bills-paid-amount-val"
              className="text-base font-black font-mono text-emerald-400 tabular-nums"
            >
              $
              {billsSummary.paidAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {billsSummary.paidCount} of {bills.length} bills paid
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400">
              <span>Remaining Unpaid</span>
              <span className="text-rose-400 font-bold">DUE</span>
            </div>
            <div
              data-testid="bills-unpaid-amount-val"
              className="text-base font-black font-mono text-rose-400 tabular-nums"
            >
              $
              {billsSummary.unpaidAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {billsSummary.unpaidCount} unpaid obligations remaining
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400">
              <span>Upcoming &amp; Overdue</span>
              <span
                className={
                  billsSummary.overdueCount > 0
                    ? 'text-rose-400 font-bold'
                    : billsSummary.dueSoonCount > 0
                    ? 'text-amber-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                STATUS
              </span>
            </div>
            <div
              data-testid="bills-status-summary-val"
              className="text-sm font-bold font-mono text-white tabular-nums flex items-center gap-2 pt-0.5"
            >
              <span className={billsSummary.overdueCount > 0 ? 'text-rose-400' : 'text-zinc-400'}>
                {billsSummary.overdueCount} Overdue
              </span>
              <span className="text-zinc-600">•</span>
              <span className={billsSummary.dueSoonCount > 0 ? 'text-amber-400' : 'text-zinc-400'}>
                {billsSummary.dueSoonCount} Due Soon
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              Click any status pill below to toggle Paid/Unpaid
            </div>
          </div>
        </div>

        {/* Add / Edit Bill Form */}
        <form
          data-testid="bills-form"
          onSubmit={handleSaveBill}
          className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Bill Name
              </label>
              <input
                type="text"
                data-testid="bill-name-input"
                required
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                placeholder="e.g. Electric Utility, Fiber Internet, Rent..."
                className="w-full px-3 py-1.5 rounded-lg bg-[#090B10] border border-[#1E222B] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Amount ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                data-testid="bill-amount-input"
                required
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 rounded-lg bg-[#090B10] border border-[#1E222B] text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Due Date / Day
              </label>
              <input
                type="text"
                data-testid="bill-duedate-input"
                required
                value={billDueDate}
                onChange={(e) => setBillDueDate(e.target.value)}
                placeholder="15 or YYYY-MM-DD"
                className="w-full px-3 py-1.5 rounded-lg bg-[#090B10] border border-[#1E222B] text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Frequency
              </label>
              <select
                data-testid="bill-frequency-select"
                value={billFrequency}
                onChange={(e) => setBillFrequency(e.target.value as BillFrequency)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-[#1E222B] text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
                <option value="once">One-Time</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Category
              </label>
              <input
                type="text"
                data-testid="bill-category-input"
                value={billCategory}
                onChange={(e) => setBillCategory(e.target.value)}
                placeholder="Utilities, Housing..."
                className="w-full px-3 py-1.5 rounded-lg bg-[#090B10] border border-[#1E222B] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="bill-autopay-toggle"
                onClick={() => setBillAutoPay((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  billAutoPay
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#090B10] text-zinc-400 border-[#1E222B] hover:text-zinc-200'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Auto-Pay: {billAutoPay ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                data-testid="bill-ispaid-toggle"
                onClick={() => setBillIsPaid((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  billIsPaid
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#090B10] text-zinc-400 border-[#1E222B] hover:text-zinc-200'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Status: {billIsPaid ? 'PAID' : 'UNPAID'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {editingBillId && (
                <button
                  type="button"
                  data-testid="bill-cancel-edit-btn"
                  onClick={resetBillForm}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 border border-zinc-700 cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                data-testid="bill-submit-btn"
                className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${accent.primaryBg}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingBillId ? 'Update Bill' : '+ Add Bill'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Interactive Bills List */}
        <div data-testid="bills-list" className="space-y-2">
          {filteredBills.length === 0 ? (
            <div
              data-testid="bills-empty-state"
              className="p-6 text-center rounded-xl bg-[#000000] border border-dashed border-[#1E222B] text-xs text-zinc-500 font-mono"
            >
              {bills.length === 0
                ? 'No bills configured yet. Add recurring or one-time bills above to track due dates and monthly obligations.'
                : 'No bills match the current filter.'}
            </div>
          ) : (
            filteredBills.map((bill) => {
              const dueEval = evaluateBillDueStatus(bill);
              return (
                <div
                  key={bill.id}
                  data-testid={`bill-row-${bill.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-[#2A303D] transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      data-testid={`bill-toggle-paid-${bill.id}`}
                      onClick={() => handleToggleBillPaid(bill)}
                      title={bill.isPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                        bill.isPaid
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : dueEval.status === 'overdue'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                          : dueEval.status === 'due_soon'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {bill.isPaid ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : dueEval.status === 'overdue' ? (
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-400" />
                      )}
                      <span>{dueEval.statusLabel}</span>
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold truncate ${
                            bill.isPaid ? 'line-through text-zinc-500' : 'text-white'
                          }`}
                        >
                          {bill.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#0D1017] text-zinc-300 border border-[#1E222B]">
                          {bill.category}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#0D1017] text-cyan-300 border border-cyan-500/20">
                          {bill.frequency}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span>Due: {dueEval.formattedDueDate}</span>
                        {bill.lastPaidDate && bill.isPaid && (
                          <span>• Paid {bill.lastPaidDate}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                    <button
                      type="button"
                      data-testid={`bill-toggle-autopay-${bill.id}`}
                      onClick={() => handleToggleBillAutoPay(bill)}
                      title="Toggle Auto-Pay"
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                        bill.autoPay
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                          : 'bg-[#090B10] text-zinc-500 border-[#1E222B] hover:text-zinc-300'
                      }`}
                    >
                      {bill.autoPay ? 'AUTO-PAY ON' : 'MANUAL PAY'}
                    </button>

                    <span
                      data-testid={`bill-amount-${bill.id}`}
                      className={`text-sm font-black font-mono tabular-nums ${
                        bill.isPaid ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      ${bill.amount.toFixed(2)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid={`bill-edit-${bill.id}`}
                        onClick={() => handleStartEditBill(bill)}
                        title="Edit bill"
                        className="p-1.5 rounded-lg bg-[#090B10] hover:bg-[#141821] text-zinc-400 hover:text-white border border-[#1E222B] cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`bill-delete-${bill.id}`}
                        onClick={() => handleDeleteBill(bill)}
                        title="Delete bill"
                        className="p-1.5 rounded-lg bg-[#090B10] hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-[#1E222B] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#000000] border border-[#1E222B] rounded-xl">
        <div className="flex items-center gap-1.5 p-1 bg-[#000000] border border-[#1E222B] rounded-lg">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
              typeFilter === 'all'
                ? 'bg-[#000000] text-white font-semibold border-zinc-600'
                : 'bg-[#000000] text-zinc-400 hover:text-white border-transparent'
            }`}
          >
            All Entries
          </button>
          <button
            onClick={() => setTypeFilter('income')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
              typeFilter === 'income'
                ? 'bg-[#000000] text-emerald-400 font-semibold border-emerald-500/40'
                : 'bg-[#000000] text-zinc-400 hover:text-white border-transparent'
            }`}
          >
            Inflow Only
          </button>
          <button
            onClick={() => setTypeFilter('expense')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
              typeFilter === 'expense'
                ? 'bg-[#000000] text-rose-400 font-semibold border-rose-500/40'
                : 'bg-[#000000] text-zinc-400 hover:text-white border-transparent'
            }`}
          >
            Outflow Only
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memo, category, amount..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Formatted Transaction Table */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg overflow-x-auto">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
          <h3 className="text-sm font-bold text-white">Formatted Ledger</h3>
          <span className="text-xs text-zinc-400 font-mono">
            Showing {filteredFunds.length} of {funds.length} transactions
          </span>
        </div>

        {filteredFunds.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
            <p>No transactions match your search or filter.</p>
            <button
              onClick={() => openQuickAdd('funds')}
              className="text-xs text-amber-400 hover:underline"
            >
              + Record a new transaction
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase font-mono text-zinc-400">
                {visibleColumnsOrder.map((colId) => (
                  <th key={colId} className="pb-3 px-3 font-semibold">
                    {getColLabel(colId)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222B]">
              {filteredFunds.map((entry) => (
                <tr
                  key={entry.id}
                  data-testid={`funds-ledger-row-${entry.id}`}
                  onDoubleClick={() => isEditMode && setEditingEntry(entry)}
                  title="Double-click row or click Edit icon to edit transaction"
                  className="hover:bg-zinc-900/40 transition-colors"
                >
                  {visibleColumnsOrder.map((colId) => (
                    <td key={colId} className="py-3 px-3 align-middle">
                      {renderCell(colId, entry)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingEntry && (
        <div
          onDoubleClick={editFundGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B] mb-4">
              <h3 className="text-sm font-bold text-white">Edit Transaction</h3>
              <button
                type="button"
                onClick={editFundGuard.requestExplicitClose}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={editFundGuard.showConfirmClose}
              onKeepEditing={editFundGuard.cancelClose}
              onDiscardAndClose={editFundGuard.confirmDiscardAndClose}
            />

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEditingEntry({ ...editingEntry, type: 'expense' })}
                  className={`py-1.5 rounded text-xs font-semibold ${
                    editingEntry.type === 'expense'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'text-zinc-400'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEntry({ ...editingEntry, type: 'income' })}
                  className={`py-1.5 rounded text-xs font-semibold ${
                    editingEntry.type === 'income'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-zinc-400'
                  }`}
                >
                  Income
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingEntry.amount}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editingEntry.date}
                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={editingEntry.category}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, category: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Recurrence
                  </label>
                  <select
                    value={editingEntry.recurrence || 'none'}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        recurrence: e.target.value as RecurrenceFrequency,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  >
                    <option value="none">One-Time (None)</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={editingEntry.description}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={editFundGuard.requestExplicitClose}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${accent.primaryBg}`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
