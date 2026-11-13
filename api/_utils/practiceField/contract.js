// api/_utils/practiceField/contract.js
//
// Practice Field T1a-1 — THE IDEA CONTRACT'S SHAPE (shared contract V2 §4.1; Amendment A F2; Amendment B item 4;
// Amendment C §6; build prompt §4 checks 0, 0b, 3–5). The deterministic half of admission that needs no book: what
// a draft must say before code will even look at the book's money. T1d's drafting call will produce this shape and
// call the same validator.
//
// EVERY FAILURE IS RETURNED TOGETHER (Astra V6 C6-02: never only the first), each as `{ code, …detail }`.
//
// INPUT (what a draft produces):
//   thesis      { text, author }            text ≤ 400 code points; author 'agent' | 'founder_fixture'
//   slot        'short' | 'medium' | 'long'
//   names       1–4 universe stocks (never a fund), no duplicates
//   weights?    { SYM: fraction } summing to exactly 1 (≤ 6 decimals each); omitted = equal
//   comparison  { type, symbols? }          same_stock_held | sector_fund | frozen_basket
//   lines       [{ symbol, distancePct }]   one per name, inside the slot's B5 band (below entry)
//   capitalUsd  positive, whole cents
//   origin      { kind, initiatedBy }
//   sources     [{ kind, ref }]             may be empty only for origin 'founder_fixture'
//
// Pure.

import {
  PRACTICE_FIELD_SLOTS, PRACTICE_FIELD_SLOT_NAMES, PRACTICE_FIELD_SLOT_HORIZON,
  PRACTICE_FIELD_ORIGIN_KINDS, PRACTICE_FIELD_INITIATED_BY, PRACTICE_FIELD_SOURCELESS_ORIGIN,
} from '../../../src/data/practiceFieldSlots.js';
import {
  THESIS_MAX_CODE_POINTS, THESIS_AUTHORS, COMPARISON_TYPES, FROZEN_BASKET_SIZE, COMPARISON_QUESTIONS, MIN_LEG_USD,
} from './constants.js';
import { normSymbol, isUniverseStock, isFundSymbol, fundOf, mandateSectorOf } from './symbols.js';
import { slotSessions } from './windows.js';
import {
  toCents, weightPpm, WEIGHT_PPM_TOTAL, equalSplitCents, weightedCents,
} from './money.js';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const codePoints = (s) => [...s].length;

/** A name's weight as an exact rational `{ num, den }`. */
export function weightOf(contract, symbol) {
  if (contract.weights.mode === 'equal') return { num: 1, den: contract.names.length };
  return { num: contract.weights.ppm[symbol], den: WEIGHT_PPM_TOTAL };
}

/**
 * Each name's planned dollars for `capitalCents`, in WHOLE CENTS, rounded down. The legs never sum above the
 * capital (three equal names of $20,000 are $6,666.66 each, and the two cents left stay the idea's cash) — sized
 * any other way, a leg's rounded cost could exceed what the idea has left and the all-or-nothing entry would never
 * fill.
 *
 * @returns {Object<string, number>} symbol → cents
 */
export function planLegCents(contract, capitalCents) {
  const out = {};
  for (const name of contract.names) {
    out[name] = contract.weights.mode === 'equal'
      ? equalSplitCents(capitalCents, contract.names.length)
      : weightedCents(capitalCents, contract.weights.ppm[name]);
  }
  return out;
}

/** An equal split of `capitalCents` over a comparison basket's symbols, in whole cents, rounded down. */
export function planBasketCents(symbols, capitalCents) {
  return Object.fromEntries(symbols.map((s) => [s, equalSplitCents(capitalCents, symbols.length)]));
}

/**
 * Validate and normalise a draft's contract.
 *
 * @returns {{ contract: object|null, refusals: Array<{ code: string }> }}  `contract` is null when any refusal stands
 */
export function normalizeIdeaContract(raw) {
  const refusals = [];
  const refuse = (code, detail = {}) => { refusals.push({ code, ...detail }); };
  const input = isPlain(raw) ? raw : {};
  if (!isPlain(raw)) refuse('contract_invalid');

  // 0. Thesis
  const thesisText = typeof input.thesis?.text === 'string' ? input.thesis.text.trim() : '';
  if (thesisText.length === 0) refuse('thesis_missing');
  else if (codePoints(thesisText) > THESIS_MAX_CODE_POINTS) refuse('thesis_too_long', { codePoints: codePoints(thesisText), max: THESIS_MAX_CODE_POINTS });
  const author = input.thesis?.author;
  if (!THESIS_AUTHORS.includes(author)) refuse('thesis_author_invalid');

  // 0b. Origin and sources (B-ORIGIN)
  const sourcesIn = Array.isArray(input.sources) ? input.sources : null;
  const sources = [];
  let sourcesOk = sourcesIn !== null;
  for (const s of sourcesIn || []) {
    if (isPlain(s) && PRACTICE_FIELD_ORIGIN_KINDS.includes(s.kind) && typeof s.ref === 'string' && s.ref.length > 0 && s.ref.length <= 200) sources.push({ kind: s.kind, ref: s.ref });
    else sourcesOk = false;
  }
  if (!sourcesOk) refuse('sources_invalid');
  const origin = isPlain(input.origin) ? { kind: input.origin.kind, initiatedBy: input.origin.initiatedBy } : null;
  const originShapeOk = origin !== null && PRACTICE_FIELD_ORIGIN_KINDS.includes(origin.kind) && PRACTICE_FIELD_INITIATED_BY.includes(origin.initiatedBy);
  const originMatched = originShapeOk && (sources.some((s) => s.kind === origin.kind)
    || (origin.kind === PRACTICE_FIELD_SOURCELESS_ORIGIN && sources.length === 0));
  if (!originShapeOk || !originMatched) refuse('origin_invalid', { reason: !originShapeOk ? 'missing_or_unknown' : 'matches_no_source' });

  // Slot
  const slot = PRACTICE_FIELD_SLOT_NAMES.includes(input.slot) ? input.slot : null;
  if (slot === null) refuse('slot_invalid');
  const sessions = slot ? slotSessions(slot) : null;
  if (slot !== null && sessions === null) refuse('slot_invalid', { reason: 'no_window' });

  // 3. Names
  const { min: minNames, max: maxNames } = PRACTICE_FIELD_SLOTS.B3_NAMES_PER_IDEA;
  const namesIn = Array.isArray(input.names) ? input.names : [];
  const names = [];
  let namesOk = Array.isArray(input.names);
  if (namesIn.length < minNames || namesIn.length > maxNames) { refuse('names_count_invalid', { count: namesIn.length, min: minNames, max: maxNames }); namesOk = false; }
  for (const rawName of namesIn) {
    const sym = normSymbol(rawName);
    if (sym === null) { refuse('name_invalid'); namesOk = false; continue; }
    if (names.includes(sym)) { refuse('name_duplicate', { symbol: sym }); namesOk = false; continue; }
    if (isFundSymbol(sym)) { refuse('etf_not_a_name', { symbol: sym }); namesOk = false; continue; }
    if (!isUniverseStock(sym)) { refuse('name_not_in_universe', { symbol: sym }); namesOk = false; continue; }
    if (mandateSectorOf(sym) === null) { refuse('sector_unknown', { symbol: sym }); namesOk = false; continue; }
    names.push(sym);
  }

  // Weights (default equal)
  let weights = null;
  if (namesOk) {
    if (input.weights === undefined || input.weights === null) weights = { mode: 'equal' };
    else if (isPlain(input.weights)) {
      const ppm = {};
      let total = 0;
      let ok = Object.keys(input.weights).length === names.length;
      for (const name of names) {
        const key = Object.keys(input.weights).find((k) => normSymbol(k) === name);
        const p = key === undefined ? null : weightPpm(input.weights[key]);
        if (p === null) { ok = false; break; }
        ppm[name] = p;
        total += p;
      }
      if (ok && total === WEIGHT_PPM_TOTAL) weights = { mode: 'explicit', ppm };
      else refuse('weights_invalid');
    } else refuse('weights_invalid');
  }

  // 4. Comparison
  let comparison = null;
  const cmpType = input.comparison?.type;
  if (!COMPARISON_TYPES.includes(cmpType)) refuse('comparison_type_unsupported', { type: cmpType ?? null });
  else if (namesOk) {
    const symsIn = Array.isArray(input.comparison.symbols) ? input.comparison.symbols.map(normSymbol) : null;
    if (cmpType === 'same_stock_held') {
      const same = symsIn === null || (symsIn.length === names.length && names.every((n) => symsIn.includes(n)));
      if (!same) refuse('comparison_symbols_invalid', { reason: 'must_be_the_ideas_own_names' });
      else comparison = { type: cmpType, symbols: [...names] };
    } else if (cmpType === 'sector_fund') {
      const sym = symsIn && symsIn.length === 1 ? symsIn[0] : null;
      const fund = sym ? fundOf(sym) : null;
      if (!fund) refuse('comparison_fund_unknown', { symbol: sym });
      else {
        const off = names.filter((n) => mandateSectorOf(n) !== fund.represents);
        if (off.length > 0) refuse('comparison_sector_mismatch', { fund: sym, represents: fund.represents, names: off });
        else comparison = { type: cmpType, symbols: [sym] };
      }
    } else {
      const syms = symsIn || [];
      const distinct = [...new Set(syms)];
      if (syms.length < FROZEN_BASKET_SIZE.min || syms.length > FROZEN_BASKET_SIZE.max || distinct.length !== syms.length) {
        refuse('comparison_basket_size_invalid', { count: syms.length, min: FROZEN_BASKET_SIZE.min, max: FROZEN_BASKET_SIZE.max });
      } else {
        const bad = syms.filter((s) => s === null || !isUniverseStock(s));
        if (bad.length > 0) refuse('comparison_symbols_invalid', { reason: 'not_universe_stocks', symbols: bad });
        else comparison = { type: cmpType, symbols: [...syms] };
      }
    }
  }
  if (comparison) {
    comparison.question = COMPARISON_QUESTIONS[comparison.type];
    comparison.costPolicy = 'same_policy_as_idea';
  }

  // 5. Lines: one per name, inside the slot's band
  const lines = [];
  if (namesOk && slot) {
    const band = PRACTICE_FIELD_SLOTS.B5_LINE_DISTANCE[slot];
    const linesIn = Array.isArray(input.lines) ? input.lines : [];
    const bySym = new Map();
    let shapeOk = Array.isArray(input.lines) && linesIn.length === names.length;
    for (const l of linesIn) {
      const sym = normSymbol(l?.symbol);
      if (sym === null || bySym.has(sym) || !names.includes(sym) || typeof l.distancePct !== 'number' || !Number.isFinite(l.distancePct)) { shapeOk = false; continue; }
      bySym.set(sym, l.distancePct);
    }
    if (!shapeOk || bySym.size !== names.length) refuse('lines_invalid');
    else {
      for (const name of names) {
        const d = bySym.get(name);
        if (d < band.min || d > band.max) refuse('line_distance_out_of_band', { symbol: name, distancePct: d, min: band.min, max: band.max });
        lines.push({ symbol: name, distancePct: d });
      }
    }
  }

  // Capital: positive, whole cents
  const capitalUsd = input.capitalUsd;
  const capitalOk = typeof capitalUsd === 'number' && Number.isFinite(capitalUsd) && capitalUsd > 0 && toCents(capitalUsd) / 100 === capitalUsd;
  if (!capitalOk) refuse('capital_invalid');

  // Every planned leg — each name's, and each member's of a frozen basket — must be big enough to fill.
  if (capitalOk && namesOk && weights) {
    const minCents = toCents(MIN_LEG_USD);
    const capitalCents = toCents(capitalUsd);
    for (const [symbol, cents] of Object.entries(planLegCents({ names, weights }, capitalCents))) {
      if (cents < minCents) refuse('leg_too_small', { symbol, ledger: 'idea', plannedUsd: cents / 100, minUsd: MIN_LEG_USD });
    }
    if (comparison?.type === 'frozen_basket') {
      for (const [symbol, cents] of Object.entries(planBasketCents(comparison.symbols, capitalCents))) {
        if (cents < minCents) refuse('leg_too_small', { symbol, ledger: 'comparison', plannedUsd: cents / 100, minUsd: MIN_LEG_USD });
      }
    }
    if (capitalCents < minCents) refuse('leg_too_small', { symbol: null, ledger: 'benchmark', plannedUsd: capitalCents / 100, minUsd: MIN_LEG_USD });
  }

  if (refusals.length > 0) return { contract: null, refusals };
  return {
    contract: {
      thesis: { text: thesisText, author },
      slot,
      horizonEnum: PRACTICE_FIELD_SLOT_HORIZON[slot],
      sessions,
      names,
      weights,
      comparison,
      lines,
      capitalUsd,
      origin,
      sources,
    },
    refusals,
  };
}
