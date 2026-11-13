// src/constants/sharedResearch.js
//
// Shared Research "Work an idea" — THE VOCABULARY, one source for the server
// (api/_utils/sharedResearch/*) and B2's sheet (spec of record
// docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md §6.1, §7.3, §8,
// §15). The server writes what this file names and the sheet reads the same
// words, so a label and its record can never drift (BUILD_RULES §9).
//
// IMPORTS NOTHING, on purpose: it is Node-clean for the api/ importers under the
// BUILD_RULES §4 import rule (their test imports are the dependency-surface
// guard), and the §2.3 import-boundary scan (archetypeRegistry.test.js) walks it.
// Values restated from other modules (the horizon windows) are pinned equal to
// their sources by sharedResearch.test.js.

/** What an entry's itemRef may name (spec §6.3): a FantasyTimes story, or the caller's own SignalDrop. A session field, never a finding source. */
export const ENTRY_ITEM_RECORD_KINDS = Object.freeze(['fantasyTimesStories', 'signalDrops']);
/** How an investigation started. */
export const ENTRY_KINDS = Object.freeze(['item', 'observation', 'signaldrop']);

/**
 * One question per FantasyTimes reporter beat (spec §8, R3), keyed by the
 * story's `reporterBeat` exactly as the reporters write it
 * (api/_utils/fantasyTimesPrompts.js REPORTER_PROFILES). Copy for the founder's
 * eye; the player edits it, and the stored question is whatever they confirmed.
 */
export const BEAT_QUESTIONS = Object.freeze({
  'Market Pulse': 'What changed in the market this story describes, and which businesses does it reach?',
  'Stock Spotlight': 'What business development, if any, is behind this move, and who else does it touch?',
  'Economics Desk': 'Which businesses does this economic development reach, and through what?',
  'Earnings Analyst': "What changed in this company's business, and does it reach its suppliers, customers or competitors?",
  'Sector Strategist': 'Which companies earn from the development this story describes, and how directly?',
});
/** Any other beat (Thematic & Industry Research included). */
export const DEFAULT_BEAT_QUESTION = 'What changed here, who does it reach, and which company earns from it?';
/** The question for a story's beat; the default for an unknown or missing beat. */
export const questionForBeat = (beat) => (typeof beat === 'string' && Object.hasOwn(BEAT_QUESTIONS, beat) ? BEAT_QUESTIONS[beat] : DEFAULT_BEAT_QUESTION);

/** The four step intents (spec §4.3). */
export const STEP_INTENTS = Object.freeze(['next', 'examine', 'refresh', 'direction']);
/** How the player ends an investigation (spec §4.5). */
export const CLOSE_REASONS = Object.freeze(['concluded', 'abandoned']);

// ── budgets (spec D-1, §6.12) ────────────────────────────────────────────────
/** Steps per investigation. */
export const STEP_BUDGET = 10;
/** New investigations per player per ET day (counted at `open`). */
export const PER_DAY = 3;
/** Framings per player per ET day (counted when the model call is made). */
export const FRAMINGS_PER_DAY = 10;
/**
 * A player's step CALLS per ET day — the spec's "30 Sonnet steps a day" (§6.12 control 3: 3 investigations × 10
 * steps), counted when the model call is made, so failed steps count too and saved-up investigations cannot exceed it.
 */
export const STEP_CALLS_PER_DAY = PER_DAY * STEP_BUDGET;
/** The app's step CALLS per ET day, as a multiple of its persisted-step ceiling (failed steps are calls too). */
export const GLOBAL_STEP_CALLS_FACTOR = 2;
/** The whole app's research steps per ET day; SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY overrides it at call time. */
export const GLOBAL_STEPS_PER_DAY_DEFAULT = 150;
/** The whole app's framings per ET day. */
export const GLOBAL_FRAMINGS_PER_DAY_DEFAULT = 300;
/** A summary older than this many ET calendar days shows "{age} old · Refresh" (routine 8). */
export const AGE_DAYS = 2;

// ── horizons (spec F9, routine 9, §7.3) ─────────────────────────────────────
/** The three horizons the picker offers (the Practice Field's three); never intraday, never unspecified. */
export const ADOPTABLE_HORIZONS = Object.freeze(['swing', 'positional', 'longterm']);
/** Each offered horizon's window in trading sessions — HORIZON_WINDOW_SESSIONS restated (pinned equal by test). */
export const HORIZON_SESSIONS = Object.freeze({ swing: 10, positional: 30, longterm: 60 });
export const HORIZON_LABELS = Object.freeze({
  swing: 'swing · about 10 sessions',
  positional: 'positional · about 30 sessions',
  longterm: 'longterm · about 60 sessions',
});
export const HORIZON_HELPER = "How long you expect the business effect to take. Separate from any game's length.";

// ── companies (spec §6.7) ───────────────────────────────────────────────────
/** A relationship fact is written "{Role} · {fact}" with Role from this closed list; companiesOf reads the prefix. */
export const RELATIONSHIP_ROLES = Object.freeze(['Product owner', 'Supplier', 'Customer', 'Partner', 'Competitor', 'Other']);
/** The separator between a relationship's role and its fact. */
export const ROLE_SEPARATOR = ' · ';
/** The typed words an unresolved link carries (spec §5.2). */
export const UNRESOLVED_REASONS = Object.freeze(['not_checked', 'not_disclosed', 'identity_unresolved', 'single_source']);
/** Game eligibility, from code (spec F12, §6.7). */
export const ELIGIBILITY_LABELS = Object.freeze({
  eligible: "In the game's universe",
  outside: "Outside the game's universe · research still valid",
  unresolved: "Symbol · not in the app's records",
});

// ── what the screen calls each finding (spec §7.3) ──────────────────────────
/** By status. */
export const STATUS_LABELS = Object.freeze({ verified: 'Source-backed', unverified: 'Inferred', unavailable: 'Unresolved' });
/** By the typed statusReason the server writes; a reason not listed reads STATUS_REASON_FALLBACK. */
export const STATUS_REASON_LABELS = Object.freeze({
  reporter_content: 'From FantasyTimes',
  player_words: 'Your observation',
  player_drop: 'Your drop',
  from_drop: 'From your drop',
  inference: 'Inferred',
  uncited: 'Inferred · no source cited',
  proposed: 'Proposed next step',
  proposed_claim: 'Proposed claim',
  no_next_step: 'No next step proposed',
  not_checked: 'Not yet checked',
  not_disclosed: 'Not disclosed',
  identity_unresolved: "Symbol · not in the app's records",
  single_source: 'Single source',
});
export const STATUS_REASON_FALLBACK = 'Unresolved';
/** A label for a finding from (kind, status, statusReason) — the rule of spec §7.3, here so both sides read one table. */
export function findingLabelOf({ kind, status, statusReason } = {}) {
  if (status === 'verified') return STATUS_LABELS.verified;
  if (kind === 'observation') return statusReason === 'player_drop' ? STATUS_REASON_LABELS.player_drop : STATUS_REASON_LABELS.player_words;
  if (kind === 'coverage' && statusReason === 'reporter_content') return STATUS_REASON_LABELS.reporter_content;
  if (kind === 'inference' && statusReason === 'from_drop') return STATUS_REASON_LABELS.from_drop;
  if (status === 'unavailable') {
    const reason = Object.hasOwn(STATUS_REASON_LABELS, statusReason ?? '') ? STATUS_REASON_LABELS[statusReason] : STATUS_REASON_FALLBACK;
    return `${STATUS_LABELS.unavailable} · ${reason}`;
  }
  return STATUS_LABELS.unverified;
}
