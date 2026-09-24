// api/_utils/callRecords/validate.js
//
// Cockpit Build 0 — THE CALLS VALIDATOR (spec docs/design/COCKPIT_SPEC_V1_3.md
// §3.2; contract docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §2, §3, §5).
//
// The only validation boundary for the model's `declarations` block. The trade
// validator never sees the block, and nothing here can touch a trade result.
// Pure: no I/O, no clock, no flag read. The horizon check is INJECTED (the
// resolver in horizon.js, bound to the check's instants by the caller), so the
// same function runs pre-commit — to decide the entry's `declarationsPhase` —
// and again at mint with the real mint instant.
//
// THE MAPPING (§3.2):
//   calledShots[] direction 'entry'                  → called_shot
//   calledShots[] direction 'exit',  defaultAction 'act'  → confirmation
//   calledShots[] direction 'exit',  defaultAction 'hold' → called_shot
//   fork                                             → pick (horizon next_check)
//   watching[], playerAsk                            → the declarations record only
//
// REMOVAL, never rewriting. A row that fails is removed WHOLE with a typed
// reason — the row, not its siblings — and a surviving row is kept exactly as
// declared (projected onto its typed fields; an inapplicable field is dropped,
// no value is ever edited). Rows are judged in SOURCE order (calledShots, then
// watching, then playerAsk, then fork; each array in index order), and the
// ORDINALS are assigned after every removal: the surviving calledShots in
// order, then the surviving fork. A malformed row never consumes an ordinal.
//
// A present non-finite `condition.level` is NOT malformed: it is born and
// minted `invalidated` (see invalidationReason). Reason precedence there:
// no_observation → level_non_finite → level_implausible.

import { CALL_KINDS } from '../tickCapture/captureConfig.js';

export { CALL_KINDS };

/** The caps (spec §3.2). Characters are Unicode code points. */
export const DECLARATION_CAPS = Object.freeze({
  said: 280,
  why: 140,
  question: 200,
  option: 60,
  shots: 6,
  watching: 6,
  forkOptions: 4,
  askOptions: 4,
  minOptions: 2,
  declarationsDocBytes: 16 * 1024,
  publicationBytes: 64 * 1024,
});

/** The typed removal reasons. */
export const REMOVAL_REASONS = Object.freeze([
  'malformed_block',            // the block itself is not an object — nothing born, no record
  'malformed',                  // a required field absent or wrong-typed; an optional one wrong-typed
  'oversize',                   // a string, a count or the document cap exceeded
  'too_few_options',            // a fork or a playerAsk with fewer than two options
  'outside_universe',           // a fork option naming a symbol outside the battle universe
  'explicit_invalid',           // an explicit expiry at or before the mint instant (§5)
  'no_slot_before_battle_end',  // next_check with no eligible slot before the battle ends (§5)
  'calendar_unavailable',       // the trading calendar is not maintained for the instant (§5)
]);

/** The typed reasons a born call is minted `invalidated` (contract §2), in precedence order. */
export const INVALIDATION_REASONS = Object.freeze(['no_observation', 'level_non_finite', 'level_implausible']);

/** |level − px| / px above this is implausible against the checked quote. */
export const IMPLAUSIBLE_LEVEL_RATIO = 0.25;

const SLOTS = Object.freeze(['star', 'core', 'support']);
const DIRECTIONS = Object.freeze(['entry', 'exit']);
const SIDES = Object.freeze(['above', 'below']);
const DEFAULT_ACTIONS = Object.freeze(['act', 'hold']);
const HORIZON_PHRASES = Object.freeze(['next_check', 'this_session', 'this_battle', 'explicit']);

const encoder = new TextEncoder();
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const chars = (s) => [...s].length;
/** The UTF-8 size of a value's JSON — the document-cap measure. */
export const jsonBytes = (v) => encoder.encode(JSON.stringify(v)).length;
/** An optional field: absent (undefined or null) or present. */
const absent = (v) => v === undefined || v === null;

/**
 * One calledShots row → { ok, row, reason }. The row is projected onto its
 * typed fields; nothing is edited.
 */
function checkShot(raw) {
  if (!isPlainObject(raw)) return { ok: false, reason: 'malformed' };
  const { symbol, direction, slot, counterpart, condition, horizonPhrase, expiresAtMs, defaultAction, said } = raw;
  if (!nonEmptyString(symbol)) return { ok: false, reason: 'malformed' };
  if (!DIRECTIONS.includes(direction)) return { ok: false, reason: 'malformed' };
  if (!SLOTS.includes(slot)) return { ok: false, reason: 'malformed' };
  if (!absent(counterpart) && !nonEmptyString(counterpart)) return { ok: false, reason: 'malformed' };
  if (!isPlainObject(condition) || !SIDES.includes(condition.side)) return { ok: false, reason: 'malformed' };
  // PRESENT and a number — a non-finite number is born (and minted invalidated).
  if (typeof condition.level !== 'number') return { ok: false, reason: 'malformed' };
  if (!HORIZON_PHRASES.includes(horizonPhrase)) return { ok: false, reason: 'malformed' };
  if (horizonPhrase === 'explicit' && !(typeof expiresAtMs === 'number' && Number.isFinite(expiresAtMs))) {
    return { ok: false, reason: 'malformed' };
  }
  if (!DEFAULT_ACTIONS.includes(defaultAction)) return { ok: false, reason: 'malformed' };
  if (!nonEmptyString(said)) return { ok: false, reason: 'malformed' };
  if (chars(said) > DECLARATION_CAPS.said) return { ok: false, reason: 'oversize' };
  const row = {
    symbol,
    direction,
    slot,
    ...(absent(counterpart) ? {} : { counterpart }),
    condition: { side: condition.side, level: condition.level },
    horizonPhrase,
    // `expiresAtMs` is applicable only with `explicit`; elsewhere it is dropped, never read.
    ...(horizonPhrase === 'explicit' ? { expiresAtMs } : {}),
    defaultAction,
    said,
  };
  return { ok: true, row };
}

function checkPlayerAsk(raw) {
  if (!isPlainObject(raw)) return { ok: false, reason: 'malformed' };
  const { question, options, symbol } = raw;
  if (!nonEmptyString(question)) return { ok: false, reason: 'malformed' };
  if (!Array.isArray(options) || options.some((o) => !nonEmptyString(o))) return { ok: false, reason: 'malformed' };
  if (!absent(symbol) && !nonEmptyString(symbol)) return { ok: false, reason: 'malformed' };
  if (options.length < DECLARATION_CAPS.minOptions) return { ok: false, reason: 'too_few_options' };
  if (options.length > DECLARATION_CAPS.askOptions) return { ok: false, reason: 'oversize' };
  if (chars(question) > DECLARATION_CAPS.question) return { ok: false, reason: 'oversize' };
  if (options.some((o) => chars(o) > DECLARATION_CAPS.option)) return { ok: false, reason: 'oversize' };
  return { ok: true, row: { question, options: [...options], ...(absent(symbol) ? {} : { symbol }) } };
}

function checkFork(raw, universe) {
  if (!isPlainObject(raw)) return { ok: false, reason: 'malformed' };
  const { slot, swapOut, options, said } = raw;
  if (!SLOTS.includes(slot)) return { ok: false, reason: 'malformed' };
  if (!nonEmptyString(swapOut)) return { ok: false, reason: 'malformed' };
  if (!nonEmptyString(said)) return { ok: false, reason: 'malformed' };
  if (!Array.isArray(options)) return { ok: false, reason: 'malformed' };
  if (options.some((o) => !isPlainObject(o) || !nonEmptyString(o.symbol) || !nonEmptyString(o.why))) {
    return { ok: false, reason: 'malformed' };
  }
  if (options.length < DECLARATION_CAPS.minOptions) return { ok: false, reason: 'too_few_options' };
  if (options.length > DECLARATION_CAPS.forkOptions) return { ok: false, reason: 'oversize' };
  if (chars(said) > DECLARATION_CAPS.said) return { ok: false, reason: 'oversize' };
  if (options.some((o) => chars(o.why) > DECLARATION_CAPS.why)) return { ok: false, reason: 'oversize' };
  // Exact membership: the universe's own spelling, never a case-folded guess.
  const members = new Set(Array.isArray(universe) ? universe : []);
  if (options.some((o) => !members.has(o.symbol))) return { ok: false, reason: 'outside_universe' };
  return {
    ok: true,
    row: { slot, swapOut, options: options.map((o) => ({ symbol: o.symbol, why: o.why })), said },
  };
}

/** The kind a surviving calledShots row mints as (§3.2 mapping). */
export function kindOfShot(row) {
  if (row.direction === 'entry') return 'called_shot';
  return row.defaultAction === 'act' ? 'confirmation' : 'called_shot';
}

/**
 * Validate a declarations block.
 *
 * @param {unknown} block the model's `declarations` value (a detached copy)
 * @param {object}  [ctx]
 * @param {string[]} [ctx.universe] the battle universe frozen at the prompt seam (fork options)
 * @param {(phrase: string, expiresAtMs?: number) => ({ expiresAtMs: number, basis: string } | { reason: string })} [ctx.resolveHorizon]
 *   the horizon resolver bound to this check's instants; when absent, horizons are not judged
 * @returns {{
 *   validated: null | { calledShots: object[], watching: string[], playerAsk: object|null, fork: object|null },
 *   removed: Array<{ source: string, index: number|null, reason: string }>,
 *   calls: Array<{ n: number, kind: string, source: 'calledShots'|'fork', index: number|null, row: object, horizon: object|null }>,
 *   phase: 'none' | 'expected',
 * }}
 */
export function validateDeclarations(block, { universe = [], resolveHorizon = null } = {}) {
  const removed = [];
  const empty = { validated: null, removed, calls: [], phase: 'none' };
  if (absent(block)) return empty;
  if (!isPlainObject(block)) {
    removed.push({ source: 'block', index: null, reason: 'malformed_block' });
    return empty;
  }

  // ---- per-row judgement, in source order --------------------------------
  const candidates = []; // { source, index, row, horizon }
  const judgeHorizon = (phrase, expiresAtMs) => {
    if (typeof resolveHorizon !== 'function') return { ok: true, horizon: null };
    const resolved = resolveHorizon(phrase, expiresAtMs);
    if (resolved && typeof resolved.reason === 'string') return { ok: false, reason: resolved.reason };
    return { ok: true, horizon: resolved };
  };

  if (!absent(block.calledShots)) {
    if (!Array.isArray(block.calledShots)) {
      removed.push({ source: 'calledShots', index: null, reason: 'malformed' });
    } else {
      block.calledShots.forEach((raw, index) => {
        const checked = checkShot(raw);
        if (!checked.ok) { removed.push({ source: 'calledShots', index, reason: checked.reason }); return; }
        const h = judgeHorizon(checked.row.horizonPhrase, checked.row.expiresAtMs);
        if (!h.ok) { removed.push({ source: 'calledShots', index, reason: h.reason }); return; }
        candidates.push({ source: 'calledShots', index, row: checked.row, horizon: h.horizon });
      });
    }
  }

  if (!absent(block.watching)) {
    if (!Array.isArray(block.watching)) {
      removed.push({ source: 'watching', index: null, reason: 'malformed' });
    } else {
      block.watching.forEach((raw, index) => {
        if (!nonEmptyString(raw)) { removed.push({ source: 'watching', index, reason: 'malformed' }); return; }
        candidates.push({ source: 'watching', index, row: raw, horizon: null });
      });
    }
  }

  if (!absent(block.playerAsk)) {
    const checked = checkPlayerAsk(block.playerAsk);
    if (!checked.ok) removed.push({ source: 'playerAsk', index: null, reason: checked.reason });
    else candidates.push({ source: 'playerAsk', index: null, row: checked.row, horizon: null });
  }

  if (!absent(block.fork)) {
    const checked = checkFork(block.fork, universe);
    if (!checked.ok) removed.push({ source: 'fork', index: null, reason: checked.reason });
    else {
      const h = judgeHorizon('next_check');
      if (!h.ok) removed.push({ source: 'fork', index: null, reason: h.reason });
      else candidates.push({ source: 'fork', index: null, row: checked.row, horizon: h.horizon });
    }
  }

  // ---- the count caps and the document cap, in source order ---------------
  const kept = { calledShots: [], watching: [], playerAsk: null, fork: null };
  const keptCandidates = [];
  const recordOf = () => kept;
  for (const c of candidates) {
    if (c.source === 'calledShots' && kept.calledShots.length >= DECLARATION_CAPS.shots) {
      removed.push({ source: c.source, index: c.index, reason: 'oversize' });
      continue;
    }
    if (c.source === 'watching' && kept.watching.length >= DECLARATION_CAPS.watching) {
      removed.push({ source: c.source, index: c.index, reason: 'oversize' });
      continue;
    }
    // Admit, then measure the record WITH it; over the cap → out again.
    if (c.source === 'calledShots') kept.calledShots.push(c.row);
    else if (c.source === 'watching') kept.watching.push(c.row);
    else if (c.source === 'playerAsk') kept.playerAsk = c.row;
    else kept.fork = c.row;
    if (jsonBytes(recordOf()) > DECLARATION_CAPS.declarationsDocBytes) {
      if (c.source === 'calledShots') kept.calledShots.pop();
      else if (c.source === 'watching') kept.watching.pop();
      else if (c.source === 'playerAsk') kept.playerAsk = null;
      else kept.fork = null;
      removed.push({ source: c.source, index: c.index, reason: 'oversize' });
      continue;
    }
    keptCandidates.push(c);
  }
  // A removal list in source order, whatever pass produced it.
  const sourceRank = { block: 0, calledShots: 1, watching: 2, playerAsk: 3, fork: 4 };
  removed.sort((a, b) => (sourceRank[a.source] - sourceRank[b.source]) || ((a.index ?? -1) - (b.index ?? -1)));

  const hasContent = kept.calledShots.length > 0 || kept.watching.length > 0 || kept.playerAsk !== null || kept.fork !== null;
  if (!hasContent) return { validated: null, removed, calls: [], phase: 'none' };

  // ---- ordinals, after every removal: shots in order, then the fork -------
  const calls = [];
  for (const c of keptCandidates) {
    if (c.source === 'calledShots') calls.push({ n: calls.length, kind: kindOfShot(c.row), source: 'calledShots', index: c.index, row: c.row, horizon: c.horizon });
  }
  for (const c of keptCandidates) {
    if (c.source === 'fork') calls.push({ n: calls.length, kind: 'pick', source: 'fork', index: null, row: c.row, horizon: c.horizon });
  }

  return { validated: kept, removed, calls, phase: 'expected' };
}

/**
 * Why a born shot is minted `invalidated`, or null when it mints `open`
 * (contract §2). Precedence: no_observation → level_non_finite →
 * level_implausible. A pick has no condition and never invalidates here.
 *
 * @param {{ symbol: string, condition: { level: number } }} row
 * @param {{ symbols: Record<string, { px: number }> } | null} observation the model-result observation
 */
export function invalidationReason(row, observation) {
  const entry = observation?.symbols?.[row?.symbol];
  if (!entry || !(typeof entry.px === 'number' && Number.isFinite(entry.px) && entry.px > 0)) return 'no_observation';
  const level = row?.condition?.level;
  if (!(typeof level === 'number' && Number.isFinite(level))) return 'level_non_finite';
  if (Math.abs(level - entry.px) / entry.px > IMPLAUSIBLE_LEVEL_RATIO) return 'level_implausible';
  return null;
}

/**
 * The tool-result seam (model path only, an ACCEPTED tool result): detach the
 * model's block and validate it once, pre-commit, to decide the entry's
 * `declarationsPhase`. `structuredClone`, never a JSON round trip: a present
 * non-finite level (a `1e999` literal parses to Infinity) must survive the
 * copy to be minted `invalidated`, not silently turned into a malformed null.
 * An uncloneable value is a malformed block.
 *
 * @returns {{ raw: unknown, validation: ReturnType<typeof validateDeclarations>, phase: 'none'|'expected' }}
 */
export function captureDeclarations(block, ctx = {}) {
  let raw;
  try {
    raw = block === undefined ? undefined : structuredClone(block);
  } catch {
    const validation = { validated: null, removed: [{ source: 'block', index: null, reason: 'malformed_block' }], calls: [], phase: 'none' };
    return { raw: null, validation, phase: 'none' };
  }
  const validation = validateDeclarations(raw, ctx);
  return { raw, validation, phase: validation.phase };
}
