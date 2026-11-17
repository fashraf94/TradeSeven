// api/_utils/sharedResearch/thesisSchema.js
//
// Shared Research — THE BUILDER TURN'S SCHEMA AND ITS VALIDATOR (Amendment B
// §B4.2; §B10 S-B3; K-4).
//
// The builder turn keeps B1's `reply` (now at most 600 characters), `findings`
// and `companies` exactly as B1 defines them, drops `summary`, `lines` and
// `nextAction`, and adds the card's proposals: `themeSuggestion`, `segments`,
// `why`, `wrongIfOptions`, `timeFramePick` and `pick` (with up to three
// `reasons`, §B10 S-B3).
//
// validateBuildTurn(output, ctx) runs in two halves:
//   1. B1's validator (stepSchema.validateStepTurn) on the turn's reply,
//      findings and companies, unchanged. ONLY its rules can fail the step: a
//      failure there is the step's failure, as on a ledger turn.
//   2. The proposals, against the record as this turn leaves it. A proposal
//      that breaks a rule is DROPPED with a note (`dropped:<what>:<rule>`) —
//      never the step's findings (K-4, the B1 `summaryWithheld` precedent):
//        rule 1  a reason counts only when every ref resolves to a current,
//                Source-backed finding about that name; a name with no surviving
//                reason makes the why proposal incomplete (stored, not
//                confirmable; the reply names the company — SQ-3)
//        rule 2  the point against needs a current finding, else none
//        rule 3  every written line passes B1's forbidden patterns, the
//                stray-ticker scan and the number rule (a number must sit in a
//                Source-backed finding the line cites); and no line promises a
//                service (B1's KB check, here on every builder turn)
//        rule 4  a wrong-if option that names a price is dropped
//        rule 5  a names pick or proposal names only supported companies
//        rule 6  the `pick` goal cites only findings already on the record
//      Each goal lands only its own proposals; the rest are ignored with a note.
// When the goal's own proposal is dropped whole, the reply is replaced by a
// plain line that says what landed (never a false sentence).

import { currentFindingsOf } from '../researchRecords/model.js';
import { ADOPTABLE_HORIZONS, PICK_PARTS, THESIS_LIMITS as L } from '../../../src/constants/sharedResearch.js';
import { STEP_SCHEMA, validateStepTurn, sentencesOf, promisesService, ACRONYMS, INDEX_NAMES } from './stepSchema.js';
import { gameUniverse, companiesOf, resolveSymbol, isSameCompany } from './companies.js';
import { NAMES_A_PRICE, lineFailOf, builderWordingOf } from './thesisWords.js';
import { applyProposals, cardContextOf } from './thesis.js';

export { NAMES_A_PRICE };

// ── the schema (structured outputs: every object closed, every key required, nullable through anyOf) ──
//
// The API compiles the schema into a grammar and allows at most 16 parameters with union types (anyOf or a type
// array) per request (platform docs, "Schema complexity limits"); B1's step schema holds 15. The builder keeps B1's
// findings and companies (10) and so writes three of its own "none" values as an EMPTY STRING rather than null — the
// theme suggestion, a reason's symbol and the point against's text — leaving 13 (UNION_PARAMETERS, pinned by test).
// The validator reads an empty string and a null alike.

const str = (description) => ({ type: 'string', description });
const nullable = (t) => ({ anyOf: [t, { type: 'null' }] });
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const refs = (description) => ({ type: 'array', items: { type: 'string' }, description });

export const BUILD_SCHEMA = Object.freeze(obj({
  reply: str('Two or three plain sentences: what this step found and what it proposes for the card. At most 600 characters.'),
  findings: STEP_SCHEMA.properties.findings,
  companies: STEP_SCHEMA.properties.companies,
  themeSuggestion: str('A theme for the thesis in a short phrase (at most 80 characters), only when the card has no theme; else an empty string.'),
  segments: {
    type: 'array',
    description: 'map_segments: two to five segments of the theme; otherwise empty.',
    items: obj({
      label: str('The segment, at most 60 characters.'),
      line: str('One line saying what it covers, at most 120 characters.'),
      refs: refs('The finding ids or tempIds that back it; empty when it is your own reasoning.'),
    }),
  },
  why: nullable(obj({
    shared: str('The reason the names share, as a clause that follows "because" (at most 160 characters).'),
    reasons: {
      type: 'array',
      description: 'One to three reasons per name, each resting on Source-backed findings about that company.',
      items: obj({
        companyName: str('The company, in words.'),
        symbolCandidate: str('Its symbol, from the names on the card; an empty string when you do not know it.'),
        text: str('The reason, at most 200 characters.'),
        refs: refs('The Source-backed finding ids or tempIds about this company it rests on.'),
      }),
    },
    against: obj({
      text: str('The strongest point against, at most 240 characters; an empty string when you found none.'),
      refs: refs('The finding ids or tempIds it rests on.'),
    }),
  })),
  wrongIfOptions: {
    type: 'array',
    description: 'build_why: up to three ways the thesis could be proved wrong, each a business condition (never a price); otherwise empty.',
    items: obj({ text: str('A clause that follows "It\'s wrong if", at most 160 characters.'), refs: refs('The finding ids or tempIds it rests on, if any.') }),
  },
  timeFramePick: nullable(obj({
    horizon: { type: 'string', enum: [...ADOPTABLE_HORIZONS] },
    reason: str('Why it fits the why, at most 140 characters.'),
  })),
  pick: nullable(obj({
    part: { type: 'string', enum: [...PICK_PARTS] },
    value: str('The choice you would make: a segment label, the symbols separated by commas, a wrong-if option as written, or a time frame.'),
    reason: str('Your reason in one line, at most 140 characters.'),
    refs: refs('The finding ids it rests on; empty when it is your own reasoning.'),
    reasons: {
      type: 'array',
      description: 'The pick goal: two or three reasons, each tied to findings already on the record or given as your reasoning (refs empty). Otherwise empty.',
      items: obj({ text: str('One reason, at most 140 characters.'), refs: refs('The record finding ids it rests on; empty for your reasoning.') }),
    },
  })),
}));

// ── what each goal may land ───────────────────────────────────────────────────

export const PROPOSAL_FIELDS = Object.freeze(['themeSuggestion', 'segments', 'why', 'wrongIfOptions', 'timeFramePick', 'pick']);
/** The schema's parameters with union types (anyOf): under the API's limit of 16 per request, as B1's 15 are. */
export const UNION_PARAMETERS = 13;
const ACCEPTS = Object.freeze({
  verify_source: ['themeSuggestion'],
  map_segments: ['themeSuggestion', 'segments', 'pick'],
  find_names: ['pick'],
  build_why: ['why', 'wrongIfOptions', 'timeFramePick', 'pick'],
  pick: ['pick'],
  direction: [...PROPOSAL_FIELDS],
});
const STRENGTHEN_ACCEPTS = Object.freeze({
  theme: [], segment: ['segments', 'pick'], names: ['pick'], why: ['why'], wrongIf: ['wrongIfOptions', 'pick'], timeFrame: ['timeFramePick'],
});
/** The proposals a goal lands (each turn works on the goal it was given and on nothing else — rulebook §6). */
export const acceptsOf = (goal, part) => (goal === 'strengthen' ? (STRENGTHEN_ACCEPTS[part] ?? []) : (ACCEPTS[goal] ?? []));
/** The part a pick may be for, by goal (null: any part with choices). */
const pickPartOf = (goal, part) => ({ map_segments: 'segment', find_names: 'names', build_why: 'wrongIf' }[goal] ?? (goal === 'pick' || goal === 'strengthen' ? part : null));
/** The proposal a goal is FOR: when it is dropped whole, the reply cannot stand (K-4). */
const MAIN = Object.freeze({ map_segments: 'map', build_why: 'why', pick: 'pick' });

// ── small helpers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex -- control characters never reach a record
const clean = (v) => (typeof v === 'string' ? v.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');
const SYMBOL_SPLIT = /\s*(?:,|&|\/|\band\b)\s*|\s+/i;
/** The shape each proposal field must have to be read at all (a field that is not is dropped, never thrown on — RC-1). */
const FIELD_SHAPES = Object.freeze({
  themeSuggestion: (v) => typeof v === 'string', segments: Array.isArray, wrongIfOptions: Array.isArray,
  why: (v) => v !== null && typeof v === 'object' && !Array.isArray(v), timeFramePick: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  pick: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
});

/**
 * A text cut to `max` characters at a sentence's end (never inside a word or a figure: B3 review RB-7) — the first
 * sentence alone, when it is longer, at the last space before `max`.
 */
export function cutAtSentence(text, max) {
  const t = String(text ?? '');
  if (t.length <= max) return t;
  let out = '';
  for (const s of sentencesOf(t)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const head = t.slice(0, max);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).trimEnd();
}

/**
 * Validate one builder turn.
 * @param {object} output  the parsed model answer
 * @param {object} ctx     B1's validator context (record, items, readAt, partnerExchangeId, partnerAt, nowIso,
 *                         mintFindingId, names, partnerName, method, universe) plus:
 * @param {object} ctx.card   the card as the step began
 * @param {string} ctx.goal   the step's goal; `ctx.part` for strengthen and pick
 * @returns {{ ok: true, findings, reply, notes, proposals } | { ok: false, rule, detail }}
 */
export function validateBuildTurn(output, ctx) {
  const { record, card, goal, part = null, partnerName = null, universe = gameUniverse, names = {} } = ctx;
  if (!output || typeof output !== 'object') return { ok: false, rule: 'unparseable', detail: null };
  const rawFindings = Array.isArray(output.findings) ? output.findings : [];

  // 1. B1's validator on the reply, the findings and the companies — its rules alone can fail the step. The reply is cut
  //    to its 600 characters at a sentence's end FIRST, so B1's number check reads the text that is kept (RB-7).
  const b1 = validateStepTurn({
    reply: cutAtSentence(clean(output.reply), L.reply), findings: output.findings, companies: output.companies,
    summary: null, lines: { support: null, complication: null, missing: null }, nextAction: null,
  }, ctx);
  if (!b1.ok) return b1;
  const notes = [...b1.notes];
  const drop = (what, rule) => { notes.push(`dropped:${what}:${rule}`); };

  // This turn's tempIds → their minted ids: B1 builds one finding per raw finding, in order, before anything else.
  const temp = new Map(rawFindings.map((rf, i) => [String(rf?.tempId ?? '').trim(), b1.findings[i]?.findingId]));
  const superseded = new Set(b1.findings.map((f) => f.supersedes).filter(Boolean));
  const recordCurrent = currentFindingsOf(record);
  const after = new Map([...recordCurrent, ...b1.findings].filter((f) => !superseded.has(f.findingId)).map((f) => [f.findingId, f]));
  const onRecord = new Set(recordCurrent.map((f) => f.findingId).filter((id) => after.has(id)));
  /** A ref → a current finding id as this turn leaves the record, or undefined. `recordOnly`: rule 6. */
  const resolve = (ref, recordOnly = false) => {
    const r = typeof ref === 'string' ? ref.trim() : '';
    const id = !recordOnly && temp.has(r) ? temp.get(r) : r;
    return (recordOnly ? onRecord.has(id) : after.has(id)) ? id : undefined;
  };
  const resolveAll = (list, recordOnly = false) => {
    const ids = [];
    for (const ref of Array.isArray(list) ? list : []) {
      const id = resolve(ref, recordOnly);
      if (id === undefined) return null;
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  };
  const verifiedOf = (ids) => ids.map((id) => after.get(id)).filter((f) => f?.status === 'verified');
  const recordVerified = [...after.values()].filter((f) => f.status === 'verified');
  /** Rule 3 on one line (thesisWords.js): B1's forbidden patterns, the ticker scan, B1's service promise, the builder's own wording, every number held. */
  const lineFail = (text, held) => lineFailOf(text, held, { partnerName, universe });
  /** A bounded line: cleaned, 1..max characters (an over-long line is dropped, never cut into the card). */
  const lineOf = (raw, max) => { const t = clean(raw); return t && t.length <= max ? t : null; };

  const accepts = acceptsOf(goal, part);
  const present = (field) => {
    const v = output[field];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined;
  };
  for (const field of PROPOSAL_FIELDS) if (present(field) && !FIELD_SHAPES[field](output[field])) drop(field, 'malformed');
  const given = (field) => present(field) && FIELD_SHAPES[field](output[field]);
  for (const field of PROPOSAL_FIELDS) if (given(field) && !accepts.includes(field)) notes.push(`ignored:${field}`);
  const takes = (field) => given(field) && accepts.includes(field);

  const proposals = { goal, part, themeSuggestion: null, map: null, why: null, wrongIfOptions: null, timeFrame: null, pick: null };
  const recordAfter = { ...record, findings: [...(record?.findings ?? []), ...b1.findings] };
  const supportedAfterOf = () => companiesOf(recordAfter, { universe }).supported.map((c) => c.symbol);

  // the theme suggestion — only while the card has no theme
  if (takes('themeSuggestion')) {
    const t = lineOf(output.themeSuggestion, L.theme);
    const why = card.theme.state === 'set' ? 'theme_set' : !t ? 'length' : lineFail(t, recordVerified);
    if (why) drop('themeSuggestion', why);
    else proposals.themeSuggestion = t;
  }

  // the segment map (2–5)
  if (takes('segments')) {
    const map = [];
    output.segments.forEach((s, i) => {
      const label = lineOf(s?.label, L.segmentLabel);
      const line = lineOf(s?.line, L.segmentLine);
      const ids = resolveAll(s?.refs);
      if (!label || !line) return drop(`segment:${i}`, 'length');
      if (ids === null) return drop(`segment:${i}`, 'invalid_source');
      const held = verifiedOf(ids);
      const f = lineFail(label, held) || lineFail(line, held);
      if (f) return drop(`segment:${i}`, f);
      if (map.some((m) => m.label.toLowerCase() === label.toLowerCase())) return drop(`segment:${i}`, 'repeated');
      if (map.length >= L.segmentsMax) return drop(`segment:${i}`, 'too_many');
      map.push({ label, line, findingIds: ids });
      return undefined;
    });
    if (map.length >= L.segmentsMin) proposals.map = map;
    else drop('segments', 'too_few');
  }

  // the why (rules 1–3) — for the card's names only
  const incomplete = [];
  if (takes('why')) {
    const w = output.why;
    const forNames = card.names.state === 'set' ? [...card.names.value] : [];
    if (forNames.length === 0) {
      drop('why', 'names_unset');
    } else {
      const reasons = [];
      (Array.isArray(w.reasons) ? w.reasons : []).forEach((r, i) => {
        const text = lineOf(r?.text, L.reason);
        const companyName = clean(r?.companyName) || null;
        // the symbol given; else the name written as a ticker; else the one card name whose stored company name it IS
        const symbol = resolveSymbol(r?.symbolCandidate, universe) ?? (companyName ? resolveSymbol(companyName, universe) : null)
          ?? (companyName ? (forNames.filter((s) => isSameCompany(companyName, { symbol: s, name: names[s] })).length === 1 ? forNames.find((s) => isSameCompany(companyName, { symbol: s, name: names[s] })) : null) : null);
        if (!text) return drop(`why.reason:${i}`, 'length');
        if (!symbol || !forNames.includes(symbol)) return drop(`why.reason:${i}`, 'not_a_name');
        if (companyName && !isSameCompany(companyName, { symbol, name: names[symbol] })) return drop(`why.reason:${i}`, 'identity_mismatch');
        const ids = resolveAll(r?.refs);
        if (ids === null) return drop(`why.reason:${i}`, 'invalid_source');
        if (ids.length === 0 || !ids.every((id) => after.get(id).status === 'verified' && after.get(id).symbol === symbol)) return drop(`why.reason:${i}`, 'not_source_backed');
        const f = lineFail(text, verifiedOf(ids));
        if (f) return drop(`why.reason:${i}`, f);
        if (reasons.filter((x) => x.symbol === symbol).length >= L.reasonsPerName) return drop(`why.reason:${i}`, 'too_many');
        reasons.push({ symbol, text, findingIds: ids });
        return undefined;
      });
      const shared = lineOf(w.shared, L.shared);
      const sharedFail = !shared ? 'length' : lineFail(shared, verifiedOf(reasons.flatMap((r) => r.findingIds)));
      if (sharedFail) {
        drop('why', `shared_${sharedFail}`);
      } else {
        let against = null;
        // none: null, or an empty text with no refs (the schema's empty-string "none")
        if (w.against && (clean(w.against.text) !== '' || (Array.isArray(w.against.refs) && w.against.refs.length > 0))) {
          const text = lineOf(w.against.text, L.against);
          const ids = resolveAll(w.against.refs);
          const f = !text ? 'length' : ids === null ? 'invalid_source' : ids.length === 0 ? 'no_finding' : lineFail(text, verifiedOf(ids));
          if (f) drop('why.against', f);
          else against = { text, findingIds: ids };
        }
        incomplete.push(...forNames.filter((s) => !reasons.some((r) => r.symbol === s)));
        if (incomplete.length) notes.push(`why_incomplete:${incomplete.join(',')}`);
        proposals.why = { shared, reasons, against, forNames };
      }
    }
  }

  // the wrong-if options (rules 3 and 4)
  if (takes('wrongIfOptions')) {
    const options = [];
    output.wrongIfOptions.forEach((o, i) => {
      const text = lineOf(o?.text, L.wrongIfOption);
      const ids = resolveAll(o?.refs);
      const f = !text ? 'length' : ids === null ? 'invalid_source' : NAMES_A_PRICE.test(text) ? 'names_a_price' : lineFail(text, verifiedOf(ids));
      if (f) return drop(`wrongIf.option:${i}`, f);
      if (options.some((x) => x.text.toLowerCase() === text.toLowerCase())) return drop(`wrongIf.option:${i}`, 'repeated');
      if (options.length >= L.wrongIfOptions) return drop(`wrongIf.option:${i}`, 'too_many');
      options.push({ text, findingIds: ids });
      return undefined;
    });
    if (options.length) proposals.wrongIfOptions = options;
  }

  // the time-frame pick
  if (takes('timeFramePick')) {
    const t = output.timeFramePick;
    const reason = lineOf(t?.reason, L.pickReason);
    const f = card.timeFrame.state === 'set' ? 'time_frame_set' : !ADOPTABLE_HORIZONS.includes(t?.horizon) ? 'invalid_value' : !reason ? 'length' : lineFail(reason, recordVerified);
    if (f) drop('timeFramePick', f);
    else proposals.timeFrame = { value: t.horizon, reason };
  }

  // the pick (rules 3, 5 and 6; §B10 S-B3)
  if (takes('pick')) {
    const p = output.pick;
    const recordOnly = goal === 'pick';
    const allowed = pickPartOf(goal, part);
    const supportedAfter = supportedAfterOf();
    const reason = lineOf(p?.reason, L.pickReason);
    const ids = resolveAll(p?.refs, recordOnly);
    let value = null;
    let fail = null;
    if (!PICK_PARTS.includes(p?.part) || (allowed !== null && p.part !== allowed)) fail = 'wrong_part';
    else if (card[p.part].state === 'set') fail = 'part_set';
    else if (p.part === 'segment') value = (proposals.map ?? card.segment.map ?? []).find((m) => m.label === clean(p.value))?.label ?? null;
    else if (p.part === 'names') {
      // every token must be a supported symbol: a pick that names anything else is dropped, never narrowed (RB-4)
      const tokens = clean(p.value).split(SYMBOL_SPLIT).map((s) => s.replace(/[.;:!?]+$/, '')).filter(Boolean); // "NVDA, AMD." reads AMD
      const syms = tokens.map((s) => resolveSymbol(s, universe));
      const uniq = syms.filter((s, i) => s && syms.indexOf(s) === i);
      value = syms.every(Boolean) && uniq.length >= L.namesMin && uniq.length <= L.namesMax && uniq.every((s) => supportedAfter.includes(s)) ? uniq : null;
    } else if (p.part === 'wrongIf') value = (proposals.wrongIfOptions ?? card.wrongIf.options).find((o) => o.text.toLowerCase() === clean(p.value).toLowerCase())?.text ?? null;
    else value = ADOPTABLE_HORIZONS.includes(clean(p.value)) ? clean(p.value) : null;
    if (!fail && value === null) fail = p.part === 'names' ? 'not_supported' : 'not_a_choice';
    if (!fail && !reason) fail = 'length';
    if (!fail && ids === null) fail = recordOnly ? 'not_on_record' : 'invalid_source';
    if (!fail) fail = lineFail(reason, verifiedOf(ids));
    if (fail) {
      drop('pick', fail);
    } else {
      const reasons = [];
      (Array.isArray(p.reasons) ? p.reasons : []).forEach((r, i) => {
        const text = lineOf(r?.text, L.pickReason);
        const rids = resolveAll(r?.refs, recordOnly);
        const f = !text ? 'length' : rids === null ? (recordOnly ? 'not_on_record' : 'invalid_source') : lineFail(text, verifiedOf(rids));
        if (f) return drop(`pick.reason:${i}`, f);
        if (reasons.length >= L.pickReasons) return drop(`pick.reason:${i}`, 'too_many');
        reasons.push({ text, findingIds: rids });
        return undefined;
      });
      if (goal === 'pick' && reasons.length < 2) notes.push(`pick_reasons_few:${reasons.length}`);
      proposals.pick = { part: p.part, value, reason, findingIds: ids, reasons, asked: goal === 'pick' };
    }
  }

  // What this step does to the card, exactly as recordStep will land it (a `card` op is refused while a step runs, so
  // the card cannot move meanwhile — RB-8): `cardChanged` is the answer's `changed.card`, and the plain line reads it.
  const preview = applyProposals(card, proposals, cardContextOf({ record: recordAfter, supported: companiesOf(recordAfter, { universe }).supported }));
  const cardChanged = JSON.stringify({ ...preview, rev: 0 }) !== JSON.stringify({ ...card, rev: 0 });
  const landed = Boolean(proposals.themeSuggestion || proposals.map || proposals.why || proposals.wrongIfOptions || proposals.timeFrame || proposals.pick);

  // The reply (K-4): B1's, already cut to 600 characters at a sentence's end, replaced by the plain line when it cannot
  // stand — B1 replaced it, it breaks the builder's own wording, the goal's own proposal is missing, everything the step
  // proposed was dropped, or a dead end's reply names a listed company (RB-5).
  let reply = b1.reply;
  const main = MAIN[goal] ?? (goal === 'strengthen' && part === 'why' ? 'why' : null);
  const offered = accepts.filter((f) => given(f));
  const deadEnd = goal === 'find_names' && card.names.state !== 'set' && supportedAfterOf().length === 0;
  const replaceFor = notes.some((n) => n.startsWith('reply_replaced:')) ? 'unsupported_number'
    : reply && promisesService(reply, partnerName) ? 'service_promise'
      : reply && builderWordingOf(reply, partnerName) ? 'builder_wording'
      : main && !proposals[main] ? 'goal_proposal_dropped'
        : deadEnd && namesAListedCompany(reply, universe) ? 'dead_end'
          : offered.length > 0 && !landed ? 'proposals_dropped' : null;
  if (replaceFor) {
    if (replaceFor !== 'unsupported_number') notes.push(`reply_replaced:${replaceFor}`);
    reply = builderFallbackReplyOf(b1.findings.length, { landed, cardChanged });
    if (deadEnd) reply = `${reply} ${DEAD_END_LINE}`;
  }
  if (incomplete.length) {
    const line = unsourcedLineOf(incomplete, names);
    reply = `${reply ? `${cutAtSentence(reply, L.reply - line.length - 1)} ` : ''}${line}`;
  }
  return { ok: true, findings: b1.findings, reply, notes, proposals, cardChanged };
}

/** The server's line on a dead end (§B4.5): no company is picked to finish the card. */
export const DEAD_END_LINE = 'No listed company has a sourced connection yet; nothing is picked to finish the card.';
/** Does a text name a company in the game's universe by its symbol (the acronyms and index names never count)? */
function namesAListedCompany(text, universe) {
  return (String(text ?? '').match(/\b[A-Z]{1,5}(?:[.-][A-Z])?\b/g) || []).some((w) => !ACRONYMS.includes(w) && !INDEX_NAMES.includes(w) && resolveSymbol(w, universe) !== null);
}

/**
 * The plain reply in place of one that cannot stand (K-4; routine 15): what landed, never a false sentence. "The card
 * did not change." only when it did not; "The card shows what it proposes." when a proposal landed.
 */
export function builderFallbackReplyOf(n, { landed = false, cardChanged = true } = {}) {
  const head = `This step added ${n} ${n === 1 ? 'finding' : 'findings'}.`;
  return landed ? `${head} The card shows what it proposes.` : cardChanged ? head : `${head} The card did not change.`;
}

/** The server's line naming the names a why proposal has no Source-backed reason for (SQ-3: the reply names the company). */
export function unsourcedLineOf(symbols, names = {}) {
  const who = symbols.map((s) => (typeof names[s] === 'string' && names[s] && names[s] !== s ? `${names[s]} (${s})` : s));
  const list = who.length <= 1 ? who[0] : `${who.slice(0, -1).join(', ')} and ${who.at(-1)}`;
  return `No Source-backed reason was found for ${list} yet, so the why cannot be confirmed with ${symbols.length === 1 ? 'it' : 'them'}.`;
}

/** The symbols a builder answer names that need their company names read (the reasons' identity check). */
export function buildCandidateNamesOf(output) {
  const why = output?.why && typeof output.why === 'object' ? output.why : null;
  return (Array.isArray(why?.reasons) ? why.reasons : []).flatMap((r) => [r?.symbolCandidate, r?.companyName]);
}
