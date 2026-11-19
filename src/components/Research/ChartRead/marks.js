// src/components/Research/ChartRead/marks.js
//
// The Chart view's read — THE MARKS (build prompt §4, MK-1 – MK-7, CR-2; spec docs/specs/CHART_READ_SPEC_V1.md).
// One fixed table per rule set: each mark NUMBER names exactly one VALUE, the same on every stock (CR-2), and
// a plan or a receipt may cite a mark by rule set, session and id ("tf-setup-v1 · 2026-11-17 · touch_low",
// spec §12). A new rule set gets its own table; an unknown rule set draws no marks (MK-2).
//
// Every value is the record's own field, copied (MK-1: a mark exists only when its value is a finite number):
//   1 sma_fast         the 20-day                     read.facts.SMA_fast                  a tick on the record's day
//   2 sma_slow         the 50-day                     read.facts.SMA_slow                  a tick on the record's day
//   3 sma_slow_5ago    the 50-day five sessions ago   read.facts.SMA_slow_5ago             a tick five sessions earlier
//   4 touch_low        the lowest of the three lows   the pullback_touch check's lhs       a bracket under the three
//                                                     (the evaluator's own min of pullbackLows[].low, recorded) sessions, a tick at the low
//   5 swing_high       the 20-session high            read.swingHigh.value at .date        a tick at its bar
//   6 swing_low        the 20-session low             read.swingLow.value at .date         a tick at its bar
//   7 extension_limit  the stretch limit              the extension check's rhs            a tick on the record's day
//
// Pure and Node-clean: no React, no clock, no I/O.

/** The tables, by rule set (read.ruleSet.setupVersion). Frozen: a number and an id never change (MK-2). */
export const MARK_TABLES = Object.freeze({
  'tf-setup-v1': Object.freeze([
    Object.freeze({ n: 1, id: 'sma_fast', kind: 'tick' }),
    Object.freeze({ n: 2, id: 'sma_slow', kind: 'tick' }),
    Object.freeze({ n: 3, id: 'sma_slow_5ago', kind: 'tick' }),
    Object.freeze({ n: 4, id: 'touch_low', kind: 'bracket' }),
    Object.freeze({ n: 5, id: 'swing_high', kind: 'tick' }),
    Object.freeze({ n: 6, id: 'swing_low', kind: 'tick' }),
    Object.freeze({ n: 7, id: 'extension_limit', kind: 'tick' }),
  ]),
});

/** MK-3: the marks shown by default, by the read's state (chartRead.js readStateOf). With the chart compact, all that exist (PG-3). */
export const DEFAULT_MARKS = Object.freeze({
  valid_pullback: Object.freeze([1, 4, 5, 6]),
  valid_breakout: Object.freeze([1, 5]),
  regime: Object.freeze([1, 2, 3]),
  no_setup: Object.freeze([1, 4, 5]),
  extended: Object.freeze([1, 7]),
});

/** Mark 3 sits this many sessions before the record's day (SMA_slow_5ago: the 50-day as of bar 5). */
export const SLOW_5AGO_SESSIONS_BACK = 5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isDate = (v) => typeof v === 'string' && DATE_RE.test(v);
const checkOf = (read, id) => (Array.isArray(read?.checks) ? read.checks.find((c) => c && c.id === id) : undefined);

/** tf-setup-v1's value and place for each id, from the projection only. */
const TF_SETUP_V1 = Object.freeze({
  sma_fast: (r) => ({ value: r.facts?.SMA_fast, day: r.session }),
  sma_slow: (r) => ({ value: r.facts?.SMA_slow, day: r.session }),
  sma_slow_5ago: (r) => ({ value: r.facts?.SMA_slow_5ago, day: r.session, sessionsBack: SLOW_5AGO_SESSIONS_BACK }),
  touch_low: (r) => {
    const value = checkOf(r, 'pullback_touch')?.lhs;
    const lows = Array.isArray(r.pullbackLows) ? r.pullbackLows : [];
    // The bracket spans the three sessions the check read; the tick sits on the (most recent) one whose low IS the value.
    const days = lows.map((p) => p?.date);
    const low = lows.find((p) => p && p.low === value);
    return { value, day: low ? low.date : null, days: days.length === 3 && days.every(isDate) ? days : null };
  },
  swing_high: (r) => ({ value: r.swingHigh?.value, day: r.swingHigh?.date }),
  swing_low: (r) => ({ value: r.swingLow?.value, day: r.swingLow?.date }),
  extension_limit: (r) => ({ value: checkOf(r, 'extension')?.rhs, day: r.session }),
});
const VALUES = Object.freeze({ 'tf-setup-v1': TF_SETUP_V1 });

/** The rule set a read was measured under, or null. */
export const ruleSetOf = (read) => (typeof read?.ruleSet?.setupVersion === 'string' ? read.ruleSet.setupVersion : null);

/** Does this app hold a mark table for the read's rule set? */
export const hasMarkTable = (read) => Object.prototype.hasOwnProperty.call(MARK_TABLES, ruleSetOf(read) ?? '');

/**
 * Every mark that exists for one read (MK-1): [{ n, id, kind, value, day, days?, sessionsBack?, ruleSet, session }],
 * in table order. An unknown rule set, or no read, makes none (MK-2). Pure.
 */
export function marksOf(read) {
  if (!read || typeof read !== 'object' || !hasMarkTable(read)) return [];
  const ruleSet = ruleSetOf(read);
  const values = VALUES[ruleSet];
  const out = [];
  for (const m of MARK_TABLES[ruleSet]) {
    const v = values[m.id](read);
    if (!isNum(v.value) || !isDate(v.day)) continue;
    if (m.kind === 'bracket' && !v.days) continue;
    out.push({
      n: m.n, id: m.id, kind: m.kind, value: v.value, day: v.day,
      ...(v.days ? { days: [...v.days] } : {}),
      ...(v.sessionsBack ? { sessionsBack: v.sessionsBack } : {}),
      ruleSet, session: read.session,
    });
  }
  return out;
}

/** A mark's citation (spec §12): "tf-setup-v1 · 2026-11-17 · touch_low". */
export const markCitation = (mark) => `${mark.ruleSet} · ${mark.session} · ${mark.id}`;

/** MK-3: the numbers shown by default for a state; with the chart compact (PG-3), every number that exists. */
export function shownMarkNumbers(state, marks, { compact = false } = {}) {
  const exist = new Set(marks.map((m) => m.n));
  if (compact) return [...exist].sort((a, b) => a - b);
  return (DEFAULT_MARKS[state] || []).filter((n) => exist.has(n));
}
