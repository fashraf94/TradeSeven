// src/screens/filmRoomV2/filmRoomModel.js
//
// Film Room v2 (A2) — THE SCREEN'S READING OF ONE TAPE DAY. Pure: no React, no
// Firestore, no clock (an instant is handed in where one is needed). Every
// value the screen renders is read here from the tape document by its PATH,
// and every number's class is the tape's own declaration for that path
// (`numberClasses`, BA-21 / BA-42 / F2) — never a per-widget constant. A label
// and its number therefore come from one source (BUILD_RULES §9).
//
// Spec: docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md §7, §8 and
// Amendment E (docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_E_20261008.md).

import { classOfNumber, PROVENANCE_CLASSES, NON_CHECK_STATES } from '../../constants/filmTape';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v) => (typeof v === 'string' && v ? v : null);
const toMs = (v) => { if (typeof v !== 'string') return null; const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; };

// ── paths and classes ───────────────────────────────────────────────────────

/** The value at a concrete path (strings for keys, integers for indices), or undefined. */
export function valueAt(doc, path) {
  let node = doc;
  for (const seg of path) {
    if (node === null || node === undefined) return undefined;
    node = node[seg];
  }
  return node;
}

/**
 * The class the document declares for the number at `path` — one of the four,
 * or null when the declaration names none (or two). A null class is a defect
 * the screen shows as such; it never substitutes a class of its own.
 */
export function classAt(doc, path) {
  return classOfNumber(doc?.numberClasses, path);
}

/** A number the screen may render: a finite value at the path, with its declared class. */
export function numberAt(doc, path) {
  const value = valueAt(doc, path);
  if (!isNum(value)) return null;
  return { value, cls: classAt(doc, path), path };
}

export { PROVENANCE_CLASSES };

// ── the screen's own aggregates (counts of tape rows) ───────────────────────
//
// A count of the tape's own rows — how many checks a run of one state holds —
// is arithmetic on recorded values alone, so BA-21 classes it `derived`
// ("aftermath counts" are its own example). It is not a leaf of the document,
// so it has no path in `numberClasses`; this ONE declaration names each such
// count the screen renders, by what it counts, so no widget picks a class.
// Amendment E addendum R4(a): each number the screen computes is declared here
// with the class of its least-certain operand — the section counts and "n of
// m" are counts of recorded rows, so `derived`.
export const SCREEN_AGGREGATE_CLASSES = Object.freeze({
  'count(checks[] in a run)': 'derived',
  'count(slots of the derived held set)': 'derived',
  'count(actions[])': 'derived',
  'count(checks[] with a record)': 'derived',
  'count(tickSeqs in the minted range)': 'derived',
  'count(rationale[])': 'derived',
  'count(plans[] of the symbol)': 'derived',
  'ordinal(actions[] in time order)': 'derived',
  // The Deep dive's facts and its percent axis, computed from a series document's bars: market operands only.
  'change(sessionOpen.value to bars[last].c)': 'market',
  'sum(bars[].v)': 'market',
  'axis(% from the session open)': 'market',
});

/**
 * "Checks · n of m" (R4(a)). `n` is the day's check rows that carry a record —
 * every row but a deferral and a missing record (NON_CHECK_STATES, the tape's
 * own "known checks"). `m` is the minted tickSeq range passes.close records:
 * its recorded range and the gaps it attributes to this day. `m` is null when
 * the close pass records no range, or when it would be smaller than `n` — the
 * screen then says "n recorded" and never states a fraction the record does
 * not support.
 */
export function checkCounts(tape) {
  const rows = Array.isArray(tape?.checks) ? tape.checks : [];
  const n = rows.filter((r) => !NON_CHECK_STATES.includes(r?.state)).length;
  const close = tape?.passes?.close;
  const range = Array.isArray(close?.tickSeqRange) && close.tickSeqRange.length === 2 && close.tickSeqRange.every(Number.isInteger) ? close.tickSeqRange : [];
  const seqs = [...range, ...(Array.isArray(close?.gaps) ? close.gaps.filter(Number.isInteger) : [])];
  const m = seqs.length ? Math.max(...seqs) - Math.min(...seqs) + 1 : null;
  return { n, m: m !== null && m >= n ? m : null };
}

// ── time (ET wall clock; instants stay the tape's strings) ──────────────────

const ET_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
const ET_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const ET_DAY_SHORT = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/** "12:45 PM" for an instant, in ET; null for anything that is not an instant. */
export function etClock(instant) {
  const ms = toMs(instant);
  return ms === null ? null : ET_CLOCK.format(new Date(ms));
}

/** "Tue, Sep 23, 2026" / "Sep 23" for an ET trading date `YYYY-MM-DD`. */
export function etDateLabel(etDate, { short = false } = {}) {
  if (typeof etDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(etDate)) return null;
  const ms = Date.parse(`${etDate}T12:00:00.000Z`);
  return (short ? ET_DAY_SHORT : ET_DAY).format(new Date(ms));
}

// ── number formats (display only — the value is the tape's) ─────────────────

const MINUS = '−';
const trim = (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);

/** Points: signed, up to two decimals, the true minus sign. */
export function fmtPoints(v) {
  if (!isNum(v)) return '—';
  const abs = trim(Math.abs(v).toFixed(2));
  if (v > 0) return `+${abs}`;
  if (v < 0) return `${MINUS}${abs}`;
  return '0';
}

/** A price, two decimals (grouped). */
export function fmtPrice(v) {
  if (!isNum(v)) return '—';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `${MINUS}${s}` : s;
}

/** A signed price difference, two decimals. */
export function fmtPriceDelta(v) {
  if (!isNum(v)) return '—';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v > 0) return `+${s}`;
  if (v < 0) return `${MINUS}${s}`;
  return '0.00';
}

/** A plain recorded number as stored (a ratio, a percent value, a count). */
export function fmtPlain(v) {
  if (!isNum(v)) return '—';
  const s = trim(Math.abs(v).toFixed(2));
  return v < 0 ? `${MINUS}${s}` : s;
}

/** A whole count. */
export function fmtCount(v) {
  return isNum(v) ? String(Math.round(v)) : '—';
}

/** A ratio as a signed percent, two decimals ("+0.53%"), the true minus sign; the sign is the shown digits'. */
export function fmtPercent(v) {
  if (!isNum(v)) return '—';
  const r = Math.round(v * 10000) / 100;
  const s = `${Math.abs(r).toFixed(2)}%`;
  if (r > 0) return `+${s}`;
  if (r < 0) return `${MINUS}${s}`;
  return s;
}

/** Volume, compact (12.3K / 4.1M). */
export function fmtVolume(v) {
  if (!isNum(v)) return '—';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
}

/** Sign colours belong to recorded SCORES only (BA-41): these paths, when their class is `recorded`. */
const SCORE_PATHS = [
  /^score\.(lastCheck|firstCheck)\.total$/,
  /^score\.lastCheck\.opponent$/,
  /^battle\.final\.(total|opponent)$/,
  /^checks\[\]\.scores\.total$/,
  /^actions\[\]\.lockedPoints$/,
];
export function isRecordedScore(doc, path) {
  if (classAt(doc, path) !== 'recorded') return false;
  const generic = path.map((s) => (typeof s === 'number' ? '[]' : s)).join('.').replace(/\.\[\]/g, '[]');
  return SCORE_PATHS.some((re) => re.test(generic));
}

// ── checks (BA-8, BA-44; Amendment E F3, F5) ────────────────────────────────

/**
 * What a check row's state reads as. `tone` is the pip family: completed rows
 * are solid, plan rows gold, the platform's non-decisions hollow. A completed
 * check whose HOLD was not the model's (decision.holdKind 'default_failure')
 * says so from the check itself; the tape records THAT the system held by
 * default, not which failure caused it, so the screen never names one (F3).
 */
export function checkStateOf(row) {
  const s = row?.state;
  const final = row?.decision?.final ?? null;
  if (s === 'completed') {
    if (row?.decision?.holdKind === 'default_failure') return { key: 'default_hold', label: 'no usable model result · the system held by default', group: 'completed', tone: 'failed' };
    if (final === 'SWAP') return { key: 'swap', label: 'completed · SWAP', group: 'completed', tone: 'swap' };
    if (final === 'HOLD') return { key: 'hold', label: 'completed · HOLD', group: 'completed', tone: 'hold' };
    return { key: 'completed', label: 'completed · decision not recorded', group: 'completed', tone: 'hold' };
  }
  const table = {
    no_trigger: ['no trigger · no check woke', 'quiet'],
    budget_skipped: ['check skipped · budget', 'skipped'],
    deferred: ['check deferred · budget', 'skipped'],
    gameplan_created: ['plan created', 'plan'],
    gameplan_pending: ['plan pending · awaiting approval', 'planPending'],
    proposal_pending: ['proposal pending', 'planPending'],
    degraded_quotes: ['degraded quotes', 'skipped'],
    cpu_passive: ['CPU passive', 'quiet'],
    tick_error: ['tick error', 'skipped'],
    no_record: ['no record for this check', 'gap'],
  };
  const hit = table[s];
  if (hit) return { key: s, label: hit[0], group: s, tone: hit[1] };
  return { key: 'unknown', label: 'state not recorded', group: 'unknown', tone: 'gap' };
}

/** Is this row a check the battle actually ran (not a deferral or a missing record)? */
export const ranCheck = (row) => !['deferred', 'no_record'].includes(row?.state);

/**
 * F5 — the day's checks as RUNS: one entry per unbroken stretch of rows that
 * read the same group, with its time span, its rows (by index) and a count.
 * Completed checks form one group whose label lists its HOLD / SWAP / default
 * holds by kind.
 */
export function checkRuns(tape) {
  const rows = Array.isArray(tape?.checks) ? tape.checks : [];
  const runs = [];
  rows.forEach((row, index) => {
    const st = checkStateOf(row);
    const last = runs[runs.length - 1];
    if (last && last.group === st.group) {
      last.indices.push(index);
      last.to = row.at ?? last.to;
      last.kinds[st.key] = (last.kinds[st.key] || 0) + 1;
    } else {
      runs.push({ group: st.group, tone: st.tone, label: st.group === 'completed' ? 'completed' : st.label, from: row.at ?? null, to: row.at ?? null, indices: [index], kinds: { [st.key]: 1 } });
    }
  });
  return runs.map((r) => ({ ...r, count: r.indices.length }));
}

/** BA-7 / BA-44 — a check's recorded risk decisions, one line per symbol; null → "No risk decision recorded". */
export function riskLines(row) {
  const risk = row?.risk;
  if (!isObj(risk) || !Object.keys(risk).length) return null;
  return Object.keys(risk).sort().map((sym) => {
    const v = risk[sym] || {};
    const action = str(v.action) ?? 'not recorded';
    return { symbol: sym, text: action === 'HOLD' ? 'Risk decision recorded: HOLD' : `Risk decision recorded: ${action}${str(v.reason) ? ` · ${v.reason}` : ''}`, action };
  });
}

/** One summary line for a check's risk record (the strip and the rows). */
export function riskSummary(row) {
  const lines = riskLines(row);
  if (!lines) return 'No risk decision recorded';
  const fired = lines.filter((l) => l.action !== 'HOLD');
  if (!fired.length) return 'Risk decision recorded: HOLD';
  return fired.map((l) => `${l.text.replace('Risk decision recorded: ', `Risk decision recorded: ${l.symbol} `)}`).join(' · ');
}

// ── actions (BA-6, BA-11, BA-38; Amendment E F1, BA-47) ─────────────────────

/** The anchor every swap card is addressable by (BA-47): `swap-1`, `swap-2`, … for the 0-based place `i` in time order. */
export const swapAnchor = (i) => `swap-${i + 1}`;

/**
 * Each swap's place in time order, 1-based, by tape index — sequence only
 * (addendum R4(a)): the card's "Swap n" and its #swap-n anchor both read this
 * one sequence, so they never disagree (BUILD_RULES §9). The writer stores
 * actions in time order, so it is the tape's order whenever the tape is the
 * writer's; an action with no recorded instant goes after the timed ones.
 */
export function swapOrdinals(tape) {
  const actions = Array.isArray(tape?.actions) ? tape.actions : [];
  const order = actions.map((a, i) => ({ i, ms: toMs(a?.at) }))
    .sort((x, y) => (x.ms === y.ms ? 0 : x.ms === null ? 1 : y.ms === null ? -1 : x.ms - y.ms) || x.i - y.i);
  const out = new Array(actions.length);
  order.forEach((o, k) => { out[o.i] = k + 1; });
  return out;
}

/**
 * Who made the exit (BA-6), from the recorded mechanism — the line that fired
 * by name. `by` is 'agent' for the agent's own decision, 'platform' for a
 * platform rule (risk manager, rotation, guardrail), 'gameplan' for the
 * gameplan meeting (the agent's proposal with the player's approval — not a
 * platform rule), and 'unrecorded' when the tape names no mechanism: never
 * folded into another maker (review A2L1-1).
 */
export const EXIT_MAKER_WORDS = Object.freeze({
  agent: { short: 'agent', swap: 'the agent' },
  platform: { short: 'rule', swap: 'a platform rule' },
  gameplan: { short: 'meeting', swap: 'the gameplan meeting' },
  unrecorded: { short: 'not recorded', swap: 'a maker not recorded' },
});
export function exitMakerOf(action) {
  const m = action?.mechanism;
  const reason = str(action?.exitReason);
  if (m === 'agent_decision') return { by: 'agent', label: "Exit by the agent · its own decision" };
  if (m === 'platform_risk_manager' || m === 'archetype_rotation' || m === 'guardrail') {
    return { by: 'platform', label: `Exit by platform rule · ${reason ?? 'rule not recorded'}` };
  }
  if (m === 'gameplan_meeting') return { by: 'gameplan', label: `Exit by the gameplan meeting${reason ? ` · ${reason}` : ''}` };
  return { by: 'unrecorded', label: `Exit maker not recorded${reason ? ` · ${reason}` : ''}` };
}

/** The last point of a path array (the close), as a concrete path into the tape, or null. */
export function lastPointPath(tape, actionIndex, pathKey) {
  const list = valueAt(tape, ['actions', actionIndex, 'replay', pathKey]);
  if (!Array.isArray(list) || !list.length) return null;
  return ['actions', actionIndex, 'replay', pathKey, list.length - 1, 'points'];
}

// ── holdings at the day's start and end (BA-45) ─────────────────────────────

/**
 * No stored field carries the held set, so it is DERIVED from recorded values:
 * the start is the risk-verdict keys of the first check that recorded a risk
 * decision (the positions the risk pass evaluated there); each recorded swap
 * after it moves one slot (out → in). The end is that set after every swap; it
 * is checked against the last risk-recording check's keys plus the swaps made
 * at or after that check. When the two disagree, or no check recorded a risk
 * decision, the grid is not drawn and the reason is the coverage line.
 */
export function deriveHoldings(tape) {
  const checks = Array.isArray(tape?.checks) ? tape.checks : [];
  const actions = Array.isArray(tape?.actions) ? tape.actions : [];
  const withRisk = checks.map((c, i) => ({ c, i })).filter(({ c }) => isObj(c.risk) && Object.keys(c.risk).length);
  if (!withRisk.length) {
    return { status: 'unavailable', note: 'no check recorded a risk decision this day, so the held set cannot be derived', start: null, end: null, changes: [] };
  }
  const first = withRisk[0];
  const last = withRisk[withRisk.length - 1];
  const startSyms = Object.keys(first.c.risk).sort();
  const firstMs = toMs(first.c.at);
  const lastMs = toMs(last.c.at);
  const slots = startSyms.map((s) => ({ start: s, end: s, change: null }));
  const changes = [];
  let consistent = true;
  actions.forEach((a, index) => {
    const ms = toMs(a.at);
    const out = str(a.symbolOut);
    const inn = str(a.symbolIn);
    if (!out || !inn) { consistent = false; return; }
    // A swap made inside the first risk-recording check, or after it, moves a slot.
    const madeAtOrAfterFirst = (Number.isInteger(a.tickSeq) && Number.isInteger(first.c.tickSeq) && a.tickSeq >= first.c.tickSeq)
      || (ms !== null && firstMs !== null && ms >= firstMs - 60_000);
    const slot = slots.find((x) => x.end === out);
    if (slot && madeAtOrAfterFirst) {
      slot.end = inn;
      slot.change = { index, at: a.at, by: exitMakerOf(a).by, symbolOut: out, symbolIn: inn };
      changes.push(slot.change);
    } else if (!slot && slots.some((x) => x.end === inn)) {
      // Already reflected in the first check's keys (made before it).
    } else {
      consistent = false;
    }
  });
  // The last risk-recording check saw the set before the swaps made in it or after it.
  const madeInOrAfterLast = (a) => (Number.isInteger(a.tickSeq) && Number.isInteger(last.c.tickSeq) && a.tickSeq >= last.c.tickSeq)
    || (toMs(a.at) !== null && lastMs !== null && toMs(a.at) >= lastMs - 60_000);
  const lastKeys = new Set(Object.keys(last.c.risk));
  const expectAtLast = new Set(slots.map((x) => x.end));
  for (const a of actions.filter(madeInOrAfterLast)) {
    if (expectAtLast.has(a.symbolIn)) { expectAtLast.delete(a.symbolIn); expectAtLast.add(a.symbolOut); }
  }
  const agrees = expectAtLast.size === lastKeys.size && [...expectAtLast].every((s) => lastKeys.has(s));
  if (!consistent || !agrees) {
    return { status: 'unavailable', note: 'the recorded risk decisions and swaps of this day do not reconcile into one held set, so the grid is not drawn', start: null, end: null, changes: [] };
  }
  return {
    status: 'derived',
    note: 'derived from recorded values: the first and last checks\' risk decisions and the day\'s swaps',
    start: { at: first.c.at, symbols: slots.map((x) => x.start) },
    end: { at: last.c.at, symbols: slots.map((x) => x.end) },
    slots,
    changes,
  };
}

// ── directives (BA-9) ───────────────────────────────────────────────────────

/** The card's state words, from the tape's cardState. */
export function directiveCardOf(d) {
  if (d?.cardState === 'committed') return { filed: true, title: 'Directive filed', text: str(d.canonicalText) };
  if (d?.cardState === 'no_change') return { filed: false, title: 'No new directive filed', text: str(d.retainedDirectiveText) ? `Retained: ${d.retainedDirectiveText}` : 'Retained: none in force' };
  return { filed: false, title: 'No new directive filed', text: null };
}

// ── rationale timeline (BA-46) ──────────────────────────────────────────────

/**
 * The day's recorded rationale and the checks that carry no agent text (a
 * default hold, a budget skip, a deferral), in time order. A state entry is
 * the platform's record of the check — never agent words.
 */
export function rationaleTimeline(tape) {
  const rows = [];
  (Array.isArray(tape?.rationale) ? tape.rationale : []).forEach((r, index) => {
    rows.push({ kind: 'rationale', at: r.at, index });
  });
  (Array.isArray(tape?.checks) ? tape.checks : []).forEach((c, index) => {
    const st = checkStateOf(c);
    if (['default_hold', 'budget_skipped', 'deferred'].includes(st.key)) rows.push({ kind: 'state', at: c.at, index, label: st.label });
  });
  return rows.sort((a, b) => (toMs(a.at) ?? 0) - (toMs(b.at) ?? 0) || (a.kind === b.kind ? 0 : a.kind === 'state' ? -1 : 1));
}

// ── plans (BA-10) ───────────────────────────────────────────────────────────

export const PLAN_DIRECTIONS = Object.freeze({ potential_entry: 'Potential entry', potential_exit: 'Potential exit' });

/** Plans grouped by their check (one card per plan time), each with its tape index. */
export function planGroups(tape, symbol = null) {
  const plans = Array.isArray(tape?.plans) ? tape.plans : [];
  const groups = [];
  plans.forEach((p, index) => {
    if (symbol && p.symbol !== symbol) return;
    const last = groups[groups.length - 1];
    if (last && last.at === p.at) last.items.push(index);
    else groups.push({ at: p.at, items: [index] });
  });
  return groups;
}

// ── deep dive (BA-12, BA-13, BA-43) ─────────────────────────────────────────

/** The symbols the deep dive offers: held first (the day's held set), then the day's other series. */
export function deepSymbols(tape, seriesDocs, holdings) {
  const roles = new Map();
  for (const s of seriesDocs || []) if (str(s?.symbol)) roles.set(s.symbol, s.role ?? null);
  const order = [];
  const push = (s) => { if (s && !order.includes(s)) order.push(s); };
  if (holdings?.status === 'derived') { holdings.start.symbols.forEach(push); holdings.end.symbols.forEach(push); }
  for (const a of Array.isArray(tape?.actions) ? tape.actions : []) { push(a.symbolOut); push(a.symbolIn); }
  for (const [s, role] of roles) if (role !== 'market' && role !== 'sector') push(s);
  return order;
}

/** BA-43 — the evidence stamps recorded for `symbol`, one per check that carries one, with the check's index. */
export function evidenceMarkers(tape, symbol) {
  const out = [];
  (Array.isArray(tape?.checks) ? tape.checks : []).forEach((c, index) => {
    const e = isObj(c.evidence) ? c.evidence[symbol] : null;
    // BA-43: a marker sits AT evidenceAt — a stamp whose instant was not recorded gets no marker (review A2L1-8).
    if (!isObj(e) || !isNum(e.px) || toMs(c.evidenceAt) === null) return;
    out.push({ index, at: c.evidenceAt, stampedAt: c.evidenceAt });
  });
  return out;
}

/** The role a symbol had on the day, from the tape's own rows (never guessed). */
export function roleOf(tape, symbol, holdings) {
  const actions = Array.isArray(tape?.actions) ? tape.actions : [];
  const exited = actions.map((a, i) => ({ a, i })).find(({ a }) => a.symbolOut === symbol);
  const entered = actions.map((a, i) => ({ a, i })).find(({ a }) => a.symbolIn === symbol);
  // A recorded swap is stated before "held": a name bought before the first risk record is in the
  // start set too, and must never read as held all along (review A2V1-11).
  if (exited) return { kind: 'exited', text: `exited at ${etClock(exited.a.at) ?? 'an unrecorded time'} · ${exitMakerOf(exited.a).label}`, action: exited.i };
  if (entered) {
    // The tape records who made the EXIT of the swap that brought the name in, not who chose it (review A2L1-12).
    const who = exitMakerOf(entered.a);
    const by = `a swap by ${EXIT_MAKER_WORDS[who.by].swap}${who.by === 'platform' && entered.a.exitReason ? ` · ${entered.a.exitReason}` : ''}`;
    return { kind: 'entered', text: `entered at ${etClock(entered.a.at) ?? 'an unrecorded time'} · ${by}`, action: entered.i };
  }
  if (holdings?.status === 'derived' && holdings.start.symbols.includes(symbol) && holdings.end.symbols.includes(symbol)) {
    return { kind: 'held', text: 'held at the first and the last risk record', action: null };
  }
  const planned = (Array.isArray(tape?.plans) ? tape.plans : []).some((p) => p.symbol === symbol);
  if (planned) return { kind: 'planned', text: 'named in a plan', action: null };
  return { kind: 'series', text: 'price series', action: null };
}

/**
 * The Deep dive's two computed facts (addendum R4(a)), from ONE series
 * document's own bars — market operands only, so `market`. Each is null when
 * the document cannot carry it whole: no session open or last close for the
 * change; a bar without a volume for the session's volume; and neither when
 * the candle pass lists the symbol as incomplete (the last bar may not be the
 * close, and the sum would undercount).
 */
export function seriesFacts(doc, tape = null) {
  const bars = Array.isArray(doc?.bars) ? doc.bars : [];
  const incomplete = (Array.isArray(tape?.passes?.candles?.symbolsIncomplete) ? tape.passes.candles.symbolsIncomplete : [])
    .some((s) => s === doc?.symbol || s?.symbol === doc?.symbol);
  if (!bars.length || incomplete) return { change: null, volume: null };
  const open = doc?.sessionOpen?.value;
  const close = bars[bars.length - 1]?.c;
  const change = isNum(open) && open > 0 && isNum(close) ? close / open - 1 : null;
  const volume = bars.every((b) => isNum(b?.v)) ? bars.reduce((sum, b) => sum + b.v, 0) : null;
  return { change, volume };
}

/** R4(b) scaffolding: gridline steps of the % move from the session open — at most five lines across the chart's span. */
const PCT_STEPS = [0.001, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
export function pctTicks(lo, hi) {
  if (!isNum(lo) || !isNum(hi) || !(hi > lo)) return [];
  const step = PCT_STEPS.find((s) => (hi - lo) / s <= 5) ?? PCT_STEPS[PCT_STEPS.length - 1];
  const out = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k += 1) out.push(Number((k * step).toFixed(6)));
  return out;
}

/** Indices of the bars that carry the session's high and low (for axis labels at real bar values). */
export function extremeBars(bars) {
  let hi = -1;
  let lo = -1;
  (bars || []).forEach((b, i) => {
    if (isNum(b?.h) && (hi < 0 || b.h > bars[hi].h)) hi = i;
    if (isNum(b?.l) && (lo < 0 || b.l < bars[lo].l)) lo = i;
  });
  return { hi, lo };
}

export { isNum, toMs };
