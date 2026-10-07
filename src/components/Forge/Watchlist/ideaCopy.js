// src/components/Forge/Watchlist/ideaCopy.js
//
// Pilot P1a — the Forge "Idea" panel's words. The lifecycle SENTENCES are
// table C of docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md, VERBATIM (blessed by
// the founder 24 Sep 2026 — "the only source player-facing strings ship
// from"); ideaCopy.test.js reads that table and pins every line byte for byte.
// Placeholders in [brackets] are filled from the record, never invented: when
// a placeholder has no recorded value the line is not rendered at all
// (fillLine → null), and the panel shows the typed status chip alone.
//
// The labels below (status, horizon, actions) are UI labels, not table
// sentences; none uses table E's forbidden vocabulary (ideaCopy.test.js scans).

import { HORIZON_WINDOW_SESSIONS } from '../../../constants/hypothesisRecords';

/** Table C, verbatim. */
export const LIFECYCLE_LINES = Object.freeze({
  reviewDueHorizon: "Your [SYM] idea reached its time-frame ([window]). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.",
  reviewDueBattleEnded: "The battle ended with your [SYM] idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.",
  invalidated: "Your [SYM] idea hit its invalidation: [typed condition]. That's recorded on the idea itself — what happens next is your call.",
  reaffirmed: "Reaffirmed — that's a fresh version of the same idea with a new clock. The old one stays in the record exactly as it was.",
  // For P1b's deploy admission (a due version cannot deploy); exported now, rendered by P1b.
  dueDeploy: 'This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys.',
});

/**
 * Fill a table-C line's placeholders. Returns null when any placeholder the
 * line uses has no value — a sentence is never rendered with an invented or
 * blank slot.
 *
 * @param {string} line  a LIFECYCLE_LINES value
 * @param {{ sym?: string|null, window?: string|null, condition?: string|null }} values
 */
export function fillLine(line, { sym = null, window = null, condition = null } = {}) {
  const slots = { '[SYM]': sym, '[window]': window, '[typed condition]': condition };
  let out = line;
  for (const [slot, value] of Object.entries(slots)) {
    if (!out.includes(slot)) continue;
    if (typeof value !== 'string' || value.trim() === '') return null;
    out = out.split(slot).join(value);
  }
  return out;
}

/**
 * [SYM] from the RECORD — the version's own typed conditions, and nothing
 * else: one to three distinct symbols, else null (the line is not rendered).
 * Never the parent list's tickers: they are mutable, not part of the version,
 * and in the editor they are the live, unsaved input (spec §2.6 "no reader
 * resolves the current saved list as historical meaning"; BUILD_RULES §9;
 * review L1-2 / L4-6). P1a writes no conditions, so the review lines wait for
 * P1b to supply a frozen source (the deploying battle's snapshot).
 */
export function ideaSymbolOf(version) {
  const fromConditions = [...(version?.activation || []), ...(version?.invalidation || [])]
    .map((c) => c?.symbol).filter((s) => typeof s === 'string' && s);
  const distinct = [...new Set(fromConditions)];
  return distinct.length >= 1 && distinct.length <= 3 ? distinct.join(' / ') : null;
}

export const HORIZON_LABELS = Object.freeze({
  intraday: 'Intraday', swing: 'Swing', positional: 'Positional', longterm: 'Long-term', unspecified: 'No time-frame',
});

/** [window] from the record's horizon: the companion §6 window, e.g. "Swing, 10 trading sessions". Null for unspecified. */
export function windowTextOf(horizonEnum) {
  const n = HORIZON_WINDOW_SESSIONS[horizonEnum];
  return Number.isInteger(n) ? `${HORIZON_LABELS[horizonEnum]}, ${n} trading sessions` : null;
}

export const HORIZON_SOURCE_LABELS = Object.freeze({
  parse: 'from your drop', theme_default: 'theme default', default: 'not set yet', player: 'your pick',
});

export const STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  researched: 'Researched',
  ready: 'Ready',
  waiting_for_evidence: 'Waiting for evidence',
  activated: 'Activated',
  invalidated: 'Invalidated',
  review_due: 'Review due',
  retired: 'Retired',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
});

export const ACTION_LABELS = Object.freeze({
  ready: 'Mark ready',
  wait: 'Waiting for evidence',
  reject: 'Reject',
  cancel: 'Cancel idea',
  retire: 'Retire',
  reaffirm: 'Reaffirm',
});

/** The panel's own prompts and notes (UI copy; no lifecycle claims). */
export const PANEL_COPY = Object.freeze({
  title: 'Idea',
  empty: 'No idea is recorded for this list yet.',
  writeFirst: 'Write the idea',
  saveNew: 'Save as a new version',
  editorHint: 'Editing never changes a saved version — it creates the next one.',
  draftHint: 'The new version starts as a draft.',
  statementPlaceholder: 'State the idea in a sentence or two',
  horizonPick: 'Time-frame',
  horizonKeep: 'Keep the current time-frame',
  // A first version inherits the list's default (a SignalDrop list's parsed
  // time-frame, else none) — the panel cannot see it, so it never names one (review L4-4).
  horizonDefault: 'Default for this list',
  missingEvidencePrompt: 'What evidence is missing?',
  confirm: 'Confirm',
  keep: 'Keep',
  closeConfirm: 'This closes the idea version for good.',
  save: 'Save',
  cancelEdit: 'Back',
  history: 'Versions',
  waitingOn: 'Waiting on',
  loadFailed: 'The idea record could not be loaded.',
  retry: 'Retry',
  moveFailed: 'That change did not go through. Try again.',
  saved: 'Saved',
  statusSince: 'Status since',
  firstDeployed: 'First deployed',
  reviewDue: 'Review due',
});

const ET_DATE = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });

/** A record timestamp as a market-calendar date ("Oct 7, 2026"); null for null. */
export function formatIdeaDate(iso) {
  if (typeof iso !== 'string' || !iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : ET_DATE.format(d);
}
