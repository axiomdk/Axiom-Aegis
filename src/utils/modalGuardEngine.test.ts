import { test } from 'node:test';
import assert from 'node:assert';
import {
  evaluateModalDismissAction,
  isFormStateDirty,
  UNSAVED_CHANGES_MESSAGE,
} from './modalGuardEngine';

test('Modal Guard Engine: single backdrop click is always ignored regardless of dirty state', () => {
  assert.strictEqual(evaluateModalDismissAction('backdrop_single_click', false), 'ignore');
  assert.strictEqual(evaluateModalDismissAction('backdrop_single_click', true), 'ignore');
});

test('Modal Guard Engine: when isDirty is false, double-click, escape, and close buttons close immediately', () => {
  assert.strictEqual(
    evaluateModalDismissAction('backdrop_double_click', false),
    'close_immediately'
  );
  assert.strictEqual(evaluateModalDismissAction('escape_key', false), 'close_immediately');
  assert.strictEqual(evaluateModalDismissAction('close_button', false), 'close_immediately');
  assert.strictEqual(evaluateModalDismissAction('cancel_button', false), 'close_immediately');
});

test('Modal Guard Engine: when isDirty is true, escape, backdrop double-click, and close triggers prompt confirmation', () => {
  assert.strictEqual(
    evaluateModalDismissAction('backdrop_double_click', true),
    'prompt_unsaved_confirmation'
  );
  assert.strictEqual(
    evaluateModalDismissAction('escape_key', true),
    'prompt_unsaved_confirmation'
  );
  assert.strictEqual(
    evaluateModalDismissAction('close_button', true),
    'prompt_unsaved_confirmation'
  );
  assert.strictEqual(
    evaluateModalDismissAction('cancel_button', true),
    'prompt_unsaved_confirmation'
  );
  assert.strictEqual(
    UNSAVED_CHANGES_MESSAGE,
    'You have unsaved changes. Are you sure you want to close?'
  );
});

test('Modal Guard Engine: isFormStateDirty accurately detects modified fields and ignores whitespace-only diffs', () => {
  const baseline = {
    title: '',
    category: 'work',
    startTime: '09:00',
    endTime: '10:30',
    notes: '',
  };

  assert.strictEqual(isFormStateDirty(baseline, { ...baseline }), false);
  assert.strictEqual(isFormStateDirty(baseline, { ...baseline, title: '   ' }), false);
  assert.strictEqual(
    isFormStateDirty(baseline, { ...baseline, title: 'Deep Work Architecture' }),
    true
  );
  assert.strictEqual(
    isFormStateDirty(baseline, { ...baseline, startTime: '10:00' }),
    true
  );
});
