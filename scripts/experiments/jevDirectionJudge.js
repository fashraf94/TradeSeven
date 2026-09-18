#!/usr/bin/env node
// scripts/experiments/jevDirectionJudge.js
//
// MEASUREMENT — Jev (typesafe/jev-1.13, OpenRouter Decisions alpha) as a
// DIRECTIVE DIRECTION JUDGE: given the archetype's charter, its menu, the
// player's ask and the adjustment that was filed, does the filing carry out the
// ask? Haiku answers the same three questions once as the yardstick.
//
// This is an experiment, not product code. It writes nothing to Firestore, calls
// no production route, flips no flag, and imports only two zero-import data
// modules. Adoption is a separate spec; this script only measures.
//
// Usage (mirrors api/scripts/voice-grounding-harness.js's `--env-file` idiom):
//   node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --dry-run
//   node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --probe
//   node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --run [--resume]
//
//   --dry-run        build the case sets, print the counts, call nothing
//   --probe          ONE Jev call (the Sep 14 case), raw request + response saved
//   --run            the full run: every case x3 on Jev, x1 on Haiku
//   --resume         skip (model, case, repeat) triples already in records.jsonl
//   --records PATH   per-case harness records (the evalItem shape in
//                    api/scripts/archetype-integrity-eval/runEval.eval.mjs:163-183)
//                    — builds sets B and F. The harness does not persist these
//                    today (it writes aggregates only, :290-293), so without
//                    this flag B and F are empty and the report says so.
//   --out DIR        raw output dir (default scripts/output/jev-direction-judge,
//                    gitignored by .gitignore:45)
//
// Raw per-case output stays in the gitignored dir; the committed report carries
// aggregates and case ids only. The key is read from the environment and is
// never logged, never written, never placed in a record.

import { mkdirSync, appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Both imports are zero-import, Node-clean data modules (verified at cut):
// the charter zones + menu + cautious register + adjudicated conflict groups,
// and the labelled eval corpus. Nothing fenced is imported, here or transitively.
import {
  getAllowlist, getArchetypeZones, getCautiousRegister, getConflictGroups, getCanonicalText,
} from '../../src/data/archetypeAdjustments.js';
import { buildCorpus } from '../../api/scripts/archetype-integrity-eval/corpus.js';

// ─── Constants copied as strings, each with its source ──────────────────────

// The alpha path may move — it lives here and nowhere else.
// OpenRouter OpenAPI (fetched 2026-09-18): paths['/api/alpha/decisions'].post
export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
// api/_utils/gemmaClient.js:38
export const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const JEV_MODEL = 'typesafe/jev-1.13';
// The Voice Layer's OpenRouter key: api/_utils/gemmaClient.js:119
//   'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
export const OPENROUTER_KEY_ENV = 'OPENROUTER_API_KEY';
// The Trading Brain's Haiku: api/agent/decide.js:522 (`model: 'claude-haiku-4-5-20251001'`;
// §1-fenced — the string is copied, nothing is imported) and
// api/_utils/agentEvalTransport.js:48 (EVAL_MODEL_ID).
export const TRADING_BRAIN_HAIKU_ID = 'claude-haiku-4-5-20251001';
// The Trading Brain calls Anthropic directly (decide.js:91, CLAUDE_API_KEY). This
// experiment has ONE key and ONE spend source (OpenRouter `usage.cost`), so the
// yardstick goes through OpenRouter, whose public model list maps this slug to
// canonical `anthropic/claude-4.5-haiku-20251001` — the same 20251001 snapshot.
export const HAIKU_OPENROUTER_SLUG = 'anthropic/claude-haiku-4.5';

// The gate's own class labels: api/_utils/directiveGate.js:75
//   VALID_CLASSIFICATIONS = new Set(['in_archetype','flex','core_conflict','user_lever','research_only'])
// Descriptions quote the shipped prompt's own words for each class
// (api/_utils/voiceLayerPrompt.js:101 and :109). No taxonomy is authored here.
export const GATE_CLASS_LABELS = Object.freeze({
  in_archetype: 'The ask is in-character for this archetype.',
  flex: 'The ask is tunable at the margin without reversing the immutable core.',
  core_conflict: "The ask would REVERSE the archetype's immutable core.",
  user_lever: "The ask is a user lever the agent doesn't pull itself (short / flip / claim).",
  research_only: 'A pure research/opinion question; no adjustment is being asked for.',
});
// "Out of character" for set E: the two labels under which the ask is not the
// agent's to carry out. `research_only` is a null-write class too
// (directiveGate.js:76) but says nothing about character, so it is excluded.
export const OUT_OF_CHARACTER = Object.freeze(['core_conflict', 'user_lever']);

// SET E — the Sep 14 Speculator case, verbatim from committed docs on main.
//   playerAsk   docs/audits/20260915_PHASE0_DIRECTIVE_GATE.md:77
//   filed id    docs/audits/20260915_PHASE0_DIRECTIVE_GATE.md:82 (SP-05), text :43
//   agentReply  the Phase 0 doc quotes it only in fragments (:110, :112); the
//               joined sentence is docs/audits/20260916_BUILD_DIRECTIVE_FIT_CHECK.md:30.
//               Kept for the report — the wire shape's `state` has no reply field.
export const SEP14_CASE = Object.freeze({
  archetype: 'degen',
  playerAsk: 'Swap Core for Support (Full Defense)',
  filedId: 'SP-05',
  filedText: 'Spread across more names (diversify the chaos)',
  agentReply: "that's the lean I'm carrying now — trading Core momentum for a heavy Support floor",
});

export const SEED = 20260918;
export const REPEATS = 3;
export const CONCURRENCY = 4;
export const SPEND_CAP_USD = 5;
export const MAX_429_RETRIES = 6;
export const MAX_CONSECUTIVE_5XX = 3;
export const CALL_TIMEOUT_MS = 60000;
// Haiku is asked for JSON only; the assistant turn is prefilled with `{` so the
// reply can only continue a JSON object. Parsing stays strict either way.
export const HAIKU_PREFILL = '{';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(HERE, '..', 'output', 'jev-direction-judge');

// ─── Case sets ──────────────────────────────────────────────────────────────

// mulberry32 — small seeded PRNG so set C is reproducible from SEED alone.
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The ids on the other end of a dial from `id`, per the ADJUDICATED conflict
// groups — the same read voiceLayerPrompt.js:2773-2779 renders as `[opposite of …]`.
export function oppositesOf(codeId, id) {
  const out = [];
  for (const group of getConflictGroups(codeId)) {
    const ids = group.members.map((m) => m.id);
    if (!ids.includes(id)) continue;
    for (const other of ids) if (other !== id) out.push({ id: other, dial: group.dimension });
  }
  return out;
}

export function buildMenu(codeId) {
  const cautious = getCautiousRegister(codeId);
  return getAllowlist(codeId).map((a) => {
    const opp = oppositesOf(codeId, a.id);
    return {
      id: a.id,
      text: a.canonical,
      cautiousRegister: cautious.includes(a.id),
      dial: opp.length ? opp[0].dial : null,
      oppositeOf: opp.map((o) => o.id),
    };
  });
}

// One menu line as a plain string: canonical text + the dial annotations.
export function menuLine(entry) {
  const tags = [];
  if (entry.cautiousRegister) tags.push('[cautious register]');
  if (entry.dial) tags.push(`[dial: ${entry.dial}; opposite of ${entry.oppositeOf.join(', ')}]`);
  return tags.length ? `${entry.text} — ${tags.join(' ')}` : entry.text;
}

function mkCase(set, item, askIndex, filedId, expectMatch, suffix = '') {
  return {
    caseId: `${set}:${item.itemId}${suffix}`,
    set, archetype: item.archetype, askIndex, itemId: item.itemId,
    playerAsk: item.message,
    filedId, filedText: filedId ? getCanonicalText(item.archetype, filedId) : null,
    expectedId: item.expectedAdjustmentId, expectMatch,
  };
}

/**
 * Build the six case sets. No asks are authored here: A/C/D come from the
 * harness corpus's labelled `valid_flex` items, E from the committed Phase 0 doc.
 *
 * A is every labelled ask paired with its EXPECTED id. The spec defines A as
 * "cases where the filed id equals the expected id"; the harness persists no
 * per-case filings, and the gate can only ever file an id's canonical text, so
 * (ask, expected id, canonical text) IS that pair for every case Gemma got
 * right — plus the handful it refused, where the label is still ground truth.
 *
 * `askIndex` is the ask's position among the flex items. C and D inherit it from
 * their source ask, so the odd/even threshold split never puts one ask on both sides.
 */
export function buildCases({ records = null, seed = SEED } = {}) {
  const flex = buildCorpus().filter((it) => it.category === 'valid_flex');
  const rng = makeRng(seed);
  const sets = { A: [], B: [], C: [], D: [], E: [], F: [] };

  flex.forEach((item, askIndex) => {
    sets.A.push(mkCase('A', item, askIndex, item.expectedAdjustmentId, true));

    const others = getAllowlist(item.archetype).map((a) => a.id).filter((id) => id !== item.expectedAdjustmentId);
    const wrongId = others[Math.floor(rng() * others.length)];
    sets.C.push(mkCase('C', item, askIndex, wrongId, false, `>${wrongId}`));

    for (const opp of oppositesOf(item.archetype, item.expectedAdjustmentId)) {
      sets.D.push(mkCase('D', item, askIndex, opp.id, false, `>${opp.id}`));
    }
  });

  sets.E.push({
    caseId: 'E:sep14-speculator', set: 'E', archetype: SEP14_CASE.archetype, askIndex: 0, itemId: null,
    playerAsk: SEP14_CASE.playerAsk, filedId: SEP14_CASE.filedId, filedText: SEP14_CASE.filedText,
    expectedId: null, expectMatch: false,
  });

  if (Array.isArray(records)) {
    const byItem = new Map(flex.map((item, i) => [item.itemId, { item, i }]));
    for (const r of records) {
      const hit = byItem.get(r.itemId);
      if (!hit || r.callFailed) continue;
      const run = r.runIndex ? `#${r.runIndex}` : '';
      if (r.committed && r.selectedId && r.selectedId !== hit.item.expectedAdjustmentId) {
        sets.B.push(mkCase('B', hit.item, hit.i, r.selectedId, false, `>${r.selectedId}${run}`));
      } else if (!r.committed && r.archetypeGate?.status !== 'fit_mismatch') {
        sets.F.push(mkCase('F', hit.item, hit.i, null, null, run));
      }
    }
  }
  return sets;
}

// ─── Requests ───────────────────────────────────────────────────────────────

export function buildState(c) {
  return {
    archetype: c.archetype,
    charter: { ...getArchetypeZones(c.archetype), cautiousRegister: getCautiousRegister(c.archetype) },
    menu: buildMenu(c.archetype),
    playerAsk: c.playerAsk,
    filed: c.filedId ? { id: c.filedId, text: c.filedText } : null,
  };
}

export function buildQuestions(c) {
  const menuCriteria = {};
  for (const entry of buildMenu(c.archetype)) menuCriteria[entry.id] = menuLine(entry);
  menuCriteria.none_fit = "No item on this menu carries out the ask.";

  const questions = {
    best_menu_item: {
      type: 'choice',
      instructions: "Which single menu item best carries out the player's ask?",
      criteria: menuCriteria,
    },
    ask_in_character: {
      type: 'choice',
      instructions: "Against this archetype's charter, where does the player's ask sit?",
      criteria: { ...GATE_CLASS_LABELS },
    },
  };
  // Set F (a refusal) has no filing to judge.
  if (!c.filedId) return questions;
  return {
    filing_matches_ask: {
      type: 'noul',
      instructions: 'Does the filed adjustment carry out what the player asked for?',
      criteria: {
        true: 'Same dial, same direction, same intent.',
        false: 'Different dial, opposite direction, or a different intent.',
      },
    },
    ...questions,
  };
}

export function buildJevRequest(c, { denyDataCollection = false } = {}) {
  const body = { model: JEV_MODEL, state: buildState(c), questions: buildQuestions(c) };
  if (denyDataCollection) body.provider = { data_collection: 'deny' };
  return body;
}

export function buildHaikuRequest(c) {
  const questions = buildQuestions(c);
  const keys = Object.keys(questions);
  const system = [
    'You are a strict judge of trading-agent directive filings. You are given a STATE and QUESTIONS.',
    'Reply with ONE JSON object and nothing else — no markdown, no code fence, no commentary.',
    `It has exactly these keys: ${keys.map((k) => `"${k}"`).join(', ')}.`,
    keys.includes('filing_matches_ask') ? '"filing_matches_ask" is a JSON boolean (true or false), judged by that question\'s criteria.' : '',
    '"best_menu_item" and "ask_in_character" are each exactly one of that question\'s criteria keys, as a string.',
  ].filter(Boolean).join('\n');
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ state: buildState(c), questions }, null, 1) },
  ];
  if (HAIKU_PREFILL) messages.push({ role: 'assistant', content: HAIKU_PREFILL });
  return { model: HAIKU_OPENROUTER_SLUG, temperature: 0, max_tokens: 200, usage: { include: true }, messages };
}

// ─── Parsing ────────────────────────────────────────────────────────────────

const isProb = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

export function parseJevResponse(json, c) {
  const a = json?.answers;
  if (!a || typeof a !== 'object') return { ok: false, error: 'no_answers' };
  const out = { ok: true, returnedModel: json.model ?? null, cost: typeof json.usage?.cost === 'number' ? json.usage.cost : null };
  if (c.filedId) {
    if (!isProb(a.filing_matches_ask?.noul)) return { ok: false, error: 'bad_noul' };
    out.pMatch = a.filing_matches_ask.noul;
  }
  for (const key of ['best_menu_item', 'ask_in_character']) {
    if (typeof a[key]?.choice !== 'string') return { ok: false, error: `bad_choice:${key}` };
  }
  out.bestItem = a.best_menu_item.choice;
  out.bestItemConfidence = a.best_menu_item.confidence ?? null;
  out.inCharacter = a.ask_in_character.choice;
  out.inCharacterConfidence = a.ask_in_character.confidence ?? null;
  return out;
}

// STRICT. One JSON object, exactly the asked keys, each value in its allowed
// set. Anything else — a code fence, a stray sentence, an extra key, an id not
// on the menu — is a failure, recorded as one and never repaired.
export function parseHaikuReply(content, c) {
  if (typeof content !== 'string') return { ok: false, error: 'no_content' };
  const text = (HAIKU_PREFILL && !content.trimStart().startsWith(HAIKU_PREFILL) ? HAIKU_PREFILL + content : content).trim();
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: 'json_parse' }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'not_object' };
  const questions = buildQuestions(c);
  const want = Object.keys(questions).sort();
  if (JSON.stringify(Object.keys(obj).sort()) !== JSON.stringify(want)) return { ok: false, error: 'wrong_keys' };
  if (c.filedId && typeof obj.filing_matches_ask !== 'boolean') return { ok: false, error: 'bad_boolean' };
  for (const key of ['best_menu_item', 'ask_in_character']) {
    if (typeof obj[key] !== 'string' || !(obj[key] in questions[key].criteria)) return { ok: false, error: `bad_choice:${key}` };
  }
  return { ok: true, match: c.filedId ? obj.filing_matches_ask : null, bestItem: obj.best_menu_item, inCharacter: obj.ask_in_character };
}

// ─── Transport ──────────────────────────────────────────────────────────────

export class AbortRun extends Error {}

export function makeContext({ apiKey, fetchImpl = globalThis.fetch, sleep, now = () => performance.now(), log = () => {} } = {}) {
  return {
    apiKey, fetchImpl, now, log,
    sleep: sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    spend: { jev: 0, haiku: 0, unknownCostCalls: 0 },
    consecutive5xx: 0, aborted: null,
  };
}

const totalSpend = (ctx) => ctx.spend.jev + ctx.spend.haiku;

/**
 * One POST under the run's policy: back off on 429 (Retry-After honoured), retry
 * a 5xx but abort the whole run at MAX_CONSECUTIVE_5XX in a row, never retry any
 * other 4xx. Latency is the successful attempt alone. The bearer key exists only
 * inside this function's header object.
 */
export async function postWithPolicy(url, body, ctx) {
  let tries429 = 0;
  for (;;) {
    if (ctx.aborted) throw new AbortRun(ctx.aborted);
    const started = ctx.now();
    let res;
    try {
      res = await ctx.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(CALL_TIMEOUT_MS) : undefined,
      });
    } catch (err) {
      return { ok: false, status: 0, error: `transport:${err?.name || 'Error'}`, latencyMs: ctx.now() - started };
    }
    const latencyMs = ctx.now() - started;

    if (res.status === 429) {
      tries429 += 1;
      if (tries429 > MAX_429_RETRIES) return { ok: false, status: 429, error: 'rate_limited', latencyMs };
      const retryAfter = Number(res.headers?.get?.('retry-after'));
      await ctx.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60000, 1000 * 2 ** tries429));
      continue;
    }
    if (res.status >= 500) {
      ctx.consecutive5xx += 1;
      if (ctx.consecutive5xx >= MAX_CONSECUTIVE_5XX) {
        ctx.aborted = `${MAX_CONSECUTIVE_5XX} consecutive 5xx (last: ${res.status})`;
        throw new AbortRun(ctx.aborted);
      }
      await ctx.sleep(1500 * ctx.consecutive5xx);
      continue;
    }
    ctx.consecutive5xx = 0;
    const raw = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: `http_${res.status}`, raw, latencyMs };
    try { return { ok: true, status: res.status, json: JSON.parse(raw), raw, latencyMs }; } catch { return { ok: false, status: res.status, error: 'response_json_parse', raw, latencyMs }; }
  }
}

// Marks the run aborted rather than throwing, so the judgment that crossed the
// cap is still recorded; the pool stops claiming work and queued POSTs refuse.
function charge(ctx, model, cost) {
  if (typeof cost === 'number') ctx.spend[model] += cost; else ctx.spend.unknownCostCalls += 1;
  if (totalSpend(ctx) >= SPEND_CAP_USD) ctx.aborted = `spend cap $${SPEND_CAP_USD} reached`;
}

const baseRecord = (model, c, rep) => ({
  model, caseId: c.caseId, set: c.set, archetype: c.archetype, askIndex: c.askIndex, rep,
  filedId: c.filedId, expectedId: c.expectedId, expectMatch: c.expectMatch,
});

export async function judgeWithJev(c, rep, ctx, opts) {
  const res = await postWithPolicy(DECISIONS_URL, buildJevRequest(c, opts), ctx);
  const rec = { ...baseRecord('jev', c, rep), latencyMs: res.latencyMs, status: res.status };
  if (!res.ok) return { ...rec, ok: false, error: res.error, raw: res.raw ?? null };
  const parsed = parseJevResponse(res.json, c);
  const out = { ...rec, ...parsed, answers: res.json.answers ?? null };
  charge(ctx, 'jev', parsed.ok ? parsed.cost : res.json?.usage?.cost);
  return out;
}

export async function judgeWithHaiku(c, rep, ctx) {
  const res = await postWithPolicy(CHAT_URL, buildHaikuRequest(c), ctx);
  const rec = { ...baseRecord('haiku', c, rep), latencyMs: res.latencyMs, status: res.status };
  if (!res.ok) return { ...rec, ok: false, error: res.error, raw: res.raw ?? null };
  const content = res.json?.choices?.[0]?.message?.content;
  const cost = typeof res.json?.usage?.cost === 'number' ? res.json.usage.cost : null;
  const out = { ...rec, ...parseHaikuReply(content, c), returnedModel: res.json?.model ?? null, cost, content: content ?? null };
  charge(ctx, 'haiku', cost);
  return out;
}

// Bounded pool; stops claiming work the moment the run aborts.
export async function mapPool(jobs, limit, fn, ctx) {
  let next = 0;
  async function worker() {
    while (!ctx.aborted) {
      const i = next++;
      if (i >= jobs.length) return;
      try { await fn(jobs[i], i); } catch (err) {
        if (err instanceof AbortRun) return;
        throw err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
}

// ─── Metrics (pure) ─────────────────────────────────────────────────────────

const rate = (num, den) => (den ? num / den : null);
const isOdd = (r) => r.askIndex % 2 === 1;
const isEven = (r) => r.askIndex % 2 === 0;

/**
 * The cut-off is chosen on ODD-indexed asks only. It maximises
 * min(A passed, C∪D caught); ties go to the value nearest 0.5. A filing is
 * FLAGGED when its probability is below the cut-off.
 */
export function chooseCutoff(jevRecords) {
  const tune = jevRecords.filter((r) => r.ok && isOdd(r) && ['A', 'C', 'D'].includes(r.set));
  const pos = tune.filter((r) => r.set === 'A');
  const neg = tune.filter((r) => r.set !== 'A');
  if (!pos.length || !neg.length) return { cutoff: 0.5, score: null, nTune: tune.length };
  let best = { cutoff: 0.5, score: -1 };
  for (let i = 1; i < 100; i++) {
    const t = i / 100;
    const score = Math.min(rate(pos.filter((r) => r.pMatch >= t).length, pos.length), rate(neg.filter((r) => r.pMatch < t).length, neg.length));
    if (score > best.score + 1e-12 || (Math.abs(score - best.score) <= 1e-12 && Math.abs(t - 0.5) < Math.abs(best.cutoff - 0.5))) best = { cutoff: t, score };
  }
  return { ...best, nTune: tune.length };
}

// Did this judgment flag the filing? A failed call or a failed parse is never
// credited: it counts as a false alarm on A and as a miss everywhere else.
export function flagged(r, cutoff) {
  if (!r.ok) return null;
  return r.model === 'jev' ? r.pMatch < cutoff : r.match === false;
}
const wrongOn = (r, cutoff) => {
  const f = flagged(r, cutoff);
  if (f === null) return true;
  return r.set === 'A' ? f : !f;
};

function bySetStats(recs, cutoff) {
  const n = recs.length;
  const wrong = recs.filter((r) => wrongOn(r, cutoff)).length;
  const perArchetype = {};
  for (const r of recs) {
    const a = (perArchetype[r.archetype] ??= { n: 0, wrong: 0 });
    a.n += 1;
    if (wrongOn(r, cutoff)) a.wrong += 1;
  }
  for (const a of Object.values(perArchetype)) a.wrongRate = rate(a.wrong, a.n);
  const worst = Object.entries(perArchetype).sort((x, y) => y[1].wrongRate - x[1].wrongRate)[0] ?? null;
  return { n, wrong, wrongRate: rate(wrong, n), perArchetype, worstArchetype: worst ? { archetype: worst[0], wrongRate: worst[1].wrongRate } : null };
}

export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

/** Every reported metric reads EVEN-indexed asks only (E's single case is index 0). */
export function computeMetrics(records, model, cutoff) {
  const mine = records.filter((r) => r.model === model);
  const even = mine.filter(isEven);
  const of = (set) => even.filter((r) => r.set === set);

  const A = bySetStats(of('A'), cutoff);
  const C = bySetStats(of('C'), cutoff);
  const D = bySetStats(of('D'), cutoff);
  const eRecs = mine.filter((r) => r.set === 'E');
  const E = {
    n: eRecs.length,
    flagged: eRecs.filter((r) => flagged(r, cutoff) === true).length,
    outOfCharacter: eRecs.filter((r) => r.ok && OUT_OF_CHARACTER.includes(r.inCharacter)).length,
    both: eRecs.filter((r) => flagged(r, cutoff) === true && OUT_OF_CHARACTER.includes(r.inCharacter)).length,
    pMatch: eRecs.map((r) => r.pMatch ?? null),
    inCharacter: eRecs.map((r) => r.inCharacter ?? null),
    bestItem: eRecs.map((r) => r.bestItem ?? null),
  };
  E.pass = E.n > 0 && E.both === E.n;

  // 3-repeat agreement: a case agrees when all its repeats succeeded and gave
  // the same flagged/not-flagged verdict. Choice agreement is reported beside it.
  const byCase = new Map();
  for (const r of [...even.filter((x) => ['A', 'C', 'D'].includes(x.set)), ...eRecs]) {
    if (!byCase.has(r.caseId)) byCase.set(r.caseId, []);
    byCase.get(r.caseId).push(r);
  }
  const multi = [...byCase.values()].filter((g) => g.length > 1);
  const same = (g, f) => g.every((r) => r.ok) && new Set(g.map(f)).size === 1;
  const agreement = {
    nCases: multi.length,
    verdict: rate(multi.filter((g) => same(g, (r) => flagged(r, cutoff))).length, multi.length),
    bestItem: rate(multi.filter((g) => same(g, (r) => r.bestItem)).length, multi.length),
    inCharacter: rate(multi.filter((g) => same(g, (r) => r.inCharacter)).length, multi.length),
  };

  // best_menu_item top-1 vs the expected id, on A (the filing there IS the
  // expected id) and on C∪D (where the filing shown is wrong). Even asks, plus
  // all asks on A so the denominator matches Gemma's 92-item figure.
  const top1 = (recs) => ({ n: recs.length, hit: recs.filter((r) => r.ok && r.bestItem === r.expectedId).length, rate: rate(recs.filter((r) => r.ok && r.bestItem === r.expectedId).length, recs.length) });
  const bestItem = {
    onA_even: top1(of('A')),
    onA_all: top1(mine.filter((r) => r.set === 'A')),
    onCD_even: top1([...of('C'), ...of('D')]),
  };

  // Calibration (Jev only has probabilities): five equal buckets, the observed
  // share of judgments in each whose filing truly matched.
  let calibration = null;
  if (model === 'jev') {
    const pool = [...of('A'), ...of('C'), ...of('D')].filter((r) => r.ok);
    const buckets = [0, 1, 2, 3, 4].map((i) => {
      const inB = pool.filter((r) => Math.min(4, Math.floor(r.pMatch * 5)) === i);
      return { range: `${(i * 0.2).toFixed(1)}–${((i + 1) * 0.2).toFixed(1)}`, n: inB.length, observedMatchRate: rate(inB.filter((r) => r.expectMatch).length, inB.length) };
    });
    const filled = buckets.filter((b) => b.n > 0).map((b) => b.observedMatchRate);
    calibration = { buckets, monotone: filled.every((v, i) => i === 0 || v >= filled[i - 1]) };
  }

  const okCalls = mine.filter((r) => r.ok);
  const lat = mine.filter((r) => r.status === 200).map((r) => r.latencyMs);
  const cost = mine.reduce((s, r) => s + (typeof r.cost === 'number' ? r.cost : 0), 0);
  return {
    model, cutoff: model === 'jev' ? cutoff : null,
    calls: mine.length, okCalls: okCalls.length, failures: mine.length - okCalls.length,
    failureKinds: mine.filter((r) => !r.ok).reduce((m, r) => ({ ...m, [r.error]: (m[r.error] || 0) + 1 }), {}),
    returnedModels: [...new Set(mine.map((r) => r.returnedModel).filter(Boolean))],
    A, C, D, E, agreement, bestItem, calibration,
    latencyMs: { p50: percentile(lat, 50), p95: percentile(lat, 95), n: lat.length },
    cost: { totalUsd: cost, per1000JudgmentsUsd: mine.length ? (cost / mine.length) * 1000 : null },
  };
}

// The frozen bars. PASS needs every row; the first failing row is named.
export function verdictFor(m) {
  const rows = [
    ['A false alarms overall ≤ 5%', m.A.n > 0 && m.A.wrongRate <= 0.05],
    ['A false alarms worst archetype ≤ 10%', !!m.A.worstArchetype && m.A.worstArchetype.wrongRate <= 0.10],
    ['C caught ≥ 95%', m.C.n > 0 && 1 - m.C.wrongRate >= 0.95],
    ['D caught ≥ 85%', m.D.n > 0 && 1 - m.D.wrongRate >= 0.85],
    ['E flagged + out of character', m.E.pass],
    ...(m.model === 'jev' ? [['3-repeat agreement ≥ 98%', m.agreement.verdict !== null && m.agreement.verdict >= 0.98]] : []),
  ];
  const failing = rows.filter(([, ok]) => !ok).map(([name]) => name);
  const passed = rows.length - failing.length;
  return { verdict: failing.length === 0 ? 'PASS' : passed === 0 ? 'FAIL' : 'PARTIAL', failing, rows: rows.map(([name, ok]) => ({ name, ok })) };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--probe') args.probe = true;
    else if (a === '--run') args.run = true;
    else if (a === '--resume') args.resume = true;
    else if (a === '--records') args.records = argv[++i];
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

const readJsonl = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const records = args.records ? JSON.parse(readFileSync(args.records, 'utf8')) : null;
  const sets = buildCases({ records: Array.isArray(records) ? records : records?.records ?? null });
  const counts = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length]));
  console.log(`[jev] case sets (seed ${SEED}):`, counts);
  if (args.dryRun || (!args.probe && !args.run)) return;

  const apiKey = process.env[OPENROUTER_KEY_ENV];
  if (!apiKey) {
    console.error(`[jev] ${OPENROUTER_KEY_ENV} is not set. Run with: node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --run`);
    process.exit(1);
  }
  mkdirSync(args.out, { recursive: true });
  const ctx = makeContext({ apiKey });

  if (args.probe) {
    const c = sets.E[0];
    const request = buildJevRequest(c);
    const res = await postWithPolicy(DECISIONS_URL, request, ctx);
    writeFileSync(path.join(args.out, 'probe.json'), JSON.stringify({ ts: new Date().toISOString(), url: DECISIONS_URL, request, status: res.status, latencyMs: res.latencyMs, responseRaw: res.raw ?? null, error: res.error ?? null }, null, 2));
    console.log(`[jev] probe HTTP ${res.status} in ${Math.round(res.latencyMs)}ms → ${path.join(args.out, 'probe.json')}`);
    const hk = await postWithPolicy(CHAT_URL, buildHaikuRequest(c), ctx);
    writeFileSync(path.join(args.out, 'probe-haiku.json'), JSON.stringify({ ts: new Date().toISOString(), url: CHAT_URL, request: buildHaikuRequest(c), status: hk.status, latencyMs: hk.latencyMs, responseRaw: hk.raw ?? null, error: hk.error ?? null }, null, 2));
    console.log(`[jev] haiku probe HTTP ${hk.status} in ${Math.round(hk.latencyMs)}ms`);
    return;
  }

  const recFile = path.join(args.out, 'records.jsonl');
  if (!args.resume) writeFileSync(recFile, '');
  const done = new Set(readJsonl(recFile).filter((r) => r.ok).map((r) => `${r.model}|${r.caseId}|${r.rep}`));

  const jobs = [];
  for (const set of ['E', 'A', 'C', 'D', 'B', 'F']) {
    for (const c of sets[set]) {
      for (let rep = 1; rep <= REPEATS; rep++) jobs.push({ model: 'jev', c, rep });
      if (['A', 'C', 'D', 'E'].includes(set)) jobs.push({ model: 'haiku', c, rep: 1 });
    }
  }
  const todo = jobs.filter((j) => !done.has(`${j.model}|${j.c.caseId}|${j.rep}`));
  console.log(`[jev] ${todo.length} calls to make (${jobs.length - todo.length} already recorded) · concurrency ${CONCURRENCY} · cap $${SPEND_CAP_USD}`);

  let finished = 0;
  await mapPool(todo, CONCURRENCY, async (job) => {
    const rec = job.model === 'jev' ? await judgeWithJev(job.c, job.rep, ctx) : await judgeWithHaiku(job.c, job.rep, ctx);
    appendFileSync(recFile, JSON.stringify(rec) + '\n');
    finished += 1;
    if (finished % 25 === 0 || finished === todo.length) console.log(`[jev] ${finished}/${todo.length} · spend $${totalSpend(ctx).toFixed(4)}`);
  }, ctx);
  if (ctx.aborted) console.error(`[jev] RUN ABORTED: ${ctx.aborted}`);

  // Keep the last record per (model, case, repeat) — a resumed retry supersedes a failure.
  const last = new Map();
  for (const r of readJsonl(recFile)) last.set(`${r.model}|${r.caseId}|${r.rep}`, r);
  const all = [...last.values()];
  const cut = chooseCutoff(all.filter((r) => r.model === 'jev'));
  const jev = computeMetrics(all, 'jev', cut.cutoff);
  const haiku = computeMetrics(all, 'haiku', cut.cutoff);
  const pick = (set) => all.filter((r) => r.set === set).map(({ caseId, model, rep, ok, pMatch, match, bestItem, inCharacter, error }) => ({ caseId, model, rep, ok, pMatch, match, bestItem, inCharacter, error }));
  const summary = {
    ts: new Date().toISOString(), seed: SEED, counts, aborted: ctx.aborted, cutoff: cut,
    spendUsd: { ...ctx.spend, total: totalSpend(ctx) },
    jev, haiku, verdict: { jev: verdictFor(jev), haiku: verdictFor(haiku) },
    setB: pick('B'), setF: pick('F'),
    misses: all.filter((r) => isEven(r) && ['A', 'C', 'D'].includes(r.set) && wrongOn(r, cut.cutoff)).map((r) => ({ caseId: r.caseId, model: r.model, rep: r.rep, pMatch: r.pMatch ?? null, match: r.match ?? null, error: r.error ?? null })),
  };
  writeFileSync(path.join(args.out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`[jev] cut-off ${cut.cutoff} (chosen on ${cut.nTune} odd-indexed judgments) · verdict Jev ${summary.verdict.jev.verdict} · Haiku ${summary.verdict.haiku.verdict}`);
  console.log(`[jev] summary → ${path.join(args.out, 'summary.json')}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => { console.error(`[jev] fatal: ${err?.message || err}`); process.exit(1); });
}
