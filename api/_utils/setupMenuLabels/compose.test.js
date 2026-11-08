// api/_utils/setupMenuLabels/compose.test.js
//
// Slice 2 — the block, pure (spec V2 §5; Corrections C and D): the three distinct absences, honest
// history, capture-time comparison, the byte cap, the error form, and — the property the writer relies
// on — every composed fixture block passes the REAL sanitizer with nothing rejected and no free text.

import { describe, it, expect, beforeAll } from 'vitest';
import { composeSetupMenuBlock, errorBlockOf, approxBytes, snapshotServes } from './compose.js';
import { candidatesOf } from './pool.js';
import { menuSnapshotSet, snapshotFor } from './__fixtures__/menuSnapshots.js';
import { sanitizePermanentDocument, findFreeText, buildUniverse } from '../tickCapture/captureSerializer.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { SETUP_MENU_MAX_BYTES } from './constants.js';
import { admitOptionalSetupMenu } from '../tickCapture/captureWriter.js';

const SESSION = '2026-09-08';
const FETCHED = '2026-09-09T13:00:00.000Z';
const FROZEN_MS = Date.parse('2026-09-09T15:00:00.000Z');
const ruleSet = describeRuleSet();

let fx;
beforeAll(async () => { fx = await menuSnapshotSet({ session: SESSION, fetchedAt: FETCHED }); });

function poolOf(hot, { classify = () => null, keys = [], bench = [], held = [], calendarMissing = false } = {}) {
  return {
    session: calendarMissing ? null : SESSION, calendarMissing, ruleSet, selector: 'carried', rebuilt: false, frozenAtMs: FROZEN_MS,
    list: candidatesOf({ hotBenchSymbols: hot, assetMapKeys: keys, benchAtFreeze: bench, heldAtFreeze: held, classify }),
  };
}
const ok = (value) => ({ ok: true, value });
const obsOf = (results, { stateRead = false, state = new Map() } = {}) => ({
  readsStartedAtMs: FROZEN_MS + 10, observedAtMs: FROZEN_MS + 2_000, stateRead, stateBySymbol: state, results: new Map(Object.entries(results)), readsIssued: 3, readsShared: 1,
});
const cand = (block, symbol) => block.candidates.find((c) => c.symbol === symbol);
/** The writer's admission in miniature: the block through the real sanitizer, in its own pass, with the tick's universe. */
const sanitized = (block, symbols) => sanitizePermanentDocument({ setupMenu: block }, { universe: buildUniverse({ candidateSymbols: symbols }) });

describe('the three stored facts stay distinct (row 3.1)', () => {
  it('missing snapshot → absent; refused final snapshot → refused, unknown, the refusal reason; ok snapshot with an evaluator unknown → labelled, unknown, its reason', () => {
    const b = composeSetupMenuBlock(poolOf(['NFLX', 'IBM', 'ORCL']), obsOf({ NFLX: ok(null), IBM: ok(fx.IBM.snapshot), ORCL: ok(fx.ORCL.snapshot) }));
    expect(cand(b, 'NFLX')).toMatchObject({ status: 'absent', verdict: null, reason: null, snapshotStatus: null });
    expect(cand(b, 'IBM')).toMatchObject({ status: 'refused', verdict: 'unknown', reason: 'insufficient_history', snapshotStatus: 'refused' });
    expect(cand(b, 'ORCL')).toMatchObject({ status: 'labelled', verdict: 'unknown', reason: 'missing_fact', snapshotStatus: 'ok' });
  });
  it('real labels carry the entry\'s verdict, reason, pattern and regime, the snapshot\'s asOf and bars class', () => {
    const b = composeSetupMenuBlock(poolOf(['AAPL', 'MSFT', 'AMZN']), obsOf({ AAPL: ok(fx.AAPL.snapshot), MSFT: ok(fx.MSFT.snapshot), AMZN: ok(fx.AMZN.snapshot) }));
    expect(cand(b, 'AAPL')).toMatchObject({ status: 'labelled', verdict: 'valid', reason: null, pattern: 'breakout', regime: 'uptrend', asOf: SESSION, barsClass: 'contemporaneous' });
    expect(cand(b, 'MSFT')).toMatchObject({ verdict: 'invalid', reason: 'regime', regime: 'downtrend' });
    expect(cand(b, 'AMZN')).toMatchObject({ verdict: 'invalid', reason: 'no_setup' });
  });
});

describe('capture time is not commit time (Correction D.1)', () => {
  it('provider response BEFORE the freeze, snapshot committed after it and read afterwards → capturedBeforeFreeze true; nothing on the block claims availability', async () => {
    // The response arrived at 13:00, the freeze was at 15:00; the store's commit and this read came later.
    // capturedAt is the response instant (snapshotDocOf sets it to fetchedAt), so the comparison says
    // only that: the provider's capture predates the freeze.
    const b = composeSetupMenuBlock(poolOf(['AAPL']), obsOf({ AAPL: ok(fx.AAPL.snapshot) }));
    expect(fx.AAPL.snapshot.capturedAt).toBe(FETCHED);
    expect(cand(b, 'AAPL')).toMatchObject({ capturedAt: FETCHED, capturedBeforeFreeze: true });
    expect(Object.keys(cand(b, 'AAPL')).filter((k) => /avail|commit|predates/i.test(k))).toEqual([]);
  });
  it('a response received after the freeze → false', async () => {
    const late = await snapshotFor({ session: SESSION, symbol: 'AAPL', fetchedAt: '2026-09-09T15:00:00.001Z' });
    expect(cand(composeSetupMenuBlock(poolOf(['AAPL']), obsOf({ AAPL: ok(late.snapshot) })), 'AAPL').capturedBeforeFreeze).toBe(false);
  });
});

describe('Slice 2\'s own history: zero, missing and unreadable stay distinct (rows 3.2–3.4; Correction D.3)', () => {
  it('state not read in time → stateRead false and every s2 field null; no candidate claims exhaustion', () => {
    const b = composeSetupMenuBlock(poolOf(['NFLX']), obsOf({ NFLX: ok(null) }, { stateRead: false }));
    expect(b.stateRead).toBe(false);
    expect(cand(b, 'NFLX')).toMatchObject({ s2Entry: null, s2Reservations: null, s2LastOutcome: null, s2LastAt: null, s2Exhausted: null });
  });
  it('state read, no entry → s2Entry false; an entry refunded to zero → s2Entry true, s2Reservations 0', () => {
    const state = new Map([['NFLX', null], ['CRM', { session: SESSION, n: 0, lastOutcome: 'pending', lastAt: FROZEN_MS - 3_600_000 }]]);
    const b = composeSetupMenuBlock(poolOf(['NFLX', 'CRM']), obsOf({ NFLX: ok(null), CRM: ok(null) }, { stateRead: true, state }));
    expect(cand(b, 'NFLX')).toMatchObject({ s2Entry: false, s2Reservations: null, s2Exhausted: null });
    expect(cand(b, 'CRM')).toMatchObject({ s2Entry: true, s2Reservations: 0, s2Exhausted: false });
  });
  it('a `pending` outcome an hour old is reported as a past outcome with its instant — no field says live', () => {
    const at = FROZEN_MS - 3_600_000;
    const state = new Map([['CRM', { session: SESSION, n: 1, lastOutcome: 'pending', lastAt: at }]]);
    const c = cand(composeSetupMenuBlock(poolOf(['CRM']), obsOf({ CRM: ok(null) }, { stateRead: true, state })), 'CRM');
    expect(c).toMatchObject({ s2LastOutcome: 'pending', s2LastAt: new Date(at).toISOString() });
    expect(Object.keys(c).filter((k) => /live|lease|attempt/i.test(k))).toEqual([]);
  });
  it('a malformed entry in a readable state is unreadable for that key: s2Entry null, never zero (review SM1-1)', () => {
    const state = new Map([['CRM', { malformed: true, raw: { n: '3' } }]]);
    expect(cand(composeSetupMenuBlock(poolOf(['CRM']), obsOf({ CRM: ok(null) }, { stateRead: true, state })), 'CRM')).toMatchObject({ s2Entry: null, s2Reservations: null, s2Exhausted: null });
  });
  it('s2Exhausted only from the reservation count, in this session', () => {
    const mk = (n, session = SESSION) => composeSetupMenuBlock(poolOf(['CRM']), obsOf({ CRM: ok(null) }, { stateRead: true, state: new Map([['CRM', { session, n }]]) })).candidates[0].s2Exhausted;
    expect([mk(2), mk(3), mk(4), mk(3, '2026-09-04')]).toEqual([false, true, true, false]);
  });
});

describe('the other statuses (rows 5.4, 1.5)', () => {
  it('another triple, a wrong schema version, a wrong key → stale_snapshot; a rejected read → read_failed; no result yet → read_unsettled', () => {
    const b = composeSetupMenuBlock(poolOf(['TSLA', 'META', 'AAPL', 'NFLX', 'CRM']), obsOf({
      TSLA: ok(fx.TSLA.snapshot), META: ok(fx.META.snapshot), AAPL: ok(fx.AMZN.snapshot), NFLX: { ok: false },
    }));
    expect(b.candidates.map((c) => c.status)).toEqual(['stale_snapshot', 'stale_snapshot', 'stale_snapshot', 'read_failed', 'read_unsettled']);
    expect(b.blockStatus).toBe('reads_unsettled');
    expect(b.counts).toEqual({ labelled: 0, refused: 0, absent: 0, excluded: 0, symbolForm: 0, stale: 3, failed: 1, unsettled: 1 });
  });
  it('a reason that is not an id becomes `other`; a malformed asOf is null', () => {
    const odd = { ...fx.AMZN.snapshot, entry: { ...fx.AMZN.snapshot.entry, reason: 'has a space' }, asOf: 'yesterday' };
    expect(cand(composeSetupMenuBlock(poolOf(['AMZN']), obsOf({ AMZN: ok(odd) })), 'AMZN')).toMatchObject({ reason: 'other', asOf: null });
  });
  it('the composed block is deep-frozen: nothing can patch it after composition', () => {
    const b = composeSetupMenuBlock(poolOf(['AAPL']), obsOf({ AAPL: ok(fx.AAPL.snapshot) }));
    expect(Object.isFrozen(b) && Object.isFrozen(b.candidates) && Object.isFrozen(b.candidates[0]) && Object.isFrozen(b.counts)).toBe(true);
  });
  it('the pool fact (no observation yet) is reads_unsettled, with no read instants and stateRead false', () => {
    const b = composeSetupMenuBlock(poolOf(['AAPL', 'MSFT']), null);
    expect(b).toMatchObject({ blockStatus: 'reads_unsettled', readsStartedAt: null, observedAt: null, stateRead: false, readsIssued: 0 });
  });
  it('calendar missing outranks everything but an error', () => {
    expect(composeSetupMenuBlock(poolOf(['AAPL'], { calendarMissing: true }), null)).toMatchObject({ blockStatus: 'calendar_missing', session: null });
  });
});

describe('the byte cap (row 5.7)', () => {
  it('a block over the cap is truncated from the tail, counted, `truncated`, and measures under the cap', () => {
    const hot = Array.from({ length: 48 }, (_, i) => `S${i}`);
    const results = Object.fromEntries(hot.map((s) => [s, ok(null)]));
    const full = composeSetupMenuBlock(poolOf(hot), obsOf(results));
    expect(full.blockStatus).toBe('ok');
    const capped = composeSetupMenuBlock(poolOf(hot), obsOf(results), { maxBytes: Math.floor(approxBytes(full) / 2) });
    expect(capped.blockStatus).toBe('truncated');
    expect(capped.truncatedCount + capped.candidates.length).toBe(48);
    expect(capped.candidates.map((c) => c.symbol)).toEqual(hot.slice(0, capped.candidates.length));
    expect(approxBytes(capped)).toBeLessThanOrEqual(Math.floor(approxBytes(full) / 2));
  });
  it('48 fully-labelled candidates fit the real 24 KiB cap', () => {
    const hot = Array.from({ length: 48 }, (_, i) => `SYM${i}`);
    const state = new Map(hot.map((s) => [s, { session: SESSION, n: 3, lastOutcome: 'retryable', lastAt: FROZEN_MS }]));
    const wide = { ...fx.AAPL.snapshot };
    const results = Object.fromEntries(hot.map((s) => [s, ok({ ...wide, key: { ...wide.key, symbol: s } })]));
    const b = composeSetupMenuBlock(poolOf(hot), obsOf(results, { stateRead: true, state }));
    expect(b.blockStatus).toBe('ok');
    expect(approxBytes(b)).toBeLessThanOrEqual(SETUP_MENU_MAX_BYTES);
  });
});

describe('the error form (Correction C)', () => {
  it('a composer failure yields the error form with the identity fields, and nothing else', () => {
    const pool = poolOf(['AAPL']);
    const broken = { ...pool, list: { get candidates() { throw new Error('boom'); } } };
    const b = composeSetupMenuBlock(broken, null);
    expect(b).toEqual({ blockStatus: 'error', errorCode: 'compose_failed', session: SESSION, setupVersion: ruleSet.setupVersion, thresholdsHash: ruleSet.thresholdsHash, semanticsId: ruleSet.semanticsId, frozenAt: new Date(FROZEN_MS).toISOString() });
  });
  it('the error form of a pool with nothing readable is still a valid block', () => {
    expect(errorBlockOf(null, 'freeze_failed')).toEqual({ blockStatus: 'error', errorCode: 'freeze_failed', session: null, setupVersion: null, thresholdsHash: null, semanticsId: null, frozenAt: null });
  });
});

describe('nothing rejected (rows 5.3, 5.6): every fixture block through the REAL sanitizer', () => {
  it('every status, a dotted symbol as a value, the error form — rejected = [] and no free text', () => {
    const classify = (s) => (s === 'BRK.B' ? 'symbol_form' : s === 'BTC-USD' ? 'excluded' : null);
    const hot = ['AAPL', 'MSFT', 'AMZN', 'IBM', 'ORCL', 'TSLA', 'META', 'NFLX', 'CRM', 'PLTR', 'BRK.B', 'BRK-B', 'BTC-USD', 'RDS-A'];
    const state = new Map([['AAPL', { session: SESSION, n: 1, lastOutcome: 'final', lastAt: FROZEN_MS }], ['NFLX', null]]);
    const blocks = [
      composeSetupMenuBlock(poolOf(hot, { classify, keys: ['ZM'], bench: ['AAPL'], held: ['MSFT'] }), obsOf({
        AAPL: ok(fx.AAPL.snapshot), MSFT: ok(fx.MSFT.snapshot), AMZN: ok(fx.AMZN.snapshot), IBM: ok(fx.IBM.snapshot), ORCL: ok(fx.ORCL.snapshot),
        TSLA: ok(fx.TSLA.snapshot), META: ok(fx.META.snapshot), NFLX: ok(null), CRM: { ok: false }, 'BRK-B': ok(null),
      }, { stateRead: true, state })),
      composeSetupMenuBlock(poolOf(hot, { classify }), null),
      composeSetupMenuBlock(poolOf(hot, { classify, calendarMissing: true }), null),
      errorBlockOf(poolOf(hot), 'compose_failed'),
      errorBlockOf(null, 'freeze_failed'),
    ];
    const symbols = [...hot, 'ZM'];
    for (const block of blocks) {
      const { doc, rejected } = sanitized(block, symbols);
      expect(rejected).toEqual([]);
      expect(doc.setupMenu).toEqual(block);
      expect(findFreeText(doc, { universe: buildUniverse({ candidateSymbols: symbols }) })).toEqual([]);
    }
    expect(cand(blocks[0], 'BRK.B')).toMatchObject({ status: 'symbol_form' });
  });
  it('snapshotServes refuses anything but the key and the known schema', () => {
    expect(snapshotServes(fx.AAPL.snapshot, { session: SESSION, symbol: 'AAPL', ruleSet })).toBe(true);
    expect(snapshotServes(fx.AAPL.snapshot, { session: '2026-09-04', symbol: 'AAPL', ruleSet })).toBe(false);
    expect(snapshotServes({ ...fx.AAPL.snapshot, capturedAt: 'later' }, { session: SESSION, symbol: 'AAPL', ruleSet })).toBe(false);
    expect(snapshotServes({ ...fx.AAPL.snapshot, entry: null }, { session: SESSION, symbol: 'AAPL', ruleSet })).toBe(false);
  });
});

// ---------------------------------------------------------------- correction round F4 (Astra's review of 4e99b1f8)
// The cap is measured on the FINAL block: counts, status and truncation counter recomputed after every removal, so
// the bytes measured are the bytes emitted (UTF-8 of the JSON). The first row is Astra's supplied regression file
// (evidence/block-cap.regression.test.js, SHA-256 82e1c2b7…), adapted: 48 candidates with closed-enum fields and
// 56-character reason ids (58 for the first) — a robustness case, not a claim that today's evaluator emits these
// reasons. Before the fix it was measured with zeroed counts and emitted at 24,577 bytes.
describe('F4 — every emitted block fits the cap, measured on its final bytes', () => {
  const symbols = Array.from({ length: 48 }, (_, i) => `S${i}`);
  const capPool = () => ({
    session: SESSION, ruleSet, frozenAtMs: FROZEN_MS, calendarMissing: false, selector: 'carried', rebuilt: false,
    list: candidatesOf({ hotBenchSymbols: symbols, assetMapKeys: [], benchAtFreeze: symbols, heldAtFreeze: [] }),
  });
  /** 48 labelled candidates whose reason ids are `reasonLength` long (the first `firstDelta` longer); `unsettledFrom` leaves the tail unread. */
  function capBlock(reasonLength, { firstDelta = 0, unsettledFrom = symbols.length, unsettled = (i) => i >= unsettledFrom, maxBytes } = {}) {
    const results = new Map(symbols.flatMap((symbol, i) => (unsettled(i) ? [] : [[symbol, { ok: true, value: {
      schemaVersion: 1, key: { session: SESSION, symbol, ruleSet }, status: 'ok', capturedAt: FETCHED, asOf: SESSION,
      entry: { verdict: 'invalid', pattern: 'pullback_resume', regime: 'uptrend', reason: 'r'.repeat(reasonLength + (i === 0 ? firstDelta : 0)) },
      evidenceClass: { bars: 'later_reconstruction' },
    } }]])));
    const stateBySymbol = new Map(symbols.map((s) => [s, { session: SESSION, n: 3, lastOutcome: 'retryable', lastAt: FROZEN_MS }]));
    const obs = { readsStartedAtMs: FROZEN_MS, observedAtMs: FROZEN_MS + 100, stateRead: true, stateBySymbol, results, readsIssued: 48, readsShared: 0 };
    return composeSetupMenuBlock(capPool(), obs, maxBytes === undefined ? undefined : { maxBytes });
  }
  const countsSum = (b) => Object.values(b.counts).reduce((a, n) => a + n, 0);

  it('F4 (Astra) the 48-candidate case that emitted 24,577 bytes now emits at most 24,576, through the writer too', () => {
    const block = capBlock(56, { firstDelta: 2 });
    expect(approxBytes(block)).toBeLessThanOrEqual(SETUP_MENU_MAX_BYTES);
    expect(block).toMatchObject({ blockStatus: 'truncated', truncatedCount: 1 });
    expect(block.candidates).toHaveLength(47);
    expect(countsSum(block)).toBe(47); // the counts describe the candidates emitted
    expect(sanitized(block, symbols).rejected).toEqual([]);
    const permanent = {};
    expect(admitOptionalSetupMenu(permanent, block, { universe: new Set(symbols) })).toBe('admitted');
    expect(approxBytes(permanent.setupMenu)).toBe(approxBytes(block));
    expect(approxBytes(permanent.setupMenu)).toBeLessThanOrEqual(SETUP_MENU_MAX_BYTES);
  });
  it('boundary control: a final block of exactly 24,576 bytes keeps all 48 candidates, untruncated', () => {
    const block = capBlock(56, { firstDelta: 1 });
    expect(approxBytes(block)).toBe(SETUP_MENU_MAX_BYTES);
    expect(block).toMatchObject({ blockStatus: 'ok', truncatedCount: 0 });
    expect(block.candidates).toHaveLength(48);
    expect(countsSum(block)).toBe(48);
  });
  it('control: a short reason stays within the cap untruncated (Astra\'s negative control)', () => {
    const block = capBlock(10);
    expect(approxBytes(block)).toBeLessThan(SETUP_MENU_MAX_BYTES);
    expect(block.truncatedCount).toBe(0);
  });
  it('near the cap with unsettled reads KEPT: `truncated` outranks `reads_unsettled`, and the counts cover only the candidates kept (review SC2-3)', () => {
    // The unsettled candidates are the HEAD of the list, so truncation (from the tail) keeps them.
    const block = capBlock(100, { unsettled: (i) => i < 4 });
    expect(approxBytes(block)).toBeLessThanOrEqual(SETUP_MENU_MAX_BYTES);
    expect(block.truncatedCount).toBeGreaterThan(0);
    expect(block.counts.unsettled).toBe(4);
    expect(block.blockStatus).toBe('truncated');
    expect(block.candidates.filter((c) => c.status === 'read_unsettled')).toHaveLength(4);
    expect(countsSum(block)).toBe(block.candidates.length);
    expect(block.candidates.length + block.truncatedCount).toBe(48);
  });
  it('truncated to NO candidates and still fitting: counts and status are recomputed for the empty list (mutant SCX-15)', () => {
    // The smallest cap at which the result is a block rather than the error form or null: the candidate-free block.
    const isBlock = (b) => b !== null && b.blockStatus !== 'error';
    let lo = 0; let hi = 4_000;
    expect(isBlock(capBlock(10, { maxBytes: hi }))).toBe(true);
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (isBlock(capBlock(10, { maxBytes: mid }))) hi = mid; else lo = mid; }
    const empty = capBlock(10, { maxBytes: hi });
    expect(empty.candidates).toEqual([]);
    expect(empty).toMatchObject({ blockStatus: 'truncated', truncatedCount: 48 });
    expect(countsSum(empty)).toBe(0);
    expect(approxBytes(empty)).toBe(hi); // measured on the final bytes: exactly at its cap
    expect(capBlock(10, { maxBytes: hi - 1 })).toMatchObject({ blockStatus: 'error', errorCode: 'compose_failed' });
  });
  it('the catch path is bounded too: a composer that throws gives the error form when it fits, else null (review SC2-6)', () => {
    const broken = { ...capPool(), list: null }; // reading the list throws inside the composer
    const errorSize = approxBytes(errorBlockOf(capPool(), 'compose_failed'));
    expect(composeSetupMenuBlock(broken, null, { maxBytes: errorSize })).toMatchObject({ blockStatus: 'error', errorCode: 'compose_failed', session: SESSION });
    expect(composeSetupMenuBlock(broken, null, { maxBytes: errorSize - 1 })).toBeNull();
    expect(composeSetupMenuBlock(broken, null)).toMatchObject({ blockStatus: 'error' }); // the production cap
  });
  it('a sweep: for every reason length 0–120 the emitted block fits, and its counters agree with what it holds', () => {
    for (let len = 0; len <= 120; len += 1) {
      const block = capBlock(len, { firstDelta: len % 3 });
      expect(approxBytes(block)).toBeLessThanOrEqual(SETUP_MENU_MAX_BYTES);
      expect(countsSum(block)).toBe(block.candidates.length);
      expect(block.candidates.length + block.truncatedCount).toBe(48);
      expect(block.blockStatus).toBe(block.truncatedCount > 0 ? 'truncated' : 'ok');
    }
  });
  it('even the candidate-free block over the cap: the error form when it fits, else no block (null)', () => {
    const empty = capBlock(10, { maxBytes: 0 });
    expect(empty).toBeNull(); // nothing fits a zero cap: omitted
    const errorSize = approxBytes(errorBlockOf(capPool(), 'compose_failed'));
    const errorOnly = capBlock(10, { maxBytes: errorSize });
    expect(errorOnly).toMatchObject({ blockStatus: 'error', errorCode: 'compose_failed', session: SESSION });
    expect(approxBytes(errorOnly)).toBeLessThanOrEqual(errorSize);
    expect(capBlock(10, { maxBytes: errorSize - 1 })).toBeNull();
  });
});
