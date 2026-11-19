#!/usr/bin/env node
// scripts/sharedResearch/probeBuilder.mjs
//
// Shared Research B3 — THE RECORDED PROBES (build prompt K-8; the founder's
// P-1, P-2 and S-4). One live thesis builder turn on `claude-sonnet-5-5` per
// distinct schema — the five goals, `strengthen` on each part, `direction` with
// nothing else on offer — each against an authored fixture
// (api/_utils/sharedResearch/__fixtures__/probeBuilder.js), with the real builder
// system prompt (Atlas, the baseline method), the real user turn and that
// goal's schema (thesisSchema.buildSchemaOf). Each answer is written to
// test/fixtures/sharedResearch/build.<key>.recorded.json with its usage and
// costUsd; thesisSchema.recorded.test.js validates them.
//
//   node --env-file=<parent checkout>/.env.local scripts/sharedResearch/probeBuilder.mjs [key ...] [--force]
//   node --env-file=<parent checkout>/.env.local scripts/sharedResearch/probeBuilder.mjs --b5 b5:map_segments
//
// --b5 (Amendment B §B13 T-7): the B5 round's three probes (b5Probes: map_segments on the T-1 card, find_names with
// the segment set and the theme unset, build_why on one name), one key per run — each card is built from the answer
// recorded before it. Their own ledger, test/fixtures/sharedResearch/build.b5.probes.ledger.json, holds at most 3
// calls and $0.10; B3's ledger and its sixteen recordings are never touched.
//
// No key named: every probe without a recorded fixture, in the fixtures' order.
// The key: CLAUDE_API_KEY, loaded into THIS process only; it is never printed,
// logged or written. A recorded fixture is never replaced without --force.
//
// The budget (S-4): every call made is appended to the committed ledger
// test/fixtures/sharedResearch/build.probes.ledger.json; before each call the
// script checks that the ledger holds fewer than 16 calls and that what was spent
// plus this call's worst case (its prompt at three characters a token, plus the
// 2,500-token output cap) stays within $0.50. It stops at the first refusal.
//
// A refusal's own words (P-1): the call goes through runTurn's `create` seam to
// the same SDK request modelTurn.js makes (the same body, `maxRetries: 0`). When
// the API refuses, the record keeps the API's error status, type and message
// (`apiError`) — never the key, never a header — and the error is rethrown so
// runTurn answers exactly as in the app. modelTurn.js is not edited.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { runTurn, MODELS, MODEL_PRICES, MAX_OUTPUT_TOKENS } from '../../api/_utils/sharedResearch/modelTurn.js';
import { buildBuildSystemPrompt, renderBuildUser } from '../../api/_utils/sharedResearch/stepPrompt.js';
import { buildSchemaOf, validateBuildTurn } from '../../api/_utils/sharedResearch/thesisSchema.js';
import { BASELINE } from '../../api/_utils/sharedResearch/method.js';
import { currentFindingsOf } from '../../api/_utils/researchRecords/model.js';
import { builderProbes, PROBE_B_READ_AT, PROBE_B_NOW, PROBE_B_EXCHANGE_ID, PROBE_B_NAMES, b5Probes, validateB5, PROBE_B5_KEYS, PROBE_B5_READ_AT } from '../../api/_utils/sharedResearch/__fixtures__/probeBuilder.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../test/fixtures/sharedResearch');
const fileOf = (key) => `build.${key.replace(':', '.')}.recorded.json`;
const args = process.argv.slice(2);
const B5 = args.includes('--b5');
const LEDGER = resolve(FIXTURES, B5 ? 'build.b5.probes.ledger.json' : 'build.probes.ledger.json');
const CALLS_MAX = B5 ? 3 : 16;
const COST_MAX_USD = B5 ? 0.1 : 0.5;
const RULING = B5 ? '§B13 T-7 (Nov 17): at most 3 calls and $0.10 in total' : 'S-4 (Nov 17): up to 16 calls and $0.50 in total';

const force = args.includes('--force');
const wanted = args.filter((a) => !a.startsWith('--'));
const all = B5 ? b5Probes() : builderProbes();
const unknown = wanted.filter((k) => !all.some((p) => p.key === k));
if (B5 && unknown.some((k) => PROBE_B5_KEYS.includes(k))) { console.error(`probeBuilder: ${unknown.join(', ')} needs the probe before it recorded first (${PROBE_B5_KEYS.join(' → ')})`); process.exit(2); }
if (unknown.length) { console.error(`probeBuilder: no probe ${unknown.join(', ')}`); process.exit(2); }
const probes = wanted.length ? wanted.map((k) => all.find((p) => p.key === k)) : all.filter((p) => !existsSync(resolve(FIXTURES, fileOf(p.key))));
const blocked = probes.filter((p) => existsSync(resolve(FIXTURES, fileOf(p.key))));
if (blocked.length && !force) { console.error(`probeBuilder: recorded already (${blocked.map((p) => p.key).join(', ')}); pass --force to replace on purpose.`); process.exit(2); }
if (!process.env.CLAUDE_API_KEY) { console.error('probeBuilder: CLAUDE_API_KEY is not set in this process (load it with --env-file); nothing was called.'); process.exit(2); }

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { ruling: RULING, callsMax: CALLS_MAX, costMaxUsd: COST_MAX_USD, calls: [] };
const spent = () => ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);

/** The key, if it ever appears in an error's text, is replaced — it is never written. */
const redact = (s) => (typeof s === 'string' ? s.split(process.env.CLAUDE_API_KEY).join('[redacted]') : null);
/** The API's own words on a refusal: its status, error type and message — never a header, never the request. */
function apiErrorOf(err) {
  const body = err?.error?.error ?? null; // the SDK's APIError: `error` is the response body { type: 'error', error: { type, message } }
  return {
    status: Number.isInteger(err?.status) ? err.status : null,
    type: typeof body?.type === 'string' ? body.type : null,
    message: redact(typeof body?.message === 'string' ? body.message : (typeof err?.message === 'string' ? err.message : null)),
  };
}
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 }); // as modelTurn.js builds it
const price = MODEL_PRICES[MODELS.step];

const system = buildBuildSystemPrompt({ partnerName: 'Atlas', method: BASELINE });
const summary = [];
mkdirSync(FIXTURES, { recursive: true });
for (const p of probes) {
  const schema = buildSchemaOf(p.shape);
  const user = renderBuildUser({
    question: p.record.question, entryKind: p.entryKind, goal: p.goal, part: p.part, shape: p.shape, direction: p.direction, card: p.card,
    supported: p.supported, stepsLeft: 6, findings: currentFindingsOf(p.record), items: p.items, retrieval: p.retrieval, room: 90,
  });
  const worst = (Math.ceil((system.length + user.length + JSON.stringify(schema).length) / 3) * price.inputPerMTok + MAX_OUTPUT_TOKENS.step * price.outputPerMTok) / 1_000_000;
  if (ledger.calls.length + 1 > CALLS_MAX || spent() + worst > COST_MAX_USD) {
    console.error(`probeBuilder: budget — ${ledger.calls.length} calls, $${spent().toFixed(4)} spent; this call's worst case $${worst.toFixed(4)} would pass ${CALLS_MAX} calls or $${COST_MAX_USD}. Stopped before ${p.key}.`);
    break;
  }
  let apiError = null;
  const create = async (body, opts) => {
    try {
      return await client.messages.create(body, opts);
    } catch (err) {
      apiError = apiErrorOf(err);
      throw err;
    }
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  const turn = await runTurn({ kind: 'step', system, user, schema, signal: controller.signal, create });
  clearTimeout(timer);
  const recorded = {
    recordedAt: new Date().toISOString(), key: p.key, goal: p.goal, part: p.part, shape: p.shape,
    model: turn.model, modelIds: MODELS,
    ok: turn.ok, reason: turn.reason ?? null, stopReason: turn.stopReason, category: turn.category ?? null,
    apiError: turn.ok ? null : apiError,
    attempts: turn.attempts, elapsedMs: turn.elapsedMs, usage: turn.usage, costUsd: turn.costUsd,
    readAt: B5 ? PROBE_B5_READ_AT : PROBE_B_READ_AT,
    output: turn.output ?? null,
  };
  ledger.calls.push({ at: recorded.recordedAt, key: p.key, ok: recorded.ok, reason: recorded.reason, apiError: recorded.apiError, usage: recorded.usage, costUsd: recorded.costUsd, elapsedMs: recorded.elapsedMs, attempts: recorded.attempts });
  writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  writeFileSync(resolve(FIXTURES, fileOf(p.key)), `${JSON.stringify(recorded, null, 2)}\n`);
  let validation = null;
  if (turn.ok && B5) {
    const v = validateB5(p, turn.output);
    const t = typeof turn.output?.themeSuggestion === 'string' ? turn.output.themeSuggestion.trim() : '';
    validation = v.ok
      ? { ok: true, findings: v.findings.length, notes: v.notes, landed: Object.entries(v.proposals).filter(([k, x]) => !['goal', 'part'].includes(k) && x).map(([k]) => k), reply: v.reply, replyChars: v.reply.length }
      : { ok: false, rule: v.rule, detail: v.detail };
    validation.t7 = { modelReplyChars: String(turn.output?.reply ?? '').length, themeSuggestion: t || null, themeWords: t ? t.split(/\s+/).length : 0 };
  } else if (turn.ok) {
    let n = 0;
    const v = validateBuildTurn(turn.output, {
      record: p.record, items: p.items, readAt: PROBE_B_READ_AT, partnerExchangeId: PROBE_B_EXCHANGE_ID, partnerAt: PROBE_B_NOW, nowIso: PROBE_B_NOW,
      mintFindingId: () => `f_7b000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names: PROBE_B_NAMES, partnerName: 'Atlas', method: BASELINE,
      card: p.card, goal: p.goal, part: p.part, shape: p.shape,
    });
    validation = v.ok
      ? { ok: true, findings: v.findings.length, notes: v.notes, landed: Object.entries(v.proposals).filter(([k, x]) => !['goal', 'part'].includes(k) && x).map(([k]) => k) }
      : { ok: false, rule: v.rule, detail: v.detail };
  }
  summary.push({ key: p.key, model: recorded.model, ok: recorded.ok, reason: recorded.reason, apiError: recorded.apiError, stopReason: recorded.stopReason, attempts: recorded.attempts, elapsedMs: recorded.elapsedMs, usage: recorded.usage, costUsd: recorded.costUsd, validation });
  if (!turn.ok) break; // a refusal stops the run: the schema is reduced before anything more is spent (S-4)
}
console.log(JSON.stringify({ summary, ledger: { calls: ledger.calls.length, spentUsd: Number(spent().toFixed(6)) } }, null, 2));
