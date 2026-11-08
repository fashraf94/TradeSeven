// api/_utils/researchRecords/size.test.js
//
// The Research Record Extension follow-up (V2 §3) — THE LARGEST SHARED
// RESEARCH RECORD THE CAPS ALLOW FITS, with room to spare. Firestore's
// document limit is 1,048,576 bytes; the rule here is at most 1,000,000, which
// leaves room for the session's budget and telemetry as they grow.
//
// The record is built through the model's own writers (buildRecord,
// buildFinding + findingAppendPatch, summaryRevisionPatch, turnPatch with
// screens, closePatch), with every cap full (review V2A-1 widened the first
// version of this test, which left caps unfilled):
//   · 100 findings — 25 current (the summaries rest on them), then 75
//     corrections each superseding the last; each with a 12-character symbol,
//     a 500-character fact, a 256-character record id, a 120-character label,
//     a SOURCE_URL_MAX_LEN-character url of the most bytes isSourceUrl admits,
//     a time pin and a 64-character status reason;
//   · SUMMARY_REVISIONS_MAX revisions of 1,000 characters, 25 basedOn ids each;
//   · a 500-character question; a 100-symbol cohort, each entry with both
//     flags (offUniverse, addedAtSave); 100 symbol keys;
//   · SCREENS_MAX telemetry screens of SCREEN_SYMBOLS_MAX 12-character symbols
//     (a turn on a Shared Research record may carry screens);
//   · 3-byte UTF-8 text wherever text is allowed (U+65E5), a 128-character
//     3-byte uid (Firebase's uid limit); ids at their schemes' maxima — the
//     host id 128 (HOST_ID_RE), the watchlist id 200 ASCII (FORGE_ID_MAX_LEN,
//     every route validates it); the longest terminal reason the hosts write.
//     `watchlistId`, `userId` and `terminalReason` are bounded by their
//     writers, not by this model.
// It is measured by Firestore's documented storage-size rules
// (https://firebase.google.com/docs/firestore/storage-size), read literally: a
// string is its UTF-8 bytes + 1; a number 8; a boolean or null 1; an array the
// sum of its elements; a map "calculated the same way as document size" —
// its field names (UTF-8 + 1) and values PLUS 32 bytes (the cautious reading,
// review V2A-1); the document name the sum of each collection and document id
// (UTF-8 + 1) + 16; the document its name, its fields and 32.

import { describe, it, expect } from 'vitest';
import {
  buildRecord, buildFinding, findingAppendPatch, summaryRevisionPatch, closePatch, turnPatch, screenEntryOf, applyTurn, emptyTelemetry, budgetOf,
  HOST_COLLECTIONS, FINDINGS_MAX, QUESTION_MAX_LEN, FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, RECORD_ID_MAX_LEN,
  SOURCE_URL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, SUMMARY_REVISIONS_MAX, BASED_ON_MAX, SYMBOLS_MAX, SCREENS_MAX, SCREEN_SYMBOLS_MAX,
  isSourceUrl, TERMINAL_REASONS,
} from './model.js';

const WIDE = '日'; // 日 — one UTF-16 unit, three UTF-8 bytes
const wide = (n) => WIDE.repeat(n);
const NOW = '2026-11-07T15:00:00.000Z';
const bytes = (s) => Buffer.byteLength(s, 'utf8');

/** The fields of a document or a map: each name (UTF-8 + 1) and its value. */
export function fieldsSize(obj) {
  return Object.entries(obj).reduce((s, [k, x]) => s + bytes(k) + 1 + valueSize(x), 0);
}
/** Firestore's storage size of a field value (a map: its fields + 32, "calculated the same way as document size"). */
export function valueSize(v) {
  if (v === null || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return bytes(v) + 1;
  if (Array.isArray(v)) return v.reduce((s, x) => s + valueSize(x), 0);
  if (typeof v === 'object') return fieldsSize(v) + 32;
  throw new Error(`no Firestore size for ${typeof v}`);
}
/** Firestore's storage size of a document at `path` holding `data`. */
export function documentSize(path, data) {
  const name = path.split('/').reduce((s, seg) => s + bytes(seg) + 1, 0) + 16;
  return name + fieldsSize(data) + 32;
}

const fid = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sym = (n) => `S${String(n).padStart(11, '0')}`; // 12 characters, key form
/** The longest url (in characters AND bytes) isSourceUrl admits at the cap. */
function largestUrl() {
  for (const head of ['http:', 'https:', 'http://', 'https://e.x/']) {
    const url = head + wide(SOURCE_URL_MAX_LEN - head.length);
    if (isSourceUrl(url)) return url;
  }
  throw new Error('no url at the cap');
}
/** The longest terminal reason any host writes. */
const LONGEST_REASON = [...Object.values(TERMINAL_REASONS), 'user_close', 'finalize_intent'].sort((a, b) => b.length - a.length)[0];

/** The largest Shared Research record the caps admit (see the header). */
function largestRecord() {
  const hostId = 'h'.repeat(128);
  const researchWorkId = `sr_${hostId}`;
  const userId = wide(128);
  const cohort = Array.from({ length: SYMBOLS_MAX }, (_, i) => ({ symbol: sym(1000 + i), outcome: 'data_missing', reason: 'saved_to_list', offUniverse: true, addedAtSave: true }));
  let r = buildRecord({
    researchWorkId, userId, origin: 'shared_research', host: { collection: HOST_COLLECTIONS.shared_research, id: hostId },
    createdAt: NOW, watchlistId: 'w'.repeat(200), hypothesisVersion: 999, question: wide(QUESTION_MAX_LEN),
    funnel: { stages: {}, symbols: cohort },
    budget: budgetOf({ messageBudget: 999, messagesUsed: 999 }),
    telemetry: applyTurn(emptyTelemetry({ screens: true }), { kind: 'completion', elapsedMs: 123456, usage: { input: 999999, output: 999999 }, atIso: NOW }),
  });
  // SCREENS_MAX screens of SCREEN_SYMBOLS_MAX symbols, carried by turns.
  for (let s = 0; s < SCREENS_MAX; s++) {
    const screen = screenEntryOf({ atIso: NOW, resultType: 'stocks', universeSize: 999999, matchCount: 999999, results: Array.from({ length: SCREEN_SYMBOLS_MAX }, (_, i) => ({ symbol: sym(5000 + i) })) });
    r = { ...r, ...turnPatch(r, { kind: 'completion', elapsedMs: 1, usage: { input: 1, output: 1 }, atIso: NOW, screen }) };
  }
  const url = largestUrl();
  const add = (i, supersedes) => {
    const finding = buildFinding({
      kind: 'earnings_fact', symbol: sym(i), fact: wide(FINDING_FACT_MAX_LEN),
      source: { recordKind: 'fantasyTimesStories', recordId: wide(RECORD_ID_MAX_LEN), label: wide(SOURCE_LABEL_MAX_LEN), url },
      at: NOW, asOf: '2026-11-07T14:59:59.999Z', status: 'unavailable', statusReason: `r${'x'.repeat(63)}`,
      pin: { type: 'time', value: NOW }, supersedes,
    }, { findingId: fid(i), nowIso: NOW });
    r = { ...r, ...findingAppendPatch(r, finding, { nowIso: NOW }) };
  };
  // The 25 findings the summaries rest on, the revisions, then 75 corrections (each superseding the last).
  for (let i = 1; i <= BASED_ON_MAX; i++) add(i, null);
  const basedOn = Array.from({ length: BASED_ON_MAX }, (_, i) => fid(i + 1));
  for (let i = 1; i <= SUMMARY_REVISIONS_MAX; i++) r = { ...r, ...summaryRevisionPatch(r, { text: wide(SUMMARY_TEXT_MAX_LEN), basedOn }, { nowIso: NOW }) };
  for (let i = BASED_ON_MAX + 1; i <= FINDINGS_MAX; i++) add(i, fid(i - 1));
  r = { ...r, ...closePatch(r, { state: 'completed', terminalReason: LONGEST_REASON, atIso: NOW, funnel: { stages: {}, symbols: cohort } }) };
  return r;
}

describe('the largest Shared Research record fits (follow-up §3)', () => {
  const record = largestRecord();
  const size = documentSize(`researchWork/${record.researchWorkId}`, record);
  it('every cap is full in the measured record', () => {
    expect(record.findings).toHaveLength(FINDINGS_MAX);
    expect(record.findings.filter((f) => f.supersedes !== null)).toHaveLength(FINDINGS_MAX - BASED_ON_MAX);
    expect(record.summaryRevisions).toHaveLength(SUMMARY_REVISIONS_MAX);
    expect(record.summaryRevisions.every((s) => s.basedOn.length === BASED_ON_MAX && s.text.length === SUMMARY_TEXT_MAX_LEN)).toBe(true);
    expect(record.symbols).toHaveLength(SYMBOLS_MAX);
    expect(record.symbolKeys).toHaveLength(SYMBOLS_MAX);
    expect(record.telemetry.screens).toHaveLength(SCREENS_MAX);
    expect(record.telemetry.screens.every((s) => s.symbols.length === SCREEN_SYMBOLS_MAX)).toBe(true);
    expect(record.findings.every((f) => f.source.url.length === SOURCE_URL_MAX_LEN && f.fact.length === FINDING_FACT_MAX_LEN && f.symbol.length === 12)).toBe(true);
    expect(record.question).toHaveLength(QUESTION_MAX_LEN);
    expect(record.terminalReason).toBe(LONGEST_REASON);
  });
  it('the size rules, checked on known values', () => {
    expect(valueSize('abc')).toBe(4);
    expect(valueSize(WIDE)).toBe(4);
    expect(valueSize({ a: 1, b: [true, null] })).toBe(2 + 8 + 2 + 2 + 32); // a map counts its own 32
    expect(documentSize('c/d', {})).toBe(2 + 2 + 16 + 32);
    expect(documentSize('c/d', { m: {} })).toBe(2 + 2 + 16 + 2 + 32 + 32);
  });
  it('measures at most 1,000,000 bytes (Firestore\'s limit is 1,048,576)', () => {
    console.log(`[size] the largest Shared Research record: ${size.toLocaleString('en-US')} bytes (SUMMARY_REVISIONS_MAX ${SUMMARY_REVISIONS_MAX}, SOURCE_URL_MAX_LEN ${SOURCE_URL_MAX_LEN})`);
    expect(size).toBeLessThanOrEqual(1_000_000);
  });
  it('the figure the contract note reports, pinned (any change to a cap or a shape moves it, and the note with it)', () => {
    // Measured: 1,010,671 at 20 revisions / 2,048-character urls (the first test's narrower record);
    // 1,013,417 at 10 revisions with every cap full and maps counted cautiously (review V2A-1);
    // after the second named cut (urls to 1,024): this.
    expect(size).toBe(706_217);
  });
});
