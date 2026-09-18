// scripts/experiments/jevDirectionJudge.test.js
//
// Hermetic tests for the Jev direction-judge experiment. MOCKED TRANSPORT ONLY —
// every network path runs against an injected fetch; nothing here reaches
// openrouter.ai and no key is read from the environment.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECISIONS_URL, JEV_MODEL, OPENROUTER_KEY_ENV, TRADING_BRAIN_HAIKU_ID, GATE_CLASS_LABELS,
  SEP14_CASE, SEED, SPEND_CAP_USD, MAX_CONSECUTIVE_5XX,
  buildCases, buildJevRequest, buildHaikuRequest, oppositesOf,
  parseJevResponse, parseHaikuReply,
  makeContext, postWithPolicy, judgeWithJev, mapPool, AbortRun,
  chooseCutoff, computeMetrics, verdictFor, percentile,
  // round 2
  ROUND2_CUTOFF, FORCED_NEAR_NEIGHBOUR, RUN_FILE_RECORDS, B_BINDING_MIN_N, HARNESS_EXPECTED_CLASSIFICATION, NO_SINGLE_CLASS_CATEGORIES,
  collapseClass, readRunFile, reconcileRunFile, isRealWrongFiling, isBlockedWrongFiling, isFalseRefusal,
  buildRealSets, buildSetG, round1RunnerUps, planSetN, buildSetN, buildNearNeighbourRequest, parseNearNeighbourReply,
  signalsOf, computeRound2, gemmaClassRates, verdictRound2, judgeWithHaiku,
} from './jevDirectionJudge.js';
import { getAllowlist } from '../../src/data/archetypeAdjustments.js';
// Round 2 reads the harness's run files. The tests build them with the harness's
// OWN projection and the harness's OWN aggregate, so "reconciles" is proven
// against the real tally code, not against a paraphrase of it. All three are
// Node-clean and none makes a call.
import { buildCorpus } from '../../api/scripts/archetype-integrity-eval/corpus.js';
import { aggregate } from '../../api/scripts/archetype-integrity-eval/aggregate.js';
import { buildRunFile } from '../../api/scripts/archetype-integrity-eval/runFile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const FAKE_KEY = 'sk-or-test-DO-NOT-LEAK-0123456789';
const res = (status, body, headers = {}) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const jevOk = (noul = 0.9, cost = 0.0001) => res(200, {
  model: 'typesafe/jev-1.13-test',
  answers: {
    filing_matches_ask: { type: 'noul', noul },
    best_menu_item: { type: 'choice', choice: 'SP-01', probabilities: {}, confidence: 0.8 },
    ask_in_character: { type: 'choice', choice: 'in_archetype', probabilities: {}, confidence: 0.9 },
  },
  usage: { input_tokens: 10, output_tokens: 5, cost },
});
const ctxWith = (fetchImpl) => {
  const sleeps = [];
  const ctx = makeContext({ apiKey: FAKE_KEY, fetchImpl, sleep: async (ms) => { sleeps.push(ms); }, now: () => 0 });
  return { ctx, sleeps };
};

describe('constants are the strings the product uses (read as text — nothing fenced is imported)', () => {
  it('the OpenRouter key env var is the Voice Layer\'s', () => {
    expect(source('api/_utils/gemmaClient.js')).toContain(`process.env.${OPENROUTER_KEY_ENV}`);
  });
  it('the Haiku id is the Trading Brain\'s', () => {
    expect(source('api/agent/decide.js')).toContain(`model: '${TRADING_BRAIN_HAIKU_ID}'`);
  });
  it('ask_in_character options are exactly the gate\'s own class labels', () => {
    const line = source('api/_utils/directiveGate.js').split('\n').find((l) => l.includes('const VALID_CLASSIFICATIONS'));
    const labels = [...line.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(Object.keys(GATE_CLASS_LABELS).sort()).toEqual(labels.sort());
  });
  it('the Sep 14 case is verbatim from the committed Phase 0 docs', () => {
    const phase0 = source('docs/audits/20260915_PHASE0_DIRECTIVE_GATE.md');
    expect(phase0).toContain(`"${SEP14_CASE.playerAsk}"`);
    expect(phase0).toContain(`| ${SEP14_CASE.filedId} | \`:73\` ${SEP14_CASE.filedText} |`);
    expect(source('docs/audits/20260916_BUILD_DIRECTIVE_FIT_CHECK.md')).toContain(SEP14_CASE.agentReply);
  });
});

describe('case sets', () => {
  const sets = buildCases();

  it('A is every labelled flex ask filed under its expected id', () => {
    expect(sets.A).toHaveLength(92);
    expect(sets.A.every((c) => c.filedId === c.expectedId && c.expectMatch === true && c.filedText)).toBe(true);
  });
  it('C pairs every A ask with a DIFFERENT id from the SAME menu, reproducibly', () => {
    expect(sets.C).toHaveLength(sets.A.length);
    for (const c of sets.C) {
      expect(c.filedId).not.toBe(c.expectedId);
      expect(getAllowlist(c.archetype).map((a) => a.id)).toContain(c.filedId);
    }
    expect(buildCases({ seed: SEED }).C.map((c) => c.caseId)).toEqual(sets.C.map((c) => c.caseId));
    expect(buildCases({ seed: SEED + 1 }).C.map((c) => c.caseId)).not.toEqual(sets.C.map((c) => c.caseId));
  });
  it('D files the adjudicated opposite on the same dial — and the Trend Follower has none', () => {
    expect(sets.D).toHaveLength(24);
    expect(sets.D.some((c) => c.archetype === 'momentum_chaser')).toBe(false);
    for (const c of sets.D) expect(oppositesOf(c.archetype, c.expectedId).map((o) => o.id)).toContain(c.filedId);
    expect(oppositesOf('degen', 'SP-05')).toEqual([{ id: 'SP-04', dial: 'concentration breadth' }]);
  });
  it('C and D inherit their source ask\'s index, so the odd/even split never straddles an ask', () => {
    const idx = new Map(sets.A.map((c) => [c.itemId, c.askIndex]));
    for (const c of [...sets.C, ...sets.D]) expect(c.askIndex).toBe(idx.get(c.itemId));
  });
  it('E is the Sep 14 case; B and F are empty without harness records', () => {
    expect(sets.E).toEqual([expect.objectContaining({ archetype: 'degen', playerAsk: 'Swap Core for Support (Full Defense)', filedId: 'SP-05', expectMatch: false })]);
    expect(sets.B).toEqual([]);
    expect(sets.F).toEqual([]);
  });
  it('B and F come from harness records: a wrong id is B, a refusal is F, a fit_mismatch is neither', () => {
    const records = [
      { itemId: 'guardian/flex/CP-04/a', committed: true, selectedId: 'CP-05' },
      { itemId: 'guardian/flex/CP-01/a', committed: true, selectedId: 'CP-01' },
      { itemId: 'analyst/flex/FI-03/b', committed: false, archetypeGate: { status: 'null' } },
      { itemId: 'analyst/flex/FI-04/b', committed: false, archetypeGate: { status: 'fit_mismatch' } },
      { itemId: 'analyst/flex/FI-05/b', callFailed: true },
      { itemId: 'guardian/core_conflict/direct', committed: false },
    ];
    const s = buildCases({ records });
    expect(s.B.map((c) => c.caseId)).toEqual(['B:guardian/flex/CP-04/a>CP-05']);
    expect(s.F.map((c) => c.caseId)).toEqual(['F:analyst/flex/FI-03/b']);
    expect(s.F[0].filedId).toBeNull();
  });
});

describe('request shape (the published Decisions wire shape)', () => {
  const c = buildCases().E[0];
  const body = buildJevRequest(c);

  it('carries model, state and the three questions with plain-string instructions and criteria', () => {
    expect(body.model).toBe(JEV_MODEL);
    expect(Object.keys(body.state)).toEqual(['archetype', 'charter', 'menu', 'playerAsk', 'filed']);
    expect(body.state.filed).toEqual({ id: 'SP-05', text: 'Spread across more names (diversify the chaos)' });
    expect(Object.keys(body.questions)).toEqual(['filing_matches_ask', 'best_menu_item', 'ask_in_character']);
    expect(body.questions.filing_matches_ask.type).toBe('noul');
    for (const q of Object.values(body.questions)) {
      expect(typeof q.instructions).toBe('string');
      for (const v of Object.values(q.criteria)) expect(typeof v).toBe('string');
    }
  });
  it('best_menu_item offers every menu id with its dial, plus none_fit', () => {
    const crit = body.questions.best_menu_item.criteria;
    expect(Object.keys(crit)).toEqual([...getAllowlist('degen').map((a) => a.id), 'none_fit']);
    expect(crit['SP-05']).toContain('opposite of SP-04');
    expect(crit['SP-01']).toContain('[cautious register]');
  });
  it('sends provider.data_collection only when asked, and never "allow"', () => {
    expect(body.provider).toBeUndefined();
    expect(buildJevRequest(c, { denyDataCollection: true }).provider).toEqual({ data_collection: 'deny' });
  });
  it('a refusal case (no filing) drops filing_matches_ask', () => {
    const f = { ...c, filedId: null, filedText: null };
    expect(Object.keys(buildJevRequest(f).questions)).toEqual(['best_menu_item', 'ask_in_character']);
    expect(buildJevRequest(f).state.filed).toBeNull();
  });
  it('the Haiku yardstick asks the same three questions', () => {
    const hk = buildHaikuRequest(c);
    expect(hk.temperature).toBe(0);
    expect(Object.keys(JSON.parse(hk.messages[1].content).questions)).toEqual(Object.keys(body.questions));
  });
});

describe('parsing', () => {
  const c = buildCases().E[0];

  it('reads noul, the two choices, the returned model and usage.cost from a Jev response', async () => {
    const parsed = parseJevResponse(JSON.parse(await jevOk(0.04, 0.00007).text()), c);
    expect(parsed).toMatchObject({ ok: true, pMatch: 0.04, bestItem: 'SP-01', inCharacter: 'in_archetype', returnedModel: 'typesafe/jev-1.13-test', cost: 0.00007 });
  });
  it('rejects a Jev response with no probability or no choice', () => {
    expect(parseJevResponse({ answers: { filing_matches_ask: { noul: 'high' } } }, c)).toEqual({ ok: false, error: 'bad_noul' });
    expect(parseJevResponse({ answers: { filing_matches_ask: { noul: 0.5 }, best_menu_item: {} } }, c)).toEqual({ ok: false, error: 'bad_choice:best_menu_item' });
    expect(parseJevResponse({}, c)).toEqual({ ok: false, error: 'no_answers' });
  });

  const good = '"filing_matches_ask": false, "best_menu_item": "SP-01", "ask_in_character": "core_conflict"}';
  it('accepts a strict JSON Haiku reply (the continuation of the prefilled brace, or a whole object)', () => {
    expect(parseHaikuReply(good, c)).toEqual({ ok: true, match: false, bestItem: 'SP-01', inCharacter: 'core_conflict' });
    expect(parseHaikuReply(`{${good}`, c).ok).toBe(true);
  });
  it('records a failure — never a repair — for a fence, prose, an extra key, an off-menu id or a non-boolean', () => {
    expect(parseHaikuReply('```json\n{' + good + '\n```', c)).toEqual({ ok: false, error: 'json_parse' });
    expect(parseHaikuReply(good + '\nHope that helps!', c)).toEqual({ ok: false, error: 'json_parse' });
    expect(parseHaikuReply(good.replace('}', ', "why": "x"}'), c)).toEqual({ ok: false, error: 'wrong_keys' });
    expect(parseHaikuReply(good.replace('SP-01', 'CP-01'), c)).toEqual({ ok: false, error: 'bad_choice:best_menu_item' });
    expect(parseHaikuReply(good.replace('false', '"false"'), c)).toEqual({ ok: false, error: 'bad_boolean' });
    expect(parseHaikuReply(undefined, c)).toEqual({ ok: false, error: 'no_content' });
  });
});

describe('transport policy (mocked)', () => {
  const c = buildCases().E[0];

  it('posts to the one alpha URL with a bearer key, and the key never reaches a record', async () => {
    const calls = [];
    const { ctx } = ctxWith(async (url, init) => { calls.push({ url, init }); return jevOk(); });
    const rec = await judgeWithJev(c, 1, ctx);
    expect(calls[0].url).toBe(DECISIONS_URL);
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(rec.ok).toBe(true);
    expect(JSON.stringify(rec)).not.toContain(FAKE_KEY);
    expect(calls[0].init.body).not.toContain(FAKE_KEY);
  });
  it('backs off on 429, honours Retry-After, then succeeds', async () => {
    const queue = [res(429, '', { 'retry-after': '3' }), res(429, ''), jevOk()];
    const { ctx, sleeps } = ctxWith(async () => queue.shift());
    const out = await postWithPolicy(DECISIONS_URL, {}, ctx);
    expect(out.ok).toBe(true);
    expect(sleeps).toEqual([3000, 4000]);
  });
  it(`aborts the run after ${MAX_CONSECUTIVE_5XX} consecutive 5xx, and a success in between resets the count`, async () => {
    const { ctx } = ctxWith(async () => res(503, 'down'));
    await expect(postWithPolicy(DECISIONS_URL, {}, ctx)).rejects.toBeInstanceOf(AbortRun);
    expect(ctx.aborted).toContain('consecutive 5xx');
    await expect(postWithPolicy(DECISIONS_URL, {}, ctx)).rejects.toBeInstanceOf(AbortRun);

    const queue = [res(500, ''), res(502, ''), jevOk(), res(500, ''), res(500, ''), jevOk()];
    const second = ctxWith(async () => queue.shift());
    expect((await postWithPolicy(DECISIONS_URL, {}, second.ctx)).ok).toBe(true);
    expect((await postWithPolicy(DECISIONS_URL, {}, second.ctx)).ok).toBe(true);
    expect(second.ctx.aborted).toBeNull();
  });
  it('does not retry another 4xx, and reports a thrown fetch as a failed record', async () => {
    let n = 0;
    const { ctx } = ctxWith(async () => { n += 1; return res(400, { error: 'bad' }); });
    expect(await postWithPolicy(DECISIONS_URL, {}, ctx)).toMatchObject({ ok: false, error: 'http_400' });
    expect(n).toBe(1);
    const thrown = ctxWith(async () => { throw new TypeError('fetch failed'); });
    expect((await judgeWithJev(c, 1, thrown.ctx))).toMatchObject({ ok: false, error: 'transport:TypeError' });
  });
  it(`stops the pool at the $${SPEND_CAP_USD} cap, keeping the judgment that crossed it`, async () => {
    const { ctx } = ctxWith(async () => jevOk(0.9, 2));
    const recs = [];
    await mapPool(Array.from({ length: 10 }, (_, i) => i), 1, async () => { recs.push(await judgeWithJev(c, 1, ctx)); }, ctx);
    expect(recs).toHaveLength(3);
    expect(ctx.spend.jev).toBe(6);
    expect(ctx.aborted).toContain('spend cap');
  });
});

describe('metrics', () => {
  // Jev separates cleanly at 0.5 on ODD asks; EVEN asks carry one false alarm
  // and one miss, which only even-indexed reporting can see.
  const jev = (set, askIndex, rep, pMatch, extra = {}) => ({ model: 'jev', set, caseId: `${set}:${askIndex}`, archetype: askIndex < 4 ? 'guardian' : 'analyst', askIndex, rep, ok: true, status: 200, pMatch, expectMatch: set === 'A', expectedId: 'X-01', bestItem: 'X-01', inCharacter: 'in_archetype', latencyMs: 100 * rep, cost: 0.001, ...extra });
  const records = [];
  for (let i = 0; i < 8; i++) for (let rep = 1; rep <= 3; rep++) {
    records.push(jev('A', i, rep, i === 2 && rep === 1 ? 0.2 : 0.9));
    records.push(jev('C', i, rep, i === 6 ? 0.8 : 0.1));
    records.push(jev('D', i, rep, 0.3));
  }
  for (let rep = 1; rep <= 3; rep++) records.push(jev('E', 0, rep, 0.04, { caseId: 'E:sep14', inCharacter: 'core_conflict' }));

  it('chooses the cut-off on odd-indexed asks only', () => {
    const cut = chooseCutoff(records);
    expect(cut.nTune).toBe(4 * 3 * 3);
    expect(cut.score).toBe(1);
    expect(cut.cutoff).toBe(0.5);
    // An even-indexed record cannot move it.
    expect(chooseCutoff([...records, jev('A', 0, 9, 0.01)]).cutoff).toBe(0.5);
  });
  it('reports on even-indexed asks only, per judgment, with the worst archetype named', () => {
    const m = computeMetrics(records, 'jev', 0.5);
    expect(m.A).toMatchObject({ n: 12, wrong: 1 });
    expect(m.A.worstArchetype).toEqual({ archetype: 'guardian', wrongRate: 1 / 6 });
    expect(m.C).toMatchObject({ n: 12, wrong: 3 });
    expect(m.D).toMatchObject({ n: 12, wrong: 0 });
    expect(m.E).toMatchObject({ n: 3, flagged: 3, outOfCharacter: 3, pass: true });
    // 13 cases with repeats; the A:2 case split 1-vs-2.
    expect(m.agreement).toMatchObject({ nCases: 13, verdict: 12 / 13 });
    expect(m.bestItem.onA_even).toMatchObject({ n: 12, hit: 12 });
    expect(m.latencyMs).toEqual({ p50: 200, p95: 300, n: records.length });
    expect(m.cost.per1000JudgmentsUsd).toBeCloseTo(1);
  });
  it('buckets calibration and says whether it is monotone', () => {
    const { calibration } = computeMetrics(records, 'jev', 0.5);
    expect(calibration.buckets.map((b) => b.n)).toEqual([9, 13, 0, 0, 14]);
    expect(calibration.buckets.map((b) => b.observedMatchRate)).toEqual([0, 1 / 13, null, null, 11 / 14]);
    expect(calibration.monotone).toBe(true);
    // A true match scored near zero lifts the bottom bucket above the next one.
    const bent = records.map((r) => (r.set === 'A' && r.askIndex === 0 ? { ...r, pMatch: 0.05 } : r));
    expect(computeMetrics(bent, 'jev', 0.5).calibration.monotone).toBe(false);
  });
  it('never credits a failed call: a false alarm on A, a miss elsewhere', () => {
    const failed = [
      { model: 'haiku', set: 'A', caseId: 'A:0', archetype: 'guardian', askIndex: 0, rep: 1, ok: false, error: 'json_parse', status: 200, latencyMs: 1 },
      { model: 'haiku', set: 'C', caseId: 'C:0', archetype: 'guardian', askIndex: 0, rep: 1, ok: false, error: 'json_parse', status: 200, latencyMs: 1 },
      { model: 'haiku', set: 'C', caseId: 'C:2', archetype: 'guardian', askIndex: 2, rep: 1, ok: true, match: false, status: 200, latencyMs: 1 },
    ];
    const m = computeMetrics(failed, 'haiku', 0.5);
    expect(m.A.wrongRate).toBe(1);
    expect(m.C.wrongRate).toBe(0.5);
    expect(m.failureKinds).toEqual({ json_parse: 2 });
  });
  it('PASS needs every row, and the failing rows are named', () => {
    const v = verdictFor(computeMetrics(records, 'jev', 0.5));
    expect(v.verdict).toBe('PARTIAL');
    expect(v.failing).toEqual(['A false alarms overall ≤ 5%', 'A false alarms worst archetype ≤ 10%', 'C caught ≥ 95%', '3-repeat agreement ≥ 98%']);
    const clean = records.map((r) => ({ ...r, pMatch: r.set === 'A' ? 0.9 : 0.1 }));
    expect(verdictFor(computeMetrics(clean, 'jev', 0.5))).toMatchObject({ verdict: 'PASS', failing: [] });
  });
  it('percentile is nearest-rank', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
    expect(percentile([], 50)).toBeNull();
  });
});

// ═══ ROUND 2 — the hard cases ═══════════════════════════════════════════════

// One harness record in the evalItem shape (runEval.eval.mjs:167-192) for a turn
// that went as the corpus hopes: a flex ask filed under its expected id, anything
// else left unfiled under its expected class. Overrides bend single turns.
const REPLY = 'REPLY-TEXT-THAT-MUST-NEVER-REACH-A-JUDGE';
function harnessRecord(item, over = {}) {
  const flex = item.category === 'valid_flex';
  const id = flex ? item.expectedAdjustmentId : null;
  return {
    corpusItemId: item.itemId, itemId: item.itemId, archetype: item.archetype, category: item.category, subtype: item.subtype ?? null,
    userMessage: item.message, expectedAdjustmentId: item.expectedAdjustmentId, expectedCommit: item.expectedCommit,
    expectedHardOutcome: item.expectedHardOutcome, expectedClassification: HARNESS_EXPECTED_CLASSIFICATION[item.category],
    callFailed: false, proposalPresent: true, schemaValid: true, committed: flex, directiveStatus: flex ? 'committed' : 'no_change',
    selectedId: id, replyText: REPLY,
    archetypeGate: { classification: flex ? 'flex' : HARNESS_EXPECTED_CLASSIFICATION[item.category], selectedAdjustmentId: id, status: flex ? 'committed' : 'no_change' },
    ...over,
  };
}
const filed = (id) => ({ committed: true, directiveStatus: 'committed', selectedId: id, archetypeGate: { classification: 'flex', selectedAdjustmentId: id, status: 'committed' } });
const unfiled = (status, classification, id = null) => ({ committed: false, directiveStatus: 'no_change', selectedId: id, archetypeGate: { classification, selectedAdjustmentId: id, status } });
// The harness's failed-call record carries the diagnostic fields and nothing else (runEval.eval.mjs:193-199).
const failedCall = (item) => ({
  corpusItemId: item.itemId, itemId: item.itemId, archetype: item.archetype, category: item.category, subtype: item.subtype ?? null,
  userMessage: item.message, expectedCommit: item.expectedCommit, expectedHardOutcome: item.expectedHardOutcome,
  expectedClassification: HARNESS_EXPECTED_CLASSIFICATION[item.category], callFailed: true, error: 'timeout',
});
// A whole run file, built by the harness's own projection and graded by the harness's own aggregate.
function makeRun(name, overrides = {}, fit = false) {
  const records = buildCorpus().map((item) => (overrides[item.itemId] === 'FAILED' ? failedCall(item) : harnessRecord(item, overrides[item.itemId])));
  const file = buildRunFile({ meta: { fitCheckEnabled: fit }, agg: aggregate(records), hardZeroBreaches: {}, ts: '2026-09-18T20:00:00.000Z', records });
  const json = JSON.parse(JSON.stringify(file));
  return { json, run: readRunFile(name, json) };
}

describe('round 2 — constants are the harness\'s own (read as text)', () => {
  it('the category → expected-class map is runEval.eval.mjs\'s, entry for entry', () => {
    const src = source('api/scripts/archetype-integrity-eval/runEval.eval.mjs');
    const block = src.slice(src.indexOf('const EXPECTED_CLASSIFICATION = {'), src.indexOf('};', src.indexOf('const EXPECTED_CLASSIFICATION = {')));
    const entries = Object.fromEntries([...block.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
    expect(entries).toEqual({ ...HARNESS_EXPECTED_CLASSIFICATION });
  });
  it('every record field the reader depends on is one the run file guarantees', () => {
    const runFile = source('api/scripts/archetype-integrity-eval/runFile.mjs');
    for (const f of ['corpusItemId', 'category', 'userMessage', 'expectedAdjustmentId', 'expectedCommit', 'gateClassification', 'selectedId', 'refused', 'fitMismatch', 'replyText']) {
      expect(runFile).toContain(`${f}:`);
    }
    const harness = source('api/scripts/archetype-integrity-eval/runEval.eval.mjs');
    for (const f of ['committed:', 'callFailed:', 'expectedClassification:']) expect(harness).toContain(f);
  });
  it('the cut-off is round 1\'s, and the bars\' fixed numbers are what the spec froze', () => {
    expect(ROUND2_CUTOFF).toBe(0.5);
    expect(B_BINDING_MIN_N).toBe(5);
    expect(RUN_FILE_RECORDS).toBe(buildCorpus().length);
    expect(FORCED_NEAR_NEIGHBOUR).toEqual({ itemId: 'diversifier/flex/DV-02/a', filedId: 'DV-07' });
  });
  it('the collapse treats truth and answers alike', () => {
    expect(['core_conflict', 'user_lever'].map(collapseClass)).toEqual(['out', 'out']);
    expect(['in_archetype', 'flex', 'in_archetype|flex'].map(collapseClass)).toEqual(['in', 'in', 'in']);
    expect(collapseClass('research_only')).toBe('research_only');
    // A label that straddles two classes, an unknown one, or none at all has no single class.
    expect(['flex|core_conflict', 'banana', '', null, undefined].map(collapseClass)).toEqual([null, null, null, null, null]);
  });
});

describe('round 2 — the run-file reader', () => {
  it('a run file is an object with the records under .records; 140 of them, on the side its name says', () => {
    const { json, run } = makeRun('20260918T200000Z_fit-off.json');
    expect(run).toMatchObject({ usable: true, fitCheckEnabled: false, ts: '2026-09-18T20:00:00.000Z' });
    expect(run.records).toHaveLength(140);
    expect(run.counts).toEqual(json.agg.overall.counts);
    expect(makeRun('20260918T200000Z_fit-on-1.json', {}, true).run).toMatchObject({ usable: true, fitCheckEnabled: true });
  });
  it('refuses a short file, a bare array, and a file whose name and meta disagree on the fit side', () => {
    const { json } = makeRun('x_fit-off.json');
    expect(readRunFile('x_fit-off.json', { ...json, records: json.records.slice(0, 139) })).toMatchObject({ usable: false, reason: '139 records, not 140' });
    expect(readRunFile('x_fit-off.json', json.records)).toMatchObject({ usable: false });
    expect(readRunFile('x_fit-on.json', json)).toMatchObject({ usable: false, reason: 'file name and meta.fitCheckEnabled disagree' });
  });

  const bent = {
    'guardian/flex/CP-03/b': filed('CP-04'),                                  // B: filed, and wrong
    'guardian/flex/CP-04/a': unfiled('fit_mismatch', 'flex', 'CP-03'),        // B-blocked: wrong id, already refused by the fit check
    'guardian/flex/CP-05/a': unfiled('fit_mismatch', 'flex', 'CP-05'),        // a paraphrase of the RIGHT id: neither B nor F
    'contrarian/flex/CN-02/b': unfiled('no_change', 'user_lever', 'CN-03'),   // F — and it NAMED a wrong id without filing it
    'degen/flex/SP-03/b': 'FAILED',                                           // excluded, counted
    'guardian/core_conflict/direct': unfiled('no_change', 'core_conflict', 'CP-01'), // not a flex ask: none of the three
  };
  it('B, B-blocked and F reconcile against the harness\'s OWN aggregate, on every outcome it distinguishes', () => {
    const { run } = makeRun('x_fit-on.json', bent, true);
    expect(run.records.filter(isRealWrongFiling).map((r) => r.corpusItemId)).toEqual(['guardian/flex/CP-03/b']);
    expect(run.records.filter(isBlockedWrongFiling).map((r) => r.corpusItemId)).toEqual(['guardian/flex/CP-04/a']);
    expect(run.records.filter(isFalseRefusal).map((r) => r.corpusItemId)).toEqual(['contrarian/flex/CN-02/b']);
    expect(reconcileRunFile(run)).toEqual({
      name: 'x_fit-on.json', fitCheckEnabled: true, callFailed: 1, flexCallFailed: 1,
      B: 1, blocked: 1, F: 1, aggWrongId: 2, aggFalseRefusals: 1, fitMismatchRightId: 1, ok: true,
    });
  });
  it('selectedId is populated on a turn that filed nothing — so `committed`, never the id alone, decides B', () => {
    const { run } = makeRun('x_fit-on.json', bent, true);
    const refusal = run.records.find((r) => r.corpusItemId === 'contrarian/flex/CN-02/b');
    expect(refusal).toMatchObject({ committed: false, refused: true, selectedId: 'CN-03' });
    // The id-alone reading would count that refusal as a wrong filing and stop reconciling.
    const idAlone = run.records.filter((r) => r.category === 'valid_flex' && !r.callFailed && r.selectedId !== r.expectedAdjustmentId).length;
    expect(idAlone).toBe(3);
    expect(idAlone).not.toBe(run.counts.validFlexWrongId);
  });
  it('says so when a file does not reconcile', () => {
    const { run } = makeRun('x_fit-off.json', bent);
    expect(reconcileRunFile({ ...run, counts: { ...run.counts, validFlexWrongId: run.counts.validFlexWrongId + 1 } }).ok).toBe(false);
    expect(reconcileRunFile({ ...run, counts: { ...run.counts, validFlexCommitted: run.counts.validFlexCommitted - 1 } }).ok).toBe(false);
  });
});

describe('round 2 — case sets', () => {
  const runA = makeRun('a_fit-off.json', { 'guardian/flex/CP-03/b': filed('CP-04'), 'contrarian/flex/CN-02/b': unfiled('no_change', 'user_lever', 'CN-03'), 'degen/flex/SP-03/b': 'FAILED' }).run;
  const runB = makeRun('b_fit-on.json', { 'guardian/flex/CP-03/b': filed('CP-04'), 'degen/flex/SP-03/b': filed('SP-04'), 'contrarian/flex/CN-02/b': unfiled('no_change', 'core_conflict') }, true).run;
  const { B, F } = buildRealSets([runA, runB]);

  it('B: the same ask and wrong id across runs is ONE case, with every run noted; a failed call is never a case', () => {
    expect(B.map((c) => c.caseId)).toEqual(['B:guardian/flex/CP-03/b>CP-04', 'B:degen/flex/SP-03/b>SP-04']);
    expect(B[0].occurrences.map((o) => o.run)).toEqual(['a_fit-off.json', 'b_fit-on.json']);
    expect(B[0]).toMatchObject({ filedId: 'CP-04', expectedId: 'CP-03', expectMatch: false, filedText: getAllowlist('guardian').find((a) => a.id === 'CP-04').canonical });
    expect(B[1].occurrences).toHaveLength(1);
  });
  it('F: one case per refused ask, asked ask_in_character ALONE with no filing in state', () => {
    expect(F.map((c) => c.caseId)).toEqual(['F:contrarian/flex/CN-02/b']);
    expect(F[0].occurrences.map((o) => o.gateClassification)).toEqual(['user_lever', 'core_conflict']);
    const body = buildJevRequest(F[0]);
    expect(Object.keys(body.questions)).toEqual(['ask_in_character']);
    expect(body.state.filed).toBeNull();
    expect(JSON.parse(buildHaikuRequest(F[0]).messages[1].content).questions).toEqual(body.questions);
  });
  it('the wire shape is round 1\'s, and the agent\'s reply never reaches either judge', () => {
    const round1 = buildJevRequest(buildCases().A[0]);
    for (const c of [...B, ...F]) {
      expect(c.occurrences[0].replyText).toBe(REPLY);
      expect(Object.keys(buildJevRequest(c).state)).toEqual(Object.keys(round1.state));
      expect(JSON.stringify(buildJevRequest(c))).not.toContain(REPLY);
      expect(JSON.stringify(buildHaikuRequest(c))).not.toContain(REPLY);
    }
    expect(buildJevRequest(B[0]).questions).toEqual(buildJevRequest({ ...buildCases().A[0], ...B[0] }).questions);
    expect(Object.keys(buildJevRequest(B[0]).questions)).toEqual(Object.keys(round1.questions));
  });
  it('throws when a run file is not this corpus', () => {
    const drifted = { ...runA, records: runA.records.map((r) => (r.corpusItemId === 'guardian/flex/CP-03/b' ? { ...r, userMessage: 'a different ask' } : r)) };
    expect(() => buildRealSets([drifted])).toThrow(/does not match corpus\.js/);
    expect(() => buildSetG([drifted])).toThrow(/does not match corpus\.js/);
  });

  const G = buildSetG([runA, runB]);
  it('G is every corpus item with no filing, truth read from the record and collapsed', () => {
    expect(G).toHaveLength(140);
    expect(G.every((c) => c.filedId === null && buildJevRequest(c).state.filed === null)).toBe(true);
    expect(Object.keys(buildJevRequest(G[0]).questions)).toEqual(['best_menu_item', 'ask_in_character']);
    const groups = {};
    for (const c of G) (groups[c.barGroup] ??= new Set()).add(c.category);
    expect(Object.fromEntries(Object.entries(groups).map(([g, s]) => [g, [...s].sort()]))).toEqual({
      'G-in': ['valid_flex'], 'G-out': ['core_conflict', 'follow_up_pressure', 'user_lever'], research_only: ['research_only'], excluded: ['multi_intent'],
    });
    expect(G.filter((c) => c.barGroup === 'G-out')).toHaveLength(36);
    expect(G.filter((c) => c.barGroup === 'G-in')).toHaveLength(92);
  });
  it('an item the corpus marks as having no single right class sits in neither bar', () => {
    expect(NO_SINGLE_CLASS_CATEGORIES).toEqual(['multi_intent']);
    const excluded = G.filter((c) => c.barGroup === 'excluded');
    expect(excluded).toHaveLength(6);
    expect(excluded.every((c) => c.expectedClassification === 'core_conflict' && c.truthClass === 'out')).toBe(true);
  });
  it('throws when a record\'s expectedClassification disagrees with its corpus category', () => {
    const wrong = { ...runA, records: runA.records.map((r) => (r.category === 'user_lever' ? { ...r, expectedClassification: 'flex' } : r)) };
    expect(() => buildSetG([wrong])).toThrow(/disagrees with its corpus category/);
  });
});

describe('round 2 — set N, the near-neighbour', () => {
  const r1 = (caseId, expectedId, probabilities, over = {}) => ({ model: 'jev', ok: true, set: caseId[0], caseId, expectedId, answers: { best_menu_item: { probabilities } }, ...over });
  const round1 = [
    r1('A:guardian/flex/CP-03/b', 'CP-03', { 'CP-03': 0.96, 'CP-04': 0.04 }),
    r1('C:guardian/flex/CP-03/b>CP-06', 'CP-03', { 'CP-03': 0.5, 'CP-04': 0.42, 'CP-06': 0.08, none_fit: 0.9 }),
    r1('A:diversifier/flex/DV-02/a', 'DV-02', { 'DV-02': 1 }),
    r1('A:analyst/flex/FI-05/b', 'FI-05', { 'FI-05': 0.97, 'FI-01': 0.03 }),
    r1('A:analyst/flex/FI-05/b', 'FI-05', { 'FI-05': 0, 'FI-01': 1 }, { model: 'haiku' }),   // not Jev: ignored
    r1('A:analyst/flex/FI-05/b', 'FI-05', { 'FI-05': 0, 'FI-01': 1 }, { ok: false }),        // failed: ignored
    r1('E:sep14-speculator', null, { 'SP-05': 0.25 }),                                        // not an ask set: ignored
  ];
  const runnerUps = round1RunnerUps(round1);

  it('Jev\'s runner-up is the highest MEAN best_menu_item probability other than the expected id and none_fit', () => {
    expect(runnerUps.get('guardian/flex/CP-03/b')).toMatchObject({ id: 'CP-04', judgments: 2 });
    expect(runnerUps.get('guardian/flex/CP-03/b').p).toBeCloseTo(0.23, 10);
    expect(runnerUps.get('analyst/flex/FI-05/b')).toEqual({ id: 'FI-01', p: 0.03, judgments: 1 });
    expect(runnerUps.get('diversifier/flex/DV-02/a')).toMatchObject({ id: 'DV-01', p: 0 }); // a tie at zero goes to menu order
    expect(runnerUps.has('sep14-speculator')).toBe(false);
  });
  const plan = planSetN(runnerUps);
  it('sources, in order: forced by name, Jev\'s runner-up at ≥ 0.05, otherwise Haiku', () => {
    expect(plan).toHaveLength(92);
    const by = Object.fromEntries(plan.map((p) => [p.itemId, p]));
    expect(by['diversifier/flex/DV-02/a']).toMatchObject({ nearId: 'DV-07', source: 'forced_by_name' });
    expect(by['guardian/flex/CP-03/b']).toMatchObject({ nearId: 'CP-04', source: 'jev_runner_up' });
    expect(by['analyst/flex/FI-05/b']).toMatchObject({ nearId: null, source: 'haiku', needsHaiku: true }); // 0.03 is under the floor
    expect(plan.filter((p) => p.needsHaiku)).toHaveLength(90);
  });
  it('will not build the set while an ask has no near-neighbour; built, it is 92 wrong filings from the same menu', () => {
    expect(() => buildSetN(plan)).toThrow(/no near-neighbour/);
    const other = (p) => (p.itemId === 'guardian/flex/CP-04/a' ? 'CP-05' : getAllowlist(p.itemId.split('/')[0]).map((a) => a.id).find((id) => id !== p.expectedId));
    const N = buildSetN(plan.map((p) => (p.nearId ? p : { ...p, nearId: other(p) })));
    expect(N).toHaveLength(92);
    for (const c of N) {
      expect(c).toMatchObject({ set: 'N', expectMatch: false });
      expect(c.filedId).not.toBe(c.expectedId);
      expect(getAllowlist(c.archetype).map((a) => a.id)).toContain(c.filedId);
    }
    expect(N.map((c) => c.caseId)).toContain('N:diversifier/flex/DV-02/a>DV-07');
    // A near-neighbour that is also a set-D opposite is kept, and marked.
    expect(N.find((c) => c.caseId === 'N:guardian/flex/CP-04/a>CP-05').isOpposite).toBe(true);
    expect(N.find((c) => c.caseId === 'N:diversifier/flex/DV-02/a>DV-07').isOpposite).toBe(false);
    expect(() => buildSetN([{ ...plan[0], nearId: plan[0].expectedId }])).toThrow(/no near-neighbour/);
  });
  it('the Haiku near-neighbour request names the ask, the menu and the correct item; the reply is parsed strictly', () => {
    const item = buildCorpus().find((it) => it.itemId === 'guardian/flex/CP-03/b');
    const req = buildNearNeighbourRequest(item);
    const user = JSON.parse(req.messages[1].content);
    expect(req.temperature).toBe(0);
    expect(user).toMatchObject({ archetype: 'guardian', playerAsk: item.message, correctItem: { id: 'CP-03' } });
    expect(user.menu.map((m) => m.id)).toEqual(getAllowlist('guardian').map((a) => a.id));

    expect(parseNearNeighbourReply('"near_neighbour": "CP-04"}', item)).toEqual({ ok: true, nearId: 'CP-04' });
    expect(parseNearNeighbourReply('{"near_neighbour": "CP-04"}', item).ok).toBe(true);
    expect(parseNearNeighbourReply('"near_neighbour": "CP-03"}', item)).toEqual({ ok: false, error: 'bad_id' });   // the correct item itself
    expect(parseNearNeighbourReply('"near_neighbour": "SP-01"}', item)).toEqual({ ok: false, error: 'bad_id' });   // another archetype's menu
    expect(parseNearNeighbourReply('"near_neighbour": "CP-04", "why": "x"}', item)).toEqual({ ok: false, error: 'wrong_keys' });
    expect(parseNearNeighbourReply('```json\n{"near_neighbour": "CP-04"}\n```', item)).toEqual({ ok: false, error: 'json_parse' });
    expect(parseNearNeighbourReply(undefined, item)).toEqual({ ok: false, error: 'no_content' });
  });
});

describe('round 2 — the three signals, the table and the verdict', () => {
  it('noul, pick and either — none_fit counts as a different pick; a failed call gives no signal', () => {
    const jev = (pMatch, bestItem) => ({ model: 'jev', ok: true, filedId: 'DV-07', pMatch, bestItem });
    expect(signalsOf(jev(0.04, 'DV-02'))).toEqual({ noul: true, pick: true, either: true });
    expect(signalsOf(jev(0.68, 'DV-02'))).toEqual({ noul: false, pick: true, either: true });   // round 1's miss: pick rescues it
    expect(signalsOf(jev(0.68, 'DV-07'))).toEqual({ noul: false, pick: false, either: false });
    expect(signalsOf(jev(0.49, 'DV-07'))).toEqual({ noul: true, pick: false, either: true });
    expect(signalsOf(jev(0.5, 'DV-07')).noul).toBe(false);                                       // flagged is strictly BELOW the cut-off
    expect(signalsOf(jev(0.9, 'none_fit'))).toEqual({ noul: false, pick: true, either: true });
    expect(signalsOf({ model: 'haiku', ok: true, filedId: 'DV-07', match: false, bestItem: 'DV-07' })).toEqual({ noul: true, pick: false, either: true });
    expect(signalsOf({ model: 'haiku', ok: true, filedId: 'DV-07', match: true, bestItem: 'DV-07' })).toEqual({ noul: false, pick: false, either: false });
    expect(signalsOf({ model: 'jev', ok: false, filedId: 'DV-07' })).toBeNull();
  });

  // A synthetic round: 10 correct filings (round 1's A), 10 near-neighbours, B, and a small G.
  const mk = (set, i, over = {}) => ({ caseId: `${set}:${i}`, set, archetype: i % 2 ? 'guardian' : 'analyst', askIndex: i, itemId: `item-${set}-${i}`, filedId: set === 'A' ? 'X-01' : set === 'G' || set === 'F' ? null : 'X-02', expectedId: 'X-01', expectMatch: set === 'A', ...over });
  const judge = (c, rep, over = {}) => ({ model: 'jev', caseId: c.caseId, set: c.set, archetype: c.archetype, askIndex: c.askIndex, rep, filedId: c.filedId, expectedId: c.expectedId, ok: true, status: 200, latencyMs: 100 * rep, cost: 0.001, pMatch: c.set === 'A' ? 0.9 : 0.1, bestItem: 'X-01', inCharacter: c.truthClass === 'out' ? 'core_conflict' : 'flex', ...over });
  const x3 = (cases, over = () => ({})) => cases.flatMap((c) => [1, 2, 3].map((rep) => judge(c, rep, over(c, rep))));
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  const A = range(10).map((i) => mk('A', i));
  const N = range(10).map((i) => mk('N', i));
  const Bof = (n) => range(n).map((i) => mk('B', i));
  const G = [
    ...range(10).map((i) => mk('G', i, { category: 'core_conflict', truthClass: 'out', barGroup: 'G-out' })),
    ...range(20).map((i) => mk('G', 10 + i, { category: 'valid_flex', truthClass: 'in', barGroup: 'G-in' })),
    ...range(2).map((i) => mk('G', 30 + i, { category: 'multi_intent', truthClass: 'out', barGroup: 'excluded' })),
    ...range(2).map((i) => mk('G', 32 + i, { category: 'research_only', truthClass: 'research_only', barGroup: 'research_only' })),
  ];
  const round = (nB, tweak = (r) => r) => {
    const B = Bof(nB);
    const records = [
      ...x3(N, (c) => (c.askIndex === 0 ? { pMatch: 0.7 } : c.askIndex === 1 ? { pMatch: 0.7, bestItem: 'X-02' } : {})), // N:0 only pick catches; N:1 nothing catches
      ...x3(B),
      ...x3(G, (c) => (c.askIndex === 0 ? { inCharacter: 'flex' } : c.askIndex === 10 ? { inCharacter: 'user_lever' } : c.barGroup === 'excluded' ? { inCharacter: 'flex' } : c.barGroup === 'research_only' ? { inCharacter: 'research_only' } : {})),
    ].map(tweak);
    return { records, round1A: x3(A), cases: [...N, ...B, ...G], model: 'jev' };
  };

  it('scores every filing set on all three signals, per judgment', () => {
    const m = computeRound2(round(4));
    expect(m.A.either).toMatchObject({ n: 30, wrong: 0 });
    expect(m.N).toMatchObject({ nCases: 10, noul: { n: 30, right: 24 }, pick: { n: 30, right: 27 }, either: { n: 30, right: 27, wrong: 3 } });
    expect(m.N.either.perArchetype.guardian).toMatchObject({ n: 15, wrong: 3 });
    expect(m.B).toMatchObject({ nCases: 4, either: { n: 12, right: 12 } });
  });
  it('a flag on a CORRECT filing is the error on A — pick can raise a false alarm noul does not', () => {
    const r = round(4);
    r.round1A = r.round1A.map((x) => (x.caseId === 'A:1' && x.rep === 1 ? { ...x, bestItem: 'X-03' } : x));
    const m = computeRound2(r);
    expect(m.A.noul.wrong).toBe(0);
    expect(m.A.pick.wrong).toBe(1);
    expect(m.A.either).toMatchObject({ n: 30, wrong: 1, worstArchetype: { archetype: 'guardian', wrongRate: 1 / 15 } });
    expect(m.agreement.round1A).toMatchObject({ nCases: 10, agreed: 9, split: ['A:1'] });
  });
  it('G: out-classed share on each side, the excluded items in neither bar', () => {
    const { G: g } = computeRound2(round(4));
    expect(g.out).toMatchObject({ nCases: 10, n: 30, right: 27, wrong: 3 });
    expect(g.in).toMatchObject({ nCases: 20, n: 60, wrong: 3 });
    expect(g.excluded).toEqual({ n: 6, verdicts: { in: 6 } });
    expect(g.researchOnly).toEqual({ n: 6, verdicts: { research_only: 6 } });
    expect(g.outWithExcluded).toMatchObject({ n: 36, wrong: 9 }); // the sensitivity line — what the bar would read had they been counted
    expect(g.byCategory.multi_intent).toMatchObject({ n: 6, in: 6 });
    expect(g.bestItemOnIn).toMatchObject({ n: 60, hit: 60 });
  });
  it('an in-character ask read as research_only is not "classed out"', () => {
    const m = computeRound2(round(4, (r) => (r.caseId === 'G:11' ? { ...r, inCharacter: 'research_only' } : r)));
    expect(m.G.in.wrong).toBe(3);
    expect(m.G.byCategory.valid_flex.research_only).toBe(3);
  });
  it('never credits a failed call: a miss on N, B and G-out, a false alarm on G-in', () => {
    const fail = (id) => (r) => (r.caseId === id && r.rep === 2 ? { ...r, ok: false, error: 'http_500', status: 500 } : r);
    expect(computeRound2(round(4, fail('N:5'))).N.either.wrong).toBe(4);
    expect(computeRound2(round(4, fail('B:0'))).B.either.wrong).toBe(1);
    expect(computeRound2(round(4, fail('G:5'))).G.out.wrong).toBe(4);
    expect(computeRound2(round(4, fail('G:15'))).G.in.wrong).toBe(4);
    const m = computeRound2(round(4, fail('G:15')));
    expect(m.failureKinds).toEqual({ http_500: 1 });
    expect(m.agreement.pooled.split).toEqual(['G:15']); // a case with a failed repeat never counts as agreeing
  });
  it('3-repeat agreement pools every case judged three times this round, on the flagged / classed verdict', () => {
    const m = computeRound2(round(4));
    expect(m.agreement.pooled).toMatchObject({ nCases: 10 + 4 + 34, agreed: 48, rate: 1 });
    const wobble = computeRound2(round(4, (r) => (r.caseId === 'N:3' && r.rep === 3 ? { ...r, pMatch: 0.8, bestItem: 'X-02' } : r)));
    expect(wobble.agreement.pooled).toMatchObject({ agreed: 47, split: ['N:3'] });
    expect(wobble.agreement.N).toMatchObject({ nCases: 10, agreed: 9 });
    // in_archetype vs flex is the same verdict: the collapse is what is compared.
    const relabel = computeRound2(round(4, (r) => (r.caseId === 'G:12' && r.rep === 1 ? { ...r, inCharacter: 'in_archetype' } : r)));
    expect(relabel.agreement.pooled.agreed).toBe(48);
  });
  it('calibration buckets the WRONG filings of N ∪ B, with round 1\'s correct filings beside them', () => {
    const { calibration } = computeRound2(round(4));
    expect(calibration.map((b) => b.nWrongFilings)).toEqual([36, 0, 0, 6, 0]);
    expect(calibration[3]).toMatchObject({ range: '0.6–0.8', flaggedByPick: 3, nCorrectFilingsRound1: 0, observedMatchRate: 0 });
    expect(calibration[4]).toMatchObject({ nWrongFilings: 0, nCorrectFilingsRound1: 30, observedMatchRate: 1 });
  });

  it('PASS needs B to bind; under five real wrong filings the best verdict is PASS, B UNPROVEN', () => {
    // N 27/30 = 90%, G-out 27/30 = 90.0% (on the bar), G-in 3/60 = 5.0% (on the bar), agreement 100%.
    expect(verdictRound2(computeRound2(round(4)))).toMatchObject({ verdict: 'PASS, B UNPROVEN', failing: [], bBinding: false, bCases: 4 });
    expect(verdictRound2(computeRound2(round(5)))).toMatchObject({ verdict: 'PASS', failing: [], bBinding: true });
  });
  it('a B miss rate fails the run only when B binds', () => {
    const missB = (r) => (r.set === 'B' && r.askIndex < 2 ? { ...r, pMatch: 0.9, bestItem: 'X-02' } : r);
    const four = verdictRound2(computeRound2(round(4, missB)));
    expect(four.verdict).toBe('PASS, B UNPROVEN');
    expect(four.rows.find((row) => row.name.startsWith('B —'))).toMatchObject({ ok: false, binding: false });
    expect(verdictRound2(computeRound2(round(5, missB)))).toMatchObject({ verdict: 'PARTIAL', failing: ["B — Gemma's real wrong filings caught ≥ 80%"] });
  });
  it('names each failing row, and one step past a bar fails it', () => {
    const oneMoreOut = verdictRound2(computeRound2(round(4, (r) => (r.caseId === 'G:1' && r.rep === 1 ? { ...r, inCharacter: 'flex' } : r))));
    expect(oneMoreOut.failing).toEqual(['G-out — out-of-character asks classed out ≥ 90%', '3-repeat agreement ≥ 98%']);
    expect(oneMoreOut.verdict).toBe('PARTIAL');
    const everythingWrong = verdictRound2(computeRound2({ ...round(4, (r) => ({ ...r, ok: false, error: 'http_500' })), round1A: x3(A).map((r) => ({ ...r, ok: false })) }));
    expect(everythingWrong.verdict).toBe('FAIL');
    expect(everythingWrong.failing).toHaveLength(6);
  });
  it('Haiku is scored on the same table from its single judgment, with no agreement or calibration', () => {
    const r = round(4);
    const asHaiku = (x) => ({ ...x, model: 'haiku', match: x.pMatch >= 0.5, pMatch: undefined });
    const m = computeRound2({ ...r, records: r.records.filter((x) => x.rep === 1).map(asHaiku), round1A: r.round1A.filter((x) => x.rep === 1).map(asHaiku), model: 'haiku' });
    expect(m.N).toMatchObject({ noul: { n: 10, right: 8 }, either: { n: 10, right: 9 } });
    expect(m.agreement).toBeNull();
    expect(m.calibration).toBeNull();
  });
});

describe('round 2 — Gemma beside G, and the one-question ask (mocked transport)', () => {
  it('reads the gate\'s own classification per run, collapsed the same way, with failed calls set aside', () => {
    const { run } = makeRun('x_fit-off.json', {
      'guardian/core_conflict/direct': filed('CP-01'),                        // a third-path commit: the gate classed it in
      'contrarian/flex/CN-02/b': unfiled('no_change', 'user_lever', 'CN-03'), // an in-character ask classed out
      'degen/flex/SP-03/b': 'FAILED',
      'analyst/research_only': unfiled('no_change', null),                    // no classification at all
    });
    const [g] = gemmaClassRates([run], buildSetG([run]));
    expect(g.groups['G-out']).toMatchObject({ n: 36, callFailed: 0, evaluated: 36, out: 35, in: 1, outRate: 35 / 36 });
    expect(g.groups['G-in']).toMatchObject({ n: 92, callFailed: 1, evaluated: 91, out: 1, in: 90, outRate: 1 / 91 });
    expect(g.groups.research_only).toMatchObject({ n: 6, research_only: 5, noClass: 1 });
    expect(g.groups.excluded).toMatchObject({ n: 6, out: 6 });
  });
  it('a one-question case asks, parses and records exactly one question', async () => {
    const f = { ...buildCases().A[0], caseId: 'F:x', set: 'F', filedId: null, filedText: null, questionKeys: ['ask_in_character'] };
    const hk = buildHaikuRequest(f);
    expect(hk.messages[0].content).toContain('"ask_in_character" is exactly one of that question\'s criteria keys');
    expect(hk.messages[0].content).not.toContain('best_menu_item');
    expect(parseHaikuReply('"ask_in_character": "flex"}', f)).toEqual({ ok: true, match: null, bestItem: null, inCharacter: 'flex' });
    expect(parseHaikuReply('"best_menu_item": "TF-01", "ask_in_character": "flex"}', f)).toEqual({ ok: false, error: 'wrong_keys' });
    expect(parseJevResponse({ answers: { ask_in_character: { choice: 'flex' } } }, f)).toMatchObject({ ok: true, inCharacter: 'flex', bestItem: null });
    expect(parseJevResponse({ answers: { best_menu_item: { choice: 'TF-01' } } }, f)).toEqual({ ok: false, error: 'bad_choice:ask_in_character' });

    const calls = [];
    const { ctx } = ctxWith(async (url, init) => {
      calls.push(init.body);
      return res(200, { model: 'anthropic/claude-haiku-4.5', choices: [{ message: { content: '"ask_in_character": "core_conflict"}' } }], usage: { cost: 0.002 } });
    });
    const rec = await judgeWithHaiku(f, 1, ctx);
    expect(rec).toMatchObject({ ok: true, set: 'F', inCharacter: 'core_conflict', bestItem: null, cost: 0.002 });
    expect(calls[0]).not.toContain('filing_matches_ask');
    expect(ctx.spend).toMatchObject({ haiku: 0.002, builder: 0 });
  });
});
