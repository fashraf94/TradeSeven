// src/components/Research/ChartRead/chartRead.js
//
// The Chart view's read — THE WORDING, THE SHEET AND WHAT CHANGED, as pure functions of the route's body
// (build prompt §5, §6, CR-3, CR-6, CR-8; spec docs/specs/CHART_READ_SPEC_V1.md). The read shows a stored
// record: every word is chartReadCopy.js's, every number is the record's own field printed by format.js, and
// nothing is decided here — the state is the record's own verdict, reason, pattern and regime (RD-6).
//
// ONE DERIVATION, NAMED: the record's uptrend is two checks, not three. `regime_stack` chains two comparisons
// ([C, SMA_fast] > [SMA_fast, SMA_slow]) and records one result. The sheet's three uptrend rows and RD-7's
// words read each pair from that check's OWN recorded sides with its OWN operator — the evaluator's comparison
// (strict IEEE, no tolerance; thresholds.js SEMANTICS_NOTES) on the evaluator's numbers. Row 1 IS the recorded
// `pullback_close` check (the same sides). The pairs must AND to the recorded result, or the record is never
// shown in part (state `unshown`).
//
// Pure and Node-clean: no React, no clock (the caller hands in today's ET date), no I/O.

import { CHART_READ_COPY as C, RULE_SET_COPY, REFUSAL_WORDS, REFUSAL_FALLBACK, joinNouns } from './chartReadCopy.js';
import { marksOf, ruleSetOf, hasMarkTable, shownMarkNumbers } from './marks.js';
import { formatPrice, formatRatio, formatVolume, dayLabel, weekdayShort, weekdayLong, monthDay, decimalString, etTimeLabel } from './format.js';

/** Every state the read can be in. The first five open the sheet and draw marks. */
export const READ_STATES = Object.freeze(['valid_pullback', 'valid_breakout', 'regime', 'no_setup', 'extended', 'unknown', 'refused', 'absent', 'unknown_rule_set', 'unshown']);
export const SHEET_STATES = Object.freeze(['valid_pullback', 'valid_breakout', 'regime', 'no_setup', 'extended']);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const checkOf = (read, id) => (Array.isArray(read?.checks) ? read.checks.find((c) => c && c.id === id) : undefined);

/** The evaluator's comparison: unknown when either side is not a number; never a tolerance. */
function compare(op, a, b) {
  if (!isNum(a) || !isNum(b)) return 'unknown';
  switch (op) {
    case '>': return a > b;
    case '<': return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    default: return 'unknown';
  }
}

/**
 * The three uptrend rows from the record's own checks, or null when they do not agree with the recorded chain
 * (fail closed). Row 1 = `pullback_close` (C > SMA_fast); row 2 = `regime_stack`'s second pair; row 3 = `slow_rising`.
 */
export function uptrendRows(read) {
  const stack = checkOf(read, 'regime_stack');
  const close = checkOf(read, 'pullback_close');
  const rising = checkOf(read, 'slow_rising');
  if (!stack || !close || !rising || !Array.isArray(stack.lhs) || !Array.isArray(stack.rhs) || stack.lhs.length !== 2 || stack.rhs.length !== 2) return null;
  if (close.lhs !== stack.lhs[0] || close.rhs !== stack.rhs[0] || close.op !== stack.op) return null;
  const r1 = close.result;
  const r2 = compare(stack.op, stack.lhs[1], stack.rhs[1]);
  const r3 = rising.result;
  const chained = r1 === 'unknown' || r2 === 'unknown' ? 'unknown' : r1 === true && r2 === true;
  if (chained !== stack.result) return null;
  return [
    { key: 'closeAboveFast', result: r1, lhs: close.lhs, rhs: close.rhs, marks: [1] },
    { key: 'fastAboveSlow', result: r2, lhs: stack.lhs[1], rhs: stack.rhs[1], marks: [1, 2] },
    { key: 'slowRising', result: r3, lhs: rising.lhs, rhs: rising.rhs, marks: [2, 3] },
  ];
}

/** The read's state: the record's own answer, verdict, reason and pattern, mapped one to one (states never merge). */
export function readStateOf(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.answer === 'absent') return 'absent';
  if (body.answer === 'refused') return 'refused';
  if (body.answer !== 'measured' || !body.read || typeof body.read !== 'object') return null;
  const r = body.read;
  if (!RULE_SET_COPY[ruleSetOf(r)] || !hasMarkTable(r)) return 'unknown_rule_set';
  if (r.verdict === 'valid' && r.pattern === 'pullback_resume') return 'valid_pullback';
  if (r.verdict === 'valid' && r.pattern === 'breakout') return 'valid_breakout';
  if (r.verdict === 'invalid' && r.reason === 'regime') return 'regime';
  if (r.verdict === 'invalid' && r.reason === 'no_setup') return 'no_setup';
  if (r.verdict === 'invalid' && r.reason === 'extended') return 'extended';
  if (r.verdict === 'unknown') return 'unknown';
  return 'unshown';
}

/** CR-6: the change table, in order — the first row that matches wins (a pair two rows match is pinned in the tests). */
export const CHANGE_TABLE = Object.freeze([
  Object.freeze({ key: 'newPullback', when: (p, r) => p.verdict === 'invalid' && r.verdict === 'valid' && r.pattern === 'pullback_resume' }),
  Object.freeze({ key: 'newBreakout', when: (p, r) => p.verdict === 'invalid' && r.verdict === 'valid' && r.pattern === 'breakout' }),
  Object.freeze({ key: 'stretched', when: (p, r) => p.verdict === 'valid' && r.verdict === 'invalid' && r.reason === 'extended' }),
  Object.freeze({ key: 'patternGone', when: (p, r) => p.verdict === 'valid' && r.verdict === 'invalid' && r.reason === 'no_setup' }),
  Object.freeze({ key: 'leftUptrend', when: (p, r) => p.regime === 'uptrend' && (r.regime === 'downtrend' || r.regime === 'no_trend') }),
  Object.freeze({ key: 'backInUptrend', when: (p, r) => (p.regime === 'downtrend' || p.regime === 'no_trend') && r.regime === 'uptrend' }),
]);

/** What changed (CR-6), from `read` and `previous` only; null for any pair the table does not list. */
export function changeOf(read, previous) {
  if (!read || !previous || typeof read !== 'object' || typeof previous !== 'object') return null;
  // "Not valid" is `invalid` only: an unknown on either side shows no chip.
  if (read.verdict === 'unknown' || previous.verdict === 'unknown') return null;
  const day = weekdayShort(previous.session);
  if (!day) return null;
  const row = CHANGE_TABLE.find((x) => x.when(previous, read));
  return row ? C.change[row.key](day) : null;
}

const patternNames = (words, list) => list.map((p) => words.patterns[p]).filter(Boolean);

/** RD-7's words for the uptrend rows that failed, each true at equality too. Null when a number is missing. */
function regimeParts(rows, words) {
  const P = words.regimePart;
  const parts = [];
  const [close, fast, slow] = rows;
  if (close.result === false) {
    const sma = formatPrice(close.rhs);
    if (!sma || !isNum(close.lhs)) return null;
    parts.push(close.lhs === close.rhs ? P.closeAt(sma) : P.closeBelow(sma));
  }
  if (fast.result === false) parts.push(fast.lhs === fast.rhs ? P.fastLevel : P.fastBelow);
  if (slow.result === false) parts.push(slow.lhs === slow.rhs ? P.slowFlat : P.slowFalling);
  return parts.length ? parts : null;
}

/** An unknown verdict's reason in words (the facts the record lists missing). */
function unknownWhy(read, words) {
  if (read.reason === 'insufficient_history') return REFUSAL_WORDS.insufficient_history;
  const facts = (Array.isArray(read.missing) ? read.missing : []).map((f) => words.facts[f]).filter(Boolean);
  if (facts.length === 1) return words.missingOne(facts[0]);
  if (facts.length > 1) return words.missingMany(joinNouns(facts));
  if (Array.isArray(read.pullbackLows) && read.pullbackLows.some((p) => !isNum(p?.low))) return words.missingLow;
  return REFUSAL_WORDS.missing_fact;
}

const lineOf = (state, fields) => ({ state, glyph: 'none', lead: null, rest: '', second: null, opensSheet: false, ...fields });

/** The lead, its rest and the second line for a state the sheet opens in; null when a number it prints is missing. */
function leadOf(state, read, words) {
  const f = read.facts || {};
  if (state === 'valid_pullback') {
    const sma = formatPrice(f.SMA_fast);
    return sma ? { glyph: 'present', lead: words.pullbackLead, rest: words.pullbackRest(sma), second: words.pullbackSecond } : null;
  }
  if (state === 'valid_breakout') {
    const high = formatPrice(f.swingHigh);
    const x = isNum(f.V) && isNum(f.V_avg) && f.V_avg > 0 ? formatRatio(f.V / f.V_avg) : null;
    return high && x ? { glyph: 'present', lead: words.breakoutLead, rest: words.breakoutRest(high, x), second: null } : null;
  }
  if (state === 'regime') {
    const rows = uptrendRows(read);
    const parts = rows && regimeParts(rows, words);
    if (!parts) return null;
    return { glyph: 'absent', lead: words.regimeLead, rest: words.regimeRest(parts), second: read.regime === 'downtrend' ? words.regimeSecondDowntrend : words.regimeSecond };
  }
  if (state === 'no_setup') {
    const sma = formatPrice(f.SMA_fast);
    const high = formatPrice(f.swingHigh);
    return sma && high ? { glyph: 'absent', lead: words.noSetupLead, rest: '', second: words.noSetupSecond(sma, high) } : null;
  }
  if (state === 'extended') {
    const names = patternNames(words, Array.isArray(read.patternsSatisfied) ? read.patternsSatisfied : []);
    if (!names.length) return null;
    return { glyph: 'wait', lead: words.extendedLead(joinNouns(names), names.length > 1), rest: words.extendedRest, second: words.extendedSecond };
  }
  return null;
}

/**
 * The read's line (§5): { state, eyebrow, asOf, change, glyph, lead, rest, second, notes[], opensSheet, marks, shown }.
 * @param {object} body the route's answer
 * @param {{ todayEt?: string, todayIsSession?: boolean, battle?: boolean }} ctx  today's ET date and whether it is a
 *   trading session (src/utils/marketCalendar.js getSessionForDate), and whether the Battle chart shows
 */
export function readLineOf(body, { todayEt = null, todayIsSession = false, battle = false } = {}) {
  let state = readStateOf(body);
  if (!state) return null;
  const read = body.read || null;
  const base = { eyebrow: C.eyebrow, asOf: null, change: null, notes: [], marks: [], shown: [] };
  if (read && typeof read.session === 'string') base.asOf = read.behind === true ? C.asOfBehind(dayLabel(read.session)) : C.asOf(dayLabel(read.session));
  if (state === 'absent') return lineOf(state, { ...base, asOf: null, rest: C.absent });
  if (state === 'refused') return lineOf(state, { ...base, lead: C.refusedLead, rest: C.refusedRest(REFUSAL_WORDS[read.reason] ?? REFUSAL_FALLBACK) });
  if (state === 'unknown_rule_set') return lineOf(state, { ...base, rest: C.unknownRuleSet(String(ruleSetOf(read) ?? '')) });
  const words = RULE_SET_COPY[ruleSetOf(read)];
  const notes = [];
  const sessionNoteDue = todayIsSession === true && typeof todayEt === 'string' && read.session < todayEt;
  if (battle) notes.push(C.battleNote);
  else if (sessionNoteDue) notes.push(C.sessionNote(weekdayLong(read.session)));
  if (read.adjustmentMetadata === 'absent') notes.push(C.adjustmentNote);
  if (state === 'unknown') return lineOf(state, { ...base, lead: C.unknownLead, rest: C.unknownRest(unknownWhy(read, words)), notes });
  if (state === 'unshown') return lineOf(state, { ...base, rest: C.unshown });
  // Fail closed for every state that opens a sheet (review L1-2, L1-9): a record whose uptrend rows disagree with
  // its recorded chain, or one measured on another basis than the raw candles it would be drawn on, is never shown
  // in part.
  const lead = read.basis === 'raw' && uptrendRows(read) ? leadOf(state, read, words) : null;
  if (!lead) { state = 'unshown'; return lineOf(state, { ...base, rest: C.unshown }); }
  const marks = marksOf(read);
  return {
    ...base, state, ...lead,
    second: battle ? null : lead.second,
    change: changeOf(read, body.previous ?? null),
    notes, opensSheet: true, marks, shown: shownMarkNumbers(state, marks),
  };
}

// ---------------------------------------------------------------- the sheet

const RESULT = (r) => (r === true ? 'pass' : r === false ? 'fail' : 'unknown');
const price = (v) => formatPrice(v) ?? '—';
const volume = (v) => formatVolume(v) ?? '—';

/** One check row: its name, both sides with their numbers, its definition, its mark numbers (those that exist), its result. */
function row(key, spec, { lhs, rhs, lhsLabel, rhsLabel, result, marks }, exist, quiet) {
  return {
    key, name: spec.name, def: spec.def,
    sides: [[lhs, lhsLabel ?? spec.lhs], [rhs, rhsLabel ?? spec.rhs]],
    marks: marks.filter((n) => exist.has(n)),
    result: quiet ? 'quiet' : RESULT(result),
  };
}

/**
 * The sheet (§6, CR-3, SH-1 – SH-5), for a state the sheet opens in; null otherwise.
 * @param {object} body the route's answer
 * @param {{ sector?: { percentile: number, updatedAtMs: number } | null, expanded?: boolean }} ctx
 */
export function sheetOf(body, { sector = null, expanded = false } = {}) {
  const line = readLineOf(body);
  if (!line || !SHEET_STATES.includes(line.state)) return null;
  const { state } = line;
  const read = body.read;
  const words = RULE_SET_COPY[ruleSetOf(read)];
  const W = words.rows;
  const exist = new Set(line.marks.map((m) => m.n));
  const day = dayLabel(read.session);
  const f = read.facts || {};
  const up = uptrendRows(read);
  if (!up) return null;
  const count = (rows) => rows.filter((x) => x.result === 'pass').length;

  const uptrend = up.map((u) => row(u.key, W[u.key], { lhs: price(u.lhs), rhs: price(u.rhs), result: u.result, marks: u.marks }, exist, false));

  const touch = checkOf(read, 'pullback_touch') || {};
  const pclose = checkOf(read, 'pullback_close') || {};
  const ext = checkOf(read, 'extension') || {};
  const bclose = checkOf(read, 'breakout_close') || {};
  const bvol = checkOf(read, 'breakout_volume') || {};
  const patterns = read.patterns || {};
  // "The other pattern" is the one the record did not name (its valid pattern, or the stretched one; review L1-5);
  // with neither, Trend Breakout, as §6 orders it. A VALID read's other pattern reads "not present" in quiet ink
  // only when the record says it FAILED — an untestable one shows its rows' own results (review L1-3: missing is
  // never absence), a satisfied one its count.
  const named = read.pattern ?? (Array.isArray(read.patternsSatisfied) ? read.patternsSatisfied[0] : null) ?? null;
  const other = named === 'breakout' ? 'pullback_resume' : 'breakout';
  const valid = read.verdict === 'valid';
  const quietPullback = valid && other === 'pullback_resume' && patterns.pullback_resume === 'failed';
  const quietBreakout = valid && other === 'breakout' && patterns.breakout === 'failed';
  const pullbackRows = [
    row('touch', W.touch, { lhs: price(touch.lhs), rhs: price(touch.rhs), result: touch.result, marks: [4, 1] }, exist, quietPullback),
    row('pullbackClose', W.pullbackClose, { lhs: price(pclose.lhs), rhs: price(pclose.rhs), result: pclose.result, marks: [1] }, exist, quietPullback),
  ];
  const stretchRows = [row('extension', W.extension, { lhs: price(ext.lhs), rhs: price(ext.rhs), result: ext.result, marks: [7] }, exist, false)];
  const breakoutRows = [
    row('breakoutClose', W.breakoutClose, { lhs: price(bclose.lhs), rhs: price(bclose.rhs), rhsLabel: W.breakoutClose.rhs(monthDay(read.swingHigh?.date)), result: bclose.result, marks: [5] }, exist, quietBreakout),
    row('volumeFloor', W.volumeFloor, { lhs: volume(bvol.lhs), rhs: volume(bvol.rhs), rhsLabel: W.volumeFloor.rhs(volume(f.V_avg)), result: bvol.result, marks: [] }, exist, quietBreakout),
  ];

  const groups = [{ key: 'uptrend', title: words.groups.uptrend, count: C.groupCount(count(uptrend), 3), rows: uptrend }];
  // SH-3: when the uptrend fails, the pattern groups collapse to one line; a tap expands them.
  const collapsed = state === 'regime' && !expanded;
  if (collapsed) {
    groups.push({ key: 'patterns', collapsed: true, line: C.collapsed, expand: C.expand });
  } else {
    groups.push({ key: 'pullback_resume', title: words.groups.pullback_resume, sub: other === 'pullback_resume' ? C.theOtherPattern : null, count: quietPullback ? C.notPresent : C.groupCount(count(pullbackRows), 2), quiet: quietPullback, rows: pullbackRows });
    groups.push({ key: 'stretch', title: words.groups.stretch, count: null, rows: stretchRows });
    groups.push({ key: 'breakout', title: words.groups.breakout, sub: other === 'breakout' ? C.theOtherPattern : null, count: quietBreakout ? C.notPresent : C.groupCount(count(breakoutRows), 2), quiet: quietBreakout, rows: breakoutRows });
  }

  const pct = sector && isNum(sector.percentile) ? decimalString(sector.percentile, 0) : null;
  const at = sector && isNum(sector.updatedAtMs) ? etTimeLabel(sector.updatedAtMs) : null;
  const context = { title: C.contextTitle, name: C.sectorName, value: pct !== null && at ? C.sectorReading(pct, at) : C.sectorNone, def: C.sectorDef };

  const otherReading = words.other[state];
  return {
    state,
    lead: `${line.lead}${line.rest}`,
    hint: C.sheetHint(line.asOf),
    groups,
    collapsed,
    context,
    other: [{ title: C.otherReadingTitle, text: otherReading.reading }, { title: C.separatesTitle, text: otherReading.separates(weekdayShort(read.session)) }],
    foot: [words.footRuleSet, C.footBasis(day), C.footProvenance],
    marks: line.marks,
  };
}
