// api/_utils/playerFieldReaders.js
//
// Integrity follow-up 2 (8 Oct 2026), Part B — no player-writable value can
// make a server job throw. Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// A battle's owner may write `strategyPreset`, `gameplanMeeting`,
// `gameplanMeetingHistory`, `battleLedger` and `dailyGrades` (and the other
// fields of the agentBattles update allowlist in firestore.rules) from the
// browser at any moment between ticks. Before this build the evaluation cron,
// the daily review and the chat read them as if the server had written them:
// a `suggestedSwaps` of `[null]`, a `gameplanMeetingHistory` that is a map or a
// `strategyPreset` of 'constructor' made every check throw before it saved the
// score — which then froze through the battle's end (review I1-1 of the
// integrity build, docs/audits/20261007_BUILD_INTEGRITY_PROPOSAL_FORGERY.md §13).
//
// THE RULE: every read of a player-writable field goes through a reader here.
// A reader type-checks the value and treats a malformed one as absent or as
// the default. A well-formed value comes back AS IT IS (the same reference),
// so every path a server-written value takes is byte-identical.
//
// One product import: the server's own preset table (read, never edited).

import { PRESET_CONFIGS } from './agentPresetConfig.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The preset every battle falls back to (the cron's own default). */
export const DEFAULT_PRESET = 'balanced';

/**
 * The preset key for a battle's `strategyPreset`: an OWN key of the server's
 * preset table, else 'balanced'. A plain property lookup let an inherited name
 * ('constructor', 'toString', '__proto__') return a non-table, and the risk
 * code then threw on it. Every string the table does not hold already read as
 * balanced, so the config a well-formed value selects is unchanged.
 */
export function presetKeyOf(value) {
  return typeof value === 'string' && Object.hasOwn(PRESET_CONFIGS, value) ? value : DEFAULT_PRESET;
}

/** A gameplan meeting: the stored value when it is a plain object, else absent (null). */
export function meetingOf(value) {
  return isPlainObject(value) ? value : null;
}

/**
 * A meeting's legs with their positions in `suggestedSwaps`: the plain-object
 * entries of an array. A `suggestedSwaps` that is not an array, and an entry
 * that is not an object (`null`, a string, a number), contributes no leg.
 *
 * @returns {{ index: number, leg: object }[]}
 */
export function meetingLegsOf(meeting) {
  const legs = isPlainObject(meeting) && Array.isArray(meeting.suggestedSwaps) ? meeting.suggestedSwaps : [];
  const out = [];
  for (let index = 0; index < legs.length; index++) {
    if (isPlainObject(legs[index])) out.push({ index, leg: legs[index] });
  }
  return out;
}

/** A history list the server appends to (`gameplanMeetingHistory`): the stored array, else a fresh list. */
export function historyListOf(value) {
  return Array.isArray(value) ? value : [];
}

/** The plain-object entries of a list (the same array when every entry is one); anything that is not a list → none. */
function objectEntriesOf(value) {
  if (!Array.isArray(value)) return [];
  return value.every(isPlainObject) ? value : value.filter(isPlainObject);
}

/** The battle ledger (`battleLedger`): its plain-object entries; anything else → an empty ledger. */
export function battleLedgerOf(value) {
  return objectEntriesOf(value);
}

/** At most this many entries of a list-shaped `dailyGrades` are passed on (the stored shape is a map). */
export const GRADE_LIST_MAX = 50;
/** A string field of a list-shaped grade entry is passed on at most this long. */
export const GRADE_TEXT_MAX = 1000;

/**
 * A list-shaped grade entry with every string field capped and every object
 * field dropped (the voice layer renders the fields into text, and an object
 * whose toString is not a function makes that throw) — the same object when
 * nothing needs either.
 */
function cappedGradeEntry(entry) {
  const keys = Object.keys(entry);
  const over = keys.filter((k) => typeof entry[k] === 'string' && entry[k].length > GRADE_TEXT_MAX);
  const objects = keys.filter((k) => entry[k] !== null && typeof entry[k] === 'object');
  if (over.length === 0 && objects.length === 0) return entry;
  const out = { ...entry };
  for (const k of over) out[k] = entry[k].slice(0, GRADE_TEXT_MAX);
  for (const k of objects) delete out[k];
  return out;
}

/**
 * `dailyGrades` as the server passes it on. The stored shape is a map of date →
 * `{ trades: [...], submittedAt }` (agentService.submitDailyGrades); a map
 * comes back as it is. A list (the shape the voice layer's review context
 * renders — no live client writes one) keeps its last GRADE_LIST_MAX
 * plain-object entries, string fields capped. Anything else → `fallback`, the
 * caller's own default.
 */
export function dailyGradesOf(value, fallback) {
  if (isPlainObject(value)) return value;
  if (Array.isArray(value)) {
    const entries = objectEntriesOf(value);
    const kept = entries.length > GRADE_LIST_MAX ? entries.slice(-GRADE_LIST_MAX) : entries;
    const capped = kept.map(cappedGradeEntry);
    return capped.every((e, i) => e === kept[i]) ? kept : capped;
  }
  return fallback;
}

/** One day's grades: the map's OWN entry for `dateKey`, when it is a plain object; else absent. */
export function dailyGradeEntryOf(grades, dateKey) {
  if (!isPlainObject(grades) || typeof dateKey !== 'string' || !Object.hasOwn(grades, dateKey)) return undefined;
  const entry = grades[dateKey];
  return isPlainObject(entry) ? entry : undefined;
}

/** A day's graded trades: the plain-object entries of its `trades` list; anything else → none. */
export function gradedTradesOf(entry) {
  return isPlainObject(entry) ? objectEntriesOf(entry.trades) : [];
}
