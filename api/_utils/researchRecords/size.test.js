// api/_utils/researchRecords/size.test.js
//
// The Research Record Extension follow-up (V2 §3) — THE LARGEST SHARED
// RESEARCH RECORD THE CAPS ALLOW FITS, with room to spare. Firestore's
// document limit is 1,048,576 bytes; the rule here is at most 1,000,000, which
// leaves room for the session's budget and telemetry as they grow.
//
// The record is built through the model's own writers (buildRecord,
// buildFinding + findingAppendPatch, summaryRevisionPatch, closePatch), with:
//   · every cap full — 100 findings, SUMMARY_REVISIONS_MAX revisions, a
//     500-character question, 500-character facts, 120-character labels,
//     256-character record ids, SOURCE_URL_MAX_LEN-character urls, 1,000-
//     character summaries, 25 basedOn ids on every revision, a 100-symbol
//     cohort and 100 symbol keys, a 64-character status reason, the longest
//     identifiers the id schemes admit;
//   · 3-byte UTF-8 text wherever text is allowed (U+65E5), a 12-character
//     symbol on every finding, a time pin and (but for the first 25, which
//     the summaries rest on) a supersedes id on every finding.
// It is measured by Firestore's documented storage-size rules
// (https://firebase.google.com/docs/firestore/storage-size): a string is its
// UTF-8 bytes + 1; a number 8; a boolean or null 1; a map the sum of its
// field names (UTF-8 + 1) and values; an array the sum of its elements; the
// document name the sum of each collection and document id (UTF-8 + 1) + 16;
// the document + 32.

import { describe, it, expect } from 'vitest';
import {
  buildRecord, buildFinding, findingAppendPatch, summaryRevisionPatch, closePatch, applyTurn, emptyTelemetry, budgetOf,
  HOST_COLLECTIONS, FINDINGS_MAX, QUESTION_MAX_LEN, FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, RECORD_ID_MAX_LEN,
  SOURCE_URL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, SUMMARY_REVISIONS_MAX, BASED_ON_MAX, SYMBOLS_MAX, isSourceUrl,
} from './model.js';

const WIDE = '日'; // 日 — one UTF-16 unit, three UTF-8 bytes
const wide = (n) => WIDE.repeat(n);
const NOW = '2026-11-07T15:00:00.000Z';
const bytes = (s) => Buffer.byteLength(s, 'utf8');

/** Firestore's storage size of a field value. */
export function valueSize(v) {
  if (v === null || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return bytes(v) + 1;
  if (Array.isArray(v)) return v.reduce((s, x) => s + valueSize(x), 0);
  if (typeof v === 'object') return Object.entries(v).reduce((s, [k, x]) => s + bytes(k) + 1 + valueSize(x), 0);
  throw new Error(`no Firestore size for ${typeof v}`);
}
/** Firestore's storage size of a document at `path` holding `data`. */
export function documentSize(path, data) {
  const name = path.split('/').reduce((s, seg) => s + bytes(seg) + 1, 0) + 16;
  return name + valueSize(data) + 32;
}

const fid = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sym = (n) => `S${String(n).padStart(11, '0')}`; // 12 characters, key form

/** The largest Shared Research record the caps admit (see the header). */
function largestRecord() {
  const hostId = 'h'.repeat(128);
  const researchWorkId = `sr_${hostId}`;
  const userId = 'u'.repeat(128);
  const cohort = Array.from({ length: SYMBOLS_MAX }, (_, i) => ({ symbol: sym(1000 + i), outcome: 'data_missing', reason: 'saved_to_list', addedAtSave: true }));
  let r = buildRecord({
    researchWorkId, userId, origin: 'shared_research', host: { collection: HOST_COLLECTIONS.shared_research, id: hostId },
    createdAt: NOW, watchlistId: 'w'.repeat(200), hypothesisVersion: 999, question: wide(QUESTION_MAX_LEN),
    funnel: { stages: {}, symbols: cohort },
    budget: budgetOf({ messageBudget: 999, messagesUsed: 999 }),
    telemetry: applyTurn(emptyTelemetry(), { kind: 'completion', elapsedMs: 123456, usage: { input: 999999, output: 999999 }, atIso: NOW }),
  });
  const urlHead = 'https://e.x/';
  const url = urlHead + wide(SOURCE_URL_MAX_LEN - urlHead.length);
  expect(isSourceUrl(url)).toBe(true);
  for (let i = 1; i <= FINDINGS_MAX; i++) {
    const finding = buildFinding({
      kind: 'earnings_fact', symbol: sym(i), fact: wide(FINDING_FACT_MAX_LEN),
      source: { recordKind: 'fantasyTimesStories', recordId: wide(RECORD_ID_MAX_LEN), label: wide(SOURCE_LABEL_MAX_LEN), url },
      at: NOW, asOf: '2026-11-07T14:59:59.999Z', status: 'unavailable', statusReason: `r${'x'.repeat(63)}`,
      pin: { type: 'time', value: NOW },
      // The first BASED_ON_MAX stay current (the summaries rest on them); every later one corrects its predecessor.
      supersedes: i > BASED_ON_MAX + 1 ? fid(i - 1) : null,
    }, { findingId: fid(i), nowIso: NOW });
    r = { ...r, ...findingAppendPatch(r, finding, { nowIso: NOW }) };
  }
  const basedOn = Array.from({ length: BASED_ON_MAX }, (_, i) => fid(i + 1));
  for (let i = 1; i <= SUMMARY_REVISIONS_MAX; i++) r = { ...r, ...summaryRevisionPatch(r, { text: wide(SUMMARY_TEXT_MAX_LEN), basedOn }, { nowIso: NOW }) };
  r = { ...r, ...closePatch(r, { state: 'completed', terminalReason: 'saved_to_list', atIso: NOW, funnel: { stages: {}, symbols: cohort } }) };
  return r;
}

describe('the largest Shared Research record fits (follow-up §3)', () => {
  const record = largestRecord();
  const size = documentSize(`researchWork/${record.researchWorkId}`, record);
  it('every cap is full in the measured record', () => {
    expect(record.findings).toHaveLength(FINDINGS_MAX);
    expect(record.summaryRevisions).toHaveLength(SUMMARY_REVISIONS_MAX);
    expect(record.summaryRevisions.every((s) => s.basedOn.length === BASED_ON_MAX && s.text.length === SUMMARY_TEXT_MAX_LEN)).toBe(true);
    expect(record.symbols).toHaveLength(SYMBOLS_MAX);
    expect(record.symbolKeys).toHaveLength(SYMBOLS_MAX);
    expect(record.findings.every((f) => f.source.url.length === SOURCE_URL_MAX_LEN && f.fact.length === FINDING_FACT_MAX_LEN && f.symbol.length === 12)).toBe(true);
    expect(record.question).toHaveLength(QUESTION_MAX_LEN);
  });
  it('the size rules, checked on known values', () => {
    expect(valueSize('abc')).toBe(4);
    expect(valueSize(WIDE)).toBe(4);
    expect(valueSize({ a: 1, b: [true, null] })).toBe(2 + 8 + 2 + 2);
    expect(documentSize('c/d', {})).toBe(2 + 2 + 16 + 32);
  });
  it(`measures at most 1,000,000 bytes (Firestore's limit is 1,048,576)`, () => {
    console.log(`[size] the largest Shared Research record: ${size.toLocaleString('en-US')} bytes (SUMMARY_REVISIONS_MAX ${SUMMARY_REVISIONS_MAX}, SOURCE_URL_MAX_LEN ${SOURCE_URL_MAX_LEN})`);
    expect(size).toBeLessThanOrEqual(1_000_000);
  });
  it('the figure the contract note reports, pinned (any change to a cap or a shape moves it, and the note with it)', () => {
    expect(size).toBe(970_381);
  });
});
