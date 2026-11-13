// api/_utils/mandateRationale.test.js
//
// T0b — the manager's written reason on the decision record: the text bound
// (present / truncated / absent, grapheme-boundary cuts), conviction as a
// clamped diagnostic, attribution to the pinned seat, the builder's
// bound-by-construction, and the decision document's size bound against
// Firestore's 1 MiB limit. Path-level cases (direct and batch) live with
// their transports: mandate-evaluate.test.js and mandateBatchTransport.test.js.

import { describe, it, expect } from 'vitest';
import {
  boundRationale,
  convictionDiagnosticOf,
  generationConfigVersionOf,
  responseAttribution,
  rationaleRecordInputs,
  capStoredString,
  DECISION_RATIONALE_FIELDS,
  RATIONALE_STATUSES,
  RATIONALE_AT_BASES,
} from './mandateRationale.js';
import { buildDecision } from './mandateSchema.js';
import { disposeSubmission } from './mandateExecution.js';
import {
  MANDATE_RATIONALE_MAX_CHARS,
  MANDATE_DECISION_TICKER_MAX_CHARS,
  MANDATE_DECISION_FAIL_CONDITION_MAX_CHARS,
} from './mandateConfig.js';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';

const SEAT = { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } };
const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].map((g) => g.segment);

describe('boundRationale — present / absent / truncated', () => {
  it('the bound is the named constant, 1,200', () => {
    expect(MANDATE_RATIONALE_MAX_CHARS).toBe(1200);
    expect([...RATIONALE_STATUSES]).toEqual(['present', 'truncated', 'absent']);
  });

  it('a one-sentence reason is stored whole (the 2–5 sentence instruction is not a validator)', () => {
    expect(boundRationale('Cutting the loser.')).toEqual({ rationale: 'Cutting the loser.', rationaleStatus: 'present' });
  });

  it('outer whitespace is dropped; inner text is kept verbatim', () => {
    expect(boundRationale('  Line one.\n\nLine two.  \n')).toEqual({ rationale: 'Line one.\n\nLine two.', rationaleStatus: 'present' });
  });

  it.each([
    ['null', null], ['undefined', undefined], ['empty string', ''], ['whitespace only', ' \n\t  '],
    ['a number', 42], ['an object', { text: 'x' }], ['an array', ['x']],
  ])('%s is absent — null, never an empty string standing in for text', (_label, raw) => {
    expect(boundRationale(raw)).toEqual({ rationale: null, rationaleStatus: 'absent' });
  });

  it('exactly the bound is present; one unit over is truncated to the bound', () => {
    const exact = 'a'.repeat(MANDATE_RATIONALE_MAX_CHARS);
    expect(boundRationale(exact)).toEqual({ rationale: exact, rationaleStatus: 'present' });
    const over = boundRationale(`${exact}b`);
    expect(over.rationaleStatus).toBe('truncated');
    expect(over.rationale).toBe(exact);
  });

  it.each([
    ['a surrogate pair (😀)', '😀'],
    ['a combining sequence (e + U+0301)', 'é'],
    ['a ZWJ family (👨‍👩‍👧‍👦)', '👨‍👩‍👧‍👦'],
    ['a flag (🇺🇸)', '🇺🇸'],
  ])('a cut never splits %s straddling the bound', (_label, cluster) => {
    const max = 40;
    const head = 'a'.repeat(max - 1);
    const out = boundRationale(`${head}${cluster} tail`, { maxChars: max });
    expect(out.rationaleStatus).toBe('truncated');
    expect(out.rationale).toBe(head); // the whole cluster is dropped, not half of it
    expect(out.rationale.isWellFormed()).toBe(true);
  });

  it('the cut is the LONGEST whole-grapheme prefix within the bound, across mixed scripts', () => {
    const alphabet = ['a', ' ', '漢', '😀', 'é', '👨‍👩‍👧', '🇯🇵', 'ß', 'क्ष'];
    for (const max of [2, 3, 7, 16, 41]) {
      for (let seed = 0; seed < alphabet.length; seed += 1) {
        let text = 'x';
        for (let i = 0; text.length <= max + 12; i += 1) text += alphabet[(seed + i * 7) % alphabet.length];
        const out = boundRationale(text, { maxChars: max });
        expect(out.rationaleStatus).toBe('truncated');
        expect(out.rationale.length).toBeLessThanOrEqual(max);
        expect(text.startsWith(out.rationale)).toBe(true);
        const kept = graphemes(out.rationale);
        const all = graphemes(text);
        expect(kept).toEqual(all.slice(0, kept.length)); // whole clusters only
        expect(out.rationale.length + all[kept.length].length).toBeGreaterThan(max); // maximal
      }
    }
  });

  it('a single cluster longer than the bound falls back to a code-point cut: non-empty, never half a pair', () => {
    const zwjRun = `😀${'‍😀'.repeat(20)}`; // one emoji ZWJ cluster, 62 units
    expect(graphemes(zwjRun)).toHaveLength(1);
    const out = boundRationale(zwjRun, { maxChars: 10 });
    expect(out.rationaleStatus).toBe('truncated');
    expect(out.rationale).toBe('😀‍😀‍😀‍'); // the edge pair moved out whole: 9 units
    expect(out.rationale.isWellFormed()).toBe(true);

    const marks = `e${'́'.repeat(50)}`; // one combining cluster
    const cut = boundRationale(marks, { maxChars: 10 });
    expect(cut).toEqual({ rationale: marks.slice(0, 10), rationaleStatus: 'truncated' });
  });

  it('a lone surrogate is made well-formed (every stored unit costs at most 3 UTF-8 bytes)', () => {
    const out = boundRationale('reason \ud800 here');
    expect(out.rationaleStatus).toBe('present');
    expect(out.rationale).toBe('reason � here');
  });

  it('rejects a bound below 2 units (a cut could otherwise come back empty)', () => {
    expect(() => boundRationale('abc', { maxChars: 1 })).toThrow(/maxChars/);
    expect(() => boundRationale('abc', { maxChars: 2.5 })).toThrow(/maxChars/);
  });
});

describe('convictionDiagnosticOf — clamped integer or null, never a probability', () => {
  it.each([
    [80, 80], [0, 0], [100, 100], [150, 100], [-5, 0], [72.5, 73], [72.4, 72],
    [null, null], [undefined, null], ['80', null], [Number.NaN, null], [Number.POSITIVE_INFINITY, null],
  ])('%s → %s', (raw, want) => {
    expect(convictionDiagnosticOf(raw)).toBe(want);
  });
});

describe('attribution — the pinned seat and the response time', () => {
  it('generationConfigVersion is a content address of the seat: key order is irrelevant, params are not', () => {
    const v = generationConfigVersionOf(SEAT);
    expect(v).toMatch(/^seat_[0-9a-f]{16}$/);
    const reordered = { params: { maxTokens: 600, temperature: 0.7 }, model: SEAT.model, provider: 'anthropic' };
    expect(generationConfigVersionOf(reordered)).toBe(v);
    expect(generationConfigVersionOf({ ...SEAT, params: { ...SEAT.params, temperature: 0.2 } })).not.toBe(v);
    expect(generationConfigVersionOf({ ...SEAT, model: 'claude-other' })).not.toBe(v);
    expect(generationConfigVersionOf(null)).toBe(null);
    expect(generationConfigVersionOf({ params: {} })).toBe(null); // no model id → no seat
  });

  it('responseAttribution takes the model id from the seat, the submit-time copy only when the seat is unreadable', () => {
    const at = new Date('2026-08-12T14:05:03Z');
    expect(responseAttribution({ modelSeat: SEAT, modelId: 'stale-copy', rationaleAt: at, rationaleAtBasis: 'direct_response' })).toEqual({
      modelId: SEAT.model, generationConfigVersion: generationConfigVersionOf(SEAT), rationaleAt: at, rationaleAtBasis: 'direct_response',
    });
    expect(responseAttribution({ modelSeat: null, modelId: 'claude-x', rationaleAt: at, rationaleAtBasis: 'batch_ended' })).toEqual({
      modelId: 'claude-x', generationConfigVersion: null, rationaleAt: at, rationaleAtBasis: 'batch_ended',
    });
    expect([...RATIONALE_AT_BASES]).toEqual(['direct_response', 'batch_ended', 'batch_harvested']);
  });

  it('an empty model id in the seat falls back like a missing one (one truthiness rule for id and version)', () => {
    const r = responseAttribution({ modelSeat: { ...SEAT, model: '' }, modelId: 'claude-x' });
    expect(r.modelId).toBe('claude-x');
    expect(r.generationConfigVersion).toBe(null);
  });

  it('rationaleRecordInputs with no attribution means no model response stands behind the record', () => {
    expect(rationaleRecordInputs()).toEqual({
      rationale: null, convictionDiagnostic: null, modelId: null, generationConfigVersion: null, rationaleAt: null, rationaleAtBasis: null,
    });
  });
});

describe('buildDecision — the reason fields, bounded by construction', () => {
  it('every record carries the T0b fields; the default is absent with null attribution', () => {
    const d = buildDecision({ decisionId: 'd1', verb: 'HOLD', status: 'cancelled', failCondition: 'rollover' });
    for (const f of DECISION_RATIONALE_FIELDS) expect(f in d).toBe(true);
    expect(d).toMatchObject({
      rationale: null, rationaleStatus: 'absent', convictionDiagnostic: null,
      modelId: null, generationConfigVersion: null, rationaleAt: null, rationaleAtBasis: null,
    });
  });

  it('the builder bounds raw text and sanitizes conviction, whatever the writer passes', () => {
    const at = new Date('2026-08-12T14:25:00Z');
    const d = buildDecision({
      decisionId: 'd2', verb: 'BUY', ticker: 'AAPL', status: 'executed',
      rationale: `  ${'漢'.repeat(2_000_000)}  `, convictionDiagnostic: 999,
      modelId: SEAT.model, generationConfigVersion: generationConfigVersionOf(SEAT), rationaleAt: at, rationaleAtBasis: 'batch_ended',
    });
    expect(d.rationaleStatus).toBe('truncated');
    expect(d.rationale.length).toBe(MANDATE_RATIONALE_MAX_CHARS);
    expect(d.convictionDiagnostic).toBe(100);
    expect(d.rationaleAt).toBe(at);
    expect(d.rationaleAtBasis).toBe('batch_ended');
  });

  it('an unknown rationaleAtBasis is not stored', () => {
    expect(buildDecision({ decisionId: 'd3', rationaleAtBasis: 'guess' }).rationaleAtBasis).toBe(null);
  });

  it('caps the two other model- or provider-lengthened strings; real values pass unchanged', () => {
    expect(MANDATE_DECISION_TICKER_MAX_CHARS).toBe(32);
    expect(MANDATE_DECISION_FAIL_CONDITION_MAX_CHARS).toBe(200);
    const real = buildDecision({ decisionId: 'd5', ticker: 'BRK.B', failCondition: 'bad_decision:missing_ticker' });
    expect(real.ticker).toBe('BRK.B');
    expect(real.failCondition).toBe('bad_decision:missing_ticker');
    const long = buildDecision({ decisionId: 'd6', ticker: 'Z'.repeat(6000), failCondition: `api_error:${'e'.repeat(6000)}` });
    expect(long.ticker).toBe('Z'.repeat(32));
    expect(long.failCondition).toHaveLength(200);
    expect(buildDecision({ decisionId: 'd7' })).toMatchObject({ ticker: null, failCondition: null });
  });

  it('capStoredString keeps a pair whole at the edge and makes text well-formed', () => {
    expect(capStoredString(`${'a'.repeat(31)}😀`, 32)).toBe('a'.repeat(31)); // the pair at units 31–32 moves out whole
    expect(capStoredString('ab\ud800', 32)).toBe('ab�');
    expect(capStoredString(null, 32)).toBe(null);
    expect(capStoredString(undefined, 32)).toBe(null);
  });

  it('a blank rationale from a writer is still absent, never an empty string', () => {
    const d = buildDecision({ decisionId: 'd4', rationale: '   ' });
    expect(d.rationale).toBe(null);
    expect(d.rationaleStatus).toBe('absent');
  });
});

// ── Document size (Firestore storage-size rules) ─────────────────────────────
// Firestore's documented accounting: a string is its UTF-8 bytes + 1; a
// number, Date or timestamp 8; a boolean or null 1; a map the sum of
// (key string + value); an array the sum of its elements; a document is its
// name (Σ path-segment strings + 16) + its fields + 32. The limit is 1 MiB.
const FIRESTORE_DOC_LIMIT_BYTES = 1_048_576;
const strSize = (s) => Buffer.byteLength(s, 'utf8') + 1;
function valueSize(v) {
  if (v === null || v === undefined) return 1;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return strSize(v);
  if (v instanceof Date) return 8;
  if (Array.isArray(v)) return v.reduce((n, e) => n + valueSize(e), 0);
  if (typeof v === 'object') return Object.entries(v).reduce((n, [k, x]) => n + strSize(k) + valueSize(x), 0);
  throw new Error(`unsized value of type ${typeof v}`);
}
const docSize = (segments, data) => segments.reduce((n, s) => n + strSize(s), 0) + 16 + valueSize(data) + 32;

describe('document size — a decision stays well inside Firestore\'s limit by construction', () => {
  // Worst case: every field populated, long ids, and every string a model or
  // provider can lengthen (reason, ticker, failing condition) fed far past its
  // cap — the reason in 3-byte characters (the most UTF-8 bytes per UTF-16
  // unit). The remaining strings are engine-written; they get generous values.
  const worst = buildDecision({
    decisionId: 'x'.repeat(64), verb: 'TRIM', ticker: '漢'.repeat(100_000), requestedSizeUsd: 1e7, executedSizeUsd: 1e7,
    executedShares: 123456.123456, executedPrice: 9999.99, realizedPnl: -1e6, fillMarkQuality: 'carry_over', clamped: true,
    friction: { slippageBps: 20, spreadProxyBps: 20, spreadBasis: 'proxy', frictionPaid: 1e5, frictionBasis: 'idealized_no_market_impact' },
    frictionModelVersion: 1, gateOutcome: { rule: 'price_drift', passed: false, driftBps: 1234.5678 },
    failCondition: `api_error:${'漢'.repeat(100_000)}`, vintageRef: `archetypeVintages/momentum_chaser_${'f'.repeat(64)}`,
    baseRevision: 1e6, submitTickKey: '2026-08-12_preClose', harvestTickKey: '2026-08-12_preClose', harvestSnapshotDegraded: true,
    mandatePromptTemplateVersion: 'v'.repeat(40), status: 'rejected_stale',
    rationale: '漢'.repeat(10_000), convictionDiagnostic: 100, modelId: 'claude-haiku-4-5-20251001',
    generationConfigVersion: generationConfigVersionOf(SEAT), rationaleAt: new Date(), rationaleAtBasis: 'batch_harvested',
  });
  const size = docSize(['mandates', 'm'.repeat(20), 'decisions', 'x'.repeat(64)], worst);

  it('the stored reason is at most 3 × the bound in UTF-8 bytes; ticker and failing condition are capped', () => {
    expect(worst.rationale.length).toBe(MANDATE_RATIONALE_MAX_CHARS);
    expect(Buffer.byteLength(worst.rationale, 'utf8')).toBeLessThanOrEqual(3 * MANDATE_RATIONALE_MAX_CHARS);
    expect(worst.ticker.length).toBe(MANDATE_DECISION_TICKER_MAX_CHARS);
    expect(worst.failCondition.length).toBe(MANDATE_DECISION_FAIL_CONDITION_MAX_CHARS);
    expect(worst.failCondition.startsWith('api_error:')).toBe(true);
  });

  it('the whole worst-case document is under 8 KiB — under 1% of the 1 MiB limit', () => {
    expect(size).toBeGreaterThan(3 * MANDATE_RATIONALE_MAX_CHARS); // the estimator saw the reason
    expect(size).toBeLessThan(8 * 1024);
    expect(size).toBeLessThan(FIRESTORE_DOC_LIMIT_BYTES / 100);
  });
});

// ── Result-less terminals ────────────────────────────────────────────────────

describe('disposeSubmission — a terminal with no model reason records absent, its failCondition says why', () => {
  it('a result-less expiry: absent, null attribution, the condition durable', async () => {
    const db = makeMandateFakeDb({ 'mandates/m1': { revision: 2, execState: { openBatchId: 'req_a', submitted: 0, executed: 0 } } });
    const ref = db.collection('mandates').doc('m1');
    await disposeSubmission(db, { mandateRef: ref, requestId: 'req_a', status: 'expired', failCondition: 'result_age' });
    expect(db._get('mandates/m1/decisions/req_a')).toMatchObject({
      status: 'expired', failCondition: 'result_age',
      rationale: null, rationaleStatus: 'absent', convictionDiagnostic: null,
      modelId: null, generationConfigVersion: null, rationaleAt: null, rationaleAtBasis: null,
    });
  });

  it('a replay never backfills a reason onto an already-claimed record', async () => {
    const db = makeMandateFakeDb({
      'mandates/m1': { revision: 2, execState: { openBatchId: null } },
      'mandates/m1/decisions/req_b': { decisionId: 'req_b', status: 'cancelled', rationale: null, rationaleStatus: 'absent' },
    });
    const ref = db.collection('mandates').doc('m1');
    const r = await disposeSubmission(db, {
      mandateRef: ref, requestId: 'req_b', status: 'failed', failCondition: 'bad_decision:bad_verb',
      rationale: 'late text', attribution: responseAttribution({ modelSeat: SEAT, rationaleAt: new Date(), rationaleAtBasis: 'batch_ended' }),
    });
    expect(r.idempotent).toBe(true);
    expect(db._get('mandates/m1/decisions/req_b')).toMatchObject({ status: 'cancelled', rationale: null, rationaleStatus: 'absent' });
  });
});
