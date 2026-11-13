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

import { createHash } from 'node:crypto';
import {
  FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, RECORD_ID_MAX_LEN, SOURCE_URL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, BASED_ON_MAX,
  FINDINGS_MAX, FINDING_ID_PREFIX, currentFindingsOf, isInstant, buildFinding, isSourceUrl,
} from '../researchRecords/model.js';
import { RELATIONSHIP_ROLES, ROLE_SEPARATOR, UNRESOLVED_REASONS } from '../../../src/constants/sharedResearch.js';
import { gameUniverse, resolveSymbol } from './companies.js';
import { METHOD_SOURCE } from './method.js';

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
export const NO_NEXT_STEP_FACT = 'No next step proposed: the question looks answered by the current findings.';

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

/** Learning words count only in a sentence about the partner, the agent, "I" or "we" (rulebook §2.4, §4 (6)). */
const LEARNING = /\b(?:learn\w*|smarter|remember\w*|level(?:s|ed)?\s+up|unlock\w*|getting\s+better|got\s+better)\b/i;
const ABOUT_US = /\b(?:agent|partner|I|I'm|I've|we|we're|we've|me|my|our)\b/i;
/** The forbidden patterns (spec §6.4 rule 7; rulebook §2 and §4 (6)). Tested per sentence. */
export const FORBIDDEN_PATTERNS = Object.freeze({
  guarantee: /\bguarantee/i,
  will_do: /\bwill do\b|\b(?:agent|partner|it|I|we)\s+will\s+(?:buy|sell|trade|swap|act|execute|hold|short|equip|deploy)\b/i,
  considered: /\bconsidered\b/i,
  confidence_number: /\d+(?:\.\d+)?\s*(?:%|percent)[^.!?]{0,40}\bconfiden|\bconfiden\w*[^.!?]{0,40}\d+(?:\.\d+)?\s*(?:%|percent)/i,
  price_target: /\bprice\s+targets?\b|\btarget\s+price\b/i,
  buy_sell_advice: /\b(?:you|we|I|investors|players?)\s+should\s+(?:buy|sell|short|add|trim|own)\b|\b(?:buy|sell|short)\s+(?:now|the\s+(?:stock|shares|dip))\b|\b(?:good\s+)?time\s+to\s+(?:buy|sell)\b|\bstrong\s+(?:buy|sell)\b/i,
});
export const sentencesOf = (text) => String(text ?? '').split(/(?<=[.!?])\s+/).filter(Boolean);

/** The forbidden pattern names a text breaks (each sentence on its own), learning claims included. */
export function forbiddenIn(text) {
  const hits = new Set();
  for (const s of sentencesOf(text)) {
    for (const [name, re] of Object.entries(FORBIDDEN_PATTERNS)) if (re.test(s)) hits.add(name);
    if (LEARNING.test(s) && ABOUT_US.test(s)) hits.add('learning_claim');
  }
  return [...hits];
}

/** The numbers a text states, normalized ("1,200" → "1200", "1.90" → "1.9"). */
export function numberTokensOf(text) {
  return (String(text ?? '').match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map((t) => String(Number(t.replace(/,/g, ''))));
}

/** A stored instant's calendar parts as numbers ("2026-11-05T…" → 2026, 11, 5). */
const dateTokensOf = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').map((p) => String(Number(p))) : []);
/**
 * The numbers a finding holds: those its fact states, and its own dates (`at`,
 * `asOf`) — a sentence that dates a fact by the fact's own date asserts nothing
 * the finding does not hold. Used by the summary, the claim and the adoption checks.
 */
export const heldNumbersOf = (f) => (f ? [...numberTokensOf(f.fact), ...dateTokensOf(f.at), ...dateTokensOf(f.asOf)] : []);

// ── small normalizers ───────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex -- control characters never reach a record
const CONTROL = /[\u0000-\u001f\u007f]/g;
const clean = (v) => (typeof v === 'string' ? v.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : '');
const cut = (s, max) => (s.length <= max ? s : s.slice(0, max).trimEnd());
/** A date the model or a source gave, as an instant; null when it is not a real date. */
export function instantOf(v) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s);
  if (!Number.isFinite(ms)) return null;
  const iso = new Date(ms).toISOString();
  return isInstant(iso) ? iso : null;
}

/** A retrieval source's record id (§15 S-3): the url when it fits, else its SHA-256. */
export function retrievalRecordIdOf(url) {
  return url.length <= RECORD_ID_MAX_LEN ? url : `url-sha256:${createHash('sha256').update(url).digest('hex')}`;
}

/** "{host} · {title}" within the label cap; the title is what is trimmed, and " · undated" (S-2 b) is kept whole. */
export function retrievalLabelOf({ host, title }, { undated = false } = {}) {
  const tail = undated ? LABELS.undated : '';
  const h = cut(clean(host) || 'source', 60);
  const t = clean(title);
  const room = SOURCE_LABEL_MAX_LEN - h.length - tail.length - ROLE_SEPARATOR.length;
  return t && room > 0 ? `${h}${ROLE_SEPARATOR}${cut(t, room)}${tail}` : `${h}${tail}`;
}

/**
 * A retrieval-backed fact's dates (§15 S-2): `at` is the model's date when it
 * is a real instant no later than the read; else the item's publishedDate; else
 * the read time itself (and the label says " · undated"). `asOf` is the
 * publishedDate when strictly before the write, else null — never the write time.
 */
export function retrievalDatesOf({ modelAt, publishedDate, readAt, writeAt }) {
  const readMs = Date.parse(readAt);
  const model = instantOf(modelAt);
  const published = instantOf(publishedDate);
  const asOf = published && Date.parse(published) < Date.parse(writeAt) ? published : null;
  if (model && Date.parse(model) <= readMs) return { at: model, asOf, undated: false };
  if (published) return { at: published, asOf, undated: false };
  return { at: readAt, asOf, undated: true };
}

// ── the frame ───────────────────────────────────────────────────────────────

/** The framing turn: three bounded texts, no forbidden pattern, no stray ticker. */
export function validateFrame(output, { universe = gameUniverse } = {}) {
  const q = cut(clean(output?.question), FRAME_QUESTION_MAX);
  const check = cut(clean(output?.check), FRAME_CHECK_MAX);
  const notEstablished = cut(clean(output?.notEstablished), FRAME_CHECK_MAX);
  if (!q || !check || !notEstablished) return { ok: false, rule: 'frame_incomplete' };
  for (const t of [q, check, notEstablished]) {
    const f = forbiddenIn(t);
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
 * @returns {{ ok: true, findings: object[], summary: object|null, lines: object, reply: string, notes: string[] } | { ok: false, rule: string, detail: any }}
 */
export function validateStepTurn(output, ctx) {
  const { record, items = [], readAt = null, partnerExchangeId, nowIso, mintFindingId, universe = gameUniverse } = ctx;
  const notes = [];
  if (!output || typeof output !== 'object') return fail('unparseable');
  const rawFindings = Array.isArray(output.findings) ? output.findings : [];
  if (rawFindings.length > STEP_FINDINGS_MAX) return fail('too_many_findings', rawFindings.length);
  const current = currentFindingsOf(record);
  const currentById = new Map(current.map((f) => [f.findingId, f]));
  const itemByIndex = new Map(items.map((it) => [it.index, it]));
  const exchangeSource = (label) => ({ recordKind: 'exchange', recordId: partnerExchangeId, label });

  // Every text the model wrote: no forbidden pattern, no stray ticker (rules 2 and 7).
  const textFail = (text, where) => {
    const f = forbiddenIn(text);
    if (f.length) return fail('forbidden', `${where}:${f[0]}`);
    const s = strayTickersOf(text, universe);
    if (s.length) return fail('stray_ticker', `${where}:${s[0]}`);
    return null;
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

  // Roles: a relationship fact takes the role of the company that cites it (rule 4's "{Role} · {fact}").
  const companies = (Array.isArray(output.companies) ? output.companies : []).slice(0, COMPANIES_MAX);
  if (Array.isArray(output.companies) && output.companies.length > COMPANIES_MAX) notes.push('companies_cut');
  const roleByTemp = new Map();
  for (const c of companies) {
    for (const key of ['relationshipRef', 'openRef']) {
      const ref = typeof c?.[key] === 'string' ? c[key].trim() : null;
      if (ref && temp.has(ref) && !roleByTemp.has(ref)) roleByTemp.set(ref, RELATIONSHIP_ROLES.includes(c.role) ? c.role : 'Other');
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
    const symbol = resolveSymbol(rf.symbolCandidate, universe); // rule 2: inside the universe or null
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
        source = { recordKind: 'retrieval', recordId: retrievalRecordIdOf(item.url), label: retrievalLabelOf(item, { undated: d.undated }), url: item.url };
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
    // rule 5: a correction names a current finding, and never forks a chain.
    let supersedes = null;
    if (rf.supersedes !== null && rf.supersedes !== undefined) {
      const s = typeof rf.supersedes === 'string' ? rf.supersedes.trim() : '';
      if (!currentById.has(s)) return fail('invalid_supersedes', `${tempId}:${s}`);
      if (supersededHere.has(s)) return fail('forked_chain', s);
      supersededHere.add(s);
      supersedes = s;
    }
    // The stored fact: a relationship carries its role; a company with no resolved symbol is named first.
    let fact = factText;
    if (companyName && symbol === null && (kind === 'relationship' || kind === 'product')) fact = `${companyName}: ${fact}`;
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
    const symbol = resolveSymbol(c.symbolCandidate, universe);
    const rel = relId ? afterById.get(relId) : null;
    const supported = symbol !== null && rel && rel.kind === 'relationship' && rel.status === 'verified' && rel.symbol === symbol;
    if (!supported) { notes.push(`claim_unsupported:${name}`); continue; }
    const claimText = cut(['effect', 'relationship', 'evidence', 'uncertainty'].map((k) => clean(c.claim[k])).filter(Boolean)
      .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`)).join(' '), FINDING_FACT_MAX_LEN);
    if (!claimText) continue;
    const cf = textFail(claimText, `claim:${symbol}`);
    if (cf) return cf;
    // A claim states no number its company's verified facts do not hold (the evidence discipline; downgrade, not ✗).
    const held = new Set([...afterById.values()].filter((f) => f.symbol === symbol && f.status === 'verified').flatMap(heldNumbersOf));
    if (numberTokensOf(claimText).some((n) => !held.has(n))) { notes.push(`claim_unsupported_number:${symbol}`); continue; }
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
  if (!nextFact && priorNext && priorNext.statusReason !== 'no_next_step') { nextFact = NO_NEXT_STEP_FACT; nextReason = 'no_next_step'; }
  if (nextFact) {
    const err = build({
      kind: 'next_action', symbol: null, fact: nextFact, source: { ...METHOD_SOURCE }, at: partnerAtOf(ctx), asOf: null,
      status: 'unverified', statusReason: nextReason, supersedes: priorNext ? priorNext.findingId : null,
    }, mintFindingId());
    if (err) return err;
    if (priorNext) afterById.delete(priorNext.findingId);
    afterById.set(built.at(-1).findingId, built.at(-1));
  }

  // rule 8: the record's own cap.
  const stored = Array.isArray(record?.findings) ? record.findings.length : 0;
  if (stored + built.length > FINDINGS_MAX) return fail('findings_full', stored + built.length);

  // The summary (rule 6): 1–25 current findings; every number it states is in one of them.
  let summary = null;
  if (output.summary && typeof output.summary === 'object') {
    const text = clean(output.summary.text);
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
    const held = new Set(basedOn.flatMap((id) => heldNumbersOf(afterById.get(id))));
    for (const sentence of sentencesOf(text)) {
      const missing = numberTokensOf(sentence).find((n) => !held.has(n));
      if (missing !== undefined) return fail('unsupported_number', missing);
    }
    summary = { text, basedOn };
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

  const reply = cut(clean(output.reply), REPLY_MAX);
  if (reply) {
    const rf = textFail(reply, 'reply');
    if (rf) return rf;
  }
  return { ok: true, findings: built, summary, lines, reply, notes };
}

/** The partner exchange's time: when the turn's findings were said (S-2: inferences and the next action take it). */
function partnerAtOf(ctx) {
  return ctx.partnerAt ?? ctx.nowIso;
}

/** A fresh finding id. */
export const findingIdOf = (uuid) => `${FINDING_ID_PREFIX}${uuid}`;
