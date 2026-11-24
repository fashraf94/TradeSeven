// api/_utils/practiceField/bookView.js
//
// Practice Field build B3 — THE IDEA BOOK SCREEN'S VIEW (rulings B3-1 to B3-7; design of record
// docs/design/practice-field/IDEA_BOOK_ROUND_2.html). One pure function turns the owner's stored records into the finished,
// read-only view the screen draws: every figure, label and plain-words reason as a display string. THE CLIENT DOES NO
// MONEY ARITHMETIC (B3-1): it draws these strings, picks a colour from `dir`, and picks `short` over `text` at 320 px.
//
// IT NEVER RECOMPUTES A FIGURE THE LEDGER ALREADY HOLDS. Stored, and shown as stored:
//   the book's value, its treasury and reserved cash      dailyRows/{session}: markedEquity, treasuryCash, reservedCash
//   the book's opening value                              mandates/{bookId}.portfolio.initialValue
//   each idea's gap to its comparison and to SPY           ideas/{id}/rows/{session}: markedGapUsd / Pct, markedGapToSpyUsd
//   each name's mark, shares at the close, its basis      the row's marks and quantities; the holding's costBasisTotal, avgCost
//   each line's level                                      the idea's lines[].level (split-adjusted by the close)
//   a finished idea's five columns and its gap            the result packet's `result` (B3-3), checked first (B2 §8)
// DERIVED here, each said where it is made and tested against the rows (bookView.test.js):
//   today's change        the book's markedEquity at the last close less at the close before it, in whole cents; its
//                         percent of the earlier one (deriveToday)
//   since open            markedEquity less portfolio.initialValue, as a percent of initialValue (deriveSinceOpen)
//   SPY since open        SPY's close mark at the book's first entry session to its mark at the last close, both read
//                         from the book's own idea rows (B3-6; never a shared snapshot, which is deleted after 120 days)
//   a position's value    each name's shares × mark at the close, by the engine's own markBook, whole cents allotted so
//                         the names of an idea sum EXACTLY to its row's markedHoldingsValue (BUILD_RULES §9; allotCents)
//   open P/L              that position value less the holding's costBasisTotal
//   day P/L               that position value less the same name's at the close before (the same allotment on that
//                         row); a name bought at this session's window: less its costBasisTotal
//   distance to the line  (mark − level) / mark, in percent, one decimal; "near" under 1% (the mock-up's rule)
//   day n of N            N is the slot's length; sessions left is the agent's own count (agentRun.js sessionsLeft: the
//                         sessions after the last close up to the due one); n = N − sessions left
//   the strip             the close row's agent block (what each desk held, exited, admitted and passed on) and, as
//                         code's facts, the ideas' own entries and line sales dated that session (deriveStrip)
// A ROW BELOW FULL QUALITY NEVER SHOWS A P/L: a name whose close mark is not the vendor's own timed close reads
// "Waiting on data", with one plain reason (bookViewCopy.js QUALITY_REASONS); an idea row below full quality shows no gap.
//
// EVERY TEXT FROM AN AGENT OR A PLAYER (notes, reasons, theses) is passed through as plain text, with its desk and date.
// No id leaves this function: groups are keyed by slot, names by symbol, desks by desk, History rows by position.

import { toCents } from './money.js';
import { markBook } from '../mandateValuation.js';
import { slotSessions, nextSessionDate } from './windows.js';
import { deskOfIdea, deskOfSlot, AGENT_NOTE_SOURCE } from './agentConfig.js';
import { MARK_QUALITY, IDEA_STATUS } from './constants.js';
import { verifyPacket, resultPacketPartProblems } from './evidence.js';
import { PRACTICE_FIELD_SLOT_NAMES } from '../../../src/data/practiceFieldSlots.js';
import { PRACTICE_FIELD_BENCHMARK_SYMBOL } from '../../../src/data/practiceFieldFunds.js';
import {
  FAILED_CHECK, BUYS_NEXT_WINDOW, SELLS_NEXT_WINDOW, PAPER_MONEY, PAUSED_LINE, WINDING_DOWN_LINE, SLOT_NAMES, DESK_COPY,
  SOURCE_CHIPS, SOURCE_CHIP_UNKNOWN, COMPARISON_NAMES, NAME_SENTENCES, GROUP_LINES, SELLING_WORDS, OPEN_SLOT, STRIP,
  MARKS_AS_OF, MARKS_AS_OF_UNOBSERVED, DRAFT_OUTCOMES, REFUSAL_REASONS, REFUSAL_UNMAPPED, QUALITY_REASONS, QUALITY_REASON_UNKNOWN,
  ROW_REASON_HELD, ROW_REASON_UNKNOWN, ENDED_WORDS, ENDED_UNKNOWN, UNMEASURABLE_REASONS, UNMEASURABLE_STANDING, UNMEASURABLE_UNKNOWN,
  EVIDENCE_UNCHECKED, NOT_MEASURABLE, RESULT_COLUMNS, RESULT_VALUE_UNKNOWN, NO_FINISHED_IDEAS,
} from './bookViewCopy.js';

/** The view's own version: the client refuses a shape it does not know. */
export const BOOK_VIEW_VERSION = 1;
/** History shows at most this many finished ideas, newest first. */
export const HISTORY_LIMIT = 20;
/** A name this close to its line (percent of its mark) is drawn near it: weight, never red (the mock-up's rule). */
export const NEAR_LINE_PCT = 1;
/** The line track's full width, in percent away from the line (the mock-up's LineGauge). */
const GAUGE_FULL_PCT = 20;
/** Amounts at least this large (whole cents) also come without cents, for the 320 px table (the mock-up's fit rule). */
export const NO_CENTS_FROM_CENTS = 1_000_000;
/** The desks in the strip's and the Desks tab's order (the mock-up draws the archetype desk first). */
const DESK_ORDER = Object.freeze(['archetype', 'shadow']);
const MINUS = '−';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const upper = (s) => String(s || '').trim().toUpperCase();

// ── FORMATTING (display only: every figure below is already whole cents, a stored price or a stored percent) ──────────

const USD = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD_WHOLE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PRICE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const SHARES = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '2026-11-27' → '27 Nov'. */
export function dayLabel(date) {
  if (!isDate(date)) return null;
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
/** '2026-11-27' → 'Fri 27 Nov' (the calendar date's own weekday; no clock). */
export function weekdayLabel(date) {
  if (!isDate(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]} ${dayLabel(date)}`;
}
/** −1, 0 or 1. */
const dirOf = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const signOf = (n) => (n > 0 ? '+' : n < 0 ? MINUS : '');

/** Whole cents as dollars: '$100,412.18', or signed '+$22.55' / '−$381.70' / '$0.00'. */
export function moneyText(cents, { signed = false } = {}) {
  const sign = signed ? signOf(cents) : (cents < 0 ? MINUS : '');
  return `${sign}$${USD.format(Math.abs(cents) / 100)}`;
}
/** A signed amount for the table: its text, its text without cents when it is $10,000 or more, and its direction. */
export function signedAmount(cents) {
  const text = moneyText(cents, { signed: true });
  const short = Math.abs(cents) >= NO_CENTS_FROM_CENTS ? `${signOf(cents)}$${USD_WHOLE.format(Math.abs(cents) / 100)}` : text;
  return { text, short, dir: dirOf(cents) };
}
/** A signed percent, two places: '+0.34%', '−0.11%', '0.00%'. */
export function pctText(pct, digits = 2) {
  const f = digits === 1 ? PCT1 : PCT2;
  const body = f.format(Math.abs(pct));
  const zero = Number(body) === 0;
  return `${zero ? '' : signOf(pct)}${body}%`;
}
const priceText = (p) => (Number.isFinite(p) ? PRICE.format(p) : null);

// ── SESSIONS ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The agent's own count (agentRun.js sessionsLeft): the sessions after `session` up to and including `due`. */
export function sessionsLeftOf(session, due) {
  if (!isDate(session) || !isDate(due)) return null;
  let n = 0;
  for (let s = session; s !== null && s < due && n < 400; s = nextSessionDate(s)) n += 1;
  return n;
}

// ── MONEY: allotting a row's holdings value to its names (BUILD_RULES §9) ──────────────────────────────────────────────

/**
 * Each name's value at a row's marks, in whole cents, summing EXACTLY to the row's markedHoldingsValue. Each name's raw
 * value is the engine's own (markBook: shares × mark); the row's total was rounded once over their sum, so the names are
 * floored to cents and the cents left over go, one each, to the largest remainders (ties by symbol). Pure.
 * @returns {Map<string, number>} symbol → cents
 */
export function allotCents(row) {
  const out = new Map();
  if (!isPlain(row) || !isPlain(row.marks) || !isPlain(row.quantities)) return out;
  const parts = [];
  for (const [sym, q] of Object.entries(row.quantities)) {
    const mark = row.marks[sym]?.mark;
    if (!(Number(q) > 0) || !Number.isFinite(mark)) continue;
    const raw = markBook({ [sym]: { shares: q, lastMark: mark } }, 0, null).marked[upper(sym)]?.marketValue ?? 0;
    const rawCents = raw * 100;
    const floorCents = Math.trunc(rawCents);
    parts.push({ sym, floorCents, rem: rawCents - floorCents });
  }
  const target = toCents(row.markedHoldingsValue ?? 0);
  let left = target - parts.reduce((n, p) => n + p.floorCents, 0);
  parts.sort((a, b) => (b.rem - a.rem) || (a.sym < b.sym ? -1 : a.sym > b.sym ? 1 : 0));
  for (const p of parts) {
    const extra = left > 0 ? 1 : left < 0 ? -1 : 0;
    out.set(p.sym, p.floorCents + extra);
    left -= extra;
  }
  return out;
}

// ── THE BOOK LINE ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Today's change: the last close's equity less the close before it, in cents, and its percent of the earlier one. */
export function deriveToday(last, prev) {
  if (!isPlain(last) || !isPlain(prev)) return null;
  if (last.fullQuality !== true || prev.fullQuality !== true) return { waiting: NAME_SENTENCES.waiting };
  const lastCents = toCents(last.markedEquity);
  const prevCents = toCents(prev.markedEquity);
  const diff = lastCents - prevCents;
  return { ...signedAmount(diff), pct: prevCents > 0 ? pctText((diff * 100) / prevCents) : null };
}

/** Since open: the last close's equity less the book's opening value, as a percent of it. */
export function deriveSinceOpen(last, initialValue) {
  if (!isPlain(last) || !(Number(initialValue) > 0)) return null;
  const initCents = toCents(initialValue);
  const diff = toCents(last.markedEquity) - initCents;
  return { pct: pctText((diff * 100) / initCents), dir: dirOf(diff) };
}

// ── THE NAMES ────────────────────────────────────────────────────────────────────────────────────────────────────────

function qualityReason(sym, quality, date) {
  const f = QUALITY_REASONS[quality];
  return f ? f(sym, dayLabel(date)) : QUALITY_REASON_UNKNOWN(sym, dayLabel(date));
}

/** Why an idea's row is below full quality: the first mark not the vendor's own, else the held action, else plainly. */
function rowReason(row, date) {
  if (row?.observed === false) return QUALITY_REASONS.unobserved(null, dayLabel(date));
  for (const field of ['marks', 'comparisonMarks', 'spyMarks']) {
    for (const [sym, m] of Object.entries(row?.[field] || {})) {
      if (m?.quality !== MARK_QUALITY.VENDOR_TIME) return qualityReason(sym, m?.quality, date);
    }
  }
  if ((row?.standingQualityReasons || []).length > 0) return ROW_REASON_HELD;
  return row?.fullQuality === false ? ROW_REASON_HELD : ROW_REASON_UNKNOWN(dayLabel(date));
}

/** The sale that took a name out of an idea (its own ledger's receipts), newest first. */
function saleOf(idea, sym) {
  const receipts = (idea?.ledger?.saleReceipts || []).filter((r) => upper(r?.symbol) === sym);
  return receipts.length > 0 ? receipts[receipts.length - 1] : null;
}
function soldSentence(idea, sym) {
  const sale = saleOf(idea, sym);
  if (sale) {
    const date = dayLabel(sale.sessionDate) ?? '';
    if (sale.kind === 'line_exit') return { state: 'sold_line', text: NAME_SENTENCES.soldAtLine(date) };
    if (sale.kind === 'settlement') return { state: 'sold', text: NAME_SENTENCES.soldAtSettlement(date) };
    if (sale.kind === 'delisting_exit') return { state: 'sold', text: NAME_SENTENCES.soldAfterDelisting(date) };
    return { state: 'sold', text: NAME_SENTENCES.soldOther(date) };
  }
  const cash = (idea?.ledger?.corporateActionReceipts || []).filter((r) => r?.type === 'delisting' && upper(r?.ticker ?? r?.symbol) === sym);
  if (cash.length > 0) return { state: 'sold', text: NAME_SENTENCES.closedByDelisting(dayLabel(cash[cash.length - 1].appliedOn ?? cash[cash.length - 1].effectiveDate) ?? '') };
  return { state: 'sold', text: NAME_SENTENCES.soldOther('') };
}

/** The idea's names in its own order, by their current symbols (a ticker change renames the line). */
function symbolsOf(idea) {
  if (Array.isArray(idea?.lines) && idea.lines.length > 0) return idea.lines.map((l) => upper(l.symbol));
  return (idea?.contract?.names || []).map(upper);
}

/** One name of a live idea at the last close (its row `last`, the row before `prev`). */
function nameView(idea, sym, { last, lastAllot, prevAllot, session, boughtThisSession }) {
  const line = (idea.lines || []).find((l) => upper(l.symbol) === sym) || null;
  const holding = idea.ledger?.holdings?.[sym] ?? null;
  const base = { symbol: sym, isNew: boughtThisSession };
  if (!holding) return { ...base, isNew: false, ...soldSentence(idea, sym), mark: null, line: priceText(line?.level ?? null) };
  const entry = priceText(holding.avgCost ?? null);
  const level = priceText(line?.level ?? null);
  const m = last?.marks?.[sym];
  if (!m || !last?.quantities?.[sym]) {
    return { ...base, state: 'bought_today', text: NAME_SENTENCES.boughtToday, mark: null, entry, line: level, shares: SHARES.format(holding.shares) };
  }
  const shares = SHARES.format(last.quantities[sym]);
  if (m.quality !== MARK_QUALITY.VENDOR_TIME) {
    return { ...base, state: 'waiting', text: NAME_SENTENCES.waiting, waitingReason: qualityReason(sym, m.quality, session), mark: null, entry, line: level, shares };
  }
  const valueCents = lastAllot.get(sym) ?? 0;
  const costCents = toCents(holding.costBasisTotal ?? 0);
  const prevCents = boughtThisSession ? costCents : (prevAllot.has(sym) ? prevAllot.get(sym) : null);
  const distancePct = Number.isFinite(line?.level) && m.mark > 0 ? ((m.mark - line.level) * 100) / m.mark : null;
  const near = distancePct !== null && distancePct < NEAR_LINE_PCT;
  const out = {
    ...base,
    state: 'held',
    mark: priceText(m.mark),
    plOpen: signedAmount(valueCents - costCents),
    plDay: prevCents === null ? null : signedAmount(valueCents - prevCents),
    shares,
    positionValue: moneyText(valueCents),
    entry,
    line: level,
    distance: distancePct === null ? null : {
      text: `${pctText(distancePct, 1).replace(/^\+/, '')} away`,
      near,
      gauge: Math.max(0, 1 - Math.min(1, Math.max(0, distancePct) / GAUGE_FULL_PCT)),
    },
  };
  const pending = holding.exitPending ?? null;
  if (pending?.reason === 'line') return { ...out, state: 'line_hit', text: NAME_SENTENCES.lineHit };
  if (pending?.reason === 'delisting') return { ...out, state: 'line_hit', text: NAME_SENTENCES.delistedWaiting };
  return out;
}

// ── THE GROUPS ───────────────────────────────────────────────────────────────────────────────────────────────────────

const comparisonName = (contract) => (contract?.comparison?.type === 'sector_fund'
  ? (contract.comparison.symbols?.[0] ?? '')
  : (COMPARISON_NAMES[contract?.comparison?.type] ?? ''));

function gapOf(row, contract, session) {
  if (!isPlain(row)) return null;
  if (row.fullQuality !== true) return { waiting: rowReason(row, session) };
  const cents = toCents(row.markedGapUsd);
  return {
    ...signedAmount(cents),
    pct: pctText(row.markedGapPct),
    vs: comparisonName(contract),
    spy: Number.isFinite(row.markedGapToSpyUsd) ? signedAmount(toCents(row.markedGapToSpyUsd)) : null,
  };
}

function thesisOf(idea, desk) {
  const text = str(idea?.contract?.thesis?.text);
  if (!text) return null;
  const admitted = typeof idea.admittedAt === 'string' ? idea.admittedAt : (idea.admittedAt?.toDate?.().toISOString?.() ?? null);
  return { text, deskName: DESK_COPY[desk].name, date: dayLabel(admitted ? etDateOfIso(admitted) : null) };
}
/** The ET calendar date of an ISO instant (the founder's dates are Eastern). */
const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
function etDateOfIso(iso) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ET_DATE.format(new Date(ms)) : null;
}
const sourceChipOf = (idea) => SOURCE_CHIPS[idea?.contract?.origin?.kind] ?? SOURCE_CHIP_UNKNOWN;

/** The desk's part on the close row, or null. */
const deskPartOf = (closeRow, desk) => (isPlain(closeRow?.agent?.desks?.[desk]) ? closeRow.agent.desks[desk] : null);

/** Today's call on an idea: the desk's action and reason on the close row, the failed check, or none. */
function callOf(part, ideaId, desk, session) {
  if (!part) return null;
  if (part.source === AGENT_NOTE_SOURCE.CODE_FALLBACK) return { failed: true, text: FAILED_CHECK };
  const a = (part.actions || []).find((x) => x?.ideaId === ideaId);
  if (!a || !str(a.reason)) return null;
  return { kind: a.action === 'exit' ? 'Exit' : 'Hold', text: a.reason, deskName: DESK_COPY[desk].name, date: dayLabel(session) };
}

function groupOf(slot, idea, ctx) {
  const desk = idea ? (deskOfIdea(idea) ?? deskOfSlot(slot)) : deskOfSlot(slot);
  const sessions = slotSessions(slot);
  const head = { slot, slotName: SLOT_NAMES[slot], slotLabel: `${SLOT_NAMES[slot]} · ${sessions} sessions`, desk, deskName: DESK_COPY[desk].name };
  if (!idea) {
    return { ...head, state: 'open', text: OPEN_SLOT.row(SLOT_NAMES[slot], DESK_COPY[desk].the, ctx.looks), names: [] };
  }
  const { session } = ctx;
  const common = { ...head, thesis: thesisOf(idea, desk), source: sourceChipOf(idea) };
  // Entering: admitted, waiting for the next session's first window.
  if (idea.status === IDEA_STATUS.ACCEPTED || idea.status === IDEA_STATUS.ENTERING) {
    return {
      ...common, state: 'entering', line: GROUP_LINES.entering, gap: null, call: null,
      names: (idea.contract?.names || []).map((s) => ({ symbol: upper(s), state: 'entering', text: BUYS_NEXT_WINDOW, isNew: false })),
      namesText: (idea.contract?.names || []).map(upper).join(' · '),
    };
  }
  const rows = ctx.rows.get(idea.ideaId) || {};
  const last = rows.last && rows.last.date === session ? rows.last : null;
  const prev = rows.prev ?? null;
  const entered = idea.entry?.sessionDate ?? null;
  const boughtThisSession = entered !== null && entered === session;
  const lastAllot = allotCents(last);
  const prevAllot = allotCents(prev);
  const names = symbolsOf(idea).map((sym) => nameView(idea, sym, { last, lastAllot, prevAllot, session, boughtThisSession }));
  const due = idea.contract?.schedule?.dueSession ?? null;
  // Bought at a window after the last close: held, with no close mark yet.
  if (!last || (entered !== null && (session === null || entered > session))) {
    return { ...common, state: 'holding', line: GROUP_LINES.boughtToday, gap: null, call: null, names, namesText: names.map((n) => n.symbol).join(' · ') };
  }
  const left = Math.min(sessions, Math.max(0, sessionsLeftOf(session, due) ?? sessions));
  const day = sessions - left;
  const out = {
    ...common,
    state: idea.status === IDEA_STATUS.SETTLED ? 'selling' : 'holding',
    line: GROUP_LINES.day(day, sessions),
    day, of: sessions, sessionsLeft: left, sessionsLeftText: GROUP_LINES.sessionsLeft(left), progress: sessions > 0 ? day / sessions : 0,
    gap: gapOf(last, idea.contract, session),
    call: callOf(ctx.deskParts[desk], idea.ideaId, desk, session),
    names,
    namesText: names.map((n) => n.symbol).join(' · '),
  };
  if (idea.status === IDEA_STATUS.SETTLED) {
    const kind = idea.result?.endpointKind ?? idea.endpoint?.kind ?? null;
    out.selling = { word: SELLING_WORDS[kind] ?? SELLING_WORDS.due_session, rest: SELLS_NEXT_WINDOW };
  }
  return out;
}

/** A slot whose idea finished at this session (its last sale filled today), shown in its place until the next. */
function settledTodayGroupOf(slot, f) {
  const idea = f.idea;
  const desk = deskOfIdea(idea) ?? deskOfSlot(slot);
  const sessions = slotSessions(slot);
  const names = symbolsOf(idea).map((sym) => ({ symbol: sym, isNew: false, mark: null, ...soldSentence(idea, sym) }));
  return {
    slot, slotName: SLOT_NAMES[slot], slotLabel: `${SLOT_NAMES[slot]} · ${sessions} sessions`, desk, deskName: DESK_COPY[desk].name,
    state: 'settled_today', line: GROUP_LINES.settledToday,
    gap: f.view.notMeasurable ? { notMeasurable: NOT_MEASURABLE } : f.view.gap,
    thesis: thesisOf(idea, desk), source: sourceChipOf(idea), call: f.view.lastCall, names,
    namesText: names.map((n) => n.symbol).join(' · '),
  };
}

// ── THE STRIP ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One line per desk for the last close: the close row's agent block (held, exit called, admitted, passed on, or the failed
 * check) and code's facts dated that session (the desk's ideas bought at its window, and names sold at their lines). A desk
 * with nothing to say has no line.
 */
export function deriveStrip({ session, deskParts, ideas, finishedIdeas, rows = new Map() }) {
  if (!isDate(session)) return [];
  const all = [...ideas, ...finishedIdeas];
  // The names an idea held AT the close: its row's quantities there, else (no row) its holdings.
  const heldAtClose = (i) => {
    const r = rows.get(i.ideaId)?.last;
    return r && r.date === session && isPlain(r.quantities) ? Object.keys(r.quantities).map(upper) : Object.keys(i.ledger?.holdings || {}).map(upper);
  };
  const out = [];
  for (const desk of DESK_ORDER) {
    const part = deskParts[desk];
    const mine = all.filter((i) => deskOfIdea(i) === desk);
    const words = [];
    const opened = mine.filter((i) => i.entry?.sessionDate === session).flatMap(symbolsOf);
    if (opened.length > 0) words.push(STRIP.opened(opened));
    const failed = part?.source === AGENT_NOTE_SOURCE.CODE_FALLBACK;
    if (part && !failed) {
      const admitted = (part.considered || []).filter((c) => c?.outcome === 'admitted').flatMap((c) => (c.names || []).map(upper));
      if (admitted.length > 0) words.push(STRIP.admitted(admitted));
      const heldIds = new Set((part.actions || []).filter((a) => a?.outcome === 'held').map((a) => a.ideaId));
      // (An idea bought at this session's window is said as opened, not held again: the mock-up's state 3.)
      const held = mine.filter((i) => heldIds.has(i.ideaId) && i.entry?.sessionDate !== session).reduce((n, i) => n + heldAtClose(i).length, 0);
      if (held > 0) words.push(STRIP.held(held));
      const exitIds = new Set((part.actions || []).filter((a) => a?.action === 'exit' && a?.outcome === 'exit_settled').map((a) => a.ideaId));
      const exited = mine.filter((i) => exitIds.has(i.ideaId)).flatMap(heldAtClose);
      if (exited.length > 0) words.push(STRIP.exit(exited));
    }
    const sold = mine.flatMap((i) => (i.ledger?.saleReceipts || []).filter((r) => r?.kind === 'line_exit' && r?.sessionDate === session).map((r) => upper(r.symbol)));
    if (sold.length > 0) words.push(STRIP.soldAtLine(sold));
    if (part && !failed) {
      const passed = (part.considered || []).filter((c) => c?.outcome === 'refused' || c?.outcome === 'not_chosen').length;
      if (passed > 0) words.push(STRIP.passedOn(passed));
    }
    if (failed) out.push({ desk, deskName: DESK_COPY[desk].name, failed: true, text: [FAILED_CHECK, ...words].join(STRIP.sep) });
    else if (words.length > 0) out.push({ desk, deskName: DESK_COPY[desk].name, failed: false, text: words.join(STRIP.sep) });
  }
  return out;
}

// ── THE DESKS TAB ────────────────────────────────────────────────────────────────────────────────────────────────────

/** B3-5: a draft's refusal codes as plain sentences (distinct, in order); an unmapped code reads "not admitted". */
export function refusalReasonOf(refusals) {
  const seen = [];
  for (const r of refusals || []) {
    const sentence = REFUSAL_REASONS[r?.code] ?? REFUSAL_UNMAPPED;
    if (!seen.includes(sentence)) seen.push(sentence);
  }
  return seen.length > 0 ? seen.join('; ') : REFUSAL_UNMAPPED;
}

function draftView(c, session) {
  const outcome = DRAFT_OUTCOMES[c?.outcome] ?? DRAFT_OUTCOMES.refused;
  const why = c?.outcome === 'refused' || c?.outcome === 'waiting' ? refusalReasonOf(c?.refusals) : null;
  return {
    names: (c?.names || []).map(upper).join(' · '),
    thesis: str(c?.thesis),
    date: dayLabel(session),
    outcome,
    why: c?.outcome === 'waiting' && (c?.refusals || []).length === 0 ? null : why,
  };
}

function desksOf({ session, deskParts, groups, archetypeName, looks }) {
  return DESK_ORDER.map((desk) => {
    const part = deskParts[desk];
    const copy = DESK_COPY[desk];
    const lane = desk === 'archetype' && str(archetypeName) ? `${archetypeName} · ${copy.lane}` : copy.lane;
    let note = null;
    if (part?.source === AGENT_NOTE_SOURCE.CODE_FALLBACK) note = { failed: true, text: FAILED_CHECK, date: dayLabel(session) };
    else if (part?.source === AGENT_NOTE_SOURCE.MODEL && str(part.note)) note = { failed: false, text: part.note, date: dayLabel(session) };
    const calls = groups.filter((g) => g.desk === desk).map((g) => {
      const row = { slot: g.slot, slotName: g.slotName, namesText: g.namesText ?? null };
      if (g.state === 'open') return { ...row, state: 'open', text: OPEN_SLOT.desks(copy.the, looks) };
      if (g.state === 'entering') return { ...row, state: 'entering', text: BUYS_NEXT_WINDOW };
      return { ...row, state: 'call', call: g.call ?? null, selling: g.selling ?? null };
    });
    const considered = (part && part.source === AGENT_NOTE_SOURCE.MODEL ? part.considered || [] : []).map((c) => draftView(c, session));
    const count = (o) => (part?.considered || []).filter((c) => c?.outcome === o).length;
    const tally = considered.length === 0 ? null : [
      `${considered.length} draft${considered.length === 1 ? '' : 's'}`,
      ...[['admitted', 'admitted'], ['not_chosen', 'not chosen'], ['refused', 'refused'], ['waiting', 'waiting']]
        .filter(([o]) => count(o) > 0).map(([o, w]) => `${count(o)} ${w}`),
    ].join(' · ');
    return { desk, deskName: copy.name, lane, note, calls, passed: considered.length > 0 ? { tally, drafts: considered } : null };
  });
}

// ── HISTORY ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Is a finished idea's result packet whole (B2 §8: its own hash AND its receipt parts)? Pure.
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function packetCheck(packet, parts) {
  if (!isPlain(packet)) return { ok: false, problems: ['packet:missing'] };
  const problems = [];
  if (!verifyPacket(packet)) problems.push('packet:hash');
  problems.push(...resultPacketPartProblems(packet, parts || {}));
  if (!isPlain(packet.result)) problems.push('packet:result_missing');
  return { ok: problems.length === 0, problems };
}

function unmeasurableReasons(result) {
  const out = [];
  for (const code of result?.economic?.unmeasurableBecause || []) {
    const s = UNMEASURABLE_REASONS[code] ?? ((result?.economic?.standingQualityReasons || []).some((r) => r?.kind === code) ? UNMEASURABLE_STANDING : UNMEASURABLE_UNKNOWN);
    if (!out.includes(s)) out.push(s);
  }
  return out.length > 0 ? out : [UNMEASURABLE_UNKNOWN];
}

function columnsOf(result, gap) {
  const col = (key, value, sub = null, dir = 0) => {
    const spec = RESULT_COLUMNS[key];
    return { key, label: spec.label, value: spec.values[value] ?? RESULT_VALUE_UNKNOWN, sub, dir };
  };
  const breached = (result.contractDetail?.breaches || []).map((b) => upper(b.symbol)).join(', ');
  return [
    col('contractCondition', result.contractCondition, result.contractCondition === 'breached' && breached ? breached : null),
    col('economicResult', result.economicResult, gap ? `${gap.text} · ${gap.pct}` : null, gap && result.economicResult !== 'unmeasurable' ? gap.dir : 0),
    col('processQuality', result.processQuality),
    col('evidenceScope', result.evidenceScope),
    col('adoption', result.adoption),
  ];
}

/** One finished idea for History (and for its slot's "settled today" group). */
export function finishedView(f) {
  const idea = f.idea;
  const slot = idea?.contract?.slot ?? null;
  const desk = deskOfIdea(idea) ?? deskOfSlot(slot);
  const check = packetCheck(f.packet, f.parts);
  const result = check.ok ? f.packet.result : null;
  const kind = result?.endpointKind ?? null;
  const sessions = slotSessions(slot);
  const ended = (ENDED_WORDS[kind] ?? ENDED_UNKNOWN)(sessions);
  const base = {
    namesText: (idea?.contract?.names || []).map(upper).join(' · '),
    slot, slotName: SLOT_NAMES[slot] ?? null, slotLabel: slot ? `${SLOT_NAMES[slot]} · ${sessions} sessions` : null,
    desk, deskName: desk ? DESK_COPY[desk].name : null,
    // The day it finished: its last sale filled (the liquidation), else its endpoint.
    ended, endedOn: dayLabel(idea?.liquidation?.completedSession ?? result?.endpointSession ?? idea?.endpoint?.session ?? null),
    thesis: desk ? thesisOf(idea, desk) : null,
    source: sourceChipOf(idea),
  };
  const managerExit = result?.managerExit ?? null;
  const lastCall = managerExit && str(managerExit.reason) && DESK_COPY[managerExit.desk]
    ? { kind: 'Exit', text: managerExit.reason, deskName: DESK_COPY[managerExit.desk].name, date: dayLabel(managerExit.session) }
    : null;
  if (!check.ok) return { ...base, gap: null, notMeasurable: { reasons: [EVIDENCE_UNCHECKED] }, columns: null, lastCall: null };
  const econ = result.economic || {};
  const gap = Number.isFinite(econ.gapUsd)
    ? { ...signedAmount(toCents(econ.gapUsd)), pct: pctText(econ.gapPctOfReserved), vs: comparisonName(idea.contract) }
    : null;
  const notMeasurable = result.economicResult === 'unmeasurable' ? { reasons: unmeasurableReasons(result) } : null;
  return { ...base, gap: notMeasurable ? null : gap, notMeasurable, columns: columnsOf(result, gap), lastCall };
}

// ── THE VIEW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The owner's book as the screen draws it. Pure: everything it needs is handed in by bookViewRead.js.
 *
 * @param {object} input
 * @param {object} input.book            mandates/{bookId} — the caller's own (the reader checked)
 * @param {object[]} input.ideas         every idea the book's slots or open set name
 * @param {Map<string,{last,prev}>} input.rows   each idea's rows at the last close and the close before it
 * @param {{ last?: object, prev?: object }} input.dailyRows   the book's rows at the last close and the one before
 * @param {object|null} input.closeRow   windows/{session}_close (the agent's block), or null
 * @param {Array<{ idea, packet, parts }>} input.finished   finished ideas, newest first (≤ HISTORY_LIMIT)
 * @param {{ session: string, row: object }|null} input.firstEntry   the book's first entered idea's row at its entry
 * @param {boolean} input.agentOn       practiceFieldAgentOn(): do the desks look tonight?
 * @param {string|null} input.archetypeName  the archetype desk's archetype, for its lane
 */
export function buildBookView({ book, ideas = [], rows = new Map(), dailyRows = {}, closeRow = null, finished = [], firstEntry = null, agentOn = false, archetypeName = null }) {
  const lastRow = isPlain(dailyRows.last) ? dailyRows.last : null;
  const session = isDate(book?.execState?.lastCloseKey) ? book.execState.lastCloseKey : (lastRow?.date ?? null);
  const last = lastRow && lastRow.date === session ? lastRow : null;
  const prev = last && isPlain(dailyRows.prev) && dailyRows.prev.date < session ? dailyRows.prev : null;
  const paused = book?.drafting === 'paused';
  const windingDown = book?.status === 'draining' || isPlain(book?.windDown);
  const looks = agentOn === true && !paused && !windingDown;
  const deskParts = { shadow: deskPartOf(closeRow, 'shadow'), archetype: deskPartOf(closeRow, 'archetype') };
  const byId = new Map(ideas.map((i) => [i.ideaId, i]));
  const finishedViews = finished.map((f) => ({ ...f, view: finishedView(f) }));

  // The groups, one per slot in order.
  const ctx = { session, rows, deskParts, looks };
  const groups = PRACTICE_FIELD_SLOT_NAMES.map((slot) => {
    const id = book?.slots?.[slot] ?? null;
    const idea = typeof id === 'string' ? byId.get(id) ?? null : null;
    if (idea) return groupOf(slot, idea, ctx);
    const today = finishedViews.find((f) => f.idea?.contract?.slot === slot && f.idea?.liquidation?.completedSession === session && session !== null);
    return today ? settledTodayGroupOf(slot, today) : groupOf(slot, null, ctx);
  });

  // The book line.
  const everFilled = ideas.some((i) => i.entry?.sessionDate) || finished.length > 0;
  const valueCents = toCents(last ? last.markedEquity : (book?.portfolio?.totalValue ?? 0));
  const cashCents = last ? toCents(last.treasuryCash) + toCents(last.reservedCash) : toCents(book?.portfolio?.cash ?? 0);
  let first = null;
  if (!everFilled) {
    const starts = ideas.map((i) => i.contract?.schedule?.startSession).filter(isDate).sort();
    first = starts.length > 0 ? { kind: 'opens', label: 'Opens', value: dayLabel(starts[0]), dir: 0 } : null;
  } else if (last && firstEntry && isDate(firstEntry.session)) {
    const since = deriveSinceOpen(last, book?.portfolio?.initialValue);
    first = since ? { kind: 'since', label: `Since ${dayLabel(firstEntry.session)}`, value: since.pct, dir: since.dir } : null;
  }
  // SPY since the book's first entry session, from the book's own rows (B3-6): that row's SPY close and the last close's.
  let spy = { label: 'SPY', value: '—' };
  const spyNow = ideas.map((i) => rows.get(i.ideaId)?.last).find((r) => r && r.date === session && r.spyMarks?.[PRACTICE_FIELD_BENCHMARK_SYMBOL]);
  const startMark = firstEntry?.row?.spyMarks?.[PRACTICE_FIELD_BENCHMARK_SYMBOL] ?? null;
  const nowMark = spyNow?.spyMarks?.[PRACTICE_FIELD_BENCHMARK_SYMBOL] ?? null;
  if (startMark && nowMark && startMark.quality === MARK_QUALITY.VENDOR_TIME && nowMark.quality === MARK_QUALITY.VENDOR_TIME && startMark.mark > 0) {
    spy = { label: 'SPY', value: pctText(((nowMark.mark - startMark.mark) * 100) / startMark.mark), since: dayLabel(firstEntry.session) };
  }
  const line = {
    value: moneyText(valueCents),
    today: last ? deriveToday(last, prev) : null,
    first,
    spy,
    cash: moneyText(cashCents),
    paused,
    windingDown,
    statusLine: paused ? PAUSED_LINE : windingDown ? WINDING_DOWN_LINE : null,
    smallPrint: PAPER_MONEY,
  };

  const held = groups.some((g) => g.state === 'holding' || g.state === 'selling');
  const asOf = last && held
    ? { session: dayLabel(session), text: last.observed === false ? MARKS_AS_OF_UNOBSERVED(dayLabel(session)) : MARKS_AS_OF(dayLabel(session)) }
    : null;

  return {
    version: BOOK_VIEW_VERSION,
    day: weekdayLabel(session),
    asOf,
    line,
    strip: deriveStrip({ session, deskParts, ideas, finishedIdeas: finished.map((f) => f.idea).filter(Boolean), rows }),
    groups,
    cash: moneyText(cashCents),
    desks: desksOf({ session, deskParts, groups, archetypeName, looks }),
    history: { empty: NO_FINISHED_IDEAS, items: finishedViews.map((f) => f.view) },
  };
}
