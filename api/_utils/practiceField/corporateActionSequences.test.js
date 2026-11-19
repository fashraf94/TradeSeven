// api/_utils/practiceField/corporateActionSequences.test.js
//
// Practice Field T1a-2b-3, FIX ROUND 2 — Amendment F revision 1, S-6: THE INVARIANTS, TESTED OVER GENERATED SEQUENCES.
// A seeded generator writes vendor histories for one idea (AAPL and MSFT, entered on S[0]): purchases on ex-dates,
// conflicts, revisions, re-dates, coverage failures, catch-ups whose backfill agrees or disagrees with the archive,
// split-shaped price paths, founder rulings and re-run closes. Each history is driven through the REAL close, catch-up and
// founder action against the fake database, and after EVERY close:
//   I-1  no id is both applied and declined on a ledger;
//   I-2  an id that ever became ambiguous has moved no cash and no shares except by the founder's ruling, holds no
//        replayable record, and while any record stays open the row is below full quality;
//   I-3  the book reconciles to its ideas (reconcile.js), and the same-stock comparison stays tied to the idea;
//   I-5  re-running the close (the book's cursor put back one session) adds nothing — no cash, no shares, no id settled.
// And at the end of a history with complete coverage and no ambiguity:
//   I-4  the money is what the ENGINE'S OWN APPLIER gives over the same rows in date order with entitlement
//        (mandateCorporateActions.js applyCorporateAction — never the ledger's applyActions, which is under test).
// The classes the seeds produce are counted, so a generator that never reaches an order cannot pass vacuously.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { closeIdeaBook, catchUpIdeaBook } from './close.js';
import { parseSplitsPayload, parseDividendsPayload, applyCorporateAction, deriveActionId } from '../mandateCorporateActions.js';
import { openAmbiguities, CONFLICTING_ACTION, POSSIBLE_REDATE } from './ledger.js';
import { addUsd } from './money.js';
import { nextSessionDate } from './windows.js';
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, getRow, closeNowOf, storeCloseSnapshot, founderRules, takeSeededDbs,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16'];
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
const rowOf = (type, date, payload) => (type === 'cash_dividend'
  ? parseDividendsPayload('AAPL', [{ date, unadjustedValue: payload }]).actions[0]
  : parseSplitsPayload('AAPL', [{ date, split: payload }]).actions[0]);
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
const money = (c) => {
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  const book = getBook(c.db, c.bookId);
  return JSON.stringify({
    ledgers: LEDGERS.map((f) => ({ cash: idea[f].cash, dividends: idea[f].dividendsUsd, shares: Object.fromEntries(Object.entries(idea[f].holdings).map(([s, h]) => [s, h.shares])), applied: [...idea[f].appliedActionIds].sort(), declined: [...idea[f].declinedActionIds].sort() })),
    book: { cash: book.portfolio.cash, shares: Object.fromEntries(Object.entries(book.portfolio.positions).map(([s, p]) => [s, p.shares])) },
  });
};

/** What the generated histories actually REACHED in the product (counted, asserted at the end). */
const reached = { payloadAddedLater: 0, redateOfAmbiguous: 0, uncoveredTransition: 0, revisedAfterRuling: 0 };
function tallyReached(idea) {
  const l = idea.ledger;
  const records = l.corporateActionReceipts.filter((r) => r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE);
  if (records.some((r) => r.lastRevisedOn)) reached.payloadAddedLater += 1;
  const ambiguousIds = new Set(records.map((r) => r.actionId));
  if (records.some((r) => r.reason === POSSIBLE_REDATE && ambiguousIds.has(r.redateOf))) reached.redateOfAmbiguous += 1;
  const h = l.holdings.AAPL;
  const transitions = [...(h?.basisSuspicion?.transitions || []), ...(h?.basisSuspicionHistory || []).flatMap((x) => x.transitions || [])];
  if (transitions.some((t) => t.uncovered) || (h?.basisSuspicion && h.basisSuspicion.raisedBy?.explainedBy)) reached.uncoveredTransition += 1;
  if (l.corporateActionReceipts.some((r) => r.reason === 'revised_after_ruling')) reached.revisedAfterRuling += 1;
}

/** Every invariant that holds after every close (I-1, I-2, I-3). `oracle`: the generator's own record of ambiguous ids. */
function checkAfterClose(c, date, oracleSince = null) {
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  const book = getBook(c.db, c.bookId);
  // I-3: the book reconciles to its ideas, and the same-stock comparison is tied to the idea (no fill is ever made here).
  assertReconciled(book, book.openIdeaIds.map((id) => getIdea(c.db, c.bookId, id)));
  for (const sym of Object.keys(idea.ledger.holdings)) expect(idea.comparisonLedger.holdings[sym]?.shares, `${date} I-3 ${sym}`).toBe(idea.ledger.holdings[sym].shares);
  expect(idea.comparisonLedger.dividendsUsd, `${date} I-3 dividends`).toBe(idea.ledger.dividendsUsd);
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
  const suspicion = idea.ledger.holdings.AAPL?.basisSuspicion;
  if (open.length === 0 && !suspicion) return null;
  if (open.length === 0 || (suspicion && pick < 0.2)) {
    return founderRules(c.db, c.bookId, c.ideaId, { kind: 'suspicion', recordId: `suspected_split_AAPL_${suspicion.suspectedOn}`, decision: 'price_move' }, { requestKey: `seq-${Math.round(pick * 1e9)}`, expectOk: false });
  }
  const r = open[Math.floor(pick * open.length)];
  const rows = Array.isArray(r.rows) && r.rows.length > 0 ? r.rows : [{ ratio: r.ratio ?? null, amount: r.amount ?? null }];
  const choice = r.reason === 'revised_after_ruling' ? null : rows[Math.floor(decision * (rows.length + 1))];
  const body = choice ? { decision: 'payload', payload: { ...(choice.ratio != null ? { ratio: choice.ratio } : {}), ...(choice.amount != null ? { amount: choice.amount } : {}) } } : { decision: 'none' };
  return founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: r.actionId, ...body }, { requestKey: `seq-${Math.round(pick * 1e9)}`, expectOk: false });
}

/** I-4's oracle: the engine's own applier over the history's final rows, in date order, with entitlement. */
function oracle(initialHolding, feed) {
  const actions = [];
  for (const [, e] of feed) {
    const a = rowOf(e.type, S[e.date], e.payloads[0]);
    actions.push({ ...a, actionId: deriveActionId(a) });
  }
  const phase = (a) => (SHARE_BASIS.has(a.type) ? 0 : 1);
  actions.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || phase(a) - phase(b) || a.actionId.localeCompare(b.actionId));
  let state = { positions: { AAPL: { ...initialHolding } }, cash: 0 };
  let dividends = 0;
  for (const a of actions) {
    if (!(initialHolding.openedAt < a.effectiveDate)) continue; // a buy on or after the effective date is not entitled
    const out = applyCorporateAction(state, a);
    expect(out.ok).toBe(true);
    state = { positions: out.positions, cash: out.cash };
    dividends = addUsd(dividends, out.incomeUsd);
  }
  return { shares: state.positions.AAPL.shares, dividends };
}

/** Run one history through the real close; check every invariant as it goes. */
async function run(plan) {
  const ctx = await seedBook();
  const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000 }), quotes: quotes(100, []), date: S[0] });
  const c = { ...ctx, ideaId: a.ideaId };
  const initial = { ...getIdea(c.db, c.bookId, c.ideaId).ledger.holdings.AAPL };
  let previous = getBook(c.db, c.bookId).execState?.lastCloseKey ?? null;
  for (const [n, step] of plan.steps.entries()) {
    if (step.kind === 'rule') { await ruleSomething(c, step.pick, step.decision); continue; }
    if (step.kind === 'ruleExact') {
      const out = await founderRules(c.db, c.bookId, c.ideaId, step.body, { requestKey: `fixed-${n}`, expectOk: false });
      expect(out.status, `${plan.seed} ruling ${n}`).toBe(step.status ?? 200);
      continue;
    }
    const date = S[step.i];
    await storeCloseSnapshot(c.db, date, quotes(step.price, step.rows));
    if (step.kind === 'catchup') {
      const backfill = { schemaVersion: 1, symbol: 'AAPL', from: S[0], to: date, failed: false, actions: step.backfill, calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' };
      await c.db.doc('practiceFieldCaBackfill/AAPL').set(backfill);
      const fetchCorporateActions = async (sym) => ({ failed: false, calls: 2, actions: sym === 'AAPL' ? step.backfill : [] });
      await catchUpIdeaBook(c.db, c.bookRef, { before: S[step.i + 1], now: closeNowOf(S[step.i + 1]), fetchCorporateActions });
    } else {
      if (step.uncovered) {
        const e = c.db._store.get(`mandateUniverseDaily/${date}`);
        e.data.symbols.AAPL.caFetchFailed = true;
        e.version += 1;
      }
      await closeIdeaBook(c.db, c.bookRef, { date, now: closeNowOf(date) });
    }
    expect(getBook(c.db, c.bookId).execState.lastCloseKey, `seed ${plan.seed} closed ${date}`).toBe(date);
    checkAfterClose(c, date, plan.ambiguousSince);
    if (previous !== null) await rerunAdds(c, date, previous);
    checkAfterClose(c, date, plan.ambiguousSince);
    previous = date;
  }
  const idea = getIdea(c.db, c.bookId, c.ideaId);
  if (typeof plan.seed === 'number') tallyReached(idea);
  if (plan.clean) {
    // I-4: complete coverage and no ambiguity — the engine's own applier, over the same rows.
    for (const f of LEDGERS) expect(openAmbiguities(idea[f]).map((r) => [r.reason, r.actionId, r.redateOf ?? null]), `seed ${plan.seed} clean has no ambiguity`).toEqual([]);
    const want = oracle(initial, plan.feed);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(idea[f].holdings.AAPL.shares, `seed ${plan.seed} I-4 ${f} shares`).toBe(want.shares);
      expect(idea[f].dividendsUsd, `seed ${plan.seed} I-4 ${f} dividends`).toBe(want.dividends);
    }
    expect(getBook(c.db, c.bookId).portfolio.positions.AAPL.shares, `seed ${plan.seed} I-4 book`).toBe(want.shares);
  }
  if (plan.end) {
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd], `${plan.seed} dividends`).toEqual([plan.end.dividends, plan.end.dividends]);
    expect([idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, getBook(c.db, c.bookId).portfolio.positions.AAPL.shares], `${plan.seed} shares`).toEqual([plan.end.shares, plan.end.shares, plan.end.shares]);
  }
  return idea;
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
const FIXED = [
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

const SEEDS = Array.from({ length: 48 }, (_, k) => 1001 + k);

describe('S-6 — the generator reaches every order it is meant to (no vacuous pass)', () => {
  it('the fixed seeds produce clean histories and every kind of event, each at least a few times', () => {
    const plans = SEEDS.map(generate);
    const count = (k) => plans.filter((p) => p.kinds.includes(k)).length;
    const clean = plans.filter((p) => p.clean);
    expect(clean.length).toBeGreaterThanOrEqual(10);
    expect(clean.filter((p) => p.kinds.includes('split')).length).toBeGreaterThanOrEqual(4);
    expect(clean.filter((p) => p.kinds.includes('dividend')).length).toBeGreaterThanOrEqual(4);
    expect(clean.filter((p) => p.kinds.includes('purchase_on_ex_date')).length).toBeGreaterThanOrEqual(2);
    for (const k of ['conflict', 'revision', 'redate', 'coverage_failure', 'backfill_agrees', 'backfill_disagrees', 'split_shaped_move', 'founder_ruling', 'purchase_on_ex_date', 'c01_chain', 'c04_chain']) {
      expect(count(k), k).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('S-6 — every reproduction from Astra\'s reviews, as a fixed case: I-1 to I-5 after every close, and the money rev 1 gives', () => {
  it.each(FIXED.map((p) => [p.seed, p]))('%s', async (_seed, plan) => {
    await run(plan);
  }, 60_000);
});

describe('S-6 — I-1 to I-5 after every close of every generated history', () => {
  it.each(SEEDS)('seed %i', async (seed) => {
    await run(generate(seed));
  }, 60_000);
  // (Runs after the seeds, in file order: what the histories REACHED in the product, not only what was generated — AR2-C's
  // test-integrity finding: a payload added to a record later, a re-date matched against an ambiguous record, a halving
  // kept at an uncovered close, a ruled id revised. Each class must have been driven at least once.)
  it('the seeds reached each of the product paths the fixed cases pin (payload kept later, re-date of an ambiguous record, uncovered transition, revision after a ruling)', () => {
    expect(reached.payloadAddedLater, 'payloadAddedLater').toBeGreaterThanOrEqual(2);
    expect(reached.redateOfAmbiguous, 'redateOfAmbiguous').toBeGreaterThanOrEqual(2);
    expect(reached.uncoveredTransition, 'uncoveredTransition').toBeGreaterThanOrEqual(2);
    expect(reached.revisedAfterRuling, 'revisedAfterRuling').toBeGreaterThanOrEqual(1);
  });
});
