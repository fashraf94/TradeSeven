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
  ruling(body, out, requestKey, nextClose) {
    const status = out?.status ?? null;
    this.rulings.push({ at: nextClose, body, status, requestKey });
    const id = body?.kind === 'conflict' ? body.recordId : (body?.kind === 'suspicion' && body.decision === 'split' ? this.splitIdOf(body) : null);
    if (id && status === 200) this.event(id, nextClose, body.kind === 'conflict' ? (body.decision === 'none' ? 'rule_none' : 'rule_payload') : 'rule_suspicion_split');
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
      // CONSERVATION — dividends: the ledger's dividends are its applied receipts' income, and nothing else.
      expect(l.dividendsUsd ?? 0, `${label} ${date} conservation ${f} dividends = Σ receipts`).toBe(addUsd(0, ...applied.map((r) => Number(r.incomeUsd) || 0)));
      // …shares: every holding's count is the chain of its applied share-basis receipts from the entry count.
      const counts = new Map();
      for (const [sym, h] of Object.entries(initialOf?.[f] || {})) counts.set(sym, [Number(h.shares)]);
      for (const r of applied) {
        if (!SHARE_BASIS.has(r.type)) continue;
        const sym = String(r.ticker).toUpperCase();
        const chain = counts.get(sym) || [];
        expect(r.sharesBefore, `${label} ${date} conservation ${f} ${r.actionId} sharesBefore = the count before it`).toBe(chain.at(-1));
        chain.push(r.sharesAfter);
        counts.set(sym, chain);
      }
      for (const [sym, chain] of counts) if (l.holdings?.[sym]) expect(l.holdings[sym].shares, `${label} ${date} conservation ${f} ${sym} shares = receipt chain`).toBe(chain.at(-1));
      // …income: each dividend receipt's income is ITS amount times the count the holding had WHEN it was applied (receipts
      // are kept in the order applied), or its recorded ex-date count (AR3-O3: before, any count in the chain passed).
      const now = new Map([...Object.entries(initialOf?.[f] || {})].map(([sym, h]) => [sym, Number(h.shares)]));
      for (const r of applied) {
        const sym = String(r.ticker).toUpperCase();
        if (SHARE_BASIS.has(r.type)) { now.set(sym, r.sharesAfter); continue; }
        if (r.type !== 'cash_dividend') continue;
        const n = r.entitledShares != null ? Number(r.entitledShares) : now.get(sym);
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
