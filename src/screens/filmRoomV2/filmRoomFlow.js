// src/screens/filmRoomV2/filmRoomFlow.js
//
// Film Room D1 — THE FRONT'S READING OF ONE TAPE DAY (Build D spec V1,
// docs/specs/FILM_ROOM_BUILD_D_FLOW_SPEC_V1_20261120.md §4 – §8). Pure: no
// React, no reads, no clock, Node-clean. It turns the tape day the screen
// already holds into what the front shows: the heading and the key (§4), the
// two lines with their breaks and the final point (§5), the low mark (§5), the
// pins — their kinds, the choice of five and the count of the rest (§6) —, the
// merge of pins that would overlap (§6, groupPins), each pin's panel as PATHS
// into the tape and COPY KEYS (§7), and the counts (§8).
//
// Every number the front states is read through the model's bound-number
// helper (numberAt: the value at its path, with the class the tape declares
// there), or is a derived aggregate declared in SCREEN_AGGREGATE_CLASSES
// (FL-12: the front shows no number-kind mark, but every number keeps its
// class). Nothing here composes a sentence, and nothing holds anyone's words:
// a quotation is a path, a word is a copy key (filmRoomCopy.js FILM_ROOM_COPY.flow).

import { numberAt, exitMakerOf, directiveCardOf, sessionOf, etClock, etWhen, etDateLabel, fmtPoints, swapOrdinals, swapAnchor, SCREEN_AGGREGATE_CLASSES } from './filmRoomModel';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const toMs = (v) => { if (typeof v !== 'string') return null; const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; };
const listOf = (tape, key) => (Array.isArray(tape?.[key]) ? tape[key] : []);

/** The touch area of a pin, and the merge distance (§6): 44 px. */
export const FLOW_PIN_TOUCH = 44;
/** The most pins the chart shows (FL-5). */
export const FLOW_PIN_LIMIT = 5;

/**
 * The aggregates the front states, by name — each DECLARED in SCREEN_AGGREGATE_CLASSES (filmRoomModel.js), so a
 * number and its class come from one declaration (FL-12, BUILD_RULES §9).
 */
export const FLOW_AGGREGATES = Object.freeze({
  margin: 'difference(the two displayed final scores)',
  ordinal: 'ordinal(pins in time order)',
  more: 'count(tape rows beyond the chosen pins)',
  agentSwaps: 'count(actions[] by the agent)',
  swaps: 'count(actions[])',
  filed: 'count(directives[] filed)',
  directives: 'count(directives[])',
  moments: 'count(moments on the tape day)',
});

/** One aggregate number: its value, its declared class, the name it is declared by. */
const agg = (key, value) => ({ value, aggregate: FLOW_AGGREGATES[key], cls: SCREEN_AGGREGATE_CLASSES[FLOW_AGGREGATES[key]] ?? null });

// ── the day ─────────────────────────────────────────────────────────────────

/**
 * A completed battle's final day, decided exactly as the tape view's result card decides it (FilmRoomGlance.jsx
 * ResultCard: the tape's own `battle.status` is `completed`), so the heading and the tape's result never disagree.
 */
export const isFinalDayOf = (tape) => isObj(tape?.battle) && tape.battle.status === 'completed';

/** The CPU condition (§4.2, FL-3): the tape's own basis is the CPU's portfolio. The value is checked where it is read. */
const cpuBasisOf = (tape) => tape?.score?.opponentBasis === 'cpu_portfolio';

/** A displayed points value, back to integer hundredths: "−47" → -4700, "+12.5" → 1250 (fmtPoints's own string). */
export function hundredthsOfShown(text) {
  if (typeof text !== 'string' || !/^[+−]?\d+(\.\d{1,2})?$/.test(text)) return null;
  const neg = text.startsWith('−');
  const [whole, frac = ''] = text.replace(/^[+−]/, '').split('.');
  const h = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return neg ? -h : h;
}

/** An unsigned amount of hundredths as the front shows the margin: "46", "4.99", "0.5". */
export function fmtMargin(hundredths) {
  const s = (Math.abs(hundredths) / 100).toFixed(2);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/**
 * {n} of "Won by {n}" (§4.1, BUILD_RULES §9): the difference of the two final scores AS THE KEY DISPLAYS THEM —
 * the two fmtPoints strings, read back to hundredths — never the raw values' difference. Unsigned.
 */
export function marginOf(total, opponent) {
  const a = hundredthsOfShown(fmtPoints(total));
  const b = hundredthsOfShown(fmtPoints(opponent));
  if (a === null || b === null) return null;
  return Math.abs(a - b);
}

/**
 * The heading (§4.1): on a completed battle's final day, the recorded result with both final scores recorded —
 * 'won' / 'lost' with the margin, 'draw' —, else 'final' with the final total (null when the tape records none);
 * on any other day, 'date' with the day's date (etDateLabel).
 */
export function headingOf(tape) {
  if (!isFinalDayOf(tape)) return { kind: 'date', date: etDateLabel(tape?.etDate) };
  const total = numberAt(tape, ['battle', 'final', 'total']);
  const opponent = numberAt(tape, ['battle', 'final', 'opponent']);
  const result = tape.battle.result?.value;
  if (total && opponent && (result === 'win' || result === 'loss')) {
    const h = marginOf(total.value, opponent.value);
    if (h !== null) return { kind: result === 'win' ? 'won' : 'lost', margin: { ...agg('margin', h / 100), text: fmtMargin(h) } };
  }
  if (total && opponent && result === 'draw') return { kind: 'draw' };
  return { kind: 'final', total };
}

/**
 * The key (§4.2): "You {total}", then "CPU {opponent}" only under the CPU condition with a number to show. On a
 * completed battle's final day the values are `battle.final`'s; on any other day the last check's, as the tape
 * records it (`score.lastCheck` — the value the tape view's Glance shows). Each is a bound number or null.
 */
export function keyOf(tape) {
  const at = isFinalDayOf(tape) ? ['battle', 'final'] : ['score', 'lastCheck'];
  const you = numberAt(tape, [...at, 'total']);
  const cpu = cpuBasisOf(tape) ? numberAt(tape, [...at, 'opponent']) : null;
  return { you, cpu };
}

// ── the lines (§5, FL-7) ────────────────────────────────────────────────────

/**
 * The day's check rows that can be placed on the time axis, in time order — order-proof: by instant, then
 * tickSeq, then the value, never the rows' place in the array. A row with no instant cannot be placed, so it
 * neither draws nor breaks. `v` is the row's numeric value at `field`, or null — and a null breaks the line.
 */
function placedRows(tape, field) {
  const rows = [];
  listOf(tape, 'checks').forEach((c, i) => {
    const t = toMs(c?.at);
    if (t === null) return;
    const n = numberAt(tape, ['checks', i, 'scores', field]);
    rows.push({ i, t, v: n ? n.value : null, seq: Number.isInteger(c?.tickSeq) ? c.tickSeq : null });
  });
  const key = (r) => [r.t, r.seq ?? Infinity, r.v ?? Infinity];
  return rows.sort((a, b) => { const x = key(a); const y = key(b); for (let k = 0; k < x.length; k += 1) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1; return 0; });
}

/** Runs of points `{ t, v, i }`, split wherever a placed check has no score: nothing is joined across it (FL-7). */
function runsOf(rows) {
  const runs = [];
  let run = null;
  for (const r of rows) {
    if (r.v === null) { run = null; continue; }
    if (!run) { run = []; runs.push(run); }
    run.push({ t: r.t, v: r.v, i: r.i });
  }
  return runs;
}

/** The time axis (§5): the day's session from the calendar, early closes included; else the first check to the last. */
export function domainOf(tape) {
  const session = sessionOf(tape?.etDate);
  if (session) return { startMs: session.openMs, endMs: session.closeMs, session: true };
  const ts = listOf(tape, 'checks').map((c) => toMs(c?.at)).filter((t) => t !== null);
  if (!ts.length) return null;
  const startMs = Math.min(...ts);
  const last = Math.max(...ts);
  return { startMs, endMs: last > startMs ? last : startMs + 60_000, session: false };
}

/** The axis's three labels (§5): the open, the midpoint and the close, as clocks. */
export function axisLabelsOf(domain) {
  if (!domain) return [];
  const iso = (ms) => new Date(ms).toISOString();
  return [domain.startMs, (domain.startMs + domain.endMs) / 2, domain.endMs].map((ms) => etClock(iso(Math.round(ms))));
}

/**
 * The two lines (§5). The player's from `checks[].scores.total`, the opponent's from `checks[].scores.opponent` —
 * the latter only under the key's CPU condition (FL-3). On a completed battle's final day each line's last point
 * is `battle.final`'s value at the axis's end — joined to the last run only when the last placed check holds a
 * score (a check with no score still breaks it) — so the lines end at the values the key shows.
 */
export function linesOf(tape, domain = domainOf(tape)) {
  const key = keyOf(tape);
  const final = isFinalDayOf(tape);
  const lineOf = (field, finalNum) => {
    const rows = placedRows(tape, field);
    const runs = runsOf(rows);
    if (final && finalNum && domain) {
      const end = { t: domain.endMs, v: finalNum.value, i: null, final: true };
      const last = rows[rows.length - 1];
      if (last && last.v !== null && runs.length) runs[runs.length - 1].push(end);
      else runs.push([end]);
    }
    return { runs, points: runs.flat() };
  };
  return {
    you: lineOf('total', key.you),
    cpu: key.cpu ? lineOf('opponent', key.cpu) : null,
  };
}

/**
 * The low mark (§5, FL-6): the player's lowest SCORED CHECK — the earliest wins a tie — with its value bound by
 * its path and its clock. `eligible` holds the day's rule: at least three scored checks, and the low is not the
 * line's last point. Whether it is drawn also depends on the chart (layoutOf: a label over a pin's touch area or
 * outside the chart is left out).
 */
export function lowOf(tape, lines = linesOf(tape)) {
  const rows = placedRows(tape, 'total').filter((r) => r.v !== null);
  if (!rows.length) return null;
  let low = rows[0];
  for (const r of rows) if (r.v < low.v) low = r;   // rows are in time order: a later tie never replaces the earliest
  const points = lines.you.points;
  const last = points[points.length - 1];
  const isLast = Boolean(last && last.i === low.i && !last.final);
  return { index: low.i, t: low.t, value: numberAt(tape, ['checks', low.i, 'scores', 'total']), clock: etClock(tape.checks[low.i].at), eligible: rows.length >= 3 && !isLast };
}

/** The player's line's height at an instant (§6): between the neighbouring points; outside the line, the nearest. */
export function heightAt(points, t) {
  if (!points.length) return 0;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  if (t <= sorted[0].t) return sorted[0].v;
  for (let k = 0; k < sorted.length - 1; k += 1) {
    const a = sorted[k]; const b = sorted[k + 1];
    if (t >= a.t && t <= b.t) return b.t === a.t ? a.v : a.v + (b.v - a.v) * ((t - a.t) / (b.t - a.t));
  }
  return sorted[sorted.length - 1].v;
}

// ── the pins (§6, FL-4, FL-5, FL-8) ─────────────────────────────────────────

/** The pin kinds, in priority order (FL-5): the agent's own swaps, then the directives, then every other swap. */
export const PIN_KINDS = Object.freeze(['agent', 'directive', 'other']);
const RANK = Object.freeze({ agent: 0, directive: 1, other: 2 });

/** The maker's copy key from the recorded mechanism ONLY (§7): anything else is "Maker not recorded". */
export const MAKER_KEYS = Object.freeze({
  agent_decision: 'agent',
  archetype_rotation: 'stall',
  platform_risk_manager: 'risk',
  guardrail: 'guardrail',
  gameplan_meeting: 'meeting',
});
export const makerKeyOf = (action) => (typeof action?.mechanism === 'string' && Object.prototype.hasOwnProperty.call(MAKER_KEYS, action.mechanism) ? MAKER_KEYS[action.mechanism] : 'unrecorded');

/** A content key that orders two pins at one instant without their place in the array (F-PINS: any order of the rows). */
const contentKey = (row) => JSON.stringify(isObj(row) ? Object.keys(row).sort().map((k) => [k, row[k]]) : row);

/**
 * Every pin the day holds (§6): each `actions[]` row a swap pin at its `at` — the agent's own (exitMakerOf's `agent`)
 * or another maker's —, each `directives[]` row a directive pin at its `filedAt`. A row with no instant cannot be
 * placed: it is a pin of the day, never chosen for the chart, and counted with the rest ("n more on the full tape").
 */
export function allPinsOf(tape) {
  const pins = [];
  listOf(tape, 'actions').forEach((a, index) => pins.push({ src: 'action', index, kind: exitMakerOf(a).by === 'agent' ? 'agent' : 'other', t: toMs(a?.at), order: contentKey(a) }));
  listOf(tape, 'directives').forEach((d, index) => pins.push({ src: 'directive', index, kind: 'directive', t: toMs(d?.filedAt), order: contentKey(d) }));
  return pins;
}

const byTime = (a, b) => (a.t - b.t) || (RANK[a.kind] - RANK[b.kind]) || (a.order < b.order ? -1 : a.order > b.order ? 1 : 0);
const byPriority = (a, b) => (RANK[a.kind] - RANK[b.kind]) || byTime(a, b);

/**
 * The chosen pins (FL-5): at most five, chosen by priority — the agent's swaps, then the directives, then the other
 * swaps, each group in time order — then shown and NUMBERED in time order. `more` is every other row of the day:
 * the rows past the five and any row with no instant. `frac` is each pin's place on the time axis (0 the open,
 * 1 the close; an instant outside the session sits at its edge), `v` its height on the player's line.
 */
export function choosePins(tape, { domain = domainOf(tape), lines = linesOf(tape, domain) } = {}) {
  const all = allPinsOf(tape);
  const placeable = all.filter((p) => p.t !== null);
  const chosen = [...placeable].sort(byPriority).slice(0, FLOW_PIN_LIMIT).sort(byTime);
  const span = domain ? domain.endMs - domain.startMs : 0;
  const pins = chosen.map((p, k) => ({
    ...p,
    n: k + 1,
    ordinal: agg('ordinal', k + 1),
    frac: domain && span > 0 ? Math.min(1, Math.max(0, (p.t - domain.startMs) / span)) : 0,
    v: heightAt(lines.you.points, p.t),
  }));
  return { pins, more: agg('more', all.length - pins.length) };
}

/**
 * THE MERGE (§6, FL-4) — a pure function of the pins (in time order, each with `frac`) and the chart's rendered
 * width. Walking in time order, a pin joins the current group when its centre is closer than 44 px to the GROUP'S
 * FIRST pin; otherwise it starts a new group. A group is drawn at its first member's place, takes the shape of its
 * highest-priority member, and is labelled with its lowest number ("+" when it holds more than one).
 */
export function groupPins(pins, width) {
  const w = isNum(width) && width > 0 ? width : 0;
  const groups = [];
  for (const p of pins) {
    const x = p.frac * w;
    const g = groups[groups.length - 1];
    if (g && Math.abs(x - g.x) < FLOW_PIN_TOUCH) g.members.push(p);
    else groups.push({ x, members: [p] });
  }
  return groups.map((g) => ({
    x: g.x,
    first: g.members[0],
    members: g.members,
    kind: [...g.members].sort((a, b) => RANK[a.kind] - RANK[b.kind])[0].kind,
    n: g.members[0].n,
    merged: g.members.length > 1,
  }));
}

/** The pin selected on opening (§6): the agent's first swap, else the first pin; null with no pins. */
export function openingPin(pins) {
  return pins.find((p) => p.kind === 'agent') ?? pins[0] ?? null;
}

/** The kinds on the chart, in the legend's order (§4.4): a kind with no pin is not listed. */
export const legendOf = (pins) => PIN_KINDS.filter((k) => pins.some((p) => p.kind === k));

// ── the panel (§7) ──────────────────────────────────────────────────────────

/**
 * One pin's panel, as paths into the tape and copy keys — never a sentence. A swap: its maker's key from the
 * mechanism, the two symbols' paths (null where the tape holds none: "not recorded"), its clock, its exit price
 * (a bound number, or null when the tape records none), and where its link opens: the swap's card on the tape
 * (`swap-n`, by its place in time order — swapOrdinals, never its index). A directive: filed or not
 * (directiveCardOf), its clock, the player's words and the agent's reply as PATHS — the reply left out when
 * `agentReplyDiffers` is true —, and its link: the tape's directives.
 */
export function panelOf(tape, pin) {
  if (!pin) return null;
  if (pin.src === 'action') {
    const a = tape.actions[pin.index];
    const sym = (k) => (typeof a?.[k] === 'string' && a[k] ? ['actions', pin.index, k] : null);
    const ordinal = swapOrdinals(tape)[pin.index];
    return {
      kind: pin.kind,
      src: 'action',
      maker: makerKeyOf(a),
      out: sym('symbolOut'),
      in: sym('symbolIn'),
      clock: etWhen(a.at, tape.etDate),
      price: numberAt(tape, ['actions', pin.index, 'exitPrice']),
      link: { anchor: swapAnchor(ordinal - 1) },
    };
  }
  const d = tape.directives[pin.index];
  const words = (k) => (typeof d?.[k] === 'string' && d[k] ? { path: ['directives', pin.index, k], at: ['directives', pin.index, 'filedAt'] } : null);
  return {
    kind: 'directive',
    src: 'directive',
    filed: directiveCardOf(d).filed,
    clock: etWhen(d.filedAt, tape.etDate),
    player: words('playerText'),
    reply: d?.agentReplyDiffers === true ? null : words('agentReply'),
    link: { anchor: 'directives' },
  };
}

/** §7: one quiet line under the panel when the actions' or the directives' coverage is not complete. */
export const incompleteOf = (tape) => ['actions', 'directives'].some((s) => tape?.coverage?.[s]?.status !== 'complete');

// ── the counts (§8, FL-9, FL-10) ────────────────────────────────────────────

/**
 * The counts (§8): Trading — x of y swaps the agent's own call — when the day has a swap and the actions' coverage
 * is complete; Working with you — x of y directives filed (`cardState` committed; never "acted on", FL-10) — when
 * the day has a directive and the directives' coverage is complete. Each number a declared derived aggregate. The
 * heading is "This game" for a one-day battle and "This day" for a day of a longer one; no tile, no heading.
 */
export function countsOf(tape, { oneDay = true } = {}) {
  const tiles = [];
  const actions = listOf(tape, 'actions');
  const directives = listOf(tape, 'directives');
  if (actions.length && tape?.coverage?.actions?.status === 'complete') {
    tiles.push({ job: 'trading', x: agg('agentSwaps', actions.filter((a) => exitMakerOf(a).by === 'agent').length), y: agg('swaps', actions.length), caption: 'ownCall' });
  }
  if (directives.length && tape?.coverage?.directives?.status === 'complete') {
    tiles.push({ job: 'withYou', x: agg('filed', directives.filter((d) => d?.cardState === 'committed').length), y: agg('directives', directives.length), caption: 'filed' });
  }
  return { heading: tiles.length ? (oneDay ? 'thisGame' : 'thisDay') : null, tiles };
}

/** The cards line's count (§9): the day's moments — counted by the caller from momentsOfTape, a declared aggregate. */
export const momentsCountOf = (n) => agg('moments', n);

// ── the whole front ─────────────────────────────────────────────────────────

/** Everything the front shows for one tape day, before the chart's width is known (layoutOf places it). */
export function flowOf(tape, { oneDay = true } = {}) {
  const domain = domainOf(tape);
  const lines = linesOf(tape, domain);
  const { pins, more } = choosePins(tape, { domain, lines });
  return {
    final: isFinalDayOf(tape),
    heading: headingOf(tape),
    key: keyOf(tape),
    domain,
    axis: axisLabelsOf(domain),
    lines,
    low: lowOf(tape, lines),
    pins,
    more,
    legend: legendOf(pins),
    selected: openingPin(pins),
    incomplete: incompleteOf(tape),
    counts: countsOf(tape, { oneDay }),
  };
}

// ── the chart's geometry, at a width (pure; the component draws it) ────────

/** The chart's padding: room above the lines, and room under them for the low mark's label. */
export const FLOW_CHART_PAD = Object.freeze({ top: 16, bottom: 26 });
/** The low label's box: its height, a gap under the tick, and an estimate of its width per character. */
export const LOW_LABEL = Object.freeze({ height: 14, gap: 6, charWidth: 6.4, size: 11 });

const NICE = [1, 2, 2.5, 5, 10];
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  return (NICE.find((m) => m * p >= raw) ?? 10) * p;
}

/**
 * The chart at a width and a height: the value range (both lines and zero, padded), the x and y scales, the zero
 * line and at most two faint guides, each group of pins at its place, and the low mark — drawn only when the day's
 * rule holds AND its label neither overlaps a pin's touch area nor leaves the chart (§5).
 */
export function layoutOf(flow, width, height, lowText = '') {
  const w = isNum(width) && width > 0 ? width : 0;
  const values = [0, ...flow.lines.you.points.map((p) => p.v), ...(flow.lines.cpu ? flow.lines.cpu.points.map((p) => p.v) : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const top = hi + span * 0.08;
  const bottom = lo - span * 0.08;
  const ih = height - FLOW_CHART_PAD.top - FLOW_CHART_PAD.bottom;
  const d = flow.domain;
  const x = (t) => (d ? ((t - d.startMs) / (d.endMs - d.startMs)) * w : 0);
  const y = (v) => FLOW_CHART_PAD.top + ((top - v) / (top - bottom)) * ih;
  const step = niceStep(span / 3);
  const guides = [];
  for (let k = Math.floor(lo / step); k * step <= hi; k += 1) { const g = k * step; if (g !== 0 && g >= lo && g <= hi) guides.push(g); }
  const shownGuides = guides.sort((a, b) => Math.abs(b) - Math.abs(a)).slice(0, 2).sort((a, b) => b - a);
  const groups = groupPins(flow.pins, w).map((g) => ({ ...g, y: y(g.first.v) }));
  const touch = groups.map((g) => ({ left: g.x - FLOW_PIN_TOUCH / 2, right: g.x + FLOW_PIN_TOUCH / 2, top: g.y - FLOW_PIN_TOUCH / 2, bottom: g.y + FLOW_PIN_TOUCH / 2 }));
  let low = null;
  if (flow.low && flow.low.eligible && flow.low.value) {
    const lx = x(flow.low.t);
    const ly = y(flow.low.value.value);
    const lw = Math.max(1, String(lowText).length) * LOW_LABEL.charWidth;
    const box = { left: lx - lw / 2, right: lx + lw / 2, top: ly + LOW_LABEL.gap, bottom: ly + LOW_LABEL.gap + LOW_LABEL.height };
    const leaves = box.left < 0 || box.right > w || box.top < 0 || box.bottom > height;
    const overlaps = touch.some((t) => box.left < t.right && box.right > t.left && box.top < t.bottom && box.bottom > t.top);
    low = { x: lx, y: ly, box, leaves, overlaps, shown: !leaves && !overlaps };
  }
  return { width: w, height, x, y, zeroY: y(0), guides: shownGuides, groups, low };
}
