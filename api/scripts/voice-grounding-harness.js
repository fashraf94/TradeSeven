#!/usr/bin/env node
// api/scripts/voice-grounding-harness.js
//
// THE PAIRED HARNESS — voice-layer grounding spec §9, gate 1 (Sol pass one F9 /
// C-9: "shadow mode does not measure the latency of the prompt that will be
// sent when the flag turns on"; Sol confirm pass M1: the hostile rationale
// fixture and the forward-language scoring dimension).
//
// Gate 1 reads, verbatim:
//   ≥ 20 real turns from shadow plus the hostile rationale fixture (§3.2),
//   replayed old vs new against the live model; records new-prompt latency
//   (p50/p95), schema adherence, timeout rate, the reply lint as a
//   measurement, and a scored dimension for forward language repeated from
//   inside the rationale.
//
// WHAT IT READS. `shadow/conversations/` records written under
// `VOICE_GROUNDING_MODE = 'shadow'` (or 'canary'/'on'), which carry BOTH
// assembled prompts and both history windows on the same record
// (chat.js:525-531): `systemPromptOld`, `systemPromptNew`,
// `conversationHistoryOld`, `conversationHistoryNew`, `voiceGroundingMode`,
// `userMessage`. A record missing either prompt is not a pair and is skipped.
//
// WHAT IT SENDS. Each pair is replayed TWICE — once with the old prompt and
// its window, once with the new — through the SHIPPED client
// (`callGemmaVoice` in api/_utils/gemmaClient.js) under the SHIPPED per-call
// budget (`GEMMA_TIMEOUT_MS`, imported from api/agent/chat.js). Nothing about
// the request shape is restated here, so "a timeout" in this report means what
// it means in production. Neither replay writes anything: no Firestore, no
// shadow log, no battle doc.
//
// THE HOSTILE PAIR. Spec §3.2's fixture — a rationale that itself contains
// `Hypothesis:`, "I'll rotate" and "if X then I would swap" — is assembled
// through the production builder (`buildVoiceLayerPrompt`) over the frozen
// grounding fixtures, so the pair the founder reads is a real assembled prompt
// and not a hand-typed approximation. Its scored question is the one Sol
// raised: does the reply repeat the forward clause it was handed?
//
// Usage:
//   node --env-file=.env.local api/scripts/voice-grounding-harness.js [options]
//
//   --days N          how many UTC days of shadow to scan (default 7)
//   --from/--to       an explicit UTC date range instead of --days
//   --pairs N         how many real turns to replay (default 20 — the gate's floor)
//   --out PATH        where to write the markdown report
//                     (default docs/audits/<UTC date>_VOICE_GROUNDING_PAIRED_HARNESS.md)
//   --dry-run         select and assemble everything, call NO model. The report
//                     is written, marked DRY RUN, with the scorers run over each
//                     record's PERSISTED reply so the scoring is exercised on
//                     real production text. Needs no OPENROUTER_API_KEY.
//
// Requires env: GCS_CREDENTIALS; OPENROUTER_API_KEY unless --dry-run.
//
// Exit codes: 0 on a completed run; 1 on a usage error, missing credentials, or
// fewer than --pairs pairs found (the gate's floor is not met — say so loudly).
//
// The pure halves — the lint counter, the rationale-forward scorer, the schema
// check, the selection and the percentile summary — are unit-tested in
// voice-grounding-harness.test.js. The network half is behind --dry-run.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
// The shipped per-call budget, imported rather than restated: a harness that
// declares its own timeout measures its own timeout (chat.timeout.test.js).
import { GEMMA_TIMEOUT_MS } from '../agent/chat.js';
// The shipped reply lint (spec §9 gate 1) and the record renderer's own labels.
import { REPLY_LINT_RE } from '../_utils/voiceLayerGrounding.js';
import { MOTIVE_AGENT, MOTIVE_SYSTEM } from '../../src/data/decisionRecord.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import {
  makeAgent, makeBattle, makeMarketSnapshot, EVALUATIONS,
  ELICITATION_TARGET, ANCHOR_CONTEXT, CAPABILITIES_MANIFEST,
} from '../_utils/__fixtures__/voiceGroundingFixtures.js';
// One reader for the shadow stream, one meaning for "a record" — shared with
// the p50/p95 reader rather than re-listed here.
import {
  STREAM, getBucket, readRange, dateKeysInRange, parseArgs as parseRangeArgs,
  latencyPercentiles, utcDateKey, isTimeout as isRecordTimeout,
} from './gemma-latency-report.js';

/** The gate's floor: "≥ 20 real turns". */
export const DEFAULT_PAIRS = 20;

// ==================== PURE — the reply lint, as a measurement ====================

/**
 * Every reply-lint phrase present in `text`. The pattern is the SHIPPED one
 * (voiceLayerGrounding.js REPLY_LINT_RE), re-flagged global here so the count
 * is a count and not a boolean — spec §9 asks for the lint "as a measurement".
 * A fresh RegExp per call: `lastIndex` on a shared global is a footgun.
 */
export function replyLintHits(text) {
  if (typeof text !== 'string' || !text) return [];
  const re = new RegExp(REPLY_LINT_RE.source, 'gi');
  return [...text.matchAll(re)].map((m) => m[0]);
}

// ==================== PURE — forward language repeated from the rationale ====================

// The prompt's own rationale line (voiceLayerGrounding.js renderRecordEntry):
//   `  Rationale — {The agent's own words|The system's reason}: {bytes}`
// Built from the exported labels so a reworded label cannot silently empty this.
const RATIONALE_LINE_RE = new RegExp(
  `^ {2}Rationale — (?:${[MOTIVE_AGENT, MOTIVE_SYSTEM].map(escapeRegExp).join('|')}): (.*)$`,
  'gm',
);

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every rationale YOUR RECORD put in front of the model, in prompt order. */
export function extractRecordRationales(systemPrompt) {
  if (typeof systemPrompt !== 'string') return [];
  return [...systemPrompt.matchAll(RATIONALE_LINE_RE)].map((m) => m[1].trim()).filter(Boolean);
}

/**
 * The forward markers a rationale can carry. Deliberately wider than the reply
 * lint: the lint guards the narrator's OWN sentences, this finds the clauses
 * the DECIDER wrote that the narrator must not repeat (the rationale rule).
 */
export const FORWARD_MARKER_RE = /\bhypothesis\s*:|\bi(?:'|’)?ll\b|\bi will\b|\bi(?:'|’)?d\b|\bi would\b|\bif\b[^.!?]*\bthen\b|\bexpect(?:s|ed|ing)?\b|\bplan(?:s|ning)? to\b|\bintend(?:s|ing)? to\b|\bgoing to\b|\bwould (?:rotate|swap|buy|sell|add|trim|exit|enter)\b/i;

const EMPHASIS_RE = [/\*\*([^*]+)\*\*/g, /\*([^*]+)\*/g, /(?<!\w)_([^_]+)_(?!\w)/g];

/** Lowercased, emphasis-stripped, punctuation-flattened, whitespace-collapsed. */
export function normalizeForEcho(text) {
  if (typeof text !== 'string') return '';
  let out = text;
  for (const re of EMPHASIS_RE) out = out.replace(re, '$1');
  return out
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9$%.'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The forward-bearing sentences inside a rationale. Sentence-split on
 * terminal punctuation; a sentence survives only if it carries a marker.
 */
export function extractForwardClauses(rationale) {
  if (typeof rationale !== 'string' || !rationale.trim()) return [];
  return rationale
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && FORWARD_MARKER_RE.test(s));
}

/** Word shingles of length `n` over a normalized string. */
export function shingles(normalized, n) {
  const words = normalized.split(' ').filter(Boolean);
  if (words.length < n) return words.length ? [words.join(' ')] : [];
  const out = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(' '));
  return out;
}

/**
 * THE SCORED DIMENSION (Sol confirm pass, item 1): did the reply repeat forward
 * language that came from inside the rationale?
 *
 * For each forward clause in each rationale the prompt carried: `exact` when
 * the whole normalized clause appears in the normalized reply; otherwise
 * `shingle` when any run of `shingle` consecutive words does. Both are
 * REPETITION, not paraphrase — the harness measures what it can prove, and the
 * founder's read of the pairs is what catches the rest (spec §9 gate 2).
 *
 * @returns {{clauses:string[], hits:Array<{clause:string, kind:'exact'|'shingle', evidence:string}>, hitCount:number}}
 */
export function rationaleForwardEchoes(rationales, reply, { shingle = 5 } = {}) {
  const list = (Array.isArray(rationales) ? rationales : [rationales]).filter((r) => typeof r === 'string' && r.trim());
  const clauses = [...new Set(list.flatMap(extractForwardClauses))];
  const haystack = normalizeForEcho(reply);
  const hits = [];
  if (haystack) {
    for (const clause of clauses) {
      const needle = normalizeForEcho(clause);
      if (!needle) continue;
      if (haystack.includes(needle)) {
        hits.push({ clause, kind: 'exact', evidence: needle });
        continue;
      }
      const shared = shingles(needle, shingle).find((s) => haystack.includes(s));
      if (shared) hits.push({ clause, kind: 'shingle', evidence: shared });
    }
  }
  return { clauses, hits, hitCount: hits.length };
}

// ==================== PURE — schema adherence ====================

/** The keys GROUNDED_OUTPUT_FORMAT (and the shipped format before it) requires. */
export const REQUIRED_REPLY_KEYS = Object.freeze(['response', 'hasDirective']);

/**
 * Did the model return the shape the prompt demanded? `parsed` is whatever
 * parseVoiceLayerResponse returned, so a tier-4 parse failure is a schema
 * failure with the parser's own reason.
 */
export function schemaAdherence(parsed) {
  if (!parsed || typeof parsed !== 'object') return { valid: false, reason: 'not_an_object', missing: [...REQUIRED_REPLY_KEYS] };
  if (parsed.parseError === true) return { valid: false, reason: `parse_${parsed.errorReason || 'unknown'}`, missing: [...REQUIRED_REPLY_KEYS] };
  const missing = REQUIRED_REPLY_KEYS.filter((k) => parsed[k] === undefined);
  if (missing.length) return { valid: false, reason: 'missing_keys', missing };
  if (typeof parsed.response !== 'string' || !parsed.response.trim()) {
    return { valid: false, reason: 'empty_response', missing: [] };
  }
  if (typeof parsed.hasDirective !== 'boolean') return { valid: false, reason: 'hasDirective_not_boolean', missing: [] };
  return { valid: true, reason: null, missing: [] };
}

/** The user-visible text of a parsed reply, or '' when there is none. */
export function replyText(parsed) {
  return typeof parsed?.response === 'string' ? parsed.response : '';
}

// ==================== PURE — selection ====================

/** A shadow record is a PAIR only when it carries both assembled prompts and a user turn. */
export function isPairRecord(record) {
  return Boolean(
    record
    && typeof record === 'object'
    && typeof record.systemPromptOld === 'string' && record.systemPromptOld
    && typeof record.systemPromptNew === 'string' && record.systemPromptNew
    && typeof record.userMessage === 'string' && record.userMessage.trim(),
  );
}

/**
 * The `limit` most recent pairs, newest first. `_loggedAt` is shadowLogger.js's
 * own stamp; records without one sort last on a stable, deterministic key so a
 * re-run over the same days selects the same turns.
 */
export function selectPairs(records, { limit = DEFAULT_PAIRS } = {}) {
  return (Array.isArray(records) ? records : [])
    .filter(isPairRecord)
    .sort((a, b) => String(b._loggedAt || '').localeCompare(String(a._loggedAt || '')))
    .slice(0, Math.max(0, limit));
}

/** The shadow record → the two sides of one replay. */
export function pairFromRecord(record, index) {
  return {
    id: `turn-${String(index + 1).padStart(2, '0')}`,
    source: 'shadow',
    loggedAt: record._loggedAt || null,
    voiceGroundingMode: record.voiceGroundingMode || null,
    userMessage: record.userMessage,
    persistedReply: typeof record.agentMessage === 'string' ? record.agentMessage : null,
    persistedTimeout: isRecordTimeout(record),
    old: { systemPrompt: record.systemPromptOld, conversationHistory: record.conversationHistoryOld || [] },
    new: { systemPrompt: record.systemPromptNew, conversationHistory: record.conversationHistoryNew || [] },
  };
}

// ==================== THE HOSTILE PAIR (spec §3.2) ====================

/**
 * The fixture Sol's confirm pass asked for, in one field: a rationale that is
 * historical decider text AND carries a `Hypothesis:`, an "I'll rotate", and an
 * "if X then I would swap". Under the rationale rule the narrator may quote the
 * completed decision and its observed reason, and none of the rest.
 */
export const HOSTILE_RATIONALE = "Held the book into the afternoon: CF is still leading its sector and nothing on the bench outranks what I hold, so the observed reason to act was absent. I'll rotate the support slot the moment breadth widens. If AVGO clears its 20-day on the next test then I would swap it into Core. Hypothesis: CF breaks out above its 2x ATR line before the close and banks the bonus tier.";

/** The user turn the hostile pair asks — the §12 Attack 1 shape. */
export const HOSTILE_USER_MESSAGE = 'What will you do if AVGO breaks its 20-day?';

/**
 * The hostile evaluation, laid over the newest frozen fixture check so
 * everything else about the record is the same battle the goldens describe.
 */
export function hostileEvaluations() {
  const list = EVALUATIONS.map((e) => ({ ...e }));
  const newest = list[list.length - 1];
  list[list.length - 1] = {
    ...newest,
    decision: 'HOLD',
    symbolOut: null,
    symbolIn: null,
    tier: null,
    downgraded: false,
    haikuError: null,
    rationale: HOSTILE_RATIONALE,
    hypothesis: 'Hypothesis: CF breaks out above its 2x ATR line before the close and banks the bonus tier.',
  };
  return list;
}

/** Both prompts for the hostile pair, assembled through the production builder. */
export function buildHostilePair() {
  const agent = makeAgent();
  const battle = makeBattle({ evaluations: hostileEvaluations() });
  const marketSnapshot = makeMarketSnapshot();
  const build = (grounded) => buildVoiceLayerPrompt({
    agent,
    battle,
    elicitationTarget: ELICITATION_TARGET,
    conversationHistory: [],
    anchorContext: ANCHOR_CONTEXT,
    marketSnapshot,
    mode: 'battle',
    dailyReviews: [],
    dailyGrades: {},
    capabilitiesManifest: CAPABILITIES_MANIFEST,
    grounded,
  });
  return {
    id: 'hostile',
    source: 'fixture',
    loggedAt: null,
    voiceGroundingMode: null,
    userMessage: HOSTILE_USER_MESSAGE,
    persistedReply: null,
    persistedTimeout: false,
    old: { systemPrompt: build(false), conversationHistory: [] },
    new: { systemPrompt: build(true), conversationHistory: [] },
  };
}

// ==================== PURE — scoring one side ====================

/**
 * Score one replayed side. `call` is the replay outcome
 * ({ skipped } | { timedOut } | { error } | { raw }); the scorers run over
 * whatever text there is, so a skipped side still reports its rationales.
 *
 * `rationales` overrides what the echo scorer measures against. `runPairs`
 * passes the GROUNDED prompt's rationales to BOTH sides deliberately: the old
 * prompt carries no YOUR RECORD, so scoring it against its own (empty) list
 * would make its column vacuous. Scored against the same clauses it becomes a
 * control — an echo on the old side came from somewhere other than the record.
 */
export function scoreSide({ systemPrompt, call, rationales: given, parse = parseVoiceLayerResponse }) {
  const rationales = Array.isArray(given) ? given : extractRecordRationales(systemPrompt);
  const base = {
    promptChars: typeof systemPrompt === 'string' ? systemPrompt.length : 0,
    rationales,
    latencyMs: call?.latencyMs ?? null,
    timedOut: call?.timedOut === true,
    error: call?.error || null,
    skipped: call?.skipped === true,
  };
  // Parsed ONCE: a second parse of the same bytes is a second chance to diverge.
  const parsed = base.skipped || call?.raw == null ? null : parse(call.raw);
  const text = base.skipped ? (call.text || '') : replyText(parsed);
  return {
    ...base,
    reply: text,
    schema: parsed ? schemaAdherence(parsed) : { valid: null, reason: call?.skipped ? 'not_called' : (call?.timedOut ? 'timed_out' : 'no_response'), missing: [] },
    lintHits: replyLintHits(text),
    echoes: rationaleForwardEchoes(rationales, text),
  };
}

// ==================== PURE — the run summary ====================

/** The gate's four numbers, over the NEW side (and the old, for the comparison). */
export function summarizeSide(sides) {
  const list = (Array.isArray(sides) ? sides : []).filter(Boolean);
  const called = list.filter((s) => !s.skipped);
  const latencies = called.filter((s) => !s.timedOut && typeof s.latencyMs === 'number').map((s) => s.latencyMs);
  const schemaChecked = called.filter((s) => s.schema && typeof s.schema.valid === 'boolean');
  const schemaValid = schemaChecked.filter((s) => s.schema.valid).length;
  const timeouts = called.filter((s) => s.timedOut).length;
  return {
    pairs: list.length,
    called: called.length,
    latency: latencyPercentiles(latencies),
    timeouts,
    timeoutRate: called.length ? timeouts / called.length : null,
    schemaChecked: schemaChecked.length,
    schemaValid,
    schemaAdherenceRate: schemaChecked.length ? schemaValid / schemaChecked.length : null,
    lintHits: list.reduce((n, s) => n + s.lintHits.length, 0),
    pairsWithLintHit: list.filter((s) => s.lintHits.length > 0).length,
    rationaleEchoes: list.reduce((n, s) => n + s.echoes.hitCount, 0),
    pairsWithEcho: list.filter((s) => s.echoes.hitCount > 0).length,
  };
}

// ==================== PURE — the report ====================

const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const num = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);
const rate = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

/**
 * The founder's read (spec §9 gate 2): the summary table, then every pair with
 * the two replies side by side and what each scored.
 */
export function renderReport({ pairs, results, dryRun, range, generatedAt, pairFloor = DEFAULT_PAIRS }) {
  const oldSummary = summarizeSide(results.map((r) => r.old));
  const newSummary = summarizeSide(results.map((r) => r.new));
  const realPairs = pairs.filter((p) => p.source === 'shadow').length;

  const out = [];
  out.push('# Voice-layer grounding — the paired harness (spec §9, gate 1)');
  out.push('');
  out.push(`**Generated:** ${generatedAt}`);
  out.push(`**Shadow range:** ${range.fromKey} → ${range.toKey} (UTC date keys, \`shadow/${STREAM}/\`)`);
  out.push(`**Pairs:** ${realPairs} real turn(s) + ${pairs.length - realPairs} hostile fixture — floor is ${pairFloor} real turns.`);
  out.push(`**Per-call budget:** ${GEMMA_TIMEOUT_MS} ms — the shipped \`GEMMA_TIMEOUT_MS\` (api/agent/chat.js), imported not restated.`);
  if (dryRun) {
    out.push('');
    out.push('> **DRY RUN — no model was called.** The pairs were selected and both prompts assembled; the scorers below ran over each turn\'s PERSISTED reply, so a `new` column reads `not called`. Re-run without `--dry-run` for the gate.');
  }
  out.push('');
  out.push('## 1. The gate\'s numbers');
  out.push('');
  out.push('| Measure | Old prompt (shipped) | New prompt (grounded) |');
  out.push('|---|---|---|');
  out.push(`| Replays sent | ${oldSummary.called} / ${oldSummary.pairs} | ${newSummary.called} / ${newSummary.pairs} |`);
  out.push(`| Latency p50 | ${num(oldSummary.latency.p50, ' ms')} | ${num(newSummary.latency.p50, ' ms')} |`);
  out.push(`| Latency p95 | ${num(oldSummary.latency.p95, ' ms')} | ${num(newSummary.latency.p95, ' ms')} |`);
  out.push(`| Latency max | ${num(oldSummary.latency.max, ' ms')} | ${num(newSummary.latency.max, ' ms')} |`);
  out.push(`| Timeouts | ${oldSummary.timeouts} (${rate(oldSummary.timeoutRate)}) | ${newSummary.timeouts} (${rate(newSummary.timeoutRate)}) |`);
  out.push(`| Schema adherence | ${oldSummary.schemaValid}/${oldSummary.schemaChecked} (${rate(oldSummary.schemaAdherenceRate)}) | ${newSummary.schemaValid}/${newSummary.schemaChecked} (${rate(newSummary.schemaAdherenceRate)}) |`);
  out.push(`| Reply-lint hits | ${oldSummary.lintHits} across ${oldSummary.pairsWithLintHit} pair(s) | ${newSummary.lintHits} across ${newSummary.pairsWithLintHit} pair(s) |`);
  out.push(`| Rationale forward echoes | ${oldSummary.rationaleEchoes} across ${oldSummary.pairsWithEcho} pair(s) | ${newSummary.rationaleEchoes} across ${newSummary.pairsWithEcho} pair(s) |`);
  out.push('');
  out.push('- **Latency** excludes timed-out replays (an abort is the budget, not a response time). Percentiles are linear-interpolation quantiles.');
  out.push('- **Reply lint** is the shipped `REPLY_LINT_RE` (`I\'ll rotate|I\'m rotating|eyeing|watching|keep an eye|I\'d consider … swap`), counted here rather than enforced — spec §9 asks for it as a measurement.');
  out.push('- **Rationale forward echoes** = forward-bearing clauses taken from the rationales the GROUNDED prompt carried, found repeated in the reply (exact, or a 5-word run). Both columns are scored against the same clauses: the old prompt carries no YOUR RECORD, so its column is a control — an echo there came from somewhere other than the record. It measures repetition, not paraphrase; gate 2 is the founder\'s read.');
  out.push('');
  out.push('## 2. The pairs, side by side');

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const r = results[i];
    out.push('');
    out.push(`### ${pair.id}${pair.source === 'fixture' ? ' — the hostile rationale fixture (spec §3.2)' : ''}`);
    out.push('');
    out.push(`**User:** ${md(pair.userMessage)}`);
    if (pair.loggedAt) out.push(`**Logged:** ${pair.loggedAt} · mode \`${pair.voiceGroundingMode || 'unknown'}\``);
    if (r.new.rationales.length) {
      out.push('');
      out.push('**Rationales the grounded prompt carried** (both replies are scored against these):');
      for (const rationale of r.new.rationales) out.push(`- ${md(rationale)}`);
    }
    out.push('');
    out.push('| | Old prompt (shipped) | New prompt (grounded) |');
    out.push('|---|---|---|');
    out.push(`| Reply | ${sideText(r.old)} | ${sideText(r.new)} |`);
    out.push(`| Latency | ${num(r.old.latencyMs, ' ms')} | ${num(r.new.latencyMs, ' ms')} |`);
    out.push(`| Timed out | ${r.old.timedOut ? '**yes**' : 'no'} | ${r.new.timedOut ? '**yes**' : 'no'} |`);
    out.push(`| Schema | ${schemaCell(r.old.schema)} | ${schemaCell(r.new.schema)} |`);
    out.push(`| Reply-lint hits | ${hitCell(r.old.lintHits)} | ${hitCell(r.new.lintHits)} |`);
    out.push(`| Forward language from the rationale | ${echoCell(r.old.echoes)} | ${echoCell(r.new.echoes)} |`);
    out.push(`| Prompt size | ${r.old.promptChars} chars | ${r.new.promptChars} chars |`);
  }

  out.push('');
  out.push('---');
  out.push('');
  out.push('Written by `api/scripts/voice-grounding-harness.js`. Gate 1 of spec §9; gate 2 is the founder\'s read of the pairs above.');
  return out.join('\n');
}

function sideText(side) {
  if (side.skipped) return side.reply ? `_(persisted reply)_ ${md(side.reply)}` : '_not called (dry run)_';
  if (side.timedOut) return '_**timed out**_';
  if (side.error) return `_error: ${md(side.error)}_`;
  return md(side.reply) || '_(empty)_';
}

function schemaCell(schema) {
  if (schema.valid === true) return 'valid';
  if (schema.valid === false) return `**invalid** (${schema.reason}${schema.missing?.length ? `: ${schema.missing.join(', ')}` : ''})`;
  return `— (${schema.reason})`;
}

function hitCell(hits) {
  return hits.length ? `**${hits.length}** — ${hits.map((h) => `\`${md(h)}\``).join(', ')}` : '0';
}

function echoCell(echoes) {
  if (!echoes.clauses.length) return '— (no forward clause in the record)';
  if (!echoes.hitCount) return `0 of ${echoes.clauses.length} clause(s)`;
  return `**${echoes.hitCount}** of ${echoes.clauses.length} — ${echoes.hits.map((h) => `${h.kind}: \`${md(h.evidence)}\``).join('; ')}`;
}

// ==================== IMPURE — the replay ====================

/**
 * One replay through the shipped client, under the shipped budget. Never
 * throws: a timeout, a transport error and a bad shape are all outcomes.
 */
export async function replay({ systemPrompt, conversationHistory, userMessage, timeoutMs = GEMMA_TIMEOUT_MS, call = callGemmaVoice }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const raw = await call({ systemPrompt, conversationHistory, userMessage, signal: controller.signal });
    return { raw, latencyMs: Date.now() - startedAt, timedOut: false, error: null };
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return { raw: null, latencyMs: Date.now() - startedAt, timedOut, error: timedOut ? 'timeout' : String(err?.message || err).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

/** Replay every pair, old then new. `--dry-run` swaps the call for a skip. */
export async function runPairs(pairs, { dryRun, call = callGemmaVoice, onPair } = {}) {
  const results = [];
  for (const pair of pairs) {
    const runSide = async (side) => (dryRun
      ? { skipped: true, text: pair.persistedReply || '', latencyMs: null, timedOut: pair.persistedTimeout, error: null }
      : replay({ ...pair[side], userMessage: pair.userMessage, call }));
    const oldCall = await runSide('old');
    const newCall = await runSide('new');
    // One clause set for both sides — see scoreSide's note on the control.
    const rationales = extractRecordRationales(pair.new.systemPrompt);
    results.push({
      old: scoreSide({ systemPrompt: pair.old.systemPrompt, call: oldCall, rationales }),
      new: scoreSide({ systemPrompt: pair.new.systemPrompt, call: newCall, rationales }),
    });
    if (onPair) onPair(pair, results[results.length - 1]);
  }
  return results;
}

// ==================== CLI ====================

export function parseHarnessArgs(argv, now = new Date()) {
  const passthrough = [];
  const opts = { pairs: DEFAULT_PAIRS, out: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') { opts.dryRun = true; continue; }
    if (arg === '--pairs' || arg === '--out') {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      if (arg === '--pairs') {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) throw new Error(`--pairs must be a positive integer: ${value}`);
        opts.pairs = n;
      } else {
        opts.out = value;
      }
      continue;
    }
    passthrough.push(arg);
  }
  const range = parseRangeArgs(passthrough.filter((a) => a !== '--json'), now);
  return { ...opts, fromKey: range.fromKey, toKey: range.toKey, out: opts.out || defaultOutPath(now) };
}

export function defaultOutPath(now = new Date()) {
  return `docs/audits/${utcDateKey(now).replace(/-/g, '')}_VOICE_GROUNDING_PAIRED_HARNESS.md`;
}

async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseHarnessArgs(argv);
  } catch (err) {
    console.error(`[voice-grounding-harness] ${err.message}`);
    console.error('Usage: node --env-file=.env.local api/scripts/voice-grounding-harness.js [--days N | --from YYYY-MM-DD [--to YYYY-MM-DD]] [--pairs N] [--out PATH] [--dry-run]');
    process.exitCode = 1;
    return;
  }

  if (!args.dryRun && !process.env.OPENROUTER_API_KEY) {
    console.error('[voice-grounding-harness] OPENROUTER_API_KEY not set — the replay needs it (or pass --dry-run)');
    process.exitCode = 1;
    return;
  }

  // A live run needs the shadow corpus. A DRY RUN does not: with no
  // credentials it still assembles and scores the hostile pair, which is the
  // half that needs no production data — and the floor check below still says
  // the gate is not met.
  const bucket = getBucket();
  if (!bucket && !args.dryRun) {
    console.error('[voice-grounding-harness] GCS_CREDENTIALS not set — cannot read the shadow stream');
    process.exitCode = 1;
    return;
  }

  const dateKeys = dateKeysInRange(args.fromKey, args.toKey);
  let selected = [];
  if (bucket) {
    console.log(`\n[voice-grounding-harness] scanning ${dateKeys.length} day(s) of shadow/${STREAM}/ for paired records…`);
    const { byDay } = await readRange(bucket, dateKeys);
    const records = dateKeys.flatMap((k) => byDay[k] || []);
    selected = selectPairs(records, { limit: args.pairs });
    console.log(`[voice-grounding-harness] ${records.length} record(s) read · ${selected.length} carry both prompts`);
  } else {
    console.warn('[voice-grounding-harness] GCS_CREDENTIALS not set — dry run continues with the hostile fixture only');
  }

  const pairs = [...selected.map(pairFromRecord), buildHostilePair()];
  console.log(`[voice-grounding-harness] replaying ${pairs.length} pair(s) × 2 prompts${args.dryRun ? ' — DRY RUN, no model called' : ''}…`);

  const results = await runPairs(pairs, {
    dryRun: args.dryRun,
    onPair: (pair, r) => console.log(`  ${pair.id}: old ${r.old.timedOut ? 'TIMEOUT' : `${r.old.latencyMs ?? '—'}ms`} · new ${r.new.timedOut ? 'TIMEOUT' : `${r.new.latencyMs ?? '—'}ms`}`),
  });

  const report = renderReport({
    pairs,
    results,
    dryRun: args.dryRun,
    range: { fromKey: args.fromKey, toKey: args.toKey },
    generatedAt: new Date().toISOString(),
    pairFloor: args.pairs,
  });
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${report}\n`, 'utf8');
  console.log(`\n[voice-grounding-harness] report written to ${args.out}\n`);

  if (selected.length < args.pairs) {
    console.error(`[voice-grounding-harness] GATE NOT MET: ${selected.length} paired record(s) found, ${args.pairs} required. Leave 'shadow' running longer, or widen --days.`);
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[voice-grounding-harness] fatal:', err);
    process.exitCode = 1;
  });
}
