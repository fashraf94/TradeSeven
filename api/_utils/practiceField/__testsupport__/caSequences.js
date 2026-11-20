// api/_utils/practiceField/__testsupport__/caSequences.js
//
// Practice Field T1a-2b-3, fix round 2 — THE S-6 HARNESS (Amendment F revision 1), shared by
// corporateActionSequences.test.js (48 seeded histories, Astra's 15 reproductions) and corporateActionSequences.soak.test.js
// (thousands of wide histories). Test support only: never imported by a production path. See the test file's header for
// the invariants (I-1 to I-5) and the oracle.

import { expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from '../mode.js';
import { assertReconciled } from '../reconcile.js';
import { closeIdeaBook, catchUpIdeaBook } from '../close.js';
import { parseSplitsPayload, parseDividendsPayload, applyCorporateAction, deriveActionId } from '../../mandateCorporateActions.js';
import { openAmbiguities, CONFLICTING_ACTION, POSSIBLE_REDATE } from '../ledger.js';
import { addUsd } from '../money.js';
import { nextSessionDate } from '../windows.js';
import { InputOracle, EntitlementOracle } from './caOracle.js';
import { roundUsd } from '../../mandateRounding.js';
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, getRow, closeNowOf, storeCloseSnapshot, founderRules, takeSeededDbs,
  vendorAnswering, CLEAN_PARSE_ENTRY, windowAt, storeParseReport, omitParseReport,
} from './fixtures.js';

export const S = ['2026-11-16'];
while (S.length < 40) S.push(nextSessionDate(S.at(-1)));
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];
const SHARE_BASIS = new Set(['split', 'reverse_split', 'stock_distribution']);
const WINDOW = 5; // the daily layer lists rows dated within this many sessions back (and the re-date window)

/** mulberry32: a small seeded PRNG. */
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n), pick: (xs) => xs[Math.floor(next() * xs.length)], chance: (p) => next() < p };
}

// Forward splits only: a revision keeps the row's type (a parser that read 1/2 would make it a reverse split's id).
const RATIOS = ['2/1', '3/2', '5/4', '3/1'];
const AMOUNTS = [0.5, 0.75, 1, 1.25, 1.5, 2];
/** A vendor row for `sym` as the parsers emit it. */
const rowOfSym = (sym, type, date, payload) => (type === 'cash_dividend'
  ? parseDividendsPayload(sym, [{ date, unadjustedValue: payload }]).actions[0]
  : parseSplitsPayload(sym, [{ date, split: payload }]).actions[0]);
const rowOf = (type, date, payload) => rowOfSym('AAPL', type, date, payload);
const ratioOf = (v) => { const [n, d] = v.split('/').map(Number); return n / d; };

/**
 * THE GENERATOR. A history is a list of steps over sessions 0…n-1: the feed's state (`feed`: id → { type, date, payloads })
 * changes by events, and each close lists every feed row dated within the window. `clean` histories use only one-payload
 * dividends and splits (never two of one kind and payload in the window), covered, with prices that follow the splits.
 */
export function generate(seed) {
  const r = rng(seed);
  const clean = r.chance(0.35);
  const n = 6 + r.int(4);
  const feed = new Map(); // id → { type, date (index), payloads: [] }
  const steps = [];
  const kinds = new Set();
  let shapeFactor = 1; // split-shaped price moves no row explains
  // THE ORACLE'S OWN RECORD (AR2-C test integrity): every id the FEED made ambiguous, and the session it did — two
  // payloads under it, a revision, a re-date, a backfill disagreeing. Kept by the generator, not read from the product.
  const ambiguousSince = {};
  const markAmbiguous = (id, i) => { if (!(id in ambiguousSince)) ambiguousSince[id] = i; };
  let at = 0; // the session the generator is writing
  const add = (type, i, payload) => {
    const row = rowOf(type, S[i], payload);
    const id = deriveActionId(row);
    const e = feed.get(id) || { type, date: i, payloads: [], createdAt: at, first: payload };
    if (!e.payloads.includes(payload)) e.payloads.push(payload);
    // (Ambiguous to the LEDGER only while unsettled: a second payload for an id first listed at an earlier close — which
    // may have settled it — is a vendor correction of a settled id, T2D-05's class, carried; not marked here.)
    if (e.payloads.length > 1 && (e.createdAt === at || id in ambiguousSince)) markAmbiguous(id, at);
    feed.set(id, e);
    return id;
  };
  // C01's chain: an ex-date conflict, a payload added to it a session later, then that NEW payload re-dated.
  let c01 = null;
  // C04's chain: an unexplained halving, then an uncovered close with a second halving, the 2:1 that explains the first
  // and a dividend dated there, then the recovery.
  const c04At = !clean && r.chance(0.3) ? 1 + r.int(Math.max(1, n - 3)) : -1;
  const recentSame = (type, payload, i) => [...feed.values()].some((e) => e.type === type && e.payloads.includes(payload) && Math.abs(e.date - i) <= WINDOW);
  const priceAt = (i) => {
    // The market price follows every split dated after the entry (the first listed payload of each), times any unexplained move.
    let p = 100;
    for (const e of feed.values()) if (SHARE_BASIS.has(e.type) || e.type === 'split') if (e.date > 0 && e.date <= i) p /= ratioOf(e.payloads[0]);
    return Math.round(p * shapeFactor * 100) / 100;
  };
  if (r.chance(0.3)) { // a purchase on an ex-date (Q10's class)
    const type = r.chance(0.5) ? 'cash_dividend' : 'split';
    add(type, 0, type === 'cash_dividend' ? r.pick(AMOUNTS) : r.pick(RATIOS));
    kinds.add('purchase_on_ex_date');
    if (!clean && r.chance(0.5)) {
      const id = add(type, 0, type === 'cash_dividend' ? r.pick(AMOUNTS) : r.pick(RATIOS));
      kinds.add('conflict');
      if (feed.get(id).payloads.length > 1 && r.chance(0.6)) c01 = { id, type };
    }
  }
  for (let i = 0; i < n; i += 1) {
    at = i;
    const ev = r.next();
    if (c01 && i === 1) { // the conflict's id listed with a payload it has not had
      const e = feed.get(c01.id);
      const pool = c01.type === 'cash_dividend' ? AMOUNTS : RATIOS;
      const p = pool.find((x) => !e.payloads.includes(x));
      if (p !== undefined) { e.payloads = [e.payloads[0], p]; c01.fresh = p; kinds.add('c01_chain'); }
    }
    if (c01?.fresh !== undefined && i === 2) { add(c01.type, 2, c01.fresh); markAmbiguous(deriveActionId(rowOf(c01.type, S[2], c01.fresh)), 2); }
    if (i > 0 && ev < 0.25) {
      const type = 'cash_dividend';
      const amount = r.pick(AMOUNTS);
      const dated = i - r.int(2); // listed on its date, or one session late
      // (A clean history never has two of one kind and payload within the window — measured from the row's own date.)
      if (!clean || !(recentSame(type, amount, dated) || recentSame(type, amount, i))) { add(type, dated, amount); kinds.add('dividend'); }
    } else if (i > 0 && ev < 0.4) {
      const ratio = r.pick(RATIOS);
      if (!clean || !recentSame('split', ratio, i)) { add('split', i, ratio); kinds.add('split'); }
    }
    if (!clean && i > 0) {
      // (Only an id a close has already listed: one first listed now with a single payload was never ambiguous.)
      const ids = [...feed.keys()].filter((id) => i - feed.get(id).date <= WINDOW && feed.get(id).createdAt < i);
      const z = r.next();
      if (z < 0.15) { // a conflict: a new id listed two ways
        const type = r.chance(0.5) ? 'cash_dividend' : 'split';
        const pool = type === 'cash_dividend' ? AMOUNTS : RATIOS;
        const a = r.pick(pool); let b = r.pick(pool); if (b === a) b = pool[(pool.indexOf(a) + 1) % pool.length];
        add(type, i, a); add(type, i, b); kinds.add('conflict');
      } else if (z < 0.3 && ids.length > 0) { // a revision: an id listed so far, with a payload it has not had
        const id = r.pick(ids); const e = feed.get(id);
        const pool = e.type === 'cash_dividend' ? AMOUNTS : RATIOS;
        const p = pool.find((x) => !e.payloads.includes(x));
        if (p !== undefined) { if (r.chance(0.5)) e.payloads = [p]; else e.payloads.push(p); if (id in ambiguousSince) markAmbiguous(id, i); kinds.add('revision'); }
      } else if (z < 0.45 && ids.length > 0) { // a re-date: one payload of a listed id under a new date (the old kept or dropped)
        const id = r.pick(ids); const e = feed.get(id);
        if (i > e.date) {
          // (A re-date the ledger can match: of a payload an ambiguous record of it holds, or of the id's first payload.)
          const pick = r.pick(e.payloads);
          const newId = add(e.type, i, pick);
          if (id in ambiguousSince || pick === e.first) markAmbiguous(newId, i);
          if (r.chance(0.5)) feed.delete(id);
          kinds.add('redate');
        }
      } else if (z < 0.52) { // a split-shaped move no row explains
        shapeFactor *= r.chance(0.5) ? 0.5 : 2; kinds.add('split_shaped_move');
      }
    }
    let priceNow = null;
    if (c04At >= 0 && i === c04At) { priceNow = priceAt(i) * 0.5; kinds.add('c04_chain'); }
    if (c04At >= 0 && i === c04At + 1) { add('split', c04At, '2/1'); add('cash_dividend', i, 1.5); priceNow = priceAt(i) * 0.5; }
    const uncovered = (!clean && i > 0 && r.chance(0.18)) || (c04At >= 0 && i === c04At + 1);
    if (uncovered) kinds.add('coverage_failure');
    const listed = [];
    for (const [, e] of feed) if (i - e.date >= 0 && i - e.date <= WINDOW) for (const p of e.payloads) listed.push(rowOf(e.type, S[e.date], p));
    // A catch-up: this session (and the next one) archived without a close, then closed by the catch-up with a stored
    // backfill that agrees with the archive or disagrees with it on one row.
    if (!clean && i > 1 && i < n - 1 && i !== c04At && i !== c04At + 1 && r.chance(0.15)) {
      const mode = listed.length > 0 && r.chance(0.6) ? 'disagree' : 'agree';
      let backfill = listed.map((a) => ({ ...a }));
      if (mode === 'disagree') {
        const k = r.int(backfill.length);
        const a = backfill[k];
        backfill[k] = a.type === 'cash_dividend' ? { ...a, amount: AMOUNTS.find((x) => x !== a.amount) } : { ...a, ratio: ratioOf(RATIOS.find((x) => ratioOf(x) !== a.ratio)) };
        if (feed.get(deriveActionId(a))?.createdAt === i || deriveActionId(a) in ambiguousSince) markAmbiguous(deriveActionId(a), i);
      }
      if (r.chance(0.3)) backfill = [];
      steps.push({ kind: 'catchup', i, price: priceAt(i), rows: listed, backfill, mode });
      kinds.add(mode === 'disagree' ? 'backfill_disagrees' : 'backfill_agrees');
      continue;
    }
    steps.push({ kind: 'close', i, price: priceNow === null ? priceAt(i) : Math.round(priceNow * 100) / 100, rows: listed, uncovered });
    if (!clean && r.chance(0.35)) { steps.push({ kind: 'rule', pick: r.next(), decision: r.next() }); kinds.add('founder_ruling'); }
  }
  return { seed, clean, steps, kinds: [...kinds], feed, ambiguousSince };
}

// (T1a-2b-4: XLK too, for the late generator's sector-fund comparison — a symbol no older plan holds.)
const quotes = (p, rows) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: rows }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
/** A step's quotes: a narrow plan's AAPL price and rows, or a wide plan's per-symbol prices and rows (AAPL and SPY). */
const quotesOf = (step) => {
  if (!step.prices) return quotes(step.price, step.rows);
  return {
    AAPL: { price: step.prices.AAPL, marketCap: 3e12, corporateActions: step.rowsBySym.AAPL || [] },
    MSFT: { price: 200, marketCap: 3e12 },
    SPY: { price: step.prices.SPY, corporateActions: step.rowsBySym.SPY || [] },
    XLK: { price: 200 },
  };
};
const money = (c) => {
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  const book = getBook(c.db, c.bookId);
  return JSON.stringify({
    ledgers: LEDGERS.map((f) => ({ cash: idea[f].cash, dividends: idea[f].dividendsUsd, shares: Object.fromEntries(Object.entries(idea[f].holdings).map(([s, h]) => [s, h.shares])), applied: [...idea[f].appliedActionIds].sort(), declined: [...idea[f].declinedActionIds].sort() })),
    book: { cash: book.portfolio.cash, shares: Object.fromEntries(Object.entries(book.portfolio.positions).map(([s, p]) => [s, p.shares])) },
  });
};

/** T1a-2b-4: how many histories generated as clean carried a vendor correction of a settled id (reclassified; see run). */
export const reclassifiedAsCorrected = { count: 0 };

/** What the generated histories actually REACHED in the product (counted, asserted at the end). */
export const reached = { payloadAddedLater: 0, redateOfAmbiguous: 0, uncoveredTransition: 0, revisedAfterRuling: 0 };
/** Which product paths one finished history reached, on any ledger (counted into `into`). */
export function pathsReached(idea, into = reached) {
  const all = LEDGERS.map((f) => idea[f]).filter(Boolean);
  const records = all.flatMap((l) => l.corporateActionReceipts.filter((r) => r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE));
  const hit = {};
  if (records.some((r) => r.lastRevisedOn)) hit.payloadAddedLater = 1;
  const ambiguousIds = new Set(records.map((r) => r.actionId));
  if (records.some((r) => r.reason === POSSIBLE_REDATE && ambiguousIds.has(r.redateOf))) hit.redateOfAmbiguous = 1;
  for (const l of all) {
    for (const h of Object.values(l.holdings || {})) {
      const transitions = [...(h?.basisSuspicion?.transitions || []), ...(h?.basisSuspicionHistory || []).flatMap((x) => x.transitions || [])];
      if (transitions.some((t) => t.uncovered) || (h?.basisSuspicion && h.basisSuspicion.raisedBy?.explainedBy)) hit.uncoveredTransition = 1;
    }
  }
  if (all.some((l) => l.corporateActionReceipts.some((r) => r.reason === 'revised_after_ruling'))) hit.revisedAfterRuling = 1;
  for (const k of Object.keys(hit)) into[k] = (into[k] || 0) + 1;
  return hit;
}
function tallyReached(idea) { pathsReached(idea, reached); }

/** Every invariant that holds after every close (I-1, I-2, I-3). `oracle`: the generator's own record of ambiguous ids. */
function checkAfterClose(c, date, oracleSince = null, tied = true, inputs = null, initialOf = null, label = '') {
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  const book = getBook(c.db, c.bookId);
  // I-3: the book reconciles to its ideas, and the same-stock comparison is tied to the idea (no fill is ever made here).
  assertReconciled(book, book.openIdeaIds.map((id) => getIdea(c.db, c.bookId, id)));
  if (tied) {
    for (const sym of Object.keys(idea.ledger.holdings)) expect(idea.comparisonLedger.holdings[sym]?.shares, `${date} I-3 ${sym}`).toBe(idea.ledger.holdings[sym].shares);
    expect(idea.comparisonLedger.dividendsUsd, `${date} I-3 dividends`).toBe(idea.ledger.dividendsUsd);
  }
  for (const f of LEDGERS) {
    const l = idea[f];
    // I-1
    const declined = new Set(l.declinedActionIds);
    expect(l.appliedActionIds.filter((id) => declined.has(id)), `${date} I-1 ${f}`).toEqual([]);
    // I-2: an id that ever became ambiguous settles only by the founder.
    const ever = new Set(l.corporateActionReceipts.filter((r) => r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE).map((r) => r.actionId));
    for (const id of ever) {
      for (const x of l.corporateActionReceipts.filter((r) => r.actionId === id && r.applied === true)) expect(x.founderRuling, `${date} I-2 ${f} ${id} applied without a ruling`).toBeTruthy();
      if (declined.has(id)) expect(l.corporateActionReceipts.some((r) => r.actionId === id && r.applied === false && r.founderRuling), `${date} I-2 ${f} ${id} declined without a ruling`).toBe(true);
      for (const h of Object.values(l.holdings)) for (const rec of h.heldActions || []) if (rec.actionId === id && !declined.has(id) && !l.appliedActionIds.includes(id)) expect(rec.founderRuling, `${date} I-2 ${f} ${id} replayable`).toBeTruthy();
    }
  }
  // (A resulted idea writes no row: what still waits on it is named on the idea instead — lateDataUnsettled.)
  if (idea.status !== 'resulted' && LEDGERS.some((f) => openAmbiguities(idea[f]).length > 0)) expect(getRow(c.db, c.bookId, c.ideaId, date).fullQuality, `${date} I-2 quality`).toBe(false);
  // I-2 against the ORACLE (not the product's own predicate): an id the feed made ambiguous at session s moves cash or
  // shares at a close on or after s only by an ACCEPTED CONFLICT ruling the harness made for it, choosing the moved payload
  // (final fix, Astra round 2: before, any truthy `founderRuling` — a `suspicion` one included — passed).
  for (const [id, since] of Object.entries(oracleSince || {})) {
    for (const f of LEDGERS) {
      for (const x of idea[f].corporateActionReceipts.filter((r) => r.actionId === id && r.applied === true && r.appliedOn >= S[since])) {
        expect((inputs ? inputs.authorizing(id, inputs.keyOf(x)) : null), `${date} I-2 oracle ${f} ${id} (ambiguous since ${S[since]}) moved without an accepted conflict ruling choosing its payload`).not.toBeNull();
      }
    }
  }
  // …and the INDEPENDENT oracle: ambiguity derived from the emitted inputs alone, movement attributed by conservation.
  if (inputs) inputs.check(idea, date, label, initialOf);
}

/** Put a document in the fake store directly (a new one, or a new version of one): the harness plants state; no product write. */
function plant(db, path, data) {
  const prev = db._store.get(path);
  db._store.set(path, { data, version: (prev?.version ?? 0) + 1 });
}

/** I-5: the book's cursor put back one session and the close run again on the state it left — nothing more moves. */
async function rerunAdds(c, date, previous) {
  const before = money(c);
  const book = getBook(c.db, c.bookId);
  // (Written through the fake store's own map, as the fixtures' failed() does: test support adds no write site the
  // protected-store scan must allowlist.)
  plant(c.db, `mandates/${c.bookId}`, { ...book, execState: { ...book.execState, lastCloseKey: previous } });
  // (The close's window record is created once — T1a-2b-1's window ledger — so the re-run needs it gone; it holds no money.)
  for (const path of [...c.db._store.keys()]) if (path.startsWith(`mandates/${c.bookId}/windows/${date}`)) c.db._store.delete(path);
  const prior = getIdea(c.db, c.bookId, c.ideaId);
  await closeIdeaBook(c.db, c.bookRef, { date, now: closeNowOf(date) });
  // (The re-run must actually have closed the idea again, or the check proves nothing. A resulted idea is rewritten only
  // when something changes — the T1a-2b-4 fix round's 2011202706 — so the book's cursor is the proof there.)
  if (prior.status === 'resulted') expect(getBook(c.db, c.bookId).execState.lastCloseKey, `${date} I-5 re-ran`).toBe(date);
  else expect(getIdea(c.db, c.bookId, c.ideaId).revision, `${date} I-5 re-ran`).toBeGreaterThan(prior.revision);
  expect(money(c), `${date} I-5`).toBe(before);
}

/** The founder rules on one open record, chosen by `pick`, with a payload it holds (or `none`) chosen by `decision`. */
async function ruleSomething(c, pick, decision, splitOk = false) {
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  const open = [...new Map(LEDGERS.flatMap((f) => openAmbiguities(idea[f])).map((r) => [r.actionId, r])).values()];
  // (A suspicion on any ledger's holding — the idea's AAPL, or the SPY line's SPY in a wide history.)
  const suspicions = LEDGERS.flatMap((f) => Object.entries(idea[f].holdings || {}).filter(([, h]) => h?.basisSuspicion).map(([sym, h]) => ({ sym, s: h.basisSuspicion })));
  const suspicion = suspicions[0] ?? null;
  if (open.length === 0 && !suspicion) return null;
  if (open.length === 0 || (suspicion && pick < 0.2)) {
    // (`splitOk`, the ordered generator's rulings: a founder `split` at the record's own ratio half the time — D02's class.)
    const body = splitOk && decision < 0.5 && Number(suspicion.s.ratio) > 0
      ? { kind: 'suspicion', recordId: `suspected_split_${suspicion.sym}_${suspicion.s.suspectedOn}`, decision: 'split', ratio: Math.round((1 / Number(suspicion.s.ratio)) * 1e6) / 1e6 }
      : { kind: 'suspicion', recordId: `suspected_split_${suspicion.sym}_${suspicion.s.suspectedOn}`, decision: 'price_move' };
    const requestKey = `seq-${Math.round(pick * 1e9)}`;
    return { body, requestKey, out: await founderRules(c.db, c.bookId, c.ideaId, body, { requestKey, expectOk: false }) };
  }
  const r = open[Math.floor(pick * open.length)];
  const rows = Array.isArray(r.rows) && r.rows.length > 0 ? r.rows : [{ ratio: r.ratio ?? null, amount: r.amount ?? null }];
  const choice = r.reason === 'revised_after_ruling' ? null : rows[Math.floor(decision * (rows.length + 1))];
  const body = choice ? { decision: 'payload', payload: { ...(choice.ratio != null ? { ratio: choice.ratio } : {}), ...(choice.amount != null ? { amount: choice.amount } : {}) } } : { decision: 'none' };
  const ask = { kind: 'conflict', recordId: r.actionId, ...body };
  const requestKey = `seq-${Math.round(pick * 1e9)}`;
  return { body: ask, requestKey, out: await founderRules(c.db, c.bookId, c.ideaId, ask, { requestKey, expectOk: false }) };
}

/**
 * T1a-2b-4 fix round (L-1): THE FOUNDER DECIDES LATE PROPOSALS — the open proposal chosen by `pick` (by its action id), on
 * every ledger that has one for that id (a same-stock pair is decided together, so it stays tied), approved when
 * `decision` < 0.7 and declined otherwise. Returns the requests made, for the inputs.
 */
async function decideLate(c, pick, decision, n) {
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  const open = LEDGERS.flatMap((f) => (idea[f]?.lateProposals || []).filter((p) => p.status === 'open'));
  if (open.length === 0) return [];
  const ids = [...new Set(open.map((p) => p.actionId))].sort();
  const id = ids[Math.floor(pick * ids.length)];
  const out = [];
  for (const p of open.filter((x) => x.actionId === id)) {
    const body = { kind: 'late_adjustment', recordId: p.id, decision: decision < 0.7 ? 'approve' : 'decline' };
    const requestKey = `late-${n}-${p.id}`;
    out.push({ body, requestKey, out: await founderRules(c.db, c.bookId, c.ideaId, body, { requestKey, expectOk: false }) });
  }
  return out;
}

/** I-4's oracle: the engine's own applier over the history's final rows, in date order, with entitlement. */
function oracle(initialHolding, feed, sym = 'AAPL') {
  const actions = [];
  for (const [, e] of feed) {
    if ((e.sym ?? 'AAPL') !== sym) continue;
    const a = rowOfSym(sym, e.type, S[e.date], e.payloads[0]);
    actions.push({ ...a, actionId: deriveActionId(a) });
  }
  const phase = (a) => (SHARE_BASIS.has(a.type) ? 0 : 1);
  actions.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || phase(a) - phase(b) || a.actionId.localeCompare(b.actionId));
  let state = { positions: { [sym]: { ...initialHolding } }, cash: 0 };
  let dividends = 0;
  for (const a of actions) {
    if (!(initialHolding.openedAt < a.effectiveDate)) continue; // a buy on or after the effective date is not entitled
    const out = applyCorporateAction(state, a);
    expect(out.ok).toBe(true);
    state = { positions: out.positions, cash: out.cash };
    dividends = addUsd(dividends, out.incomeUsd);
  }
  return { shares: state.positions[sym].shares, dividends };
}

/** Run one history through the real close; check every invariant as it goes. */
export async function run(plan) {
  let c = null;
  try { return await runInner(plan, (ctx) => { c = ctx; }); } catch (e) {
    // (Not enumerable: the fake store is circular, and a test runner serializing the error would choke on it.)
    if (e && typeof e === 'object') Object.defineProperty(e, 'sequenceContext', { value: c, enumerable: false });
    throw e;
  }
}
async function runInner(plan, expose) {
  const ctx = await seedBook();
  // (T1a-2b-4 fix round: `names` — a single-name idea, Astra's 2011202706, resulted once its one name is sold.)
  const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: plan.names ?? ['AAPL', 'MSFT'], capitalUsd: 20000, ...(plan.comparison ? { comparison: plan.comparison } : {}) }), quotes: quotes(100, []), date: S[0] });
  const c = { ...ctx, ideaId: a.ideaId };
  expose(c);
  const entered = getIdea(c.db, c.bookId, c.ideaId);
  const initial = { ...entered.ledger.holdings.AAPL };
  const initialOf = { ledger: { ...entered.ledger.holdings.AAPL }, comparisonLedger: { ...entered.comparisonLedger.holdings.AAPL }, spyLedger: { ...entered.spyLedger.holdings.SPY } };
  const tied = (plan.comparison?.type ?? 'same_stock_held') === 'same_stock_held';
  // The independent oracle (caOracle.js): fed the rows each close lists and the founder requests the harness makes.
  const inputs = new InputOracle(S);
  // T1a-2b-4, I-6: what each ledger was owed, from the inputs and its holding history alone (caOracle.js EntitlementOracle).
  const entitlement = new EntitlementOracle(S, inputs);
  let soldAt = null; // the session the idea's AAPL was sold at (a `window` step), its holding history's end
  const holdingsOf = () => ({
    ledger: { sym: 'AAPL', entryShares: Number(initialOf.ledger.shares), boughtAt: 0, soldAt },
    ...(Number(initialOf.comparisonLedger?.shares) > 0 ? { comparisonLedger: { sym: 'AAPL', entryShares: Number(initialOf.comparisonLedger.shares), boughtAt: 0, soldAt: null } } : {}),
    ...(Number(initialOf.spyLedger?.shares) > 0 ? { spyLedger: { sym: 'SPY', entryShares: Number(initialOf.spyLedger.shares), boughtAt: 0, soldAt: null } } : {}),
  });
  const entryOf = Object.fromEntries(LEDGERS.map((f) => [f, Object.fromEntries(Object.entries(entered[f].holdings).map(([s, h]) => [s, { shares: h.shares }]))]));
  const nextCloseOf = (n) => plan.steps.slice(n).find((s) => s.kind === 'close' || s.kind === 'catchup')?.i ?? null;
  let closes = 0;
  const keep = {};
  let lastBelowLine = null;
  let previous = getBook(c.db, c.bookId).execState?.lastCloseKey ?? null;
  for (const [n, step] of plan.steps.entries()) {
    // (A fixed case's assertion on the stored idea at that point of its history.)
    // (T1a-2b-4 fix round: a fourth argument — the stored rows by date, and a bag the plan's steps share.)
    if (step.kind === 'expectIdea') { step.fn(getIdea(c.db, c.bookId, c.ideaId), getBook(c.db, c.bookId), `${plan.seed} step ${n}`, { row: (date) => getRow(c.db, c.bookId, c.ideaId, date), keep }); continue; }
    if (step.kind === 'rule') {
      const asked = await ruleSomething(c, step.pick, step.decision, step.splitOk === true);
      if (asked) inputs.ruling(asked.body, asked.out, asked.requestKey, nextCloseOf(n));
      continue;
    }
    // T1a-2b-4: a WINDOW of S[i] — the idea's line sale fills here (the close before it found the price below the line).
    if (step.kind === 'window') {
      const p = lastBelowLine ?? (step.prices?.AAPL ?? step.price);
      await windowAt(c.db, c.bookId, { date: S[step.i], slot: 'open30', quotes: quotesOf({ ...step, ...(step.prices ? { prices: { ...step.prices, AAPL: p } } : { price: p }) }) });
      if (soldAt === null && !getIdea(c.db, c.bookId, c.ideaId).ledger.holdings.AAPL) soldAt = step.i;
      continue;
    }
    // T1a-2b-4 fix round (L-1): the founder APPROVES or DECLINES a late proposal — one chosen by `pick` among those open (and,
    // so a same-stock pair stays tied, the same id's proposal on every ledger with it), or one named exactly.
    if (step.kind === 'late') {
      for (const asked of await decideLate(c, step.pick, step.decision, n)) inputs.ruling(asked.body, asked.out, asked.requestKey, nextCloseOf(n));
      continue;
    }
    if (step.kind === 'lateExact') {
      const out = await founderRules(c.db, c.bookId, c.ideaId, step.body, { requestKey: `fixed-${n}`, expectOk: false });
      inputs.ruling(step.body, out, `fixed-${n}`, nextCloseOf(n));
      expect(out.status, `${plan.seed} late ${n} ${JSON.stringify(out.body ?? out)}`).toBe(step.status ?? 200);
      continue;
    }
    if (step.kind === 'ruleExact' || step.kind === 'ruleTry') {
      const out = await founderRules(c.db, c.bookId, c.ideaId, step.body, { requestKey: `fixed-${n}`, expectOk: false });
      inputs.ruling(step.body, out, `fixed-${n}`, nextCloseOf(n));
      if (step.kind === 'ruleExact') expect(out.status, `${plan.seed} ruling ${n}`).toBe(step.status ?? 200);
      continue;
    }
    const date = S[step.i];
    // What the inputs show at this close: the rows listed (a catch-up's backfill joined), and the founder's split rulings
    // still pending (each one more account of its id; bounded by the stored ruling's closing — test support reads it only
    // to stop counting an account the product no longer supplies).
    {
      const archived = step.rowsBySym ? Object.values(step.rowsBySym).flat() : (step.rows || []);
      const backfilled = step.kind === 'catchup' ? (step.backfillBySym ? Object.values(step.backfillBySym).flat() : (step.backfill || [])) : [];
      const keys = (rows) => { const m = new Map(); for (const a of rows) { const id = deriveActionId(a); m.set(id, [...(m.get(id) || []), JSON.stringify([a.ratio ?? null, a.amount ?? null])]); } return new Map([...m].map(([id, ks]) => [id, [...new Set(ks)].sort().join('|')])); };
      const ak = keys(archived); const bk = keys(backfilled);
      const disagreeIds = new Set([...bk.keys()].filter((id) => ak.has(id) && ak.get(id) !== bk.get(id)));
      const stored = getIdea(c.db, c.bookId, c.ideaId).founderRulings || [];
      const pendingSplits = new Map();
      for (const r of inputs.rulings) {
        if (r.status !== 200 || r.body?.kind !== 'suspicion' || r.body.decision !== 'split') continue;
        const doc = stored.find((x) => x.requestKey === r.requestKey);
        if (doc && doc.appliedOn != null && doc.appliedOn < date) continue;
        const id = inputs.splitIdOf(r.body);
        // (Its record's gap, from the stored ruling, and the close after it was made — AR3-O1's two as-built exceptions.)
        if (id) pendingSplits.set(id, { ratio: Number(r.body.ratio), since: doc?.covers?.since ?? null, suspectedOn: doc?.covers?.suspectedOn ?? null, at: r.at });
      }
      const uncoveredSyms = step.kind === 'catchup' ? [] : (step.uncoveredSyms ?? (step.uncovered ? ['AAPL'] : []));
      inputs.close(step.i, [...archived, ...backfilled], { pendingSplits, uncoveredSyms, disagreeIds });
    }
    // T1a-2b-4: a close BELOW THE LINE (the idea's AAPL, while it holds it) — a sale is queued for the next window.
    let closeStep = step;
    if (step.belowLine) {
      const line = getIdea(c.db, c.bookId, c.ideaId).lines.find((l) => l.symbol === 'AAPL');
      if (line && getIdea(c.db, c.bookId, c.ideaId).ledger.holdings.AAPL) {
        lastBelowLine = roundUsd(line.level * 0.97);
        closeStep = step.prices ? { ...step, prices: { ...step.prices, AAPL: lastBelowLine } } : { ...step, price: lastBelowLine };
      }
    }
    await storeCloseSnapshot(c.db, date, quotesOf(closeStep));
    // T1a-2b-4 (T2D-12): the session's parse report for AAPL shows a REJECTED row, or is MISSING.
    // (T1a-2b-4 fix round: `parse: { reject: i }` dates the rejected row on S[i] — T2E-08's split of Tuesday, rejected Thursday.)
    const rejectedOn = step.parse === 'reject' ? date : (step.parse?.reject !== undefined ? S[step.parse.reject] : null);
    if (rejectedOn !== null) storeParseReport(c.db, date, 'AAPL', { ...CLEAN_PARSE_ENTRY, rowsReceived: 1, rowsRejected: 1, rejects: [{ leg: 'splits', reason: 'malformed_split', row: { date: rejectedOn, split: '5:4' } }], legs: { ...CLEAN_PARSE_ENTRY.legs, splits: { ...CLEAN_PARSE_ENTRY.legs.splits, received: 1, rejected: 1 } } });
    if (step.parse === 'missing') omitParseReport(c.db, date, ['AAPL']);
    if (step.kind === 'catchup') {
      const bySym = step.backfillBySym ?? { AAPL: step.backfill };
      for (const [sym, rows] of Object.entries(bySym)) {
        plant(c.db, `practiceFieldCaBackfill/${sym}`, { schemaVersion: 1, symbol: sym, from: S[0], to: date, failed: false, actions: rows, calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill', parseReport: CLEAN_PARSE_ENTRY });
      }
      const fetchCorporateActions = async (sym) => ({ failed: false, calls: 2, actions: bySym[sym] ?? [] });
      await catchUpIdeaBook(c.db, c.bookRef, { before: S[step.i + 1], now: closeNowOf(S[step.i + 1]), ...vendorAnswering(fetchCorporateActions) });
    } else {
      const uncoveredSyms = step.uncoveredSyms ?? (step.uncovered ? ['AAPL'] : []);
      if (uncoveredSyms.length > 0) {
        const e = c.db._store.get(`mandateUniverseDaily/${date}`);
        for (const sym of uncoveredSyms) e.data.symbols[sym].caFetchFailed = true;
        e.version += 1;
      }
      await closeIdeaBook(c.db, c.bookRef, { date, now: closeNowOf(date) });
    }
    expect(getBook(c.db, c.bookId).execState.lastCloseKey, `seed ${plan.seed} closed ${date}`).toBe(date);
    closes += 1;
    // (The symbols this close's inputs leave uncovered: a failed fetch, or a dirty or missing parse report.)
    const uncoveredNow = step.kind === 'catchup' ? [] : [...(step.uncoveredSyms ?? (step.uncovered ? ['AAPL'] : [])), ...(step.parse ? ['AAPL'] : [])];
    // (T1a-2b-4 fix round: I-7, then I-6, then the rest — so each of the two oracle changes shows its own failure first.)
    const moneyChecks = () => {
      // I-7: every posted adjustment has its founder approval or ruling in the inputs.
      entitlement.checkAuthority(getIdea(c.db, c.bookId, c.ideaId), step.i, plan.seed);
      entitlement.check(getIdea(c.db, c.bookId, c.ideaId), step.i, holdingsOf(), plan.seed, { uncoveredNow });
      // (A sale breaks the same-stock tie, as it should: the comparison keeps the stock the idea sold.)
      checkAfterClose(c, date, plan.ambiguousSince, tied && soldAt === null, inputs, entryOf, plan.seed);
    };
    moneyChecks();
    if (previous !== null) { await rerunAdds(c, date, previous); closes += 1; }
    moneyChecks();
    previous = date;
  }
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  if (typeof plan.seed === 'number') tallyReached(idea);
  // T1a-2b-4 (Astra T2D-05; FQ-11): a "clean" history whose feed listed an id with a SECOND payload at a later close is a
  // vendor CORRECTION of a settled id — the product now records it (`revised_after_ruling`, `settledBy: 'feed'`) and waits
  // for the founder, so the history is not clean data in the product's sense. Its only open ambiguities must be exactly
  // those records, of exactly those ids; I-4 is not asked of it (a corrected split holds what follows it). Counted.
  const correctedIds = plan.clean ? [...(plan.feed || new Map())].filter(([, e]) => (e.payloads || []).length > 1).map(([id]) => id) : [];
  if (correctedIds.length > 0) {
    reclassifiedAsCorrected.count += 1;
    for (const f of LEDGERS) {
      for (const r of openAmbiguities(idea[f])) {
        expect([r.reason, r.settledBy ?? null, correctedIds.includes(r.actionId)], `seed ${plan.seed} corrected-only ambiguity ${f} ${r.actionId}`).toEqual(['revised_after_ruling', 'feed', true]);
      }
    }
  } else if (plan.clean) {
    // I-4: complete coverage and no ambiguity — the engine's own applier, over the same rows.
    for (const f of LEDGERS) expect(openAmbiguities(idea[f]).map((r) => [r.reason, r.actionId, r.redateOf ?? null]), `seed ${plan.seed} clean has no ambiguity`).toEqual([]);
    if (!plan.wide) {
      const want = oracle(initial, plan.feed);
      for (const f of ['ledger', 'comparisonLedger']) {
        expect(idea[f].holdings.AAPL.shares, `seed ${plan.seed} I-4 ${f} shares`).toBe(want.shares);
        expect(idea[f].dividendsUsd, `seed ${plan.seed} I-4 ${f} dividends`).toBe(want.dividends);
      }
      expect(getBook(c.db, c.bookId).portfolio.positions.AAPL.shares, `seed ${plan.seed} I-4 book`).toBe(want.shares);
    } else {
      // Every ledger kind, each on its own holding: the idea's AAPL, the comparison's AAPL (same-stock or a frozen basket),
      // the SPY line's SPY — each against the engine's applier from that ledger's own entry holding.
      for (const [f, sym] of [['ledger', 'AAPL'], ['comparisonLedger', 'AAPL'], ['spyLedger', 'SPY']]) {
        const want = oracle(initialOf[f], plan.feed, sym);
        expect(idea[f].holdings[sym].shares, `seed ${plan.seed} I-4 ${f} ${sym} shares`).toBe(want.shares);
        expect(idea[f].dividendsUsd, `seed ${plan.seed} I-4 ${f} dividends`).toBe(want.dividends);
      }
      expect(getBook(c.db, c.bookId).portfolio.positions.AAPL.shares, `seed ${plan.seed} I-4 book`).toBe(oracle(initialOf.ledger, plan.feed, 'AAPL').shares);
    }
  }
  if (plan.end && plan.end.dividends !== undefined) {
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd], `${plan.seed} dividends`).toEqual([plan.end.dividends, plan.end.dividends]);
    expect([idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, getBook(c.db, c.bookId).portfolio.positions.AAPL.shares], `${plan.seed} shares`).toEqual([plan.end.shares, plan.end.shares, plan.end.shares]);
  }
  if (plan.end?.late) plan.end.late(idea, getBook(c.db, c.bookId), soldAt);
  return { idea, closes, inputs, entitlement, soldAt };
}

// ── EVERY REPRODUCTION FROM ASTRA'S REVIEWS, AS A FIXED CASE THROUGH THE SAME CHECKS (rev 1, S-6) ───────────────────────
// Its "seed" is its name. The final money is what rev 1 gives (corporateActionStickyAmbiguity.test.js has the long form).
const SH = 99.970008;
const d = (i, v) => rowOf('cash_dividend', S[i], v);
const sp = (i, v) => rowOf('split', S[i], v);
const cl = (i, price, rows = [], uncovered = false) => ({ kind: 'close', i, price, rows, uncovered });
const conflictRuling = (recordId, decision, payload, status) => ({ kind: 'ruleExact', status, body: { kind: 'conflict', recordId, decision, ...(payload ? { payload } : {}) } });
const priceMove = (suspectedOn) => ({ kind: 'ruleExact', body: { kind: 'suspicion', recordId: `suspected_split_AAPL_${suspectedOn}`, decision: 'price_move' } });
const c03 = (uncovered) => ({
  seed: `astra-T2D-C03-${uncovered ? 'uncovered' : 'covered'}`,
  steps: [cl(0, 100), cl(1, 100, [d(1, 1), d(1, 2)]), cl(2, 100, [d(1, 1), d(2, 2)], uncovered), cl(3, 100, [d(2, 2)]), cl(4, 100, [d(1, 1)]),
    conflictRuling(`cash_dividend_AAPL_${S[1]}`, 'payload', { amount: 1 }), cl(5, 100), cl(6, 100)],
  end: { dividends: 99.97, shares: SH },
});
const c04 = (splitAt) => ({
  seed: `astra-T2D-C04-split-first-at-${splitAt}`,
  steps: [cl(0, 100), cl(1, 50), cl(2, 25, [d(2, 1.5), ...(splitAt === 2 ? [sp(1, '2/1')] : [])], true), cl(3, 50, [d(2, 1.5), sp(1, '2/1')]), cl(4, 50, [d(2, 1.5), sp(1, '2/1')])],
  end: { dividends: 0, shares: 199.940016 },
});
export const FIXED = [
  { seed: 'astra-T2D-01-redate-past-purchase', steps: [cl(0, 100, [sp(0, '3/2')]), cl(1, 100, [sp(1, '3/2')]), conflictRuling(`split_AAPL_${S[1]}`, 'none'), cl(2, 100, [sp(1, '3/2')])], end: { dividends: 0, shares: SH } },
  { seed: 'astra-AR1-RF-02-ex-date-conflict-redated', steps: [cl(0, 100, [sp(0, '3/2'), sp(0, '5/4')]), cl(1, 100, [sp(1, '3/2')]), cl(2, 100, [sp(1, '3/2')])], end: { dividends: 0, shares: SH } },
  { seed: 'astra-T2D-C01-cash', steps: [cl(0, 100, [d(0, 1), d(0, 2)]), cl(1, 100, [d(0, 1), d(0, 3)]), cl(2, 100, [d(2, 3)]), cl(3, 100, [d(2, 3)])], end: { dividends: 0, shares: SH } },
  { seed: 'astra-T2D-C01-split', steps: [cl(0, 100, [sp(0, '3/2'), sp(0, '5/4')]), cl(1, 100, [sp(0, '7/4'), sp(0, '5/4')]), cl(2, 100, [sp(2, '7/4')]), cl(3, 100, [sp(2, '7/4')])], end: { dividends: 0, shares: SH } },
  { seed: 'astra-T2D-C02-archive-backfill', steps: [cl(0, 100), cl(1, 100), cl(2, 100), cl(3, 100), { kind: 'catchup', i: 4, price: 80, rows: [sp(4, '5/4')], backfill: [sp(4, '3/2')] },
    cl(5, 80, [sp(4, '3/2')]), cl(6, 80, [sp(4, '3/2')]), conflictRuling(`split_AAPL_${S[4]}`, 'payload', { ratio: 1.25 }), cl(7, 80, [sp(4, '3/2')])], end: { dividends: 0, shares: 124.96251 } },
  c03(false), c03(true),
  c04(2), c04(3),
  { seed: 'astra-T2D-06-overlap-ruled', steps: [cl(0, 100), cl(1, 100, [d(1, 1), d(1, 2)]), cl(2, 100, [d(1, 1), d(2, 2)]), cl(3, 100, [d(1, 1), d(2, 2)]),
    conflictRuling(`cash_dividend_AAPL_${S[1]}`, 'none'), conflictRuling(`cash_dividend_AAPL_${S[2]}`, 'payload', { amount: 2 }), cl(4, 100, [d(1, 1), d(2, 2)])], end: { dividends: 199.94, shares: SH } },
  ...[false, true].map((uncovered) => ({ seed: `astra-AR1-RF-03-${uncovered ? 'uncovered' : 'covered'}`, steps: [cl(0, 100), cl(1, 100, [d(1, 1), d(1, 2)]), cl(2, 100, [d(1, 1)], uncovered), cl(3, 100, [d(3, 2)]), cl(4, 100, [d(3, 2)])], end: { dividends: 0, shares: SH } })),
  { seed: 'astra-T2D-07-late-dividend-uncovered', steps: [cl(0, 100), cl(1, 104), cl(2, 104, [d(1, 1)], true), cl(3, 104), cl(4, 104, [d(1, 1)])], end: { dividends: 99.97, shares: SH } },
  { seed: 'astra-T2D-08-round-trip', steps: [cl(0, 100), cl(1, 50), cl(2, 25, [d(2, 1)]), cl(3, 50, [d(2, 1)]), priceMove(S[1]), cl(4, 50)], end: { dividends: 0, shares: SH } },
  { seed: 'astra-T2D-10-unrepresentable', steps: [cl(0, 100), cl(1, 100, [sp(1, '1/1000000000'), sp(1, '4/5')]),
    conflictRuling(`reverse_split_AAPL_${S[1]}`, 'payload', { ratio: 1e-9 }, 422), conflictRuling(`reverse_split_AAPL_${S[1]}`, 'payload', { ratio: 0.8 }), cl(2, 125), cl(3, 125, [sp(1, '4/5')])], end: { dividends: 0, shares: 79.976006 } },
];

// ── ASTRA'S ROUND-2 REPLAY SEEDS (docs/audits/20261119_ASTRA_CONFIRMATION_T1A2B3_ROUND2.md, "Replay seeds for both fixes"),
// VERBATIM. T2D-D01: a correction of a founder-settled id and its possible re-date first listed in one close. T2D-D02: a
// pending suspicion ruling's split id listed by the vendor with two ratios that disagree, on a partly covered close.
const oldDividend = 'cash_dividend_AAPL_' + S[1];
const movedDividend = 'cash_dividend_AAPL_' + S[3];
const splitId = 'split_AAPL_' + S[1];

const d01 = {
  seed: 'Astra-R2-D01',
  ambiguousSince: { [movedDividend]: 3 },
  steps: [cl(0, 100), cl(1, 100, [d(1, 1), d(1, 2)]),
    conflictRuling(oldDividend, 'none'), cl(2, 100),
    cl(3, 100, [d(1, 3), d(3, 3)])],
  end: { dividends: 0, shares: 99.970008 },
};

const d02 = {
  seed: 'Astra-R2-D02',
  ambiguousSince: { [splitId]: 2 },
  steps: [cl(0, 100), cl(1, 50),
    { kind: 'ruleExact', body: { kind: 'suspicion',
      recordId: 'suspected_split_AAPL_' + S[1], decision: 'split', ratio: 2 } },
    cl(2, 50, [sp(1, '3/2'), sp(1, '5/4')], true), cl(3, 50)],
  end: { dividends: 0, shares: 99.970008 },
};

// The regressions around them. Each runs through I-1 to I-5 and the independent oracle (caOracle.js) after every close.
const at = (fn) => ({ kind: 'expectIdea', fn });
const sharesOf = (idea, book) => [idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, book.portfolio.positions.AAPL.shares];
const recordOf = (idea, id, reason) => idea.ledger.corporateActionReceipts.find((r) => r.actionId === id && r.reason === reason) ?? null;
const rulingOf = (idea, kind) => (idea.founderRulings || []).find((r) => r.kind === kind) ?? null;
const SH2 = 199.940016;
const SH15 = 149.955012;
const splitRuling = (ratio, status) => ({ kind: 'ruleExact', status, body: { kind: 'suspicion', recordId: 'suspected_split_AAPL_' + S[1], decision: 'split', ratio } });
/** T2D-D01, fix 1. */
const D01_ROWS = [
  // The same rows in the other order: the moved row first.
  { seed: 'Astra-R2-D01-rows-reversed', steps: [cl(0, 100), cl(1, 100, [d(1, 1), d(1, 2)]), conflictRuling(oldDividend, 'none'), cl(2, 100), cl(3, 100, [d(3, 3), d(1, 3)])], end: { dividends: 0, shares: SH } },
  // The moved id is a possible re-date the founder can rule (it answered 404 before: never recorded) — and her answer pays,
  // once; the original id's revision is closed by reconfirming its `none` (FQ-6).
  { seed: 'Astra-R2-D01-moved-id-ruled', steps: [...d01.steps,
    at((idea) => {
      expect(recordOf(idea, movedDividend, POSSIBLE_REDATE)?.redateOf, 'the moved id is a possible re-date of the original').toBe(oldDividend);
      expect(recordOf(idea, oldDividend, 'revised_after_ruling')?.rows.map((r) => r.amount), 'the original id recorded the $3 it showed').toEqual([3]);
    }),
    conflictRuling(oldDividend, 'none'), conflictRuling(movedDividend, 'payload', { amount: 3 }), cl(4, 100),
    at((idea) => expect(LEDGERS.flatMap((f) => openAmbiguities(idea[f])), 'nothing left open').toEqual([]))], end: { dividends: 299.91, shares: SH } },
  // The founder chose the original $1: $99.97 is authorized, and that is all that is paid (it was $399.88).
  { seed: 'Astra-R2-D01-original-one-dollar', steps: [cl(0, 100), cl(1, 100, [d(1, 1), d(1, 2)]), conflictRuling(oldDividend, 'payload', { amount: 1 }), cl(2, 100), cl(3, 100, [d(1, 3), d(3, 3)]), cl(4, 100)], end: { dividends: 99.97, shares: SH } },
  // The split analogue: a ruled ex-date split conflict, then a ratio it did not see and that ratio re-dated, in one close.
  { seed: 'Astra-R2-D01-split-analogue', steps: [cl(0, 100), cl(1, 100, [sp(1, '3/2'), sp(1, '5/4')]), conflictRuling(splitId, 'none'), cl(2, 100), cl(3, 100, [sp(1, '7/4'), sp(3, '7/4')]),
    at((idea) => expect(recordOf(idea, 'split_AAPL_' + S[3], POSSIBLE_REDATE)?.redateOf, 'the moved split is a possible re-date').toBe(splitId)),
    conflictRuling('split_AAPL_' + S[3], 'none'), cl(4, 100)], end: { dividends: 0, shares: SH } },
  // Control (Astra's): the correction one close before its re-date — paid nothing then, and still nothing.
  { seed: 'Astra-R2-D01-control-correction-first', steps: [cl(0, 100), cl(1, 100, [d(1, 1), d(1, 2)]), conflictRuling(oldDividend, 'none'), cl(2, 100), cl(3, 100, [d(1, 3)]), cl(4, 100, [d(4, 3)]), conflictRuling('cash_dividend_AAPL_' + S[4], 'none'), cl(5, 100)], end: { dividends: 0, shares: SH } },
];
/** T2D-D02, fix 2. */
const D02_ROWS = [
  // Her history, then the founder rules the conflict: the reported 3:2 is accepted (it answered 404) and applied once.
  { seed: 'Astra-R2-D02-conflict-ruled-three-for-two', steps: [...d02.steps,
    at((idea) => {
      expect(recordOf(idea, splitId, CONFLICTING_ACTION)?.rows.map((r) => r.ratio).sort(), 'the vendor ratios and the founder\'s, recorded at the uncovered close').toEqual([1.25, 1.5, 2]);
      expect(rulingOf(idea, 'suspicion')?.outcome, 'the founder split was refused, not left pending').toBe('refused');
      expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('vendor_rows_disagree');
    }),
    conflictRuling(splitId, 'payload', { ratio: 1.5 }), cl(4, 50),
    // (3:2 does not explain a halving: the suspicion still stands, and the founder answers it on its own.)
    at((idea) => expect(idea.ledger.holdings.AAPL.basisSuspicion, 'the halving is still unexplained').toBeTruthy())], end: { dividends: 0, shares: SH15 } },
  // The COVERED variant: nothing applies while the vendor's ratios disagree with the founder's; 3:2 is then accepted
  // through the conflict ruling (it answered 422 — the founder's 2:1 had applied and the ratios were a revision).
  { seed: 'Astra-R2-D02-covered', steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, [sp(1, '3/2'), sp(1, '5/4')]),
    at((idea, book) => expect(sharesOf(idea, book), 'nothing applied on the covered close').toEqual([SH, SH, SH])),
    conflictRuling(splitId, 'payload', { ratio: 1.5 }), cl(3, 50)], end: { dividends: 0, shares: SH15 } },
  // One vendor ratio that disagrees with the founder's alone is a conflict too; the founder may then choose her own 2:1.
  { seed: 'Astra-R2-D02-one-disagreeing-row', steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, [sp(1, '3/2')]),
    at((idea, book) => expect(sharesOf(idea, book)).toEqual([SH, SH, SH])),
    conflictRuling(splitId, 'payload', { ratio: 2 }), cl(3, 50)], end: { dividends: 0, shares: SH2 } },
  // Controls: an agreeing single 2:1 applies once (covered, and through a coverage failure)…
  { seed: 'Astra-R2-D02-control-agreeing-covered', steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, [sp(1, '2/1')]),
    at((idea) => expect(rulingOf(idea, 'suspicion')?.outcome).toBe('applied')), cl(3, 50, [sp(1, '2/1')])], end: { dividends: 0, shares: SH2 } },
  { seed: 'Astra-R2-D02-control-agreeing-uncovered', steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, [sp(1, '2/1'), sp(1, '2/1')], true),
    at((idea, book) => expect(sharesOf(idea, book), 'held while uncovered').toEqual([SH, SH, SH])), cl(3, 50)], end: { dividends: 0, shares: SH2 } },
  // …and without a founder split, the same two ratios are a selectable conflict that moves nothing until ruled.
  { seed: 'Astra-R2-D02-control-unruled', steps: [cl(0, 100), cl(1, 50), cl(2, 50, [sp(1, '3/2'), sp(1, '5/4')], true), cl(3, 50),
    at((idea, book) => expect(sharesOf(idea, book)).toEqual([SH, SH, SH])),
    conflictRuling(splitId, 'payload', { ratio: 1.25 }), cl(4, 50)], end: { dividends: 0, shares: 124.96251 } },
];
export const ASTRA_R2 = [d01, d02, ...D01_ROWS, ...D02_ROWS];

/**
 * THE FINAL SOAK'S FINDINGS (6,000 ordered histories, seeds 1,911,200,000–1,911,205,999), each as a fixed case.
 * SOAK-R3-1 (I-2, a sibling of T2D-D02): a pending founder split moved the count under an id the vendor's rows had made a
 * POSSIBLE RE-DATE — the same 2:1 under another date, in an open conflict, or repeating a split declined as not entitled.
 * SOAK-R3-2 (I-5): a founder split found moot partway through a close still held a later split for that close; re-running
 * the close applied it.
 */
const sus = (i) => 'suspected_split_AAPL_' + S[i];
export const SOAK_R3 = [
  // R3-1: the vendor agrees with the founder's 2:1 under its id, and lists 2:1 again dated the next day inside a 3:2/2:1
  // conflict — the founder's split is refused (a possible re-date), nothing moves; the founder then rules the record.
  { seed: 'SOAK-R3-1-redate-in-a-next-day-conflict', steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, [sp(1, '2/1'), sp(2, '3/2'), sp(2, '2/1')]),
    at((idea, book) => {
      expect(sharesOf(idea, book), 'nothing moved').toEqual([SH, SH, SH]);
      expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('possible_redate');
      expect(recordOf(idea, splitId, POSSIBLE_REDATE), 'the founder split\'s id is a possible re-date').toBeTruthy();
    }),
    conflictRuling(splitId, 'payload', { ratio: 2 }), cl(3, 50)], end: { dividends: 0, shares: SH2 } },
  // R3-1: a 2:1 dated the purchase day (declined, not entitled), the price halves the next session, the founder rules 2:1,
  // and the vendor then lists that 2:1 under the next day — a possible re-date of the declined one (the agreed Q10).
  { seed: 'SOAK-R3-1-redate-of-a-declined-split', steps: [cl(0, 100, [sp(0, '2/1')]), cl(1, 50, [sp(0, '2/1')]), splitRuling(2), cl(2, 50, [sp(0, '2/1'), sp(1, '2/1')]),
    at((idea) => expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('possible_redate')), cl(3, 50)], end: { dividends: 0, shares: SH } },
  // R3-1: the vendor never lists the founder's id, but lists 2:1 the next day inside a 3:2/2:1 conflict — the founder's own
  // split meets that open record's payload (outside its gap) and is refused; nothing moves until the founder rules.
  { seed: 'SOAK-R3-1-founder-split-meets-an-open-conflict', steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, [sp(2, '3/2'), sp(2, '2/1')]),
    at((idea, book) => {
      expect(sharesOf(idea, book)).toEqual([SH, SH, SH]);
      expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('possible_redate');
    }), cl(3, 50)], end: { dividends: 0, shares: SH } },
  // R3-1: a halving seen across an uncovered close (its gap two sessions wide); the founder rules 2:1; the vendor then lists
  // that 2:1 under the founder's own id AND under the other day of the gap — two vendor rows, one payload, two dates: both
  // ambiguous (S-1 (3)), so the in-gap row does not explain the move by itself and the founder's split is refused.
  { seed: 'SOAK-R3-1-vendor-lists-the-founder-id-and-another-gap-day', steps: [cl(0, 100), cl(1, 100, [], true), cl(2, 50),
    { kind: 'ruleExact', body: { kind: 'suspicion', recordId: sus(2), decision: 'split', ratio: 2 } },
    cl(3, 50, [sp(2, '2/1'), sp(1, '2/1')]),
    at((idea, book) => {
      expect(sharesOf(idea, book), 'neither 2:1 moved the count').toEqual([SH, SH, SH]);
      expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('possible_redate');
    })], end: { dividends: 0, shares: SH } },
  // ── The final fix's independent refuter (AR3-RF), on 47afe4ae; each a row here ──
  // AR3-RF-1 (refuter F1; ×4 at 47afe4ae, the oracle silent then): a halving at S2, the founder's 2:1 for it, and at the
  // close that applies it the vendor lists the same 2:1 dated S1 (outside the gap: since is S1). Both are possible re-dates
  // of each other — nothing moves — until the founder rules: her 2:1 for her id, `none` for the vendor's: ×2, once.
  { seed: 'AR3-RF-1-founder-split-and-the-vendor-split-a-session-earlier', steps: [cl(0, 100), cl(1, 100), cl(2, 50),
    { kind: 'ruleExact', body: { kind: 'suspicion', recordId: sus(2), decision: 'split', ratio: 2 } }, cl(3, 50, [sp(1, '2/1')]),
    at((idea, book) => {
      expect(sharesOf(idea, book), 'nothing moved (it was ×4)').toEqual([SH, SH, SH]);
      expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('possible_redate');
    }),
    conflictRuling('split_AAPL_' + S[2], 'payload', { ratio: 2 }), conflictRuling('split_AAPL_' + S[1], 'none'), cl(4, 50, [sp(1, '2/1')])], end: { dividends: 0, shares: SH2 } },
  // …the reverse split (it was ÷4).
  { seed: 'AR3-RF-1-reverse-split', steps: [cl(0, 100), cl(1, 100), cl(2, 200),
    { kind: 'ruleExact', body: { kind: 'suspicion', recordId: sus(2), decision: 'split', ratio: 0.5 } }, cl(3, 200, [sp(1, '1/2')]), cl(4, 200)], end: { dividends: 0, shares: SH } },
  // AR3-RF-2 (refuter F2): a vendor 3:2 for the record's split id held at an uncovered close; the founder then rules 2:1. The
  // next close finds the held row revising it: the founder's split is refused there ('id_ambiguous'), not left pending — so
  // a `none` on the conflict leaves the suspicion answerable (`price_move` accepted; it was 409, the holding locked) …
  { seed: 'AR3-RF-2-held-vendor-row-then-founder-split-none', steps: [cl(0, 100), cl(1, 50), cl(2, 50, [sp(1, '3/2')], true), splitRuling(2), cl(3, 50),
    at((idea) => expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('id_ambiguous')),
    conflictRuling(splitId, 'none'), cl(4, 50), { kind: 'ruleExact', body: { kind: 'suspicion', recordId: sus(1), decision: 'price_move' } }, cl(5, 50)], end: { dividends: 0, shares: SH } },
  // … and a 3:2 chosen on the conflict applies once while the founder's own ruling stays `refused` (it was marked `applied`
  // with her 2:1 never applied).
  { seed: 'AR3-RF-2-held-vendor-row-then-founder-split-three-for-two', steps: [cl(0, 100), cl(1, 50), cl(2, 50, [sp(1, '3/2')], true), splitRuling(2), cl(3, 50),
    conflictRuling(splitId, 'payload', { ratio: 1.5 }), cl(4, 50),
    at((idea) => expect(rulingOf(idea, 'suspicion')?.outcome, 'never "applied"').toBe('refused'))], end: { dividends: 0, shares: SH15 } },
  // AR3-RF-3 (refuter F3; the soak's class SOAK-R3-1): the feed's 2:1 at S1 applied; a second halving; the founder's 2:1 for
  // it; the vendor then lists 2:1 dated S2, a possible re-date of the applied one — the founder's split is refused.
  { seed: 'AR3-RF-3-founder-split-under-a-vendor-redate', steps: [cl(0, 100), cl(1, 50, [sp(1, '2/1')]), cl(2, 25),
    { kind: 'ruleExact', body: { kind: 'suspicion', recordId: sus(2), decision: 'split', ratio: 2 } }, cl(3, 25, [sp(2, '2/1')]),
    at((idea) => expect(rulingOf(idea, 'suspicion')?.refusedBecause).toBe('possible_redate'))], end: { dividends: 0, shares: SH2 } },
  // R3-2: a halving seen across an uncovered close, the founder's 2:1 for it held through another, then the vendor's own
  // 2:1 inside the gap explains it first (the founder's goes moot) and a 3:1 dated later is applied AT THAT CLOSE.
  { seed: 'SOAK-R3-2-moot-founder-split-holds-nothing', steps: [cl(0, 100), cl(1, 100, [], true), cl(2, 50),
    { kind: 'ruleExact', body: { kind: 'suspicion', recordId: sus(2), decision: 'split', ratio: 2 } },
    cl(3, 50, [], true), cl(4, 16.67, [sp(1, '2/1'), sp(4, '3/1')]),
    at((idea) => expect(rulingOf(idea, 'suspicion')?.outcome, 'the founder\'s split went moot').toBe('moot'))], end: { dividends: 0, shares: 599.820048 } },
];

/**
 * ASTRA'S INDEPENDENT GENERATOR, REBUILT FROM HER DESCRIPTION (round 2, Run:100 — her harness was not attached): seeds
 * 19112000–19112031. Even seeds write the correction/re-date (D01's class), odd seeds the pending suspicion (D02's).
 * Residues 0 and 1 modulo 4 are challenges, 2 and 3 controls. Bits 2–3 choose the cash history's unseen amount ($3, $3.25,
 * $4, $4.50) — and, in the rebuild, the split history's vendor ratios. Bit 4 reverses the order of the rows in the close.
 * The D01 control is her own: the correction one close before its re-date. The D02 controls are her two: an agreeing 2:1
 * (bits 2–3 even) and the same disagreeing ratios with no founder split (odd). Every one ends with the money the rulings in
 * force allow, and the founder's later answer to the moved or disputed id is accepted (200).
 */
export function generateAstraR2(seed) {
  const control = seed % 4 >= 2;
  const bits = (seed >> 2) & 3;
  const reversed = ((seed >> 4) & 1) === 1;
  const order = (rows) => (reversed ? [...rows].reverse() : rows);
  if (seed % 2 === 0) {
    const amount = [3, 3.25, 4, 4.5][bits];
    const head = [cl(0, 100), cl(1, 100, order([d(1, 1), d(1, 2)])), conflictRuling(oldDividend, 'none'), cl(2, 100)];
    const tail = control
      ? [cl(3, 100, [d(1, amount)]), cl(4, 100, [d(3, amount)])]
      : [cl(3, 100, order([d(1, amount), d(3, amount)]))];
    return { seed: `astra-r2-gen-${seed}-cash-${control ? 'control' : 'challenge'}`, steps: [...head, ...tail, conflictRuling(movedDividend, 'none'), cl(control ? 5 : 4, 100)], end: { dividends: 0, shares: SH } };
  }
  const pair = [['3/2', '5/4'], ['3/2', '3/1'], ['5/4', '3/1'], ['3/1', '3/2']][bits];
  if (!control) {
    return { seed: `astra-r2-gen-${seed}-split-challenge`, steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, order(pair.map((v) => sp(1, v))), true), cl(3, 50),
      conflictRuling(splitId, 'none'), cl(4, 50)], end: { dividends: 0, shares: SH } };
  }
  if (bits % 2 === 0) return { seed: `astra-r2-gen-${seed}-split-control-agreeing`, steps: [cl(0, 100), cl(1, 50), splitRuling(2), cl(2, 50, [sp(1, '2/1')], true), cl(3, 50)], end: { dividends: 0, shares: SH2 } };
  return { seed: `astra-r2-gen-${seed}-split-control-unruled`, steps: [cl(0, 100), cl(1, 50), cl(2, 50, order(pair.map((v) => sp(1, v))), true), cl(3, 50), conflictRuling(splitId, 'none'), cl(4, 50)], end: { dividends: 0, shares: SH } };
}


/** The hooks every S-6 file installs: mode on, a fresh fake store, no vendor key, a fetch that refuses. */
export function installSequenceHooks() {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    restoreMode();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    takeSeededDbs();
  });

}

// ── THE WIDE GENERATOR (the founder's S-6 run: thousands of histories, up to 15 sessions, all three ledger kinds) ─────────
// Events fall on AAPL (the idea's own holding and its comparison's — same-stock, or a frozen basket of AAPL and MSFT, chosen
// per history) and on SPY (the SPY line's own holding). Every narrow event kind, per symbol: purchases on ex-dates,
// dividends (on their date or a session late), splits, conflicts, revisions, re-dates, split-shaped moves, coverage failures
// (per symbol), catch-ups whose stored backfills agree or disagree, founder rulings, and C04's chain on AAPL. The generator
// keeps its own record of every id it made ambiguous (the I-2 oracle), as the narrow one does.

const WIDE_SYMS = ['AAPL', 'SPY'];
const WIDE_BASE = { AAPL: 100, SPY: 500 };
/** The event kinds the wide generator writes (the coverage table counts each, and each pair). */
export const WIDE_KINDS = ['purchase_on_ex_date', 'dividend', 'split', 'conflict', 'revision', 'redate', 'split_shaped_move', 'coverage_failure',
  'backfill_agrees', 'backfill_disagrees', 'backfill_empty', 'founder_ruling', 'c04_chain', 'chain_c03', 'chain_d01', 'chain_d02'];

/**
 * ORDERED SHAPES ON ONE ID (final fix, Astra's round 2): her finding — the pair counts measured two kind labels anywhere in
 * a plan, not ordered events on one id and one ledger, and the generator never wrote C03's order. With `ordered`, a wide
 * history carries ONE chain of ordered events on one AAPL id (and its re-date), drawn from a SECOND random stream `o`:
 *   c03 — an ex-date conflict; then the old id overlapping its re-date; then the new row only; then the old row only (the
 *         overlap close uncovered half the time); then, sometimes, the founder's ruling on the old id.
 *   d01 — a conflict the founder settles (`none`, or a payload); then, in ONE close, a payload of it not seen and that
 *         payload re-dated (rows in either order) — or, as a control, the correction one close before its re-date.
 *   d02 — a halving no row explains; the founder's split for it; then same-id vendor split rows — two that disagree, one
 *         that disagrees, one that agrees, or none — on a close whose data fails for AAPL more often than not.
 * Returns where to inject: rows by session, a price factor, uncovered sessions, and founder requests after a session.
 */
function orderedChain(o, n) {
  const kinds = ['c03', 'd01', 'd02'].filter((k) => (k === 'c03' ? n >= 6 : n >= 5));
  if (kinds.length === 0) return null;
  const kind = o.pick(kinds.flatMap((k) => (k === 'd02' ? [k, k] : [k]))); // (D02 needs the most to line up: weighted twice)
  const span = kind === 'c03' ? 4 : 3;
  const a = 1 + o.int(Math.max(1, n - span - 1));
  const rowsAt = new Map(); const uncoveredAt = new Set(); const rulesAfter = new Map();
  const put = (i, rows) => { if (i < n) rowsAt.set(i, [...(rowsAt.get(i) || []), ...rows]); };
  const rule = (i, body) => { if (i < n) rulesAfter.set(i, [...(rulesAfter.get(i) || []), { kind: 'ruleTry', body }]); };
  const two = () => { const p1 = o.pick(AMOUNTS); const p2 = o.pick(AMOUNTS.filter((x) => x !== p1)); return [p1, p2, o.pick(AMOUNTS.filter((x) => x !== p1 && x !== p2))]; };
  const div = (i, v) => rowOf('cash_dividend', S[i], v);
  const old = `cash_dividend_AAPL_${S[a]}`;
  if (kind === 'c03') {
    const [p1, p2] = two();
    put(a, [div(a, p1), div(a, p2)]);
    put(a + 1, [div(a, p1), div(a + 1, p2)]);
    if (o.chance(0.5)) uncoveredAt.add(a + 1);
    put(a + 2, [div(a + 1, p2)]);
    put(a + 3, [div(a, p1)]);
    if (o.chance(0.6)) rule(a + 3, { kind: 'conflict', recordId: old, decision: 'payload', payload: { amount: p1 } });
    return { kind, a, rowsAt, uncoveredAt, rulesAfter, shapeAt: -1 };
  }
  if (kind === 'd01') {
    const [p1, p2, p3] = two();
    put(a, [div(a, p1), div(a, p2)]);
    rule(a, o.chance(0.5) ? { kind: 'conflict', recordId: old, decision: 'none' } : { kind: 'conflict', recordId: old, decision: 'payload', payload: { amount: p1 } });
    if (o.chance(0.5)) put(a + 1, [div(a, p1), div(a, p2)]);
    if (o.chance(0.75)) {
      const rows = [div(a, p3), div(a + 2, p3)];
      put(a + 2, o.chance(0.5) ? rows : rows.reverse());
      if (o.chance(0.5)) put(a + 3, rows);
    } else {
      put(a + 2, [div(a, p3)]);
      put(a + 3, [div(a + 3, p3)]);
    }
    return { kind, a, rowsAt, uncoveredAt, rulesAfter, shapeAt: -1 };
  }
  rule(a, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[a]}`, decision: 'split', ratio: 2 });
  const variant = o.pick(['two', 'two', 'one', 'agree', 'none']);
  const sp = (v) => rowOf('split', S[a], v);
  if (variant === 'two') { const q1 = o.pick(['3/2', '5/4', '3/1']); put(a + 1, [sp(q1), sp(o.pick(['3/2', '5/4', '3/1'].filter((x) => x !== q1)))]); }
  if (variant === 'one') put(a + 1, [sp(o.pick(['3/2', '5/4', '3/1']))]);
  if (variant === 'agree') put(a + 1, [sp('2/1')]);
  if (o.chance(0.8)) uncoveredAt.add(a + 1);
  return { kind, a, rowsAt, uncoveredAt, rulesAfter, shapeAt: a, variant };
}

export function generateWide(seed, { trace = null, ordered = false } = {}) {
  const r = rng(seed);
  const clean = r.chance(0.3);
  const n = 6 + r.int(10); // 6 to 15 sessions
  const comparison = r.chance(0.5) ? { type: 'same_stock_held' } : { type: 'frozen_basket', symbols: ['AAPL', 'MSFT'] };
  const feed = new Map(); // id → { sym, type, date, payloads, createdAt, first }
  const steps = [];
  const kinds = new Set([comparison.type === 'same_stock_held' ? 'comparison_same_stock' : 'comparison_frozen_basket']);
  const ambiguousSince = {};
  const shape = { AAPL: 1, SPY: 1 };
  let at = 0;
  const tag = (k, sym) => { kinds.add(k); kinds.add(`${sym}:${k}`); trace?.push(`@${at} ${sym} ${k}`); };
  const markAmbiguous = (id, i) => { if (!(id in ambiguousSince)) ambiguousSince[id] = i; };
  const add = (sym, type, i, payload) => {
    const row = rowOfSym(sym, type, S[i], payload);
    const id = deriveActionId(row);
    const e = feed.get(id) || { sym, type, date: i, payloads: [], createdAt: at, first: payload };
    if (!e.payloads.includes(payload)) e.payloads.push(payload);
    if (e.payloads.length > 1 && (e.createdAt === at || id in ambiguousSince)) markAmbiguous(id, at);
    feed.set(id, e);
    trace?.push(`@${at} add ${id} ${payload} -> [${e.payloads}]`);
    return id;
  };
  const recentSame = (sym, type, payload, i) => [...feed.values()].some((e) => e.sym === sym && e.type === type && e.payloads.includes(payload) && Math.abs(e.date - i) <= WINDOW);
  const priceAt = (sym, i) => {
    let p = WIDE_BASE[sym];
    for (const e of feed.values()) if (e.sym === sym && e.type === 'split' && e.date > 0 && e.date <= i) p /= ratioOf(e.payloads[0]);
    return Math.round(p * shape[sym] * 100) / 100;
  };
  if (r.chance(0.35)) { // a purchase on an ex-date, on either symbol
    const sym = r.pick(WIDE_SYMS);
    const type = r.chance(0.5) ? 'cash_dividend' : 'split';
    add(sym, type, 0, type === 'cash_dividend' ? r.pick(AMOUNTS) : r.pick(RATIOS));
    tag('purchase_on_ex_date', sym);
    if (!clean && r.chance(0.5)) { add(sym, type, 0, type === 'cash_dividend' ? r.pick(AMOUNTS) : r.pick(RATIOS)); tag('conflict', sym); }
  }
  const c04At = !clean && r.chance(0.2) ? 1 + r.int(Math.max(1, n - 3)) : -1;
  // (Final fix: the ordered chain, from its own stream — without `ordered` nothing below changes a single draw of `r`.)
  const chain = ordered && !clean ? orderedChain(rng((seed ^ 0x5bd1e995) >>> 0), n) : null;
  if (chain) tag(`chain_${chain.kind}`, 'AAPL');
  const chainRules = (i) => { for (const st of chain?.rulesAfter.get(i) || []) steps.push(st); };
  for (let i = 0; i < n; i += 1) {
    at = i;
    for (const sym of WIDE_SYMS) {
      const ev = r.next();
      if (i > 0 && ev < 0.2) {
        const amount = r.pick(AMOUNTS);
        const dated = i - r.int(2);
        if (!clean || !(recentSame(sym, 'cash_dividend', amount, dated) || recentSame(sym, 'cash_dividend', amount, i))) { add(sym, 'cash_dividend', dated, amount); tag('dividend', sym); }
      } else if (i > 0 && ev < 0.3) {
        const ratio = r.pick(RATIOS);
        if (!clean || !recentSame(sym, 'split', ratio, i)) { add(sym, 'split', i, ratio); tag('split', sym); }
      }
      if (!clean && i > 0) {
        const ids = [...feed.keys()].filter((id) => feed.get(id).sym === sym && i - feed.get(id).date <= WINDOW && feed.get(id).createdAt < i);
        const z = r.next();
        if (z < 0.1) {
          const type = r.chance(0.5) ? 'cash_dividend' : 'split';
          const pool = type === 'cash_dividend' ? AMOUNTS : RATIOS;
          const a = r.pick(pool); let b = r.pick(pool); if (b === a) b = pool[(pool.indexOf(a) + 1) % pool.length];
          add(sym, type, i, a); add(sym, type, i, b); tag('conflict', sym);
        } else if (z < 0.2 && ids.length > 0) {
          const id = r.pick(ids); const e = feed.get(id);
          const pool = e.type === 'cash_dividend' ? AMOUNTS : RATIOS;
          const p = pool.find((x) => !e.payloads.includes(x));
          if (p !== undefined) { if (r.chance(0.5)) e.payloads = [p]; else e.payloads.push(p); if (id in ambiguousSince) markAmbiguous(id, i); tag('revision', sym); }
        } else if (z < 0.3 && ids.length > 0) {
          const id = r.pick(ids); const e = feed.get(id);
          if (i > e.date) {
            const pick = r.pick(e.payloads);
            const newId = add(sym, e.type, i, pick);
            // (Only a payload a close has LISTED under the old id can be matched by the ledger — one added and dropped within
            // a session was never seen.)
            if (e.shown?.has(pick) && (id in ambiguousSince || pick === e.first)) markAmbiguous(newId, i);
            if (r.chance(0.5)) feed.delete(id);
            tag('redate', sym);
          }
        } else if (z < 0.35) {
          shape[sym] *= r.chance(0.5) ? 0.5 : 2; tag('split_shaped_move', sym);
        }
      }
    }
    if (chain?.shapeAt === i) shape.AAPL *= 0.5;
    const prices = { AAPL: priceAt('AAPL', i), SPY: priceAt('SPY', i) };
    if (c04At >= 0 && i === c04At) { prices.AAPL = Math.round(priceAt('AAPL', i) * 0.5 * 100) / 100; tag('c04_chain', 'AAPL'); }
    if (c04At >= 0 && i === c04At + 1) { add('AAPL', 'split', c04At, '2/1'); add('AAPL', 'cash_dividend', i, 1.5); prices.AAPL = Math.round(priceAt('AAPL', i) * 0.5 * 100) / 100; }
    const uncoveredSyms = WIDE_SYMS.filter((sym) => (!clean && i > 0 && r.chance(0.12)) || (sym === 'AAPL' && c04At >= 0 && i === c04At + 1));
    if (chain?.uncoveredAt.has(i) && !uncoveredSyms.includes('AAPL')) uncoveredSyms.push('AAPL');
    for (const sym of uncoveredSyms) tag('coverage_failure', sym);
    const chainRows = chain?.rowsAt.get(i) || [];
    const rowsBySym = { AAPL: [], SPY: [] };
    for (const [, e] of feed) {
      if (!(i - e.date >= 0 && i - e.date <= WINDOW)) continue;
      for (const p of e.payloads) { rowsBySym[e.sym].push(rowOfSym(e.sym, e.type, S[e.date], p)); (e.shown = e.shown || new Set()).add(p); }
    }
    if (!clean && i > 1 && i < n - 1 && i !== c04At && i !== c04At + 1 && r.chance(0.12)) {
      const listed = [...rowsBySym.AAPL, ...rowsBySym.SPY];
      // (Whether the stored backfill is EMPTY is drawn first: a disagreement in a backfill that is then emptied never reaches
      // a ledger, so the oracle must not mark it — wide seed 1184872765.)
      const mode = listed.length > 0 && r.chance(0.6) ? 'disagree' : 'agree';
      const backfillBySym = { AAPL: rowsBySym.AAPL.map((a) => ({ ...a })), SPY: rowsBySym.SPY.map((a) => ({ ...a })) };
      let disagreed = null;
      if (mode === 'disagree') {
        const syms = WIDE_SYMS.filter((x) => backfillBySym[x].length > 0);
        const sym = r.pick(syms);
        const k = r.int(backfillBySym[sym].length);
        const a = backfillBySym[sym][k];
        backfillBySym[sym][k] = a.type === 'cash_dividend' ? { ...a, amount: AMOUNTS.find((x) => x !== a.amount) } : { ...a, ratio: ratioOf(RATIOS.find((x) => ratioOf(x) !== a.ratio)) };
        disagreed = { id: deriveActionId(a), sym };
      }
      // (A backfill emptied after it was written never reaches a ledger: its disagreement is not marked — wide seed
      // 1184872765, an oracle error. The draws keep their order, so every seed writes the history it always wrote.)
      const emptied = r.chance(0.3);
      if (emptied) { backfillBySym.AAPL = []; backfillBySym.SPY = []; kinds.add('backfill_empty'); }
      else if (disagreed) {
        if (feed.get(disagreed.id)?.createdAt === i || disagreed.id in ambiguousSince) markAmbiguous(disagreed.id, i);
        tag('backfill_disagrees', disagreed.sym);
      } else kinds.add('backfill_agrees');
      // (A chain's rows join the archive — and the backfill, unless it was emptied — after the backfill's own draws.)
      if (chainRows.length > 0) { rowsBySym.AAPL.push(...chainRows); if (!emptied) backfillBySym.AAPL.push(...chainRows.map((a) => ({ ...a }))); }
      steps.push({ kind: 'catchup', i, prices, rowsBySym, backfillBySym, mode });
      chainRules(i);
      continue;
    }
    rowsBySym.AAPL.push(...chainRows);
    steps.push({ kind: 'close', i, prices, rowsBySym, uncoveredSyms });
    if (!clean && r.chance(0.35)) { steps.push({ kind: 'rule', pick: r.next(), decision: r.next(), ...(ordered ? { splitOk: true } : {}) }); kinds.add('founder_ruling'); }
    chainRules(i);
  }
  return { seed, wide: true, clean, comparison, steps, kinds: [...kinds], feed, ambiguousSince, ...(chain ? { chain: { kind: chain.kind, a: chain.a, ...(chain.variant ? { variant: chain.variant } : {}) } } : {}) };
}


// ── T1a-2b-4: THE LATE GENERATOR — late listings after a sale, late splits before paid dividends, settled-id revisions and
//    parse rejections, on one id and one ledger (the build prompt, §6). A separate generator, so every older seed's history
//    is unchanged. Each history: AAPL and MSFT bought on S[0] (the comparison same-stock, a frozen basket of AAPL and MSFT,
//    or a sector fund that does not hold AAPL), 8 to 12 sessions, and several of these chains on AAPL:
//      sale             a close below AAPL's line, then the next window sells it (the idea's holding history ends there);
//      late_after_sale  a dividend dated while it held AAPL, first listed after the sale — one payload, or two (ambiguous);
//      late_split       a split (forward, or a reverse 4-for-5) whose price move comes first, listed 1–3 sessions late,
//                       after one or two dividends dated on or after it were paid on time;
//      settled_revision a split or a dividend applied on time, then listed under the same id with another payload — and the
//                       founder keeps the original, chooses the correction, or does nothing;
//      parse            a session whose parse report for AAPL shows a rejected row, or is missing (its split, if any, listed
//                       the session after);
//    and background: on-time dividends, SPY dividends, coverage failures, the founder's random rulings.

export const LATE_KINDS = ['sale', 'late_after_sale', 'late_after_sale_ambiguous', 'late_split', 'late_reverse_split', 'two_dividends_late_split',
  'settled_revision_split', 'settled_revision_dividend', 'ruled_correction', 'ruled_keep', 'parse_rejection', 'parse_missing',
  'coverage_failure', 'dividend_on_time', 'spy_dividend', 'founder_ruling', 'comparison_same_stock', 'comparison_frozen_basket', 'comparison_sector_fund'];
const LATE_AMOUNTS = [0.31, 0.47, 0.62, 0.83, 1, 1.07, 1.19, 1.38, 1.66, 2.14, 0.58, 0.94];

export function generateLate(seed) {
  const r = rng(seed);
  const n = 8 + r.int(5);
  const comparison = r.pick([{ type: 'same_stock_held' }, { type: 'frozen_basket', symbols: ['AAPL', 'MSFT'] }, { type: 'sector_fund', symbols: ['XLK'] }]);
  const kinds = new Set([`comparison_${comparison.type === 'same_stock_held' ? 'same_stock' : (comparison.type === 'frozen_basket' ? 'frozen_basket' : 'sector_fund')}`]);
  const feed = new Map(); // id → { sym, type, d, versions: [{ from, payloads }] }
  const truthSplits = []; // { d, ratio } the price follows
  const used = [];
  const amount = () => { const free = LATE_AMOUNTS.filter((a) => !used.includes(a)); const a = free.length > 0 ? r.pick(free) : r.pick(LATE_AMOUNTS); used.push(a); return a; };
  const list = (sym, type, d, from, payloads) => {
    const row = rowOfSym(sym, type, S[d], payloads[0]);
    const id = deriveActionId(row);
    const e = feed.get(id) || { sym, type, d, versions: [] };
    e.versions.push({ from, payloads });
    e.versions.sort((a, b) => a.from - b.from);
    feed.set(id, e);
    return id;
  };
  const rulesAfter = new Map();
  const rule = (i, body) => rulesAfter.set(i, [...(rulesAfter.get(i) || []), { kind: 'ruleTry', body }]);
  let sk = -1;
  if (r.chance(0.6)) {
    sk = 2 + r.int(Math.max(1, n - 5));
    kinds.add('sale');
    if (r.chance(0.75)) {
      const de = Math.max(1, sk - 1 + r.int(3));
      const lf = Math.min(n - 1, sk + 2 + r.int(2));
      if (lf > sk + 1 && lf - de <= WINDOW) {
        const ambiguous = r.chance(0.25);
        list('AAPL', 'cash_dividend', de, lf, ambiguous ? [amount(), amount()] : [amount()]);
        kinds.add(ambiguous ? 'late_after_sale_ambiguous' : 'late_after_sale');
      }
    }
  }
  if (r.chance(0.5)) {
    const reverse = r.chance(0.25);
    const ds = 1 + r.int(Math.max(1, n - 4));
    const lag = 1 + r.int(3);
    if (ds + lag < n) {
      const ratio = reverse ? '4/5' : r.pick(RATIOS);
      list('AAPL', 'split', ds, ds + lag, [ratio]);
      truthSplits.push({ d: ds, ratio: ratioOf(ratio) });
      kinds.add(reverse ? 'late_reverse_split' : 'late_split');
      const de = ds + r.int(lag);
      list('AAPL', 'cash_dividend', de, de, [amount()]);
      if (r.chance(0.35) && de + 1 < ds + lag) { list('AAPL', 'cash_dividend', de + 1, de + 1, [amount()]); kinds.add('two_dividends_late_split'); }
    }
  }
  if (r.chance(0.45)) {
    const split = r.chance(0.5);
    const dr = 1 + r.int(Math.max(1, n - 4));
    const g = 1 + r.int(3);
    if (dr + g < n) {
      const p1 = split ? r.pick(RATIOS) : amount();
      let p2 = split ? r.pick(RATIOS) : amount();
      if (p2 === p1) p2 = split ? RATIOS[(RATIOS.indexOf(p1) + 1) % RATIOS.length] : amount();
      const id = list('AAPL', split ? 'split' : 'cash_dividend', dr, dr, [p1]);
      feed.get(id).versions.push({ from: dr + g, payloads: [p2] });
      if (split) truthSplits.push({ d: dr, ratio: ratioOf(p1) });
      kinds.add(split ? 'settled_revision_split' : 'settled_revision_dividend');
      const z = r.next();
      const pay = (p) => (split ? { ratio: ratioOf(p) } : { amount: p });
      if (z < 0.4) { rule(dr + g, { kind: 'conflict', recordId: id, decision: 'payload', payload: pay(p2) }); kinds.add('ruled_correction'); }
      else if (z < 0.7) { rule(dr + g, { kind: 'conflict', recordId: id, decision: 'payload', payload: pay(p1) }); kinds.add('ruled_keep'); }
    }
  }
  const parseAt = new Map();
  if (r.chance(0.35)) {
    const kp = 1 + r.int(Math.max(1, n - 2));
    const how = r.chance(0.5) ? 'reject' : 'missing';
    parseAt.set(kp, how);
    kinds.add(how === 'reject' ? 'parse_rejection' : 'parse_missing');
    if (r.chance(0.5) && kp + 1 < n) { const ratio = r.pick(RATIOS); list('AAPL', 'split', kp, kp + 1, [ratio]); truthSplits.push({ d: kp, ratio: ratioOf(ratio) }); }
  }
  for (let i = 1; i < n; i += 1) {
    if (r.chance(0.2)) { list('AAPL', 'cash_dividend', i, i, [amount()]); kinds.add('dividend_on_time'); }
    if (r.chance(0.15)) { list('SPY', 'cash_dividend', i, i, [r.pick([1.31, 1.62, 1.77, 1.9])]); kinds.add('spy_dividend'); }
  }
  const uncovered = new Set();
  for (let i = 1; i < n; i += 1) if (i !== sk && r.chance(0.12)) uncovered.add(i);
  if (uncovered.size > 0) kinds.add('coverage_failure');
  const priceAt = (i) => {
    let p = 100;
    for (const t of truthSplits) if (t.d <= i) p /= t.ratio;
    return Math.round(p * 100) / 100;
  };
  const steps = [];
  for (let i = 0; i < n; i += 1) {
    if (sk >= 0 && i === sk + 1) steps.push({ kind: 'window', i, prices: { AAPL: priceAt(i), SPY: 500 }, rowsBySym: {} });
    const rowsBySym = { AAPL: [], SPY: [] };
    for (const [, e] of feed) {
      const v = [...e.versions].reverse().find((x) => x.from <= i);
      if (!v || e.d > i || i - e.d > WINDOW) continue;
      for (const p of v.payloads) rowsBySym[e.sym].push(rowOfSym(e.sym, e.type, S[e.d], p));
    }
    steps.push({
      kind: 'close', i, prices: { AAPL: priceAt(i), SPY: 500 }, rowsBySym, uncoveredSyms: uncovered.has(i) ? ['AAPL'] : [],
      ...(i === sk ? { belowLine: true } : {}), ...(parseAt.has(i) ? { parse: parseAt.get(i) } : {}),
    });
    for (const x of rulesAfter.get(i) || []) steps.push(x);
    if (i > 0 && r.chance(0.15)) { steps.push({ kind: 'rule', pick: r.next(), decision: r.next() }); kinds.add('founder_ruling'); }
  }
  return { seed, steps, comparison, kinds: [...kinds].sort(), clean: false, late: true, n, saleAt: sk >= 0 ? sk + 1 : null };
}

// ── T1a-2b-4: ASTRA'S FOUR REPRODUCTIONS, AS FIXED CASES through every check (I-1 to I-6) ────────────────────────────
const lc = (i, aapl, rows = [], extra = {}) => ({ kind: 'close', i, prices: { AAPL: aapl, SPY: 500 }, rowsBySym: { AAPL: rows, SPY: [] }, uncoveredSyms: [], ...extra });
const lwin = (i, aapl) => ({ kind: 'window', i, prices: { AAPL: aapl, SPY: 500 }, rowsBySym: {} });
const late = (fn) => ({ late: fn });
export const FIXED_LATE = [
  // T2D-03: held Nov 17, sold Nov 18 (the line), a $1 dividend listed Nov 19 dated Nov 17 — $99.97 to the idea, once.
  { seed: 'astra-T2D-03', steps: [lc(0, 100), lc(1, 100, [], { belowLine: true }), lwin(2, 100), lc(2, 94), lc(3, 94, [d(1, 1)]), lc(4, 94, [d(1, 1)])],
    end: late((idea, book, soldAt) => {
      expect(soldAt).toBe(2);
      expect((idea.ledger.adjustments || []).map((a) => [a.kind, a.amountUsd])).toEqual([['late_entitlement', 99.97]]);
      expect(idea.ledger.dividendsUsd).toBe(99.97);
    }) },
  // …the comparison does not hold AAPL (a sector fund).
  { seed: 'astra-T2D-03-sector-fund', comparison: { type: 'sector_fund', symbols: ['XLK'] }, steps: [lc(0, 100), lc(1, 100, [], { belowLine: true }), lwin(2, 100), lc(2, 94), lc(3, 94, [d(1, 1)])],
    end: late((idea) => { expect(idea.ledger.dividendsUsd).toBe(99.97); expect(idea.comparisonLedger.dividendsUsd).toBe(0); }) },
  // T2D-04: a 5:4 dated Nov 17 (the price follows to $80), a $1 dated Nov 18 paid $99.97, the split listed Nov 19 — +$24.99.
  { seed: 'astra-T2D-04', steps: [lc(0, 100), lc(1, 80), lc(2, 80, [d(2, 1)]), lc(3, 80, [d(2, 1), sp(1, '5/4')]), lc(4, 80, [d(2, 1), sp(1, '5/4')])],
    end: late((idea, book) => {
      for (const f of ['ledger', 'comparisonLedger']) { expect(idea[f].dividendsUsd, f).toBe(124.96); expect(idea[f].holdings.AAPL.shares, f).toBe(124.96251); }
      expect(book.portfolio.positions.AAPL.shares).toBe(124.96251);
    }) },
  // …a reverse 4-for-5 listed late: a debit.
  { seed: 'astra-T2D-04-reverse', steps: [lc(0, 100), lc(1, 125), lc(2, 125, [d(2, 1)]), lc(3, 125, [d(2, 1), sp(1, '4/5')])],
    end: late((idea) => { expect(idea.ledger.dividendsUsd).toBe(79.98); }) },
  // T2D-05: 5:4 and $1 for Nov 17 settled, then 3:2 and $2 — ruled to the correction: 149.955012 shares and $299.91.
  { seed: 'astra-T2D-05', steps: [lc(0, 100), lc(1, 80, [sp(1, '5/4'), d(1, 1)]), lc(2, 66.67, [sp(1, '3/2'), d(1, 2)]),
    { kind: 'ruleExact', body: { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } } },
    { kind: 'ruleExact', body: { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } } },
    lc(3, 66.67), lc(4, 66.67, [sp(1, '3/2'), d(1, 2)])],
    end: late((idea, book) => {
      for (const f of ['ledger', 'comparisonLedger']) { expect(idea[f].holdings.AAPL.shares, f).toBe(149.955012); expect(idea[f].dividendsUsd, f).toBe(299.91); }
      expect(book.portfolio.positions.AAPL.shares).toBe(149.955012);
    }) },
  // T2D-12: Nov 17's split written `5:4` is rejected — the session is uncovered; listed properly on Nov 18, applied once.
  { seed: 'astra-T2D-12', steps: [lc(0, 100), lc(1, 80, [], { parse: 'reject' }),
    // (The rejected session is a day of doubt: AAPL uncovered, never marked $80 on 99.970008 shares at full quality.)
    at((idea) => { expect(idea.caCoverageGaps?.AAPL, 'S[1] is uncovered').toMatchObject({ reason: 'ca_parse_incomplete' }); expect(idea.ledger.holdings.AAPL.lastMark).not.toBe(80); }),
    lc(2, 80, [sp(1, '5/4'), d(2, 1)]), lc(3, 80, [sp(1, '5/4'), d(2, 1)])],
    end: late((idea) => { expect(idea.ledger.holdings.AAPL.shares).toBe(124.96251); expect(idea.ledger.dividendsUsd).toBe(124.96); }) },
  // The fix round's reviewer cases (each failed at c08944d6). AR4-A-1 + A-4: after the sale, a split listed two ways and a
  // dividend dated after it in ONE close — the dividend waits on the conflict; the founder's 5:4 enters the history and the
  // dividend is paid on it, once.
  { seed: 'review-AR4-A-1', comparison: { type: 'sector_fund', symbols: ['XLK'] }, steps: [lc(0, 100), lc(1, 100, [], { belowLine: true }), lwin(2, 100), lc(2, 94),
    lc(3, 94, [sp(1, '5/4'), sp(1, '3/2'), d(2, 1)]),
    at((idea) => { expect(idea.ledger.adjustments || [], 'nothing paid while the split is ambiguous').toEqual([]); }),
    { kind: 'ruleExact', body: { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } } },
    lc(4, 94, [sp(1, '5/4'), sp(1, '3/2'), d(2, 1)]), lc(5, 94)],
    end: late((idea) => { expect(idea.ledger.dividendsUsd).toBe(124.96); expect((idea.founderRulings || []).every((r) => r.appliedOn != null && r.outcome !== 'moot')).toBe(true); }) },
  // AR4-C-1: 5:4 settled, a 2:1 dated later applied, the 5:4 corrected to 3:2, then a $1 dated between them listed late —
  // paid on the corrected count (149.955012), as the other arrival order pays.
  { seed: 'review-AR4-C-1', steps: [lc(0, 100), lc(1, 80, [sp(1, '5/4')]), lc(2, 80), lc(3, 40, [sp(3, '2/1')]), lc(4, 33.33, [sp(1, '3/2')]),
    { kind: 'ruleExact', body: { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } } },
    lc(5, 33.33), lc(6, 33.33, [d(2, 1)]), lc(7, 33.33, [d(2, 1)])],
    end: late((idea) => { for (const f of ['ledger', 'comparisonLedger']) expect(idea[f].dividendsUsd, f).toBe(149.96); }) },
];

/** T1a-2b-4: the late soak's findings, kept as fixed seeds of the late generator (each failed at the commit before its fix):
 *  1911240021 a late entitlement's place among the receipts; 1795727711, 1795727357 the book's mirror of a ruled split
 *  correction; 1795729395, 1795728065 a closed holding's row that waited on a doubt; 1795731088, 1795732944, 1795729025 a
 *  closed holding's re-date screen and the rows dated outside its holding; 1795727403, 1795729529, 1795731153, 1795731607
 *  a ruled id left in the hold set (the final soak). */
export const LATE_SOAK_SEEDS = [1911240021, 1795727711, 1795727357, 1795729395, 1795728065, 1795731088, 1795732944, 1795729025,
  // The final soak at de858e26 (I-5): a ruling that settles a sold holding's split record at its close left that record in
  // the hold set the other ledgers' appliers read, so the comparison's later dividend waited at the ruling's close and the
  // re-run paid it. Each failed at de858e26.
  1795727403, 1795729529, 1795731153, 1795731607];

// ── T1a-2b-4 FIX ROUND (late data asks, 20 Nov 2026): ASTRA'S NAMED HISTORIES, AS FIXED PLANS ───────────────────────────────
// Her review names each history by a seed of her own generator extension, which is not in the attachment: these plans are
// RECONSTRUCTED FROM HER DESCRIPTION (her findings and execution record — dates, rows, order, prices, comparison arm and
// founder decisions), one plan per named seed, through the same harness and every check (I-1 to I-7). Expectations are the
// founder's ruling's (L-1 to L-8): late data is proposed, named and held; only the founder's approval or ruling moves it.
const xlk = { type: 'sector_fund', symbols: ['XLK'] };
const rc = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
const soldAtS2 = () => [rc(0, 100), rc(1, 94, [], { belowLine: true }), { kind: 'window', i: 2, price: 94 }, rc(2, 94)];
const ownIncome = (usd) => at((idea) => { expect(idea.ledger.dividendsUsd, 'the idea own income').toBe(usd); });
export const adjustmentsPosted = (idea) => ['ledger', 'comparisonLedger', 'spyLedger'].flatMap((f) => (idea[f]?.adjustments || []).filter((a) => a && a.held !== true).map((a) => [f, a.kind, a.actionId, a.amountUsd]));
const nothingPosted = at((idea) => { expect(adjustmentsPosted(idea), 'no adjustment posted without the founder').toEqual([]); });
const recordsOf = (idea, f = 'ledger') => (idea[f]?.corporateActionReceipts || []).filter((r) => r.reason === POSSIBLE_REDATE || r.reason === CONFLICTING_ACTION).map((r) => [r.reason, r.actionId]).sort();
const belowFullQuality = (i) => at((idea, book, label, ctx) => { expect(ctx.row(S[i])?.fullQuality, `${label} the S${i} row is below full quality`).toBe(false); });
const div1 = `cash_dividend_AAPL_${S[1]}`;
const div2 = `cash_dividend_AAPL_${S[2]}`;
const ten = (i, v) => rowOf('split', S[i], v);

export const ASTRA_T2E = [
  // T2E-01 — two first-seen dividend dates, delivered together after the sale (S1 and S2, both while held).
  { seed: 'astra-2011202700', comparison: xlk, steps: [...soldAtS2(), rc(3, 94, [d(1, 1), d(2, 1)]),
    at((idea) => {
      expect(recordsOf(idea), 'both ids are ambiguous on the sold holding').toEqual([[POSSIBLE_REDATE, div1], [POSSIBLE_REDATE, div2]].sort());
      expect(idea.ledger.dividendsUsd).toBe(0);
    }), nothingPosted, belowFullQuality(3), rc(4, 94)] },
  // …the array reversed, and a same-stock comparison that still holds AAPL (it holds both ids too, and pays nothing).
  { seed: 'astra-2011202701', steps: [...soldAtS2(), rc(3, 94, [d(2, 1), d(1, 1)]),
    at((idea) => {
      expect(recordsOf(idea)).toEqual([[POSSIBLE_REDATE, div1], [POSSIBLE_REDATE, div2]].sort());
      expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd]).toEqual([0, 0]);
    }), nothingPosted, rc(4, 94)] },
  // …a single-name idea, RESULTED at the sale: nothing posts to the treasury (L-8); the late rows are named on the idea.
  { seed: 'astra-2011202706', names: ['AAPL'], comparison: xlk, steps: [...soldAtS2(),
    at((idea) => { expect(idea.status, 'resulted at the sale').toBe('resulted'); }),
    at((idea, book, label, ctx) => { ctx.keep.treasury = book.treasury.unreservedCash; }),
    rc(3, 94, [d(1, 1), d(2, 1)]),
    at((idea, book, label, ctx) => {
      expect(adjustmentsPosted(idea)).toEqual([]);
      expect(book.treasury.unreservedCash, 'nothing posted to the treasury').toBe(ctx.keep.treasury);
      expect((idea.lateDataUnsettled?.actions || []).map((a) => a.actionId).sort(), 'named on the resulted idea').toEqual([div1, div2]);
    }), rc(4, 94)] },
  // T2E-02 — a dividend moved back across the sale: $1 dated S3 (after it) listed at S3, then only $1 dated S2.
  { seed: 'astra-2011202702', comparison: xlk, steps: [...soldAtS2(), rc(3, 94, [d(3, 1)]), rc(4, 94, [d(2, 1)]),
    at((idea) => {
      expect(recordsOf(idea), 'the moved row is a possible re-date of the row it was listed as').toEqual([[POSSIBLE_REDATE, div2]]);
      expect(idea.ledger.dividendsUsd).toBe(0);
    }), nothingPosted, belowFullQuality(4), rc(5, 94)] },
  // …a same-stock comparison: it applied the S3 row while it held AAPL, and holds the moved one.
  { seed: 'astra-2011202703', steps: [...soldAtS2(), rc(3, 94, [d(3, 1)]), rc(4, 94, [d(2, 1)]),
    at((idea) => {
      expect(recordsOf(idea)).toEqual([[POSSIBLE_REDATE, div2]]);
      expect(recordsOf(idea, 'comparisonLedger')).toEqual([[POSSIBLE_REDATE, div2]]);
      expect(idea.ledger.dividendsUsd).toBe(0);
      expect(idea.comparisonLedger.dividendsUsd, 'the comparison was paid the S3 row it held').toBe(99.97);
    }), nothingPosted, rc(5, 94)] },
  // T2E-03 — $1 paid on S2; revised to $2 on S3 (open revision); on S4 the $2 row with a 5:4 dated S1 and an $80 quote.
  { seed: 'astra-2011202704', comparison: xlk, steps: [rc(0, 100), rc(1, 100), rc(2, 100, [d(2, 1)]), rc(3, 100, [d(2, 2)]), rc(4, 80, [sp(1, '5/4'), d(2, 2)]),
    ownIncome(99.97), nothingPosted, belowFullQuality(4),
    at((idea) => {
      expect(idea.ledger.holdings.AAPL.shares, 'the count follows the split').toBe(124.96251);
      const p = (idea.ledger.lateProposals || []).find((x) => x.actionId === div2 && x.status === 'open');
      expect(p, 'the late split is a proposal on the disputed dividend').toBeTruthy();
      expect(p.blockers.some((b) => b.startsWith('id_unresolved')), 'approval refused while the id is unresolved').toBe(true);
    }), rc(5, 80), ownIncome(99.97)] },
  // …all three ordinary windows serviced (no sale).
  { seed: 'astra-2011202705', comparison: xlk, steps: [rc(0, 100), { kind: 'window', i: 1, price: 100 }, rc(1, 100), { kind: 'window', i: 2, price: 100 }, rc(2, 100, [d(2, 1)]),
    { kind: 'window', i: 3, price: 100 }, rc(3, 100, [d(2, 2)]), rc(4, 80, [sp(1, '5/4'), d(2, 2)]), ownIncome(99.97), nothingPosted] },
  // …the ruled control: the founder chooses $2 — the net is posted once, on the dated count: $249.93 in all.
  { seed: 'astra-2011202707', comparison: xlk, steps: [rc(0, 100), rc(1, 100), rc(2, 100, [d(2, 1)]), rc(3, 100, [d(2, 2)]), rc(4, 80, [sp(1, '5/4'), d(2, 2)]),
    ownIncome(99.97),
    { kind: 'ruleExact', body: { kind: 'conflict', recordId: div2, decision: 'payload', payload: { amount: 2 } } },
    rc(5, 80), ownIncome(249.93),
    at((idea) => {
      expect(adjustmentsPosted(idea).filter(([f]) => f === 'ledger'), 'one posting').toEqual([['ledger', 'ruled_correction', div2, 149.96]]);
      expect((idea.ledger.lateProposals || []).filter((x) => x.status === 'open'), 'the proposal is settled by the ruling').toEqual([]);
    }), rc(6, 80), ownIncome(249.93)] },
];

/** T2E-06 (Q-9): same-date 10-for-1 and 1-for-10 under two ids, from a $100 close, with a $1 dividend of that date and the
 *  line's sale enabled at the next window — 2011202612 to 2011202619: prices $10, $10.10, $10.20, $10.40, each in both
 *  listing orders. Under L-5 every one HOLDS: no dividend, no sale, the count unmoved. */
export const ASTRA_T2E06 = [10, 10.1, 10.2, 10.4].flatMap((price, k) => [0, 1].map((order) => {
  const rows = [ten(1, '10/1'), ten(1, '1/10'), d(1, 1)];
  return {
    seed: `astra-${2011202612 + k * 2 + order}`, comparison: xlk,
    steps: [rc(0, 100), rc(1, price, order === 0 ? rows : [rows[1], rows[0], rows[2]]), { kind: 'window', i: 2, price }, rc(2, price),
      at((idea) => {
        expect(idea.ledger.dividendsUsd, 'no dividend on the held count').toBe(0);
        expect(idea.ledger.holdings.AAPL?.shares, 'no sale, the count unmoved').toBe(SH);
        expect(recordsOf(idea).map(([, id]) => id), 'both ids are one ambiguity').toEqual([`reverse_split_AAPL_${S[1]}`, `split_AAPL_${S[1]}`]);
      })],
  };
}));

/** T2E-04: `precision-4/5-2/1-3.23` — a 4-for-5 effective S1, a 2-for-1 S2, closes $125, $62.50, $62.50, $3.23 a share
 *  on S3: on time, and with the S1 listing withheld until S3 (rows in either order); sector and same-stock. Every
 *  affected ledger and the book: 159.952012 shares and $516.64. */
const precisionSteps = (arm, reversed) => {
  const late = [sp(1, '4/5'), sp(2, '2/1'), d(3, 3.23)];
  return arm === 'on-time'
    ? [rc(0, 100), rc(1, 125, [sp(1, '4/5')]), rc(2, 62.5, [sp(1, '4/5'), sp(2, '2/1')]), rc(3, 62.5, late)]
    : [rc(0, 100), rc(1, 125), rc(2, 62.5, [sp(2, '2/1')]), rc(3, 62.5, reversed ? [...late].reverse() : late)];
};
export const ASTRA_T2E04 = [['on-time', false], ['late', false], ['late', true]].flatMap(([arm, reversed]) => [xlk, null].map((comparison) => ({
  seed: `precision-4/5-2/1-3.23-${arm}${reversed ? '-reversed' : ''}-${comparison ? 'sector' : 'same-stock'}`, ...(comparison ? { comparison } : {}),
  steps: [...precisionSteps(arm, reversed), at((idea, book) => {
    expect(idea.ledger.holdings.AAPL.shares).toBe(159.952012);
    expect(idea.ledger.dividendsUsd).toBe(516.64);
    expect(book.portfolio.positions.AAPL.shares, 'the book mirror').toBe(159.952012);
    if (!comparison) { expect(idea.comparisonLedger.holdings.AAPL.shares).toBe(159.952012); expect(idea.comparisonLedger.dividendsUsd).toBe(516.64); }
  })],
})));

/** T2E-08: `sold-sector-rejected-Tue-dividend-Wed` — AAPL sold on S2 (MSFT kept); on S4 the parse report rejects a split
 *  dated S1 (`5:4`); on Monday S5 (a window from November 18) a $1 dividend dated S2 is first listed. Sector arm, and the
 *  same-stock control: $0 and below full quality on both. */
export const ASTRA_T2E08 = [xlk, null].map((comparison) => ({
  seed: `sold-${comparison ? 'sector' : 'same-stock'}-rejected-Tue-dividend-Wed`, ...(comparison ? { comparison } : {}),
  steps: [...soldAtS2(), rc(3, 94), rc(4, 94, [], { parse: { reject: 1 } }), rc(5, 94, [d(2, 1)]),
    at((idea) => {
      expect(idea.ledger.dividendsUsd, 'the sold ledger').toBe(0);
      if (!comparison) expect(idea.comparisonLedger.dividendsUsd, 'the same-stock comparison').toBe(0);
      expect(adjustmentsPosted(idea)).toEqual([]);
    }), belowFullQuality(5)],
}));
