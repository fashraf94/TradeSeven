// api/_utils/practiceField/__testsupport__/caOracle.js
//
// Practice Field T1a-2b-3, final fix (Astra's round-2 confirmation, 19 Nov 2026) — THE INDEPENDENT I-2 ORACLE. Test support
// only: never imported by a production path.
//
// Astra's round-2 finding on the old I-2 check: it trusted the system's own records. It accepted ANY truthy `founderRuling`
// on an applied receipt (a `suspicion` ruling included), and it had to be told when an id became ambiguous. This oracle
// derives both facts from what the harness itself did:
//
//   AMBIGUITY, from the emitted inputs alone — the rows each close listed (a catch-up's stored backfill joined to its
//   archive), and the founder's own pending `split` rulings as one more account of their id. An id is ambiguous from the
//   first close at which those inputs show, for it:
//     · a CONFLICT — two payloads in one close (the vendor's two rows, an archive and a backfill that disagree, or a vendor
//       row that disagrees with the founder's pending split for that id);
//     · a REVISION — a payload not listed for it at any earlier close;
//     · a POSSIBLE RE-DATE — a payload listed (at this close or before) for another id of the same symbol and type dated
//       within the re-date window (both ids are marked).
//   One carve-out, counted and reported (T2D-05, carried to T1a-2b-4): a re-date whose matching payload was first listed
//   for the other id AFTER the feed itself had settled that id with a different payload — a correction of a settled
//   payload, which this build does not record. (Founder-settled ids are NOT carved out: that is T2D-D01.)
//
//   AUTHORIZATION, from the harness's own log of founder requests: a movement of cash or shares under an ambiguous id, at
//   a close on or after its ambiguity date, is authorized only by an ACCEPTED (200) `conflict` ruling the harness made for
//   that id whose chosen payload is the movement's payload. Nothing else authorizes it — a `suspicion` split, a
//   coverage-gap row, `none` (which moves nothing), a rejected request.
//
//   MOVEMENT is attributed by conservation, not trusted from receipts: each ledger's dividends equal the sum of its applied
//   receipts' income, each holding's share count is the chain of its applied share-basis receipts from the entry count,
//   and each dividend receipt's income is its own amount times a count the holding actually had. A movement with no
//   receipt, or under another receipt's payload, fails one of these before I-2 is asked.

import { expect } from 'vitest';
import { deriveActionId } from '../../mandateCorporateActions.js';
import { addUsd } from '../money.js';

import { roundUsd as roundUsdHere, roundShares as roundSharesHere } from '../../mandateRounding.js';

const REDATE_WINDOW = 5; // sessions (the product's REDATE_WINDOW_SESSIONS, restated here on purpose — the oracle imports no policy)
// (The refuter's AR3-O3: a delisting's cash and a rename's target are payloads too — two of either under one id differ.)
const keyOf = (row) => JSON.stringify([row?.ratio ?? null, row?.amount ?? null, row?.cashPerShare ?? null, row?.renamedTo != null ? String(row.renamedTo).toUpperCase() : null]);
const SHARE_BASIS = new Set(['split', 'reverse_split', 'stock_distribution']);
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];

export class InputOracle {
  /** @param {string[]} S the session dates (index = session number) */
  constructor(S) {
    this.S = S;
    this.ids = new Map(); // id → { sym, type, d (date index), payloads: Map key → first close index }
    this.marks = new Map(); // id → [{ k, how, via? }]   via: { id, key, at } (a re-date matched through another id's payload)
    this.rulings = []; // { at (index of the next close), body, status, requestKey }
    this.events = new Map(); // id → [{ k, kind }] — the ordered events on the id, for the coverage table
    this.lastListed = new Map(); // id → the close index it was last listed at
    this.closesSeen = [];
    this.carveOuts = 0;
    this.carvedIds = new Set();
    // The founder's pending splits as ACCOUNTS of their ids (the refuter's AR3-O1, O2): id → { key, sym, type, d, since,
    // suspectedOn, at }. And the re-date marks through one that the as-built rule excuses (an action the feed settled before
    // the ruling explained a move of its own: fix-round row T2D-11), counted.
    this.founder = new Map();
    this.founderExcused = 0;
    this.coverageAt = new Map(); // k → { uncovered: [sym], rejected: [{ sym, date }], catchup }
  }

  /** T1a-2b-4 fix round (the second refuter's O-2): the coverage facts of the close of index k — the symbols its inputs
   *  leave uncovered (a failed fetch, a dirty or missing parse report), the rows its parse report rejected, and whether it
   *  is a catch-up (which stores a backfill). */
  coverage(k, { uncovered = [], rejected = [], catchup = false } = {}) {
    this.coverageAt.set(k, { uncovered: [...uncovered], rejected: [...rejected], catchup });
  }

  event(id, k, kind) {
    const list = this.events.get(id) || [];
    list.push({ k, kind });
    this.events.set(id, list);
  }

  mark(id, k, how, via = null) {
    const list = this.marks.get(id) || [];
    if (!list.some((m) => m.k === k && m.how === how && JSON.stringify(m.via) === JSON.stringify(via))) list.push({ k, how, ...(via ? { via } : {}) });
    this.marks.set(id, list);
  }

  /** A founder request the harness made, before the close of index `nextClose`. */
  ruling(body, out, requestKey, nextClose, ledgers = null) {
    const status = out?.status ?? null;
    this.rulings.push({ at: nextClose, body, status, requestKey, ...(Array.isArray(ledgers) ? { ledgers } : {}) });
    // (T1a-2b-4 fix round, L-1: a `late_adjustment` approval or decline names one proposal — its ledger and action id are in
    // its record id, `late_<ledger>_<actionId>[_n]`.)
    if (body?.kind === 'late_adjustment') {
      const p = proposalOf(body.recordId);
      if (p && status === 200) this.event(p.actionId, nextClose, body.decision === 'approve' ? 'late_approved' : 'late_declined');
      return;
    }
    const id = body?.kind === 'conflict' ? body.recordId : (body?.kind === 'suspicion' && body.decision === 'split' ? this.splitIdOf(body) : null);
    if (id && status === 200) this.event(id, nextClose, body.kind === 'conflict' ? (body.decision === 'none' ? 'rule_none' : 'rule_payload') : 'rule_suspicion_split');
  }

  /** The first close index `id` was listed at (any payload), or null. */
  firstListedAt(id) {
    const e = this.ids.get(id);
    return e ? Math.min(...e.payloads.values()) : null;
  }

  /** The id a founder `split` ruling's action takes when the feed has not settled it (the derived split id). */
  splitIdOf(body) {
    const m = /^suspected_split_([A-Z.]+)_(\d{4}-\d{2}-\d{2})$/.exec(String(body.recordId || ''));
    if (!m) return null;
    return deriveActionId({ type: Number(body.ratio) > 1 ? 'split' : 'reverse_split', ticker: m[1], effectiveDate: m[2] });
  }

  /**
   * One close of index k: `rows` every row the close listed (archive and backfill alike), `pendingSplits` the founder
   * split rulings still pending at this close (id → ratio), `uncoveredSyms` the symbols whose data failed.
   */
  close(k, rows, { pendingSplits = new Map(), uncoveredSyms = [], disagreeIds = new Set() } = {}) {
    this.closesSeen.push(k);
    // (A pending split is `ratio`, or `{ ratio, since, suspectedOn, at }` — its record's gap, and the close after the ruling.)
    const pend = new Map([...pendingSplits].map(([id, v]) => [id, typeof v === 'number' ? { ratio: v } : v]));
    pendingSplits = new Map([...pend].map(([id, v]) => [id, v.ratio]));
    if (!this.listedAt) this.listedAt = new Map();
    const byId = new Map();
    for (const row of rows || []) {
      if (!row || typeof row.effectiveDate !== 'string') continue;
      const id = deriveActionId(row);
      const d = this.S.indexOf(row.effectiveDate);
      if (!byId.has(id)) byId.set(id, { sym: String(row.ticker).toUpperCase(), type: row.type, d, keys: new Set() });
      byId.get(id).keys.add(keyOf(row));
    }
    this.listedAt.set(k, new Set(byId.keys()));
    // (Every id ever listed, dropped now while still inside the window, is an event too: C03's "new only, then old only".)
    for (const [id, last] of this.lastListed) {
      const e = this.ids.get(id);
      if (!byId.has(id) && last === this.closesSeen.at(-2) && k - e.d <= REDATE_WINDOW) this.event(id, k, 'dropped');
    }
    for (const [id, cur] of byId) {
      const known = this.ids.get(id);
      const isNew = !known;
      const e = known || { sym: cur.sym, type: cur.type, d: cur.d, payloads: new Map() };
      if (isNew) this.event(id, k, 'listed');
      else if (this.lastListed.get(id) !== this.closesSeen.at(-2)) this.event(id, k, 'returned');
      if (uncoveredSyms.includes(cur.sym)) this.event(id, k, 'uncovered');
      // A conflict: two accounts of the id in this close — its rows, and the founder's pending split for it.
      const accounts = new Set(cur.keys);
      if (pendingSplits.has(id)) accounts.add(keyOf({ ratio: pendingSplits.get(id) }));
      if (accounts.size > 1) {
        this.mark(id, k, 'conflict');
        // (`conflict_with_ruling`: a vendor account that disagrees with the founder's pending split for the id — D02's shape.)
        const ruled = pendingSplits.has(id) ? keyOf({ ratio: pendingSplits.get(id) }) : null;
        this.event(id, k, ruled !== null && [...cur.keys].some((x) => x !== ruled) ? 'conflict_with_ruling' : 'conflict');
      }
      if (disagreeIds.has(id)) this.event(id, k, 'backfill_disagrees');
      // A revision: a payload never listed for it before.
      if (!isNew && [...cur.keys].some((x) => !e.payloads.has(x))) { this.mark(id, k, 'revision'); this.event(id, k, 'revision'); }
      for (const x of cur.keys) if (!e.payloads.has(x)) e.payloads.set(x, k);
      this.ids.set(id, e);
      this.lastListed.set(id, k);
    }
    // THE FOUNDER'S PENDING SPLIT AS AN ACCOUNT of its id (AR3-O2): a payload the vendor listed for that id at any close that
    // differs from the founder's makes the id ambiguous (a held vendor row revising the founder's split, refuter F2); and
    // (AR3-O1) a row listed now under ANOTHER date with the founder's payload is a possible re-date of it — both ids marked —
    // unless that row is dated inside the record's gap (an account of the same move: review B2), refuter F1.
    for (const [id, v] of pend) {
      const m = /^(split|reverse_split)_([A-Z.]+)_(\d{4}-\d{2}-\d{2})$/.exec(id);
      if (!m) continue;
      const key = keyOf({ ratio: v.ratio });
      const f = this.founder.get(id) || { key, sym: m[2], type: m[1], d: this.S.indexOf(m[3]), since: v.since ?? null, suspectedOn: v.suspectedOn ?? m[3], at: v.at ?? k, first: k };
      this.founder.set(id, f);
      const e = this.ids.get(id);
      if (e && [...e.payloads.keys()].some((x) => x !== key)) { this.mark(id, k, 'conflict'); this.event(id, k, 'conflict_with_ruling'); }
      for (const [other, cur] of byId) {
        if (other === id || cur.sym !== f.sym || cur.type !== f.type || Math.abs(cur.d - f.d) > REDATE_WINDOW || !cur.keys.has(key)) continue;
        const od = this.S[cur.d];
        if ((typeof f.since !== 'string' || od > f.since) && od <= f.suspectedOn) continue;
        const via = { key, sides: [[other, this.ids.get(other).payloads.get(key)], [id, f.first]], founder: { other, at: f.at } };
        this.mark(other, k, 'redate', via);
        this.mark(id, k, 'redate', via);
        this.event(other, k, 'redate');
      }
    }
    // (T1a-2b-4 fix round, L-5: TWO SHARE-BASIS IDS OF ONE SYMBOL AND ONE EFFECTIVE DATE are one ambiguity, whatever their
    // payloads or types — a 10-for-1 and a 1-for-10 of one date may be one action and its direction correction. Both marked.)
    for (const [id, cur] of byId) {
      if (!SHARE_BASIS.has(cur.type)) continue;
      for (const [other, o] of this.ids) {
        if (other === id || o.sym !== cur.sym || !SHARE_BASIS.has(o.type) || o.d !== cur.d) continue;
        const via = { key: null, sameDate: true, sides: [[id, k], [other, Math.min(...o.payloads.values())]] };
        this.mark(id, k, 'same_date', via);
        this.mark(other, k, 'same_date', via);
        this.event(id, k, 'same_date_share_basis');
      }
    }
    // A possible re-date: a payload listed now that another id of the same symbol and type, dated within the window, has
    // been listed with (now or before). Both ids are marked; the match is kept for the per-ledger carve-out.
    for (const [id, cur] of byId) {
      for (const [other, o] of this.ids) {
        if (other === id || o.sym !== cur.sym || o.type !== cur.type || Math.abs(o.d - cur.d) > REDATE_WINDOW) continue;
        for (const x of cur.keys) {
          if (!o.payloads.has(x)) continue;
          // (Both sides, each with the close its copy of the payload was first listed at — for the carve-out.)
          const via = { key: x, sides: [[id, this.ids.get(id).payloads.get(x)], [other, o.payloads.get(x)]] };
          this.mark(id, k, 'redate', via);
          this.mark(other, k, 'redate', via);
          this.event(id, k, 'redate');
          if (o.payloads.get(x) === k && this.lastListed.get(other) === k) this.event(other, k, 'redate_same_close');
        }
      }
    }
  }

  /** The first close index at which `id` is ambiguous ON LEDGER `l` (a re-date through a carved-out payload aside), or null. */
  ambiguousSinceOn(l, id) {
    let first = null;
    for (const m of this.marks.get(id) || []) {
      if (m.how === 'redate' && m.via.founder && this.founderSettledFirst(l, m)) continue;
      if (m.how === 'redate' && this.carvedOut(l, m)) continue;
      if (first === null || m.k < first) first = m.k;
    }
    return first;
  }

  /**
   * T2D-05's class, carried: the re-date's matching payload was first listed for the matched id after the FEED had already
   * settled that id on this ledger with a different payload (applied, or declined as not entitled, with no founder ruling).
   */
  carvedOut(l, m) {
    // Either side: the payload was first listed for that id after the feed had settled the id with another payload.
    for (const [sideId, at] of m.via.sides) {
      const settledByFeed = (l.corporateActionReceipts || []).find((r) => r?.actionId === sideId && !r.founderRuling
        && (r.applied === true || r.reason === 'not_entitled') && typeof (r.appliedOn ?? r.seenOn) === 'string' && (r.appliedOn ?? r.seenOn) < this.S[at]);
      if (!settledByFeed || keyOf(settledByFeed) === m.via.key) continue;
      if (!this.carvedIds.has(`${sideId}:${m.via.key}`)) { this.carvedIds.add(`${sideId}:${m.via.key}`); this.carveOuts += 1; }
      return true;
    }
    return false;
  }

  /** A re-date through a founder split's account, where the other row's id was settled on this ledger before the
   *  ruling: excused, as built (T2D-11: a settled action explained a move of its own; the founder answered a later one). */
  founderSettledFirst(l, m) {
    const { other, at } = m.via.founder;
    // (Settled by the feed OR by the founder — a conflict ruling's payload or `none` — before the split ruling: the final soak's
    // 1911203378, where the founder had chosen 1.25 over the vendor's 2 for an earlier split, then ruled 2:1 for a later halving.)
    const settled = (l.corporateActionReceipts || []).some((r) => r?.actionId === other && (r.applied === true || r.reason === 'not_entitled' || r.reason === 'founder_ruled_none')
      && typeof (r.appliedOn ?? r.seenOn) === 'string' && (at == null || (r.appliedOn ?? r.seenOn) < this.S[at]));
    if (settled) this.founderExcused += 1;
    return settled;
  }

  /** The payload key the oracle compares (a receipt's, a row's or a ruling's payload). */
  keyOf(row) { return keyOf(row); }

  /** The accepted conflict ruling the harness made for `id` choosing `payloadKey`, or null. */
  authorizing(id, payloadKey) {
    return this.rulings.find((r) => r.status === 200 && r.body?.kind === 'conflict' && r.body.recordId === id && r.body.decision === 'payload'
      && keyOf(r.body.payload) === payloadKey) ?? null;
  }

  /**
   * THE CHECKS, after a close of `date` (index k). `initialOf`: each ledger's entry holdings ({ sym: { shares } }).
   */
  check(idea, date, label, initialOf) {
    for (const f of LEDGERS) {
      const l = idea?.[f];
      if (!l) continue;
      const applied = (l.corporateActionReceipts || []).filter((r) => r?.applied === true);
      // CONSERVATION — dividends: the ledger's dividends are its applied receipts' income and (T1a-2b-4) its posted
      // adjustments' amounts — each adjustment's own amount is checked against the entitlement by I-6 — and nothing else.
      const adjustedHere = (l.adjustments || []).filter((a) => a && a.held !== true && a.postedTo === 'ledger');
      expect(l.dividendsUsd ?? 0, `${label} ${date} conservation ${f} dividends = Σ receipts + Σ adjustments`).toBe(addUsd(0, ...applied.map((r) => Number(r.incomeUsd) || 0), ...adjustedHere.map((a) => Number(a.amountUsd) || 0)));
      // …shares: every holding's count is the chain of its applied share-basis receipts from the entry count — (T1a-2b-4)
      // with the founder's ratio in place of a corrected receipt's (a ruled_correction of a split), replayed as the
      // applier rounds. A receipt's own `sharesBefore` is checked where no correction touched the symbol.
      // (T1a-2b-4 fix round, L-4: COUNTS ARE RECOMPUTED, NOT PATCHED — the count is the entry count along the DATED chain of
      // the applied share-basis receipts (effective date, then phase, then id), rounded at each step, whatever order they
      // were applied in. A receipt keeps what happened when it was applied; only a receipt applied in date order is held to
      // its own before-and-after here. The founder's corrected ratio stands in for a corrected receipt's.)
      const all = l.corporateActionReceipts || [];
      const correctionsOf = (id, at) => (l.adjustments || []).filter((a) => a && a.held !== true && a.kind === 'ruled_correction' && a.actionId === id && Number(a.ratio) > 0 && Number(a.seq) <= at);
      const byDated = (a, b) => String(a.r.effectiveDate).localeCompare(String(b.r.effectiveDate)) || String(a.r.actionId).localeCompare(String(b.r.actionId));
      /** The count of `sym` along the dated chain of the share-basis receipts applied before index `at` (all of them: Infinity). */
      const countAt = (sym, at) => {
        let n = Number(initialOf?.[f]?.[sym]?.shares);
        const events = [];
        for (let j = 0; j < Math.min(at, all.length); j += 1) {
          const r = all[j];
          if (r?.applied !== true || !SHARE_BASIS.has(r.type) || String(r.ticker).toUpperCase() !== sym || r.historyOnly === true) continue;
          events.push({ r, j });
        }
        for (const { r } of events.sort(byDated)) {
          const c = correctionsOf(r.actionId, at).at(-1);
          n = roundSharesHere(n * (c ? Number(c.ratio) : Number(r.ratio)));
        }
        return n;
      };
      const correctedSyms = new Set((l.adjustments || []).filter((a) => a?.kind === 'ruled_correction' && SHARE_BASIS.has(a.type)).map((a) => String(a.ticker).toUpperCase()));
      for (const [j, r] of all.entries()) {
        if (r?.applied !== true || !SHARE_BASIS.has(r.type) || r.historyOnly === true || r.recount) continue;
        const sym = String(r.ticker).toUpperCase();
        if (correctedSyms.has(sym)) continue;
        expect(r.sharesBefore, `${label} ${date} conservation ${f} ${r.actionId} sharesBefore = the dated count before it`).toBe(countAt(sym, j));
        expect(r.sharesAfter, `${label} ${date} conservation ${f} ${r.actionId} sharesAfter`).toBe(roundSharesHere(countAt(sym, j) * Number(r.ratio)));
      }
      for (const sym of Object.keys(initialOf?.[f] || {})) if (l.holdings?.[sym]) expect(l.holdings[sym].shares, `${label} ${date} conservation ${f} ${sym} shares = the dated receipt chain`).toBe(countAt(sym, Infinity));
      // …income: each dividend receipt's income is ITS amount times the count the holding had WHEN it was applied — the
      // dated chain of the share-basis receipts applied before it — or its recorded ex-date count (AR3-O3: before, any count
      // in the chain passed). (T1a-2b-4: a founder's ratio correction posted before it, by `seq`, stands in.)
      for (const [at, r] of all.entries()) {
        if (r?.applied !== true || r.type !== 'cash_dividend') continue;
        const sym = String(r.ticker).toUpperCase();
        const n = r.entitledShares != null ? Number(r.entitledShares) : countAt(sym, at);
        expect(Math.abs(Number(r.incomeUsd) - Number(r.amount) * n) <= 0.0051, `${label} ${date} conservation ${f} ${r.actionId} income = amount × the count held when applied`).toBe(true);
      }
      // I-2, INDEPENDENT: a movement under an id ambiguous by the inputs, at a close on or after that, is authorized only by
      // an accepted conflict ruling for the id choosing the moved payload.
      for (const r of applied) {
        const since = this.ambiguousSinceOn(l, r.actionId);
        if (since === null || !(r.appliedOn >= this.S[since])) continue;
        const ok = this.authorizing(r.actionId, keyOf(r));
        expect(ok, `${label} ${date} I-2 (inputs) ${f} ${r.actionId} moved ${keyOf(r)} on ${r.appliedOn}, ambiguous since ${this.S[since]} by the inputs, with no accepted conflict ruling choosing that payload (receipt names ${r.founderRuling?.kind ?? 'no ruling'})`).not.toBeNull();
      }
    }
  }

  /** Ordered event pairs on one id, per ledger kind holding its symbol: `${a} → ${b}` (a strictly before b). */
  orderedPairs(ledgerSymbols) {
    const out = {};
    for (const [id, list] of this.events) {
      const sym = this.ids.get(id)?.sym ?? (/_([A-Z.]+)_\d{4}/.exec(id)?.[1] ?? null);
      const evs = [...list].sort((a, b) => a.k - b.k);
      for (const [f, syms] of Object.entries(ledgerSymbols)) {
        if (!syms.includes(sym)) continue;
        const seen = new Set();
        for (let a = 0; a < evs.length; a += 1) for (let b = a + 1; b < evs.length; b += 1) {
          if (evs[a].k === evs[b].k && evs[a].kind === evs[b].kind) continue;
          const key = `${f} ${evs[a].kind} → ${evs[b].kind}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out[key] = (out[key] || 0) + 1;
        }
      }
    }
    return out;
  }

  /** The named shapes, on one id (and its re-date partner), from the ordered events. */
  shapes() {
    const has = (id, kind, pred = () => true) => (this.events.get(id) || []).filter((e) => e.kind === kind && pred(e));
    const out = { c03: 0, d01: 0, d02: 0 };
    for (const [id] of this.events) {
      // D01: an id the founder settled, then — in ONE close — a payload of it not seen and its re-date.
      for (const rule of [...has(id, 'rule_none'), ...has(id, 'rule_payload')]) {
        // (A ruling's event is dated the first close after it was made: a revision at that close or later follows it.)
        if (has(id, 'revision', (e) => e.k >= rule.k).some((rv) => has(id, 'redate_same_close', (e) => e.k === rv.k).length > 0)) { out.d01 += 1; break; }
      }
      // D02: a pending founder split, then a vendor account that disagrees with it at an uncovered close.
      for (const rule of has(id, 'rule_suspicion_split')) {
        if (has(id, 'conflict_with_ruling', (e) => e.k >= rule.k).some((c) => has(id, 'uncovered', (e) => e.k === c.k).length > 0)) { out.d02 += 1; break; }
      }
      // C03: an old id in conflict; then it overlaps its re-date; then the new row only; then the old row only.
      const conflict = has(id, 'conflict')[0];
      if (conflict) {
        const partners = (this.marks.get(id) || []).filter((m) => m.how === 'redate' && m.k > conflict.k);
        for (const p of partners) {
          const other = p.via.sides.map(([s]) => s).find((s) => s !== id);
          const overlapK = p.k;
          const newOnly = has(id, 'dropped', (e) => e.k > overlapK)[0];
          if (!newOnly || this.lastListedAt(other, newOnly.k) !== true) continue;
          const oldOnly = has(id, 'returned', (e) => e.k > newOnly.k)[0];
          if (oldOnly && this.lastListedAt(other, oldOnly.k) === false) { out.c03 += 1; break; }
        }
      }
    }
    return out;
  }

  /** Whether `id` was listed at close k. */
  lastListedAt(id, k) {
    return this.listedAt.get(k)?.has(id) === true;
  }
}


// ── T1a-2b-4: I-6 — EVERY LEDGER IS PAID WHAT ITS HOLDING WAS OWED ───────────────────────────────────────────────────────
// For every unambiguous id, each ledger's received cash — its receipt's income plus every adjustment posted for the id —
// equals the entitlement the ORACLE computes from the GENERATOR'S INPUTS (the rows each close listed, the founder's
// accepted rulings and approvals) and the LEDGER'S HOLDING HISTORY (its entry count, the session it was bought, the session
// it was sold), never from the product's records: the count on the ex-date is the entry count times every entitled split
// dated on or before it, in date order, rounded as the applier rounds; a dividend dated on or before the purchase, or after
// the sale, is owed nothing. An id ambiguous by the inputs is in it only once the founder's accepted ruling chose its payload.
//
// THE FIX ROUND (20 Nov 2026; Astra's "Oracle" section). Two changes:
//   · EXCUSES ARE SCOPED to the facts that can change THAT ledger's ex-date count or amount FOR THAT ID: the id's own
//     ambiguity, a share-basis id of its symbol dated on or before its ex-date (ambiguous, held, suspected, uncovered), a
//     held debit or a waiting row of the id itself. An unrelated dispute — another dividend's conflict — excuses nothing
//     (her $0.10/$0.20 variant of T2E-04 turned the whole stock run green).
//   · LATE DATA ASKS (L-1): money that late data moves — a dividend first listed after the ledger sold the stock, or one paid
//     on time whose ex-date count a share-basis action listed after that payment changes — is owed to the ledger only once
//     the founder approved it (an accepted `late_adjustment` for that ledger and id, or a conflict ruling choosing the id's
//     payload), at a close after the late fact. Before that it WAITS: excused, counted. A wait excuses a payment waiting to
//     post — never a payment the inputs forbid: in every branch, excused or not, the money adjustments moved for the id
//     without an approval or ruling in the inputs must be nought.
//
// I-7 — EVERY POSTED ADJUSTMENT HAS A FOUNDER APPROVAL OR RULING FOR ITS ID AND LEDGER IN THE GENERATOR'S INPUTS: a
// `ruled_correction` an accepted conflict ruling for the id choosing its payload; a late adjustment an accepted
// `late_adjustment` approval naming that ledger and id (or, for a closed holding's row the founder settled, the conflict
// ruling choosing its payload), each made before the close that posted it — and never more postings than approvals.
// The fix round's refuter found I-7 accepted an approval L-2 must refuse (two rows of one close pairing only with each
// other, and the proposal they both paired with posted): an approval alone authorizes a posting only while the inputs show
// no ambiguity of the id at or before that close, unless the founder's conflict ruling answered it (checkRefusalAtPosting).

/** A proposal's record id, `late_<ledger>_<actionId>[_<n>]` → { ledger field, actionId }, or null. */
const PROPOSAL_LEDGER = { idea: 'ledger', comparison: 'comparisonLedger', spy: 'spyLedger' };
export function proposalOf(recordId) {
  const m = /^late_(idea|comparison|spy)_(.+?\d{4}-\d{2}-\d{2})(?:_(\d+))?$/.exec(String(recordId || ''));
  return m ? { field: PROPOSAL_LEDGER[m[1]], actionId: m[2], n: m[3] ? Number(m[3]) : 1 } : null;
}

export class EntitlementOracle {
  constructor(S, inputs) {
    this.S = S;
    this.inputs = inputs; // the InputOracle: the rows listed and the requests made
    this.checked = 0;
    this.excused = 0;
    this.waiting = 0;
    this.refused = 0;
    this.nothingOwed = 0;
    this.authorityChecks = 0;
    this.refusalChecks = 0;
    this.byKind = { late_entitlement: 0, late_basis: 0, ruled_correction: 0 };
  }

  /** The payload in force for `id` by the inputs: the founder's accepted payload ruling (the latest), else its one listed
   *  payload if it was never ambiguous; `undefined` while it waits; null when ruled `none`. */
  payloadOf(id, f = null) {
    // (A conflict ruling belongs to the ledgers whose record it covers — Astra T2D-09; recorded with it where the endpoint
    // named them. On another ledger the id stands as the inputs listed it: the refuter shapes' 2121900008 — the comparison,
    // still holding the stock, paid a dividend the idea's sold holding later found ambiguous and the founder ruled `none`.)
    const covers = (r) => f === null || !Array.isArray(r.ledgers) || r.ledgers.includes(f);
    const ruled = [...this.inputs.rulings].reverse().find((r) => r.status === 200 && r.body?.kind === 'conflict' && r.body.recordId === id && covers(r));
    if (ruled) return ruled.body.decision === 'none' ? null : ruled.body.payload;
    if ((this.inputs.marks.get(id) || []).length > 0) return undefined;
    const e = this.inputs.ids.get(id);
    if (!e || e.payloads.size !== 1) return undefined;
    const [k] = [...e.payloads.keys()];
    const [ratio, amount] = JSON.parse(k);
    return { ratio, amount };
  }

  /** The accepted requests that authorize money for `id` on ledger `f`, each with the close it applies at: an approval of
   *  a proposal of that ledger and id, or a conflict ruling choosing a payload of the id. */
  authoritiesFor(f, id) {
    const out = [];
    for (const r of this.inputs.rulings) {
      if (r.status !== 200) continue;
      if (r.body?.kind === 'late_adjustment' && r.body.decision === 'approve') {
        const p = proposalOf(r.body.recordId);
        if (p && p.field === f && p.actionId === id) out.push({ at: r.at, kind: 'approval', r });
      }
      if (r.body?.kind === 'conflict' && r.body.recordId === id && r.body.decision === 'payload' && (f === null || !Array.isArray(r.ledgers) || r.ledgers.includes(f))) {
        // (A CORRECTING ruling chooses a payload the id's first listing did not show — the founder's correction of a settled
        // id, which posts the net. A ruling keeping the first payload posts nothing, and authorizes nothing late.)
        const e = this.inputs.ids.get(id);
        const first = e ? Math.min(...e.payloads.values()) : null;
        const firstKeys = e ? [...e.payloads].filter(([, at]) => at === first).map(([key]) => key) : [];
        out.push({ at: r.at, kind: 'ruling', r, correcting: firstKeys.length === 1 && firstKeys[0] !== keyOf(r.body.payload) });
      }
    }
    return out;
  }

  /**
   * I-7, after the close of index `k`: every adjustment a ledger has POSTED has its authority in the inputs (see above).
   */
  checkAuthority(idea, k, label, holdings = null) {
    for (const f of LEDGERS) {
      const l = idea?.[f];
      if (!l) continue;
      const posted = (l.adjustments || []).filter((a) => a && a.held !== true);
      const lateCount = new Map();
      for (const a of posted) {
        const at = this.S.indexOf(a.postedOn);
        this.authorityChecks += 1;
        if (a.kind === 'ruled_correction') {
          const ok = this.inputs.rulings.find((r) => r.status === 200 && r.body?.kind === 'conflict' && r.body.recordId === a.actionId && r.body.decision === 'payload' && (!Array.isArray(r.ledgers) || r.ledgers.includes(f))
            && keyOf(r.body.payload) === keyOf(a.payload || {}) && r.at <= at) ?? null;
          expect(ok, `${label} ${this.S[k]} I-7 ${f} ${a.actionId}: a ruled_correction of ${keyOf(a.payload || {})} posted on ${a.postedOn} with no accepted conflict ruling choosing that payload`).not.toBeNull();
          continue;
        }
        const auth = this.authoritiesFor(f, a.actionId).filter((x) => x.at <= at
          && (x.kind === 'approval' || keyOf(x.r.body.payload) === keyOf({ amount: a.amountPerShare })));
        expect(auth.length > 0, `${label} ${this.S[k]} I-7 ${f} ${a.actionId}: a ${a.kind} of $${a.amountUsd} posted on ${a.postedOn} with no founder approval or ruling for this ledger and id in the inputs`).toBe(true);
        // (A late ENTITLEMENT the founder's conflict ruling chose is the ruling's: the closed path posts it on the ruling — at its
        // close, or later where a doubt deferred it and a ledger still holding the stock kept the ruling pending (the soak's
        // 2120005580). A ruling never posts a `late_basis`: every one of those, like every approval's posting, meets L-2 —
        // including one whose id a ruling paid before its late facts.)
        if (!(a.kind === 'late_entitlement' && auth.some((x) => x.kind === 'ruling'))) this.checkRefusalAtPosting(l, f, a, at, k, label, holdings?.[f] ?? null);
        lateCount.set(a.actionId, (lateCount.get(a.actionId) || 0) + 1);
      }
      for (const [id, n] of lateCount) {
        const allowed = this.authoritiesFor(f, id).filter((x) => x.at <= k).length;
        expect(n <= allowed, `${label} ${this.S[k]} I-7 ${f} ${id}: ${n} late postings for ${allowed} approvals or rulings`).toBe(true);
      }
    }
  }

  /**
   * I-7, L-2 AT POSTING (the fix round's refuter: an approval was accepted where L-2 must refuse). A late adjustment the
   * founder's APPROVAL alone authorizes posts only while nothing the inputs show refuses it: no ambiguity of its id by the
   * inputs at or before the posting close — its own conflict or revision, or a re-date pairing with another id of its symbol
   * — unless the founder's accepted conflict ruling answered it by then: of the id itself, made after that ambiguity showed
   * (a ruling the founder made before a later pairing did not answer it), or, for a pairing, of every other id it pairs with
   * (a settled id stands for nothing, whenever it was settled). (A carved-out re-date — the T2D-05 class, as I-2 excuses it
   * on this ledger — is none.) Derived from the inputs alone.
   */
  checkRefusalAtPosting(l, f, a, at, k, label, h = null) {
    // (The second refuter's O-3: a ruling — of the id or of the other id of its pairing — answers only on the ledgers it
    // covers, T2D-09.)
    const covers = (r) => !Array.isArray(r.ledgers) || r.ledgers.includes(f);
    const ruledBy = (id, after = -Infinity) => this.inputs.rulings.some((r) => r.status === 200 && r.at > after && r.at <= at && covers(r)
      && ((r.body?.kind === 'conflict' && r.body.recordId === id) || (r.body?.kind === 'suspicion' && r.body.decision === 'split' && this.inputs.splitIdOf(r.body) === id)));
    const settledFirst = (m) => m.how === 'redate' && m.via?.founder && (l?.corporateActionReceipts || []).some((r) => r?.actionId === m.via.founder.other
      && (r.applied === true || r.reason === 'not_entitled' || r.reason === 'founder_ruled_none') && typeof (r.appliedOn ?? r.seenOn) === 'string' && (m.via.founder.at == null || (r.appliedOn ?? r.seenOn) < this.S[m.via.founder.at]));
    /** Each ambiguity of `id` the inputs show at or before the posting close, not answered by then. (A ruling of the id
     *  answers an ambiguity it was made after the FIRST showing of — the same conflict, or a pairing with the same ids,
     *  listed again at later closes is the one the founder saw: review-AR4-A-1. A revision is a new payload each time.) */
    const partnersOf = (m, id) => [...new Set((m.via?.sides || []).map(([s]) => s).filter((s) => s !== id))].sort().join(',');
    const firstShown = (id, m) => (m.how === 'revision' ? m.k
      : Math.min(...(this.inputs.marks.get(id) || []).filter((x) => x.how === m.how && partnersOf(x, id) === partnersOf(m, id)).map((x) => x.k)));
    const unanswered = (id) => (this.inputs.marks.get(id) || []).filter((m) => {
      if (m.k > at || settledFirst(m) || (m.how === 'redate' && this.inputs.carvedOut(l, m))) return false;
      const others = (m.how === 'redate' || m.how === 'same_date') ? [...new Set((m.via?.sides || []).map(([s]) => s).filter((s) => s !== id))] : [];
      // (Third refuter O-4: the OTHER id's ruling answers the pairing only if it was made after the pairing first showed —
      // a ruling made before it, the founder's own split among them, never saw it.)
      const since = firstShown(id, m);
      return !(ruledBy(id, since) || (others.length > 0 && others.every((x) => ruledBy(x, since))));
    });
    // L-2 ① and ②: the id itself.
    for (const m of unanswered(a.actionId)) {
      this.refusalChecks += 1;
      const others = (m.via?.sides || []).map(([s]) => s).filter((s) => s !== a.actionId);
      expect(false, `${label} ${this.S[k]} I-7 (L-2 at posting) ${f} ${a.actionId}: a ${a.kind} of $${a.amountUsd} posted on ${a.postedOn} on an approval alone, while the inputs show the id ambiguous since ${this.S[m.k]} (${m.how}${others.length > 0 ? ` with ${[...new Set(others)].join(', ')}` : ''}) and no accepted conflict ruling answered it`).toBe(true);
    }
    this.refusalChecks += 1;
    // (The second refuter's O-1, O-2: L-2 ③ and ④ from the inputs, on the ledger's holding — the harness's holding history,
    // or, in a unit row without one, a holding bought at the first session and still held.)
    const sym = String(a.ticker ?? /^cash_dividend_([A-Z.]+)_/.exec(String(a.actionId))?.[1] ?? '').toUpperCase();
    const boughtAt = h?.boughtAt ?? 0;
    const end = h?.soldAt ?? at;
    // L-2 ③: a share-basis id of the symbol dated within the holding, ambiguous by the inputs and unanswered.
    for (const [id, e] of this.inputs.ids) {
      if (e.sym !== sym || !SHARE_BASIS.has(e.type) || !(e.d > boughtAt && e.d <= end)) continue;
      const open = unanswered(id);
      expect(open.length, `${label} ${this.S[k]} I-7 (L-2 ③ at posting) ${f} ${a.actionId}: a ${a.kind} of $${a.amountUsd} posted on ${a.postedOn} on an approval alone, while ${id}, dated within the holding, is ambiguous by the inputs since ${open[0] ? this.S[open[0].k] : '?'} and unanswered`).toBe(0);
    }
    // L-2 ④: a date in the holding uncovered — the symbol uncovered at the posting close itself, or (a sold holding) a row its
    // parse report rejected, dated within the holding, seen after the sale, with no catch-up since (a sticky doubt).
    expect((this.inputs.coverageAt.get(at)?.uncovered || []).includes(sym), `${label} ${this.S[k]} I-7 (L-2 ④ at posting) ${f} ${a.actionId}: a ${a.kind} of $${a.amountUsd} posted on ${a.postedOn}, a close whose inputs leave ${sym} uncovered`).toBe(false);
    if (f === 'ledger' && h?.soldAt != null) {
      for (const [r, cov] of this.inputs.coverageAt) {
        if (r < h.soldAt || r > at) continue;
        for (const x of cov.rejected || []) {
          const d = this.S.indexOf(x.date);
          if (x.sym !== sym || !(d > boughtAt && d <= h.soldAt)) continue;
          const cleared = [...this.inputs.coverageAt].some(([c2, v]) => c2 > r && c2 <= at && v.catchup);
          expect(cleared, `${label} ${this.S[k]} I-7 (L-2 ④ at posting) ${f} ${a.actionId}: a ${a.kind} of $${a.amountUsd} posted on ${a.postedOn} on an approval alone, while a row dated ${x.date} within the sold holding, rejected at ${this.S[r]}, has no clean data since`).toBe(true);
        }
      }
    }
  }

  /**
   * THE PRODUCT'S DOUBT THAT CAN CHANGE THIS LEDGER'S EX-DATE COUNT OR AMOUNT FOR THIS ID (scoped; it excuses equality and
   * can never authorize money): an open ambiguity of the id itself, or of a share-basis id of its symbol dated on or before
   * its ex-date, on any ledger of the idea; a held action of either kind; an open suspicion whose move may predate the
   * ex-date; a coverage gap that began before it; a held debit or a waiting row of the id on this ledger; a closed
   * holding's coverage doubt on this ledger dated within the re-date window of it or before it.
   */
  scopedDoubt(idea, f, sym, id, d) {
    const SHARE_AND_DATED = (r) => SHARE_BASIS.has(r?.type) && typeof r.effectiveDate === 'string' && r.effectiveDate <= d;
    const own = (r) => r?.actionId === id;
    for (const g of LEDGERS) {
      const l = idea?.[g];
      if (!l) continue;
      const settled = new Set([...(l.appliedActionIds || []), ...(l.declinedActionIds || [])]);
      for (const r of l.corporateActionReceipts || []) {
        if (String(r?.ticker).toUpperCase() !== sym || !(own(r) || SHARE_AND_DATED(r))) continue;
        if ((r.reason === 'conflicting_action' || r.reason === 'possible_redate') && !settled.has(r.actionId)) return true;
        if (r.reason === 'revised_after_ruling' && r.closedBy == null) return true;
      }
      const h = l.holdings?.[sym];
      if (h && (h.heldActions || []).some((r) => own(r) || SHARE_AND_DATED(r))) return true;
      if (h?.basisSuspicion && !(typeof h.basisSuspicion.since === 'string' && h.basisSuspicion.since >= d)) return true;
      if ((l.closedHeldRows || []).some((r) => String(r.ticker).toUpperCase() === sym && (own(r) || SHARE_AND_DATED(r)))) return true;
    }
    const l = idea?.[f];
    if ((l?.adjustments || []).some((a) => a?.held === true && a.actionId === id)) return true;
    const gap = idea?.caCoverageGaps?.[sym];
    if (gap && !(typeof gap.since === 'string' && gap.since >= d)) return true;
    for (const x of l?.closedCoverageDoubts?.[sym]?.dates || []) if (typeof x?.date === 'string' && (x.date <= d || this.S.indexOf(x.date) - this.S.indexOf(d) <= REDATE_WINDOW)) return true;
    return false;
  }

  /** L-2's refusals of an approved proposal of `id` on ledger `f`, from the product's state (an excuse — never authority). */
  refusalStands(idea, f, sym, id, h, k) {
    const l = idea?.[f];
    const end = this.S[h.soldAt ?? k];
    const start = this.S[h.boughtAt];
    const within = (d) => typeof d !== 'string' || (d > start && d <= end);
    const openOn = (x, r) => ((r.reason === 'conflicting_action' || r.reason === 'possible_redate') && !new Set([...(x.appliedActionIds || []), ...(x.declinedActionIds || [])]).has(r.actionId)) || (r.reason === 'revised_after_ruling' && r.closedBy == null);
    if ((l?.corporateActionReceipts || []).some((r) => r?.reason === 'possible_redate' && r.redateOf === id && openOn(l, r))) return true;
    // (Fix-round refuter R-1, R-3: any open candidate of the id's type and payload within the window, wherever it waits on
    // this ledger — a record carrying the payload, a waiting or held row, a row kept outside the holding, another open late
    // entitlement.)
    const pay = this.payloadOf(id, f);
    const e = this.inputs.ids.get(id);
    if (pay && e && l) {
      const key = keyOf({ amount: pay.amount });
      const near = (x) => Boolean(x) && x.actionId !== id && String(x.ticker).toUpperCase() === sym && x.type === 'cash_dividend' && typeof x.effectiveDate === 'string'
        && this.S.indexOf(x.effectiveDate) >= 0 && Math.abs(this.S.indexOf(x.effectiveDate) - e.d) <= REDATE_WINDOW;
      const settledHere = new Set([...(l.appliedActionIds || []), ...(l.declinedActionIds || [])]);
      if ((l.corporateActionReceipts || []).some((r) => near(r) && openOn(l, r) && [r, ...(r.rows || [])].some((x) => keyOf(x) === key))) return true;
      if ([...(l.closedHeldRows || []), ...(l.closedOutsideRows || []), ...(l.holdings?.[sym]?.heldActions || [])].some((x) => near(x) && !settledHere.has(x.actionId) && keyOf(x) === key)) return true;
      if ((l.lateProposals || []).some((q) => q.status === 'open' && q.kind === 'late_entitlement' && near(q) && !settledHere.has(q.actionId) && keyOf({ amount: q.amountPerShare }) === key)) return true;
    }
    for (const g of LEDGERS) {
      const x = idea?.[g];
      if (!x) continue;
      if ((x.corporateActionReceipts || []).some((r) => SHARE_BASIS.has(r?.type) && String(r.ticker).toUpperCase() === sym && within(r.effectiveDate) && openOn(x, r))) return true;
      const hh = x.holdings?.[sym];
      if (hh && ((hh.heldActions || []).some((r) => SHARE_BASIS.has(r.type) && within(r.effectiveDate)) || (hh.basisSuspicion && !(typeof hh.basisSuspicion.since === 'string' && hh.basisSuspicion.since >= end)))) return true;
      if ((x.closedHeldRows || []).some((r) => SHARE_BASIS.has(r.type) && String(r.ticker).toUpperCase() === sym && within(r.effectiveDate))) return true;
    }
    return Boolean(idea?.caCoverageGaps?.[sym]) || (l?.closedCoverageDoubts?.[sym]?.dates || []).length > 0;
  }

  /**
   * After the close of index `k`: for each ledger in `ledgers` — `{ field: { sym, entryShares, boughtAt (index), soldAt
   * (index | null) } }` — and each dividend of its symbol the inputs listed so far, received against entitled (see above).
   */
  check(idea, k, ledgers, label, { uncoveredNow = [] } = {}) {
    for (const [f, h] of Object.entries(ledgers)) {
      const l = idea?.[f];
      if (!l || !h) continue;
      const sym = h.sym;
      const entitledAt = (d) => d > h.boughtAt && (h.soldAt == null || d <= h.soldAt) && d <= k;
      const splits = [];
      let splitsWait = Infinity; // the earliest date of a split that waits (its ex-date counts depend on it)
      for (const [id, e] of this.inputs.ids) {
        if (e.sym !== sym || !SHARE_BASIS.has(e.type) || !entitledAt(e.d)) continue;
        const p = this.payloadOf(id, f);
        if (p === undefined) { splitsWait = Math.min(splitsWait, e.d); continue; }
        if (p === null || !(Number(p.ratio) > 0)) continue;
        // (When the count this split gives became known: its first listing — or, a founder's CORRECTING ruling of its ratio, the
        // close that ruling applies at: the dividends paid before it are recomputed by a proposal, as for a split listed late —
        // the shape soak's 2120900188 and 2120900265.)
        const ruled = this.authoritiesFor(null, id).filter((x) => x.kind === 'ruling' && x.correcting).map((x) => x.at);
        splits.push({ id, d: e.d, ratio: Number(p.ratio), listedAt: Math.max(this.inputs.firstListedAt(id) ?? -1, ...ruled) });
      }
      splits.sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
      // (A founder `split` for a suspicion — an accepted request — may apply, or go moot or be refused: the product decides
      // with what it holds. A dividend whose ex-date count it could touch is EXCUSED, counted apart: never assumed either way.)
      for (const rq of this.inputs.rulings) {
        if (rq.status !== 200 || rq.body?.kind !== 'suspicion' || rq.body.decision !== 'split') continue;
        const prefix = `suspected_split_${sym}_`;
        const recordId = String(rq.body.recordId || '');
        if (recordId.startsWith(prefix)) splitsWait = Math.min(splitsWait, this.S.indexOf(recordId.slice(prefix.length)));
      }
      for (const [id, e] of this.inputs.ids) {
        if (e.sym !== sym || e.type !== 'cash_dividend' || e.d > k) continue;
        const receipts = (l.corporateActionReceipts || []).filter((r) => r?.applied === true && r.actionId === id);
        const adjustments = (l.adjustments || []).filter((a) => a && a.held !== true && a.actionId === id);
        const received = addUsd(0, ...receipts.map((r) => Number(r.incomeUsd) || 0), ...adjustments.map((a) => Number(a.amountUsd) || 0));
        // A WAIT IS NEVER A PAYMENT: what adjustments moved for the id with no approval or ruling in the inputs is nought.
        const authorities = this.authoritiesFor(f, id);
        const unauthorized = addUsd(0, ...adjustments.filter((a) => !authorities.some((x) => x.at <= this.S.indexOf(a.postedOn))).map((a) => Number(a.amountUsd) || 0));
        expect(unauthorized, `${label} ${this.S[k]} I-6 ${f} ${id}: $${unauthorized} moved by adjustments the inputs never approved (a hold excuses a wait, never a payment)`).toBe(0);
        if (!entitledAt(e.d)) {
          // Owed nothing: bought on or after its ex-date, or sold before it. Never excused.
          this.nothingOwed += 1;
          expect(received, `${label} ${this.S[k]} I-6 ${f} ${id} is owed nothing (bought ${this.S[h.boughtAt]}, sold ${h.soldAt == null ? '—' : this.S[h.soldAt]}) but received $${received}`).toBe(0);
          continue;
        }
        const p = this.payloadOf(id, f);
        if (p === undefined || e.d >= splitsWait || this.scopedDoubt(idea, f, sym, id, this.S[e.d]) || uncoveredNow.includes(sym)) { this.excused += 1; continue; }
        // LATE FACTS (L-1): the id first listed after the ledger sold the stock; or a split dated on or before its ex-date
        // first listed after the close that paid it on time.
        const late = [];
        const firstListed = this.inputs.firstListedAt(id);
        // (Unpaid when the ledger sold the stock — first listed after the sale, or listed before it and held by a doubt.)
        const lateEntitlement = h.soldAt != null && receipts.length === 0;
        if (lateEntitlement && firstListed !== null) late.push(Math.max(firstListed, h.soldAt));
        // (Paid: its receipt, or — a late entitlement — its first posting. A split listed after that is a new late fact,
        // which the approval that posted it did not cover: shape seed 2119990027, a 4-for-5 listed after the approved $1.)
        const firstPosted = adjustments.map((a) => this.S.indexOf(a.postedOn)).filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? null;
        const paidAt = receipts.length > 0 ? this.S.indexOf(receipts[0].appliedOn) : firstPosted;
        if (paidAt !== null) for (const sp of splits) if (sp.d <= e.d && sp.listedAt !== null && sp.listedAt > paidAt) late.push(sp.listedAt);
        if (late.length > 0) {
          const lastLate = Math.max(...late);
          // (An approval of the proposal; on a sold holding, the conflict ruling that settled the row; or a correcting ruling,
          // which posts the net on the dated count.)
          const approved = authorities.some((x) => x.at > lastLate && x.at <= k && (x.kind === 'approval' || lateEntitlement || x.correcting));
          if (!approved) { this.waiting += 1; continue; }
          // (Approved, but L-2 refuses the posting while it stands — another candidate pairs with the id, a share-basis id dated
          // within the holding is unresolved, a holding date is uncovered: the founder's own rule, so a wait. Excuse only.)
          if (this.refusalStands(idea, f, sym, id, h, k)) { this.refused += 1; continue; }
        }
        let count = h.entryShares;
        for (const sp of splits) if (sp.d <= e.d) count = roundSharesHere(count * sp.ratio);
        const owed = p === null ? 0 : roundUsdHere(count * Number(p.amount));
        this.checked += 1;
        for (const a of adjustments) if (this.byKind[a.kind] !== undefined) this.byKind[a.kind] += 1;
        expect(received, `${label} ${this.S[k]} I-6 ${f} ${id}: received $${received}, the inputs and the holding history say $${owed} (${count} shares on ${this.S[e.d]} × ${p?.amount ?? 0})`).toBe(owed);
      }
    }
  }
}
