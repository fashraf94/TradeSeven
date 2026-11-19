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
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, getRow, closeNowOf, storeCloseSnapshot, founderRules, takeSeededDbs,
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

const quotes = (p, rows) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: rows }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 } });
/** A step's quotes: a narrow plan's AAPL price and rows, or a wide plan's per-symbol prices and rows (AAPL and SPY). */
const quotesOf = (step) => {
  if (!step.prices) return quotes(step.price, step.rows);
  return {
    AAPL: { price: step.prices.AAPL, marketCap: 3e12, corporateActions: step.rowsBySym.AAPL || [] },
    MSFT: { price: 200, marketCap: 3e12 },
    SPY: { price: step.prices.SPY, corporateActions: step.rowsBySym.SPY || [] },
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
function checkAfterClose(c, date, oracleSince = null, tied = true) {
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
  if (LEDGERS.some((f) => openAmbiguities(idea[f]).length > 0)) expect(getRow(c.db, c.bookId, c.ideaId, date).fullQuality, `${date} I-2 quality`).toBe(false);
  // I-2 against the ORACLE (not the product's own predicate): an id the feed made ambiguous at session s is applied at a
  // close on or after s only by the founder's ruling.
  for (const [id, since] of Object.entries(oracleSince || {})) {
    for (const f of LEDGERS) {
      for (const x of idea[f].corporateActionReceipts.filter((r) => r.actionId === id && r.applied === true && r.appliedOn >= S[since])) {
        expect(x.founderRuling, `${date} I-2 oracle ${f} ${id} (ambiguous since ${S[since]}) applied without a ruling`).toBeTruthy();
      }
    }
  }
}

/** I-5: the book's cursor put back one session and the close run again on the state it left — nothing more moves. */
async function rerunAdds(c, date, previous) {
  const before = money(c);
  const ref = c.db.doc(`mandates/${c.bookId}`);
  const book = getBook(c.db, c.bookId);
  await ref.set({ ...book, execState: { ...book.execState, lastCloseKey: previous } });
  // (The close's window record is created once — T1a-2b-1's window ledger — so the re-run needs it gone; it holds no money.)
  for (const path of [...c.db._store.keys()]) if (path.startsWith(`mandates/${c.bookId}/windows/${date}`)) c.db._store.delete(path);
  const revision = getIdea(c.db, c.bookId, c.ideaId).revision;
  await closeIdeaBook(c.db, c.bookRef, { date, now: closeNowOf(date) });
  // (The re-run must actually have closed the idea again, or the check proves nothing.)
  expect(getIdea(c.db, c.bookId, c.ideaId).revision, `${date} I-5 re-ran`).toBeGreaterThan(revision);
  expect(money(c), `${date} I-5`).toBe(before);
}

/** The founder rules on one open record, chosen by `pick`, with a payload it holds (or `none`) chosen by `decision`. */
async function ruleSomething(c, pick, decision) {
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  const open = [...new Map(LEDGERS.flatMap((f) => openAmbiguities(idea[f])).map((r) => [r.actionId, r])).values()];
  // (A suspicion on any ledger's holding — the idea's AAPL, or the SPY line's SPY in a wide history.)
  const suspicions = LEDGERS.flatMap((f) => Object.entries(idea[f].holdings || {}).filter(([, h]) => h?.basisSuspicion).map(([sym, h]) => ({ sym, s: h.basisSuspicion })));
  const suspicion = suspicions[0] ?? null;
  if (open.length === 0 && !suspicion) return null;
  if (open.length === 0 || (suspicion && pick < 0.2)) {
    return founderRules(c.db, c.bookId, c.ideaId, { kind: 'suspicion', recordId: `suspected_split_${suspicion.sym}_${suspicion.s.suspectedOn}`, decision: 'price_move' }, { requestKey: `seq-${Math.round(pick * 1e9)}`, expectOk: false });
  }
  const r = open[Math.floor(pick * open.length)];
  const rows = Array.isArray(r.rows) && r.rows.length > 0 ? r.rows : [{ ratio: r.ratio ?? null, amount: r.amount ?? null }];
  const choice = r.reason === 'revised_after_ruling' ? null : rows[Math.floor(decision * (rows.length + 1))];
  const body = choice ? { decision: 'payload', payload: { ...(choice.ratio != null ? { ratio: choice.ratio } : {}), ...(choice.amount != null ? { amount: choice.amount } : {}) } } : { decision: 'none' };
  return founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: r.actionId, ...body }, { requestKey: `seq-${Math.round(pick * 1e9)}`, expectOk: false });
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
  try { return await runInner(plan, (ctx) => { c = ctx; }); } catch (e) { if (e && typeof e === 'object') e.sequenceContext = c; throw e; }
}
async function runInner(plan, expose) {
  const ctx = await seedBook();
  const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, ...(plan.comparison ? { comparison: plan.comparison } : {}) }), quotes: quotes(100, []), date: S[0] });
  const c = { ...ctx, ideaId: a.ideaId };
  expose(c);
  const entered = getIdea(c.db, c.bookId, c.ideaId);
  const initial = { ...entered.ledger.holdings.AAPL };
  const initialOf = { ledger: { ...entered.ledger.holdings.AAPL }, comparisonLedger: { ...entered.comparisonLedger.holdings.AAPL }, spyLedger: { ...entered.spyLedger.holdings.SPY } };
  const tied = (plan.comparison?.type ?? 'same_stock_held') === 'same_stock_held';
  let closes = 0;
  let previous = getBook(c.db, c.bookId).execState?.lastCloseKey ?? null;
  for (const [n, step] of plan.steps.entries()) {
    if (step.kind === 'rule') { await ruleSomething(c, step.pick, step.decision); continue; }
    if (step.kind === 'ruleExact') {
      const out = await founderRules(c.db, c.bookId, c.ideaId, step.body, { requestKey: `fixed-${n}`, expectOk: false });
      expect(out.status, `${plan.seed} ruling ${n}`).toBe(step.status ?? 200);
      continue;
    }
    const date = S[step.i];
    await storeCloseSnapshot(c.db, date, quotesOf(step));
    if (step.kind === 'catchup') {
      const bySym = step.backfillBySym ?? { AAPL: step.backfill };
      for (const [sym, rows] of Object.entries(bySym)) {
        await c.db.doc(`practiceFieldCaBackfill/${sym}`).set({ schemaVersion: 1, symbol: sym, from: S[0], to: date, failed: false, actions: rows, calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
      }
      const fetchCorporateActions = async (sym) => ({ failed: false, calls: 2, actions: bySym[sym] ?? [] });
      await catchUpIdeaBook(c.db, c.bookRef, { before: S[step.i + 1], now: closeNowOf(S[step.i + 1]), fetchCorporateActions });
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
    checkAfterClose(c, date, plan.ambiguousSince, tied);
    if (previous !== null) { await rerunAdds(c, date, previous); closes += 1; }
    checkAfterClose(c, date, plan.ambiguousSince, tied);
    previous = date;
  }
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  if (typeof plan.seed === 'number') tallyReached(idea);
  if (plan.clean) {
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
  if (plan.end) {
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd], `${plan.seed} dividends`).toEqual([plan.end.dividends, plan.end.dividends]);
    expect([idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, getBook(c.db, c.bookId).portfolio.positions.AAPL.shares], `${plan.seed} shares`).toEqual([plan.end.shares, plan.end.shares, plan.end.shares]);
  }
  return { idea, closes };
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
  'backfill_agrees', 'backfill_disagrees', 'founder_ruling', 'c04_chain'];

export function generateWide(seed, { trace = null } = {}) {
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
    const prices = { AAPL: priceAt('AAPL', i), SPY: priceAt('SPY', i) };
    if (c04At >= 0 && i === c04At) { prices.AAPL = Math.round(priceAt('AAPL', i) * 0.5 * 100) / 100; tag('c04_chain', 'AAPL'); }
    if (c04At >= 0 && i === c04At + 1) { add('AAPL', 'split', c04At, '2/1'); add('AAPL', 'cash_dividend', i, 1.5); prices.AAPL = Math.round(priceAt('AAPL', i) * 0.5 * 100) / 100; }
    const uncoveredSyms = WIDE_SYMS.filter((sym) => (!clean && i > 0 && r.chance(0.12)) || (sym === 'AAPL' && c04At >= 0 && i === c04At + 1));
    for (const sym of uncoveredSyms) tag('coverage_failure', sym);
    const rowsBySym = { AAPL: [], SPY: [] };
    for (const [, e] of feed) {
      if (!(i - e.date >= 0 && i - e.date <= WINDOW)) continue;
      for (const p of e.payloads) { rowsBySym[e.sym].push(rowOfSym(e.sym, e.type, S[e.date], p)); (e.shown = e.shown || new Set()).add(p); }
    }
    if (!clean && i > 1 && i < n - 1 && i !== c04At && i !== c04At + 1 && r.chance(0.12)) {
      const listed = [...rowsBySym.AAPL, ...rowsBySym.SPY];
      const mode = listed.length > 0 && r.chance(0.6) ? 'disagree' : 'agree';
      const backfillBySym = { AAPL: rowsBySym.AAPL.map((a) => ({ ...a })), SPY: rowsBySym.SPY.map((a) => ({ ...a })) };
      if (mode === 'disagree') {
        const syms = WIDE_SYMS.filter((x) => backfillBySym[x].length > 0);
        const sym = r.pick(syms);
        const k = r.int(backfillBySym[sym].length);
        const a = backfillBySym[sym][k];
        backfillBySym[sym][k] = a.type === 'cash_dividend' ? { ...a, amount: AMOUNTS.find((x) => x !== a.amount) } : { ...a, ratio: ratioOf(RATIOS.find((x) => ratioOf(x) !== a.ratio)) };
        if (feed.get(deriveActionId(a))?.createdAt === i || deriveActionId(a) in ambiguousSince) markAmbiguous(deriveActionId(a), i);
        tag('backfill_disagrees', sym);
      } else kinds.add('backfill_agrees');
      if (r.chance(0.3)) { backfillBySym.AAPL = []; backfillBySym.SPY = []; }
      steps.push({ kind: 'catchup', i, prices, rowsBySym, backfillBySym, mode });
      continue;
    }
    steps.push({ kind: 'close', i, prices, rowsBySym, uncoveredSyms });
    if (!clean && r.chance(0.35)) { steps.push({ kind: 'rule', pick: r.next(), decision: r.next() }); kinds.add('founder_ruling'); }
  }
  return { seed, wide: true, clean, comparison, steps, kinds: [...kinds], feed, ambiguousSince };
}
