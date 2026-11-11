// api/_utils/huddle/scriptPrompt.js
//
// Huddle S1 — THE SCRIPT (spec V1.1 §5.3 "Script", §7; Amendment A §A7; Amendment C V1.2
// §C5, §C10, §C12). One Sonnet call per player returns the beats as structured JSON:
// `names[]`, the yesterday / tape / names / armor beats as sentences each carrying
// `evidenceIds[]`, `mentionedTickers[]`, and `planProposal` (template instances only).
// THE PLAN BEAT IS NEVER WRITTEN BY THE MODEL: code narrates it (planTemplates.narratePlan).
//
// MODEL. "Sonnet", unversioned, is the current Sonnet: `claude-sonnet-5-5`. A forced
// tool_choice is a 400 on it, so the schema guarantee V1.1 §5.3's "forced tool" asked for
// comes from structured outputs (`output_config.format`, a JSON schema) instead. Thinking
// is left adaptive (the parameter omitted) at `effort: 'low'`. `stop_reason` and `usage`
// are logged on every answer; a `refusal` is a failed attempt with its category.
//
// VALIDATION (validateScript): every names-beat sentence cites at least one gathered
// evidence id, and every cited id exists (A7); an `unverified` item is cited only by a
// sentence that says "unverified" (C5); `mentionedTickers[]` and every ticker-shaped word
// are inside the universe or the index names (AR-12); the voice rules' forbidden patterns
// (docs/design/SHADOW_VOICE_RULES_V1.md §2, C12's volume rule included) do not occur; each
// beat stays under its length cap. A beat that fails is regenerated once, then dropped and
// the drop recorded; a ticker outside the universe after the regeneration fails the job.
//
// AMENDMENT E §E3 (Fable's rulings R-22–R-25 and the Nov 9 smoke). The rules are fixed at
// the INPUT first — the model is never handed what it must not say: every date in the user
// prompt is spoken ("Friday, November 6"), a skipped source is not in it at all, a
// publication is named, not its host, and no calendar count appears — and checked at the
// OUTPUT: the forbidden patterns gain `archetype_person` (E3 b), `iso_date` (d),
// `calendar_count` (f) and `source_outage` (a, scoped to a sentence that names a source, so
// "SPY closed down" is not one); the names beat must start with the largest holding exposure
// (`exposure_order`, E3 c; ties accepted, vacuous with nothing held); and a tape sentence that
// names an index cites a `tape` item (`tape_uncited`, E3 g). Each beat's character cap is a
// number in its own instruction. Effort is `medium` (Fable's review §4: every S1 script and
// the Nov 9 smoke's regenerated at `low`).

import Anthropic from '@anthropic-ai/sdk';
import { STANCE_KINDS, LINE_KINDS, MAX_STANCES, MAX_LINES } from './planTemplates.js';
import { spokenDateOf, spokenWhenOf } from './spoken.js';
import { PUBLICATION_NAMES } from '../evidence/publicationNames.js';

export const HUDDLE_SCRIPT_MODEL = 'claude-sonnet-5-5';
export const HUDDLE_SCRIPT_EFFORT = 'medium';
export const HUDDLE_SCRIPT_MAX_TOKENS = 8000;
export const MODEL_BEATS = Object.freeze(['yesterday', 'tape', 'names', 'armor']);
export const BEAT_CHAR_CAP = Object.freeze({ yesterday: 260, tape: 380, names: 950, armor: 320 });
export const INDEX_NAMES = Object.freeze(['SPY', 'QQQ', 'DIA', 'IWM', 'VIX']);
/** Capital words that are not tickers (the scan's allowance; anything else capital must be a declared, in-universe ticker). */
export const ACRONYMS = Object.freeze([
  'AM', 'PM', 'ET', 'US', 'USA', 'UK', 'EU', 'CPI', 'PPI', 'PCE', 'GDP', 'ISM', 'FOMC', 'NFP', 'JOLTS', 'EPS', 'CEO', 'CFO',
  'AI', 'ETF', 'ETFS', 'IPO', 'SEC', 'FDA', 'FTC', 'DOJ', 'NYSE', 'EODHD', 'OK', 'TV', 'API', 'GLP', 'EV', 'EVS', 'BMO', 'AMC',
]);

/** What a source is called in a sentence (E3 a) — the subject `source_outage` looks for. */
const SOURCE_SUBJECT = String.raw`(?:newsfilter|eodhd(?:\s+news)?|fantasytimes|news\s+(?:sources?|feeds?|wires?)|(?:earnings|macro)\s+calendar|market\s+context|sources?|feeds?)`;

/**
 * The voice rules' forbidden patterns (SHADOW_VOICE_RULES_V1.md §2). Each is tested per
 * sentence. Learning words count only in a sentence about Shadow, the agent or "I/we".
 */
export const FORBIDDEN_SCRIPT_PATTERNS = Object.freeze({
  clock_930: /\b9:30\b/,
  agent_clock: /\bagent\b[^.]*\b(?:at|by)\s+(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM)|noon|nine|ten|eleven)\b|\b(?:at|by)\s+(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM)|noon|nine|ten|eleven)\b[^.]*\bagent\b/i,
  guarantee: /\bguarantee/i,
  will_do: /\bwill do\b|\b(?:agent|it)\s+will\s+(?:buy|sell|trade|swap|act|execute|follow|sit|hold)\b/i,
  has_seen: /\bhas seen\b/i,
  premarket_number: /pre-?market[^.]*\d|\d[^.]*pre-?market/i,
  confirmation: /\bconfirm/i,
  nothing_happened: /\bnothing happened\b/i,
  rvol: /\brvol\b/i,
  volume_number: /\bvolume\b[^.]{0,40}\d|\d[\d.,%x]*\s*(?:[a-z-]+\s+){0,3}volume\b/i,
  // E3 b (R-23): the archetype in the third person — never "As a Diversifier, I …", "as the Contrarian, you …" nor
  // "As your Diversifier, I …" (E3 b's regex letter, widened to the article forms the rule forbids too: review HD-10)
  archetype_person: /\b[Aa]s (?:an?|the|your) [A-Z]\w*(?: \w+)?, (?:I|you)\b/,
  // E3 d: never an ISO date
  iso_date: /\b\d{4}-\d{2}-\d{2}\b/,
  // E3 f: no calendar mechanics — "Eight of 256 … reports", "256 reports", "45 earnings reports", "reports are listed".
  // A count is a whole number before PLURAL "reports" (at most one calendar word between) or before companies / names /
  // stocks that "report" ("Over 40 companies report today"); never a price's decimals ("closed at 53.07 and reports after
  // the close"), a clock ("the 8:30 jobs report"), a month and day ("On Tuesday, November 10, RKLB reports") nor a year
  // ("its 2026 earnings reports"), which E3 f asks Shadow to say or which say nothing of the calendar (review HD-3).
  calendar_count: /\b(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+of\s+(?:the\s+)?\d[\d,]*\b[^.]*\breports?\b|(?<![\d.,:])(?<!\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s)\b(?!(?:19|20)\d{2}\b)\d[\d,]*\s+(?:(?:(?:earnings|company|corporate|quarterly)\s+)?reports\b|(?:companies|names|stocks|firms|tickers|issuers)\s+(?:(?:are|were)\s+)?(?:(?:due|set|scheduled)\s+to\s+)?report)|\breports?\s+(?:are\s+|were\s+)?listed\b/i,
  // E3 a (R-22): no false outage of a SOURCE — down, unavailable, offline, "not checked" / "wasn't checked" / "not
  // available" said of a source, or an outage in a sentence that names a source. "Outage" in a headline about a name
  // ("restored power after a storm outage") is market news, not a source (review HD-4).
  source_outage: new RegExp(
    `\\b${SOURCE_SUBJECT}\\b(?:\\s+(?:was|were|is|are|went|been|being|both|all|also|still|either|appeared|seemed|showed))*\\s+`
    + `(?:down|unavailable|offline|(?:not\\s+|(?:was|were|is|are)n['’]t\\s+)(?:checked|available|reachable))\\b`
    + `|\\b${SOURCE_SUBJECT}\\b[^.]*\\boutages?\\b|\\boutages?\\b[^.]*\\b${SOURCE_SUBJECT}\\b`,
    'i',
  ),
});
const LEARNING = /\b(?:learn\w*|improv\w*|smarter|evolv\w*|grows?|growing|grew|grown|remember\w*|level(?:s|ed)?\s+up|unlock\w*|intelligen\w*)\b/i;
const ABOUT_US = /\b(?:agent|shadow|I|I'm|I've|we|we're|me|my)\b/i;

const SENTENCE = { type: 'object', additionalProperties: false, required: ['text', 'evidenceIds'], properties: { text: { type: 'string' }, evidenceIds: { type: 'array', items: { type: 'string' } } } };
const BEAT = { type: 'object', additionalProperties: false, required: ['sentences'], properties: { sentences: { type: 'array', items: SENTENCE } } };
const NULLABLE = (t) => ({ anyOf: [t, { type: 'null' }] });

/** The answer's JSON schema (structured outputs: every object closed, every key required). */
export const SCRIPT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['names', 'yesterday', 'tape', 'namesBeat', 'armor', 'mentionedTickers', 'planProposal'],
  properties: {
    names: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ticker', 'read', 'evidenceIds'], properties: { ticker: { type: 'string' }, read: { type: 'string' }, evidenceIds: { type: 'array', items: { type: 'string' } } } } },
    yesterday: NULLABLE(BEAT),
    tape: BEAT,
    namesBeat: BEAT,
    armor: BEAT,
    mentionedTickers: { type: 'array', items: { type: 'string' } },
    planProposal: {
      type: 'object',
      additionalProperties: false,
      required: ['stances', 'lines'],
      properties: {
        stances: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'ticker', 'level'], properties: { kind: { type: 'string', enum: [...STANCE_KINDS] }, ticker: { type: 'string' }, level: NULLABLE({ type: 'number' }) } } },
        lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'eventId', 'ticker', 'level'], properties: { kind: { type: 'string', enum: [...LINE_KINDS] }, eventId: NULLABLE({ type: 'string' }), ticker: NULLABLE({ type: 'string' }), level: NULLABLE({ type: 'number' }) } } },
      },
    },
  },
});

/** The stable system prompt (the voice rules, condensed; no date or player data, so it caches). */
export const SYSTEM_PROMPT = [
  'You are Shadow, a research partner who records a short spoken morning huddle for one player of a stock-trading game. The player listens before the market opens. You are "I". You speak to the player as "you"; the player\'s trading agent is "your agent"; the player\'s archetype is always spoken of in the third person, as "your Contrarian" or "the Contrarian" (with the archetype\'s own name).',
  '',
  'WHAT TO WRITE. Four beats, each a few short spoken sentences, each under its character cap:',
  '- "yesterday": at most 260 characters, only when a prior plan is given (else null);',
  '- "tape": at most 380 characters: the prior session\'s market picture, citing a TAPE item in EVIDENCE for every index you name, and whether and when the player\'s own names report (from REPORTS and the events in EVIDENCE). Never a count of the day\'s reports or of any list;',
  '- "namesBeat": at most 950 characters: one to three of the player\'s names. Start with the largest holding (marked in NAMES) and say what was, or was not, found on it; then the others in NAMES order. For each: the fact, its source and when, and your read;',
  '- "armor": at most 320 characters: what the player\'s archetype makes of the morning, in its method\'s terms, said as "your Contrarian thinks …" or "the Contrarian would …" — never "As a Contrarian, I …" and never "As a Contrarian, you …".',
  'Then propose a game plan as template instances only. Do not write the plan as prose: code speaks it.',
  'Target 60 to 90 seconds spoken in total; a truly empty morning is about 30 seconds and says "nothing found on your names in the sources we checked".',
  '',
  'EVIDENCE. Every fact you state comes from the EVIDENCE list, and each sentence lists the ids of the items it uses in evidenceIds. Every sentence of namesBeat must cite at least one id. Never cite an id that is not in the list. A headline is something a source reported: say "{source} reported …", never state its claim as true, and name the publication exactly as EVIDENCE names it. Prices are the prior session\'s closes only, said as such, with their date. If an item\'s status is "unverified", say the word "unverified" in that sentence. A source that could not be reached is in EVIDENCE as "Couldn\'t reach …": you may say that, in those words. Never say a source was down, unavailable, offline or not checked, and never mention a source that is not in EVIDENCE.',
  '',
  'DATES. Say a date as a weekday or a month and day ("Friday", "November 6"), never as numbers such as 2026-11-06.',
  '',
  'TICKERS. Name only tickers from UNIVERSE (and the index names SPY, QQQ, DIA, IWM, VIX). List every ticker you name in mentionedTickers. Do not write any other word in capital letters except standard acronyms such as CPI, GDP, ISM, FOMC, ET, AM, PM, EPS.',
  '',
  'NEVER: promise a clock time for the agent (it reads the plan "at its next check"); say anything about the player confirming, editing or skipping; say the agent "will" do something, or anything is "guaranteed", or the agent "has seen" anything; give a pre-market price or number; claim that you or the agent learn, improve, grow, remember or get smarter; mention trading volume or relative volume at all (the volume picture is unknown); say "nothing happened" (say "nothing found in the sources we checked"); count the calendar\'s reports or say how many are listed.',
  '',
  'PLAN PROPOSAL. stances: at most 3, each { kind, ticker, level } with kind one of HOLD, TRIM, CHASE, FADE, WATCH, the ticker from UNIVERSE, and level a price with at most two decimals within 25% of that ticker\'s prior close (only for CHASE or FADE "above" a level; otherwise null). lines: at most 2, each { kind, eventId, ticker, level } with kind one of NO_ADDS_BEFORE (eventId from EVENT IDS: a print inside today\'s session; ticker and level null), NO_ADDS_TO_BEFORE_REPORT (ticker from REPORTS: a name that reports after today\'s close or before the next open; eventId and level null), NO_SWAPS_TODAY (all null), CUT_IF_BELOW or NO_CHASE_ABOVE (ticker from UNIVERSE and a level; eventId null). An earnings report is never a NO_ADDS_BEFORE event: it would freeze every add all day. Propose only what the evidence supports; an empty plan is fine on a quiet morning.',
  '',
  'Vary your opening by weekday. Plain spoken English, no lists, no markup, no emoji.',
].join('\n');

/** Pure: the user prompt — the morning's facts, as structured text. */
export function buildUserPrompt({ etDate, weekday, gathered, archetypeLabel, archetypeDisposition, regenerationNote = null }) {
  const lines = [];
  // E3 d: the date as it is said, never ISO (the Nov 9 script repeated "2026-11-06" from this input)
  lines.push(`DATE: ${spokenDateOf(etDate) ?? weekday}`);
  lines.push(`ARCHETYPE (say "your ${archetypeLabel || 'archetype'}" or "the ${archetypeLabel || 'archetype'}"): ${archetypeLabel || 'unknown'}${archetypeDisposition ? ` — "${archetypeDisposition}"` : ''}`);
  lines.push(`UNIVERSE: ${[...gathered.universe].join(', ') || '(none)'}`);
  // E3 c: the names beat starts with the largest holding exposure (ties accepted)
  const leaders = new Set(Array.isArray(gathered.exposureLeaders) ? gathered.exposureLeaders : []);
  lines.push('NAMES (largest exposure first):');
  for (const n of gathered.names.slice(0, 8)) {
    const close = gathered.closes.get(n.ticker);
    lines.push(`  ${n.ticker} — ${n.source}${leaders.has(n.ticker) ? ' · largest holding' : ''}${typeof close === 'number' ? `, prior close ${close.toFixed(2)}` : ', no prior close on file'}`);
  }
  const t = gathered.tape;
  // E3 g: the index figures are TAPE items in EVIDENCE (cite them); this line carries only the picture's words
  const tapeItems = (gathered.evidence || []).filter((e) => e?.kind === 'tape').length;
  const indexNote = tapeItems > 0 ? 'Index closes: the TAPE items in EVIDENCE.' : 'No index closes this morning: name no index figure.';
  lines.push(t ? `TAPE (the prior session's picture): regime ${t.regime ?? 'unknown'}; breadth ${t.breadthTier ?? 'unknown'}; volatility ${t.volatilityRegime ?? 'unknown'}; top sector ${t.topSector ?? 'unknown'}${t.topSectorChange !== null && t.topSectorChange !== undefined ? ` (${t.topSectorChange}%)` : ''}; worst sector ${t.worstSector ?? 'unknown'}${t.worstSectorChange !== null && t.worstSectorChange !== undefined ? ` (${t.worstSectorChange}%)` : ''}. ${indexNote}` : 'TAPE: none this morning (say nothing about the market picture).');
  lines.push('EVENT IDS (the only ids a NO_ADDS_BEFORE line may use: prints inside today\'s session):');
  for (const [id, e] of gathered.events.eligible) lines.push(`  ${id} — ${e.label}`);
  if (gathered.events.eligible.size === 0) lines.push('  (none)');
  // Amendment E §E2: the names a NO_ADDS_TO_BEFORE_REPORT line may name
  const reports = gathered.events.reportTickers instanceof Map ? [...gathered.events.reportTickers] : [];
  lines.push('REPORTS (the only tickers a NO_ADDS_TO_BEFORE_REPORT line may name):');
  for (const [sym, e] of reports) lines.push(`  ${sym} — ${e.label}`);
  if (reports.length === 0) lines.push('  (none)');
  lines.push(gathered.priorPlan ? `PRIOR PLAN: ${spokenDateOf(gathered.priorPlan.etDate) ?? 'the prior session'}, ${gathered.priorPlan.status}` : 'PRIOR PLAN: none (write yesterday as null)');
  lines.push('EVIDENCE (id | kind | status | when | fact):');
  for (const e of gathered.evidence) lines.push(`  ${e.id} | ${e.kind} | ${e.status} | ${spokenWhenOf(e.at) ?? '-'} | ${e.fact}`);
  if (regenerationNote) lines.push(`YOUR PREVIOUS ANSWER FAILED THESE CHECKS — fix them: ${regenerationNote}`);
  return lines.join('\n');
}

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 });
  return client;
}

/**
 * The one model call (abortable). Logs stop_reason and usage. Never logs the prompt.
 * @returns {Promise<{ ok: true, output: object, stopReason, usage } | { ok: false, reason: string, stopReason?, usage?, category? }>}
 */
export async function callScriptModel({ system = SYSTEM_PROMPT, user, signal, timeoutMs = 60_000, create = null, log = console }) {
  const send = create || ((body, opts) => anthropic().messages.create(body, opts));
  let response;
  try {
    response = await send({
      model: HUDDLE_SCRIPT_MODEL,
      max_tokens: HUDDLE_SCRIPT_MAX_TOKENS,
      output_config: { effort: HUDDLE_SCRIPT_EFFORT, format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
      system,
      messages: [{ role: 'user', content: user }],
    }, { signal, timeout: timeoutMs });
  } catch (err) {
    log.warn?.('[huddle/script] model call failed', JSON.stringify({ name: err?.name, status: err?.status ?? null }));
    return { ok: false, reason: err?.name === 'AbortError' || /abort/i.test(String(err?.message)) ? 'aborted' : `model_error_${err?.status ?? 'network'}` };
  }
  const stopReason = response?.stop_reason ?? null;
  const usage = { input: response?.usage?.input_tokens ?? null, output: response?.usage?.output_tokens ?? null };
  log.log?.('[huddle/script] answered', JSON.stringify({ model: HUDDLE_SCRIPT_MODEL, stopReason, usage }));
  if (stopReason === 'refusal') return { ok: false, reason: 'model_refusal', stopReason, usage, category: response?.stop_details?.category ?? null };
  if (stopReason === 'max_tokens') return { ok: false, reason: 'output_cut_off', stopReason, usage };
  const text = (response?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('');
  try {
    return { ok: true, output: JSON.parse(text), stopReason, usage };
  } catch {
    return { ok: false, reason: 'unparseable_output', stopReason, usage };
  }
}

/** The plan proposal as template instances: nulls removed (the template's closed schema owns the keys). */
export function proposalOf(output) {
  const strip = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== null && v !== undefined));
  return {
    stances: (output?.planProposal?.stances || []).slice(0, MAX_STANCES * 2).map(strip),
    lines: (output?.planProposal?.lines || []).slice(0, MAX_LINES * 2).map(strip),
  };
}

const TICKERISH = /\b[A-Z]{2,5}(?:\.[A-Z])?\b/g;
/**
 * The publications the evidence layer names (E3 e), longest first. Said as EVIDENCE names them they are not tickers:
 * "CNBC reported", "PR Newswire reported" (review HD-1). Only the whole name is taken out before the scan, so a bare
 * "PR" (a listed ticker) is still checked against the universe.
 */
const SAID_PUBLICATIONS = Object.freeze([...new Set(Object.values(PUBLICATION_NAMES))].sort((a, b) => b.length - a.length));
/** The ticker-shaped words of a text, its publication names taken out first. */
export const tickerishOf = (text) => SAID_PUBLICATIONS.reduce((t, name) => t.split(name).join(' '), String(text ?? '')).match(TICKERISH) || [];

/**
 * Validate the model's beats.
 * @param {object} output  the parsed answer
 * @param {{ universe: Set<string>, evidence: object[], exposureLeaders?: string[] }} ctx  `exposureLeaders`: the names with
 *   the largest holding exposure (gather.exposureLeadersOf; E3 c) — empty, the order check is vacuous
 * @returns {{ beats: Record<string, {sentences: object[]}|null>, beatFailures: Record<string, string[]>, tickerFailures: string[], names: object[] }}
 */
export function validateScript(output, { universe, evidence, exposureLeaders = [] }) {
  const evidenceById = new Map((evidence || []).map((e) => [e.id, e]));
  const allowedTickers = new Set([...(universe || []), ...INDEX_NAMES]);
  const acronyms = new Set(ACRONYMS);
  const tickerFailures = [];
  for (const t of Array.isArray(output?.mentionedTickers) ? output.mentionedTickers : []) {
    // the acronyms the spoken text may use are not tickers wherever they appear (the verification run's first answer
    // listed ISM here and was regenerated for it, build report RF-14)
    if (acronyms.has(t) || SAID_PUBLICATIONS.includes(t)) continue;
    if (!allowedTickers.has(t)) tickerFailures.push(`mentioned:${t}`);
  }
  const beats = {
    yesterday: output?.yesterday ?? null,
    tape: output?.tape ?? null,
    names: output?.namesBeat ?? null,
    armor: output?.armor ?? null,
  };
  const beatFailures = {};
  for (const id of MODEL_BEATS) {
    const beat = beats[id];
    const fails = [];
    if (beat === null) { if (id !== 'yesterday') fails.push('missing'); beatFailures[id] = fails; continue; }
    const sentences = Array.isArray(beat?.sentences) ? beat.sentences : [];
    let chars = 0;
    for (const s of sentences) {
      const text = typeof s?.text === 'string' ? s.text : '';
      chars += text.length + 1;
      const ids = Array.isArray(s?.evidenceIds) ? s.evidenceIds : [];
      if (id === 'names' && ids.length === 0) fails.push('missing_evidence');
      for (const eid of ids) {
        const item = evidenceById.get(eid);
        if (!item) fails.push(`unknown_evidence:${eid}`);
        else if (item.status === 'unverified' && !/\bunverified\b/i.test(text)) fails.push(`unverified_unsaid:${eid}`);
      }
      for (const [name, re] of Object.entries(FORBIDDEN_SCRIPT_PATTERNS)) if (re.test(text)) fails.push(`forbidden:${name}`);
      if (LEARNING.test(text) && ABOUT_US.test(text)) fails.push('forbidden:learning_claim');
      for (const word of tickerishOf(text)) {
        if (acronyms.has(word)) continue;
        if (!allowedTickers.has(word)) tickerFailures.push(`said:${word}`);
      }
      // E3 g (R-25): a tape sentence that names an index cites a `tape` item for it
      if (id === 'tape' && tickerishOf(text).some((w) => INDEX_NAMES.includes(w))
        && !ids.some((eid) => evidenceById.get(eid)?.kind === 'tape')) fails.push('tape_uncited');
    }
    // E3 c (R-24): the names beat's FIRST ticker is a largest holding (ties accepted; nothing held, nothing to check)
    if (id === 'names' && Array.isArray(exposureLeaders) && exposureLeaders.length > 0) {
      const leaders = new Set(exposureLeaders);
      const first = sentences.flatMap((s) => (typeof s?.text === 'string' ? tickerishOf(s.text) : []))
        .find((w) => !acronyms.has(w) && !INDEX_NAMES.includes(w) && (universe || new Set()).has(w));
      if (first !== undefined && !leaders.has(first)) fails.push('exposure_order');
    }
    if (sentences.length === 0 && id !== 'yesterday') fails.push('empty');
    if (chars > BEAT_CHAR_CAP[id]) fails.push('too_long');
    beatFailures[id] = [...new Set(fails)];
  }
  // A name's read is model text the hub publishes on its card (review L2-3): it passes the checks a beat sentence passes
  // (forbidden patterns, the learning claim, no ticker outside the universe, an evidence id, "unverified" said aloud) or
  // the name is DROPPED, with its reasons in nameFailures. Never a regeneration on its own.
  const names = [];
  const nameFailures = {};
  for (const n of Array.isArray(output?.names) ? output.names : []) {
    if (names.length >= 3) break;
    if (!n || !allowedTickers.has(n.ticker) || !(universe || new Set()).has(n.ticker)) continue;
    const read = typeof n.read === 'string' ? n.read.slice(0, 300) : '';
    const ids = (Array.isArray(n.evidenceIds) ? n.evidenceIds : []).filter((e) => evidenceById.has(e));
    const fails = [];
    if (read && ids.length === 0) fails.push('missing_evidence');
    for (const eid of ids) if (evidenceById.get(eid).status === 'unverified' && !/\bunverified\b/i.test(read)) fails.push(`unverified_unsaid:${eid}`);
    for (const [name, re] of Object.entries(FORBIDDEN_SCRIPT_PATTERNS)) if (re.test(read)) fails.push(`forbidden:${name}`);
    if (LEARNING.test(read) && ABOUT_US.test(read)) fails.push('forbidden:learning_claim');
    for (const word of tickerishOf(read)) if (!acronyms.has(word) && !allowedTickers.has(word)) fails.push(`said:${word}`);
    if (fails.length) { nameFailures[n.ticker] = [...new Set(fails)]; continue; }
    names.push({ ticker: n.ticker, read, evidenceIds: ids });
  }
  return { beats, beatFailures, tickerFailures: [...new Set(tickerFailures)], names, nameFailures };
}

/** Does a validation pass with nothing to regenerate? */
export const scriptClean = (v) => v.tickerFailures.length === 0 && Object.values(v.beatFailures).every((f) => f.length === 0);

/** What each failure asks of the regeneration, in words (Amendment E §E3): the code alone did not fix S1's runs. */
export const FAILURE_HINTS = Object.freeze({
  too_long: (beat) => `keep it under ${BEAT_CHAR_CAP[beat]} characters`,
  exposure_order: () => 'start with the largest holding marked in NAMES',
  tape_uncited: () => 'cite a TAPE item for every index you name',
  'forbidden:archetype_person': () => 'speak of the archetype as "your X" or "the X", never "As a X, I/you"',
  'forbidden:iso_date': () => 'say dates as a weekday or a month and day',
  'forbidden:calendar_count': () => 'no count of reports or of any list',
  'forbidden:source_outage': () => 'never say a source was down, unavailable, offline or not checked',
});

/** The note a regeneration carries: the failures, by beat, each with its hint (never the evidence text). */
export function regenerationNoteOf(v) {
  const parts = [];
  if (v.tickerFailures.length) parts.push(`tickers outside the universe: ${v.tickerFailures.join(', ')}`);
  for (const [beat, fails] of Object.entries(v.beatFailures)) {
    if (!fails.length) continue;
    parts.push(`${beat}: ${fails.map((f) => (FAILURE_HINTS[f] ? `${f} (${FAILURE_HINTS[f](beat)})` : f)).join(', ')}`);
  }
  return parts.join('; ');
}
