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
//   SPY since open        SPY's quote at the book's first fill (the first entered idea's inception row, its SPY leg) to
//                         its vendor-timed close mark at the last close: both from the book's own records (B3-6; never a
//                         shared snapshot, which is deleted after 120 days)
//   a position's value    each name's shares × mark at the close, by the engine's own markBook, whole cents allotted so
//                         the names of an idea sum EXACTLY to its row's markedHoldingsValue (BUILD_RULES §9; allotCents)
//   open P/L              that position value less the holding's costBasisTotal
//   day P/L               that position value less the same name's at the close before (the same allotment on that
//                         row; under its old symbol on the session a ticker change renamed it); a name bought at this
//                         session's window: less its costBasisTotal. None when the close before carried its mark or
//                         was not observed (it would span two sessions). Income is not in it: a dividend is the idea's cash
//   distance to the line  (mark − level) / mark, in percent, one decimal; "near" under 1% (the mock-up's rule)
//   day n of N            N is the slot's length; sessions left is the agent's own count (agentRun.js sessionsLeft: the
//                         sessions after the last close up to the due one); n = N − sessions left
//   the strip             the close row's agent block (what each desk held, exited, admitted and passed on) and, as
//                         code's facts, the ideas' own entries and line sales dated that session (deriveStrip)
// A ROW BELOW FULL QUALITY NEVER SHOWS A P/L: a name whose close mark is not the vendor's own timed close reads
// "Waiting on data", with one plain reason (bookViewCopy.js QUALITY_REASONS); an idea row below full quality shows no gap.
// An idea row held below full quality BY ITS LEDGER (an unresolved action, a waiting proposal: ledgerHeld) holds every
// name of the idea (review B3-A01). The book's own row below full quality holds the book line (ruling B3-11): its headline
// waits, with today's change, since open and SPY; cash shows.
//
// EVERY TEXT FROM AN AGENT OR A PLAYER (notes, reasons, theses) is passed through as plain text, with its desk and date.
// No id leaves this function: groups are keyed by slot, names by symbol, desks by desk, History rows by position.
//
// BUILD B5 — THE VIEW FOR THE HUB (rulings B5-1 to B5-5; the Command Center chat's note,
// docs/design/20261126_NOTE_TO_PRACTICE_FIELD_BOOK_VIEW_FOR_THE_HUB.md):
//   the archetype (B5-1)  `archetype { codeId, name }`: the archetype the book RUNS UNDER — its epoch's `archetypeCodeId`
//                         (never the agent's battle loadout), named by the registry (the reader resolves it). An unknown
//                         code keeps its id with a null name; no epoch, no archetype. The code id is a catalogue key.
//   the split (B5-2)      three parts, the agent's desk, the archetype's desk and cash (deriveSplit):
//                           a desk's SHARE  the sum of its slots' caps in the epoch (`rails.slotCapShare`, each slot to its
//                                           desk by deskOfSlot), in whole millionths; cash's, the epoch's cash floor
//                                           (`gateConfig.cashFloorPct`). Never a constant restated here. They must sum to
//                                           exactly 1 (in millionths), or the view carries no split (a bar whose widths
//                                           do not add up would misdraw the book; scaling would show shares it does not hold).
//                           a desk's USE    the marked value at the last close of every position its ideas held there:
//                                           each idea row of that session, by the SAME allotment the names' position
//                                           values use (allotCents), summed — an idea finished since that close counted by
//                                           its row there; an entering idea, or one bought after the close, has no row
//                                           there and counts zero. Divided by the desk's share of the book's marked value
//                                           (the same equity cents the headline shows, BUILD_RULES §9), that share floored
//                                           to the cent (money.js weightedCents). Text shows the true figures, above the
//                                           share too; the bar's plain number stops at 1.
//                           waiting         a book line that waits (B3-11) shows each share and no use: a book row at full
//                                           quality means every idea row of that close is (close.js `allFullQuality`), so no
//                                           use figure ever comes from a row below full quality.
//   the desks' names (B5-3) "{the agent's given name}’s desk" and "{the archetype's name}’s desk" in every sentence and
//                         label (bookViewCopy.js DESK_NAMES), finished here; the given name is plain text of at most
//                         AGENT_GIVEN_NAME_MAX code points (plainGivenName), else "Your agent’s desk". The desk ids stay.

import { toCents, weightPpm, weightedCents, WEIGHT_PPM_TOTAL } from './money.js';
import { markBook } from '../mandateValuation.js';
import { slotSessions, nextSessionDate } from './windows.js';
import { deskOfIdea, deskOfSlot, AGENT_NOTE_SOURCE } from './agentConfig.js';
import { MARK_QUALITY, IDEA_STATUS } from './constants.js';
import { verifyPacket, resultPacketPartProblems } from './evidence.js';
import { openAmbiguities } from './ledger.js';
import { openProposals } from './adjustments.js';
import { PRACTICE_FIELD_SLOT_NAMES } from '../../../src/data/practiceFieldSlots.js';
import { PRACTICE_FIELD_BENCHMARK_SYMBOL } from '../../../src/data/practiceFieldFunds.js';
import {
  FAILED_CHECK, BUYS_NEXT_WINDOW, SELLS_NEXT_WINDOW, PAPER_MONEY, PAUSED_LINE, WINDING_DOWN_LINE, SLOT_NAMES, DESK_NAMES, DESK_LANES,
  SPLIT_CASH_NAME, SOURCE_CHIPS, SOURCE_CHIP_UNKNOWN, COMPARISON_NAMES, NAME_SENTENCES, GROUP_LINES, SELLING_WORDS, OPEN_SLOT, STRIP,
  MARKS_AS_OF, MARKS_AS_OF_UNOBSERVED, DRAFT_OUTCOMES, REFUSAL_REASONS, REFUSAL_UNMAPPED, QUALITY_REASONS, QUALITY_REASON_UNKNOWN,
  ROW_REASON_HELD, ROW_REASON_STANDING, ROW_REASON_UNKNOWN, EXIT_NOT_CARRIED, ENDED_WORDS, ENDED_UNKNOWN, UNMEASURABLE_REASONS, UNMEASURABLE_STANDING, UNMEASURABLE_UNKNOWN,
  EVIDENCE_UNCHECKED, NOT_MEASURABLE, RESULT_COLUMNS, RESULT_VALUE_UNKNOWN, NO_FINISHED_IDEAS,
  BOOK_WAITING, BOOK_WAITING_REASON, THESIS_BY_FOUNDER,
} from './bookViewCopy.js';

/**
 * The view's own version: the client refuses a shape it does not know. 2 (the fix round): the book line's `waiting` and its
 * nullable `value` (B3-11); a thesis's `byline` in place of `deskName` (B3-12). 3 (B5-5): `archetype` and `split`, and the
 * desks by their names (B5-3).
 */
export const BOOK_VIEW_VERSION = 3;
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

// ── THE DESKS' NAMES (B5-3) ──────────────────────────────────────────────────────────────────────────────────────────

/** The most code points the agent's given name may have: the agent creation form's own limit (its `maxLength`). */
export const AGENT_GIVEN_NAME_MAX = 20;
/** A control, a lone surrogate, a line or paragraph separator. */
const NOT_PLAIN_TEXT = /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u;
/**
 * A format character — the bidi overrides and isolates, zero-width spaces, soft hyphens, tag characters — save the two
 * joiners a script or an emoji sequence spells with (U+200D, which joins an emoji sequence; U+200C, which Persian writes).
 */
const FORMAT_CHARACTER = /\p{Cf}/u;
const JOINERS = Object.freeze([String.fromCodePoint(0x200d), String.fromCodePoint(0x200c)]);
/** What draws nothing on its own (review B2): default-ignorable code points (joiners, fillers, variation selectors),
 * combining marks, white space — and the braille blank, a symbol that draws nothing. */
const DRAWS_NOTHING = /[\p{Default_Ignorable_Code_Point}\p{M}\p{White_Space}]/gu;
const BRAILLE_BLANK = String.fromCodePoint(0x2800);
const withoutJoiners = (t) => JOINERS.reduce((s, j) => s.split(j).join(''), t);

/**
 * The agent's given name as this module may show it, or null: player text, PLAIN TEXT ONLY — trimmed, one to
 * AGENT_GIVEN_NAME_MAX code points, no control, separator, lone surrogate or format character (the two joiners aside), and
 * at least one character that draws something. Markup is not stripped: it is text, and the client draws it as text.
 * Anything else falls back (null).
 */
export function plainGivenName(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0 || [...t].length > AGENT_GIVEN_NAME_MAX) return null;
  if (NOT_PLAIN_TEXT.test(t) || FORMAT_CHARACTER.test(withoutJoiners(t))) return null;
  if (t.replace(DRAWS_NOTHING, '').split(BRAILLE_BLANK).join('').length === 0) return null;
  return t;
}

/** Each desk's finished name (`name` for a label or a sentence's head, `mid` inside one), by desk id. Pure. */
export function deskNamesOf({ agentName = null, archetypeName = null } = {}) {
  return { shadow: DESK_NAMES.agent(plainGivenName(agentName)), archetype: DESK_NAMES.archetype(str(archetypeName)) };
}
/** A desk's label, or null for no desk (or a desk id this view does not know). */
const deskLabel = (names, desk) => (typeof desk === 'string' && Object.hasOwn(names, desk) ? names[desk].name : null);

// ── FORMATTING (display only: every figure below is already whole cents, a stored price or a stored percent) ──────────

const USD = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD_WHOLE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PRICE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/**
 * B5-2: a desk's use in whole percent ("83%"), cut, never rounded up (review A4): "100%" exactly when the bar is full, never
 * for 99.6%; and a share as the epoch states it ("70%", "12.5%"). Display only.
 */
const PCT_WHOLE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0, roundingMode: 'trunc' });
const PCT_SHARE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
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
/** An unsigned amount: its text, and its text without cents when it is $10,000 or more (the table's fit rule). */
export function amountText(cents) {
  const text = moneyText(cents);
  return { text, short: Math.abs(cents) >= NO_CENTS_FROM_CENTS ? `${cents < 0 ? MINUS : ''}$${USD_WHOLE.format(Math.abs(cents) / 100)}` : text };
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

/** A displayed percent that rounded to zero carries no sign, and so no colour either. */
const dirOfText = (text, n) => (text.startsWith('+') || text.startsWith(MINUS) ? dirOf(n) : 0);

/**
 * Since open: the last close's equity less the book's opening value, as a percent of it. A row below full quality shows
 * no figure here either (the same rule as today's change and every P/L): a dash.
 */
export function deriveSinceOpen(last, initialValue) {
  if (!isPlain(last) || !(Number(initialValue) > 0)) return null;
  if (last.fullQuality !== true) return { pct: '—', dir: 0 };
  const initCents = toCents(initialValue);
  const diff = toCents(last.markedEquity) - initCents;
  const pct = pctText((diff * 100) / initCents);
  return { pct, dir: dirOfText(pct, diff) };
}

// ── THE NAMES ────────────────────────────────────────────────────────────────────────────────────────────────────────

function qualityReason(sym, quality, date) {
  const f = QUALITY_REASONS[quality];
  return f ? f(sym, dayLabel(date)) : QUALITY_REASON_UNKNOWN(sym, dayLabel(date));
}

const MARK_FIELDS = Object.freeze(['marks', 'comparisonMarks', 'spyMarks']);
/** A ledger's open holds, by the engine's own tests (close.js names the same three when it holds a row). */
const ledgerHasHold = (l) => isPlain(l) && ((l.closedHeldRows || []).length > 0 || openAmbiguities(l).length > 0 || openProposals(l).length > 0);
/**
 * The idea's open holds: any of its three ledgers', or a founder's correction not yet posted on every ledger it names
 * (close.js holds the row for it too: `founderRulings`, a `conflict` ruling that `corrects`, with no `appliedOn` — the
 * refuter's R1).
 */
const ideaHasHold = (idea) => [idea?.ledger, idea?.comparisonLedger, idea?.spyLedger].some(ledgerHasHold)
  || (idea?.founderRulings || []).some((r) => r && r.appliedOn == null && r.kind === 'conflict' && r.corrects === true);

/**
 * IS AN IDEA'S ROW BELOW FULL QUALITY FOR A LEDGER REASON (review B3-A01)? THE ONE TEST, for the last close's row and for
 * the row before it (whose figures a name's day P/L would use). How the row records it — close.js writes, per idea row:
 *   fullQuality = observed
 *                 && every mark of the idea's three ledgers is the vendor's own timed close (valueLedger: any other
 *                    quality, a held-back symbol's carried mark included, makes its valuation not full quality)
 *                 && no open hold (on any of the three ledgers: an unsettled conflict or re-date, a ruled id revised since:
 *                    ledger.js openAmbiguities; a late row waiting on a doubt: `closedHeldRows`; a late proposal waiting
 *                    for the founder: adjustments.js openProposals — and on the idea: a founder's correction not yet
 *                    posted, `founderRulings`)
 *                 && no standing reason (`standingQualityReasons`, which the row also names one by one).
 * The row names its standing reasons but not its open holds. Read backwards: an observed row below full quality is held
 * by its ledger when it names a standing reason, or when every one of its marks is the vendor's own — nothing but a hold
 * can then have kept it below. When one of its marks is ALSO not the vendor's own, the row alone cannot say whether a hold
 * stands beside it: for the last close's row, the idea itself (`idea`, written by that same close and read with it)
 * answers, by the same tests close.js runs. The row before has no idea record of its own time to ask, so there the answer
 * is the careful one: it cannot rule a hold out, so it counts as held (the refuter's R2 — a row the page may have shown as
 * held is never the next day's base). An unobserved row is not a ledger hold: every mark on it is `unobserved`, so each
 * name waits on its own (and an unobserved row is never a day's base either).
 * @param {object|null} row
 * @param {object|null} idea  the idea as the last close left it — for the last close's row only
 * @returns {boolean}
 */
export function ledgerHeld(row, idea = null) {
  if (!isPlain(row) || row.fullQuality === true || row.observed === false) return false;
  if ((row.standingQualityReasons || []).length > 0) return true;
  const everyMarkVendor = MARK_FIELDS.every((f) => Object.values(row[f] || {}).every((m) => m?.quality === MARK_QUALITY.VENDOR_TIME));
  if (everyMarkVendor) return true;
  return idea === null ? true : ideaHasHold(idea);
}
/** The sentence for a ledger hold: a standing reason, else the held action. */
const holdReason = (row) => ((row?.standingQualityReasons || []).length > 0 ? ROW_REASON_STANDING : ROW_REASON_HELD);

/**
 * Why an idea's row is below full quality: a ledger hold (`held`, ledgerHeld's answer), else the first mark not the vendor's
 * own, else the held action, else plainly.
 */
function rowReason(row, date, held = false) {
  if (row?.observed === false) return QUALITY_REASONS.unobserved(null, dayLabel(date));
  if (held) return holdReason(row);
  for (const field of MARK_FIELDS) {
    for (const [sym, m] of Object.entries(row?.[field] || {})) {
      if (m?.quality !== MARK_QUALITY.VENDOR_TIME) return qualityReason(sym, m?.quality, date);
    }
  }
  if ((row?.standingQualityReasons || []).length > 0) return ROW_REASON_STANDING;
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

/**
 * The symbol a name had at the close before: its own, or — on the session a ticker change renamed it (close.js renames the
 * line, `renamedFrom`) — the old one, so its day P/L still has a base.
 */
function prevSymbolOf(line, sym, prev, session) {
  if (prev?.quantities?.[sym] !== undefined) return sym;
  const renamed = (line?.renamedFrom || []).filter((r) => r?.appliedOn === session).map((r) => upper(r.symbol));
  return renamed.find((s) => prev?.quantities?.[s] !== undefined) ?? null;
}

/**
 * One name of a live idea at the last close (its row `last`, the row before `prev`). `boughtThisSession`: bought at this
 * session's window and valued at this close; `boughtAfterClose`: bought at a window after the last close (no mark yet).
 */
function nameView(idea, sym, { last, prev, lastAllot, prevAllot, session, boughtThisSession, boughtAfterClose = false, lastHeld = false, prevHeld = false }) {
  const line = (idea.lines || []).find((l) => upper(l.symbol) === sym) || null;
  const holding = idea.ledger?.holdings?.[sym] ?? null;
  const base = { symbol: sym, isNew: boughtThisSession || boughtAfterClose };
  // A sold name keeps its entry (its fill, while no split has moved it) and its line.
  const soldEntry = line && (line.adjustments || []).length === 0 ? priceText(line.fillPrice ?? null) : null;
  if (!holding) return { ...base, isNew: false, ...soldSentence(idea, sym), mark: null, entry: soldEntry, line: priceText(line?.level ?? null) };
  const entry = priceText(holding.avgCost ?? null);
  const level = priceText(line?.level ?? null);
  // A delisting with no cash amount: the holding waits to be sold, at its carried mark — said so, never as missing data.
  if (holding.exitPending?.reason === 'delisting') {
    return { ...base, state: 'delisted', text: NAME_SENTENCES.delistedWaiting, mark: null, entry, line: level, shares: SHARES.format(holding.shares) };
  }
  const m = last?.marks?.[sym];
  if (boughtAfterClose || !m || !last?.quantities?.[sym]) {
    return { ...base, state: 'bought_today', text: NAME_SENTENCES.boughtToday, mark: null, entry, line: level, shares: SHARES.format(holding.shares) };
  }
  const shares = SHARES.format(last.quantities[sym]);
  // Review B3-A01: the idea's row held by its ledger holds EVERY name of the idea — a fresh quote settles no ledger
  // question — with the row's own reason, and no figure that depends on a mark.
  if (lastHeld) {
    return { ...base, state: 'waiting', text: NAME_SENTENCES.waiting, waitingReason: holdReason(last), mark: null, entry, line: level, shares };
  }
  if (m.quality !== MARK_QUALITY.VENDOR_TIME) {
    return { ...base, state: 'waiting', text: NAME_SENTENCES.waiting, waitingReason: qualityReason(sym, m.quality, session), mark: null, entry, line: level, shares };
  }
  const valueCents = lastAllot.get(sym) ?? 0;
  const costCents = toCents(holding.costBasisTotal ?? 0);
  // The day's base: what it cost (bought this session), else its value at the close before — only when that close's
  // mark was the vendor's own (a carried or unobserved one would make "P/L Day" span two sessions: no figure, a dash),
  // and that row passes the same ledger test (B3-A01: a held row's figures are not a base either).
  const prevSym = boughtThisSession ? null : prevSymbolOf(line, sym, prev, session);
  const prevOk = prevSym !== null && prev?.observed !== false && !prevHeld && prev?.marks?.[prevSym]?.quality === MARK_QUALITY.VENDOR_TIME;
  const prevCents = boughtThisSession ? costCents : (prevOk && prevAllot.has(prevSym) ? prevAllot.get(prevSym) : null);
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
      text: distancePct < 0
        ? NAME_SENTENCES.belowLine(pctText(-distancePct, 1).replace(/^\+/, ''))
        : `${pctText(distancePct, 1).replace(/^\+/, '')} away`,
      near,
      gauge: Math.max(0, 1 - Math.min(1, Math.max(0, distancePct) / GAUGE_FULL_PCT)),
    },
  };
  if (holding.exitPending?.reason === 'line') return { ...out, state: 'line_hit', text: NAME_SENTENCES.lineHit };
  return out;
}

// ── THE GROUPS ───────────────────────────────────────────────────────────────────────────────────────────────────────

const comparisonName = (contract) => (contract?.comparison?.type === 'sector_fund'
  ? (contract.comparison.symbols?.[0] ?? '')
  : (COMPARISON_NAMES[contract?.comparison?.type] ?? ''));

function gapOf(row, contract, session, held = false) {
  if (!isPlain(row)) return null;
  if (row.fullQuality !== true) return { waiting: rowReason(row, session, held) };
  const cents = toCents(row.markedGapUsd);
  return {
    ...signedAmount(cents),
    pct: pctText(row.markedGapPct),
    vs: comparisonName(contract),
    spy: Number.isFinite(row.markedGapToSpyUsd) ? signedAmount(toCents(row.markedGapToSpyUsd)) : null,
  };
}

/**
 * Ruling B3-12 (review B3-A06): a thesis is signed by WHO WROTE IT — its stored `contract.thesis.author` (contract.js:
 * 'agent' | 'founder_fixture') — never by the desk that manages it (that desk stays on the group and on its own calls).
 * `founder_fixture` reads "The founder"; `agent`, the desk that drafted it (the desk frozen with its contract, else its
 * slot's: deskOfIdea), by its name (B5-3). Any other value: no byline (null), never an invented one.
 */
function bylineOf(idea, names) {
  const author = idea?.contract?.thesis?.author;
  if (author === 'founder_fixture') return THESIS_BY_FOUNDER;
  if (author === 'agent') return deskLabel(names, deskOfIdea(idea));
  return null;
}
function thesisOf(idea, names) {
  const text = str(idea?.contract?.thesis?.text);
  if (!text) return null;
  const admitted = typeof idea.admittedAt === 'string' ? idea.admittedAt : (idea.admittedAt?.toDate?.().toISOString?.() ?? null);
  return { text, byline: bylineOf(idea, names), date: dayLabel(admitted ? etDateOfIso(admitted) : null) };
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
function callOf(part, ideaId, desk, session, names) {
  if (!part) return null;
  if (part.source === AGENT_NOTE_SOURCE.CODE_FALLBACK) return { failed: true, text: FAILED_CHECK.sentence(deskLabel(names, desk)), deskName: deskLabel(names, desk) };
  const a = (part.actions || []).find((x) => x?.ideaId === ideaId);
  if (!a || !str(a.reason)) return null;
  const call = { kind: a.action === 'exit' ? 'Exit' : 'Hold', text: a.reason, deskName: deskLabel(names, desk), date: dayLabel(session) };
  // An Exit code did not carry out (refused, or nothing to do): said beside it, so it never reads as done.
  if (a.action === 'exit' && a.outcome !== 'exit_settled') call.notCarriedOut = EXIT_NOT_CARRIED(a.outcome);
  return call;
}

/** The idea's length in sessions: the frozen contract's own, else its slot's (they agree today). */
const sessionsOfIdea = (idea, slot) => (Number.isInteger(idea?.contract?.schedule?.sessions) && idea.contract.schedule.sessions > 0 ? idea.contract.schedule.sessions : slotSessions(slot));

function groupOf(slot, idea, ctx) {
  const desk = idea ? (deskOfIdea(idea) ?? deskOfSlot(slot)) : deskOfSlot(slot);
  const sessions = sessionsOfIdea(idea, slot);
  const head = { slot, slotName: SLOT_NAMES[slot], slotLabel: `${SLOT_NAMES[slot]} · ${sessions} sessions`, desk, deskName: deskLabel(ctx.names, desk) };
  if (!idea) {
    return { ...head, state: 'open', text: OPEN_SLOT.row(SLOT_NAMES[slot], ctx.names[desk].mid, ctx.looks), names: [] };
  }
  const { session } = ctx;
  const common = { ...head, thesis: thesisOf(idea, ctx.names), source: sourceChipOf(idea) };
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
  // The row before is a row of an EARLIER session, never this one (review B3-A04: a close landing during the read once
  // made a row its own "previous", a $0.00 day under the old date). The reader picks it so; the view holds it too.
  const prev = isPlain(rows.prev) && isDate(rows.prev.date) && session !== null && rows.prev.date < session ? rows.prev : null;
  const entered = idea.entry?.sessionDate ?? null;
  const boughtThisSession = entered !== null && entered === session;
  const boughtAfterClose = entered !== null && (session === null || entered > session);
  const lastAllot = allotCents(last);
  const prevAllot = allotCents(prev);
  // B3-A01: the one ledger test, on both rows — the last with the idea itself (written by that close), the one before
  // from its row alone, carefully (ledgerHeld says why).
  const lastHeld = ledgerHeld(last, idea);
  const prevHeld = ledgerHeld(prev);
  const names = symbolsOf(idea).map((sym) => nameView(idea, sym, { last, prev, lastAllot, prevAllot, session, boughtThisSession, boughtAfterClose, lastHeld, prevHeld }));
  const due = idea.contract?.schedule?.dueSession ?? null;
  // Bought at a window after the last close: held, with no close mark yet.
  if (!last || boughtAfterClose) {
    return { ...common, state: 'holding', line: GROUP_LINES.boughtToday, gap: null, call: null, names, namesText: names.map((n) => n.symbol).join(' · ') };
  }
  const left = Math.min(sessions, Math.max(0, sessionsLeftOf(session, due) ?? sessions));
  const day = sessions - left;
  const out = {
    ...common,
    state: idea.status === IDEA_STATUS.SETTLED ? 'selling' : 'holding',
    // Q-3 as agreed (B3-A08): the close of the session it entered reads "Entered today · N sessions"; `day` stays numeric.
    line: boughtThisSession ? GROUP_LINES.enteredToday(sessions) : GROUP_LINES.day(day, sessions),
    day, of: sessions, sessionsLeft: left, sessionsLeftText: GROUP_LINES.sessionsLeft(left), progress: sessions > 0 ? day / sessions : 0,
    gap: gapOf(last, idea.contract, session, lastHeld),
    call: callOf(ctx.deskParts[desk], idea.ideaId, desk, session, ctx.names),
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
function settledTodayGroupOf(slot, f, names) {
  const idea = f.idea;
  const desk = deskOfIdea(idea) ?? deskOfSlot(slot);
  const sessions = sessionsOfIdea(idea, slot);
  const soldNames = symbolsOf(idea).map((sym) => {
    const line = (idea.lines || []).find((l) => upper(l.symbol) === sym) || null;
    const entry = line && (line.adjustments || []).length === 0 ? priceText(line.fillPrice ?? null) : null;
    return { symbol: sym, isNew: false, mark: null, entry, line: priceText(line?.level ?? null), ...soldSentence(idea, sym) };
  });
  return {
    slot, slotName: SLOT_NAMES[slot], slotLabel: `${SLOT_NAMES[slot]} · ${sessions} sessions`, desk, deskName: deskLabel(names, desk),
    state: 'settled_today', line: GROUP_LINES.settledToday,
    gap: f.view.notMeasurable ? { notMeasurable: NOT_MEASURABLE } : f.view.gap,
    // The manager's exit is a past call here (made at its endpoint), never today's.
    thesis: thesisOf(idea, names), source: sourceChipOf(idea), call: null, lastCall: f.view.lastCall, names: soldNames,
    namesText: soldNames.map((n) => n.symbol).join(' · '),
  };
}

// ── THE STRIP ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One line per desk for the last close, ONLY for a desk that checked the book at that close (its part on the close row says
 * the model wrote, or the check failed): what it held, the exits it called, what it admitted and passed on, or the failed
 * check — and, as code's facts of that session in the desk's lane, its OWN ideas bought at the window (an idea the desk
 * drafted: `contract.desk`) and its names sold at their lines ("by code"). With the agent off, a paused book, or a desk with
 * no work, nothing is credited to a desk: no line (a founder's idea is never "opened" by a desk). A desk with nothing to say
 * has no line.
 */
export function deriveStrip({ session, deskParts, ideas, finishedIdeas, rows = new Map(), names = deskNamesOf() }) {
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
    const checked = part?.source === AGENT_NOTE_SOURCE.MODEL || part?.source === AGENT_NOTE_SOURCE.CODE_FALLBACK;
    if (!checked) continue;
    const mine = all.filter((i) => deskOfIdea(i) === desk);
    const words = [];
    const opened = mine.filter((i) => i.entry?.sessionDate === session && i.contract?.desk === desk).flatMap(symbolsOf);
    if (opened.length > 0) words.push(STRIP.opened(opened));
    const failed = part.source === AGENT_NOTE_SOURCE.CODE_FALLBACK;
    if (!failed) {
      const admitted = (part.considered || []).filter((c) => c?.outcome === 'admitted').flatMap((c) => (c.names || []).map(upper));
      if (admitted.length > 0) words.push(STRIP.admitted(admitted));
      // Held: the desk's own holds only. An Exit code did not carry out is NOT a hold (review B3-A11): the desk asked to
      // sell; it is said below as an Exit not carried out, and its names are counted there, never twice.
      const heldIds = new Set((part.actions || []).filter((a) => a?.action !== 'exit' && a?.outcome === 'held').map((a) => a.ideaId));
      // (An idea bought at this session's window is said as opened, not held again: the mock-up's state 3.)
      const held = mine.filter((i) => heldIds.has(i.ideaId) && i.entry?.sessionDate !== session).reduce((n, i) => n + heldAtClose(i).length, 0);
      if (held > 0) words.push(STRIP.held(held));
      const exitIds = new Set((part.actions || []).filter((a) => a?.action === 'exit' && a?.outcome === 'exit_settled').map((a) => a.ideaId));
      const exited = mine.filter((i) => exitIds.has(i.ideaId)).flatMap(heldAtClose);
      if (exited.length > 0) words.push(STRIP.exit(exited));
      const notCarriedIds = new Set((part.actions || []).filter((a) => a?.action === 'exit' && a?.outcome !== 'exit_settled').map((a) => a.ideaId));
      // (An idea with no name held at the close — an Exit on one not bought yet — has nothing to name: no part.)
      const notCarried = mine.filter((i) => notCarriedIds.has(i.ideaId)).flatMap(heldAtClose);
      if (notCarried.length > 0) words.push(STRIP.exitNotCarried(notCarried));
    }
    const sold = mine.flatMap((i) => (i.ledger?.saleReceipts || []).filter((r) => r?.kind === 'line_exit' && r?.sessionDate === session).map((r) => upper(r.symbol)));
    if (sold.length > 0) words.push(STRIP.soldAtLine(sold));
    if (!failed) {
      const passed = (part.considered || []).filter((c) => c?.outcome === 'refused' || c?.outcome === 'not_chosen').length;
      if (passed > 0) words.push(STRIP.passedOn(passed));
    }
    if (failed) out.push({ desk, deskName: deskLabel(names, desk), failed: true, text: [FAILED_CHECK.strip, ...words].join(STRIP.sep) });
    else if (words.length > 0) out.push({ desk, deskName: deskLabel(names, desk), failed: false, text: words.join(STRIP.sep) });
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

function desksOf({ session, deskParts, groups, archetypeName, looks, names }) {
  return DESK_ORDER.map((desk) => {
    const part = deskParts[desk];
    const lane = desk === 'archetype' && str(archetypeName) ? `${archetypeName} · ${DESK_LANES[desk]}` : DESK_LANES[desk];
    let note = null;
    if (part?.source === AGENT_NOTE_SOURCE.CODE_FALLBACK) note = { failed: true, text: FAILED_CHECK.sentence(deskLabel(names, desk)), date: dayLabel(session) };
    else if (part?.source === AGENT_NOTE_SOURCE.MODEL && str(part.note)) note = { failed: false, text: part.note, date: dayLabel(session) };
    const calls = groups.filter((g) => g.desk === desk).map((g) => {
      const row = { slot: g.slot, slotName: g.slotName, namesText: g.namesText ?? null };
      if (g.state === 'open') return { ...row, state: 'open', text: OPEN_SLOT.desks(names[desk].name, looks) };
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
    return { desk, deskName: deskLabel(names, desk), lane, note, calls, passed: considered.length > 0 ? { tally, drafts: considered } : null };
  });
}

// ── HISTORY ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Is a finished idea's result packet whole (B2 §8: its own hash AND its receipt parts) and THIS idea's (its book and idea
 * ids, and each part's, are the ones it is read under — review A2: a validly sealed packet of another idea is refused)? Pure.
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function packetCheck(packet, parts, { bookId = null, ideaId = null } = {}) {
  if (!isPlain(packet)) return { ok: false, problems: ['packet:missing'] };
  const problems = [];
  if (!verifyPacket(packet)) problems.push('packet:hash');
  problems.push(...resultPacketPartProblems(packet, parts || {}));
  if (!isPlain(packet.result)) problems.push('packet:result_missing');
  if (packet.bookId !== bookId || packet.ideaId !== ideaId) problems.push('packet:not_this_idea');
  for (const [id, doc] of Object.entries(parts || {})) {
    if (isPlain(doc) && (doc.bookId !== bookId || doc.ideaId !== ideaId)) problems.push(`part:${id}:not_this_idea`);
  }
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

/**
 * One finished idea for History (and for its slot's "settled today" group). `bookId`: the book it is read under; `names`: the
 * desks' names (B5-3; deskNamesOf).
 */
export function finishedView(f, { bookId = null, names = deskNamesOf() } = {}) {
  const idea = f.idea;
  const slot = idea?.contract?.slot ?? null;
  const desk = deskOfIdea(idea) ?? deskOfSlot(slot);
  const check = packetCheck(f.packet, f.parts, { bookId, ideaId: idea?.ideaId ?? null });
  const result = check.ok ? f.packet.result : null;
  const kind = result?.endpointKind ?? null;
  const sessions = sessionsOfIdea(idea, slot);
  const ended = (ENDED_WORDS[kind] ?? ENDED_UNKNOWN)(sessions);
  const base = {
    namesText: (idea?.contract?.names || []).map(upper).join(' · '),
    slot, slotName: SLOT_NAMES[slot] ?? null, slotLabel: slot ? `${SLOT_NAMES[slot]} · ${sessions} sessions` : null,
    desk, deskName: deskLabel(names, desk),
    // The day it finished: its last sale filled (the liquidation), else its endpoint.
    ended, endedOn: dayLabel(idea?.liquidation?.completedSession ?? result?.endpointSession ?? idea?.endpoint?.session ?? null),
    thesis: idea ? thesisOf(idea, names) : null,
    source: sourceChipOf(idea),
  };
  const managerExit = result?.managerExit ?? null;
  const exitDesk = managerExit ? deskLabel(names, managerExit.desk) : null;
  const lastCall = managerExit && str(managerExit.reason) && exitDesk !== null
    ? { kind: 'Exit', text: managerExit.reason, deskName: exitDesk, date: dayLabel(managerExit.session) }
    : null;
  if (!check.ok) return { ...base, gap: null, notMeasurable: { reasons: [EVIDENCE_UNCHECKED] }, columns: null, lastCall: null };
  const econ = result.economic || {};
  const gap = Number.isFinite(econ.gapUsd)
    ? { ...signedAmount(toCents(econ.gapUsd)), pct: pctText(econ.gapPctOfReserved), vs: comparisonName(idea.contract) }
    : null;
  const notMeasurable = result.economicResult === 'unmeasurable' ? { reasons: unmeasurableReasons(result) } : null;
  // A result that cannot be measured shows no gap anywhere: not in the list, not under its Result column (review B1).
  return { ...base, gap: notMeasurable ? null : gap, notMeasurable, columns: columnsOf(result, notMeasurable ? null : gap), lastCall };
}

// ── THE SPLIT (B5-2) ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The desk ids in the split's order, each with the split's key for it (the agent's desk, then the archetype's). */
const SPLIT_DESKS = Object.freeze([['agent', 'shadow'], ['archetype', 'archetype']]);

/**
 * The book's shares, in whole millionths, from the epoch it runs under: each desk's the sum of its slots' caps
 * (`rails.slotCapShare`, each slot to its desk by deskOfSlot), cash's the cash floor (`gateConfig.cashFloorPct`). Null when
 * the epoch is missing, a share does not read as a decimal of at most six places in (0, 1] (money.js weightPpm), a slot
 * belongs to no desk, or the three do not sum to exactly 1. Pure.
 * @returns {{ shadow: number, archetype: number, cash: number } | null}
 */
export function epochSharesOf(epoch) {
  const caps = epoch?.rails?.slotCapShare;
  if (!isPlain(caps)) return null;
  const out = { shadow: 0, archetype: 0, cash: weightPpm(epoch?.gateConfig?.cashFloorPct) };
  if (out.cash === null) return null;
  for (const [slot, share] of Object.entries(caps)) {
    const desk = deskOfSlot(slot);
    const ppm = weightPpm(share);
    if (desk === null || ppm === null) return null;
    out[desk] += ppm;
  }
  return out.shadow + out.archetype + out.cash === WEIGHT_PPM_TOTAL ? out : null;
}

const shareOf = (ppm) => ({ text: `${PCT_SHARE.format((ppm * 100) / WEIGHT_PPM_TOTAL)}%`, number: ppm / WEIGHT_PPM_TOTAL });

/**
 * The split (the header's B5-2): the agent's desk, the archetype's desk and cash, each with its finished name and its share;
 * each desk with its use at the last close — or none while the book line waits (`lineWaits`). Pure.
 * @param {object} p
 * @param {object|null} p.epoch            the epoch the book runs under
 * @param {object[]} p.ideas               the book's ideas (its slots and open set)
 * @param {Map<string,{last}>} p.rows      each idea's row at the last close
 * @param {Array<{ idea, atClose? }>} p.finished   finished ideas; `atClose`: an idea finished SINCE the last close, its row there
 * @param {string|null} p.session          the last close
 * @param {number} p.valueCents            the book's marked value — the headline's own cents
 * @param {boolean} p.lineWaits            the book line waits (B3-11)
 * @param {object} p.names                 the desks' names (deskNamesOf)
 */
export function deriveSplit({ epoch, ideas = [], rows = new Map(), finished = [], session = null, valueCents, lineWaits = false, names = deskNamesOf() }) {
  const shares = epochSharesOf(epoch);
  if (!shares) return null;
  // Each desk's positions at the last close: every idea row of that session, by the allotment the names' values use.
  const used = { shadow: 0, archetype: 0 };
  const seen = new Set();
  const count = (idea, row) => {
    const desk = deskOfIdea(idea);
    if (desk === null || seen.has(idea?.ideaId) || !isPlain(row) || row.date !== session) return;
    seen.add(idea.ideaId);
    for (const c of allotCents(row).values()) used[desk] += c;
  };
  for (const idea of ideas) count(idea, rows.get(idea.ideaId)?.last);
  for (const f of finished) count(f?.idea, f?.atClose);
  const parts = SPLIT_DESKS.map(([key, desk]) => {
    const ofCents = weightedCents(valueCents, shares[desk]);
    const use = lineWaits ? null : {
      amount: amountText(used[desk]),
      of: amountText(ofCents),
      pct: ofCents > 0 ? `${PCT_WHOLE.format((used[desk] * 100) / ofCents)}%` : null,
      bar: ofCents > 0 ? Math.min(1, used[desk] / ofCents) : 0,
    };
    return { key, desk, name: names[desk].name, share: shareOf(shares[desk]), use };
  });
  return { parts: [...parts, { key: 'cash', name: SPLIT_CASH_NAME, share: shareOf(shares.cash) }] };
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
 * @param {{ session: string, inception: object }|null} input.firstEntry   the book's first FILL (the idea with the earliest
 *                                       `entry.filledAt`, B3-A03): its entry session and its inception row (`rows/inception`,
 *                                       the entry's fills and their quotes)
 * @param {boolean} input.agentOn       practiceFieldAgentOn(): do the desks look tonight?
 * @param {{ codeId: string, name: string|null }|null} input.archetype   B5-1: the archetype the book runs under (its epoch's
 *                                       code id, the registry's display name), or null with no epoch
 * @param {object|null} input.epoch      B5-2: the epoch the book runs under (its slot caps and cash floor), or null
 * @param {string|null} input.agentName  B5-3: the book's attribution agent's name — only when that agent is the caller's own
 *                                       (the reader checks); plainGivenName decides whether it can be shown
 */
export function buildBookView({ book, ideas = [], rows = new Map(), dailyRows = {}, closeRow = null, finished = [], firstEntry = null, agentOn = false, archetype = null, epoch = null, agentName = null }) {
  const archetypeOut = isPlain(archetype) && str(archetype.codeId) ? { codeId: archetype.codeId, name: str(archetype.name) } : null;
  const archetypeName = archetypeOut?.name ?? null;
  const names = deskNamesOf({ agentName, archetypeName });
  const lastRow = isPlain(dailyRows.last) ? dailyRows.last : null;
  const session = isDate(book?.execState?.lastCloseKey) ? book.execState.lastCloseKey : (lastRow?.date ?? null);
  const last = lastRow && lastRow.date === session ? lastRow : null;
  const prev = last && isPlain(dailyRows.prev) && dailyRows.prev.date < session ? dailyRows.prev : null;
  const paused = book?.drafting === 'paused';
  const windingDown = book?.status === 'draining' || isPlain(book?.windDown);
  const looks = agentOn === true && !paused && !windingDown;
  const deskParts = { shadow: deskPartOf(closeRow, 'shadow'), archetype: deskPartOf(closeRow, 'archetype') };
  const byId = new Map(ideas.map((i) => [i.ideaId, i]));
  const finishedViews = finished.map((f) => ({ ...f, view: finishedView(f, { bookId: book?.bookId ?? null, names }) }));

  // The groups, one per slot in order.
  const ctx = { session, rows, deskParts, looks, names };
  const groups = PRACTICE_FIELD_SLOT_NAMES.map((slot) => {
    const id = book?.slots?.[slot] ?? null;
    const idea = typeof id === 'string' ? byId.get(id) ?? null : null;
    if (idea) return groupOf(slot, idea, ctx);
    const today = finishedViews.find((f) => f.idea?.contract?.slot === slot && f.idea?.liquidation?.completedSession === session && session !== null);
    return today ? settledTodayGroupOf(slot, today, names) : groupOf(slot, null, ctx);
  });

  // The book line.
  // Ruling B3-11 (review B3-A02): the last close's row below full quality — an unobserved close, a first close with no row
  // before it, or any other — holds the line: the headline waits, with one fixed reason, and today's change, since open
  // and SPY show no figure. Cash shows, from the row's own stored fields. A book with no row yet keeps its line.
  const lineWaits = last !== null && last.fullQuality !== true;
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
  // SPY since the book opened (B3-6), from the book's own records: SPY's quote at the book's FIRST fill (the first entered
  // idea's inception row, its SPY leg — the same window the book's first money went in, which "since" measures from) to its
  // vendor-timed close mark at the last close (the first idea row there with a clean one). Either missing: a dash.
  let spy = { label: 'SPY', value: '—' };
  const startLeg = (firstEntry?.inception?.legs?.spy || []).find((r) => upper(r?.symbol) === PRACTICE_FIELD_BENCHMARK_SYMBOL) ?? null;
  const startMark = startLeg && Number(startLeg.mark) > 0 && typeof startLeg.markVendorTimeIso === 'string' ? startLeg.mark : null;
  const nowMark = ideas.map((i) => rows.get(i.ideaId)?.last?.date === session ? rows.get(i.ideaId).last.spyMarks?.[PRACTICE_FIELD_BENCHMARK_SYMBOL] : null)
    .find((m) => m && m.quality === MARK_QUALITY.VENDOR_TIME && Number(m.mark) > 0)?.mark ?? null;
  if (startMark !== null && nowMark !== null && first?.kind === 'since' && !lineWaits) {
    const pct = pctText(((nowMark - startMark) * 100) / startMark);
    spy = { label: 'SPY', value: pct, since: dayLabel(firstEntry.session) };
  }
  const line = {
    value: lineWaits ? null : moneyText(valueCents),
    waiting: lineWaits ? { text: BOOK_WAITING, reason: BOOK_WAITING_REASON } : null,
    today: last && !lineWaits ? deriveToday(last, prev) : null,
    first: lineWaits && first?.kind === 'since' ? { ...first, value: '—', dir: 0 } : first,
    spy,
    cash: moneyText(cashCents),
    paused,
    windingDown,
    statusLine: paused ? PAUSED_LINE : windingDown ? WINDING_DOWN_LINE : null,
    smallPrint: PAPER_MONEY,
  };

  // The strip says what each desk did AT the last close, so it reads what each idea held there: an idea finished since that
  // close (its sale filled at a later window) by its row of that close, as the split does (review A2) — never by its holdings
  // as the later window left them.
  const stripRows = new Map(rows);
  for (const f of finished) if (isPlain(f?.atClose) && typeof f.idea?.ideaId === 'string' && !stripRows.has(f.idea.ideaId)) stripRows.set(f.idea.ideaId, { last: f.atClose, prev: null });

  const held = groups.some((g) => g.state === 'holding' || g.state === 'selling');
  const asOf = last && held
    ? { session: dayLabel(session), text: last.observed === false ? MARKS_AS_OF_UNOBSERVED(dayLabel(session)) : MARKS_AS_OF(dayLabel(session)) }
    : null;

  return {
    version: BOOK_VIEW_VERSION,
    archetype: archetypeOut,
    day: weekdayLabel(session),
    asOf,
    line,
    split: deriveSplit({ epoch, ideas, rows, finished, session, valueCents, lineWaits, names }),
    strip: deriveStrip({ session, deskParts, ideas, finishedIdeas: finished.map((f) => f.idea).filter(Boolean), rows: stripRows, names }),
    groups,
    cash: moneyText(cashCents),
    desks: desksOf({ session, deskParts, groups, archetypeName, looks, names }),
    history: { empty: NO_FINISHED_IDEAS, items: finishedViews.map((f) => f.view) },
  };
}
