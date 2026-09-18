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
} from './jevDirectionJudge.js';
import { getAllowlist } from '../../src/data/archetypeAdjustments.js';

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
