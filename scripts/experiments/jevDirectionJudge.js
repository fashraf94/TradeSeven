// scripts/experiments/jevDirectionJudge.js
//
// (No shebang line, on purpose: under `core.autocrlf=true` this file is checked
// out CRLF on Windows, and vitest cannot collect a CRLF module that opens with
// `#!` — "SyntaxError: Invalid or unexpected token". It is always run as
// `node … jevDirectionJudge.js`, so the line bought nothing.)
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
//   node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --round2 [--dry-run] [--resume]
//
//   --dry-run        build the case sets, print the counts, call nothing
//   --probe          ONE Jev call (the Sep 14 case), raw request + response saved
//   --run            the full run: every case x3 on Jev, x1 on Haiku
//   --resume         skip (model, case, repeat) triples already in records.jsonl
//   --records PATH   per-case harness records (the evalItem shape in
//                    api/scripts/archetype-integrity-eval/runEval.eval.mjs:163-183)
//                    — builds ROUND 1's sets B and F. Round 1 ran before the
//                    harness kept per-run records, so its B and F were empty.
//                    Round 2 (--round2) reads the run files instead.
//   --out DIR        raw output dir (default scripts/output/jev-direction-judge,
//                    gitignored by .gitignore:45; round 2 defaults to its
//                    `round2/` subfolder so round 1's raw files are never overwritten)
//   --round2         ROUND 2 — the hard cases: near-neighbour wrong filings (N),
//                    Gemma's real wrong filings (B) and false refusals (F) read
//                    from the harness run files, and the whole corpus as a
//                    classifier test with no filing in state (G). Set A is
//                    re-scored from round 1's saved records; no new A calls.
//   --runs-dir DIR   harness run files (default api/scripts/archetype-integrity-eval/runs)
//   --round1 DIR     round 1's raw output dir (default scripts/output/jev-direction-judge)
//
// Raw per-case output stays in the gitignored dir; the committed report carries
// aggregates and case ids only. The key is read from the environment and is
// never logged, never written, never placed in a record.

import { mkdirSync, appendFileSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
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
// Round 2 reads the harness's per-run record files (gitignored; README "What a run leaves on disk").
const DEFAULT_RUNS_DIR = path.resolve(HERE, '..', '..', 'api', 'scripts', 'archetype-integrity-eval', 'runs');

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
  const all = !c.filedId ? questions : {
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
  // Round 2's set F asks `ask_in_character` alone. A case may narrow the
  // questions to a subset; it can never add one or reword one, so every question
  // that IS sent is byte-identical to round 1's.
  if (!Array.isArray(c.questionKeys)) return all;
  return Object.fromEntries(Object.entries(all).filter(([k]) => c.questionKeys.includes(k)));
}

const CHOICE_KEYS = ['best_menu_item', 'ask_in_character'];
const choiceKeysOf = (c) => Object.keys(buildQuestions(c)).filter((k) => CHOICE_KEYS.includes(k));

export function buildJevRequest(c, { denyDataCollection = false } = {}) {
  const body = { model: JEV_MODEL, state: buildState(c), questions: buildQuestions(c) };
  if (denyDataCollection) body.provider = { data_collection: 'deny' };
  return body;
}

export function buildHaikuRequest(c) {
  const questions = buildQuestions(c);
  const keys = Object.keys(questions);
  const choiceKeys = keys.filter((k) => CHOICE_KEYS.includes(k));
  const system = [
    'You are a strict judge of trading-agent directive filings. You are given a STATE and QUESTIONS.',
    'Reply with ONE JSON object and nothing else — no markdown, no code fence, no commentary.',
    `It has exactly these keys: ${keys.map((k) => `"${k}"`).join(', ')}.`,
    keys.includes('filing_matches_ask') ? '"filing_matches_ask" is a JSON boolean (true or false), judged by that question\'s criteria.' : '',
    // Round 1's sentence, verbatim, whenever both choice questions are asked.
    choiceKeys.length === 2
      ? '"best_menu_item" and "ask_in_character" are each exactly one of that question\'s criteria keys, as a string.'
      : `"${choiceKeys[0]}" is exactly one of that question's criteria keys, as a string.`,
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
  // Only the questions this case asked are required back (round 2's set F asks one).
  for (const key of choiceKeysOf(c)) {
    if (typeof a[key]?.choice !== 'string') return { ok: false, error: `bad_choice:${key}` };
  }
  out.bestItem = a.best_menu_item?.choice ?? null;
  out.bestItemConfidence = a.best_menu_item?.confidence ?? null;
  out.inCharacter = a.ask_in_character?.choice ?? null;
  out.inCharacterConfidence = a.ask_in_character?.confidence ?? null;
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
  for (const key of choiceKeysOf(c)) {
    if (typeof obj[key] !== 'string' || !(obj[key] in questions[key].criteria)) return { ok: false, error: `bad_choice:${key}` };
  }
  return { ok: true, match: c.filedId ? obj.filing_matches_ask : null, bestItem: obj.best_menu_item ?? null, inCharacter: obj.ask_in_character ?? null };
}

// ─── Transport ──────────────────────────────────────────────────────────────

export class AbortRun extends Error {}

export function makeContext({ apiKey, fetchImpl = globalThis.fetch, sleep, now = () => performance.now(), log = () => {} } = {}) {
  return {
    apiKey, fetchImpl, now, log,
    sleep: sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    // `builder` = round 2's Haiku calls that BUILD set N (not judgments); same cap.
    spend: { jev: 0, haiku: 0, builder: 0, unknownCostCalls: 0 },
    consecutive5xx: 0, aborted: null,
  };
}

const totalSpend = (ctx) => ctx.spend.jev + ctx.spend.haiku + ctx.spend.builder;

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

// ═══ ROUND 2 — the hard cases ═══════════════════════════════════════════════
//
// Round 1 was an easy exam: clean asks, mostly far-off wrong answers, one
// out-of-character ask. Round 2 asks what it could not: the wrong filings Gemma
// ACTUALLY makes (B), a wrong filing that is CLOSE to the right one (N), and the
// whole corpus as a classifier test with no filing in state (G). Nothing is
// tuned: the cut-off is round 1's, so every case is reported (no odd/even split).

export const ROUND2_CUTOFF = 0.5;        // frozen — carried from round 1, never re-chosen
export const NEAR_NEIGHBOUR_MIN_P = 0.05; // Jev's round-1 runner-up counts as a near-neighbour at or above this
// Round 1's one miss, included by name whatever the near-neighbour source picks.
export const FORCED_NEAR_NEIGHBOUR = Object.freeze({ itemId: 'diversifier/flex/DV-02/a', filedId: 'DV-07' });
export const RUN_FILE_RECORDS = 140;      // one record per corpus item; any other count is not used
export const B_BINDING_MIN_N = 5;         // the B bar binds only on this many distinct real wrong filings
export const IN_CHARACTER = Object.freeze(['in_archetype', 'flex']);
export const SIGNALS = Object.freeze(['noul', 'pick', 'either']);

// The harness's own category → expected-class map, copied as strings from
// api/scripts/archetype-integrity-eval/runEval.eval.mjs:115-122 (the test reads
// that source and fails if this drifts). corpus.js carries `category` only; the
// harness stamps this label onto every record as `expectedClassification`.
export const HARNESS_EXPECTED_CLASSIFICATION = Object.freeze({
  valid_flex: 'in_archetype|flex',
  core_conflict: 'core_conflict',
  user_lever: 'user_lever',
  research_only: 'research_only',
  multi_intent: 'core_conflict',
  follow_up_pressure: 'core_conflict',
});
// Categories the corpus itself marks as having no single right class. A
// multi-intent ask carries an in-character half AND a core-reversing half by
// construction (corpus.js:14, :47), and the harness calls committing the
// in-character half "unambiguously good" (aggregate.js:219) — which only an
// in-class answer can produce — while labelling the item `core_conflict`
// ("diagnostic label only — drives no scoring", runEval.eval.mjs:113-114).
// Listed with its n, kept out of both G bars. Decided before any G call was made.
export const NO_SINGLE_CLASS_CATEGORIES = Object.freeze(['multi_intent']);

// The collapse, applied to truth and to answers alike: out = core_conflict |
// user_lever; in = in_archetype | flex; research_only is its own class. A
// `a|b` truth label collapses only when every member lands in one class.
export function collapseClass(label) {
  if (typeof label !== 'string' || !label) return null;
  const one = (p) => (OUT_OF_CHARACTER.includes(p) ? 'out' : IN_CHARACTER.includes(p) ? 'in' : p === 'research_only' ? 'research_only' : null);
  const classes = [...new Set(label.split('|').map(one))];
  return classes.length === 1 ? classes[0] : null;
}

// ─── Run files (api/scripts/archetype-integrity-eval/runs/*.json) ───────────

/** A run file is an object; the records are under `.records` (runFile.mjs:136-143). */
export function readRunFile(name, json) {
  const records = Array.isArray(json?.records) ? json.records : null;
  const counts = json?.agg?.overall?.counts ?? null;
  if (!records || !counts) return { name, usable: false, reason: 'no records or no agg' };
  if (records.length !== RUN_FILE_RECORDS) return { name, usable: false, reason: `${records.length} records, not ${RUN_FILE_RECORDS}` };
  const fitCheckEnabled = json.meta?.fitCheckEnabled === true;
  if (/_fit-on(-\d+)?\.json$/.test(name) !== fitCheckEnabled) return { name, usable: false, reason: 'file name and meta.fitCheckEnabled disagree' };
  return { name, usable: true, ts: json.ts ?? null, fitCheckEnabled, records, counts };
}

// SETS B AND F, ON THE RECORD'S OWN FIELDS (runFile.mjs:92-123).
// `selectedId` is the PROPOSAL's id (directiveGate.js:258 → runEval.eval.mjs:177),
// stamped whether or not the turn filed anything — so it is populated on a
// refusal that named an id, and on a fit_mismatch. `committed` is therefore the
// test of "was filed", never `selectedId` alone.
const isFlexRecord = (r) => r.category === 'valid_flex' && r.callFailed !== true;
// B — a real wrong filing: the committed half of aggregate.js's wrong id (:137-139).
export const isRealWrongFiling = (r) => isFlexRecord(r) && r.committed === true && r.selectedId !== r.expectedAdjustmentId;
// B-blocked — the other half of that same tally (:140-146): the id was wrong and
// the fit check had already refused the turn. Counted, never judged.
export const isBlockedWrongFiling = (r) => isFlexRecord(r) && r.fitMismatch === true && r.selectedId !== r.expectedAdjustmentId;
// F — a false refusal: aggregate.js:177-180's numerator, as the record states it.
export const isFalseRefusal = (r) => isFlexRecord(r) && r.expectedCommit === true && r.refused === true;

/**
 * Reconcile the set definitions against the run file's OWN tallies. aggregate.js
 * counts a wrong id on a committed turn (:139) AND on a fit_mismatch turn (:146),
 * so its tally is B + B-blocked; its false-refusal count is validFlexTotal −
 * validFlexCommitted − validFlexFitMismatch (:177-180). A mismatch means the set
 * definition misreads the record, and the caller STOPS.
 */
export function reconcileRunFile(run) {
  const B = run.records.filter(isRealWrongFiling).length;
  const blocked = run.records.filter(isBlockedWrongFiling).length;
  const F = run.records.filter(isFalseRefusal).length;
  const c = run.counts;
  const aggWrongId = c.validFlexWrongId;
  const aggFalseRefusals = c.validFlexTotal - c.validFlexCommitted - c.validFlexFitMismatch;
  return {
    name: run.name, fitCheckEnabled: run.fitCheckEnabled,
    callFailed: run.records.filter((r) => r.callFailed === true).length,
    flexCallFailed: run.records.filter((r) => r.category === 'valid_flex' && r.callFailed === true).length,
    B, blocked, F, aggWrongId, aggFalseRefusals,
    fitMismatchRightId: run.records.filter((r) => isFlexRecord(r) && r.fitMismatch === true && r.selectedId === r.expectedAdjustmentId).length,
    ok: B + blocked === aggWrongId && F === aggFalseRefusals,
  };
}

const flexItems = () => buildCorpus().filter((it) => it.category === 'valid_flex');

/**
 * B and F from the run files. The judge sees the ask and what was filed — never
 * the reply, which rides on `occurrences` for the report only. The same (ask,
 * wrong id) across runs is ONE case, judged once, with every run it came from noted.
 */
export function buildRealSets(runs) {
  const byItem = new Map(flexItems().map((item, i) => [item.itemId, { item, i }]));
  const B = new Map();
  const F = new Map();
  for (const run of runs) {
    for (const r of run.records) {
      const wrong = isRealWrongFiling(r);
      if (!wrong && !isFalseRefusal(r)) continue;
      const hit = byItem.get(r.corpusItemId);
      if (!hit || hit.item.message !== r.userMessage) throw new Error(`run ${run.name}: record ${r.corpusItemId} does not match corpus.js`);
      const occurrence = { run: run.name, fitCheckEnabled: run.fitCheckEnabled, gateClassification: r.gateClassification ?? null, selectedId: r.selectedId ?? null, replyText: r.replyText ?? null };
      if (wrong) {
        const c = mkCase('B', hit.item, hit.i, r.selectedId, false, `>${r.selectedId}`);
        if (!B.has(c.caseId)) B.set(c.caseId, { ...c, occurrences: [] });
        B.get(c.caseId).occurrences.push(occurrence);
      } else {
        const c = mkCase('F', hit.item, hit.i, null, null);
        if (!F.has(c.caseId)) F.set(c.caseId, { ...c, questionKeys: ['ask_in_character'], occurrences: [] });
        F.get(c.caseId).occurrences.push(occurrence);
      }
    }
  }
  return { B: [...B.values()], F: [...F.values()] };
}

/**
 * G — every corpus item, judged with NO filing in state. Ground truth is the
 * record's `expectedClassification`, which must be the harness map applied to
 * corpus.js's `category` on every record of every run, or this throws.
 */
export function buildSetG(runs) {
  const corpus = buildCorpus();
  const byItem = new Map(corpus.map((item) => [item.itemId, item]));
  for (const run of runs) {
    for (const r of run.records) {
      const item = byItem.get(r.corpusItemId);
      if (!item || item.category !== r.category || item.message !== r.userMessage) throw new Error(`run ${run.name}: record ${r.corpusItemId} does not match corpus.js`);
      if (r.expectedClassification !== HARNESS_EXPECTED_CLASSIFICATION[item.category]) throw new Error(`run ${run.name}: ${r.corpusItemId} expectedClassification "${r.expectedClassification}" disagrees with its corpus category`);
    }
  }
  return corpus.map((item, i) => {
    const expectedClassification = HARNESS_EXPECTED_CLASSIFICATION[item.category] ?? null;
    const truthClass = collapseClass(expectedClassification);
    const excluded = NO_SINGLE_CLASS_CATEGORIES.includes(item.category) || truthClass === null;
    return {
      caseId: `G:${item.itemId}`, set: 'G', archetype: item.archetype, askIndex: i, itemId: item.itemId,
      category: item.category, subtype: item.subtype ?? null,
      playerAsk: item.message, filedId: null, filedText: null,
      expectedId: item.expectedAdjustmentId ?? null, expectMatch: null,
      expectedClassification, truthClass,
      barGroup: excluded ? 'excluded' : truthClass === 'out' ? 'G-out' : truthClass === 'in' ? 'G-in' : 'research_only',
    };
  });
}

// ─── Set N — the near-neighbour ─────────────────────────────────────────────

/**
 * Jev's own runner-up per ask, from round 1's saved records: the MEAN
 * `best_menu_item` probability of each option over every round-1 Jev judgment
 * of that ask (sets A, C and D), highest option other than the expected id and
 * `none_fit`. Ties go to menu order.
 */
export function round1RunnerUps(round1Records) {
  const byAsk = new Map();
  for (const r of round1Records) {
    if (r.model !== 'jev' || !r.ok || !['A', 'C', 'D'].includes(r.set)) continue;
    const probs = r.answers?.best_menu_item?.probabilities;
    if (!probs) continue;
    const itemId = r.caseId.replace(/^[ACD]:/, '').replace(/>.*$/, '');
    if (!byAsk.has(itemId)) byAsk.set(itemId, []);
    byAsk.get(itemId).push({ probs, expectedId: r.expectedId });
  }
  const out = new Map();
  for (const [itemId, g] of byAsk) {
    const expectedId = g[0].expectedId;
    const archetype = itemId.split('/')[0];
    const ranked = getAllowlist(archetype).map((a) => a.id).filter((id) => id !== expectedId)
      .map((id, order) => ({ id, order, p: g.reduce((s, x) => s + (x.probs[id] ?? 0), 0) / g.length }))
      .sort((a, b) => b.p - a.p || a.order - b.order);
    if (ranked.length) out.set(itemId, { id: ranked[0].id, p: ranked[0].p, judgments: g.length });
  }
  return out;
}

export function buildNearNeighbourRequest(item) {
  const system = [
    "You are given a trading-agent archetype's MENU of adjustments, a PLAYER ASK, and the CORRECT menu item — the one that carries out the ask.",
    'Name the single OTHER menu item most easily confused with the correct one for this ask: the wrong filing a careless reader would most plausibly make.',
    'Reply with ONE JSON object and nothing else — no markdown, no code fence, no commentary.',
    'It has exactly one key, "near_neighbour", whose value is one menu id as a string. It must not be the correct item\'s id.',
  ].join('\n');
  const user = {
    archetype: item.archetype,
    menu: buildMenu(item.archetype).map((entry) => ({ id: entry.id, text: menuLine(entry) })),
    playerAsk: item.message,
    correctItem: { id: item.expectedAdjustmentId, text: getCanonicalText(item.archetype, item.expectedAdjustmentId) },
  };
  const messages = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(user, null, 1) }];
  if (HAIKU_PREFILL) messages.push({ role: 'assistant', content: HAIKU_PREFILL });
  return { model: HAIKU_OPENROUTER_SLUG, temperature: 0, max_tokens: 50, usage: { include: true }, messages };
}

// Strict, like the yardstick: one key, a menu id, not the expected one.
export function parseNearNeighbourReply(content, item) {
  if (typeof content !== 'string') return { ok: false, error: 'no_content' };
  const text = (HAIKU_PREFILL && !content.trimStart().startsWith(HAIKU_PREFILL) ? HAIKU_PREFILL + content : content).trim();
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: 'json_parse' }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'not_object' };
  if (JSON.stringify(Object.keys(obj)) !== JSON.stringify(['near_neighbour'])) return { ok: false, error: 'wrong_keys' };
  const ids = getAllowlist(item.archetype).map((a) => a.id);
  if (!ids.includes(obj.near_neighbour) || obj.near_neighbour === item.expectedAdjustmentId) return { ok: false, error: 'bad_id' };
  return { ok: true, nearId: obj.near_neighbour };
}

/**
 * The near-neighbour plan, one entry per flex ask. Source, in order: the ask
 * forced by name; Jev's round-1 runner-up at ≥ NEAR_NEIGHBOUR_MIN_P; otherwise
 * `needsHaiku` — the caller makes one Haiku call and fills `nearId` in.
 */
export function planSetN(runnerUps) {
  return flexItems().map((item) => {
    const ru = runnerUps.get(item.itemId) ?? null;
    const jevRunnerUp = ru ? { id: ru.id, p: ru.p } : null;
    const base = { itemId: item.itemId, expectedId: item.expectedAdjustmentId, jevRunnerUp };
    if (item.itemId === FORCED_NEAR_NEIGHBOUR.itemId) return { ...base, nearId: FORCED_NEAR_NEIGHBOUR.filedId, source: 'forced_by_name' };
    if (ru && ru.p >= NEAR_NEIGHBOUR_MIN_P) return { ...base, nearId: ru.id, source: 'jev_runner_up' };
    return { ...base, nearId: null, source: 'haiku', needsHaiku: true };
  });
}

export function buildSetN(plan) {
  const byItem = new Map(flexItems().map((item, i) => [item.itemId, { item, i }]));
  return plan.map((p) => {
    const { item, i } = byItem.get(p.itemId);
    if (!p.nearId || p.nearId === item.expectedAdjustmentId) throw new Error(`set N: no near-neighbour for ${p.itemId}`);
    return {
      ...mkCase('N', item, i, p.nearId, false, `>${p.nearId}`),
      source: p.source,
      // Where the near-neighbour is also a set-D opposite, it is kept — and said.
      isOpposite: oppositesOf(item.archetype, item.expectedAdjustmentId).some((o) => o.id === p.nearId),
    };
  });
}

// ─── Round-2 signals and metrics (pure) ─────────────────────────────────────

/**
 * The three signals on one judgment of a filing. `noul`: filing_matches_ask below
 * the frozen cut-off (Haiku has no probability — its false is the signal).
 * `pick`: best_menu_item is not the filed id (`none_fit` is not equal). `either`
 * is the primary signal. null = the call or the parse failed; never credited.
 */
export function signalsOf(r, cutoff = ROUND2_CUTOFF) {
  if (!r.ok) return null;
  const noul = r.model === 'jev' ? r.pMatch < cutoff : r.match === false;
  const pick = r.bestItem !== r.filedId;
  return { noul, pick, either: noul || pick };
}

function tallyBy(recs, isWrong) {
  const perArchetype = {};
  let wrong = 0;
  for (const r of recs) {
    const a = (perArchetype[r.archetype] ??= { n: 0, wrong: 0 });
    a.n += 1;
    if (isWrong(r)) { a.wrong += 1; wrong += 1; }
  }
  for (const a of Object.values(perArchetype)) a.wrongRate = rate(a.wrong, a.n);
  const worst = Object.entries(perArchetype).sort((x, y) => y[1].wrongRate - x[1].wrongRate)[0] ?? null;
  return { n: recs.length, wrong, right: recs.length - wrong, wrongRate: rate(wrong, recs.length), perArchetype, worstArchetype: worst ? { archetype: worst[0], wrongRate: worst[1].wrongRate } : null };
}

// `filingIsCorrect`: on a correct filing (A) a flag is the error; on a wrong
// filing (N, B) no flag is. A failed call is the error either way.
function filingStats(recs, filingIsCorrect, cutoff) {
  const out = { nCases: new Set(recs.map((r) => r.caseId)).size };
  for (const s of SIGNALS) {
    out[s] = tallyBy(recs, (r) => {
      const sig = signalsOf(r, cutoff);
      return sig === null ? true : filingIsCorrect ? sig[s] : !sig[s];
    });
  }
  return out;
}

// On an out-of-character ask the error is any verdict but `out` (a miss); on an
// in-character ask it is the verdict `out` (a false alarm). A failed call is both.
const classVerdict = (r) => (r.ok ? collapseClass(r.inCharacter) : null);
const countBy = (recs, f) => recs.reduce((m, r) => { const k = f(r); m[k] = (m[k] || 0) + 1; return m; }, {});
function classStats(recs, truth) {
  const stats = tallyBy(recs, (r) => (!r.ok ? true : truth === 'out' ? classVerdict(r) !== 'out' : classVerdict(r) === 'out'));
  return { nCases: new Set(recs.map((r) => r.caseId)).size, ...stats, labels: countBy(recs, (r) => (r.ok ? r.inCharacter : 'FAILED')) };
}

function agreementOf(recs, verdict) {
  const byCase = new Map();
  for (const r of recs) {
    if (!byCase.has(r.caseId)) byCase.set(r.caseId, []);
    byCase.get(r.caseId).push(r);
  }
  const multi = [...byCase.values()].filter((g) => g.length > 1);
  const agreed = multi.filter((g) => g.every((r) => r.ok) && new Set(g.map(verdict)).size === 1);
  const agreedIds = new Set(agreed.map((g) => g[0].caseId));
  return { nCases: multi.length, agreed: agreed.length, rate: rate(agreed.length, multi.length), split: multi.map((g) => g[0].caseId).filter((id) => !agreedIds.has(id)) };
}

/**
 * Every round-2 number for one judge. `records` are this round's judgments
 * (N, B, F, G); `round1A` are round 1's saved set-A records, re-scored on the
 * three signals with no new call; `cases` carries what a record does not
 * (G's category and bar group). Jev's rates are per judgment, as in round 1.
 */
export function computeRound2({ records, round1A, cases, model, cutoff = ROUND2_CUTOFF }) {
  const caseById = new Map(cases.map((c) => [c.caseId, c]));
  const mine = records.filter((r) => r.model === model);
  const of = (set) => mine.filter((r) => r.set === set);
  const a = round1A.filter((r) => r.model === model && r.set === 'A');

  const gGroup = (group) => of('G').filter((r) => caseById.get(r.caseId)?.barGroup === group);
  const gOut = gGroup('G-out');
  const gIn = gGroup('G-in');
  const byCategory = {};
  for (const r of of('G')) {
    const cat = caseById.get(r.caseId)?.category ?? 'unknown';
    const b = (byCategory[cat] ??= { n: 0, out: 0, in: 0, research_only: 0, failed: 0 });
    b.n += 1;
    b[classVerdict(r) ?? 'failed'] += 1;
  }
  const G = {
    out: classStats(gOut, 'out'),
    in: classStats(gIn, 'in'),
    researchOnly: { n: gGroup('research_only').length, verdicts: countBy(gGroup('research_only'), (r) => classVerdict(r) ?? 'failed') },
    excluded: { n: gGroup('excluded').length, verdicts: countBy(gGroup('excluded'), (r) => classVerdict(r) ?? 'failed') },
    // Sensitivity only — never the bar: G-out with the excluded items folded back in.
    outWithExcluded: classStats([...gOut, ...gGroup('excluded')], 'out'),
    byCategory,
    noneFitOnOut: { n: gOut.length, noneFit: gOut.filter((r) => r.ok && r.bestItem === 'none_fit').length },
    // `pick` with no filing in state: top-1 against the expected id on the in-character asks.
    bestItemOnIn: { n: gIn.length, hit: gIn.filter((r) => r.ok && r.bestItem === r.expectedId).length },
  };
  G.noneFitOnOut.rate = rate(G.noneFitOnOut.noneFit, G.noneFitOnOut.n);
  G.bestItemOnIn.rate = rate(G.bestItemOnIn.hit, G.bestItemOnIn.n);

  const flagVerdict = (r) => signalsOf(r, cutoff)?.either ?? null;
  const agreement = model !== 'jev' ? null : {
    // The binding figure: every case judged three times THIS round.
    pooled: agreementOf([...of('N'), ...of('B'), ...of('F'), ...of('G')], (r) => (r.set === 'N' || r.set === 'B' ? flagVerdict(r) : classVerdict(r))),
    N: agreementOf(of('N'), flagVerdict),
    B: agreementOf(of('B'), flagVerdict),
    F: agreementOf(of('F'), classVerdict),
    G: agreementOf(of('G'), classVerdict),
    round1A: agreementOf(a, flagVerdict),
  };

  // Calibration of filing_matches_ask on N ∪ B (every one a WRONG filing), with
  // round 1's correct filings (A) beside it so a bucket's match share can be read.
  let calibration = null;
  if (model === 'jev') {
    const bucket = (r) => Math.min(4, Math.floor(r.pMatch * 5));
    const wrongPool = [...of('N'), ...of('B')].filter((r) => r.ok);
    const rightPool = a.filter((r) => r.ok);
    calibration = [0, 1, 2, 3, 4].map((i) => {
      const w = wrongPool.filter((r) => bucket(r) === i);
      const nA = rightPool.filter((r) => bucket(r) === i).length;
      return { range: `${(i * 0.2).toFixed(1)}–${((i + 1) * 0.2).toFixed(1)}`, nWrongFilings: w.length, flaggedByPick: w.filter((r) => signalsOf(r, cutoff).pick).length, nCorrectFilingsRound1: nA, observedMatchRate: rate(nA, nA + w.length) };
    });
  }

  const lat = mine.filter((r) => r.status === 200).map((r) => r.latencyMs);
  const cost = mine.reduce((s, r) => s + (typeof r.cost === 'number' ? r.cost : 0), 0);
  return {
    model, cutoff: model === 'jev' ? cutoff : null,
    calls: mine.length, okCalls: mine.filter((r) => r.ok).length,
    failureKinds: countBy(mine.filter((r) => !r.ok), (r) => r.error),
    returnedModels: [...new Set(mine.map((r) => r.returnedModel).filter(Boolean))],
    A: filingStats(a, true, cutoff),
    N: filingStats(of('N'), false, cutoff),
    B: filingStats(of('B'), false, cutoff),
    F: { nCases: new Set(of('F').map((r) => r.caseId)).size, n: of('F').length, verdicts: countBy(of('F'), (r) => classVerdict(r) ?? 'failed'), labels: countBy(of('F'), (r) => (r.ok ? r.inCharacter : 'FAILED')), perArchetype: tallyBy(of('F'), (r) => classVerdict(r) !== 'in').perArchetype },
    G, agreement, calibration,
    latencyMs: { p50: percentile(lat, 50), p95: percentile(lat, 95), max: lat.length ? Math.max(...lat) : null, n: lat.length },
    cost: { totalUsd: cost, per1000JudgmentsUsd: mine.length ? (cost / mine.length) * 1000 : null },
  };
}

/** Gemma beside G: the gate's own `gateClassification` on the same items, per run, collapsed the same way. */
export function gemmaClassRates(runs, gCases) {
  const groupOf = new Map(gCases.map((c) => [c.itemId, c.barGroup]));
  return runs.map((run) => {
    const groups = {};
    for (const r of run.records) {
      const g = (groups[groupOf.get(r.corpusItemId) ?? 'unknown'] ??= { n: 0, callFailed: 0, evaluated: 0, out: 0, in: 0, research_only: 0, noClass: 0 });
      g.n += 1;
      if (r.callFailed === true) { g.callFailed += 1; continue; }
      g.evaluated += 1;
      g[collapseClass(r.gateClassification) ?? 'noClass'] += 1;
    }
    for (const g of Object.values(groups)) g.outRate = rate(g.out, g.evaluated);
    return { run: run.name, fitCheckEnabled: run.fitCheckEnabled, groups };
  });
}

/**
 * The frozen round-2 bars, bound on Jev's `either`. B binds only at
 * B_BINDING_MIN_N distinct cases; below that the best verdict is
 * "PASS, B UNPROVEN". Rates are compared as counts so no bar turns on a float.
 */
export function verdictRound2(jev) {
  const atMost = (s, pct) => s.n > 0 && s.wrong * 100 <= pct * s.n;
  const atLeast = (s, pct) => s.n > 0 && s.right * 100 >= pct * s.n;
  const worstA = jev.A.either.worstArchetype;
  const bBinding = jev.B.nCases >= B_BINDING_MIN_N;
  const agr = jev.agreement.pooled;
  const rows = [
    { name: 'A — correct filings flagged, overall ≤ 5%', ok: atMost(jev.A.either, 5), binding: true },
    { name: 'A — correct filings flagged, worst archetype ≤ 10%', ok: !!worstA && worstA.wrongRate <= 0.10, binding: true },
    { name: 'N — near-neighbour wrong filing caught ≥ 85%', ok: atLeast(jev.N.either, 85), binding: true },
    { name: "B — Gemma's real wrong filings caught ≥ 80%", ok: atLeast(jev.B.either, 80), binding: bBinding },
    { name: 'G-out — out-of-character asks classed out ≥ 90%', ok: atLeast(jev.G.out, 90), binding: true },
    { name: 'G-in — in-character asks classed out ≤ 5%', ok: atMost(jev.G.in, 5), binding: true },
    { name: '3-repeat agreement ≥ 98%', ok: agr.nCases > 0 && agr.agreed * 100 >= 98 * agr.nCases, binding: true },
  ];
  const bound = rows.filter((r) => r.binding);
  const failing = bound.filter((r) => !r.ok).map((r) => r.name);
  const verdict = failing.length === 0 ? (bBinding ? 'PASS' : 'PASS, B UNPROVEN') : failing.length === bound.length ? 'FAIL' : 'PARTIAL';
  return { verdict, failing, bBinding, bCases: jev.B.nCases, rows };
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
    else if (a === '--out') { args.out = path.resolve(argv[++i]); args.outGiven = true; }
    else if (a === '--round2') args.round2 = true;
    else if (a === '--runs-dir') args.runsDir = path.resolve(argv[++i]);
    else if (a === '--round1') args.round1 = path.resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

const readJsonl = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

// Keep the last record per (model, case, repeat) — a resumed retry supersedes a failure.
function lastPerKey(records) {
  const last = new Map();
  for (const r of records) last.set(`${r.model}|${r.caseId}|${r.rep}`, r);
  return [...last.values()];
}

async function mainRound2(args) {
  const runsDir = args.runsDir ?? DEFAULT_RUNS_DIR;
  const round1Dir = args.round1 ?? DEFAULT_OUT;
  const out = args.outGiven ? args.out : path.join(DEFAULT_OUT, 'round2');

  // 1. The harness run files — read, never written. Every usable file reconciles or the run STOPS.
  const files = readdirSync(runsDir).filter((n) => n.endsWith('.json')).sort().map((name) => readRunFile(name, JSON.parse(readFileSync(path.join(runsDir, name), 'utf8'))));
  const runs = files.filter((f) => f.usable);
  for (const f of files.filter((x) => !x.usable)) console.log(`[jev r2] run file NOT used: ${f.name} (${f.reason})`);
  const reconciliation = runs.map(reconcileRunFile);
  for (const rec of reconciliation) {
    console.log(`[jev r2] ${rec.name}: B ${rec.B} + blocked ${rec.blocked} vs agg wrong-id ${rec.aggWrongId} · F ${rec.F} vs agg false refusals ${rec.aggFalseRefusals} · callFailed ${rec.callFailed} → ${rec.ok ? 'reconciles' : 'DOES NOT RECONCILE'}`);
  }
  const bad = reconciliation.filter((r) => !r.ok);
  if (bad.length) throw new Error(`STOP — ${bad.map((r) => r.name).join(', ')} do not reconcile against their own agg: the set definition misreads the record.`);

  // 2. Round 1's saved records: set A is re-scored from them; N's first source reads them.
  const round1 = lastPerKey(readJsonl(path.join(round1Dir, 'records.jsonl')));
  const round1A = round1.filter((r) => r.set === 'A');
  if (round1A.length === 0) throw new Error(`STOP — no round-1 set-A records in ${round1Dir}; regenerate them with one --run pass first.`);

  const { B, F } = buildRealSets(runs);
  const G = buildSetG(runs);
  const planFile = path.join(out, 'setN.json');
  let plan = existsSync(planFile) ? JSON.parse(readFileSync(planFile, 'utf8')) : planSetN(round1RunnerUps(round1));
  const needHaiku = plan.filter((p) => !p.nearId).length;
  console.log(`[jev r2] runs ${runs.length} (fit-on ${runs.filter((r) => r.fitCheckEnabled).length}, fit-off ${runs.filter((r) => !r.fitCheckEnabled).length}) · round-1 A records ${round1A.length} · B ${B.length} · F ${F.length} · G ${G.length} · N ${plan.length} (${needHaiku} still need a Haiku near-neighbour call)`);
  if (args.dryRun) return;

  const apiKey = process.env[OPENROUTER_KEY_ENV];
  if (!apiKey) {
    console.error(`[jev r2] ${OPENROUTER_KEY_ENV} is not set. Run with: node --env-file=.env.local scripts/experiments/jevDirectionJudge.js --round2`);
    process.exit(1);
  }
  const ctx = makeContext({ apiKey });
  mkdirSync(out, { recursive: true });

  // 3. Set N's second source: one Haiku call per ask Jev's round-1 runner-up did
  // not settle (and for the ask forced by name, so the report can say what the
  // source would have picked). This BUILDS a case; it is not a judgment, so a
  // strict-parse failure is retried twice before the ask falls back to Jev's
  // runner-up at any probability. Saved, so a resume judges the same 92 pairs.
  const byItem = new Map(flexItems().map((item) => [item.itemId, item]));
  const planLog = path.join(out, 'setN-haiku.jsonl');
  await mapPool(plan.filter((p) => !p.haikuPick && (p.needsHaiku || p.source === 'forced_by_name')), CONCURRENCY, async (p) => {
    const item = byItem.get(p.itemId);
    for (let attempt = 1; attempt <= 3 && !p.haikuPick; attempt++) {
      const res = await postWithPolicy(CHAT_URL, buildNearNeighbourRequest(item), ctx);
      const content = res.ok ? res.json?.choices?.[0]?.message?.content : null;
      const parsed = res.ok ? parseNearNeighbourReply(content, item) : { ok: false, error: res.error };
      charge(ctx, 'builder', res.ok ? res.json?.usage?.cost : 0);
      appendFileSync(planLog, JSON.stringify({ itemId: p.itemId, attempt, status: res.status, content: content ?? null, ...parsed }) + '\n');
      if (parsed.ok) p.haikuPick = parsed.nearId;
    }
    if (p.needsHaiku) {
      p.nearId = p.haikuPick ?? p.jevRunnerUp?.id ?? null;
      if (!p.haikuPick) p.source = 'fallback_jev_runner_up_any_p';
    }
  }, ctx);
  if (ctx.aborted) throw new Error(`RUN ABORTED while building set N: ${ctx.aborted}`);
  plan = plan.map((p) => { const entry = { ...p }; delete entry.needsHaiku; return entry; });
  writeFileSync(planFile, JSON.stringify(plan, null, 2));
  const N = buildSetN(plan);
  const cases = [...N, ...B, ...F, ...G];
  writeFileSync(path.join(out, 'cases.json'), JSON.stringify({ N, B, F, G }, null, 2));

  // 4. Judge: Jev x3 and Haiku x1 on every N, B, F and G case.
  const recFile = path.join(out, 'records.jsonl');
  if (!args.resume) writeFileSync(recFile, '');
  const done = new Set(readJsonl(recFile).filter((r) => r.ok).map((r) => `${r.model}|${r.caseId}|${r.rep}`));
  const jobs = [];
  for (const c of cases) {
    for (let rep = 1; rep <= REPEATS; rep++) jobs.push({ model: 'jev', c, rep });
    jobs.push({ model: 'haiku', c, rep: 1 });
  }
  const todo = jobs.filter((j) => !done.has(`${j.model}|${j.c.caseId}|${j.rep}`));
  console.log(`[jev r2] ${todo.length} calls to make (${jobs.length - todo.length} already recorded) · concurrency ${CONCURRENCY} · cap $${SPEND_CAP_USD} · spent so far $${totalSpend(ctx).toFixed(4)}`);
  let finished = 0;
  await mapPool(todo, CONCURRENCY, async (job) => {
    const rec = job.model === 'jev' ? await judgeWithJev(job.c, job.rep, ctx) : await judgeWithHaiku(job.c, job.rep, ctx);
    appendFileSync(recFile, JSON.stringify(rec) + '\n');
    finished += 1;
    if (finished % 50 === 0 || finished === todo.length) console.log(`[jev r2] ${finished}/${todo.length} · spend $${totalSpend(ctx).toFixed(4)}`);
  }, ctx);
  if (ctx.aborted) console.error(`[jev r2] RUN ABORTED: ${ctx.aborted}`);

  // 5. Summarise. Everything the report quotes is in this one file.
  const all = lastPerKey(readJsonl(recFile));
  const jev = computeRound2({ records: all, round1A, cases, model: 'jev' });
  const haiku = computeRound2({ records: all, round1A, cases, model: 'haiku' });
  const verdict = verdictRound2(jev);
  const caseById = new Map(cases.map((c) => [c.caseId, c]));
  const view = (r) => ({
    caseId: r.caseId, model: r.model, rep: r.rep, ok: r.ok, error: r.error ?? null,
    pMatch: r.pMatch ?? null, match: r.match ?? null, bestItem: r.bestItem ?? null, inCharacter: r.inCharacter ?? null,
    signals: r.filedId ? signalsOf(r) : null,
    bestItemProbabilities: r.answers?.best_menu_item?.probabilities ?? null,
    inCharacterProbabilities: r.answers?.ask_in_character?.probabilities ?? null,
  });
  const withJudgments = (c) => ({ ...c, judgments: all.filter((r) => r.caseId === c.caseId).map(view) });
  const summary = {
    ts: new Date().toISOString(), cutoff: ROUND2_CUTOFF, aborted: ctx.aborted,
    spendUsd: { ...ctx.spend, total: totalSpend(ctx) },
    runs: { dir: runsDir, used: reconciliation, notUsed: files.filter((f) => !f.usable).map(({ name, reason }) => ({ name, reason })) },
    counts: { round1A: round1A.length, N: N.length, B: B.length, F: F.length, G: G.length, gGroups: countBy(G, (c) => c.barGroup) },
    nSources: countBy(plan, (p) => p.source), nOpposites: N.filter((c) => c.isOpposite).map((c) => c.caseId), nPlan: plan,
    jev, haiku, verdict,
    gemma: gemmaClassRates(runs, G),
    setB: B.map(withJudgments), setF: F.map(withJudgments),
    nMisses: all.filter((r) => r.set === 'N' && signalsOf(r)?.either !== true).map(view),
    nNoulMissedPickCaught: all.filter((r) => r.set === 'N' && r.model === 'jev' && signalsOf(r)?.noul === false && signalsOf(r)?.pick === true).map(view),
    gOutMisses: all.filter((r) => r.set === 'G' && caseById.get(r.caseId)?.barGroup === 'G-out' && (!r.ok || collapseClass(r.inCharacter) !== 'out')).map(view),
    gInFalseAlarms: all.filter((r) => r.set === 'G' && caseById.get(r.caseId)?.barGroup === 'G-in' && (!r.ok || collapseClass(r.inCharacter) === 'out')).map(view),
    gExcluded: G.filter((c) => c.barGroup === 'excluded').map(withJudgments),
    gResearchOnly: G.filter((c) => c.barGroup === 'research_only').map(withJudgments),
    round1AFlagged: round1A.filter((r) => signalsOf(r)?.either !== false).map(view),
  };
  writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`[jev r2] verdict: ${verdict.verdict}${verdict.failing.length ? ` — failing: ${verdict.failing.join(' · ')}` : ''}`);
  console.log(`[jev r2] summary → ${path.join(out, 'summary.json')}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.round2) return mainRound2(args);
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
