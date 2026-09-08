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
// (`callGemmaVoice` in api/_utils/gemmaClient.js). Nothing about the request
// shape is restated here. Neither replay writes anything: no Firestore, no
// shadow log, no battle doc.
//
// THE BUDGET IS THE NOMINAL ONE, and that is a stated limit rather than an
// equivalence. The default is the shipped `GEMMA_TIMEOUT_MS` imported from
// api/agent/chat.js, but production CLAMPS it to what remains of the absolute
// turn deadline: `Math.max(0, Math.min(GEMMA_TIMEOUT_MS, turnStartMs +
// TURN_DEADLINE_MS - Date.now()))`. The clamp BEGINS to bite once the prologue
// exceeds TURN_DEADLINE_MS - GEMMA_TIMEOUT_MS (5s at the shipped 24s/19s), so a
// turn with a 10s prologue aborts at 14s where this harness would allow 19s.
// The harness has no prologue at all, so its timeout rate is an OPTIMISTIC
// LOWER BOUND on production's. `--budget-ms` replays at whatever budget the
// founder wants to gate on; the report prints the number it used and says this.
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
//   --budget-ms N     per-call abort budget for the replay (default: the shipped
//                     GEMMA_TIMEOUT_MS, which production clamps BELOW by the
//                     turn's prologue — see THE BUDGET above)
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

import { writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
// The shipped per-call budget, imported rather than restated: a harness that
// declares its own timeout measures its own timeout (chat.timeout.test.js).
import { GEMMA_TIMEOUT_MS, TURN_DEADLINE_MS } from '../agent/chat.js';
// The shipped reply lint (spec §9 gate 1) and the record renderer's own labels.
import {
  REPLY_LINT_RE, RATIONALE_RULE, CURRENT_DIRECTIVE_HEADING, NO_DIRECTIVE_LINE, HYPOTHESIS_LABEL,
} from '../_utils/voiceLayerGrounding.js';
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
// `renderRecordEntry` emits the stored bytes VERBATIM (no stripping), and
// `evaluation.rationale` is free model text — a newline inside it is possible,
// and `(.*)$` under /m would have truncated the extraction at the first one,
// silently scoring only the rationale's first line. Capture lazily to whatever
// starts next: another record entry (`[12:45 PM check]`), the hypothesis line,
// a blank line, or the true end of the string — `$(?![\s\S])`, because under
// /m a bare `$` matches every LINE end and would truncate at the first newline
// exactly as `(.*)$` did.
// Where a rationale ENDS. Derived from the renderer's own block constants
// rather than guessed, so a reworded heading cannot silently make this
// over-capture (BUILD_RULES §9 — one source, not a parallel copy):
//   • the next record entry              `[12:30 PM check] …`
//   • the entry's own hypothesis line    `  Hypothesis recorded at this check…`
//   • the rule printed beside the block  `RATIONALE RULE: …`
//   • the directive block or its absence `CURRENT DIRECTIVE …`
//   • a blank line, or the TRUE end of the string — `$(?![\s\S])`, because
//     under /m a bare `$` matches every LINE end and would truncate at the
//     first newline exactly as `(.*)$` did.
const RATIONALE_BOUNDARIES = [
  String.raw`\n\[`,
  `\\n {2}${escapeRegExp(HYPOTHESIS_LABEL)}`,
  `\\n${escapeRegExp(RATIONALE_RULE.split(':')[0])}`,
  `\\n${escapeRegExp(CURRENT_DIRECTIVE_HEADING.split(/[(:]/)[0].trim())}`,
  `\\n${escapeRegExp(NO_DIRECTIVE_LINE.split(':')[0])}`,
  String.raw`\n\n`,
  String.raw`$(?![\s\S])`,
].join('|');

const RATIONALE_LINE_RE = new RegExp(
  `^ {2}Rationale — (?:${[MOTIVE_AGENT, MOTIVE_SYSTEM].map(escapeRegExp).join('|')}): ([\\s\\S]*?)(?=${RATIONALE_BOUNDARIES})`,
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
/**
 * The run of consecutive words a near-repetition must share. ONE home: the
 * scorer's default and the sentence the report prints about it are the same
 * constant, so the number and its description cannot disagree (BUILD_RULES §9).
 */
export const ECHO_SHINGLE = 5;

export const FORWARD_MARKER_RE = new RegExp([
  String.raw`\bhypothesis\s*:`,
  // The apostrophe is REQUIRED. Optional, `\bi(?:'|’)?ll\b` also matched the
  // plain words "ill" and "id", so "The exit was ill-timed" and "Trade id 4471"
  // scored as forward language — and a false positive is worse than a miss
  // here: it inflates the clause set the OLD control column is scored against
  // too, and tells the founder a historical sentence is a promise.
  String.raw`\bi['’](?:ll|d)\b`,
  String.raw`\b(?:i|we) (?:will|would)\b`,
  // Both conditional shapes: "if X then Y" and the comma form "if X, Y".
  String.raw`\bif\b[^.!?]*\bthen\b`,
  String.raw`\bif\b[^.!?]*,`,
  String.raw`\bexpect(?:s|ed|ing)?\b`,
  String.raw`\bplan(?:s|ning)? to\b`,
  String.raw`\bplan is to\b`,
  String.raw`\bintend(?:s|ing)? to\b`,
  String.raw`\bgoing to\b`,
  String.raw`\bwould (?:rotate|swap|buy|sell|add|trim|exit|enter)\b`,
  String.raw`\bnext check (?:will|swaps|rotates|buys|sells)\b`,
].join('|'), 'i');

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
    // The trailing terminator is STRIPPED. `normalizeForEcho` keeps `.` (so a
    // price like $145.50 survives), which glued the full stop to the clause's
    // last word — so an exact match required the reply to end its sentence at
    // the same word, and for a clause of five words or fewer the shingle
    // fallback IS the exact check, i.e. no fallback at all. "I'll rotate."
    // therefore scored ZERO against a reply that said "I'll rotate the support
    // slot as soon as breadth widens."
    .map((s) => s.replace(/[.!?]+$/, '').trim())
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
export function rationaleForwardEchoes(rationales, reply, { shingle = ECHO_SHINGLE } = {}) {
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

/**
 * The keys BOTH output formats require. `_scratchpad` is in the list because
 * both carry the explicit rule "_scratchpad MUST come first"
 * (voiceLayerGrounding.js GROUNDED_OUTPUT_FORMAT, voiceLayerPrompt.js's
 * shipped one) — a reply that omits it is not the shape the prompt demanded,
 * and gate 1's "schema adherence" that cannot see that is measuring nothing.
 */
export const REQUIRED_REPLY_KEYS = Object.freeze(['_scratchpad', 'response', 'hasDirective']);

/**
 * A grounded `suggestedActions` entry: a directive BY ID (its text is the
 * server's canonical text, never the model's) or a question (§6.2). The legacy
 * string chip is exactly what the grounded format replaces, so on the grounded
 * side a string is a REGRESSION, not a tolerated shape — which is the whole
 * point of checking adherence against the NEW prompt.
 */
function groundedActionsFault(actions) {
  if (actions === null || actions === undefined) return null;
  if (!Array.isArray(actions)) return 'suggestedActions_not_array';
  for (const item of actions) {
    if (typeof item === 'string') return 'suggestedActions_legacy_string_chip';
    if (!item || typeof item !== 'object') return 'suggestedActions_bad_entry';
    if (item.kind === 'directive') {
      if (typeof item.id !== 'string' || !item.id.trim()) return 'directive_chip_without_id';
    } else if (item.kind === 'ask') {
      if (typeof item.text !== 'string' || !item.text.trim()) return 'ask_chip_without_text';
    } else {
      return 'suggestedActions_unknown_kind';
    }
  }
  return null;
}

/**
 * Did the model return the shape the prompt demanded? `parsed` is whatever
 * parseVoiceLayerResponse returned, so a tier-4 parse failure is a schema
 * failure with the parser's own reason.
 *
 * `grounded` turns on the checks that only the NEW format makes: the chip
 * shape §6.2 introduced. Without it the four shapes gate 1 exists to catch —
 * a missing scratchpad, `hasDirective:true` with no directive, legacy string
 * chips, a directive chip with no id — all scored `valid`.
 */
export function schemaAdherence(parsed, { grounded = false } = {}) {
  if (!parsed || typeof parsed !== 'object') return { valid: false, reason: 'not_an_object', missing: [...REQUIRED_REPLY_KEYS] };
  if (parsed.parseError === true) return { valid: false, reason: `parse_${parsed.errorReason || 'unknown'}`, missing: [...REQUIRED_REPLY_KEYS] };
  const missing = REQUIRED_REPLY_KEYS.filter((k) => parsed[k] === undefined);
  if (missing.length) return { valid: false, reason: 'missing_keys', missing };
  if (typeof parsed.response !== 'string' || !parsed.response.trim()) {
    return { valid: false, reason: 'empty_response', missing: [] };
  }
  if (typeof parsed.hasDirective !== 'boolean') return { valid: false, reason: 'hasDirective_not_boolean', missing: [] };
  // A reply that CLAIMS a directive is scored against what production would
  // actually do with it (`normalizeDirective`, chat.js:143-151), so each reason
  // is TRUE of the case it names:
  //   • nothing usable at all, or an object with no `text` → normalizeDirective
  //     returns null and the turn files nothing: the false receipt spec §6.3
  //     exists to prevent.
  //   • a bare STRING → a deviation from both output formats, which show only
  //     the object — but production DOES accept and file it, so it is a format
  //     miss, not a false receipt, and it must not be reported as one.
  if (parsed.hasDirective === true) {
    const d = parsed.directive;
    if (typeof d === 'string' && d.trim()) return { valid: false, reason: 'directive_not_an_object', missing: [] };
    if (!d || typeof d !== 'object') return { valid: false, reason: 'hasDirective_without_directive', missing: [] };
    if (typeof d.text !== 'string' || !d.text.trim()) return { valid: false, reason: 'directive_without_text', missing: [] };
  }
  if (grounded) {
    const fault = groundedActionsFault(parsed.suggestedActions);
    if (fault) return { valid: false, reason: fault, missing: [] };
  }
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

/**
 * Which side actually produced the persisted reply. The record carries the
 * RESOLVED mode (chat.js stamps `getVoiceGroundingMode(uid)`), and resolution
 * only ever yields `'off' | 'shadow' | 'on'` — a `'canary'` FLAG resolves to
 * `'on'` for an allowlisted uid and `'shadow'` for everyone else
 * (`resolveVoiceGroundingMode`, featureFlags.js). So `'canary'` is not a value
 * that can appear here, and testing for it would encode the wrong rule: under
 * the canary flag a NON-allowlisted caller is sent the OLD prompt.
 *
 * Under `'shadow'` chat.js gives `grounded=false` and SENDS the old prompt, so
 * `agentMessage` is the OLD prompt's reply; under `'on'` it is the new one's.
 * Attributing it to both columns (the first cut of the dry run did) printed
 * identical replies and identical lint counts side by side and called one of
 * them the grounded prompt's.
 */
export function persistedReplySide(voiceGroundingMode) {
  return voiceGroundingMode === 'on' ? 'new' : 'old';
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
    persistedReplySide: persistedReplySide(record.voiceGroundingMode),
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
    persistedReplySide: 'old',
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
export function scoreSide({ systemPrompt, call, rationales: given, grounded = false, parse = parseVoiceLayerResponse }) {
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
    schema: parsed ? schemaAdherence(parsed, { grounded }) : { valid: null, reason: call?.skipped ? 'not_called' : (call?.timedOut ? 'timed_out' : 'no_response'), missing: [] },
    lintHits: replyLintHits(text),
    echoes: rationaleForwardEchoes(rationales, text),
  };
}

// ==================== PURE — the run summary ====================

/** The gate's four numbers, over the NEW side (and the old, for the comparison). */
export function summarizeSide(sides) {
  const list = (Array.isArray(sides) ? sides : []).filter(Boolean);
  const called = list.filter((s) => !s.skipped);
  const timeouts = called.filter((s) => s.timedOut).length;
  // A rejected call (401 / 429 / 5xx) also carries a latencyMs — the time to
  // the REJECTION. Counting it as a response time is how a run in which every
  // new-prompt call failed reads as a large latency WIN: fast rejections, no
  // timeouts, and a schema column of 0/0 that nothing draws attention to. Both
  // the timed-out and the errored replays are excluded, and the errors get a
  // row of their own so a failed run cannot look like a fast one.
  const errors = called.filter((s) => !s.timedOut && s.error).length;
  const answered = called.filter((s) => !s.timedOut && !s.error);
  const latencies = answered.filter((s) => typeof s.latencyMs === 'number').map((s) => s.latencyMs);
  const schemaChecked = called.filter((s) => s.schema && typeof s.schema.valid === 'boolean');
  const schemaValid = schemaChecked.filter((s) => s.schema.valid).length;
  return {
    pairs: list.length,
    called: called.length,
    answered: answered.length,
    latency: latencyPercentiles(latencies),
    timeouts,
    timeoutRate: called.length ? timeouts / called.length : null,
    errors,
    errorRate: called.length ? errors / called.length : null,
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
export function renderReport({ pairs, results, dryRun, range, generatedAt, pairFloor = DEFAULT_PAIRS, budgetMs = GEMMA_TIMEOUT_MS }) {
  const oldSummary = summarizeSide(results.map((r) => r.old));
  const newSummary = summarizeSide(results.map((r) => r.new));
  const realPairs = pairs.filter((p) => p.source === 'shadow').length;

  const out = [];
  out.push('# Voice-layer grounding — the paired harness (spec §9, gate 1)');
  out.push('');
  out.push(`**Generated:** ${generatedAt}`);
  out.push(`**Shadow range:** ${range.fromKey} → ${range.toKey} (UTC date keys, \`shadow/${STREAM}/\`)`);
  out.push(`**Pairs:** ${realPairs} real turn(s) + ${pairs.length - realPairs} hostile fixture — floor is ${pairFloor} real turns.`);
  out.push(`**Per-call budget:** ${budgetMs} ms${budgetMs === GEMMA_TIMEOUT_MS ? ' — the shipped `GEMMA_TIMEOUT_MS` (api/agent/chat.js), imported not restated' : ` (\`--budget-ms\`; the shipped nominal is ${GEMMA_TIMEOUT_MS} ms)`}. Production CLAMPS this to what remains of the turn deadline, so a turn whose prologue exceeds ${TURN_DEADLINE_MS - GEMMA_TIMEOUT_MS} ms (\`TURN_DEADLINE_MS - GEMMA_TIMEOUT_MS\`) aborts sooner than this — the timeout rate below is an optimistic lower bound on production's.`);
  if (dryRun) {
    out.push('');
    out.push('> **DRY RUN — no model was called.** The pairs were selected and both prompts assembled; the scorers ran over each turn\'s PERSISTED reply, shown in the column that actually produced it — under `shadow` the OLD prompt is the one that was sent (chat.js), so the grounded column is empty. Re-run without `--dry-run` for the gate.');
  }
  out.push('');
  out.push('## 1. The gate\'s numbers');
  out.push('');
  out.push('| Measure | Old prompt (shipped) | New prompt (grounded) |');
  out.push('|---|---|---|');
  out.push(`| Replays sent | ${oldSummary.called} / ${oldSummary.pairs} | ${newSummary.called} / ${newSummary.pairs} |`);
  out.push(`| Replays ANSWERED | ${oldSummary.answered} | ${newSummary.answered} |`);
  out.push(`| Latency p50 | ${num(oldSummary.latency.p50, ' ms')} | ${num(newSummary.latency.p50, ' ms')} |`);
  out.push(`| Latency p95 | ${num(oldSummary.latency.p95, ' ms')} | ${num(newSummary.latency.p95, ' ms')} |`);
  out.push(`| Latency max | ${num(oldSummary.latency.max, ' ms')} | ${num(newSummary.latency.max, ' ms')} |`);
  out.push(`| Timeouts | ${oldSummary.timeouts} (${rate(oldSummary.timeoutRate)}) | ${newSummary.timeouts} (${rate(newSummary.timeoutRate)}) |`);
  out.push(`| Transport errors | ${oldSummary.errors} (${rate(oldSummary.errorRate)}) | ${newSummary.errors} (${rate(newSummary.errorRate)}) |`);
  out.push(`| Schema adherence | ${oldSummary.schemaValid}/${oldSummary.schemaChecked} (${rate(oldSummary.schemaAdherenceRate)}) | ${newSummary.schemaValid}/${newSummary.schemaChecked} (${rate(newSummary.schemaAdherenceRate)}) |`);
  out.push(`| Reply-lint hits | ${oldSummary.lintHits} across ${oldSummary.pairsWithLintHit} pair(s) | ${newSummary.lintHits} across ${newSummary.pairsWithLintHit} pair(s) |`);
  out.push(`| Rationale forward echoes | ${oldSummary.rationaleEchoes} across ${oldSummary.pairsWithEcho} pair(s) | ${newSummary.rationaleEchoes} across ${newSummary.pairsWithEcho} pair(s) |`);
  out.push('');
  out.push('- **Latency** is over the ANSWERED replays only. A timed-out replay measures the budget and a rejected one (401/429/5xx) measures the time to the rejection; neither is a response time, so both are excluded and counted in their own rows instead. Read the two rows above the latency before reading the latency. Percentiles are linear-interpolation quantiles.');
  // The pattern and the window are INTERPOLATED, never retyped: a hand-copied
  // phrase list is a label that goes stale while the number beside it moves,
  // which is the display-agreement rule (BUILD_RULES §9) applied to a report.
  out.push(`- **Reply lint** is the shipped \`REPLY_LINT_RE\` (\`${REPLY_LINT_RE.source}\`), counted here rather than enforced — spec §9 asks for it as a measurement.`);
  out.push(`- **Rationale forward echoes** = forward-bearing clauses taken from the rationales the GROUNDED prompt carried, found repeated in the reply (exact, or a run of ${ECHO_SHINGLE} consecutive words). Both columns are scored against the same clauses: the old prompt carries no YOUR RECORD, so its column is a control — an echo there came from somewhere other than the record. It measures repetition, not paraphrase; gate 2 is the founder's read.`);
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
export async function runPairs(pairs, { dryRun, call = callGemmaVoice, onPair, timeoutMs = GEMMA_TIMEOUT_MS } = {}) {
  const results = [];
  for (const pair of pairs) {
    // In a dry run the ONE persisted reply belongs to the side that produced
    // it, and the other side is honestly empty.
    const runSide = async (side) => (dryRun
      ? {
        skipped: true,
        text: side === pair.persistedReplySide ? (pair.persistedReply || '') : '',
        latencyMs: null,
        timedOut: side === pair.persistedReplySide ? pair.persistedTimeout : false,
        error: null,
      }
      : replay({ ...pair[side], userMessage: pair.userMessage, call, timeoutMs }));
    const oldCall = await runSide('old');
    const newCall = await runSide('new');
    // One clause set for both sides — see scoreSide's note on the control.
    const rationales = extractRecordRationales(pair.new.systemPrompt);
    results.push({
      old: scoreSide({ systemPrompt: pair.old.systemPrompt, call: oldCall, rationales, grounded: false }),
      new: scoreSide({ systemPrompt: pair.new.systemPrompt, call: newCall, rationales, grounded: true }),
    });
    if (onPair) onPair(pair, results[results.length - 1]);
  }
  return results;
}

// ==================== CLI ====================

export function parseHarnessArgs(argv, now = new Date()) {
  const passthrough = [];
  const opts = { pairs: DEFAULT_PAIRS, out: null, dryRun: false, budgetMs: GEMMA_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') { opts.dryRun = true; continue; }
    if (arg === '--pairs' || arg === '--out' || arg === '--budget-ms') {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      if (arg === '--pairs') {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) throw new Error(`--pairs must be a positive integer: ${value}`);
        opts.pairs = n;
      } else if (arg === '--budget-ms') {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) throw new Error(`--budget-ms must be a positive integer: ${value}`);
        opts.budgetMs = n;
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
    console.error('Usage: node --env-file=.env.local api/scripts/voice-grounding-harness.js [--days N | --from YYYY-MM-DD [--to YYYY-MM-DD]] [--pairs N] [--out PATH] [--budget-ms N] [--dry-run]');
    process.exitCode = 1;
    return;
  }

  if (!args.dryRun && !process.env.OPENROUTER_API_KEY) {
    console.error('[voice-grounding-harness] OPENROUTER_API_KEY not set — the replay needs it (or pass --dry-run)');
    process.exitCode = 1;
    return;
  }

  // The output directory is created BEFORE anything is spent. At the default
  // --pairs 20 a live run is 42 model calls of up to the budget each; losing
  // all of them to a typo in --out, discovered only at the write, is not a
  // failure this script gets to have.
  try {
    mkdirSync(dirname(args.out), { recursive: true });
  } catch (err) {
    console.error(`[voice-grounding-harness] --out ${args.out} is not writable: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  // A live run needs the shadow corpus. A DRY RUN does not: with no
  // credentials it still assembles and scores the hostile pair, which is the
  // half that needs no production data — and the floor check below still says
  // the gate is not met. A MALFORMED credential is the same story: it must not
  // kill the dry run the header promises works without one.
  let bucket = null;
  try {
    bucket = getBucket();
  } catch (err) {
    if (!args.dryRun) {
      console.error(`[voice-grounding-harness] ${err.message}`);
      process.exitCode = 1;
      return;
    }
    console.warn(`[voice-grounding-harness] ${err.message} — dry run continues without the corpus`);
  }
  if (!bucket && !args.dryRun) {
    console.error('[voice-grounding-harness] GCS_CREDENTIALS not set — cannot read the shadow stream');
    process.exitCode = 1;
    return;
  }

  const dateKeys = dateKeysInRange(args.fromKey, args.toKey);
  let selected = [];
  let readFailed = false;
  if (bucket) {
    console.log(`\n[voice-grounding-harness] scanning ${dateKeys.length} day(s) of shadow/${STREAM}/ for paired records…`);
    let seen = 0;
    // Streamed and trimmed per day (readRange's `onDay`): only the newest
    // `--pairs` survive, so a busy range is not held in memory to keep 20.
    const read = await readRange(bucket, dateKeys, {
      onDay: (dateKey, records) => {
        seen += records.length;
        selected = selectPairs([...selected, ...records], { limit: args.pairs });
      },
    });
    readFailed = read.daysFailed > 0 && read.daysRead === 0;
    console.log(`[voice-grounding-harness] ${seen} record(s) read · ${selected.length} carry both prompts${read.daysFailed ? ` · ${read.daysFailed} day(s) COULD NOT BE LISTED` : ''}`);
  } else {
    console.warn('[voice-grounding-harness] no shadow corpus — the run is the hostile fixture only');
  }

  const pairs = [...selected.map(pairFromRecord), buildHostilePair()];
  console.log(`[voice-grounding-harness] replaying ${pairs.length} pair(s) × 2 prompts${args.dryRun ? ' — DRY RUN, no model called' : ` at ${args.budgetMs}ms`}…`);

  const results = await runPairs(pairs, {
    dryRun: args.dryRun,
    timeoutMs: args.budgetMs,
    onPair: (pair, r) => console.log(`  ${pair.id}: old ${sideLine(r.old)} · new ${sideLine(r.new)}`),
  });

  const report = renderReport({
    pairs,
    results,
    dryRun: args.dryRun,
    range: { fromKey: args.fromKey, toKey: args.toKey },
    generatedAt: new Date().toISOString(),
    pairFloor: args.pairs,
    budgetMs: args.budgetMs,
  });
  try {
    writeFileSync(args.out, `${report}\n`, 'utf8');
    console.log(`\n[voice-grounding-harness] report written to ${args.out}\n`);
  } catch (err) {
    // The replays are spent; the report is the only thing left. Print it
    // rather than lose it to a write failure.
    console.error(`[voice-grounding-harness] could not write ${args.out}: ${err.message} — the report follows on stdout\n`);
    console.log(report);
    process.exitCode = 1;
  }

  // Every way this run can fail to be the gate, said out loud and in the exit code.
  const newSide = summarizeSide(results.map((r) => r.new));
  if (readFailed) {
    console.error('[voice-grounding-harness] READ FAILED: no day in the range could be listed — no real pair was selected.');
    process.exitCode = 1;
  }
  if (selected.length < args.pairs) {
    console.error(`[voice-grounding-harness] GATE NOT MET: ${selected.length} paired record(s) found, ${args.pairs} required. Leave 'shadow' running longer, or widen --days.`);
    process.exitCode = 1;
  }
  if (!args.dryRun && newSide.answered === 0) {
    console.error(`[voice-grounding-harness] GATE NOT MET: not one new-prompt replay was answered (${newSide.timeouts} timed out, ${newSide.errors} rejected). The latency figures are meaningless.`);
    process.exitCode = 1;
  } else if (!args.dryRun && newSide.errors > 0) {
    console.warn(`[voice-grounding-harness] ${newSide.errors} of ${newSide.called} new-prompt replays were REJECTED and are excluded from the latency.`);
  }
}

/** One pair's console line — a timeout and a rejection are not a latency. */
function sideLine(side) {
  if (side.timedOut) return 'TIMEOUT';
  if (side.error) return `ERROR (${side.error.slice(0, 40)})`;
  return `${side.latencyMs ?? '—'}ms`;
}

// realpath BOTH sides: Node realpaths the ESM main module for `import.meta.url`
// but leaves `process.argv[1]` as the caller spelled it, so any symlinked
// component — the script, a `~/bin` shim, a repo under a symlinked home,
// macOS's /tmp → /private/tmp — makes the equality false and the CLI exit 0
// having silently done nothing. A no-op that looks like a clean run is the
// worst failure a founder-run gate can have.
const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
})();
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[voice-grounding-harness] fatal:', err);
    process.exitCode = 1;
  });
}
