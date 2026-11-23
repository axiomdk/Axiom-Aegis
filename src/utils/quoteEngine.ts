import { QuoteItem, QuoteState } from '../types';
import { sanitizeTextInput } from './matrixLayoutEngine';

export const BUILT_IN_QUOTE_VAULT: QuoteItem[] = [
  {
    id: 'q-1',
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: 'Aristotle',
    category: 'discipline',
  },
  {
    id: 'q-2',
    text: 'You have power over your mind — not outside events. Realize this, and you will find strength.',
    author: 'Marcus Aurelius',
    category: 'stoicism',
  },
  {
    id: 'q-3',
    text: 'Discipline equals freedom.',
    author: 'Jocko Willink',
    category: 'discipline',
  },
  {
    id: 'q-4',
    text: 'Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat.',
    author: 'Sun Tzu',
    category: 'strategy',
  },
  {
    id: 'q-5',
    text: 'Waste no more time arguing about what a good man should be. Be one.',
    author: 'Marcus Aurelius',
    category: 'stoicism',
  },
  {
    id: 'q-6',
    text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.',
    author: 'Stephen King',
    category: 'execution',
  },
  {
    id: 'q-7',
    text: 'No man is free who is not master of himself.',
    author: 'Epictetus',
    category: 'stoicism',
  },
  {
    id: 'q-8',
    text: 'Victorious warriors win first and then go to war, while defeated warriors go to war first and then seek to win.',
    author: 'Sun Tzu',
    category: 'strategy',
  },
  {
    id: 'q-9',
    text: 'He who has a why to live for can bear almost any how.',
    author: 'Friedrich Nietzsche',
    category: 'stoicism',
  },
  {
    id: 'q-10',
    text: 'Action cures fear. Indecision, postponement, on the other hand, fertilize fear.',
    author: 'David J. Schwartz',
    category: 'execution',
  },
  {
    id: 'q-11',
    text: 'First say to yourself what you would be; and then do what you have to do.',
    author: 'Epictetus',
    category: 'discipline',
  },
  {
    id: 'q-12',
    text: 'The impediment to action advances action. What stands in the way becomes the way.',
    author: 'Marcus Aurelius',
    category: 'stoicism',
  },
  {
    id: 'q-13',
    text: 'Plans are worthless, but planning is everything.',
    author: 'Dwight D. Eisenhower',
    category: 'strategy',
  },
  {
    id: 'q-14',
    text: 'Luck is what happens when preparation meets opportunity.',
    author: 'Seneca',
    category: 'strategy',
  },
  {
    id: 'q-15',
    text: 'Do every act of your life as though it were the very last act of your life.',
    author: 'Marcus Aurelius',
    category: 'execution',
  },
  {
    id: 'q-16',
    text: 'We do not rise to the level of our expectations. We fall to the level of our training.',
    author: 'Archilochus',
    category: 'discipline',
  },
  {
    id: 'q-17',
    text: 'If a man knows not to which port he sails, no wind is favorable.',
    author: 'Seneca',
    category: 'strategy',
  },
  {
    id: 'q-18',
    text: 'Vision without execution is hallucination.',
    author: 'Thomas Edison',
    category: 'execution',
  },
  {
    id: 'q-19',
    text: 'How long are you going to wait before you demand the best for yourself?',
    author: 'Epictetus',
    category: 'discipline',
  },
  {
    id: 'q-20',
    text: 'In the midst of chaos, there is also opportunity.',
    author: 'Sun Tzu',
    category: 'strategy',
  },
  {
    id: 'q-21',
    text: 'Suffer the pain of discipline or suffer the pain of regret.',
    author: 'Jim Rohn',
    category: 'discipline',
  },
  {
    id: 'q-22',
    text: 'Difficulties strengthen the mind, as labor does the body.',
    author: 'Seneca',
    category: 'stoicism',
  },
  {
    id: 'q-23',
    text: 'Focus is a matter of deciding what things you are not going to do.',
    author: 'John Carmack',
    category: 'strategy',
  },
  {
    id: 'q-24',
    text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain',
    category: 'execution',
  },
  {
    id: 'q-25',
    text: 'Small disciplines repeated with consistency every day lead to great achievements gained slowly over time.',
    author: 'John C. Maxwell',
    category: 'discipline',
  },
  {
    id: 'q-26',
    text: 'Begin at once to live, and count each separate day as a separate life.',
    author: 'Seneca',
    category: 'stoicism',
  },
  {
    id: 'q-27',
    text: 'Fast is fine, but accuracy is everything.',
    author: 'Wyatt Earp',
    category: 'execution',
  },
  {
    id: 'q-28',
    text: 'It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.',
    author: 'Seneca',
    category: 'stoicism',
  },
  {
    id: 'q-29',
    text: 'Relentless execution compounds every single day.',
    author: 'Axiom Protocol',
    category: 'execution',
  },
  {
    id: 'q-30',
    text: 'Control your perceptions. Direct your actions properly. Willingly accept what is outside your control.',
    author: 'Marcus Aurelius',
    category: 'stoicism',
  },
  {
    id: 'q-31',
    text: 'Give me six hours to chop down a tree and I will spend the first four sharpening the axe.',
    author: 'Abraham Lincoln',
    category: 'strategy',
  },
  {
    id: 'q-32',
    text: 'Long-term consistency trumps short-term intensity.',
    author: 'Bruce Lee',
    category: 'discipline',
  },
];

export const DEFAULT_QUOTE_STATE: QuoteState = {
  customQuotes: [],
  activeQuoteId: undefined,
  isPinned: false,
  lastSelectedDate: undefined,
};

/**
 * Deterministically hashes a YYYY-MM-DD date string into a valid index in [0, totalQuotes - 1].
 */
export function getDailyQuoteIndex(dateStr: string, totalQuotes: number = BUILT_IN_QUOTE_VAULT.length): number {
  if (totalQuotes <= 0) return 0;
  const cleanDate = typeof dateStr === 'string' && dateStr.trim() ? dateStr.trim() : '2026-10-22';
  let hash = 2166136261;
  for (let i = 0; i < cleanDate.length; i++) {
    hash ^= cleanDate.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % totalQuotes;
}

/**
 * Returns the combined quote library (user custom quotes + built-in vault).
 */
export function getAllQuotes(quoteState?: QuoteState): QuoteItem[] {
  const custom = Array.isArray(quoteState?.customQuotes) ? quoteState.customQuotes : [];
  return [...custom, ...BUILT_IN_QUOTE_VAULT];
}

/**
 * Resolves the active Quote of the Day:
 * 1. If `isPinned` is true and `activeQuoteId` exists, returns that pinned quote regardless of date.
 * 2. If `activeQuoteId` was manually selected/shuffled today (`lastSelectedDate === dateStr`), returns it.
 * 3. Otherwise, deterministically picks the quote for `dateStr` from the full library.
 */
export function resolveActiveQuote(
  quoteState: QuoteState | undefined,
  dateStr: string = new Date().toISOString().split('T')[0]
): QuoteItem {
  const allQuotes = getAllQuotes(quoteState);
  if (allQuotes.length === 0) {
    return BUILT_IN_QUOTE_VAULT[0];
  }

  if (quoteState?.activeQuoteId) {
    const matched = allQuotes.find((q) => q.id === quoteState.activeQuoteId);
    if (matched) {
      if (quoteState.isPinned || quoteState.lastSelectedDate === dateStr) {
        return matched;
      }
    }
  }

  const dailyIdx = getDailyQuoteIndex(dateStr, allQuotes.length);
  return allQuotes[dailyIdx] || allQuotes[0];
}

/**
 * Cycles to the next quote in the combined vault and updates `activeQuoteId` and `lastSelectedDate`.
 */
export function cycleToNextQuote(
  quoteState: QuoteState | undefined,
  dateStr: string = new Date().toISOString().split('T')[0]
): { nextState: QuoteState; nextQuote: QuoteItem } {
  const sanitized = sanitizeQuoteState(quoteState);
  const allQuotes = getAllQuotes(sanitized);
  const current = resolveActiveQuote(sanitized, dateStr);
  const currentIdx = allQuotes.findIndex((q) => q.id === current.id);
  const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % allQuotes.length : 0;
  const nextQuote = allQuotes[nextIdx] || allQuotes[0];

  const nextState: QuoteState = {
    ...sanitized,
    activeQuoteId: nextQuote.id,
    lastSelectedDate: dateStr,
  };

  return { nextState, nextQuote };
}

/**
 * Toggles the pinned/locked state for the currently active quote.
 */
export function togglePinQuote(
  quoteState: QuoteState | undefined,
  dateStr: string = new Date().toISOString().split('T')[0]
): QuoteState {
  const sanitized = sanitizeQuoteState(quoteState);
  const current = resolveActiveQuote(sanitized, dateStr);
  const nextPinned = !sanitized.isPinned;

  return {
    ...sanitized,
    activeQuoteId: current.id,
    isPinned: nextPinned,
    lastSelectedDate: dateStr,
  };
}

/**
 * Sanitizes and saves a custom quote (either creating a new custom quote or updating an existing one)
 * and sets it as the active quote.
 */
export function upsertCustomQuote(
  quoteState: QuoteState | undefined,
  rawText: string,
  rawAuthor: string,
  dateStr: string = new Date().toISOString().split('T')[0],
  existingCustomId?: string
): { nextState: QuoteState; savedQuote: QuoteItem } | null {
  const cleanText = sanitizeTextInput(rawText, '', 280);
  if (!cleanText) return null;
  const cleanAuthor = sanitizeTextInput(rawAuthor, 'Personal Maxim', 80);

  const sanitized = sanitizeQuoteState(quoteState);
  let savedQuote: QuoteItem;
  let updatedCustomQuotes: QuoteItem[];

  if (existingCustomId && sanitized.customQuotes.some((q) => q.id === existingCustomId)) {
    savedQuote = {
      id: existingCustomId,
      text: cleanText,
      author: cleanAuthor,
      category: 'custom',
      isCustom: true,
    };
    updatedCustomQuotes = sanitized.customQuotes.map((q) =>
      q.id === existingCustomId ? savedQuote : q
    );
  } else {
    savedQuote = {
      id: `custom-quote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: cleanText,
      author: cleanAuthor,
      category: 'custom',
      isCustom: true,
    };
    updatedCustomQuotes = [savedQuote, ...sanitized.customQuotes];
  }

  const nextState: QuoteState = {
    ...sanitized,
    customQuotes: updatedCustomQuotes,
    activeQuoteId: savedQuote.id,
    lastSelectedDate: dateStr,
  };

  return { nextState, nextQuote: savedQuote, savedQuote } as { nextState: QuoteState; savedQuote: QuoteItem };
}

/**
 * Deletes a custom quote by ID and falls back cleanly if it was the active quote.
 */
export function deleteCustomQuote(
  quoteState: QuoteState | undefined,
  quoteId: string
): QuoteState {
  const sanitized = sanitizeQuoteState(quoteState);
  const remaining = sanitized.customQuotes.filter((q) => q.id !== quoteId);
  const wasActive = sanitized.activeQuoteId === quoteId;

  return {
    ...sanitized,
    customQuotes: remaining,
    activeQuoteId: wasActive ? undefined : sanitized.activeQuoteId,
    isPinned: wasActive ? false : sanitized.isPinned,
  };
}

/**
 * Validates and sanitizes a QuoteState object against schema rules.
 */
export function sanitizeQuoteState(candidate: unknown): QuoteState {
  if (!candidate || typeof candidate !== 'object') {
    return { ...DEFAULT_QUOTE_STATE, customQuotes: [] };
  }

  const raw = candidate as Partial<QuoteState>;
  const customQuotes: QuoteItem[] = Array.isArray(raw.customQuotes)
    ? raw.customQuotes
        .filter((q): q is QuoteItem => Boolean(q && typeof q === 'object' && typeof q.id === 'string'))
        .map((q) => ({
          id: sanitizeTextInput(q.id, `custom-quote-${Date.now()}`, 64),
          text: sanitizeTextInput(q.text, '', 280),
          author: sanitizeTextInput(q.author, 'Personal Maxim', 80),
          category: 'custom' as const,
          isCustom: true,
        }))
        .filter((q) => q.text.length > 0)
    : [];

  const activeQuoteId =
    typeof raw.activeQuoteId === 'string' && raw.activeQuoteId.trim()
      ? sanitizeTextInput(raw.activeQuoteId, '', 64)
      : undefined;

  const isPinned = Boolean(raw.isPinned);

  const lastSelectedDate =
    typeof raw.lastSelectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastSelectedDate.trim())
      ? raw.lastSelectedDate.trim()
      : undefined;

  return {
    customQuotes,
    activeQuoteId: activeQuoteId || undefined,
    isPinned,
    lastSelectedDate,
  };
}
