// api/_utils/sharedResearch/thesisSchema.js
//
// Shared Research — THE BUILDER TURN'S SCHEMA AND ITS VALIDATOR (Amendment B
// §B4.2; §B10 S-B3; K-4).
//
// ONE SCHEMA PER GOAL (the founder's S-1/S-2, Nov 17): each goal's schema holds
// `reply` (its description still says 600 characters; the server cuts the
// model's reply at 320 — §B13 T-3) plus only what that goal may land (ACCEPTS,
// the rule the validator enforces), with B1's `findings` and the builder's
// `companies` where S-1 lists them; B1's `summary`, `lines` and `nextAction`
// are gone. Builder companies drop `claim` and `openRef` (the card's why
// replaces the ledger's claims). A research goal's pick is a value and one
// reason; the reasons with refs exist only in the `pick` goal's schema (§B10
// S-B3). `direction` is asked in the schema of the research goal the card
// would offer next (turnShapeOf), or with findings and companies only.
//
// validateBuildTurn(output, ctx) runs in two halves:
//   1. B1's validator (stepSchema.validateStepTurn) on the turn's reply,
//      findings and companies, unchanged. ONLY its rules can fail the step: a
//      failure there is the step's failure, as on a ledger turn.
//   2. The proposals, against the record as this turn leaves it. A proposal
//      that breaks a rule is DROPPED with a note (`dropped:<what>:<rule>`) —
//      never the step's findings (K-4, the B1 `summaryWithheld` precedent):
//        rule 1  a reason counts only when every ref resolves to a current,
//                Source-backed finding and at least one is about that name (§B12
//                W-10); a name with no surviving
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
import { ADOPTABLE_HORIZONS, PICK_PARTS, THESIS_PARTS, THESIS_LIMITS as L } from '../../../src/constants/sharedResearch.js';
import { STEP_SCHEMA, validateStepTurn, sentencesOf, promisesService, ACRONYMS, INDEX_NAMES } from './stepSchema.js';
import { gameUniverse, companiesOf, resolveSymbol, isSameCompany } from './companies.js';
import { NAMES_A_PRICE, lineFailOf, builderWordingOf } from './thesisWords.js';
import { applyProposals, cardContextOf } from './thesis.js';

export { NAMES_A_PRICE };

/**
 * The model's own reply, at most (§B13 T-3): cut at a sentence's end at 320 characters — the rule asks for two short
 * sentences, about 280. The server's own lines (the replaced reply, the dead-end line, the unsourced line) may take
 * the whole to THESIS_LIMITS.reply (600), as before. Kept here, not in THESIS_LIMITS: that module ships in the client.
 * The schema's description text is unchanged (no recompile).
 */
export const MODEL_REPLY_MAX = 320;

// ── the schemas (structured outputs: every object closed, every key required, nullable through anyOf) ──
//
// The API compiles a request's schema into a grammar. One schema holding every goal's proposals did not compile — the
// API's own words, Nov 17: "The compiled grammar is too large, which would cause performance issues." So each goal is
// asked in its own schema (S-1): `reply`, B1's `findings` (not for `pick`, which makes no search), the builder's
// `companies` (verify_source, map_segments, find_names, and `direction` with nothing else on offer), and the proposal
// fields that goal may land (ACCEPTS). Three "none" values stay an EMPTY STRING rather than null — the theme
// suggestion, a reason's symbol and the point against's text; the validator reads an empty string and a null alike.
// Every schema's size is pinned in thesisSchema.test.js at what compiled live (S-5).

const str = (description) => ({ type: 'string', description });
const nullable = (t) => ({ anyOf: [t, { type: 'null' }] });
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const refs = (description) => ({ type: 'array', items: { type: 'string' }, description });

const REPLY = str('Two or three plain sentences: what this step found and what it proposes for the card. At most 600 characters.');
const B1_COMPANY = STEP_SCHEMA.properties.companies.items.properties;
/** The builder's companies (S-2): B1's company without `claim` and `openRef` — the card's why replaces the ledger's claims. */
const COMPANIES = Object.freeze({
  type: 'array',
  description: STEP_SCHEMA.properties.companies.description,
  items: obj({ companyName: B1_COMPANY.companyName, symbolCandidate: B1_COMPANY.symbolCandidate, role: B1_COMPANY.role, relationshipRef: B1_COMPANY.relationshipRef }),
});
/** Each proposal field's schema. `pick` here is a research goal's: a value and one reason (S-2). */
const FIELD = Object.freeze({
  themeSuggestion: str('A theme for the thesis in a short phrase (at most 80 characters), only when the card has no theme; else an empty string.'),
  segments: {
    type: 'array',
    description: 'Two to five segments of the theme.',
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
      description: 'One reason per name, resting on Source-backed findings about that company.',
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
    description: 'Up to three ways the thesis could be proved wrong, each a business condition, never a price.',
    items: obj({ text: str('A clause that follows "It\'s wrong if", at most 160 characters.'), refs: refs('The finding ids or tempIds it rests on, if any.') }),
  },
  timeFramePick: nullable(obj({
    horizon: { type: 'string', enum: [...ADOPTABLE_HORIZONS] },
    reason: str('Why it fits the why, at most 140 characters.'),
  })),
  pick: nullable(obj({
    value: str('Your choice exactly as the card writes it: a segment label, the symbols separated by commas, or a wrong-if option.'),
    reason: str('Your reason in one line, at most 140 characters.'),
  })),
});
/** The `pick` goal's pick (§B10 S-B3): its value, one line, and two or three reasons, each with the record findings it rests on. */
const PICK_GOAL_PICK = nullable(obj({
  value: str('Your choice exactly as the card writes it: a segment label, the symbols separated by commas, a wrong-if option, or a time frame.'),
  reason: str('Your reason in one line, at most 140 characters.'),
  reasons: {
    type: 'array',
    description: 'Two or three reasons, each tied to findings already on the record or given as your reasoning (refs empty).',
    items: obj({ text: str('One reason, at most 140 characters.'), refs: refs('The record finding ids it rests on; empty for your reasoning.') }),
  },
}));

// ── what each goal may land ───────────────────────────────────────────────────

export const PROPOSAL_FIELDS = Object.freeze(['themeSuggestion', 'segments', 'why', 'wrongIfOptions', 'timeFramePick', 'pick']);
const ACCEPTS = Object.freeze({
  verify_source: ['themeSuggestion'],
  map_segments: ['themeSuggestion', 'segments', 'pick'],
  find_names: ['pick'],
  build_why: ['why', 'wrongIfOptions', 'timeFramePick', 'pick'],
  pick: ['pick'],
  direction: [], // with nothing else on offer; otherwise it is asked, and lands, as the next research goal (turnShapeOf)
});
/**
 * strengthen is offered only on a part the player has set, so it asks for evidence, never a pick (§B12 Q-1 (a)): a
 * pick or a time-frame pick could never land there. It may revise a set part's proposal — the map, the why, the options.
 */
const STRENGTHEN_ACCEPTS = Object.freeze({
  theme: [], segment: ['segments'], names: [], why: ['why'], wrongIf: ['wrongIfOptions'], timeFrame: [],
});
/** The proposals a goal lands (each turn works on the goal it was given and on nothing else — rulebook §6). */
export const acceptsOf = (goal, part) => (goal === 'strengthen' ? (STRENGTHEN_ACCEPTS[part] ?? []) : (ACCEPTS[goal] ?? []));
/** The part a pick is for: the goal's own, or the request's part (pick, strengthen) — the server's, never the model's. */
const pickPartOf = (goal, part) => ({ map_segments: 'segment', find_names: 'names', build_why: 'wrongIf' }[goal] ?? (goal === 'pick' || goal === 'strengthen' ? part : null));
/** The proposal a goal is FOR: when it is dropped whole, the reply cannot stand (K-4). */
const MAIN = Object.freeze({ map_segments: 'map', build_why: 'why', pick: 'pick' });
/** The output field each main proposal comes from. */
const MAIN_FIELD = Object.freeze({ map: 'segments', why: 'why', pick: 'pick' });
/** The goals whose schema carries the builder's companies (S-1). */
const WITH_COMPANIES = Object.freeze(['verify_source', 'map_segments', 'find_names', 'direction']);

/**
 * The goal and part a turn is asked in (S-1): its own; for `direction`, the research goal the card would offer next
 * (the first offered that is neither `direction` nor `pick`, which makes no search), or `direction` itself — findings
 * and companies only — when none is; at the dead end, `find_names` (§B12 Q-2). `offered`: offeredGoalsOf(card, ctx) and
 * `deadEnd`: blockedNow(card, ctx), both read at the step's admission.
 */
export function turnShapeOf({ goal, part = null }, offered = [], { deadEnd = false } = {}) {
  if (goal !== 'direction') return { goal, part: goal === 'strengthen' || goal === 'pick' ? part : null };
  // §B12 Q-2 (b): at the dead end (thesis.js blockedNow), a direction step is asked as find_names — the goal the dead end
  // withholds — so a company it sources comes with its role and a names pick. Everywhere else S-1's letter stands.
  if (deadEnd) return { goal: 'find_names', part: null };
  const next = (Array.isArray(offered) ? offered : []).find((g) => g.goal !== 'direction' && g.goal !== 'pick') ?? null;
  return next ? { goal: next.goal, part: next.part ?? null } : { goal: 'direction', part: null };
}
/** A shape's schema key: the goal, or `strengthen:<part>`. */
export const schemaKeyOf = ({ goal, part = null }) => (goal === 'strengthen' ? `strengthen:${part}` : goal);

function schemaOf({ goal, part = null }) {
  const properties = { reply: REPLY };
  if (goal !== 'pick') properties.findings = STEP_SCHEMA.properties.findings;
  if (WITH_COMPANIES.includes(goal)) properties.companies = COMPANIES;
  for (const field of acceptsOf(goal, part)) properties[field] = goal === 'pick' && field === 'pick' ? PICK_GOAL_PICK : FIELD[field];
  return Object.freeze(obj(properties));
}
/** Every turn shape a builder step can be asked in — five goals, `strengthen` on each part, `direction` with none on offer. */
export const BUILD_SHAPES = Object.freeze([
  { goal: 'verify_source', part: null }, { goal: 'map_segments', part: null }, { goal: 'find_names', part: null }, { goal: 'build_why', part: null },
  { goal: 'pick', part: null }, ...THESIS_PARTS.map((part) => ({ goal: 'strengthen', part })), { goal: 'direction', part: null },
].map((s) => Object.freeze(s)));
/** One schema per shape, by key (S-1). The ledger's STEP_SCHEMA is untouched. */
export const BUILD_SCHEMAS = Object.freeze(Object.fromEntries(BUILD_SHAPES.map((s) => [schemaKeyOf(s), schemaOf(s)])));
/** The schema a turn of this shape is asked in. */
export const buildSchemaOf = (shape) => BUILD_SCHEMAS[schemaKeyOf(shape)];

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

/** The same words, read loosely: case, spacing and closing punctuation aside (a theme suggestion against the player's words). */
const wordsOf = (s) => clean(s).toLowerCase().replace(/[\s.!?;:,]+$/u, '');
const sameWords = (a, b) => wordsOf(a) !== '' && wordsOf(a) === wordsOf(b);

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
 * @param {object} [ctx.shape] the goal and part the turn was asked in (turnShapeOf; `direction` takes the next goal's)
 * @returns {{ ok: true, findings, reply, notes, proposals } | { ok: false, rule, detail }}
 */
export function validateBuildTurn(output, ctx) {
  const { record, card, goal, part = null, partnerName = null, universe = gameUniverse, names = {} } = ctx;
  const shape = ctx.shape ?? turnShapeOf({ goal, part });
  if (!output || typeof output !== 'object') return { ok: false, rule: 'unparseable', detail: null };
  // What the turn's schema holds is all the validator reads (S-1; refuter SPL-4): findings on a `pick` turn, or companies
  // on a turn whose schema has none, are ignored with a note — the grammar never lets them through, and nor does this.
  const schema = buildSchemaOf(shape);
  const holds = (field) => !schema || Object.hasOwn(schema.properties, field);
  const preNotes = ['findings', 'companies'].filter((f) => !holds(f) && Array.isArray(output[f]) && output[f].length > 0).map((f) => `ignored:${f}`);
  const rawFindings = holds('findings') && Array.isArray(output.findings) ? output.findings : [];
  // The builder writes no ledger claim and no open question (S-2): whatever a company carries, B1 reads none.
  const companies = (holds('companies') && Array.isArray(output.companies) ? output.companies : []).map((c) => (c && typeof c === 'object' && !Array.isArray(c) ? { ...c, openRef: null, claim: null } : c));

  // 1. B1's validator on the reply, the findings and the companies — its rules alone can fail the step. The model's reply
  //    is cut to MODEL_REPLY_MAX (§B13 T-3: 320) at a sentence's end FIRST, so B1's number check reads the text that is
  //    kept (RB-7).
  const b1 = validateStepTurn({
    reply: cutAtSentence(clean(output.reply), MODEL_REPLY_MAX), findings: rawFindings, companies,
    summary: null, lines: { support: null, complication: null, missing: null }, nextAction: null,
  }, ctx);
  if (!b1.ok) return b1;
  const notes = [...preNotes, ...b1.notes];
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

  const accepts = acceptsOf(shape.goal, shape.part); // `direction` lands what the goal it was asked as lands
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

  // the theme suggestion — only while the card has no theme and no suggestion yet (§B13 T-1: the first map suggests one;
  // a story keeps verify_source's), and never the player's own words handed back as the agent's (T-1: "in the agent's
  // own words")
  if (takes('themeSuggestion')) {
    const t = lineOf(output.themeSuggestion, L.theme);
    const suggested = typeof card.theme.suggestion === 'string' && card.theme.suggestion !== '';
    const why = card.theme.state === 'set' ? 'theme_set' : suggested ? 'theme_suggested' : !t ? 'length'
      : recordCurrent.some((f) => f.kind === 'observation' && sameWords(f.fact, t)) ? 'player_words' : lineFail(t, recordVerified);
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
        // rule 1 (§B12 W-10): at least one ref, every ref a current Source-backed finding, at least one about the name
        if (ids.length === 0 || !ids.every((id) => after.get(id).status === 'verified') || !ids.some((id) => after.get(id).symbol === symbol)) return drop(`why.reason:${i}`, 'not_source_backed');
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

  // the pick (rules 3, 5 and 6; §B10 S-B3). Its part is the server's: the goal's own, or the request's (pick,
  // strengthen) — the schema gives the model no part to write (S-1). A research goal's pick is a value and one reason
  // with no refs (S-2), so it rests on nothing and its reason may state no number; the `pick` goal's reasons each cite
  // findings already on the record (rule 6), and the pick rests on the findings its kept reasons cite.
  if (takes('pick')) {
    const p = output.pick;
    const recordOnly = goal === 'pick';
    const pickPart = pickPartOf(shape.goal, shape.part);
    const supportedAfter = supportedAfterOf();
    const reason = lineOf(p?.reason, L.pickReason);
    const reasons = [];
    const reasonNotes = [];
    if (recordOnly) {
      (Array.isArray(p.reasons) ? p.reasons : []).forEach((r, i) => {
        const text = lineOf(r?.text, L.pickReason);
        const rids = resolveAll(r?.refs, true);
        const f = !text ? 'length' : rids === null ? 'not_on_record' : lineFail(text, verifiedOf(rids));
        if (f) return reasonNotes.push(`dropped:pick.reason:${i}:${f}`);
        if (reasons.length >= L.pickReasons) return reasonNotes.push(`dropped:pick.reason:${i}:too_many`);
        reasons.push({ text, findingIds: rids });
        return undefined;
      });
    }
    const ids = [...new Set(reasons.flatMap((r) => r.findingIds))];
    let value = null;
    let fail = null;
    if (!PICK_PARTS.includes(pickPart)) fail = 'wrong_part';
    else if (card[pickPart].state === 'set') fail = 'part_set';
    else if (pickPart === 'segment') value = (proposals.map ?? card.segment.map ?? []).find((m) => m.label === clean(p.value))?.label ?? null;
    else if (pickPart === 'names') {
      // every token must be a supported symbol: a pick that names anything else is dropped, never narrowed (RB-4)
      const tokens = clean(p.value).split(SYMBOL_SPLIT).map((s) => s.replace(/[.;:!?]+$/, '')).filter(Boolean); // "NVDA, AMD." reads AMD
      const syms = tokens.map((s) => resolveSymbol(s, universe));
      const uniq = syms.filter((s, i) => s && syms.indexOf(s) === i);
      value = syms.every(Boolean) && uniq.length >= L.namesMin && uniq.length <= L.namesMax && uniq.every((s) => supportedAfter.includes(s)) ? uniq : null;
    } else if (pickPart === 'wrongIf') value = (proposals.wrongIfOptions ?? card.wrongIf.options).find((o) => o.text.toLowerCase() === clean(p.value).toLowerCase())?.text ?? null;
    else value = ADOPTABLE_HORIZONS.includes(clean(p.value)) ? clean(p.value) : null;
    if (!fail && value === null) fail = pickPart === 'names' ? 'not_supported' : 'not_a_choice';
    if (!fail && !reason) fail = 'length';
    if (!fail) fail = lineFail(reason, verifiedOf(ids));
    if (fail) {
      drop('pick', fail);
    } else {
      notes.push(...reasonNotes);
      if (recordOnly && reasons.length < 2) notes.push(`pick_reasons_few:${reasons.length}`);
      proposals.pick = { part: pickPart, value, reason, findingIds: ids, reasons, asked: recordOnly };
    }
  }

  // What this step does to the card, exactly as recordStep will land it (a `card` op is refused while a step runs, so
  // the card cannot move meanwhile — RB-8): `cardChanged` is the answer's `changed.card`, and the plain line reads it.
  const preview = applyProposals(card, proposals, cardContextOf({ record: recordAfter, supported: companiesOf(recordAfter, { universe }).supported }));
  const cardChanged = JSON.stringify({ ...preview, rev: 0 }) !== JSON.stringify({ ...card, rev: 0 });
  const landed = Boolean(proposals.themeSuggestion || proposals.map || proposals.why || proposals.wrongIfOptions || proposals.timeFrame || proposals.pick);

  // The reply (K-4): B1's, already cut to MODEL_REPLY_MAX (320) at a sentence's end, replaced by the plain line when it cannot
  // stand — B1 replaced it, it breaks the builder's own wording, the goal's own proposal is missing, everything the step
  // proposed was dropped, or a dead end's reply names a listed company (RB-5).
  let reply = b1.reply;
  const mainOf = (g, p) => MAIN[g] ?? (g === 'strengthen' && p === 'why' ? 'why' : null);
  // A `direction` turn is held to the reply rule of the goal it was asked as (refuter SPL-1) — only when it offered that
  // goal's own proposal: it is told to make one only when what it finds supports it, so a reply with none can stand.
  const asked = goal === 'direction' ? mainOf(shape.goal, shape.part) : null;
  const main = goal === 'direction' ? (asked && given(MAIN_FIELD[asked]) ? asked : null) : mainOf(goal, part);
  const offered = accepts.filter((f) => given(f));
  const deadEnd = (goal === 'find_names' || (goal === 'direction' && shape.goal === 'find_names')) && card.names.state !== 'set' && supportedAfterOf().length === 0;
  // §B13 T-3: a reply whose first sentence alone runs past MODEL_REPLY_MAX cannot be cut at a sentence's end; the cut
  // would end mid-sentence (cutAtSentence's last-space fallback), so the server's plain line replaces it
  const said = clean(output.reply);
  const runOn = said.length > MODEL_REPLY_MAX && (sentencesOf(said)[0] ?? '').length > MODEL_REPLY_MAX;
  const replaceFor = notes.some((n) => n.startsWith('reply_replaced:')) ? 'unsupported_number'
    : runOn ? 'too_long'
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
