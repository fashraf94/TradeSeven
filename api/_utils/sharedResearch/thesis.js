// api/_utils/sharedResearch/thesis.js
//
// Shared Research — THE THESIS CARD, pure (Amendment B §B3, §B4; §B10 rulings;
// docs/specs/20261116_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_B_THESIS_BUILDER.md).
// The one module that decides what a builder session's card may do (K-3): its
// shape and limits, each transition (the player's `card` ops and a step's
// proposals), the dependencies, stale, ready, what blocks ready, the composed
// sentence, the goals and free choices on offer, the `rev` rule, the carried
// evidence and the card the saved list keeps. No I/O, no clock.
//
// THE CARD (stored on `sharedResearchSessions/{id}.thesis`, builder sessions only):
//   theme      { state, value, by, suggestion }
//   segment    { state, value, by, findingIds, skipped, map: [{ label, line, findingIds }] | null }
//   names      { state, value: [symbol], by, blocked }
//   why        { state, by, shared, reasons: [{ symbol, text, findingIds }], against: { text, findingIds } | null,
//                proposal: { shared, reasons, against, forNames } | null }
//   wrongIf    { state, by, text, findingIds, options: [{ text, findingIds }], priceLines: [{ symbol, level }] }
//   timeFrame  { state, by, value, suggestion: { value, reason } | null }
//   pick       { part, value, reason, findingIds, reasons: [{ text, findingIds }], asked } | null
//   ops        the last OPS_KEPT applied opIds (the free action's idempotency)
//   rev        +1 on every change (a `card` op applied, a step's proposals landed)
//
// A STORED state is `unset` or `set`. `suggested` and `stale` are DERIVED on
// every read and inside every transaction from the card and the record as it
// stands, as `ready` is (§B3: "computed, never stored"; routine choice 5) — so a
// superseded finding or a replaced pick can never leave a stored state that
// disagrees with the record.
//
// NO STEP EVER SETS A PART (V2-4): applyProposals writes only suggestions,
// proposals, options, the map and the pick. Only applyCardOp — the player's
// `card` action — moves a part to `set`.

import { currentFindingsOf } from '../researchRecords/model.js';
import { strayNumberOf, sentencesOf } from './stepSchema.js';
import { namesCompany } from './companies.js';
import { assertThesisStatementSupported, AssertionError, KEPT_FINDINGS_MAX } from './adoptPreview.js';
import {
  THESIS_PARTS, PICK_PARTS, CARD_OPS, ADOPTABLE_HORIZONS, HORIZON_LABELS, THESIS_LIMITS, THESIS_DEPENDENTS,
} from '../../../src/constants/sharedResearch.js';

export const THESIS_SCHEMA_VERSION = 1;
/** The applied opIds a card keeps: a retried opId within the last this-many answers the card and applies nothing. */
export const OPS_KEPT = 20;
/** The most `card` exchanges one session keeps (the free action refuses past it: a session document stays well under Firestore's 1 MiB — review RA-6). */
export const CARD_OPS_MAX = 300;
/** The field the saved list carries the card in (§B10 S-B1: never the list's own `thesis` text field). */
export const THESIS_CARD_FIELD = 'thesisCard';
export const SAVED_CARD_SCHEMA_VERSION = 1;
/** A price line's level, at most (a sanity bound; the version builder takes any positive number). */
export const PRICE_LEVEL_MAX = 1_000_000;

const UNSET = 'unset';
const SET = 'set';
const SUGGESTED = 'suggested';
const STALE = 'stale';
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;
const idsOf = (v) => (Array.isArray(v) ? v.filter(isText) : []);

/** The part names as the conversation says them. */
export const PART_LABELS = Object.freeze({ theme: 'Theme', segment: 'Segment', names: 'Names', why: 'Why', wrongIf: 'Wrong if', timeFrame: 'Time frame' });

// ── the empty card, and the card an investigation opens with ────────────────────

/** A card with every part unset (rev 0). */
export function emptyCard() {
  return {
    schemaVersion: THESIS_SCHEMA_VERSION, rev: 0,
    theme: { state: UNSET, value: null, by: null, suggestion: null },
    segment: { state: UNSET, value: null, by: null, findingIds: [], skipped: false, map: null },
    names: { state: UNSET, value: [], by: null, blocked: null },
    why: { state: UNSET, by: null, shared: null, reasons: [], against: null, proposal: null },
    wrongIf: { state: UNSET, by: null, text: null, findingIds: [], options: [], priceLines: [] },
    timeFrame: { state: UNSET, by: null, value: null, suggestion: null },
    pick: null,
    ops: [],
  };
}

/**
 * The card a builder investigation opens with (§B4.1). Own words: the theme is the player's words when they are
 * THEME_MAX characters or fewer (`player_wrote`); longer words leave it unset for the first step to suggest (SQ-2).
 * A story or a drop opens empty.
 */
export function openingCardOf({ entryKind, observation = null }) {
  const card = emptyCard();
  if (entryKind === 'observation' && isText(observation) && observation.length <= THESIS_LIMITS.theme) {
    card.theme = { state: SET, value: observation, by: 'player_wrote', suggestion: null };
  }
  return card;
}

/** The record question an own-words builder investigation is minted with (§B4.1), cut to the record's limit. */
export const BUILDER_QUESTION_PREFIX = 'Build a thesis on: ';
export function builderQuestionOf(observation, max = 500) {
  const q = `${BUILDER_QUESTION_PREFIX}${String(observation ?? '').trim()}`;
  return q.length <= max ? q : q.slice(0, max).trimEnd();
}

// ── the context a card is read in ─────────────────────────────────────────────

/**
 * What the card is read against: the record's CURRENT findings by id, the companies the record supports now
 * (companiesOf's supported rule), and the session's facts the offers need. One function for every read and every
 * transaction, so a view, a free op and a save judge the same card the same way.
 * @param {{ record: object|null, supported: object[], session?: object|null }} p
 */
export function cardContextOf({ record, supported = [], session = null }) {
  const current = new Map(currentFindingsOf(record).map((f) => [f.findingId, f]));
  const used = Number.isSafeInteger(session?.stepsUsed) ? session.stepsUsed : 0;
  const budget = Number.isSafeInteger(session?.stepBudget) ? session.stepBudget : 0;
  return {
    current,
    supported: (Array.isArray(supported) ? supported : []).filter((c) => isText(c?.symbol)),
    entryKind: session?.entry?.kind ?? null,
    open: session ? session.status === 'open' && record?.state === 'open' : record?.state === 'open',
    stepsLeft: Math.max(0, budget - used),
    verified: verifiedOf(session),
  };
}

/** Has a `verify_source` step completed on this session (its partner exchange recorded)? */
export function verifiedOf(session) {
  return (Array.isArray(session?.exchanges) ? session.exchanges : []).some((e) => e?.who === 'partner' && e.kind === 'step' && e.goal === 'verify_source');
}

const supportedSymbolsOf = (ctx) => ctx.supported.map((c) => c.symbol);
const isCurrent = (ctx, id) => ctx.current.has(id);
/** A finding id that resolves to a current Source-backed finding — about `symbol` when one is given. */
const isSourceBacked = (ctx, id, symbol = null) => {
  const f = ctx.current.get(id);
  return Boolean(f) && f.status === 'verified' && (symbol === null || f.symbol === symbol);
};
/** A reason counts (§B4.2 rule 1): at least one finding, every one current, Source-backed and about its name. */
export const reasonHolds = (ctx, r) => isPlainObject(r) && idsOf(r.findingIds).length > 0 && r.findingIds.every((id) => isSourceBacked(ctx, id, r.symbol));

/** The names a why (or a proposal) has no holding reason for. */
export function namesWithoutReasonOf(ctx, reasons, names) {
  const list = Array.isArray(reasons) ? reasons : [];
  return (Array.isArray(names) ? names : []).filter((s) => !list.some((r) => r?.symbol === s && reasonHolds(ctx, r)));
}

// ── derived states, ready, the sentence ───────────────────────────────────────

const askedFor = (card, part) => card.pick?.part === part && card.pick.asked === true;

/** Each part's state as the card shows it: unset · suggested · set · stale. */
export function partStatesOf(card, ctx) {
  const s = {};
  s.theme = card.theme.state === SET ? SET : isText(card.theme.suggestion) ? SUGGESTED : UNSET;
  s.segment = card.segment.state === SET
    ? (idsOf(card.segment.findingIds).every((id) => isCurrent(ctx, id)) ? SET : STALE)
    : askedFor(card, 'segment') ? SUGGESTED : UNSET;
  const supported = new Set(supportedSymbolsOf(ctx));
  s.names = card.names.state === SET
    ? (card.names.value.length > 0 && card.names.value.every((x) => supported.has(x)) ? SET : STALE)
    : askedFor(card, 'names') ? SUGGESTED : UNSET;
  s.why = card.why.state === SET ? (whyHolds(card, ctx) ? SET : STALE) : card.why.proposal ? SUGGESTED : UNSET;
  s.wrongIf = card.wrongIf.state === SET
    ? (idsOf(card.wrongIf.findingIds).every((id) => isCurrent(ctx, id)) ? SET : STALE)
    : askedFor(card, 'wrongIf') ? SUGGESTED : UNSET;
  s.timeFrame = card.timeFrame.state === SET ? SET : (card.timeFrame.suggestion || askedFor(card, 'timeFrame')) ? SUGGESTED : UNSET;
  return s;
}

/**
 * A set why holds when every finding behind it is still current, every reason holds, and every name has one
 * (§B3 stale; ready's "at least one current Source-backed reason per name").
 */
function whyHolds(card, ctx) {
  const w = card.why;
  const behind = [...w.reasons.flatMap((r) => idsOf(r.findingIds)), ...idsOf(w.against?.findingIds)];
  if (!behind.every((id) => isCurrent(ctx, id))) return false;
  if (!w.reasons.every((r) => reasonHolds(ctx, r) && card.names.value.includes(r.symbol))) return false;
  return namesWithoutReasonOf(ctx, w.reasons, card.names.value).length === 0;
}

/** The parts ready needs (V2-1): names, why, wrong if, time frame. The theme and the segment are not among them. */
export const READY_PARTS = Object.freeze(['names', 'why', 'wrongIf', 'timeFrame']);

/** `{ ready, blockers: [{ part, state }] }` — ready is computed, never stored (§B3). */
export function readinessOf(card, ctx, states = partStatesOf(card, ctx)) {
  const blockers = READY_PARTS.filter((p) => states[p] !== SET).map((p) => ({ part: p, state: states[p] }));
  // the optional segment is in the sentence only while it holds: a stale one blocks the save until it is re-confirmed or changed (RA-1 E)
  if (states.segment === STALE) blockers.unshift({ part: 'segment', state: STALE });
  return { ready: blockers.length === 0, blockers };
}

const bare = (s) => String(s ?? '').trim().replace(/[\s.!?;:,]+$/u, '');
/** "A", "A and B", "A, B and C" (§B3). */
export const joinNames = (xs) => {
  const list = Array.isArray(xs) ? xs : [];
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
};
/** The time frame as the sentence says it: the shared HORIZON_LABELS row with a capital ("Positional · about 30 sessions"). */
export const timeFrameLabelOf = (h) => {
  const l = Object.hasOwn(HORIZON_LABELS, h ?? '') ? HORIZON_LABELS[h] : null;
  return l ? `${l[0].toUpperCase()}${l.slice(1)}` : null;
};

/**
 * The thesis sentence, from the card by one pure function (§B3): "My theme is {theme}[, through {segment}], built
 * on {names}, because {why.shared}. It's wrong if {wrongIf.text}. Time frame: {label}." Null until the names, the
 * why, the wrong-if and the time frame hold values. A card with no theme set opens at "Built on …" (routine 21 —
 * the theme is not one of ready's parts); a skipped segment is left out.
 */
export function sentenceOf(card) {
  const { theme, segment, names, why, wrongIf, timeFrame } = card;
  if (names.state !== SET || why.state !== SET || wrongIf.state !== SET || timeFrame.state !== SET) return null;
  const head = [];
  if (theme.state === SET && isText(theme.value)) head.push(`My theme is ${bare(theme.value)}`);
  if (segment.state === SET && !segment.skipped && isText(segment.value)) head.push(`through ${bare(segment.value)}`);
  head.push(`built on ${joinNames(names.value)}`);
  const first = head.join(', ');
  return `${first[0].toUpperCase()}${first.slice(1)}, because ${bare(why.shared)}. It's wrong if ${bare(wrongIf.text)}. Time frame: ${timeFrameLabelOf(timeFrame.value)}.`;
}

// ── the offers ────────────────────────────────────────────────────────────────

/**
 * The dead end as it stands now (§B4.5; review RB-5): find_names left no supported company AND the record still
 * supports none — a company sourced later (a direction step) lifts it.
 */
export const blockedNow = (card, ctx) => Boolean(card.names.blocked) && ctx.supported.length === 0;

/** Is there a choice on the card for `part` that the partner could pick among (DR-2)? */
export function pickableOf(card, part, ctx) {
  if (!PICK_PARTS.includes(part) || card[part].state === SET) return false;
  if (part === 'segment') return Array.isArray(card.segment.map) && card.segment.map.length >= THESIS_LIMITS.segmentsMin;
  if (part === 'names') return card.segment.state === SET && ctx.supported.length > 0;
  if (part === 'wrongIf') return card.wrongIf.options.length > 0;
  return card.why.state === SET; // timeFrame: the partner says which fits the why
}

/**
 * The research goals on offer now (§B4.2 — the server decides; each is one step). None when the investigation is
 * not open or the steps are spent (DR-4). A story or a drop verifies first: until a `verify_source` step has
 * completed it is the only research goal (with `direction`, always on offer).
 * @returns {{ goal: string, part?: string }[]}
 */
export function offeredGoalsOf(card, ctx) {
  if (!ctx.open || ctx.stepsLeft <= 0) return [];
  const out = [];
  if ((ctx.entryKind === 'item' || ctx.entryKind === 'signaldrop') && !ctx.verified) {
    out.push({ goal: 'verify_source' });
  } else {
    // SQ-2: own words longer than the theme's limit leave the theme unset; the first map suggests one.
    const themeReady = card.theme.state === SET || (ctx.entryKind === 'observation' && !isText(card.theme.suggestion));
    if (themeReady && card.segment.state !== SET && card.names.state !== SET) out.push({ goal: 'map_segments' });
    if (card.theme.state === SET && card.segment.state === SET && card.names.state !== SET && !blockedNow(card, ctx)) out.push({ goal: 'find_names' });
    if (card.names.state === SET && card.why.state !== SET) out.push({ goal: 'build_why' });
    for (const part of THESIS_PARTS) if (card[part].state === SET) out.push({ goal: 'strengthen', part });
    for (const part of PICK_PARTS) if (pickableOf(card, part, ctx)) out.push({ goal: 'pick', part });
  }
  out.push({ goal: 'direction' });
  return out;
}

/** Is `{ goal, part }` on offer now? The step's admission asks this inside its transaction. */
export const isGoalOffered = (card, ctx, { goal, part = null }) => offeredGoalsOf(card, ctx).some((g) => g.goal === goal && (g.part ?? null) === (part ?? null));

/**
 * The free choices valid now (§B4.3; V2-3: no step, no model call). Each is a `card` op the client may send:
 * `{ op, part, value? , input? , options? , min?, max? }` — `input` names what the player types, `options` the values
 * a multi-pick chooses among. None once the investigation is not open.
 */
export function freeChoicesOf(card, ctx) {
  if (!ctx.open) return [];
  const out = [];
  // theme
  if (card.theme.state !== SET) {
    if (isText(card.theme.suggestion)) out.push({ op: 'confirm', part: 'theme', value: card.theme.suggestion });
    out.push({ op: 'set', part: 'theme', input: 'text', max: THESIS_LIMITS.theme });
  }
  // segment
  if (card.segment.state !== SET) {
    for (const m of card.segment.map ?? []) out.push({ op: 'set', part: 'segment', value: m.label });
    out.push({ op: 'set', part: 'segment', value: 'skip' });
    if (card.pick?.part === 'segment') out.push({ op: 'confirm', part: 'segment', value: card.pick.value });
  }
  // names
  const supported = supportedSymbolsOf(ctx);
  if (card.names.state !== SET && supported.length > 0) {
    out.push({ op: 'set', part: 'names', options: supported, min: THESIS_LIMITS.namesMin, max: THESIS_LIMITS.namesMax });
    if (card.pick?.part === 'names') out.push({ op: 'confirm', part: 'names', value: card.pick.value });
  }
  // why
  const proposal = card.why.proposal;
  if (proposal && card.names.state === SET && card.why.state !== SET) {
    const missing = namesWithoutReasonOf(ctx, proposal.reasons, card.names.value);
    if (missing.length === 0) {
      if (sharedIssueOf(ctx, proposal.shared, heldReasons(ctx, proposal, card.names.value), card.names.value) === null) out.push({ op: 'confirm', part: 'why' });
      if (proposal.reasons.length > card.names.value.length) out.push({ op: 'set', part: 'why', options: proposal.reasons.map((_, i) => i) });
    } else {
      // SQ-3: a name with no sourced reason — the free choice drops it (S-B4 keeps the proposal for the rest). Offered
      // only while the why is not set: dropping a name never silently clears a confirmed why (RA-3).
      const rest = card.names.value.filter((s) => !missing.includes(s));
      if (rest.length > 0) out.push({ op: 'set', part: 'names', value: rest, reason: 'drop_unsourced', clears: card.wrongIf.priceLines.length ? ['priceLines'] : [] });
    }
  }
  // wrong if
  if (card.wrongIf.state !== SET) {
    card.wrongIf.options.forEach((o, i) => out.push({ op: 'set', part: 'wrongIf', value: { option: i } }));
    out.push({ op: 'set', part: 'wrongIf', input: 'text', max: THESIS_LIMITS.wrongIf });
    if (card.pick?.part === 'wrongIf') out.push({ op: 'confirm', part: 'wrongIf', value: card.pick.value });
  } else if (card.names.state === SET) {
    out.push({ op: 'set', part: 'wrongIf', input: 'priceLines', options: [...card.names.value] });
  }
  // time frame
  if (card.timeFrame.state !== SET) {
    for (const h of ADOPTABLE_HORIZONS) out.push({ op: 'set', part: 'timeFrame', value: h });
    if (card.timeFrame.suggestion) out.push({ op: 'confirm', part: 'timeFrame', value: card.timeFrame.suggestion.value });
    else if (card.pick?.part === 'timeFrame') out.push({ op: 'confirm', part: 'timeFrame', value: card.pick.value });
  }
  // Change: any set part but the theme (a different theme is a new investigation).
  for (const part of THESIS_PARTS) if (part !== 'theme' && card[part].state === SET) out.push({ op: 'clear', part, clears: clearedBy(part).slice(1) });
  return out;
}

// ── the player's free action (§B4.3) ──────────────────────────────────────────

const refusal = (reason) => ({ ok: false, reason });
const cleanWords = (raw, max) => {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex -- control characters never reach a record (B1's rule for the player's words)
  const s = raw.replace(/[<>{}]/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  return s.length > 0 && s.length <= max ? s : null;
};

/** The parts a change of `part` clears (§B3), the part itself first. */
const clearedBy = (part) => [part, ...(THESIS_DEPENDENTS[part] ?? []), ...(part === 'segment' ? THESIS_DEPENDENTS.names : [])].filter((p, i, a) => a.indexOf(p) === i);

/**
 * Clear `part` and what depends on it (§B3), on a copy. `keepProposalFor`: the names that remain after a narrowing —
 * the why proposal is kept for them, minus the dropped names' reasons (§B10 S-B4). The maps, options and the theme's
 * suggestion are the partner's offers and stay; the pick goes when it was for a cleared dependent.
 */
function cleared(card, part, { keepProposalFor = null } = {}) {
  const next = structuredClone(card);
  const parts = clearedBy(part);
  for (const p of parts) {
    if (p === 'segment') Object.assign(next.segment, { state: UNSET, value: null, by: null, findingIds: [], skipped: false });
    if (p === 'names') Object.assign(next.names, { state: UNSET, value: [], by: null, blocked: null });
    if (p === 'why') {
      const proposal = keepProposalFor && next.why.proposal
        ? { ...next.why.proposal, reasons: next.why.proposal.reasons.filter((r) => keepProposalFor.includes(r.symbol)), forNames: [...keepProposalFor] }
        : (p === part ? next.why.proposal : null); // a why cleared by itself keeps its proposal; one cleared by a names change does not
      Object.assign(next.why, { state: UNSET, by: null, shared: null, reasons: [], against: null, proposal });
    }
    if (p === 'wrongIf') Object.assign(next.wrongIf, { state: UNSET, by: null, text: null, findingIds: [], priceLines: [] });
    if (p === 'timeFrame') Object.assign(next.timeFrame, { state: UNSET, by: null, value: null });
  }
  if (parts.includes('names')) next.wrongIf.priceLines = []; // changing the names clears the price lines (§B3)
  if (next.pick && parts.slice(1).includes(next.pick.part)) next.pick = null;
  return next;
}

/** Was `prev` → `value` a change of the segment (§B3: only a change clears its dependents)? */
const segmentChanged = (seg, { skipped, value }) => seg.state === SET && (seg.skipped !== skipped || seg.value !== value); // unset → set changes nothing set (RA-3)
const sameNames = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** Apply a names change (set or confirm), with §B3's dependencies and §B10 S-B4's narrowing. */
function withNames(card, value, by) {
  const old = card.names.state === SET ? card.names.value : (card.why.proposal?.forNames ?? []);
  const narrowing = old.length > 0 && value.every((s) => old.includes(s));
  let next = card;
  if (!(card.names.state === SET && sameNames(card.names.value, value))) {
    next = cleared(card, 'names', { keepProposalFor: narrowing ? value : null });
  } else {
    next = structuredClone(card);
  }
  next.names = { state: SET, value: [...value], by, blocked: null };
  if (next.pick?.part === 'names') next.pick = null;
  return next;
}

/** Parse a names value: one to four distinct symbols, each currently supported. */
function namesValueOf(raw, ctx) {
  if (!Array.isArray(raw)) return null;
  const syms = raw.map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''));
  const supported = new Set(supportedSymbolsOf(ctx));
  if (syms.length < THESIS_LIMITS.namesMin || syms.length > THESIS_LIMITS.namesMax || new Set(syms).size !== syms.length) return null;
  return syms.every((s) => supported.has(s)) ? syms : null;
}

/** The reasons of a proposal that hold now for the card's names, by index (`keep`: the indexes the player kept). */
function heldReasons(ctx, proposal, names, keep = null) {
  return proposal.reasons
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => (keep === null || keep.includes(i)) && names.includes(r.symbol) && reasonHolds(ctx, r))
    .map(({ r }) => ({ symbol: r.symbol, text: r.text, findingIds: [...r.findingIds] }));
}

/** The point against as it stands now: kept only while every finding behind it is current (§B4.2 rule 2). */
const againstNow = (ctx, against) => (against && idsOf(against.findingIds).length > 0 && against.findingIds.every((id) => isCurrent(ctx, id))
  ? { text: against.text, findingIds: [...against.findingIds] } : null);

/**
 * The why's shared reason, checked against what a confirm keeps (§B4.3; review RA-1): every number in it sits in a
 * current Source-backed finding of the KEPT reasons, and it names no supported company the card does not name. The
 * rule's name when it fails, else null.
 */
export function sharedIssueOf(ctx, shared, reasons, names) {
  const held = (Array.isArray(reasons) ? reasons : []).flatMap((r) => idsOf(r.findingIds)).map((id) => ctx.current.get(id)).filter((f) => f?.status === 'verified');
  if (sentencesOf(String(shared ?? '')).some((s) => strayNumberOf(s, held) !== undefined)) return 'unsupported_number';
  if (ctx.supported.some((c) => !names.includes(c.symbol) && namesCompany(shared, c))) return 'names_another_company';
  return null;
}

/** One price line, validated: a set name, a positive level under PRICE_LEVEL_MAX. */
function priceLinesOf(raw, names) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const p of raw) {
    if (!isPlainObject(p) || Object.keys(p).some((k) => k !== 'symbol' && k !== 'level')) return null;
    const symbol = typeof p.symbol === 'string' ? p.symbol.trim().toUpperCase() : '';
    if (!names.includes(symbol) || out.some((x) => x.symbol === symbol)) return null;
    if (typeof p.level !== 'number' || !Number.isFinite(p.level) || p.level <= 0 || p.level >= PRICE_LEVEL_MAX) return null;
    out.push({ symbol, level: p.level });
  }
  return out;
}

/** The short line the `card` exchange records (R-21): what the player set, in plain words. */
function labelOf(op, part, card) {
  if (op === 'clear') return `Changed ${PART_LABELS[part].toLowerCase()}`;
  if (part === 'theme') return `Theme: ${card.theme.value}`;
  if (part === 'segment') return card.segment.skipped ? 'Segment: skipped' : `Segment: ${card.segment.value}`;
  if (part === 'names') return `Names: ${joinNames(card.names.value)}`;
  if (part === 'why') return op === 'confirm' ? 'Why: confirmed' : `Why: ${card.why.reasons.length} ${card.why.reasons.length === 1 ? 'reason' : 'reasons'} kept`;
  if (part === 'wrongIf') {
    const lines = card.wrongIf.priceLines.map((p) => `${p.symbol} below ${p.level}`).join(', ');
    return `Wrong if: ${card.wrongIf.text}${lines ? ` · price line ${lines}` : ''}`;
  }
  return `Time frame: ${timeFrameLabelOf(card.timeFrame.value)}`;
}

/**
 * The player's free action, pure (§B4.3): apply one op to the card. The caller has checked the session, the
 * record, `rev` and the opId; this decides only whether the op is valid now, and what it does.
 * @param {object} card
 * @param {{ op: string, part: string, value?: any }} req
 * @param {object} ctx   cardContextOf(...)
 * @returns {{ ok: true, card: object, label: string } | { ok: false, reason: string }}
 */
export function applyCardOp(card, { op, part, value }, ctx) {
  if (!CARD_OPS.includes(op) || !THESIS_PARTS.includes(part)) return refusal('unknown_op');
  let next = null;

  if (op === 'clear') {
    if (part === 'theme') return refusal('theme_fixed'); // a different theme is a new investigation (§B3)
    if (card[part].state !== SET) return refusal('not_set');
    next = cleared(card, part);
    return { ok: true, card: next, label: labelOf('clear', part, next) };
  }

  if (part === 'theme') {
    if (card.theme.state === SET) return refusal('theme_fixed');
    if (op === 'confirm') {
      if (!isText(card.theme.suggestion)) return refusal('no_suggestion');
      next = structuredClone(card);
      next.theme = { state: SET, value: card.theme.suggestion, by: 'partner_suggested_confirmed', suggestion: null };
    } else {
      const text = cleanWords(isPlainObject(value) ? value.text : value, THESIS_LIMITS.theme);
      if (!text) return refusal('invalid_value');
      next = structuredClone(card);
      next.theme = { state: SET, value: text, by: 'player_wrote', suggestion: null };
    }
  } else if (part === 'segment') {
    let label;
    let by;
    if (op === 'confirm') {
      if (card.pick?.part !== 'segment') return refusal('no_suggestion');
      if (!idsOf(card.pick.findingIds).every((id) => isCurrent(ctx, id))) return refusal('suggestion_stale');
      label = card.pick.value;
      by = 'partner_suggested_confirmed';
    } else {
      label = isPlainObject(value) ? value.label : value;
      by = 'player_chose';
    }
    const skipped = op === 'set' && label === 'skip';
    const entry = skipped ? null : (card.segment.map ?? []).find((m) => m.label === label);
    if (!skipped && !entry) return refusal('invalid_value');
    const target = { skipped, value: skipped ? null : entry.label };
    next = segmentChanged(card.segment, target) ? cleared(card, 'segment') : structuredClone(card);
    next.segment = { ...next.segment, state: SET, by, skipped, value: target.value, findingIds: skipped ? [] : [...idsOf(entry.findingIds)] };
    if (next.pick?.part === 'segment') next.pick = null;
  } else if (part === 'names') {
    let syms;
    let by;
    if (op === 'confirm') {
      if (card.pick?.part !== 'names') return refusal('no_suggestion');
      if (!idsOf(card.pick.findingIds).every((id) => isCurrent(ctx, id))) return refusal('suggestion_stale');
      syms = namesValueOf(card.pick.value, ctx);
      by = 'partner_suggested_confirmed';
    } else {
      syms = namesValueOf(value, ctx);
      by = 'player_chose';
    }
    if (!syms) return refusal(op === 'confirm' ? 'suggestion_stale' : 'invalid_value');
    next = withNames(card, syms, by);
  } else if (part === 'why') {
    const proposal = card.why.proposal;
    if (!proposal) return refusal('no_suggestion');
    if (card.names.state !== SET) return refusal('names_unset');
    let keep = null;
    if (op === 'set') {
      const k = isPlainObject(value) && Array.isArray(value.keep) ? value.keep : null;
      if (!k || k.some((i) => !Number.isSafeInteger(i) || i < 0 || i >= proposal.reasons.length) || new Set(k).size !== k.length) return refusal('invalid_value');
      keep = k;
    }
    const reasons = heldReasons(ctx, proposal, card.names.value, keep);
    if (namesWithoutReasonOf(ctx, reasons, card.names.value).length > 0) return refusal(op === 'confirm' ? 'why_incomplete' : 'invalid_value');
    // §B4.3: a confirm re-checks the suggestion against the fresh record — the shared reason's numbers must sit in the
    // KEPT reasons' Source-backed findings, and it may name no supported company the card does not name (RA-1)
    if (sharedIssueOf(ctx, proposal.shared, reasons, card.names.value) !== null) return refusal('shared_unsupported');
    next = structuredClone(card);
    next.why = {
      state: SET, by: op === 'confirm' ? 'partner_suggested_confirmed' : 'player_chose', shared: proposal.shared, reasons,
      against: againstNow(ctx, proposal.against), proposal: null,
    };
  } else if (part === 'wrongIf') {
    next = structuredClone(card);
    if (op === 'confirm') {
      if (card.wrongIf.state === SET) return refusal('already_set');
      if (card.pick?.part !== 'wrongIf') return refusal('no_suggestion');
      const option = card.wrongIf.options.find((o) => o.text === card.pick.value);
      if (!option || !idsOf(option.findingIds).every((id) => isCurrent(ctx, id))) return refusal('suggestion_stale');
      next.wrongIf = { ...next.wrongIf, state: SET, by: 'partner_suggested_confirmed', text: option.text, findingIds: [...idsOf(option.findingIds)] };
      next.pick = null;
    } else {
      const v = isPlainObject(value) ? value : {};
      const keys = Object.keys(v);
      if (keys.some((k) => !['option', 'text', 'priceLines'].includes(k)) || ('option' in v && 'text' in v)) return refusal('invalid_value');
      if ('option' in v) {
        const option = Number.isSafeInteger(v.option) ? card.wrongIf.options[v.option] : undefined;
        if (!option) return refusal('invalid_value');
        if (!idsOf(option.findingIds).every((id) => isCurrent(ctx, id))) return refusal('suggestion_stale');
        Object.assign(next.wrongIf, { state: SET, by: 'player_chose', text: option.text, findingIds: [...idsOf(option.findingIds)] });
      } else if ('text' in v) {
        const text = cleanWords(v.text, THESIS_LIMITS.wrongIf); // the player's own words: stored as written, never scanned (§B4.3)
        if (!text) return refusal('invalid_value');
        Object.assign(next.wrongIf, { state: SET, by: 'player_wrote', text, findingIds: [] });
      } else if (card.wrongIf.state !== SET || !('priceLines' in v)) {
        return refusal('invalid_value');
      }
      if ('priceLines' in v) {
        if (card.names.state !== SET) return refusal('names_unset');
        const lines = priceLinesOf(v.priceLines, card.names.value);
        if (!lines) return refusal('invalid_value');
        next.wrongIf.priceLines = lines;
      }
      if (next.pick?.part === 'wrongIf') next.pick = null;
    }
  } else if (part === 'timeFrame') {
    next = structuredClone(card);
    if (op === 'confirm') {
      const v = card.timeFrame.suggestion?.value ?? (card.pick?.part === 'timeFrame' ? card.pick.value : null);
      if (!ADOPTABLE_HORIZONS.includes(v)) return refusal('no_suggestion');
      next.timeFrame = { state: SET, by: 'partner_suggested_confirmed', value: v, suggestion: null };
    } else {
      const v = isPlainObject(value) ? value.value : value;
      if (!ADOPTABLE_HORIZONS.includes(v)) return refusal('invalid_value');
      next.timeFrame = { state: SET, by: 'player_chose', value: v, suggestion: null };
    }
    if (next.pick?.part === 'timeFrame') next.pick = null;
  }
  return { ok: true, card: next, label: labelOf(op, part, next) };
}

/**
 * The free action as the store applies it (§B4.3): an opId already applied answers the card unchanged (idempotent);
 * otherwise the op, then `rev + 1` and the opId kept. The caller checks `rev` first (409 card_stale).
 * @returns {{ ok: true, applied: boolean, card: object, label: string|null } | { ok: false, reason: string }}
 */
export function cardOpOf(card, { opId, op, part, value }, ctx) {
  if (Array.isArray(card.ops) && card.ops.includes(opId)) return { ok: true, applied: false, card, label: null };
  const out = applyCardOp(card, { op, part, value }, ctx);
  if (!out.ok) return out;
  return { ok: true, applied: true, card: { ...out.card, rev: card.rev + 1, ops: [...(card.ops ?? []), opId].slice(-OPS_KEPT) }, label: out.label };
}

// ── a step's proposals (§B4.2: "Proposals land on the card as suggested / proposal / options / map") ──────────

/**
 * Land a validated step's proposals on the FRESH card (read in the step's own transaction), then `rev + 1`. Nothing
 * here sets a part. A proposal for a part the player set meanwhile is not landed; a pick that no longer names a
 * choice on the card is dropped (the choices stay unmarked); every step replaces the pick, with null when it has none.
 * @param {object} card
 * @param {object} p   thesisSchema.validateBuildTurn's `proposals`
 * @param {object} ctx cardContextOf(...) for the record AFTER the step's findings land
 */
export function applyProposals(card, p, ctx) {
  const next = structuredClone(card);
  if (isText(p.themeSuggestion) && next.theme.state !== SET) next.theme.suggestion = p.themeSuggestion;
  if (Array.isArray(p.map) && p.map.length >= THESIS_LIMITS.segmentsMin) next.segment.map = p.map.map((m) => ({ ...m, findingIds: [...m.findingIds] }));
  if (p.why && next.names.state === SET && sameNames(p.why.forNames, next.names.value)) next.why.proposal = structuredClone(p.why);
  if (Array.isArray(p.wrongIfOptions) && p.wrongIfOptions.length > 0) next.wrongIf.options = p.wrongIfOptions.map((o) => ({ ...o, findingIds: [...o.findingIds] }));
  if (p.timeFrame && next.timeFrame.state !== SET) next.timeFrame.suggestion = { value: p.timeFrame.value, reason: p.timeFrame.reason };
  next.pick = p.pick && pickStillValid(next, p.pick, ctx) ? structuredClone(p.pick) : null;
  if (p.goal === 'find_names' && next.names.state !== SET) next.names.blocked = ctx.supported.length === 0 ? 'no_listed_company' : null;
  next.rev = card.rev + 1;
  return next;
}

/** A pick names one of the card's current choices for a part the player has not set. */
function pickStillValid(card, pick, ctx) {
  if (!PICK_PARTS.includes(pick.part) || card[pick.part].state === SET) return false;
  if (pick.part === 'segment') return (card.segment.map ?? []).some((m) => m.label === pick.value);
  if (pick.part === 'names') return namesValueOf(pick.value, ctx) !== null;
  if (pick.part === 'wrongIf') return card.wrongIf.options.some((o) => o.text === pick.value);
  return ADOPTABLE_HORIZONS.includes(pick.value);
}

// ── the save (§B4.5) ──────────────────────────────────────────────────────────

/**
 * The findings the save carries (§B4.5): each name's relationship fact (companiesOf), every reason's findings and
 * the point against's — current only, each once, in that order. The adopt refuses past 28 (the builder's own cap).
 */
export function carriedIdsOf(card, ctx) {
  const out = [];
  const add = (id) => { if (isText(id) && isCurrent(ctx, id) && !out.includes(id)) out.push(id); };
  for (const s of card.names.value) add(ctx.supported.find((c) => c.symbol === s)?.relationshipFindingId);
  for (const r of card.why.reasons) for (const id of idsOf(r.findingIds)) add(id);
  for (const id of idsOf(card.why.against?.findingIds)) add(id);
  return out;
}

/** The version's invalidation conditions from the card's price lines (routine 12: a wrong-if line is a daily close below it). */
export const priceConditionsOf = (card) => card.wrongIf.priceLines.map((p) => ({ symbol: p.symbol, side: 'below', level: p.level, basis: 'daily_close' }));

/**
 * The card's own texts a saved statement's numbers may sit in, beside the carried Source-backed facts (§B4.5): the
 * wrong-if in words and the time frame's label, and the player's own theme (review RA-1 B3: the theme is the player's
 * framing, never evidence — routine 22).
 */
export const ownTextsOf = (card) => [card.theme.state === SET ? card.theme.value : null, card.wrongIf.text, timeFrameLabelOf(card.timeFrame.value)].filter(isText);

/**
 * Why a ready card's save would be refused, before the player taps Save (review RA-1, RA-7): more carried findings than
 * the idea builder takes, or a composed sentence that states a number no carried fact or own text holds, or that names
 * a supported company the card does not name. Null when the save would go through. The composed sentence names the
 * card's names by construction, so only the deselected companies are checked for it.
 */
export function saveIssueOf(card, ctx, statement = sentenceOf(card)) {
  const carried = carriedIdsOf(card, ctx);
  if (carried.length > KEPT_FINDINGS_MAX) return { code: 'too_many_evidence_refs', detail: carried.length };
  if (!statement) return null;
  const composed = statement === sentenceOf(card);
  try {
    assertThesisStatementSupported(statement, {
      record: { findings: [...ctx.current.values()] }, carried,
      selected: composed ? [] : card.names.value.map((s) => ctx.supported.find((c) => c.symbol === s)).filter(Boolean),
      deselected: ctx.supported.filter((c) => !card.names.value.includes(c.symbol)),
      ownTexts: ownTextsOf(card),
    });
    return null;
  } catch (err) {
    if (err instanceof AssertionError) return { code: err.code, detail: err.detail };
    throw err;
  }
}

/**
 * The card the saved list keeps (§B4.5; §B10 S-B1, PF-1): written ONCE, in the save transaction, never edited. It
 * carries its schemaVersion, the list and idea version it was saved with, the research session and record, the
 * statement saved, every part with who set it, the wrong-if in words, the price lines and the carried finding ids
 * (PF-2: the ids resolve on the research record, which nothing deletes or prunes).
 */
export function savedCardOf(card, { watchlistId, sessionId, researchWorkId, statement, carried, savedAt }) {
  const by = (p) => card[p].by ?? null;
  return {
    schemaVersion: SAVED_CARD_SCHEMA_VERSION, watchlistId, hypothesisVersion: 1, sessionId, researchWorkId, savedAt,
    statement, sentence: sentenceOf(card),
    theme: { value: card.theme.state === SET ? card.theme.value : null, by: by('theme') },
    segment: { value: card.segment.state === SET ? card.segment.value : null, skipped: card.segment.state === SET && card.segment.skipped, by: by('segment'), findingIds: [...card.segment.findingIds] },
    names: { value: [...card.names.value], by: by('names') },
    why: {
      shared: card.why.shared, by: by('why'),
      reasons: card.why.reasons.map((r) => ({ symbol: r.symbol, text: r.text, findingIds: [...r.findingIds] })),
      against: card.why.against ? { text: card.why.against.text, findingIds: [...card.why.against.findingIds] } : null,
    },
    wrongIf: { text: card.wrongIf.text, by: by('wrongIf'), findingIds: [...card.wrongIf.findingIds], priceLines: card.wrongIf.priceLines.map((p) => ({ ...p })) },
    timeFrame: { value: card.timeFrame.value, label: timeFrameLabelOf(card.timeFrame.value), by: by('timeFrame') },
    findingIds: [...carried],
  };
}

// ── the view every builder answer carries (§B4.4) ──────────────────────────────

/** The pick as the card shows it: each reason labelled by the server (§B10 S-B3) — Source-backed or the partner's reasoning. */
function pickViewOf(pick, ctx) {
  if (!pick) return null;
  const sourced = (ids) => idsOf(ids).length > 0 && ids.every((id) => isSourceBacked(ctx, id));
  return {
    part: pick.part, value: pick.value, reason: pick.reason, findingIds: [...idsOf(pick.findingIds)], asked: pick.asked === true,
    basis: sourced(pick.findingIds) ? 'source' : 'reasoning',
    reasons: (pick.reasons ?? []).map((r) => ({ text: r.text, findingIds: [...idsOf(r.findingIds)], basis: sourced(r.findingIds) ? 'source' : 'reasoning' })),
  };
}

/**
 * The `thesis` every builder answer carries (§B4.4): the parts with their derived states, who set each and their
 * finding ids; `rev`; `ready` and its blockers; the sentence; how many parts are filled; what a change clears; and
 * the choices — the research goals on offer (each one step), the free choices, and the pick. The client renders it
 * as received (§B7: it computes nothing).
 */
export function thesisViewOf(card, ctx) {
  const states = partStatesOf(card, ctx);
  const { ready, blockers } = readinessOf(card, ctx, states);
  const proposal = card.why.proposal;
  return {
    schemaVersion: card.schemaVersion, rev: card.rev,
    parts: {
      theme: { state: states.theme, value: card.theme.value, by: card.theme.by, suggestion: card.theme.suggestion },
      segment: { state: states.segment, value: card.segment.value, by: card.segment.by, skipped: card.segment.skipped, findingIds: [...card.segment.findingIds], map: card.segment.map },
      names: { state: states.names, value: [...card.names.value], by: card.names.by, blocked: blockedNow(card, ctx) ? card.names.blocked : null },
      why: {
        state: states.why, by: card.why.by, shared: card.why.shared, reasons: card.why.reasons, against: card.why.against,
        proposal: proposal ? { ...proposal, incomplete: namesWithoutReasonOf(ctx, proposal.reasons, card.names.state === SET ? card.names.value : proposal.forNames) } : null,
      },
      wrongIf: { state: states.wrongIf, by: card.wrongIf.by, text: card.wrongIf.text, findingIds: [...card.wrongIf.findingIds], options: card.wrongIf.options, priceLines: card.wrongIf.priceLines },
      timeFrame: { state: states.timeFrame, by: card.timeFrame.by, value: card.timeFrame.value, label: timeFrameLabelOf(card.timeFrame.value), suggestion: card.timeFrame.suggestion },
    },
    pick: pickViewOf(card.pick, ctx),
    filled: THESIS_PARTS.filter((p) => states[p] === SET).length,
    saveIssue: ready ? saveIssueOf(card, ctx) : null,
    ready, blockers,
    sentence: sentenceOf(card),
    dependents: THESIS_DEPENDENTS,
    choices: { research: offeredGoalsOf(card, ctx), free: freeChoicesOf(card, ctx) },
  };
}

/** A session's shape (§B2; §B10 S-B2): `builder` only when stamped so; anything else — no stamp included — is `ledger`. */
export const shapeOf = (session) => (session?.shape === 'builder' ? 'builder' : 'ledger');
export const isBuilder = (session) => shapeOf(session) === 'builder' && isPlainObject(session?.thesis);
