// api/_utils/huddle/planTemplates.js
//
// Huddle S1 — THE TEMPLATE FAMILY `plan.v1` (spec V1.1 §4; Amendment A §A1; Amendment
// C V1.2 §C2, §C11, §C15). The rule (R-11): the model proposes template INSTANCES as
// JSON against a closed schema; code validates every value, renders the text and
// hashes it. No model string ever reaches the battle's instruction slot — not a
// ticker it was not given, not an event label, not a sentence. The player edits values
// or removes items; the server re-validates and re-renders (confirm, A §A1).
//
//   Stances (≤ 3 names):  HOLD t · TRIM t · CHASE t [above L] · FADE t [above L] · WATCH t
//   Lines (≤ 2):          NO_ADDS_BEFORE eventId · NO_SWAPS_TODAY · CUT_IF_BELOW t L ·
//                         NO_CHASE_ABOVE t L
//
// Values (§4.3): `t` matches ^[A-Z]{1,5}(\.[A-Z])?$ AND is in the session universe
// (ranked seat picks ∪ active-battle holdings ∪ equipped watchlist tickers); `L` is
// finite, positive, at most two decimals, within ±25 % of the symbol's morning close;
// `eventId` is a key of the session's deterministic event map (events.js). Every
// drop is recorded with its reason. Every stance and line carries
// `origin: { kind: 'huddle', recordKind: null, recordId: null }` in S1 (C2).
//
// The archetype's dissent row (dissentTable.js) is applied after the values: a stance
// of the row's `from` kind becomes its `to` kind (its level dropped), recorded in
// `dissent[]` and as a transform. A missing row is not an error here (the plan is
// still proposed); `archetypeSupported: false` tells confirm to refuse.
//
// Pure: no clock, no I/O. Imports only the canonical hash (node:crypto) and the table.

import { canonicalContentHash } from '../canonicalHash.js';
import { dissentRowOf } from './dissentTable.js';

export const TEMPLATE_VERSION = 'plan.v1';
export const STANCE_KINDS = Object.freeze(['HOLD', 'TRIM', 'CHASE', 'FADE', 'WATCH']);
export const LEVEL_STANCE_KINDS = Object.freeze(['CHASE', 'FADE']);
export const LINE_KINDS = Object.freeze(['NO_ADDS_BEFORE', 'NO_SWAPS_TODAY', 'CUT_IF_BELOW', 'NO_CHASE_ABOVE']);
export const MAX_STANCES = 3;
export const MAX_LINES = 2;
export const LEVEL_BAND = 0.25;
export const RENDERED_MAX_CHARS = 500;
export const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;
export const HUDDLE_ORIGIN = Object.freeze({ kind: 'huddle', recordKind: null, recordId: null });

/** Every reason an item can be dropped, and every reason one can be transformed. */
export const DROP_REASONS = Object.freeze({
  NOT_OBJECT: 'not_object',
  UNKNOWN_KIND: 'unknown_kind',
  UNKNOWN_KEY: 'unknown_key',
  TICKER_SYNTAX: 'ticker_syntax',
  TICKER_NOT_IN_UNIVERSE: 'ticker_not_in_universe',
  LEVEL_FORMAT: 'level_format',
  LEVEL_OUT_OF_RANGE: 'level_out_of_range',
  LEVEL_NO_REFERENCE: 'level_no_reference',
  EVENT_UNKNOWN: 'event_unknown',
  EVENT_UNTIMED: 'event_untimed',
  DUPLICATE: 'duplicate',
  COUNT_EXCEEDED: 'count_exceeded',
});
export const TRANSFORM_REASONS = Object.freeze({
  DISSENT: 'dissent',
  ORIGIN_NORMALIZED: 'origin_normalized',
  LEVEL_NORMALIZED: 'level_normalized',
});

// The closed schemas: the keys each kind may carry (origin is code's, accepted only so a
// stored item validates unchanged; any other origin is normalized, a transform).
const STANCE_KEYS = Object.freeze({
  HOLD: ['kind', 'ticker', 'origin'],
  TRIM: ['kind', 'ticker', 'origin'],
  WATCH: ['kind', 'ticker', 'origin'],
  CHASE: ['kind', 'ticker', 'level', 'origin'],
  FADE: ['kind', 'ticker', 'level', 'origin'],
});
const LINE_KEYS = Object.freeze({
  NO_ADDS_BEFORE: ['kind', 'eventId', 'origin'],
  NO_SWAPS_TODAY: ['kind', 'origin'],
  CUT_IF_BELOW: ['kind', 'ticker', 'level', 'origin'],
  NO_CHASE_ABOVE: ['kind', 'ticker', 'level', 'origin'],
});

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function originIsHuddle(o) {
  return isPlainObject(o) && Object.keys(o).length === 3 && o.kind === 'huddle' && o.recordKind === null && o.recordId === null;
}

/** A level as stored: a finite positive number with at most two decimals, or a reason it is not. */
export function checkLevelFormat(level) {
  if (typeof level !== 'number' || !Number.isFinite(level) || level <= 0) return { ok: false };
  const cents = Math.round(level * 100);
  if (Math.abs(cents / 100 - level) > 1e-9) return { ok: false };
  return { ok: true, value: cents / 100 };
}

/** Is the level within ±25 % of the reference close? (A missing close bounds nothing: the level cannot be checked.) */
export function levelInBand(level, close) {
  if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return null;
  return level >= close * (1 - LEVEL_BAND) - 1e-9 && level <= close * (1 + LEVEL_BAND) + 1e-9;
}

/** 48 → '48.00'. */
export const formatLevel = (level) => (Math.round(level * 100) / 100).toFixed(2);

function checkTicker(ticker, universe) {
  if (typeof ticker !== 'string' || !TICKER_RE.test(ticker)) return DROP_REASONS.TICKER_SYNTAX;
  if (!(universe instanceof Set) || !universe.has(ticker)) return DROP_REASONS.TICKER_NOT_IN_UNIVERSE;
  return null;
}

function checkLevel(level, ticker, closes, { required }) {
  if (level === undefined || level === null) return required ? { reason: DROP_REASONS.LEVEL_FORMAT } : { value: null };
  const fmt = checkLevelFormat(level);
  if (!fmt.ok) return { reason: DROP_REASONS.LEVEL_FORMAT };
  const close = closes instanceof Map ? closes.get(ticker) : undefined;
  const inBand = levelInBand(fmt.value, close);
  if (inBand === null) return { reason: DROP_REASONS.LEVEL_NO_REFERENCE };
  if (!inBand) return { reason: DROP_REASONS.LEVEL_OUT_OF_RANGE };
  return { value: fmt.value, normalized: fmt.value !== level };
}

function unknownKey(item, allowed) {
  return Object.keys(item).some((k) => !allowed.includes(k));
}

/**
 * Validate a proposal or a replacement against the closed schema and the session's
 * values, then apply the archetype's dissent row.
 *
 * @param {{ stances?: unknown[], lines?: unknown[] }} input
 * @param {{ universe: Set<string>, closes: Map<string, number|null>, events: { eligible: Map, untimedIds: Set }, archetype: string|null }} ctx
 * @returns {{ current: { stances: object[], lines: object[] }, drops: object[], transforms: object[], dissent: object[], archetypeSupported: boolean }}
 */
export function validatePlan(input, ctx) {
  const drops = [];
  const transforms = [];
  const dissent = [];
  const universe = ctx?.universe instanceof Set ? ctx.universe : new Set();
  const closes = ctx?.closes instanceof Map ? ctx.closes : new Map();
  const eligible = ctx?.events?.eligible instanceof Map ? ctx.events.eligible : new Map();
  const untimed = ctx?.events?.untimedIds instanceof Set ? ctx.events.untimedIds : new Set();
  const row = dissentRowOf(ctx?.archetype ?? null);

  const rawStances = Array.isArray(input?.stances) ? input.stances : [];
  const rawLines = Array.isArray(input?.lines) ? input.lines : [];

  // ---- stances ----
  const stances = [];
  const seenTickers = new Set();
  rawStances.forEach((item, index) => {
    const drop = (reason) => drops.push({ kind: 'stance', index, reason });
    if (!isPlainObject(item)) return drop(DROP_REASONS.NOT_OBJECT);
    if (!STANCE_KINDS.includes(item.kind)) return drop(DROP_REASONS.UNKNOWN_KIND);
    if (unknownKey(item, STANCE_KEYS[item.kind])) return drop(DROP_REASONS.UNKNOWN_KEY);
    const tickerReason = checkTicker(item.ticker, universe);
    if (tickerReason) return drop(tickerReason);
    let level = null;
    if (LEVEL_STANCE_KINDS.includes(item.kind)) {
      const lv = checkLevel(item.level, item.ticker, closes, { required: false });
      if (lv.reason) return drop(lv.reason);
      level = lv.value;
      if (lv.normalized) transforms.push({ kind: 'stance', index, reason: TRANSFORM_REASONS.LEVEL_NORMALIZED });
    }
    if (seenTickers.has(item.ticker)) return drop(DROP_REASONS.DUPLICATE);
    if (stances.length >= MAX_STANCES) return drop(DROP_REASONS.COUNT_EXCEEDED);
    seenTickers.add(item.ticker);
    if (own(item, 'origin') && !originIsHuddle(item.origin)) transforms.push({ kind: 'stance', index, reason: TRANSFORM_REASONS.ORIGIN_NORMALIZED });
    let kind = item.kind;
    if (row && kind === row.from) {
      dissent.push({ index: stances.length, kind: 'stance', archetype: ctx.archetype, from: row.from, to: row.to, ticker: item.ticker, reason: row.reason });
      transforms.push({ kind: 'stance', index, reason: TRANSFORM_REASONS.DISSENT });
      kind = row.to;
      level = null;
    }
    stances.push(LEVEL_STANCE_KINDS.includes(kind)
      ? { kind, ticker: item.ticker, level, origin: { ...HUDDLE_ORIGIN } }
      : { kind, ticker: item.ticker, origin: { ...HUDDLE_ORIGIN } });
  });

  // ---- lines ----
  const lines = [];
  const seenLines = new Set();
  rawLines.forEach((item, index) => {
    const drop = (reason) => drops.push({ kind: 'line', index, reason });
    if (!isPlainObject(item)) return drop(DROP_REASONS.NOT_OBJECT);
    if (!LINE_KINDS.includes(item.kind)) return drop(DROP_REASONS.UNKNOWN_KIND);
    if (unknownKey(item, LINE_KEYS[item.kind])) return drop(DROP_REASONS.UNKNOWN_KEY);
    let out;
    let dedupeKey;
    if (item.kind === 'NO_SWAPS_TODAY') {
      out = { kind: item.kind, origin: { ...HUDDLE_ORIGIN } };
      dedupeKey = item.kind;
    } else if (item.kind === 'NO_ADDS_BEFORE') {
      if (typeof item.eventId !== 'string') return drop(DROP_REASONS.EVENT_UNKNOWN);
      if (!eligible.has(item.eventId)) return drop(untimed.has(item.eventId) ? DROP_REASONS.EVENT_UNTIMED : DROP_REASONS.EVENT_UNKNOWN);
      out = { kind: item.kind, eventId: item.eventId, origin: { ...HUDDLE_ORIGIN } };
      dedupeKey = `${item.kind}|${item.eventId}`;
    } else {
      const tickerReason = checkTicker(item.ticker, universe);
      if (tickerReason) return drop(tickerReason);
      const lv = checkLevel(item.level, item.ticker, closes, { required: true });
      if (lv.reason) return drop(lv.reason);
      if (lv.normalized) transforms.push({ kind: 'line', index, reason: TRANSFORM_REASONS.LEVEL_NORMALIZED });
      out = { kind: item.kind, ticker: item.ticker, level: lv.value, origin: { ...HUDDLE_ORIGIN } };
      dedupeKey = `${item.kind}|${item.ticker}`;
    }
    if (seenLines.has(dedupeKey)) return drop(DROP_REASONS.DUPLICATE);
    if (lines.length >= MAX_LINES) return drop(DROP_REASONS.COUNT_EXCEEDED);
    seenLines.add(dedupeKey);
    if (own(item, 'origin') && !originIsHuddle(item.origin)) transforms.push({ kind: 'line', index, reason: TRANSFORM_REASONS.ORIGIN_NORMALIZED });
    lines.push(out);
  });

  return { current: { stances, lines }, drops, transforms, dissent, archetypeSupported: row !== null };
}

/** Whether a validation changed anything (A §A1: only a zero-change replacement confirms). */
export const validationChanged = (v) => v.drops.length > 0 || v.transforms.length > 0;

/** The plan's revision: sha256 of the canonical JSON of `current` (spec V1.1 §3.2). */
export const revisionOf = (current) => canonicalContentHash({ stances: current?.stances ?? [], lines: current?.lines ?? [] });

/** Is the plan empty (a quiet morning's stand-pat plan: nothing to confirm)? */
export const isEmptyPlan = (current) => (current?.stances?.length ?? 0) === 0 && (current?.lines?.length ?? 0) === 0;

function renderStance(s) {
  if (LEVEL_STANCE_KINDS.includes(s.kind) && typeof s.level === 'number') return `${s.kind} ${s.ticker} above ${formatLevel(s.level)}`;
  return `${s.kind} ${s.ticker}`;
}

function renderLine(l, eventLabelOf) {
  switch (l.kind) {
    case 'NO_ADDS_BEFORE': return `no adds before ${eventLabelOf(l.eventId)}`;
    case 'NO_SWAPS_TODAY': return 'no swaps today';
    case 'CUT_IF_BELOW': return `cut ${l.ticker} if it trades below ${formatLevel(l.level)}`;
    case 'NO_CHASE_ABOVE': return `do not chase ${l.ticker} above ${formatLevel(l.level)}`;
    default: throw new Error(`plan.v1: no renderer for line kind ${l.kind}`);
  }
}

/**
 * The deterministic rendering (§4.4): fixed sentences, validated values only, no time.
 * `eventLabels` maps an eventId to its fixed label (events.js); a line whose event has no
 * label cannot be rendered (it never validated).
 */
export function renderPlan(current, { etDate, eventLabels }) {
  const labelOf = (id) => {
    const label = eventLabels instanceof Map ? eventLabels.get(id) : null;
    if (typeof label !== 'string' || !label) throw new Error(`plan.v1: no label for event ${id}`);
    return label;
  };
  const parts = [`GAME PLAN for ${etDate}, confirmed by the player.`];
  if (current.stances.length > 0) parts.push(`Stances: ${current.stances.map(renderStance).join('; ')}.`);
  if (current.lines.length > 0) parts.push(`Lines: ${current.lines.map((l) => renderLine(l, labelOf)).join('; ')}.`);
  parts.push("These are the player's instructions for this session. Apply them within your archetype's method.");
  return parts.join('\n');
}

/** ≤ 500 characters, checked BEFORE filing (§4.4); else confirm answers `rendered_too_long`. */
export const renderedTooLong = (text) => typeof text !== 'string' || text.length > RENDERED_MAX_CHARS;

/** renderedTextHash = canonicalContentHash(renderedText) — the same hash the cron stamps as controls.directiveTextHash. */
export const renderedTextHashOf = (text) => canonicalContentHash(text);

/** The plan's directive thread id (spec V1.1 §4.5): the revision rides in it, no new battle key. */
export const planThreadIdOf = ({ uid, etDate, revision }) => `plan:${uid}:${etDate}:${revision}`;
export const PLAN_THREAD_PREFIX = 'plan:';
export const isPlanThreadId = (id) => typeof id === 'string' && id.startsWith(PLAN_THREAD_PREFIX);

const SPOKEN_STANCE = Object.freeze({ HOLD: 'hold', TRIM: 'trim', CHASE: 'chase', FADE: 'fade', WATCH: 'watch' });
const COUNT_WORD = Object.freeze({ 1: 'One line', 2: 'Two lines' });

/**
 * THE PLAN BEAT, narrated by code from the validated plan (spec V1.1 §5.3, AR-12): fixed
 * phrasing, never the model's words, and never a sentence about confirming (§7 rule 4).
 */
export function narratePlan(current, { eventLabels }) {
  if (isEmptyPlan(current)) return "Here's what I'd carry in today: nothing new. Stand pat on what you hold.";
  const sentences = [];
  if (current.stances.length > 0) {
    const said = current.stances.map((s) => (LEVEL_STANCE_KINDS.includes(s.kind) && typeof s.level === 'number'
      ? `${SPOKEN_STANCE[s.kind]} ${s.ticker} above ${formatLevel(s.level)}`
      : `${SPOKEN_STANCE[s.kind]} ${s.ticker}`));
    sentences.push(`Here's what I'd carry in today: ${said.join('; ')}.`);
  } else {
    sentences.push("Here's what I'd carry in today.");
  }
  if (current.lines.length > 0) {
    const labelOf = (id) => (eventLabels instanceof Map && eventLabels.get(id)) || 'the scheduled event';
    sentences.push(`${COUNT_WORD[current.lines.length]}: ${current.lines.map((l) => renderLine(l, labelOf)).join('; ')}.`);
  }
  return sentences.join(' ');
}
