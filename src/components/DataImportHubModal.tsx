import React, { useState, useRef, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  X,
  FileSpreadsheet,
  HardDrive,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  Clock,
  Sparkles,
  Info,
  Camera,
  Clipboard,
  Plus,
  Trash2,
  Car,
  Footprints,
  Bike,
  Compass,
  ArrowRight,
  RefreshCw,
  Edit2,
  Check,
  Copy,
  FileText,
  ChevronDown,
  ChevronUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  DollarSign,
  Search,
  CheckSquare,
  Square,
  Calendar,
} from 'lucide-react';
import {
  parseBankCsv,
  ParsedBankTransaction,
  BankCsvParseResult,
  generateTransactionHash,
} from '../utils/bankCsvParser';
import { FundEntry, DistanceEntry, TimelineEntry, DistanceActivityType, ImportTabType } from '../types';
import {
  analyzeTimelineScreenshot,
  convertFileToBase64,
  getSampleTimelineOcrResult,
  TimelineOcrLeg,
  TimelineOcrResult,
} from '../services/timelineOcrService';
import { recalculateTotalDistance, parseTimelineOcrText } from '../utils/timelineRegexParser';
import { parseGoogleTakeoutJson } from '../utils/takeoutParser';
import { calculateFundsSummary, reconcileGoalsWithNetBalance } from '../utils/calculations';
import { APP_VERSION } from '../utils/version';
import {
  analyzeFundsDocument,
  analyzeFundsScreenshot,
  getSampleFundsOcrResult,
  parseFundsOcrText,
  generateSampleBankStatementPdfBytes,
  FundsOcrItem,
  FundsOcrResult,
} from '../services/fundsOcrService';
import { recalculateFundsTotal } from '../utils/fundsRegexParser';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';

export type { ImportTabType };

interface DataImportHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ImportTabType;
}

export const DataImportHubModal: React.FC<DataImportHubModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'bank_csv',
}) => {
  const {
    appData,
    updateAppData,
    accent,
    showNotification,
    exportEncryptedBackup,
    importEncryptedBackup,
    backupHealth,
  } = useVault();

  // Normalize initialTab
  const [activeTab, setActiveTab] = useState<ImportTabType>(
    initialTab === 'google_takeout' ? 'timeline_ocr' : initialTab
  );

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab === 'google_takeout' ? 'timeline_ocr' : initialTab);
    }
  }, [isOpen, initialTab]);

  // ----------------------------------------------------
  // FUNDS / EARNINGS & PDF STATEMENT SCANNER STATE
  // ----------------------------------------------------
  const [fundsFile, setFundsFile] = useState<File | null>(null);
  const [fundsIsPdf, setFundsIsPdf] = useState<boolean>(false);
  const [fundsPdfPageCount, setFundsPdfPageCount] = useState<number | null>(null);
  const [fundsPdfIsScanned, setFundsPdfIsScanned] = useState<boolean>(false);
  const [fundsOcrImagePreview, setFundsOcrImagePreview] = useState<string | null>(null);
  const [isFundsOcrLoading, setIsFundsOcrLoading] = useState(false);
  const [fundsOcrProgress, setFundsOcrProgress] = useState<{ percent: number; status: string }>({
    percent: 0,
    status: '',
  });
  const [fundsOcrError, setFundsOcrError] = useState<string | null>(null);
  const [fundsOcrResult, setFundsOcrResult] = useState<FundsOcrResult | null>(null);
  const [rawFundsOcrText, setRawFundsOcrText] = useState<string>('');
  const [showFundsRawText, setShowFundsRawText] = useState<boolean>(false);
  const [isFundsRawCopied, setIsFundsRawCopied] = useState<boolean>(false);
  const [editableFundsItems, setEditableFundsItems] = useState<FundsOcrItem[]>([]);
  const [fundsFilterType, setFundsFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [fundsSearchQuery, setFundsSearchQuery] = useState<string>('');
  const [fundsCalculatedSummary, setFundsCalculatedSummary] = useState<{
    totalNet: number;
    totalIncome: number;
    totalExpense: number;
    selectedCount: number;
    totalCount: number;
  }>({ totalNet: 0, totalIncome: 0, totalExpense: 0, selectedCount: 0, totalCount: 0 });
  const [isFundsManualEntryMode, setIsFundsManualEntryMode] = useState(false);
  const [isFundsDraggingOver, setIsFundsDraggingOver] = useState(false);
  const fundsFileInputRef = useRef<HTMLInputElement | null>(null);

  // ----------------------------------------------------
  // BANK CSV STATE
  // ----------------------------------------------------
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankCsvResult, setBankCsvResult] = useState<BankCsvParseResult | null>(null);
  const [bankTransactions, setBankTransactions] = useState<ParsedBankTransaction[]>([]);
  const [bankFilter, setBankFilter] = useState<'all' | 'new' | 'duplicate'>('all');
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const bankFileInputRef = useRef<HTMLInputElement | null>(null);

  // ----------------------------------------------------
  // TIMELINE SCREENSHOT OCR STATE (100% Client-Side Tesseract.js)
  // ----------------------------------------------------
  const [ocrImageFile, setOcrImageFile] = useState<File | null>(null);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ percent: number; status: string }>({
    percent: 0,
    status: '',
  });
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<TimelineOcrResult | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [isRawCopied, setIsRawCopied] = useState<boolean>(false);
  const [editableTotalMiles, setEditableTotalMiles] = useState<string>('0');
  const [editableTimelineDate, setEditableTimelineDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [editableLegs, setEditableLegs] = useState<TimelineOcrLeg[]>([]);
  const [selectedActivityType, setSelectedActivityType] = useState<DistanceActivityType>('drive');
  const [isManualEntryMode, setIsManualEntryMode] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  const isImportDirty = Boolean(
    isOpen &&
      (fundsFile ||
        bankFile ||
        ocrImageFile ||
        editableFundsItems.length > 0 ||
        bankTransactions.length > 0 ||
        editableLegs.length > 0)
  );

  const importModalGuard = useModalGuard({
    isOpen,
    isDirty: isImportDirty,
    onClose,
  });

  // Global clipboard paste listener for OCR tabs
  useEffect(() => {
    if (!isOpen) return;
    const isFundsTab = activeTab === 'funds_ocr' || activeTab === 'bank_csv';
    const isTimelineTab = activeTab === 'timeline_ocr' || activeTab === 'google_takeout';
    if (!isFundsTab && !isTimelineTab) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        activeEl.getAttribute('type') !== 'file'
      ) {
        return; // Allow standard text paste in input fields
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            if (isFundsTab) {
              handleProcessFundsFile(blob);
            } else {
              handleProcessImageFile(blob);
            }
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // ----------------------------------------------------
  // 0. FUNDS / EARNINGS & PDF STATEMENT PROCESSING (100% Client-Side)
  // ----------------------------------------------------
  const handleProcessFundsFile = async (file: File | Blob) => {
    if (!file) return;

    const isPdfFile =
      file instanceof File
        ? file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        : false;

    if (file instanceof File) {
      setFundsFile(file);
    }
    setFundsIsPdf(isPdfFile);
    setFundsPdfPageCount(null);
    setFundsPdfIsScanned(false);
    setFundsOcrError(null);
    setIsFundsOcrLoading(true);
    setFundsOcrProgress({
      percent: 5,
      status: isPdfFile
        ? 'Reading PDF document structure...'
        : 'Pre-processing earnings screenshot on local canvas...',
    });
    setIsFundsManualEntryMode(false);
    setShowFundsRawText(false);

    try {
      if (!isPdfFile) {
        const { base64, mimeType } = await convertFileToBase64(file);
        setFundsOcrImagePreview(`data:${mimeType};base64,${base64}`);
      } else {
        setFundsOcrImagePreview(null);
      }

      const result = await analyzeFundsDocument(
        file,
        (progress, status) => {
          setFundsOcrProgress({
            percent: Math.min(100, Math.max(0, Math.round(progress * 100))),
            status,
          });
        },
        {
          isPdf: isPdfFile,
          filename: file instanceof File ? file.name : undefined,
        }
      );

      setFundsOcrResult(result);
      setRawFundsOcrText(result.raw_text || '');
      setFundsPdfPageCount(result.pageCount || null);
      setFundsPdfIsScanned(Boolean(result.isScannedPdf));

      const initializedItems: FundsOcrItem[] = result.items.map((item) => ({
        ...item,
        selected: item.selected !== false,
      }));

      setEditableFundsItems(initializedItems);
      const totals = recalculateFundsTotal(initializedItems);
      setFundsCalculatedSummary(totals);

      if (initializedItems.length === 0) {
        showNotification(
          isPdfFile
            ? 'PDF analyzed. No currency transactions detected; check raw text or enter manually.'
            : 'Screenshot analyzed. No individual currency items were found; check detected total or enter manually.',
          'info'
        );
      } else {
        showNotification(
          isPdfFile
            ? `Extracted ${initializedItems.length} transactions from PDF statement (Net: ${
                totals.totalNet >= 0 ? '+' : ''
              }$${totals.totalNet.toFixed(2)})!`
            : `Local OCR identified ${initializedItems.length} line items (Net: ${
                totals.totalNet >= 0 ? '+' : ''
              }$${totals.totalNet.toFixed(2)})!`,
          'success'
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to analyze document with local engine.';
      console.error('Funds Document Processing Error:', err);
      setFundsOcrError(message);
      showNotification('Document analysis failed. You can switch to Manual Entry mode.', 'error');
    } finally {
      setIsFundsOcrLoading(false);
    }
  };

  const handleFundsDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFundsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isImg || isPdf) {
        handleProcessFundsFile(file);
      } else {
        setFundsOcrError('Please upload an image file (PNG, JPG, WEBP) or a PDF statement (.pdf).');
      }
    }
  };

  const enableFundsManualEntryMode = () => {
    setIsFundsManualEntryMode(true);
    setFundsOcrError(null);
    if (!fundsOcrResult) {
      setFundsOcrResult({
        summary_total_displayed: '$0.00',
        summary_amount: null,
        items: editableFundsItems,
        total_net_amount: 0,
        total_income: 0,
        total_expense: 0,
      });
    }
    if (editableFundsItems.length === 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const defaultItem: FundsOcrItem = {
        id: `fund-manual-${Date.now()}-1`,
        description: 'Earnings Payout',
        amount: 85.0,
        type: 'income',
        category: 'Delivery / Gig',
        date: todayStr,
        selected: true,
      };
      setEditableFundsItems([defaultItem]);
      setFundsCalculatedSummary(recalculateFundsTotal([defaultItem]));
    }
  };

  const loadSampleFundsOcrData = () => {
    const sample = getSampleFundsOcrResult();
    setFundsOcrError(null);
    setIsFundsOcrLoading(false);
    setFundsOcrResult(sample);
    setRawFundsOcrText(sample.raw_text || '');
    const items = sample.items.map((i) => ({ ...i, selected: true }));
    setEditableFundsItems(items);
    setFundsCalculatedSummary(recalculateFundsTotal(items));
    setIsFundsManualEntryMode(false);
    showNotification('Sample earnings OCR data loaded for preview!', 'success');
  };

  const loadSamplePdfStatement = async () => {
    const pdfBytes = generateSampleBankStatementPdfBytes();
    const pdfFile = new File([pdfBytes as unknown as BlobPart], 'Axiom_Aegis_Sample_Statement.pdf', {
      type: 'application/pdf',
    });
    await handleProcessFundsFile(pdfFile);
  };

  const handleReparseRawFundsText = () => {
    if (!rawFundsOcrText.trim()) {
      showNotification('Paste or enter statement text first to re-parse.', 'error');
      return;
    }
    const parsed = parseFundsOcrText(rawFundsOcrText);
    const initializedItems: FundsOcrItem[] = parsed.items.map((item) => ({
      ...item,
      selected: item.selected !== false,
    }));
    setFundsOcrResult((prev) => ({
      ...(prev || parsed),
      ...parsed,
      raw_text: rawFundsOcrText,
      isPdf: fundsIsPdf,
      pageCount: fundsPdfPageCount || 1,
    }));
    setEditableFundsItems(initializedItems);
    const totals = recalculateFundsTotal(initializedItems);
    setFundsCalculatedSummary(totals);
    showNotification(
      `Re-parsed ${initializedItems.length} transactions from raw text (Net: ${
        totals.totalNet >= 0 ? '+' : ''
      }$${totals.totalNet.toFixed(2)})`,
      'success'
    );
  };

  const handleAddFundsItem = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const newItem: FundsOcrItem = {
      id: `fund-user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      description: '',
      amount: 0,
      type: 'income',
      category: 'Delivery / Gig',
      date: todayStr,
      selected: true,
    };
    setEditableFundsItems((prev) => {
      const updated = [...prev, newItem];
      setFundsCalculatedSummary(recalculateFundsTotal(updated));
      return updated;
    });
  };

  const handleRemoveFundsItem = (id: string) => {
    setEditableFundsItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      setFundsCalculatedSummary(recalculateFundsTotal(updated));
      return updated;
    });
  };

  const handleToggleFundsItemSelection = (id: string) => {
    setEditableFundsItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, selected: item.selected === false ? true : false } : item
      );
      setFundsCalculatedSummary(recalculateFundsTotal(updated));
      return updated;
    });
  };

  const handleSelectAllFundsItems = (select: boolean) => {
    setEditableFundsItems((prev) => {
      const updated = prev.map((item) => ({ ...item, selected: select }));
      setFundsCalculatedSummary(recalculateFundsTotal(updated));
      return updated;
    });
  };

  const handleUpdateFundsItem = (
    id: string,
    field: keyof FundsOcrItem,
    value: string | number
  ) => {
    setEditableFundsItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      });
      if (field === 'amount' || field === 'type' || field === 'selected') {
        setFundsCalculatedSummary(recalculateFundsTotal(updated));
      }
      return updated;
    });
  };

  const handleToggleFundsItemType = (id: string) => {
    setEditableFundsItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          const nextType: 'income' | 'expense' = item.type === 'income' ? 'expense' : 'income';
          return { ...item, type: nextType };
        }
        return item;
      });
      setFundsCalculatedSummary(recalculateFundsTotal(updated));
      return updated;
    });
  };

  const handleCopyFundsRawText = async () => {
    if (!rawFundsOcrText) return;
    try {
      await navigator.clipboard.writeText(rawFundsOcrText);
      setIsFundsRawCopied(true);
      showNotification('Raw funds extracted text copied to clipboard', 'success');
      setTimeout(() => setIsFundsRawCopied(false), 2000);
    } catch {
      showNotification('Failed to copy raw text to clipboard', 'error');
    }
  };

  const handleConfirmAndLogFunds = async () => {
    const selectedItems = editableFundsItems.filter((i) => i.selected !== false);
    if (selectedItems.length === 0) {
      showNotification('No transactions selected to log.', 'info');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const newFundEntries: FundEntry[] = selectedItems.map((item, idx) => {
      const entryDate = item.date || todayStr;
      const entryAmt = Math.round(Math.abs(item.amount) * 100) / 100;
      const entryDesc = item.description || `Scanned Item #${idx + 1}`;
      return {
        id: `f-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        date: entryDate,
        type: item.type,
        amount: entryAmt,
        category: item.category || (item.type === 'income' ? 'Income' : 'General Expense'),
        description: entryDesc,
        importHash: generateTransactionHash(entryDate, entryAmt, item.type, entryDesc),
        createdAt: Date.now(),
      };
    });

    await updateAppData((prev) => {
      const nextFunds = [...newFundEntries, ...(prev.funds || [])];
      const netBal = calculateFundsSummary(
        nextFunds,
        prev.settings?.startingBalance || 0
      ).currentBalance;
      return {
        ...prev,
        funds: nextFunds,
        goals: reconcileGoalsWithNetBalance(prev.goals || [], netBal),
      };
    });

    showNotification(
      `Logged ${newFundEntries.length} fund entries to encrypted vault! (Net: ${
        fundsCalculatedSummary.totalNet >= 0 ? '+' : ''
      }$${fundsCalculatedSummary.totalNet.toFixed(2)})`,
      'success'
    );
    onClose();
  };

  // ----------------------------------------------------
  // 1. BANK STATEMENT CSV PROCESSING
  // ----------------------------------------------------
  const handleBankFileSelect = (file: File) => {
    if (!file) return;
    setBankFile(file);
    setBankError(null);
    setIsBankLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('Empty CSV file.');
        }

        const existingFunds = appData?.funds || [];
        const result = parseBankCsv(text, existingFunds);

        if (result.transactions.length === 0) {
          setBankError('Could not find valid transaction rows in this CSV. Please check column format.');
        } else {
          setBankCsvResult(result);
          setBankTransactions(result.transactions);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
        setBankError(msg);
      } finally {
        setIsBankLoading(false);
      }
    };
    reader.onerror = () => {
      setBankError('Failed to read file from disk.');
      setIsBankLoading(false);
    };
    reader.readAsText(file);
  };

  const handleBankDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBankFileSelect(e.dataTransfer.files[0]);
    }
  };

  const toggleBankTransaction = (id: string) => {
    setBankTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const selectAllBankNew = (select: boolean) => {
    setBankTransactions((prev) =>
      prev.map((t) => (t.isDuplicate ? t : { ...t, selected: select }))
    );
  };

  const handleToggleBankTxType = (id: string) => {
    setBankTransactions((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, type: t.type === 'income' ? 'expense' : 'income' } : t
      )
    );
  };

  const handleUpdateBankTxField = (
    id: string,
    field: 'description' | 'category' | 'date',
    value: string
  ) => {
    setBankTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleImportBankCommit = async () => {
    const selectedEntries = bankTransactions.filter((t) => t.selected);
    if (selectedEntries.length === 0) {
      showNotification('No transactions selected to import.', 'info');
      return;
    }

    const newFundEntries: FundEntry[] = selectedEntries.map((t) => ({
      id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      importHash: t.importHash,
      createdAt: Date.now(),
    }));

    await updateAppData((prev) => {
      const nextFunds = [...newFundEntries, ...(prev.funds || [])];
      const netBal = calculateFundsSummary(
        nextFunds,
        prev.settings?.startingBalance || 0
      ).currentBalance;
      return {
        ...prev,
        funds: nextFunds,
        goals: reconcileGoalsWithNetBalance(prev.goals || [], netBal),
      };
    });

    showNotification(
      `Successfully imported ${newFundEntries.length} bank transactions to encrypted vault!`,
      'success'
    );
    onClose();
  };

  const SAMPLE_BANK_CSV_TEXT = `Date,Description,Amount,Category\n2026-10-21,"Local Grocery Market",-58.40,Groceries\n2026-10-21,"Client Consulting Invoice",2500.00,Client / Income\n2026-10-20,"Neighborhood Provisions",-32.15,Groceries\n2026-10-19,"Highway Fuel Station",-45.00,Transportation\n2026-10-18,"Cloud Infrastructure Service",-24.50,Cloud & Engineering\n`;

  const loadSampleBankCsv = () => {
    const existingFunds = appData?.funds || [];
    const result = parseBankCsv(SAMPLE_BANK_CSV_TEXT, existingFunds);
    setBankError(null);
    setBankFile(new File([SAMPLE_BANK_CSV_TEXT], 'Sample_Bank_Statement.csv', { type: 'text/csv' }));
    setBankCsvResult(result);
    setBankTransactions(result.transactions);
    showNotification('Sample bank statement CSV loaded for preview!', 'success');
  };

  const downloadSampleBankCsv = () => {
    const blob = new Blob([SAMPLE_BANK_CSV_TEXT], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sample_Bank_Statement.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Sample bank statement CSV downloaded!', 'success');
  };

  const filteredBankTransactions = bankTransactions.filter((t) => {
    if (bankFilter === 'new') return !t.isDuplicate;
    if (bankFilter === 'duplicate') return t.isDuplicate;
    return true;
  });

  const selectedBankCount = bankTransactions.filter((t) => t.selected).length;

  // ----------------------------------------------------
  // 2. TIMELINE SCREENSHOT OCR & GOOGLE TAKEOUT JSON PROCESSING (100% Client-Side)
  // ----------------------------------------------------
  const handleProcessTakeoutJsonText = (jsonText: string, filename = 'Takeout_Timeline.json') => {
    try {
      const parsed = parseGoogleTakeoutJson(
        jsonText,
        'mi',
        appData?.distances || [],
        appData?.timeline || []
      );
      const legsFromTakeout: TimelineOcrLeg[] = [];

      if (parsed.distances.length > 0) {
        parsed.distances.forEach((d, idx) => {
          legsFromTakeout.push({
            id: `to-leg-${Date.now()}-${idx}`,
            origin: d.description.split(':')[0] || `Takeout Segment #${idx + 1}`,
            destination: `${d.type.toUpperCase()} (${d.date})`,
            distance_miles: d.distance,
            duration: `${d.rawDurationMinutes || 25} mins`,
          });
        });
        if (parsed.distances[0]?.date) {
          setEditableTimelineDate(parsed.distances[0].date);
        }
        if (parsed.distances[0]?.type) {
          setSelectedActivityType(parsed.distances[0].type);
        }
      } else if (parsed.timeline.length > 0) {
        parsed.timeline.forEach((t, idx) => {
          legsFromTakeout.push({
            id: `to-pv-leg-${Date.now()}-${idx}`,
            origin: t.title,
            destination: `${t.startTime}–${t.endTime}`,
            distance_miles: 0,
            duration: `${t.durationMinutes || 30} mins`,
          });
        });
        if (parsed.timeline[0]?.date) {
          setEditableTimelineDate(parsed.timeline[0].date);
        }
      }

      const totalMiles = recalculateTotalDistance(legsFromTakeout);
      setOcrError(null);
      setIsOcrLoading(false);
      setOcrImagePreview(null);
      setOcrResult({
        total_distance_miles: totalMiles,
        summary_distance_displayed: `${totalMiles} mi (${filename})`,
        legs: legsFromTakeout,
        raw_text: jsonText,
      });
      setRawOcrText(jsonText);
      setEditableTotalMiles(String(totalMiles));
      setEditableLegs(legsFromTakeout);
      setIsManualEntryMode(false);
      showNotification(
        `Parsed Google Takeout JSON: ${legsFromTakeout.length} segment(s) (${totalMiles} mi)!`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse Google Takeout JSON.';
      setOcrError(msg);
      setIsOcrLoading(false);
    }
  };

  const handleProcessImageFile = async (file: File | Blob) => {
    if (!file) return;

    const isJsonFile =
      file instanceof File &&
      (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json'));

    if (isJsonFile && file instanceof File) {
      setOcrImageFile(file);
      const text = await file.text();
      handleProcessTakeoutJsonText(text, file.name);
      return;
    }

    if (file instanceof File) {
      setOcrImageFile(file);
    }
    setOcrError(null);
    setIsOcrLoading(true);
    setOcrProgress({ percent: 5, status: 'Pre-processing image on local canvas...' });
    setIsManualEntryMode(false);
    setShowRawText(false);

    try {
      const { base64, mimeType } = await convertFileToBase64(file);
      setOcrImagePreview(`data:${mimeType};base64,${base64}`);

      const result = await analyzeTimelineScreenshot(file, (progress, status) => {
        setOcrProgress({
          percent: Math.min(100, Math.max(0, Math.round(progress * 100))),
          status,
        });
      });

      setOcrResult(result);
      setRawOcrText(result.raw_text || '');
      setEditableTotalMiles(String(result.total_distance_miles));
      setEditableLegs(
        result.legs.map((leg, index) => ({
          ...leg,
          id: leg.id || `ocr-leg-${Date.now()}-${index}`,
        }))
      );

      if (result.legs.length === 0) {
        showNotification(
          'Screenshot analyzed. No distinct route legs were found; verify total miles or use manual entry.',
          'info'
        );
      } else {
        showNotification(
          `Local OCR identified ${result.total_distance_miles} mi across ${result.legs.length} trip leg(s)!`,
          'success'
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to analyze screenshot with local OCR.';
      console.error('OCR Error:', err);
      setOcrError(message);
      showNotification('Local OCR analysis failed. You can switch to Manual Entry mode.', 'error');
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const isJson =
        file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
      if (file.type.startsWith('image/') || isJson) {
        handleProcessImageFile(file);
      } else {
        setOcrError(
          'Please upload an image file (PNG, JPG, WEBP) or a Google Takeout JSON file (.json).'
        );
      }
    }
  };

  const enableManualEntryMode = () => {
    setIsManualEntryMode(true);
    setOcrError(null);
    if (!ocrResult) {
      setOcrResult({
        total_distance_miles: parseFloat(editableTotalMiles) || 0,
        summary_distance_displayed: `${editableTotalMiles || '0'} mi`,
        legs: editableLegs,
      });
    }
    if (editableLegs.length === 0) {
      setEditableLegs([
        {
          id: `leg-manual-${Date.now()}-1`,
          origin: 'Home Base',
          destination: 'Destination / Office',
          distance_miles: parseFloat(editableTotalMiles) || 12.5,
          duration: '25 mins',
        },
      ]);
    }
  };

  const loadSampleOcrData = () => {
    const sample = getSampleTimelineOcrResult();
    setOcrError(null);
    setIsOcrLoading(false);
    setOcrResult(sample);
    setRawOcrText(sample.raw_text || '');
    setEditableTotalMiles(String(sample.total_distance_miles));
    setEditableLegs(sample.legs);
    setIsManualEntryMode(false);
    showNotification('Sample timeline OCR data loaded for preview!', 'success');
  };

  const loadSampleTakeoutJson = () => {
    const sampleTakeout = JSON.stringify(
      {
        timelineObjects: [
          {
            activitySegment: {
              activityType: 'IN_PASSENGER_VEHICLE',
              distance: 22852,
              duration: {
                startTimestamp: '2026-10-24T08:30:00Z',
                endTimestamp: '2026-10-24T08:56:00Z',
              },
            },
          },
          {
            activitySegment: {
              activityType: 'WALKING',
              distance: 3862,
              duration: {
                startTimestamp: '2026-10-24T12:15:00Z',
                endTimestamp: '2026-10-24T12:50:00Z',
              },
            },
          },
        ],
      },
      null,
      2
    );
    handleProcessTakeoutJsonText(sampleTakeout, 'Sample_Google_Takeout.json');
  };

  const handleReparseTimelineRawText = () => {
    const trimmed = rawOcrText.trim();
    if (!trimmed) {
      showNotification('Enter or paste timeline text or Takeout JSON first.', 'error');
      return;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      handleProcessTakeoutJsonText(trimmed, 'Takeout_Timeline.json');
      return;
    }
    const parsed = parseTimelineOcrText(rawOcrText);
    const nextLegs = parsed.legs.map((leg, idx) => ({
      ...leg,
      id: leg.id || `ocr-leg-${Date.now()}-${idx}`,
    }));
    setOcrResult({
      total_distance_miles: parsed.total_distance_miles,
      summary_distance_displayed: parsed.summary_distance_displayed,
      legs: nextLegs,
      raw_text: rawOcrText,
    });
    setEditableTotalMiles(String(parsed.total_distance_miles));
    setEditableLegs(nextLegs);
    showNotification(
      `Re-parsed ${nextLegs.length} route leg(s) (${parsed.total_distance_miles} mi)!`,
      'success'
    );
  };

  const handleAddLeg = () => {
    const newLeg: TimelineOcrLeg = {
      id: `leg-user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      origin: '',
      destination: '',
      distance_miles: 0,
      duration: '15 mins',
    };
    setEditableLegs((prev) => {
      const updated = [...prev, newLeg];
      const newTotal = recalculateTotalDistance(updated);
      setEditableTotalMiles(String(newTotal));
      return updated;
    });
  };

  const handleRemoveLeg = (id?: string) => {
    setEditableLegs((prev) => {
      const updated = prev.filter((leg) => leg.id !== id);
      const newTotal = recalculateTotalDistance(updated);
      setEditableTotalMiles(String(newTotal));
      return updated;
    });
  };

  const handleUpdateLeg = (id: string, field: keyof TimelineOcrLeg, value: string | number) => {
    setEditableLegs((prev) => {
      const updated = prev.map((leg) => {
        if (leg.id === id) {
          return { ...leg, [field]: value };
        }
        return leg;
      });
      if (field === 'distance_miles') {
        const newTotal = recalculateTotalDistance(updated);
        setEditableTotalMiles(String(newTotal));
      }
      return updated;
    });
  };

  const handleRecalculateTotalFromLegs = () => {
    const rounded = recalculateTotalDistance(editableLegs);
    setEditableTotalMiles(String(rounded));
    showNotification(`Updated Total Miles to ${rounded} mi based on individual leg sum.`, 'info');
  };

  const handleCopyRawText = async () => {
    if (!rawOcrText) return;
    try {
      await navigator.clipboard.writeText(rawOcrText);
      setIsRawCopied(true);
      showNotification('Raw OCR text copied to clipboard', 'success');
      setTimeout(() => setIsRawCopied(false), 2000);
    } catch {
      showNotification('Failed to copy raw text to clipboard', 'error');
    }
  };

  const handleConfirmAndLog = async () => {
    const totalMilesNum = Math.round((parseFloat(editableTotalMiles) || 0) * 100) / 100;
    const targetDate = editableTimelineDate || new Date().toISOString().slice(0, 10);

    // 1. Create DistanceEntry
    const distanceEntry: DistanceEntry = {
      id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      date: targetDate,
      distance: totalMilesNum,
      unit: 'mi',
      type: selectedActivityType,
      description: `Timeline Import: ${editableLegs.length} leg(s)${
        editableLegs.length > 0
          ? ` (${editableLegs
              .map((l) => `${l.origin} → ${l.destination}`)
              .filter(Boolean)
              .slice(0, 3)
              .join(', ')}${editableLegs.length > 3 ? '...' : ''})`
          : ''
      }`,
      importHash: `ocr-${targetDate}-${selectedActivityType}-${Math.floor(totalMilesNum * 100)}`,
      createdAt: Date.now(),
    };

    // 2. Create TimelineEntry for each detected leg
    let currentHour = 9;
    let currentMinute = 0;

    const newTimelineEntries: TimelineEntry[] = editableLegs.map((leg, idx) => {
      let durationMins = 30;
      const matchMins = leg.duration.match(/(\d+)\s*m/i);
      const matchHours = leg.duration.match(/(\d+)\s*h/i);
      if (matchHours || matchMins) {
        const hrs = matchHours ? parseInt(matchHours[1], 10) : 0;
        const mins = matchMins ? parseInt(matchMins[1], 10) : 0;
        durationMins = hrs * 60 + mins;
      } else {
        const numericOnly = parseInt(leg.duration, 10);
        if (!isNaN(numericOnly) && numericOnly > 0) {
          durationMins = numericOnly;
        }
      }

      const startH = String(currentHour).padStart(2, '0');
      const startM = String(currentMinute).padStart(2, '0');

      const totalMins = currentHour * 60 + currentMinute + durationMins;
      currentHour = Math.floor(totalMins / 60) % 24;
      currentMinute = totalMins % 60;

      const endH = String(currentHour).padStart(2, '0');
      const endM = String(currentMinute).padStart(2, '0');

      // Add a 15-minute gap before next trip leg
      currentMinute += 15;
      if (currentMinute >= 60) {
        currentHour = (currentHour + Math.floor(currentMinute / 60)) % 24;
        currentMinute = currentMinute % 60;
      }

      const origin = leg.origin.trim() || 'Start Location';
      const destination = leg.destination.trim() || 'Destination';

      return {
        id: `t-ocr-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        title: `${origin} → ${destination}`,
        category: 'other',
        date: targetDate,
        startTime: `${startH}:${startM}`,
        endTime: `${endH}:${endM}`,
        durationMinutes: durationMins,
        notes: `Timeline Trip Leg: ${origin} to ${destination} • ${leg.distance_miles} mi • Duration: ${leg.duration}`,
        importHash: `ocr-leg-${targetDate}-${idx}-${origin.slice(0, 12)}`,
        createdAt: Date.now(),
      };
    });

    await updateAppData((prev) => ({
      ...prev,
      distances: [distanceEntry, ...(prev.distances || [])],
      timeline: [...newTimelineEntries, ...(prev.timeline || [])],
    }));

    showNotification(
      `Logged ${totalMilesNum} miles & ${newTimelineEntries.length} trip legs on ${targetDate}!`,
      'success'
    );
    onClose();
  };

  const isTimelineOcrActive = activeTab === 'timeline_ocr' || activeTab === 'google_takeout';

  return (
    <div
      onDoubleClick={importModalGuard.handleBackdropDoubleClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-x-hidden overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-5 sm:p-6 relative max-h-[92vh] flex flex-col overflow-hidden"
        style={{
          boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.85)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#20242E] mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0A0B10] border border-[#232732] shadow-sm">
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Data Import Hub</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {APP_VERSION.split(' ')[0]}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                PDF Statements &amp; OCR • Bank CSV &amp; JSON • Timeline &amp; Google Takeout
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={importModalGuard.requestExplicitClose}
            aria-label="Close modal"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#181B24] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <UnsavedChangesBanner
          isOpen={importModalGuard.showConfirmClose}
          onKeepEditing={importModalGuard.cancelClose}
          onDiscardAndClose={importModalGuard.confirmDiscardAndClose}
        />

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0A0B10] border border-[#1E222B] rounded-xl mb-4 shrink-0">
          <button
            type="button"
            data-testid="import-tab-funds-ocr"
            onClick={() => setActiveTab('funds_ocr')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'funds_ocr'
                ? 'bg-[#181B24] text-white shadow border border-[#232732]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={activeTab === 'funds_ocr' ? { color: accent.hex } : undefined}
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">Funds &amp; PDF</span>
          </button>

          <button
            type="button"
            data-testid="import-tab-timeline-ocr"
            onClick={() => setActiveTab('timeline_ocr')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
              isTimelineOcrActive
                ? 'bg-[#181B24] text-white shadow border border-[#232732]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={isTimelineOcrActive ? { color: accent.hex } : undefined}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">Timeline &amp; Takeout</span>
          </button>

          <button
            type="button"
            data-testid="import-tab-bank-csv"
            onClick={() => setActiveTab('bank_csv')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'bank_csv'
                ? 'bg-[#181B24] text-white shadow border border-[#232732]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={activeTab === 'bank_csv' ? { color: accent.hex } : undefined}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">Bank CSV / JSON</span>
          </button>
        </div>

        {/* TAB 0: FUNDS / EARNINGS & PDF STATEMENT SCANNER */}
        {activeTab === 'funds_ocr' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0">
            {/* Upload & Dropzone Area */}
            {!fundsOcrResult && !isFundsManualEntryMode && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsFundsDraggingOver(true);
                }}
                onDragLeave={() => setIsFundsDraggingOver(false)}
                onDrop={handleFundsDrop}
                onClick={() => fundsFileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center space-y-3 group ${
                  isFundsDraggingOver
                    ? 'border-amber-400 bg-amber-950/20'
                    : 'border-[#1E222B] hover:border-amber-500/80 bg-[#08090C] hover:bg-[#151821]'
                }`}
              >
                <input
                  ref={fundsFileInputRef}
                  data-testid="funds-pdf-file-input"
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) {
                      handleProcessFundsFile(selected);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-[#181B24] border border-[#232732] group-hover:border-amber-500/50 flex items-center justify-center mx-auto transition-colors shadow-lg">
                  <Receipt className="w-6 h-6 text-amber-400" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-200">
                    Drop Bank Statement PDF, Earnings Summary, or Receipt Screenshot here, click to browse, or paste with{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-[#181B24] border border-[#232732] text-amber-300 font-mono text-[11px]">
                      Ctrl+V
                    </kbd>
                  </p>
                  <p className="text-xs text-zinc-400 max-w-lg mx-auto">
                    Accepts PDF bank statements, payout reports, DoorDash/Uber summaries, or receipt photos. Automatically extracts digital text via PDF.js, with Tesseract OCR fallback for scanned receipts.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    PDF.js Digital Extraction
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Local Tesseract OCR Fallback
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#181B24] text-zinc-300 border border-[#232732] flex items-center gap-1">
                    <Clipboard className="w-3 h-3" />
                    Clipboard Paste Ready
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#181B24] text-zinc-400 border border-[#232732]">
                    100% Offline (Zero 503 Errors)
                  </span>
                </div>
              </div>
            )}

            {/* Scanning / Progress Bar State */}
            {isFundsOcrLoading && (
              <div className="p-8 rounded-2xl bg-[#08090C] border border-amber-500/40 text-center space-y-5 shadow-2xl">
                {fundsIsPdf && fundsFile ? (
                  <div className="p-4 max-w-sm mx-auto rounded-xl bg-[#13161F] border border-amber-500/30 shadow-md flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-white truncate">{fundsFile.name}</p>
                      <p className="text-[10px] font-mono text-zinc-400">
                        {fundsFile.size ? `${(fundsFile.size / 1024).toFixed(1)} KB` : 'PDF Document'}
                      </p>
                    </div>
                  </div>
                ) : fundsOcrImagePreview ? (
                  <div className="w-36 h-24 mx-auto rounded-lg overflow-hidden border border-[#232732] shadow-md relative group">
                    <img
                      src={fundsOcrImagePreview}
                      alt="Analyzing Screenshot"
                      className="w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/20 via-transparent to-amber-500/30 animate-pulse" />
                    <div className="absolute bottom-1 right-1.5 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono text-amber-300 border border-amber-800">
                      Auto-Contrasted
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3 max-w-md mx-auto">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-sans font-semibold">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      {fundsOcrProgress.status || 'Scanning document locally...'}
                    </span>
                    <span className="text-amber-400 font-bold text-sm">{fundsOcrProgress.percent}%</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-[#181B24] border border-[#232732] rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-400 transition-all duration-300"
                      style={{ width: `${Math.max(5, fundsOcrProgress.percent)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-zinc-500">
                    Running 100% in local browser worker. Zero banking or financial data leaves your machine.
                  </p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {fundsOcrError && !isFundsOcrLoading && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2.5 text-xs text-rose-300">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Funds Document Scanner Notification</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">{fundsOcrError}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={enableFundsManualEntryMode}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Switch to Manual Entry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fundsFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-300 border border-[#232732] transition-colors"
                  >
                    Try Another File
                  </button>
                </div>
              </div>
            )}

            {/* Quick Demo Helper */}
            {!fundsOcrResult && !isFundsManualEntryMode && !isFundsOcrLoading && (
              <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1E222B] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>Want to test the PDF statement reader or enter funds manually?</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="funds-scan-sample-pdf-btn"
                    onClick={loadSamplePdfStatement}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Scan Sample PDF Statement</span>
                  </button>
                  <button
                    type="button"
                    data-testid="funds-load-sample-ocr-btn"
                    onClick={loadSampleFundsOcrData}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Sample Earnings</span>
                  </button>
                  <button
                    type="button"
                    onClick={enableFundsManualEntryMode}
                    className="px-2.5 py-1 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-300 border border-[#232732] text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Manual Entry</span>
                  </button>
                </div>
              </div>
            )}

            {/* VERIFICATION & PREVIEW CARD */}
            {(fundsOcrResult || isFundsManualEntryMode) && !isFundsOcrLoading && (
              <div className="space-y-4">
                {/* Top Summary & Document Badge Strip */}
                <div className="p-4 rounded-xl bg-[#0E1015] border border-[#1E222B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {fundsIsPdf && fundsFile ? (
                      <div className="w-14 h-12 rounded-lg bg-[#181B24] border border-amber-500/40 flex flex-col items-center justify-center shrink-0 shadow">
                        <FileText className="w-5 h-5 text-amber-400" />
                        <span className="text-[9px] font-mono text-zinc-400 uppercase">PDF</span>
                      </div>
                    ) : fundsOcrImagePreview ? (
                      <div className="w-16 h-12 rounded-lg overflow-hidden border border-[#232732] shrink-0 bg-black relative group">
                        <img
                          src={fundsOcrImagePreview}
                          alt="Screenshot Thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => fundsFileInputRef.current?.click()}
                          title="Change file"
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white transition-opacity"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#181B24] border border-[#232732] flex items-center justify-center shrink-0">
                        <Wallet className="w-5 h-5 text-amber-400" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-white tracking-tight">
                          {isFundsManualEntryMode
                            ? 'Manual Funds Entry'
                            : fundsIsPdf
                            ? 'Verified PDF Bank Statement'
                            : 'Verified Screenshot Extraction'}
                        </span>
                        {fundsIsPdf && fundsPdfPageCount && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            {fundsPdfPageCount} Page{fundsPdfPageCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {fundsIsPdf && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {fundsPdfIsScanned ? 'OCR Scanned' : 'Digital PDF'}
                          </span>
                        )}
                        {fundsOcrResult?.summary_total_displayed && !isFundsManualEntryMode && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Detected Total: {fundsOcrResult.summary_total_displayed}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {fundsFile?.name ? `${fundsFile.name} • ` : ''}
                        {editableFundsItems.length} transactions recognized • Select, edit, or adjust before logging
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFundsOcrResult(null);
                        setFundsOcrImagePreview(null);
                        setFundsFile(null);
                        setFundsIsPdf(false);
                        setIsFundsManualEntryMode(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#181B24] hover:bg-[#1F232E] text-zinc-300 border border-[#232732] transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Upload New File</span>
                    </button>
                    {!isFundsManualEntryMode && (
                      <button
                        type="button"
                        onClick={enableFundsManualEntryMode}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Manual Entry</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3-Stat KPI Summary Ribbon (Dynamically Reflects Selected Rows) */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B] text-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Selected Net Balance
                    </span>
                    <span
                      className={`text-base sm:text-lg font-mono font-extrabold ${
                        fundsCalculatedSummary.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {fundsCalculatedSummary.totalNet >= 0 ? '+' : ''}${fundsCalculatedSummary.totalNet.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B] text-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/80 block mb-1">
                      Total Income (+)
                    </span>
                    <span className="text-base sm:text-lg font-mono font-extrabold text-emerald-400">
                      +${fundsCalculatedSummary.totalIncome.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B] text-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400/80 block mb-1">
                      Total Deductions (-)
                    </span>
                    <span className="text-base sm:text-lg font-mono font-extrabold text-rose-400">
                      -${fundsCalculatedSummary.totalExpense.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Interactive Funds Chips Strip */}
                {editableFundsItems.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-500">
                        Interactive Amount Chips ({editableFundsItems.length})
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        Click <strong className="text-rose-400">✕</strong> to remove stray false positives
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {editableFundsItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-colors shadow-sm ${
                            item.selected !== false
                              ? 'bg-[#181B24] border-[#232732] hover:border-amber-500/50'
                              : 'bg-black/40 border-[#1E222B]/60 opacity-50'
                          }`}
                        >
                          <span
                            className="text-zinc-300 font-medium max-w-[120px] truncate cursor-pointer"
                            onClick={() => handleToggleFundsItemSelection(item.id)}
                            title={`${item.description} (Click to toggle selection)`}
                          >
                            {item.description || `Item #${idx + 1}`}
                          </span>
                          <span
                            className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] border ${
                              item.type === 'income'
                                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                                : 'text-rose-400 bg-rose-950/60 border-rose-800/50'
                            }`}
                          >
                            {item.type === 'income' ? '+' : '-'}${Number(item.amount).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFundsItem(item.id)}
                            title="Remove line item"
                            className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 p-0.5 rounded transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Verification Table & Filtering Toolbar */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-[#0E1015] border border-[#1E222B] flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    {/* Left: Selection summary & Quick bulk toggle */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white text-xs">
                        {fundsCalculatedSummary.selectedCount} of {editableFundsItems.length} selected
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectAllFundsItems(true)}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAllFundsItems(false)}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#181B24] text-zinc-400 hover:text-white border border-[#232732] transition-colors"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Right: Filter pills & Search */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg bg-[#08090C] border border-[#1E222B] p-0.5">
                        <button
                          type="button"
                          onClick={() => setFundsFilterType('all')}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                            fundsFilterType === 'all'
                              ? 'bg-[#181B24] text-white border border-[#232732]'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          All ({editableFundsItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFundsFilterType('income')}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                            fundsFilterType === 'income'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Income ({editableFundsItems.filter((i) => i.type === 'income').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFundsFilterType('expense')}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                            fundsFilterType === 'expense'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Expenses ({editableFundsItems.filter((i) => i.type === 'expense').length})
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddFundsItem}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Row</span>
                      </button>
                    </div>
                  </div>

                  {/* Search query input if there are more than 4 items */}
                  {editableFundsItems.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                      <input
                        type="text"
                        value={fundsSearchQuery}
                        onChange={(e) => setFundsSearchQuery(e.target.value)}
                        placeholder="Search recognized transactions by description or category..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0E1015] border border-[#1E222B] text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                      />
                      {fundsSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setFundsSearchQuery('')}
                          className="absolute right-2.5 top-2 text-zinc-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Transactions Table */}
                  {editableFundsItems.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#08090C] border border-[#1E222B] text-center text-xs text-zinc-400 space-y-2">
                      <p>No transaction rows available.</p>
                      <button
                        type="button"
                        onClick={handleAddFundsItem}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Transaction</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-[#1E222B] rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-[#1E222B]/80">
                      {editableFundsItems
                        .filter((item) => {
                          if (fundsFilterType === 'income' && item.type !== 'income') return false;
                          if (fundsFilterType === 'expense' && item.type !== 'expense') return false;
                          if (fundsSearchQuery.trim()) {
                            const q = fundsSearchQuery.toLowerCase();
                            const matchDesc = (item.description || '').toLowerCase().includes(q);
                            const matchCat = (item.category || '').toLowerCase().includes(q);
                            if (!matchDesc && !matchCat) return false;
                          }
                          return true;
                        })
                        .map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className={`p-2.5 transition-colors ${
                              item.selected !== false
                                ? 'bg-[#08090C] hover:bg-[#151821]'
                                : 'bg-black/50 opacity-60 hover:opacity-90'
                            }`}
                          >
                            <div className="grid grid-cols-12 gap-2 items-center text-xs">
                              {/* Checkbox */}
                              <div className="col-span-1 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFundsItemSelection(item.id)}
                                  className="text-zinc-400 hover:text-amber-400 transition-colors p-1"
                                  title={item.selected !== false ? 'Deselect from import' : 'Select for import'}
                                >
                                  {item.selected !== false ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <Square className="w-4 h-4 text-zinc-600" />
                                  )}
                                </button>
                              </div>

                              {/* Date Input */}
                              <div className="col-span-3 sm:col-span-2">
                                <input
                                  type="text"
                                  value={item.date || ''}
                                  placeholder="YYYY-MM-DD"
                                  onChange={(e) => handleUpdateFundsItem(item.id, 'date', e.target.value)}
                                  className="w-full px-2 py-1 rounded bg-[#181B24] border border-[#232732] text-zinc-300 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {/* Type Toggle: Income vs Expense */}
                              <div className="col-span-3 sm:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFundsItemType(item.id)}
                                  className={`w-full py-1 px-1.5 rounded font-bold text-[10px] uppercase font-mono flex items-center justify-center gap-1 border transition-colors ${
                                    item.type === 'income'
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                                  }`}
                                >
                                  {item.type === 'income' ? (
                                    <>
                                      <ArrowUpRight className="w-3 h-3" />
                                      <span>+ Income</span>
                                    </>
                                  ) : (
                                    <>
                                      <ArrowDownRight className="w-3 h-3" />
                                      <span>- Expense</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Description */}
                              <div className="col-span-5 sm:col-span-4">
                                <input
                                  type="text"
                                  value={item.description}
                                  placeholder="Description / Payee"
                                  onChange={(e) => handleUpdateFundsItem(item.id, 'description', e.target.value)}
                                  className="w-full px-2 py-1 rounded bg-[#181B24] border border-[#232732] text-white text-xs focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {/* Amount */}
                              <div className="col-span-4 sm:col-span-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.amount}
                                    onChange={(e) =>
                                      handleUpdateFundsItem(item.id, 'amount', parseFloat(e.target.value) || 0)
                                    }
                                    className={`w-full px-2 py-1 rounded bg-[#181B24] border border-[#232732] font-mono text-xs focus:outline-none focus:border-amber-500 font-bold text-right ${
                                      item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Delete 'X' */}
                              <div className="col-span-1 flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFundsItem(item.id)}
                                  title="Delete item"
                                  className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* View Raw Scanned / PDF Extracted Text Collapsible Drawer */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowFundsRawText(!showFundsRawText)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0E1015] hover:bg-[#151821] border border-[#1E222B] text-xs font-semibold text-zinc-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>View Raw Extracted Text</span>
                        {rawFundsOcrText && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#181B24] text-zinc-400 border border-[#232732]">
                            {rawFundsOcrText.split('\n').filter(Boolean).length} lines parsed
                          </span>
                        )}
                      </div>
                      {showFundsRawText ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>

                    {showFundsRawText && (
                      <div className="mt-2 p-3 bg-[#08090C] rounded-xl border border-[#1E222B] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {fundsIsPdf
                              ? 'Extracted PDF text (editable — click Re-Parse Text to update rows):'
                              : 'Extracted OCR text (editable — click Re-Parse Text to update rows):'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="funds-reparse-raw-text-btn"
                              onClick={handleReparseRawFundsText}
                              className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] flex items-center gap-1.5 font-mono font-semibold transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Re-Parse Text</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyFundsRawText}
                              className="px-2.5 py-1 rounded bg-[#181B24] hover:bg-[#20242E] text-zinc-300 hover:text-white border border-[#232732] text-[11px] flex items-center gap-1.5 font-mono transition-colors"
                            >
                              {isFundsRawCopied ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{isFundsRawCopied ? 'Copied' : 'Copy Text'}</span>
                            </button>
                          </div>
                        </div>
                        <textarea
                          data-testid="funds-raw-text-editor"
                          value={rawFundsOcrText}
                          onChange={(e) => setRawFundsOcrText(e.target.value)}
                          rows={6}
                          placeholder="Paste or edit raw bank statement / receipt text here..."
                          className="w-full text-[11px] font-mono p-3 bg-black/70 rounded-lg text-amber-400/90 border border-[#20242E] focus:outline-none focus:border-amber-500/60 leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: BANK STATEMENT CSV IMPORTER */}
        {activeTab === 'bank_csv' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleBankDrop}
              onClick={() => bankFileInputRef.current?.click()}
              className="p-6 border-2 border-dashed border-[#1E222B] hover:border-emerald-500/80 rounded-2xl bg-[#08090C] hover:bg-[#151821] cursor-pointer transition-all text-center space-y-2 group"
            >
              <input
                ref={bankFileInputRef}
                data-testid="bank-csv-file-input"
                type="file"
                accept=".csv,text/csv,.json,application/json"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleBankFileSelect(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-[#181B24] border border-[#232732] group-hover:border-emerald-500/50 flex items-center justify-center mx-auto transition-colors">
                <Upload className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-zinc-200">
                  {bankFile ? (
                    <span className="text-emerald-400 font-mono">{bankFile.name}</span>
                  ) : (
                    <span>Drag & drop your bank statement CSV or JSON here, or click to browse</span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Supports Chase, Bank of America, Wells Fargo, standard RFC-4180 bank CSVs, and JSON ledger exports
                </p>
              </div>
            </div>

            {/* Error Message */}
            {bankError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bankError}</span>
              </div>
            )}

            {/* Sample CSV Helper */}
            {!bankCsvResult && (
              <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1E222B] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>Need a sample template to test the bank statement importer?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="bank-load-sample-csv-btn"
                    onClick={loadSampleBankCsv}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Sample CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadSampleBankCsv}
                    className="px-2.5 py-1 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 border border-[#232732]"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>
            )}

            {/* Parse Summary Bar & Filter Controls */}
            {bankCsvResult && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1E222B] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">
                      {bankCsvResult.totalFound} found
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
                      {bankCsvResult.newCount} new
                    </span>
                    {bankCsvResult.duplicatesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-[#181B24] text-zinc-400 font-mono">
                        {bankCsvResult.duplicatesCount} duplicates skipped
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid="bank-reset-file-btn"
                      onClick={() => {
                        setBankFile(null);
                        setBankCsvResult(null);
                        setBankTransactions([]);
                        setBankError(null);
                      }}
                      className="px-2 py-0.5 rounded-md bg-[#181B24] hover:bg-[#1F232E] text-zinc-300 border border-[#232732] flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Upload New File</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBankFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        bankFilter === 'all'
                          ? 'bg-[#181B24] text-white font-bold border border-[#232732]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      All ({bankTransactions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankFilter('new')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        bankFilter === 'new'
                          ? 'bg-[#181B24] text-emerald-400 font-bold border border-[#232732]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      New ({bankCsvResult.newCount})
                    </button>
                    {bankCsvResult.duplicatesCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setBankFilter('duplicate')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          bankFilter === 'duplicate'
                            ? 'bg-[#181B24] text-zinc-300 font-bold border border-[#232732]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Duplicates ({bankCsvResult.duplicatesCount})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectAllBankNew(true)}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Select all new
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => selectAllBankNew(false)}
                      className="text-xs text-zinc-400 hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                  <span className="font-mono text-zinc-300">
                    {selectedBankCount} selected for import
                  </span>
                </div>

                <div className="border border-[#1E222B] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#0E1015] border-b border-[#20242E] text-zinc-400 text-[11px] font-mono">
                      <tr>
                        <th className="p-2.5 w-10 text-center">Sel</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E222B]/60 font-mono">
                      {filteredBankTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className={`hover:bg-[#151821] transition-colors ${
                            tx.isDuplicate ? 'opacity-60 bg-[#08090C]' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={tx.selected}
                              onChange={() => toggleBankTransaction(tx.id)}
                              className="w-3.5 h-3.5 rounded border-[#232732] bg-[#181B24] text-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 text-zinc-300 whitespace-nowrap">{tx.date}</td>
                          <td className="p-2 text-white font-sans max-w-[200px]">
                            <input
                              type="text"
                              value={tx.description}
                              onChange={(e) => handleUpdateBankTxField(tx.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 rounded bg-transparent hover:bg-[#181B24] focus:bg-[#181B24] border border-transparent focus:border-emerald-500/50 text-xs text-white focus:outline-none"
                            />
                          </td>
                          <td className="p-2 text-zinc-400 font-sans whitespace-nowrap">
                            <input
                              type="text"
                              value={tx.category}
                              onChange={(e) => handleUpdateBankTxField(tx.id, 'category', e.target.value)}
                              className="w-28 px-2 py-1 rounded bg-transparent hover:bg-[#181B24] focus:bg-[#181B24] border border-transparent focus:border-emerald-500/50 text-xs text-zinc-300 focus:outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right font-bold whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleBankTxType(tx.id)}
                              title="Click to toggle Income (+) / Expense (-)"
                              className={`px-2 py-0.5 rounded transition-colors ${
                                tx.type === 'income'
                                  ? 'text-emerald-400 hover:bg-emerald-500/15'
                                  : 'text-rose-400 hover:bg-rose-500/15'
                              }`}
                            >
                              {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                            </button>
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {tx.isDuplicate ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#181B24] text-zinc-400 border border-[#232732]">
                                Duplicate
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TIMELINE SCREENSHOT OCR IMPORTER */}
        {isTimelineOcrActive && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0">
            {/* Upload & Dropzone Area */}
            {!ocrResult && !isManualEntryMode && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleImageDrop}
                onClick={() => imageFileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center space-y-3 group ${
                  isDraggingOver
                    ? 'border-cyan-400 bg-cyan-950/20'
                    : 'border-[#1E222B] hover:border-cyan-500/80 bg-[#08090C] hover:bg-[#151821]'
                }`}
              >
                <input
                  ref={imageFileInputRef}
                  data-testid="timeline-file-input"
                  type="file"
                  accept="image/*,.json,application/json"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleProcessImageFile(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-[#181B24] border border-[#232732] group-hover:border-cyan-500/50 flex items-center justify-center mx-auto transition-colors shadow-lg">
                  <Camera className="w-6 h-6 text-cyan-400" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-200">
                    Drop Timeline Screenshot or Google Takeout <code className="text-cyan-300 font-mono text-xs">.json</code> here, click to browse, or paste with <kbd className="px-1.5 py-0.5 rounded bg-[#181B24] border border-[#232732] text-cyan-300 font-mono text-[11px]">Ctrl+V</kbd>
                  </p>
                  <p className="text-xs text-zinc-400 max-w-lg mx-auto">
                    Accepts Google Maps Timeline screenshots, Apple Maps, or Google Takeout Semantic Location History JSON files.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Local Tesseract.js OCR
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Google Takeout JSON Parser
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#181B24] text-zinc-300 border border-[#232732] flex items-center gap-1">
                    <Clipboard className="w-3 h-3" />
                    Clipboard Paste Ready
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#181B24] text-zinc-400 border border-[#232732]">
                    100% Offline (Zero 503 Errors)
                  </span>
                </div>
              </div>
            )}

            {/* Scanning / Progress Bar State */}
            {isOcrLoading && (
              <div className="p-8 rounded-2xl bg-[#08090C] border border-cyan-500/40 text-center space-y-5 shadow-2xl">
                {ocrImagePreview && (
                  <div className="w-36 h-24 mx-auto rounded-lg overflow-hidden border border-[#232732] shadow-md relative group">
                    <img
                      src={ocrImagePreview}
                      alt="Analyzing Screenshot"
                      className="w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 via-transparent to-cyan-500/30 animate-pulse" />
                    <div className="absolute bottom-1 right-1.5 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono text-cyan-300 border border-cyan-800">
                      Auto-Contrasted
                    </div>
                  </div>
                )}
                
                <div className="space-y-3 max-w-md mx-auto">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-sans font-semibold">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      {ocrProgress.status || 'Scanning screenshot locally...'}
                    </span>
                    <span className="text-cyan-400 font-bold text-sm">{ocrProgress.percent}%</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-[#181B24] border border-[#232732] rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.max(5, ocrProgress.percent)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-zinc-500">
                    Running in browser Web Worker with Tesseract.js. No server connections required.
                  </p>
                </div>
              </div>
            )}

            {/* Error & Fallback Banner */}
            {ocrError && !isOcrLoading && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2.5 text-xs text-rose-300">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>OCR Analysis Notification</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">{ocrError}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={enableManualEntryMode}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Switch to Manual Entry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-300 border border-[#232732] transition-colors"
                  >
                    Try Another Screenshot
                  </button>
                </div>
              </div>
            )}

            {/* Quick Demo Helper */}
            {!ocrResult && !isManualEntryMode && !isOcrLoading && (
              <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1E222B] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>Want to test OCR, Google Takeout JSON, or enter trips manually?</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="timeline-load-sample-ocr-btn"
                    onClick={loadSampleOcrData}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Sample OCR Data</span>
                  </button>
                  <button
                    type="button"
                    data-testid="timeline-load-sample-takeout-btn"
                    onClick={loadSampleTakeoutJson}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Load Sample Takeout JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={enableManualEntryMode}
                    className="px-2.5 py-1 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-300 border border-[#232732] text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Manual Entry</span>
                  </button>
                </div>
              </div>
            )}

            {/* VERIFICATION & PREVIEW CARD */}
            {(ocrResult || isManualEntryMode) && !isOcrLoading && (
              <div className="space-y-4">
                {/* Top Summary & Thumbnail Strip */}
                <div className="p-4 rounded-xl bg-[#0E1015] border border-[#1E222B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {ocrImagePreview ? (
                      <div className="w-16 h-12 rounded-lg overflow-hidden border border-[#232732] shrink-0 bg-black relative group">
                        <img
                          src={ocrImagePreview}
                          alt="Screenshot Thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => imageFileInputRef.current?.click()}
                          title="Change screenshot"
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white transition-opacity"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#181B24] border border-[#232732] flex items-center justify-center shrink-0">
                        <Edit2 className="w-5 h-5 text-cyan-400" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white tracking-tight">
                          {isManualEntryMode ? 'Manual Mileage Entry' : 'Verified OCR Extraction'}
                        </span>
                        {ocrResult?.summary_distance_displayed && !isManualEntryMode && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            Detected: {ocrResult.summary_distance_displayed}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {editableLegs.length} route leg(s) detected • Review and edit values before logging
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOcrResult(null);
                        setOcrImagePreview(null);
                        setOcrImageFile(null);
                        setIsManualEntryMode(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#181B24] hover:bg-[#1F232E] text-zinc-300 border border-[#232732] transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Upload New Image</span>
                    </button>
                    {!isManualEntryMode && (
                      <button
                        type="button"
                        onClick={enableManualEntryMode}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Manual Entry</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Primary Data Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Total Miles Editable Field */}
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1E222B] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="total-miles-input" className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Total Miles</span>
                      </label>
                      {editableLegs.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRecalculateTotalFromLegs}
                          className="text-[11px] text-cyan-400 hover:underline"
                        >
                          Sum from legs
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="total-miles-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editableTotalMiles}
                        onChange={(e) => setEditableTotalMiles(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#181B24] border border-[#232732] text-white font-mono text-sm focus:outline-none focus:border-cyan-500 pr-12"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-mono text-zinc-400">
                        mi
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Pre-filled from OCR/Takeout. Edit directly if needed.
                    </p>
                  </div>

                  {/* Trip Date Selector */}
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1E222B] space-y-1.5">
                    <label htmlFor="timeline-trip-date-input" className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Trip Date</span>
                    </label>
                    <input
                      id="timeline-trip-date-input"
                      data-testid="timeline-trip-date-input"
                      type="date"
                      value={editableTimelineDate}
                      onChange={(e) => setEditableTimelineDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B24] border border-[#232732] text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Date recorded in Distance Tracker &amp; Calendar.
                    </p>
                  </div>

                  {/* Activity Type Selector */}
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1E222B] space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-purple-400" />
                      <span>Activity Mode</span>
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#181B24] border border-[#232732] rounded-lg text-xs">
                      {(['drive', 'walk', 'run', 'cycle'] as DistanceActivityType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedActivityType(type)}
                          className={`py-1.5 px-2 rounded-md font-semibold capitalize text-center transition-all ${
                            selectedActivityType === type
                              ? 'bg-cyan-500 text-black shadow font-bold'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Logged into Distance Tracker under this modality.
                    </p>
                  </div>
                </div>

                {/* Detected Route Legs Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Detected Route Legs &amp; Stops ({editableLegs.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddLeg}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-[#181B24] hover:bg-[#1F232E] text-cyan-400 border border-[#232732] flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Leg</span>
                    </button>
                  </div>

                  {/* Interactive Mileage Chips Strip */}
                  {editableLegs.length > 0 && (
                    <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B] space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-500">
                          Interactive Mileage Chips ({editableLegs.length})
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Click <strong className="text-rose-400">✕</strong> to remove stray numbers / false positives
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {editableLegs.map((leg, idx) => (
                          <div
                            key={leg.id || idx}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#181B24] border border-[#232732] hover:border-cyan-500/50 text-xs transition-colors shadow-sm group"
                          >
                            <span
                              className="text-zinc-300 font-medium max-w-[130px] truncate"
                              title={`${leg.origin} → ${leg.destination}`}
                            >
                              {leg.origin || `Leg ${idx + 1}`} → {leg.destination || 'Stop'}
                            </span>
                            <span className="font-mono font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded text-[11px] border border-cyan-800/50">
                              {leg.distance_miles} mi
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLeg(leg.id)}
                              title="Remove stray number / false positive"
                              className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 p-1 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editableLegs.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#08090C] border border-[#1E222B] text-center text-xs text-zinc-400 space-y-2">
                      <p>No individual route legs detected.</p>
                      <button
                        type="button"
                        onClick={handleAddLeg}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Leg / Stop</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-[#1E222B] rounded-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-[#1E222B]/80">
                      {editableLegs.map((leg, idx) => (
                        <div
                          key={leg.id || idx}
                          className="p-3 bg-[#08090C] hover:bg-[#151821] transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono text-zinc-500">
                              Leg #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLeg(leg.id)}
                              title="Remove leg"
                              className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                            {/* Origin */}
                            <div className="sm:col-span-5">
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Origin</label>
                              <input
                                type="text"
                                value={leg.origin}
                                placeholder="Origin / Start location"
                                onChange={(e) => handleUpdateLeg(leg.id!, 'origin', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#181B24] border border-[#232732] text-white text-xs focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            {/* Destination */}
                            <div className="sm:col-span-5">
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Destination</label>
                              <input
                                type="text"
                                value={leg.destination}
                                placeholder="Destination / Stop location"
                                onChange={(e) => handleUpdateLeg(leg.id!, 'destination', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#181B24] border border-[#232732] text-white text-xs focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            {/* Distance */}
                            <div className="sm:col-span-1">
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Miles</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={leg.distance_miles}
                                onChange={(e) =>
                                  handleUpdateLeg(leg.id!, 'distance_miles', parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-1.5 py-1.5 rounded-lg bg-[#181B24] border border-[#232732] text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            {/* Duration */}
                            <div className="sm:col-span-1">
                              <label className="text-[10px] text-zinc-400 block mb-0.5">Time</label>
                              <input
                                type="text"
                                value={leg.duration}
                                placeholder="25m"
                                onChange={(e) => handleUpdateLeg(leg.id!, 'duration', e.target.value)}
                                className="w-full px-1.5 py-1.5 rounded-lg bg-[#181B24] border border-[#232732] text-white text-xs focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* View Raw Scanned Text Collapsible Drawer */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-[#0E1015] hover:bg-[#151821] border border-[#1E222B] text-xs font-semibold text-zinc-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span>View Raw Scanned Text</span>
                        {rawOcrText && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#181B24] text-zinc-400 border border-[#232732]">
                            {rawOcrText.split('\n').filter(Boolean).length} lines recognized
                          </span>
                        )}
                      </div>
                      {showRawText ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>

                    {showRawText && (
                      <div className="mt-2 p-3 bg-[#08090C] rounded-xl border border-[#1E222B] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400 font-mono">
                            Raw extracted text (editable — click Re-Parse Text after editing):
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="timeline-reparse-raw-text-btn"
                              onClick={handleReparseTimelineRawText}
                              className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] flex items-center gap-1.5 font-mono font-semibold transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Re-Parse Text</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyRawText}
                              className="px-2.5 py-1 rounded bg-[#181B24] hover:bg-[#20242E] text-zinc-300 hover:text-white border border-[#232732] text-[11px] flex items-center gap-1.5 font-mono transition-colors"
                            >
                              {isRawCopied ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{isRawCopied ? 'Copied' : 'Copy Text'}</span>
                            </button>
                          </div>
                        </div>
                        <textarea
                          data-testid="timeline-raw-text-editor"
                          value={rawOcrText}
                          onChange={(e) => setRawOcrText(e.target.value)}
                          rows={5}
                          placeholder="Paste or edit raw timeline OCR text here..."
                          className="w-full text-[11px] font-mono p-3 bg-black/70 rounded-lg text-emerald-400/90 border border-[#20242E] focus:outline-none focus:border-cyan-500/60 leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pinned Modal Action Footer */}
        <div className="flex items-center justify-between pt-3.5 border-t border-[#20242E] mt-3 shrink-0">
          <div className="text-[11px] text-zinc-500 font-mono">
            {activeTab === 'funds_ocr' && (fundsOcrResult || isFundsManualEntryMode) && (
              <span>
                {fundsCalculatedSummary.selectedCount} of {editableFundsItems.length} selected • Net:{' '}
                <strong className={fundsCalculatedSummary.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {fundsCalculatedSummary.totalNet >= 0 ? '+' : ''}${fundsCalculatedSummary.totalNet.toFixed(2)}
                </strong>
              </span>
            )}
            {activeTab === 'bank_csv' && bankCsvResult && (
              <span>{selectedBankCount} of {bankCsvResult.newCount} new selected</span>
            )}
            {isTimelineOcrActive && (ocrResult || isManualEntryMode) && (
              <span>
                {editableTotalMiles} mi • {editableLegs.length} leg(s)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={importModalGuard.requestExplicitClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-[#181B24] transition-colors"
            >
              Cancel
            </button>

            {/* Funds OCR Commit */}
            {activeTab === 'funds_ocr' && (fundsOcrResult || isFundsManualEntryMode) && (
              <button
                type="button"
                onClick={handleConfirmAndLogFunds}
                disabled={fundsCalculatedSummary.selectedCount === 0}
                className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 ${
                  fundsCalculatedSummary.selectedCount > 0
                    ? accent.primaryBg
                    : 'bg-[#181B24] text-zinc-500 cursor-not-allowed border border-[#232732]'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Confirm &amp; Log ({fundsCalculatedSummary.selectedCount})</span>
              </button>
            )}

            {/* Bank CSV Commit */}
            {activeTab === 'bank_csv' && bankCsvResult && (
              <button
                type="button"
                onClick={handleImportBankCommit}
                disabled={selectedBankCount === 0}
                className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all ${
                  selectedBankCount > 0
                    ? accent.primaryBg
                    : 'bg-[#181B24] text-zinc-500 cursor-not-allowed border border-[#232732]'
                }`}
              >
                Import {selectedBankCount} Transactions
              </button>
            )}

            {/* Timeline OCR Confirm & Log */}
            {isTimelineOcrActive && (ocrResult || isManualEntryMode) && (
              <button
                type="button"
                onClick={handleConfirmAndLog}
                className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 ${accent.primaryBg}`}
              >
                <Check className="w-4 h-4" />
                <span>Confirm &amp; Log</span>
              </button>
            )}

            {activeTab === 'local_folder_sync' && (
              <button
                type="button"
                onClick={() => setActiveTab('bank_csv')}
                className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all ${accent.primaryBg}`}
              >
                Open Importer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
