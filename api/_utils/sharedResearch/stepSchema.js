// api/_utils/sharedResearch/stepSchema.js
//
// Shared Research — THE MODEL TURN'S SCHEMAS AND THE VALIDATOR (spec §6.4, §6.7,
// §15 S-2, S-3; rulebook docs/design/SHADOW_VOICE_RULES_V1.md §4).
//
// The schemas go to the model as structured outputs (`output_config.format`):
// every object closed, every key required, nullable through anyOf. Structured
// outputs take no length or count limits, so every limit is checked HERE.
//
// validateStepTurn(output, ctx) turns one model answer into finding inputs the
// record model builds, in order, or names the rule it broke. A rule marked ✗ in
// spec §6.4 FAILS THE STEP (nothing is appended; the model is not re-asked —
// one turn per step, R5); the rest downgrade:
//   1. a `retrieval` support must name a real item index → a `retrieval` source
//      with the item's url, `verified`; a bad index downgrades the finding to an
//      `inference`, statusReason `uncited` (the A7 rule). `inference` support →
//      the partner exchange as source, `unverified`/`inference`; `unresolved` →
//      `unavailable` with a typed reason. Dates by §15 S-2; the label's
//      " · undated" when `at` fell back to the read time; the record id by S-3.
//   2. a symbol resolves only inside the universe; ✗ a ticker-shaped word in
//      model text that is not in the universe, the index names or ACRONYMS.
//   3. ✗ a kind outside the model's six (never check_receipt, setup,
//      observation — observations are the player's — nor idea/next_action,
//      which the validator writes itself).
//   4. a company is supported only with a resolved symbol AND a verified
//      relationship finding with that symbol; only then is its claim written.
//   5. ✗ a `supersedes` that names no current finding, or a forked chain.
//   6. ✗ a summary resting on anything but 1–25 current findings, or a summary
//      sentence with a number no basedOn finding holds (`unsupported_number`;
//      a finding holds its fact's numbers and its own dates — heldNumbersOf).
//   7. ✗ the forbidden patterns in the reply, the summary, any fact, a claim or
//      the next action.
//   8. ✗ more than 12 findings, or a step that would take the record past 100.
// ✗ also: a support, company or summary citing a finding the step did not
// write and the record does not hold currently (`invalid_source`).
//
// KB-1 (Amendment A §A4.6): on a turn whose EFFECTIVE method's source is `kb`
// — and on no other turn — three more checks, each ✗ like rule 7
// (kbTurnFailOf): `method_as_source`, `method_example_as_fact`,
// `service_promise`. The next action cites the turn's method (`ctx.method`).

import { createHash } from 'node:crypto';
import {
  FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, RECORD_ID_MAX_LEN, SOURCE_URL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, BASED_ON_MAX,
  FINDINGS_MAX, FINDING_ID_PREFIX, currentFindingsOf, isInstant, buildFinding, isSourceUrl,
} from '../researchRecords/model.js';
import { RELATIONSHIP_ROLES, ROLE_SEPARATOR, UNRESOLVED_REASONS } from '../../../src/constants/sharedResearch.js';
import { gameUniverse, resolveSymbol, namesCompany, isSameCompany } from './companies.js';
import { METHOD_SOURCE, methodMarkersFor } from './method.js';

/**
 * Capital words that are not tickers (the scan's allowance). A COPY of the
 * Huddle script's list (api/_utils/huddle/scriptPrompt.js ACRONYMS — spec §6.4
 * rule 2, K-5), kept here so this module does not load the Huddle's prompt
 * graph; stepSchema.test.js pins the two equal, so they cannot drift. Share one
 * list once a shared home exists.
 */
export const ACRONYMS = Object.freeze([
  'AM', 'PM', 'ET', 'US', 'USA', 'UK', 'EU', 'CPI', 'PPI', 'PCE', 'GDP', 'ISM', 'FOMC', 'NFP', 'JOLTS', 'EPS', 'CEO', 'CFO',
  'AI', 'ETF', 'ETFS', 'IPO', 'SEC', 'FDA', 'FTC', 'DOJ', 'NYSE', 'EODHD', 'OK', 'TV', 'API', 'GLP', 'EV', 'EVS', 'BMO', 'AMC',
]);
export const INDEX_NAMES = Object.freeze(['SPY', 'QQQ', 'DIA', 'IWM', 'VIX']);

/** The kinds the model may write. `idea` and `next_action` are the validator's; `observation` is the player's. */
export const MODEL_FINDING_KINDS = Object.freeze(['coverage', 'release', 'earnings_fact', 'product', 'relationship', 'inference']);
/** The kinds a retrieved item may back. */
export const RETRIEVAL_KINDS = Object.freeze(['coverage', 'release', 'earnings_fact', 'product', 'relationship']);
export const SUPPORT_KINDS = Object.freeze(['retrieval', 'inference', 'unresolved']);
export const STEP_FINDINGS_MAX = 12;
export const REPLY_MAX = 1200;
export const NEXT_LABEL_MAX = 120;
export const NEXT_PURPOSE_MAX = 240;
export const COMPANIES_MAX = 6;
export const FRAME_QUESTION_MAX = 500;
export const FRAME_CHECK_MAX = 300;
export const LABELS = Object.freeze({
  inference: 'Inferred in this step',
  unresolved: 'Not yet checked',
  claim: 'Proposed claim',
  undated: ' · undated',
});
/** The marker when a step proposes no next action — exactly this (spec §16 NS-1): the server never claims the question is answered. */
export const NO_NEXT_STEP_FACT = 'No next step proposed.';
/** A next action that claims the question is answered ("None needed — the question is answered"): not written (NS-1). */
const CLAIMS_ANSWERED = /\b(?:question|it)\s+(?:is|has\s+been|looks|seems|appears)\s+(?:(?:now|fully|already|largely)\s+)?answered\b|\b(?:none|nothing)\s+(?:further\s+)?(?:is\s+)?needed\b|\bno\s+(?:further|next|more)\s+steps?\s+(?:is\s+|are\s+)?needed\b/i;
/** Findings a step may never supersede: the player's own material and the story the investigation started from. */
export const PROTECTED_REASONS = Object.freeze(['player_words', 'player_drop', 'from_drop', 'reporter_content']);

// ── the schemas (structured outputs) ────────────────────────────────────────

const str = (description) => ({ type: 'string', description });
const nullable = (t) => ({ anyOf: [t, { type: 'null' }] });
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

/** What one step turn returns (spec §6.4). Limits are in the descriptions; the validator enforces them. */
export const STEP_SCHEMA = Object.freeze(obj({
  reply: str('What this step found, in plain sentences, at most 1,200 characters.'),
  findings: {
    type: 'array',
    description: 'At most 12 new findings, each one fact.',
    items: obj({
      tempId: str('Your own id for this finding in this answer, e.g. "t1".'),
      kind: { type: 'string', enum: [...MODEL_FINDING_KINDS] },
      fact: str('One fact, at most 500 characters. No ticker outside the list you were given.'),
      symbolCandidate: nullable(str('The symbol, only from the game universe list; otherwise null.')),
      companyName: nullable(str('The company the fact is about, in words; null when it is about no one company.')),
      support: obj({
        kind: { type: 'string', enum: [...SUPPORT_KINDS] },
        index: nullable({ type: 'integer', description: 'retrieval: the item number the fact comes from.' }),
        from: { type: 'array', items: { type: 'string' }, description: 'inference: the finding ids or tempIds it rests on.' },
        reason: nullable({ type: 'string', enum: [...UNRESOLVED_REASONS] }),
      }),
      at: nullable(str("The fact's own date, YYYY-MM-DD, when the source states one; else null.")),
      supersedes: nullable(str('The id of a record finding this one corrects; else null.')),
    }),
  },
  summary: nullable(obj({
    text: str('The answer so far, at most 1,000 characters; every number in it appears in a finding it rests on.'),
    basedOn: { type: 'array', items: { type: 'string' }, description: '1 to 25 finding ids or tempIds.' },
  })),
  lines: obj({
    support: nullable(str('The finding id or tempId that most supports the answer.')),
    complication: nullable(str('The finding id or tempId that most complicates it.')),
    missing: nullable(str('The finding id or tempId of the most important missing link.')),
  }),
  nextAction: nullable(obj({
    label: str('The one next step, at most 120 characters.'),
    purpose: str('Why it is the weakest link, at most 240 characters.'),
  })),
  companies: {
    type: 'array',
    description: 'At most 6 companies this question reaches.',
    items: obj({
      companyName: str('The company, in words.'),
      symbolCandidate: nullable(str('Its symbol, only from the game universe list; otherwise null.')),
      role: { type: 'string', enum: [...RELATIONSHIP_ROLES] },
      relationshipRef: nullable(str('The finding id or tempId of its relationship fact.')),
      openRef: nullable(str('The finding id or tempId of its open significance question.')),
      claim: nullable(obj({
        effect: str('What the development does for this company.'),
        relationship: str('Through which relationship.'),
        evidence: str('Which findings show it.'),
        uncertainty: str('What is not established.'),
      })),
    }),
  },
}));

/** What one framing turn returns (spec §6.3 frame). */
export const FRAME_SCHEMA = Object.freeze(obj({
  question: str('One answerable research question, at most 500 characters.'),
  check: str('What you will check first, at most 300 characters.'),
  notEstablished: str('What the observation does not establish yet, at most 300 characters.'),
}));

// ── text checks ──────────────────────────────────────────────────────────────

const TICKERISH = /\b[A-Z]{2,5}(?:[.-][A-Z])?\b/g;
/** Ticker-shaped words in a text that are not in the universe, the index names or the acronyms. */
export function strayTickersOf(text, universe = gameUniverse) {
  const out = [];
  for (const w of String(text ?? '').match(TICKERISH) || []) {
    if (ACRONYMS.includes(w) || INDEX_NAMES.includes(w)) continue;
    if (universe.has(w.replace('.', '-'))) continue;
    out.push(w);
  }
  return out;
}

/** What a written text says in place of a ticker the universe does not hold (no such ticker is written — spec STOP list). */
export const STRAY_TICKER_MASK = "(symbol not in the app's records)";
/** The text with every ticker-shaped word the universe, the index names and the acronyms do not hold masked. */
export function maskStrayTickers(text, universe = gameUniverse) {
  const stray = new Set(strayTickersOf(text, universe));
  return stray.size ? String(text).replace(TICKERISH, (w) => (stray.has(w) ? STRAY_TICKER_MASK : w)) : text;
}

/**
 * Learning claims (rulebook §2.4, §4 (6)). The strong words count in a sentence
 * about the agent, the partner (by name too), "I" or "we"; the softer ones —
 * business prose uses them ("margins improved", "the deal unlocks orders") —
 * only in a sentence about the agent or the partner.
 */
const LEARNING_STRONG = /\b(?:learn(?:s|ed|t|ing)?|smarter|remember(?:s|ed|ing)?|level(?:s|ed)?\s+up|getting\s+better|got\s+better)\b/i;
const LEARNING_SOFT = /\b(?:improv\w*|evolv\w*|intelligen\w*|unlock\w*|grow(?:s|n|ing)?|grew)\b/i;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Who is the agent (spec §17 FQ-9): "the agent", "your/my/our agent(s)", the partner ("your/my/our/research partner";
// "the partner" is business prose — "the partner portal") and its own name (PARTNER_TOKEN). A bare plural "agents" is
// business prose ("Leasing agents have considered lower rents", "AI agents") and is no one of us.
const PARTNER_WORDS = String.raw`the\s+agent|(?:your|my|our)\s+agents?|(?:your|my|our|research)\s+partner`;
/**
 * The partner's own name stands in a sentence as this token before the subject
 * checks run, so a name with letters outside ASCII ("José", "Élodie") has real
 * word edges (JS `\b` is ASCII-only — refuter SH-4).
 */
const PARTNER_TOKEN = 'PARTNERNAME';
function withPartnerToken(s, partnerName) {
  const n = typeof partnerName === 'string' ? partnerName.trim() : '';
  if (n.length < 2) return s;
  return s.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(n)}(?![\\p{L}\\p{N}_])`, 'giu'), PARTNER_TOKEN);
}
/** Curly apostrophes read as straight ones ("I’ve" is "I've" — refuter SH-3). */
const straightApostrophes = (s) => s.replace(/[‘’ʼ]/g, "'");
/**
 * The words that may stand between "considered" and its subject: auxiliaries, negations ("haven't"), adverbs
 * ("thoroughly"), "too"/"also" and commas around them — never another noun (refuter SH-3).
 */
const CONSIDER_FILLER = String.raw`(?:,?\s+(?:have|has|had|also|already|then|just|first|now|not|never|did|do|does|was|were|is|are|been|being|be|will|would|could|might|may|should|shall|must|too|all|both|ourselves|myself|itself|\w+ly|\w+n't),?)*`;
/** The subjects a sentence is "about us" by: the agent, the partner (and the partner's own name, as PARTNER_TOKEN), I, we. */
const SUBJECTS = Object.freeze({
  us: new RegExp(String.raw`\b(?:${PARTNER_WORDS}|I|I'm|I've|we|we're|we've|me|my|our|${PARTNER_TOKEN})\b`, 'i'),
  agent: new RegExp(String.raw`\b(?:${PARTNER_WORDS}|${PARTNER_TOKEN})\b`, 'i'),
  willDo: new RegExp(String.raw`\b(?:${PARTNER_WORDS}|it|I|we|${PARTNER_TOKEN})\s+will\s+(?:buy|sell|trade|swap|act|execute|hold|short|equip|deploy)\b`, 'i'),
  // spec §16 FQ-3: "considered" with the agent, the partner (by name too), "I" or "we" as its subject — directly, through
  // the filler above ("we have thoroughly considered"), or as the passive's agent ("considered by your agent");
  // "Eaton is widely considered the leader" is business prose and passes.
  considered: new RegExp(String.raw`\b(?:${PARTNER_WORDS}|I|we|${PARTNER_TOKEN})(?:'ve|'d|'re|'m)?${CONSIDER_FILLER}\s+considered\b|\bconsidered\s+by\s+(?:${PARTNER_WORDS}|${PARTNER_TOKEN})\b`, 'i'),
  // "by me" / "by us" case-sensitively: "considered by US regulators" names no one of us (refuter SH-5).
  consideredByUs: /\bconsidered\s+by\s+(?:me|us)\b/,
});
/** The forbidden patterns (spec §6.4 rule 7; rulebook §2 and §4 (6)) that need no subject. Tested per sentence. */
export const FORBIDDEN_PATTERNS = Object.freeze({
  guarantee: /\bguarantee/i,
  will_do: /\bwill do\b/i,
  confidence_number: /\d+(?:\.\d+)?\s*(?:%|percent|per\s*cent|pct)[^.!?]{0,40}\bconfiden|\bconfiden\w*[^.!?]{0,40}\d+(?:\.\d+)?\s*(?:%|percent|per\s*cent|pct)/i,
  price_target: /\bprice\s+targets?\b|\btarget\s+price\b/i,
  price_forecast: /\b(?:shares?|stock|price)\b[^.!?]{0,40}\b(?:could|will|may|might|should|to)\s+(?:climb|rise|fall|drop|reach|hit|trade|head|go)\w*\s+(?:to|toward|towards|above|below|past|near)\s+\$\s?\d/i,
  buy_sell_advice: /\b(?:you|we|I|investors|players?)\s+should\s+(?:buy|sell|short|add|trim|own)\b|\b(?:buy|sell|short)\s+(?:now|the\s+(?:stock|shares|dip))\b|\b(?:good\s+)?time\s+to\s+(?:buy|sell)\b|\bstrong\s+(?:buy|sell)\b|\bis\s+an?\s+(?:strong\s+)?(?:buy|sell)\b/i,
});
/** An imperative "Buy ETN …" / "Sell Eaton …" at a sentence's start (case-sensitive: "Sell-side" and "Short interest" are not advice). */
const IMPERATIVE = /^\s*(?:Buy|Sell|buy|sell)\s+(?:shares\b|the\s+stock\b|[A-Z][\w.&-]*)/;
export const sentencesOf = (text) => String(text ?? '').split(/(?<=[.!?])\s+/).filter(Boolean);

/**
 * The forbidden pattern names a text breaks (each sentence on its own, after
 * Unicode normalization), learning claims included.
 * @param {string} text
 * @param {{ partnerName?: string|null }} [opts]  the partner's own name counts as a subject
 */
export function forbiddenIn(text, { partnerName = null } = {}) {
  const hits = new Set();
  for (const s of sentencesOf(normalizeText(text))) {
    for (const [name, re] of Object.entries(FORBIDDEN_PATTERNS)) if (re.test(s)) hits.add(name);
    const subj = withPartnerToken(straightApostrophes(s), partnerName); // the subject checks read this form
    if (SUBJECTS.willDo.test(subj)) hits.add('will_do');
    if (SUBJECTS.considered.test(subj) || SUBJECTS.consideredByUs.test(subj)) hits.add('considered');
    if (IMPERATIVE.test(s)) hits.add('buy_sell_advice');
    if ((LEARNING_STRONG.test(s) && SUBJECTS.us.test(subj)) || (LEARNING_SOFT.test(s) && SUBJECTS.agent.test(subj))) hits.add('learning_claim');
  }
  return [...hits];
}

/** A finding id or a uuid in a text is an id, not a quantity (refuter SH-13: the prompt shows the model f_<uuid> ids). */
const ID_SHAPED = /\bf_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/** One digit run's comparable form: "1,200" → "1200", "1.90" → "1.9", ".75" → "0.75"; any other spelling ("3,75") is kept raw. */
function numberKeyOf(raw) {
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw)) return String(Number(raw.replace(/,/g, '')));
  if (/^\d*\.?\d+$/.test(raw)) return String(Number(raw));
  return `raw:${raw}`; // never equal to a different spelling: an unreadable figure is never "held" by accident
}
/**
 * The numbers a text states, comparable (after NFKC: a fullwidth ４０ is 40). A
 * digit run glued to a letter or an underscore is an id or a label ("t1",
 * "Q3"), not a stated quantity; so is a finding id. Digits outside ASCII that
 * NFKC leaves (٤٠) are kept raw, so they are never held (refuter SH-9).
 */
export function numberTokensOf(text) {
  const t = String(text ?? '').normalize('NFKC').replace(ID_SHAPED, ' ');
  const out = (t.match(/(?<![A-Za-z_\d])\.?\d(?:[\d.,]*\d)?/g) || []).map(numberKeyOf);
  for (const run of t.match(/\p{Nd}+/gu) || []) if (/[^0-9]/.test(run)) out.push(`raw:${run}`);
  return out;
}

const MONTH_INDEX = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** A real month name or its abbreviation — never a word that starts like one ("declined", "margin": refuter SH-6). */
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec';
const ISO_DAY_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
/** "November 5, 2026", "Nov. 5" — the day not followed by more digits or a percent ("Nov 5%" is no date). */
const MONTH_DAY_RE = new RegExp(String.raw`\b(${MONTHS})\.?\s+(\d{1,2})(?![\d%]|[.,]\d)(?:,?\s+(\d{4})\b)?`, 'gi');

/** The date mentions in a text, `{ y (or null), m, d }`. */
export function dateMentionsOf(text) {
  const t = String(text ?? '').normalize('NFKC');
  const out = [];
  for (const m of t.matchAll(ISO_DAY_RE)) out.push({ y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) });
  for (const m of t.matchAll(MONTH_DAY_RE)) out.push({ y: m[3] ? Number(m[3]) : null, m: MONTH_INDEX[m[1].slice(0, 3).toLowerCase()], d: Number(m[2]) });
  return out;
}
/** The text with the date mentions `keep(mention)` names taken out (all of them when `keep` is omitted). */
function withoutDates(text, keep = () => true) {
  const t = String(text ?? '').normalize('NFKC');
  return t
    .replace(ISO_DAY_RE, (m, y, mo, d) => (keep({ y: Number(y), m: Number(mo), d: Number(d) }) ? ' ' : m))
    .replace(MONTH_DAY_RE, (m, mon, d, y) => (keep({ y: y ? Number(y) : null, m: MONTH_INDEX[mon.slice(0, 3).toLowerCase()], d: Number(d) }) ? ' ' : m));
}

/** The numbers a finding's fact states — never a date's parts, in its dates or in its text (review B2; refuter SH-8). */
export const heldNumbersOf = (f) => (f ? numberTokensOf(withoutDates(f.fact)) : []);

const isUndated = (f) => typeof f?.source?.label === 'string' && f.source.label.endsWith(LABELS.undated);
/**
 * The dates held findings carry: their `at` — unless it is only the day an
 * undated item was read (refuter SH-7: the read day is no fact date) — their
 * `asOf`, and the dates their own text states.
 */
export function heldDatesOf(findings) {
  const out = [];
  for (const f of findings) {
    for (const v of [isUndated(f) ? null : f?.at, f?.asOf]) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) out.push({ y: Number(v.slice(0, 4)), m: Number(v.slice(5, 7)), d: Number(v.slice(8, 10)) });
    }
    out.push(...dateMentionsOf(f?.fact));
  }
  return out;
}
/**
 * The text with every date mention that names one of the held dates taken out.
 * A sentence that dates a fact by a date the fact carries asserts nothing new;
 * any other date's numbers stay and must be held.
 */
export function withoutHeldDates(text, dates) {
  if (!dates || dates.length === 0) return String(text ?? '');
  return withoutDates(text, (x) => dates.some((h) => h.m === x.m && h.d === x.d && (h.y === null || x.y === null || h.y === x.y)));
}
/** The first number a text states that no held finding states (the held dates excused), or undefined. */
export function strayNumberOf(text, held) {
  const nums = new Set(held.flatMap(heldNumbersOf));
  return numberTokensOf(withoutHeldDates(text, heldDatesOf(held))).find((n) => !nums.has(n));
}

// ── small normalizers ───────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex -- control characters never reach a record
const CONTROL = /[\u0000-\u001f\u007f]/g;
/** NFKC (a fullwidth ％ is a %) and no invisible format characters (a zero-width space inside a word). */
const normalizeText = (v) => String(v ?? '').normalize('NFKC').replace(/\p{Cf}/gu, '');
const clean = (v) => (typeof v === 'string' ? normalizeText(v).replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : '');
const cut = (s, max) => (s.length <= max ? s : s.slice(0, max).trimEnd());
/** A date a SOURCE gave (Exa's publishedDate, a stored instant), as an instant; null when it is not a real date. */
export function instantOf(v) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s);
  if (!Number.isFinite(ms)) return null;
  const iso = new Date(ms).toISOString();
  return isInstant(iso) ? iso : null;
}
/**
 * A date the MODEL gave, strictly: "YYYY-MM-DD" naming a real calendar day
 * (2026-02-30 is refused, not rolled to March); anything looser — "2026",
 * "Nov 5", "11/05" — is no date (§15 S-2: the next rule applies).
 */
export function modelDayOf(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null;
  const iso = `${v.trim()}T00:00:00.000Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && new Date(ms).toISOString() === iso ? iso : null;
}

/** A retrieval source's record id (§15 S-3): the url when it fits, else its SHA-256. */
export function retrievalRecordIdOf(url) {
  return url.length <= RECORD_ID_MAX_LEN ? url : `url-sha256:${createHash('sha256').update(url).digest('hex')}`;
}

/**
 * "{host} · {title}" within the label cap; the title is what is trimmed, and " · undated" (S-2 b) is kept whole. A
 * ticker the universe does not hold in the title is masked (spec §6.4 rule 2, the STOP list — refuter SH-10).
 */
export function retrievalLabelOf({ host, title }, { undated = false, universe = gameUniverse } = {}) {
  const tail = undated ? LABELS.undated : '';
  const h = cut(clean(host) || 'source', 60);
  const t = maskStrayTickers(clean(title), universe);
  const room = SOURCE_LABEL_MAX_LEN - h.length - tail.length - ROLE_SEPARATOR.length;
  return t && room > 0 ? `${h}${ROLE_SEPARATOR}${cut(t, room)}${tail}` : `${h}${tail}`;
}

/**
 * A retrieval-backed fact's dates (§15 S-2): `at` is the model's date when it
 * is a real instant no later than the read; else the item's publishedDate; else
 * the read time itself (and the label says " · undated"). `asOf` is the
 * publishedDate when strictly before the write, else null — never the write time.
 * A publishedDate later than the read is no date at all (spec §16 FQ-2): it is
 * treated as absent for both `at` and `asOf`.
 */
export function retrievalDatesOf({ modelAt, publishedDate, readAt, writeAt }) {
  const readMs = Date.parse(readAt);
  const model = modelDayOf(modelAt);
  const given = instantOf(publishedDate);
  const published = given && Date.parse(given) <= readMs ? given : null;
  const asOf = published && Date.parse(published) < Date.parse(writeAt) ? published : null;
  if (model && Date.parse(model) <= readMs) return { at: model, asOf, undated: false };
  if (published) return { at: published, asOf, undated: false };
  return { at: readAt, asOf, undated: true };
}

// ── the frame ───────────────────────────────────────────────────────────────

/** The framing turn: three bounded texts, no forbidden pattern (the partner's own name counts as a subject), no stray ticker. */
export function validateFrame(output, { universe = gameUniverse, partnerName = null } = {}) {
  const q = cut(clean(output?.question), FRAME_QUESTION_MAX);
  const check = cut(clean(output?.check), FRAME_CHECK_MAX);
  const notEstablished = cut(clean(output?.notEstablished), FRAME_CHECK_MAX);
  if (!q || !check || !notEstablished) return { ok: false, rule: 'frame_incomplete' };
  for (const t of [q, check, notEstablished]) {
    const f = forbiddenIn(t, { partnerName });
    if (f.length) return { ok: false, rule: 'forbidden', detail: f[0] };
    const s = strayTickersOf(t, universe);
    if (s.length) return { ok: false, rule: 'stray_ticker', detail: s[0] };
  }
  return { ok: true, frame: { question: q, check, notEstablished } };
}

// ── the step ────────────────────────────────────────────────────────────────

const fail = (rule, detail = null) => ({ ok: false, rule, detail });

/**
 * Validate one step turn.
 * @param {object} output  the parsed model answer
 * @param {object} ctx
 * @param {object} ctx.record        the record as the turn saw it
 * @param {object[]} ctx.items       the retrieval items given to the model ({ index, url, title, host, publishedDate })
 * @param {string|null} ctx.readAt   when the retrieval answered (null: no retrieval this step)
 * @param {string} ctx.partnerExchangeId  the partner exchange this step writes (an inference's source)
 * @param {string} ctx.nowIso        the write time (findings are built at it)
 * @param {() => string} ctx.mintFindingId  a fresh `f_<uuid>`
 * @param {object} [ctx.universe]
 * @param {object} [ctx.method]     the turn's effective method (KB-1): the next action cites its sourceRef, and a
 *                                   `kb` method runs the three method checks; the baseline when omitted
 * @returns {{ ok: true, findings: object[], summary: object|null, lines: object, reply: string, notes: string[] } | { ok: false, rule: string, detail: any }}
 */
export function validateStepTurn(output, ctx) {
  const { record, items = [], readAt = null, partnerExchangeId, nowIso, mintFindingId, universe = gameUniverse, names = {}, partnerName = null, method = null } = ctx;
  const notes = [];
  if (!output || typeof output !== 'object') return fail('unparseable');
  const rawFindings = Array.isArray(output.findings) ? output.findings : [];
  if (rawFindings.length > STEP_FINDINGS_MAX) return fail('too_many_findings', rawFindings.length);
  const current = currentFindingsOf(record);
  const currentById = new Map(current.map((f) => [f.findingId, f]));
  const allById = new Map((Array.isArray(record?.findings) ? record.findings : []).filter((f) => f?.findingId).map((f) => [f.findingId, f]));
  /** Did the supersedes chain that ends at `f` begin with a Source-backed finding (spec §17 FQ-10)? */
  const chainBeganVerified = (f) => {
    let cur = f;
    const seen = new Set();
    while (cur?.supersedes && allById.has(cur.supersedes) && !seen.has(cur.findingId)) { seen.add(cur.findingId); cur = allById.get(cur.supersedes); }
    return cur?.status === 'verified';
  };
  const itemByIndex = new Map(items.map((it) => [it.index, it]));
  const exchangeSource = (label) => ({ recordKind: 'exchange', recordId: partnerExchangeId, label });

  // Every text the model wrote: no forbidden pattern, no stray ticker (rules 2 and 7).
  const textFail = (text, where) => {
    const f = forbiddenIn(text, { partnerName });
    if (f.length) return fail('forbidden', `${where}:${f[0]}`);
    const s = strayTickersOf(text, universe);
    if (s.length) return fail('stray_ticker', `${where}:${s[0]}`);
    return null;
  };
  /**
   * Identity (rule 2, and review B1): a symbol resolves inside the universe —
   * from the candidate, or from a company name written as its ticker — and,
   * when the model names the company, the name must BE that symbol's company
   * (`names`: symbol → the company's stored name). A mismatch keeps no symbol:
   * another company's fact never supports a universe company.
   */
  const identityOf = (candidate, companyName, factText = null) => {
    let symbol = resolveSymbol(candidate, universe);
    if (symbol === null && companyName) symbol = resolveSymbol(companyName, universe);
    if (symbol === null) return null;
    // the named company must BE the symbol's (every word of the name in the stored name — refuter SH-2)
    if (companyName && !isSameCompany(companyName, { symbol, name: names[symbol] })) {
      notes.push(`identity_mismatch:${symbol}`);
      return null;
    }
    // a finding that names no company carries the symbol only when its own fact names that company (refuter SH-1)
    if (!companyName && factText !== null && !namesCompany(factText, { symbol, name: names[symbol] })) {
      notes.push(`identity_unnamed:${symbol}`);
      return null;
    }
    return symbol;
  };

  // tempIds → minted ids (minted once, in order).
  const temp = new Map();
  for (const rf of rawFindings) {
    const t = typeof rf?.tempId === 'string' ? rf.tempId.trim() : '';
    if (!t || temp.has(t) || currentById.has(t)) return fail('invalid_temp_id', t || null);
    temp.set(t, mintFindingId());
  }
  /** A ref to this turn's finding or a current record finding → its id; undefined when it names neither. */
  const resolveRef = (ref) => {
    if (typeof ref !== 'string') return undefined;
    const r = ref.trim();
    if (temp.has(r)) return temp.get(r);
    return currentById.has(r) ? r : undefined;
  };

  // Each finding's identity, resolved once (the roles below and the build both read it).
  const symbolByTemp = new Map(rawFindings.map((rf) => [rf.tempId.trim(), identityOf(rf.symbolCandidate, clean(rf.companyName) || null, clean(rf.fact))]));

  // Roles: a relationship fact takes the role of the company that cites it AND is the same company (same resolved
  // symbol, or both unresolved) — rule 4's "{Role} · {fact}"; review B10.
  const companies = (Array.isArray(output.companies) ? output.companies : []).slice(0, COMPANIES_MAX);
  if (Array.isArray(output.companies) && output.companies.length > COMPANIES_MAX) notes.push('companies_cut');
  const roleByTemp = new Map();
  for (const c of companies) {
    const cSymbol = identityOf(c?.symbolCandidate, clean(c?.companyName) || null);
    for (const key of ['relationshipRef', 'openRef']) {
      const ref = typeof c?.[key] === 'string' ? c[key].trim() : null;
      if (ref && temp.has(ref) && !roleByTemp.has(ref) && symbolByTemp.get(ref) === cSymbol) roleByTemp.set(ref, RELATIONSHIP_ROLES.includes(c.role) ? c.role : 'Other');
    }
  }

  const built = [];
  const builtById = new Map();
  const supersededHere = new Set();
  const build = (raw, findingId) => {
    try {
      const f = buildFinding(raw, { findingId, nowIso });
      built.push(f);
      builtById.set(f.findingId, f);
      return null;
    } catch (err) {
      return fail(err?.code || 'invalid_finding', findingId);
    }
  };

  for (const rf of rawFindings) {
    const tempId = rf.tempId.trim();
    const findingId = temp.get(tempId);
    let kind = rf.kind;
    if (!MODEL_FINDING_KINDS.includes(kind)) return fail('invalid_kind', kind ?? null); // rule 3
    const factText = clean(rf.fact);
    if (!factText) return fail('empty_fact', tempId);
    const tf = textFail(factText, `fact:${tempId}`);
    if (tf) return tf;
    const companyName = clean(rf.companyName) || null;
    if (companyName) {
      const cf = textFail(companyName, `company:${tempId}`);
      if (cf) return cf;
    }
    const symbol = symbolByTemp.get(tempId); // rule 2: inside the universe, and the named company's own — or null
    const support = rf.support && typeof rf.support === 'object' ? rf.support : {};
    let source;
    let status;
    let statusReason;
    let at = partnerAtOf(ctx);
    let asOf = null;
    if (support.kind === 'retrieval') {
      const item = Number.isInteger(support.index) ? itemByIndex.get(support.index) : undefined;
      if (item && kind !== 'inference' && readAt && isSourceUrl(item.url) && item.url.length <= SOURCE_URL_MAX_LEN) {
        const d = retrievalDatesOf({ modelAt: rf.at, publishedDate: item.publishedDate, readAt, writeAt: nowIso });
        source = { recordKind: 'retrieval', recordId: retrievalRecordIdOf(item.url), label: retrievalLabelOf(item, { undated: d.undated, universe }), url: item.url };
        status = 'verified';
        statusReason = null;
        ({ at, asOf } = d);
      } else {
        // rule 1, the A7 rule: an uncited fact is an inference.
        kind = 'inference';
        source = exchangeSource(LABELS.inference);
        status = 'unverified';
        statusReason = 'uncited';
        notes.push(`uncited:${tempId}`);
      }
    } else if (support.kind === 'inference') {
      const from = Array.isArray(support.from) ? support.from : [];
      for (const ref of from) if (resolveRef(ref) === undefined) return fail('invalid_source', `${tempId}:${ref}`);
      source = exchangeSource(LABELS.inference);
      status = 'unverified';
      statusReason = 'inference';
    } else if (support.kind === 'unresolved') {
      // Any of the model's kinds may be a link that could not be checked (an inference included): it is `unavailable`.
      source = exchangeSource(LABELS.unresolved);
      status = 'unavailable';
      statusReason = UNRESOLVED_REASONS.includes(support.reason) ? support.reason : 'not_checked';
    } else {
      return fail('invalid_support', tempId);
    }
    // rule 5: a correction names a current finding, and never forks a chain. It may not retire the player's own
    // material or the story — rule 3 and rulebook §4 (1): they are the player's (review B5). A Source-backed finding is
    // superseded only by another Source-backed finding or an unavailable one (spec §16 FQ-4); and in a chain that BEGAN
    // with a Source-backed finding, the new head may only be verified or unavailable at any depth — never an
    // inference, by kind or by status (spec §17 FQ-10: verified → unavailable → inference is refused at the last link).
    let supersedes = null;
    if (rf.supersedes !== null && rf.supersedes !== undefined) {
      const s = typeof rf.supersedes === 'string' ? rf.supersedes.trim() : '';
      const target = currentById.get(s);
      if (!target) return fail('invalid_supersedes', `${tempId}:${s}`);
      if (!MODEL_FINDING_KINDS.includes(target.kind) || PROTECTED_REASONS.includes(target.statusReason)) return fail('invalid_supersedes', `${tempId}:protected`);
      const guarded = target.status === 'verified' || chainBeganVerified(target);
      if (guarded && (kind === 'inference' || (status !== 'verified' && status !== 'unavailable'))) return fail('invalid_supersedes', `${tempId}:weaker`);
      if (supersededHere.has(s)) return fail('forked_chain', s);
      supersededHere.add(s);
      supersedes = s;
    }
    // The stored fact: a relationship carries its role; a named company the fact does not name (or one with no
    // resolved symbol) is named first; a colon the server did not write never reads as a company (review B9).
    let fact = factText;
    if (kind === 'relationship' || kind === 'product') {
      if (companyName && (symbol === null || !namesCompany(fact, { symbol, name: companyName }))) fact = `${companyName}: ${fact}`;
      else if (!companyName && symbol === null) fact = fact.replace(/^([^:]{1,80}):\s/, '$1 — ');
    }
    if (kind === 'relationship') fact = `${roleByTemp.get(tempId) ?? 'Other'}${ROLE_SEPARATOR}${fact}`;
    fact = cut(fact, FINDING_FACT_MAX_LEN); // cut BEFORE buildFinding, never after (spec §5.2)
    const err = build({ kind, symbol, fact, source, at, asOf, status, statusReason, supersedes }, findingId);
    if (err) return err;
  }

  // The record as it will stand once this turn's findings land: what is current, and what each id says.
  const afterById = new Map([...current.map((f) => [f.findingId, f]), ...built.map((f) => [f.findingId, f])]);
  for (const s of supersededHere) afterById.delete(s);

  // Companies (rule 4): a claim is written only for a supported company; refs must name real findings.
  for (const c of companies) {
    const name = clean(c?.companyName);
    if (!name) continue;
    const nf = textFail(name, 'company');
    if (nf) return nf;
    const relId = c.relationshipRef === null || c.relationshipRef === undefined ? null : resolveRef(c.relationshipRef);
    if (relId === undefined) return fail('invalid_source', `company:${name}:relationshipRef`);
    const openId = c.openRef === null || c.openRef === undefined ? null : resolveRef(c.openRef);
    if (openId === undefined) return fail('invalid_source', `company:${name}:openRef`);
    if (!c.claim) continue;
    const symbol = identityOf(c.symbolCandidate, name);
    const rel = relId ? afterById.get(relId) : null;
    const supported = symbol !== null && rel && rel.kind === 'relationship' && rel.status === 'verified' && rel.symbol === symbol;
    if (!supported) { notes.push(`claim_unsupported:${name}`); continue; }
    const claimText = cut(['effect', 'relationship', 'evidence', 'uncertainty'].map((k) => clean(c.claim[k])).filter(Boolean)
      .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`)).join(' '), FINDING_FACT_MAX_LEN);
    if (!claimText) continue;
    const cf = textFail(claimText, `claim:${symbol}`);
    if (cf) return cf;
    // A claim states no number its company's verified facts do not hold (spec §16 FQ-5; a downgrade, not ✗).
    if (strayNumberOf(claimText, [...afterById.values()].filter((f) => f.symbol === symbol && f.status === 'verified')) !== undefined) {
      notes.push(`claim_unsupported_number:${symbol}`);
      continue;
    }
    const prior = [...afterById.values()].filter((f) => f.kind === 'idea' && f.symbol === symbol).at(-1) ?? null;
    if (prior && supersededHere.has(prior.findingId)) return fail('forked_chain', prior.findingId);
    const priorId = prior && currentById.has(prior.findingId) ? prior.findingId : null;
    if (prior && !priorId) { notes.push(`claim_repeated:${symbol}`); continue; } // one claim per company per step
    const err = build({
      kind: 'idea', symbol, fact: claimText, source: exchangeSource(LABELS.claim), at: partnerAtOf(ctx), asOf: null,
      status: 'unverified', statusReason: 'proposed_claim', supersedes: priorId,
    }, mintFindingId());
    if (err) return err;
    if (priorId) { supersededHere.add(priorId); afterById.delete(priorId); }
    afterById.set(built.at(-1).findingId, built.at(-1));
  }

  // The next action (rule: one, aimed at the weakest link) — it replaces the current one.
  const priorNext = current.filter((f) => f.kind === 'next_action').at(-1) ?? null;
  if (priorNext && supersededHere.has(priorNext.findingId)) return fail('forked_chain', priorNext.findingId);
  let nextFact = null;
  let nextReason = 'proposed';
  if (output.nextAction && typeof output.nextAction === 'object') {
    const label = cut(clean(output.nextAction.label), NEXT_LABEL_MAX);
    const purpose = cut(clean(output.nextAction.purpose), NEXT_PURPOSE_MAX);
    if (label) {
      nextFact = purpose ? `${label} — ${purpose}` : label;
      const nf = textFail(nextFact, 'nextAction');
      if (nf) return nf;
    }
  }
  // spec §16 NS-1: the server never claims the question is answered — a next action that says so is no next action
  // (refuter SH-s); the plain marker stands in its place.
  if (nextFact && CLAIMS_ANSWERED.test(nextFact)) { notes.push('next_action_claims_answered'); nextFact = null; }
  if (!nextFact && priorNext && priorNext.statusReason !== 'no_next_step') { nextFact = NO_NEXT_STEP_FACT; nextReason = 'no_next_step'; }
  let nextActionId = null;
  if (nextFact) {
    nextActionId = mintFindingId();
    const err = build({
      kind: 'next_action', symbol: null, fact: nextFact, source: { ...(method?.sourceRef ?? METHOD_SOURCE) }, at: partnerAtOf(ctx), asOf: null,
      status: 'unverified', statusReason: nextReason, supersedes: priorNext ? priorNext.findingId : null,
    }, nextActionId);
    if (err) return err;
    if (priorNext) afterById.delete(priorNext.findingId);
    afterById.set(built.at(-1).findingId, built.at(-1));
  }

  // rule 8: the record's own cap.
  const stored = Array.isArray(record?.findings) ? record.findings.length : 0;
  if (stored + built.length > FINDINGS_MAX) return fail('findings_full', stored + built.length);

  // The summary (rule 6): 1–25 current findings; every number it states is in one of them that is Source-backed
  // (spec §16 FQ-5: an inference, the player's words or a drop claim never backs a number), a mention of such a fact's
  // own date excused (review B2). A summary whose number no verified cited finding holds is WITHHELD, not a failed
  // step: the answer keeps its last revision and the step's findings still land. Its other faults still fail the turn.
  let summary = null;
  let summaryText = '';
  if (output.summary && typeof output.summary === 'object') {
    const text = clean(output.summary.text);
    summaryText = text;
    if (!text) return fail('invalid_summary');
    if (text.length > SUMMARY_TEXT_MAX_LEN) return fail('summary_too_long', text.length);
    const tf = textFail(text, 'summary');
    if (tf) return tf;
    const refs = Array.isArray(output.summary.basedOn) ? output.summary.basedOn : [];
    const basedOn = [];
    for (const ref of refs) {
      const id = resolveRef(ref);
      if (id === undefined) return fail('invalid_source', `summary:${ref}`);
      if (!afterById.has(id)) return fail('invalid_based_on', `superseded:${id}`);
      if (!basedOn.includes(id)) basedOn.push(id);
    }
    if (basedOn.length === 0 || basedOn.length > BASED_ON_MAX) return fail('invalid_based_on', basedOn.length);
    const held = basedOn.map((id) => afterById.get(id)).filter((f) => f.status === 'verified');
    const missing = sentencesOf(text).map((sentence) => strayNumberOf(sentence, held)).find((n) => n !== undefined);
    if (missing !== undefined) notes.push(`summary_withheld:unsupported_number:${missing}`);
    else summary = { text, basedOn };
  }

  // The lines: refs to findings that will be current; anything else is dropped.
  const lineOf = (ref) => {
    const id = ref === null || ref === undefined ? null : resolveRef(ref);
    return id && afterById.has(id) ? id : null;
  };
  const lines = {
    support: lineOf(output.lines?.support),
    complication: lineOf(output.lines?.complication),
    missing: lineOf(output.lines?.missing),
  };

  let reply = cut(clean(output.reply), REPLY_MAX);
  const replyText = reply; // as the model wrote it, before any replacement (the KB checks read this)
  if (reply) {
    const rf = textFail(reply, 'reply');
    if (rf) return rf;
    // spec §17 FQ-15: the reply gets the summary's number check, against the Source-backed facts on the record as this
    // turn leaves it. A reply that fails is replaced — the step's findings still land, the step does not fail.
    const recordFacts = [...afterById.values()].filter((f) => f.status === 'verified');
    const stray = sentencesOf(reply).map((sentence) => strayNumberOf(sentence, recordFacts)).find((n) => n !== undefined);
    if (stray !== undefined) {
      notes.push(`reply_replaced:unsupported_number:${stray}`);
      reply = replacedReplyOf(built.length, summary !== null);
    }
  }
  // KB-1: the KB method's three checks, after every B1 rule — on a `kb` turn only (Rule 4).
  const kb = kbTurnFailOf({ method, findings: built, nextActionId, current: [...afterById.values()], summaryText, replyText, partnerName });
  if (kb) return kb;
  return { ok: true, findings: built, summary, lines, reply, notes };
}

// ── the KB method's three checks (Amendment A §A4.6; KB-1) ─────────────────────
//
// They run ONLY on a turn whose effective method's source is `kb`: a baseline
// turn is validated by B1's rules exactly as before. Each fails the step, as
// rule 7 does — nothing is appended, the failure is recorded, a typed refusal
// (`invalid_<rule>`). In order:
//   method_as_source        a finding other than the step's one next action
//                           whose source is `kb` (a structural guard: the
//                           validator writes no other today)
//   method_example_as_fact  the method's own register (method.js markers, for
//                           its exact bytes; a method with none runs no check):
//                           a bracketed group of its source ids, or one right
//                           after "per", "see", "under" or "from", in the reply,
//                           the summary or any fact; and a sentence naming the
//                           worked example's name with its date in a
//                           non-retrieval finding's fact, the summary or the
//                           reply — unless the record (as this step leaves it)
//                           holds a current retrieval-backed finding naming both
//   service_promise         the reply, the summary or any fact naming Practice
//                           Field, Film Room or the idea book, or saying the
//                           agent, I, we, the partner (by name too) or this/the/
//                           your idea will (or is going to) test, trial, track,
//                           monitor or adopt
// The texts are read as the model wrote them (the summary even when withheld,
// the reply before any replacement), after Unicode normalization.

/** The text as the three checks read it: NFKC, no invisible format characters, apostrophe-likes straight. */
const readable = (v) => normalizeText(v).replace(/[‘’ʼ‛′]/g, "'");

/** An id of the register as a token: not glued to a letter or a digit on either side. */
const idAlternation = (ids) => `(?<![A-Za-z0-9])(?:${[...ids].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})(?![A-Za-z0-9])`;
/** Between two ids of one group: a comma, a semicolon, a slash, an ampersand, a dash or hyphen (a range), "and", "or". */
const ID_SEPARATOR = String.raw`\s*(?:,\s*(?:and|or)\b|[,;/&–—-]|\b(?:and|or)\b)\s*`;
/**
 * The citation forms: a bracketed group of one or more ids ("(M1)", "[C1, I4]", "(I1/I2)", "(M1, V1, and T2)",
 * "(T1–T6)"); an id right after per/see/under/from.
 */
function citationResOf(ids) {
  const id = idAlternation(ids);
  return [
    new RegExp(String.raw`[(\[]\s*${id}(?:${ID_SEPARATOR}${id})*\s*[)\]]`),
    new RegExp(String.raw`\b(?:[Pp]er|[Ss]ee|[Uu]nder|[Ff]rom)\s+${id}`),
  ];
}
/** A period that ends an abbreviation, not a sentence: a single letter ("U.S."), a month, "vs.", "Inc.", "p.m."… */
const ABBREVIATION_END = /(?:^|[\s(])(?:[A-Za-z]|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|vs|Inc|Corp|Co|Ltd|Bros|approx|est|etc|Mr|Mrs|Ms|Dr|St|No|Jr|Sr|U\.S|U\.K|a\.m|p\.m|e\.g|i\.e)\.$/i;
/** Sentences for the worked-example check: a sentence ends at . ! ? before a capital, a digit or a quote — never at an abbreviation. */
function exampleSentencesOf(text) {
  const s = String(text ?? '');
  const out = [];
  let start = 0;
  for (const m of s.matchAll(/[.!?]+(?=\s+[A-Z0-9"'“(\[])/g)) {
    const end = m.index + m[0].length;
    if (m[0] === '.' && ABBREVIATION_END.test(s.slice(start, end))) continue;
    out.push(s.slice(start, end));
    start = end;
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}
function exampleResOf(example) {
  const words = (s) => escapeRe(s).replace(/\s+/g, String.raw`\s+`);
  return {
    name: new RegExp(`(?<![A-Za-z0-9])(?:${example.names.map(words).join('|')})(?![A-Za-z0-9])`),
    // the day not followed by a digit, a percent or a hyphenated word ("October 30%", "an October 30-day window")
    date: new RegExp(String.raw`(?<![A-Za-z0-9])(?:${example.dates.map(words).join('|')})(?![\d%]|-[A-Za-z])`, 'i'),
    alias: Array.isArray(example.aliases) && example.aliases.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${example.aliases.map(words).join('|')})(?![\\p{L}\\p{N}])`, 'iu') : null,
    day: dateMentionsOf(example.dates[0])[0] ?? null,
  };
}
const isOnDay = (iso, day) => typeof iso === 'string' && day !== null && Number(iso.slice(5, 7)) === day.m && Number(iso.slice(8, 10)) === day.d;
/**
 * A current retrieval-backed finding that names the example: its name (in the fact — the company's own name counts,
 * "Nvidia" — or its symbol) and its date (in the fact, or its own date — never the read day of an undated item).
 */
const namesExample = (f, re, example) => f?.source?.recordKind === 'retrieval'
  && (re.name.test(f.fact) || (re.alias !== null && re.alias.test(f.fact)) || example.names.includes(f.symbol))
  && (re.date.test(f.fact) || (!isUndated(f) && isOnDay(f.at, re.day)) || isOnDay(f.asOf, re.day));
const statesExample = (text, re) => exampleSentencesOf(readable(text)).some((s) => re.name.test(s) && re.date.test(s));

/**
 * The app's services by name: "Practice Field" and "Film Room" as names (capitalized; joined or hyphenated too), the
 * "idea book" in any case. A stadium's practice field or a studio's film room is not the app's.
 */
const SERVICE_NAMES = [/\bPractice[\s-]*[Ff]ields?\b|\bPRACTICE[\s-]*FIELDS?\b/, /\bFilm[\s-]*[Rr]ooms?\b|\bFILM[\s-]*ROOMS?\b/, /\bidea[\s-]*books?\b/i];
/** "I" as a numeral ("Phase I", "Phase-I", "Fund I") is no one. */
const NOT_A_NUMERAL = String.raw`(?<!\b(?:Phase|Subphase|Series|Class|Tier|Type|Part|Stage|Level|Grade|Title|Chapter|Section|Article|Schedule|Form|Item|Exhibit|Volume|War|Fund|Basel|Train|Mark|Unit|Tranche|Gen|Generation|Block|Lot|Round|Wave|Cohort|Track|Line|Plant|Reactor|Group|Team|Division|Model)[\s-])(?<!-)`;
/** The letter's subjects: the agent (the player's), the player's partner, we, I, or this/the/your idea. */
const PROMISE_SUBJECT = String.raw`(?:\b(?:the\s+agent|(?:your|my|our)\s+agents?|your\s+(?:research\s+)?partner|we|(?:this|the|your)\s+(?:\w+\s+)?idea)|${NOT_A_NUMERAL}\bI)`;
/** will / 'll / is going to; then words that only fill ("be", "closely", "continue", ", of course,"); then the verb. */
const PROMISE_REST = String.raw`(?:\s+will|'ll|\s+(?:is|are|am)\s+going\s+to|'(?:s|re|m)\s+going\s+to)`
  + String.raw`(?:,?\s+(?:also|then|now|just|first|soon|still|both|all|be|being|been|continue|continuing|keep|keeping|start|starting|begin|beginning|on|to|and|of|course|\w+ly),?){0,6}`
  + String.raw`\s+(?:test|trial|track|monitor|adopt)(?:s|ed|ing|led|ling)?\b`;
const PROMISE = new RegExp(PROMISE_SUBJECT + PROMISE_REST, 'i');
const PROMISE_BY_NAME = new RegExp(String.raw`\b${PARTNER_TOKEN}` + PROMISE_REST, 'i');
/**
 * The partner's own name, read like the text (NFKC, no format characters, apostrophes straight), stands as the token —
 * matched CASE-SENSITIVELY, so a partner named "Will", "Test" or "Track" never swallows the words the promise needs.
 */
function byName(sentence, partnerName) {
  const n = typeof partnerName === 'string' ? readable(partnerName).trim() : '';
  if (n.length < 2) return null;
  return sentence.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(n)}(?![\\p{L}\\p{N}_])`, 'gu'), PARTNER_TOKEN);
}
function promisesService(text, partnerName) {
  const t = readable(text);
  if (SERVICE_NAMES.some((re) => re.test(t))) return true;
  return sentencesOf(t).some((s) => {
    if (PROMISE.test(s)) return true;
    const named = byName(s, partnerName);
    return named !== null && PROMISE_BY_NAME.test(named);
  });
}

/**
 * The KB method's three checks on one validated step turn (KB-1): null when the
 * turn passes them — or when its method is not `kb` — else the failure.
 * @param {object} p
 * @param {object|null} p.method        the turn's effective method
 * @param {object[]} p.findings         the findings the step built
 * @param {string|null} p.nextActionId  the step's own next action (its one `kb` finding)
 * @param {object[]} p.current          the record's current findings as the step leaves it
 * @param {string} p.summaryText        the summary as written (withheld or not)
 * @param {string} p.replyText          the reply as written (before any replacement)
 * @param {string|null} [p.partnerName]
 */
export function kbTurnFailOf({ method, findings = [], nextActionId = null, current = [], summaryText = '', replyText = '', partnerName = null }) {
  if (method?.source !== 'kb') return null;
  for (const f of findings) if (f?.source?.recordKind === 'kb' && f.findingId !== nextActionId) return fail('method_as_source', f.findingId);
  const texts = [['reply', replyText], ['summary', summaryText], ...findings.map((f) => [`fact:${f.findingId}`, f.fact])];
  const markers = methodMarkersFor(method);
  if (markers) {
    const cites = citationResOf(markers.citations);
    for (const [where, text] of texts) if (cites.some((re) => re.test(readable(text)))) return fail('method_example_as_fact', `${where}:citation`);
    const re = exampleResOf(markers.example);
    if (!current.some((f) => namesExample(f, re, markers.example))) {
      const unbacked = [['reply', replyText], ['summary', summaryText], ...findings.filter((f) => f.source?.recordKind !== 'retrieval').map((f) => [`fact:${f.findingId}`, f.fact])];
      for (const [where, text] of unbacked) if (statesExample(text, re)) return fail('method_example_as_fact', `${where}:example`);
    }
  }
  for (const [where, text] of texts) if (promisesService(text, partnerName)) return fail('service_promise', where);
  return null;
}

/**
 * The reply in place of one that stated an unsupported number (spec §17 FQ-15): "This step added {n} findings. The
 * answer was not updated." ("finding" for one). When the step DID revise the answer, the second sentence says so —
 * the server never writes a sentence that is false.
 */
export function replacedReplyOf(n, answerUpdated = false) {
  return `This step added ${n} ${n === 1 ? 'finding' : 'findings'}. ${answerUpdated ? 'The answer was updated.' : 'The answer was not updated.'}`;
}

/** The partner exchange's time: when the turn's findings were said (S-2: inferences and the next action take it). */
function partnerAtOf(ctx) {
  return ctx.partnerAt ?? ctx.nowIso;
}

/** A fresh finding id. */
export const findingIdOf = (uuid) => `${FINDING_ID_PREFIX}${uuid}`;
