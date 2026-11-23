export type ModalDismissTrigger =
  | 'backdrop_single_click'
  | 'backdrop_double_click'
  | 'escape_key'
  | 'close_button'
  | 'cancel_button';

export type ModalDismissDecision =
  | 'ignore'
  | 'close_immediately'
  | 'prompt_unsaved_confirmation';

export const UNSAVED_CHANGES_MESSAGE =
  'You have unsaved changes. Are you sure you want to close?';

/**
 * Pure decision function for standardized modal dismissal rules:
 * 1. 'backdrop_single_click' is ALWAYS ignored to prevent accidental misclicks from closing forms.
 * 2. When isDirty === false:
 *    - 'backdrop_double_click', 'escape_key', 'close_button', and 'cancel_button' close immediately.
 * 3. When isDirty === true:
 *    - 'escape_key', 'backdrop_double_click', and 'close_button' trigger 'prompt_unsaved_confirmation'
 *      ("You have unsaved changes. Are you sure you want to close?") instead of immediately destroying input.
 *    - 'cancel_button' triggers 'prompt_unsaved_confirmation' when dirty so accidental Cancel clicks are also guarded.
 */
export function evaluateModalDismissAction(
  trigger: ModalDismissTrigger,
  isDirty: boolean
): ModalDismissDecision {
  if (trigger === 'backdrop_single_click') {
    return 'ignore';
  }

  if (!isDirty) {
    return 'close_immediately';
  }

  return 'prompt_unsaved_confirmation';
}

/**
 * Compares current form values against initial baseline values to determine if the form is dirty.
 */
export function isFormStateDirty<T extends Record<string, unknown>>(
  initialState: T,
  currentState: T
): boolean {
  const keys = new Set([...Object.keys(initialState), ...Object.keys(currentState)]);
  for (const key of keys) {
    const a = initialState[key];
    const b = currentState[key];
    if (typeof a === 'string' && typeof b === 'string') {
      if (a.trim() !== b.trim()) return true;
    } else if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    } else if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    } else if (a !== b) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates a touch tap on a modal backdrop:
 * - A single tap is ignored (records timestamp) so accidental thumb taps never close modals.
 * - A second tap within `windowMs` (default 450ms) acts as an intentional double-tap and
 *   delegates to `evaluateModalDismissAction('backdrop_double_click', isDirty)`.
 */
export function evaluateTouchBackdropTap(
  lastTapTimestampMs: number,
  currentTapTimestampMs: number,
  isDirty: boolean,
  windowMs: number = 450
): { decision: ModalDismissDecision; nextLastTapMs: number } {
  const delta = currentTapTimestampMs - lastTapTimestampMs;
  if (lastTapTimestampMs > 0 && delta >= 0 && delta <= windowMs) {
    return {
      decision: evaluateModalDismissAction('backdrop_double_click', isDirty),
      nextLastTapMs: 0,
    };
  }
  return {
    decision: 'ignore',
    nextLastTapMs: currentTapTimestampMs,
  };
}
