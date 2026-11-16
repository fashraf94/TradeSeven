// api/_utils/practiceField/evidence.test.js
//
// Practice Field T1a-2b-1 §3 — THE EVIDENCE PACKETS (shared contract V2 §6). Two per idea, create-once and immutable,
// each with a content hash: `admission`, written in admission's transaction, and `result`, written in the transaction
// of the close that writes the endpoint. The result packet holds COPIES of every price the result relied on, for every
// ledger — because the engine deletes its snapshots after 120 days, and the retention clean-up never touches anything
// under `mandates/{bookId}` (pinned here). A replay writes nothing; a second packet aborts its transaction.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { setPracticeFieldModeForTests } from './mode.js';
import { admitIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { assertReconciled } from './reconcile.js';
import { verifyPacket, resultPacketMissingMarks, jsonPure, EVIDENCE_HASH_ALGORITHM } from './evidence.js';
import { runRetentionCleanup } from '../mandateClosePass.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, contractOf, closeOn, windowAt, getBook, getIdea, dumpStore, closeNowOf, etIso, ADMIT_ISO, makeMandateFakeDb,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02'];
const DUE = S[10];
const BASE = { AAPL: 231.47, MSFT: 418.13, SPY: 597.31, XLK: 233.59 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12 };
function quotes(over = {}) {
  const out = {};
  for (const [sym, v] of Object.entries({ ...BASE, ...over })) {
    if (v === undefined) continue;
    if (typeof v === 'number') out[sym] = CAPS[sym] ? { price: v, marketCap: CAPS[sym] } : v;
    else out[sym] = CAPS[sym] && !Object.hasOwn(v, 'marketCap') ? { marketCap: CAPS[sym], ...v } : v;
  }
  return out;
}
const ideaOf = (ctx) => getIdea(ctx.db, ctx.bookId, ctx.ideaId);
const packetOf = (ctx, id) => ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/evidence/${id}`);
const recon = (ctx) => { const book = getBook(ctx.db, ctx.bookId); assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id))); };
const closeDay = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, quotes(over)); recon(ctx); return out; };

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

describe('the admission packet — in admission\'s own transaction, create-once', () => {
  it('holds the contract as frozen, the source references, what admission measured against (with the snapshot its marks came from) and the time, and hashes to itself', async () => {
    const ctx = await seedBook();
    // A first idea, entered and closed, so the book has a position, a recorded mark and a last close.
    const first = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await closeDay({ ...ctx, ideaId: first.ideaId }, S[0], { MSFT: 420.11 });
    const bookBefore = getBook(ctx.db, ctx.bookId);
    const contract = contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000, origin: { kind: 'research', initiatedBy: 'agent' }, sources: [{ kind: 'research', ref: 'rw-0042' }] });
    const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract, opId: 'second', nowIso: etIso(S[1], 11, 0) });
    expect(res.ok).toBe(true);
    const idea = getIdea(ctx.db, ctx.bookId, res.ideaId);
    const packet = ctx.db._get(`mandates/${ctx.bookId}/ideas/${res.ideaId}/evidence/admission`);
    expect(verifyPacket(packet)).toBe(true);
    expect(packet).toMatchObject({
      packetVersion: 1, packetId: 'admission', bookId: ctx.bookId, ideaId: res.ideaId, userId: 'owner-1', epochId: 'epoch-0001', contractVersion: 2,
      admittedAt: etIso(S[1], 11, 0), writtenAt: etIso(S[1], 11, 0), hashAlgorithm: EVIDENCE_HASH_ALGORITHM,
      sources: { origin: { kind: 'research', initiatedBy: 'agent' }, references: [{ kind: 'research', ref: 'rw-0042' }] },
      measuredAgainst: {
        bookRevision: bookBefore.revision, equityUsd: bookBefore.portfolio.totalValue, cashUsd: bookBefore.portfolio.cash,
        treasuryUnreservedUsd: bookBefore.treasury.unreservedCash,
        positions: { MSFT: {
          shares: bookBefore.portfolio.positions.MSFT.shares, lastMark: 420.11, lastMarkAsOf: bookBefore.portfolio.positions.MSFT.lastMarkAsOf, lastMarkSource: 'snapshot', ideaId: first.ideaId,
          // The mark's own source: S[0]'s stored close snapshot, at the vendor's time, full quality.
          markSource: { kind: 'close', snapshotKey: `${S[0]}_close`, session: S[0], quality: 'vendor_time', vendorTimeIso: bookBefore.portfolio.positions.MSFT.lastMarkAsOf, recordedMarkAsOf: bookBefore.portfolio.positions.MSFT.lastMarkAsOf },
        } },
        lastClose: { session: S[0], observed: true, closeSnapshotKey: `${S[0]}_close` },
        otherOpenIdeas: [{ ideaId: first.ideaId, status: 'holding', slot: 'short', names: ['MSFT'], capitalUsd: 20000 }],
      },
    });
    expect(packet.contract).toEqual(jsonPure(idea.contract)); // the contract EXACTLY as frozen on the idea
    expect(packet.limits.permittedMaxUsd).toBe(res.permittedMaxUsd);
    expect(packet.limits.binding).toEqual(res.binding);
    expect(packet.limits.all.map((l) => l.constraint)).toEqual(expect.arrayContaining(['slot_cap', 'cash_floor', 'single_position_cap', 'sector_cap']));
    // A tampered packet no longer hashes to itself.
    expect(verifyPacket({ ...packet, measuredAgainst: { ...packet.measuredAgainst, equityUsd: packet.measuredAgainst.equityUsd + 0.01 } })).toBe(false);
  });

  it('review B1 — each mark names its OWN source: a fill since the last close names its entry window; a mark carried at an unobserved close names no snapshot, only its vendor time', async () => {
    // (a) No close yet: MSFT was bought at S[0]'s open30; a later window served nothing; admission at 13:30.
    const a = await seedBook();
    const first = await admitAndEnter(a.db, a.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await windowAt(a.db, a.bookId, { date: S[0], slot: 'midday', quotes: quotes({ MSFT: 425.5 }) });
    const ra = await admitIdea(a.db, { bookId: a.bookId, contract: contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[0], 13, 30) });
    const pa = a.db._get(`mandates/${a.bookId}/ideas/${ra.ideaId}/evidence/admission`);
    expect(pa.measuredAgainst.lastClose).toBeNull();
    expect(pa.measuredAgainst.positions.MSFT).toMatchObject({ lastMark: 418.13, markSource: { kind: 'entry_fill', snapshotKey: `${S[0]}_open30`, session: S[0], quality: 'fill' } });
    expect(JSON.stringify(pa)).not.toMatch(/_midday/); // the window that bought nothing is not named as a source
    expect(first.entry.outcome).toBe('entered');
    // (b) S[0] closed; S[1] never stored, caught up as unobserved by S[2]'s window; admission on S[2].
    const b = await seedBook({ uid: 'owner-2', opId: 'c2' });
    const fb = await admitAndEnter(b.db, b.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await closeDay({ ...b, ideaId: fb.ideaId }, S[0], { MSFT: 420.11 });
    const vendorAtS0 = getBook(b.db, b.bookId).portfolio.positions.MSFT.lastMarkAsOf;
    const original = console.error; console.error = () => {};
    try { await windowAt(b.db, b.bookId, { date: S[2], quotes: quotes() }); } finally { console.error = original; }
    expect(getBook(b.db, b.bookId).execState.lastCloseKey).toBe(S[1]);
    const rb = await admitIdea(b.db, { bookId: b.bookId, contract: contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[2], 11, 0) });
    const pb = b.db._get(`mandates/${b.bookId}/ideas/${rb.ideaId}/evidence/admission`);
    expect(pb.measuredAgainst.lastClose).toEqual({ session: S[1], observed: false, closeSnapshotKey: null });
    expect(pb.measuredAgainst.positions.MSFT).toMatchObject({ lastMark: 420.11, markSource: { kind: 'carried', snapshotKey: null, session: S[1], quality: 'unobserved', vendorTimeIso: null, recordedMarkAsOf: vendorAtS0 } });
    expect(JSON.stringify(pb)).not.toMatch(new RegExp(`${S[1]}_close`)); // a document that never existed is never named
    // (c) R-B1c: S[0]'s close quote for MSFT carries NO vendor time. The mark is that close's (its snapshot is named),
    // its quality says so, and no vendor time is claimed — the morning quote's time stays only as what was recorded.
    const c = await seedBook({ uid: 'owner-3', opId: 'c3' });
    const fc = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await closeDay({ ...c, ideaId: fc.ideaId }, S[0], { MSFT: { price: 431.17, at: null } });
    const rc = await admitIdea(c.db, { bookId: c.bookId, contract: contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[1], 11, 0) });
    const pc = c.db._get(`mandates/${c.bookId}/ideas/${rc.ideaId}/evidence/admission`);
    expect(pc.measuredAgainst.positions.MSFT).toMatchObject({
      lastMark: 431.17, markSource: { kind: 'close', snapshotKey: `${S[0]}_close`, quality: 'receipt_time_fallback', vendorTimeIso: null },
    });
  });

  it('review B12 — the hash is of what Firestore stores: a lone surrogate (stored as U+FFFD) is made well-formed first, so the packet still verifies after the round trip', async () => {
    const ctx = await seedBook();
    const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ thesis: { text: `A thesis with a broken character \uD800 inside it, for the round trip.`, author: 'founder_fixture' } }), opId: 'surrogate', nowIso: ADMIT_ISO });
    expect(res.ok).toBe(true);
    const packet = ctx.db._get(`mandates/${ctx.bookId}/ideas/${res.ideaId}/evidence/admission`);
    expect(packet.contract.thesis.text).toContain('�');
    expect(packet.contract.thesis.text).not.toContain('\uD800');
    // What Firestore hands back: every lone surrogate replaced. The packet verifies before and after.
    const roundTripped = JSON.parse(JSON.stringify(packet).replace(/\\ud800/gi, '\\ufffd'));
    expect(verifyPacket(packet)).toBe(true);
    expect(verifyPacket(roundTripped)).toBe(true);
    expect(jsonPure({ a: 'x\uDC00y', b: ['\uD83D'] })).toEqual({ a: 'x�y', b: ['�'] });
  });

  it('a replay writes nothing; a packet already stored for the idea aborts the whole admission (create-once), and a refused admission writes none', async () => {
    const ctx = await seedBook();
    const a = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO });
    const bytes = dumpStore(ctx.db);
    expect(await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO })).toMatchObject({ ok: true, idempotentReplay: true, ideaId: a.ideaId });
    expect(dumpStore(ctx.db)).toBe(bytes);
    // A packet planted where the next idea's would go: the admission aborts, nothing is reserved or written.
    const { ideaIdFor } = await import('./admission.js');
    const next = ideaIdFor(ctx.bookId, 'idea-2');
    ctx.db._store.set(`mandates/${ctx.bookId}/ideas/${next}/evidence/admission`, { data: { planted: true }, version: 1 });
    const planted = dumpStore(ctx.db);
    await expect(admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['MSFT'] }), opId: 'idea-2', nowIso: ADMIT_ISO })).rejects.toThrow(/ALREADY_EXISTS/);
    expect(dumpStore(ctx.db)).toBe(planted);
    // A refused admission (the slot is taken): no idea, no packet.
    const refused = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ names: ['MSFT'] }), opId: 'idea-3', nowIso: ADMIT_ISO });
    expect(refused.ok).toBe(false);
    expect(ctx.db._get(`mandates/${ctx.bookId}/ideas/${ideaIdFor(ctx.bookId, 'idea-3')}/evidence/admission`)).toBeUndefined();
  });
});

describe('the result packet — in the endpoint close\'s transaction, a copy of every price the result relied on', () => {
  /**
   * A two-name idea against a sector fund: MSFT breaches its line at S[1]'s close and is sold at S[2]'s first window;
   * AAPL pays a dividend on S[4]; the idea runs to its due session S[10].
   */
  async function toTheEndpoint() {
    const { db, bookId, bookRef } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
    await closeDay(ctx, S[0]);
    const level = ideaOf(ctx).lines.find((l) => l.symbol === 'MSFT').level;
    await closeDay(ctx, S[1], { MSFT: roundUsd(level - 0.02) });
    await windowAt(db, bookId, { date: S[2], quotes: quotes({ MSFT: roundUsd(level - 0.5) }) });
    const dividend = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[4], amount: 0.26, source: 'eodhd_dividends' };
    for (let i = 2; i < 10; i += 1) await closeDay(ctx, S[i], i === 4 ? { AAPL: { price: 232.1, corporateActions: [dividend] } } : {});
    const before = dumpStore(db);
    const out = await closeDay(ctx, DUE, { AAPL: 236.4, XLK: 237.02, SPY: 601.5 });
    return { ctx, out, before };
  }

  it('every ledger: the entry fills, each line and its breach, the sales before the endpoint, the corporate actions applied, every endpoint mark with its vendor time, quality and snapshot key — and the result', async () => {
    const { ctx, out } = await toTheEndpoint();
    expect(out.endpoints).toHaveProperty(ctx.ideaId);
    const idea = ideaOf(ctx);
    const endpointRow = ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/endpoint`);
    const inception = ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/inception`);
    const packet = packetOf(ctx, 'result');
    expect(verifyPacket(packet)).toBe(true);
    expect(packet).toMatchObject({ packetVersion: 1, packetId: 'result', bookId: ctx.bookId, ideaId: ctx.ideaId, writtenAt: closeNowOf(DUE).toISOString() });
    // The result, exactly as written on the idea.
    expect(packet.result).toEqual(jsonPure(idea.result));
    // The entry: the slot snapshot and every leg of every ledger, at its fill price and quote.
    expect(packet.entry).toMatchObject({ sessionDate: S[0], snapshotKey: `${S[0]}_open30` });
    for (const name of ['idea', 'comparison', 'spy']) {
      expect(packet.entry.fills[name].map((f) => f.symbol), name).toEqual(inception.legs[name].map((r) => r.symbol));
      packet.entry.fills[name].forEach((f, i) => {
        const r = inception.legs[name][i];
        expect(f, `${name} ${f.symbol}`).toMatchObject({ executedPrice: r.executedPrice, shares: r.shares, mark: r.mark, markVendorTimeIso: r.markVendorTimeIso });
      });
    }
    expect(packet.entry.fills.comparison.map((f) => f.symbol)).toEqual(['XLK']);
    expect(packet.entry.fills.spy.map((f) => f.symbol)).toEqual(['SPY']);
    // The lines, with MSFT's breach: its close, the close's vendor time and the snapshot it was read from.
    const msft = packet.lines.find((l) => l.symbol === 'MSFT');
    expect(msft.breach).toMatchObject({ session: S[1], close: idea.lines.find((l) => l.symbol === 'MSFT').breach.close, snapshotKey: `${S[1]}_close` });
    expect(typeof msft.breach.closeVendorTimeIso).toBe('string');
    expect(packet.lines.find((l) => l.symbol === 'AAPL').breach).toBeNull();
    // The sale before the endpoint (only the idea's own ledger ever sells).
    expect(packet.salesBeforeEndpoint.idea).toEqual([expect.objectContaining({ kind: 'line_exit', symbol: 'MSFT', tickKey: `${S[2]}_open30`, executedPrice: idea.ledger.saleReceipts[0].executedPrice })]);
    expect(packet.salesBeforeEndpoint.comparison).toEqual([]);
    expect(packet.salesBeforeEndpoint.spy).toEqual([]);
    // The corporate actions applied: AAPL's dividend on the idea's ledger only (the comparison holds XLK, SPY holds SPY).
    expect(packet.corporateActions.idea.map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[4]}`]);
    expect(packet.corporateActions.comparison).toEqual([]);
    // Every endpoint mark of every ledger, with its vendor time and quality, and the endpoint snapshot's key.
    expect(packet.endpoint).toMatchObject({ session: DUE, kind: 'due_session', closeSnapshotKey: `${DUE}_close`, observed: true });
    expect(resultPacketMissingMarks(packet, endpointRow)).toEqual([]);
    expect(packet.endpoint.ledgers.idea.marks.AAPL).toMatchObject({ mark: 236.4, markQuality: 'vendor_time' });
    expect(packet.endpoint.ledgers.comparison.marks.XLK).toMatchObject({ mark: 237.02, markQuality: 'vendor_time' });
    expect(packet.endpoint.ledgers.spy.marks.SPY).toMatchObject({ mark: 601.5, markQuality: 'vendor_time' });
    for (const name of ['idea', 'comparison', 'spy']) {
      for (const [sym, m] of Object.entries(packet.endpoint.ledgers[name].marks)) expect(m.markVendorTimeIso, `${name} ${sym}`).toBe(endpointRow[name].holdings[sym].markVendorTimeIso);
    }
    // A packet that drops one ledger's marks is named — every ledger, every holding.
    const dropped = { ...packet, endpoint: { ...packet.endpoint, ledgers: { ...packet.endpoint.ledgers, spy: { ...packet.endpoint.ledgers.spy, marks: {} } } } };
    expect(resultPacketMissingMarks(dropped, endpointRow)).toEqual(['spy:SPY']);
    // The admission packet is there too: two packets per idea.
    expect(verifyPacket(packetOf(ctx, 'admission'))).toBe(true);
  });

  it('review B2 — a mark CARRIED at the endpoint (its symbol missing from the close document) keeps its last observation time; without it the packet is not whole', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
    for (let i = 0; i < 10; i += 1) await closeDay(ctx, S[i]);
    const spyAt = ideaOf(ctx).spyLedger.holdings.SPY.lastMarkAsOf;
    expect(typeof spyAt).toBe('string');
    await closeDay(ctx, DUE, { SPY: undefined }); // the due session's close document has no SPY quote
    const packet = packetOf(ctx, 'result');
    const endpointRow = ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/endpoint`);
    expect(packet.endpoint.ledgers.spy.marks.SPY).toMatchObject({ markQuality: 'carried_forward', markVendorTimeIso: null, carriedFromVendorTimeIso: spyAt });
    expect(packet.endpoint.ledgers.idea.marks.AAPL).not.toHaveProperty('carriedFromVendorTimeIso'); // a fresh mark carries its own time
    expect(resultPacketMissingMarks(packet, endpointRow)).toEqual([]);
    const timeless = { ...packet, endpoint: { ...packet.endpoint, ledgers: { ...packet.endpoint.ledgers, spy: { ...packet.endpoint.ledgers.spy, marks: { SPY: { ...packet.endpoint.ledgers.spy.marks.SPY, carriedFromVendorTimeIso: null } } } } } };
    expect(resultPacketMissingMarks(timeless, endpointRow)).toEqual(['spy:SPY']);
    // …and the running record the result's decline and exposure were computed from is copied too (review B13).
    expect(packet.track).toEqual(jsonPure(ideaOf(ctx).track));
  });

  it('written ONCE: a replayed close writes nothing; a result packet already stored aborts the endpoint close whole', async () => {
    const { ctx } = await toTheEndpoint();
    const bytes = dumpStore(ctx.db);
    expect(await closeIdeaBook(ctx.db, ctx.bookRef, { date: DUE, now: closeNowOf(DUE) })).toMatchObject({ closed: false, skipped: 'already_closed' });
    expect(dumpStore(ctx.db)).toBe(bytes);
    // Another book run to the same point with a packet planted at the result's place: the close aborts, no endpoint,
    // no result, no row — the store is as it was.
    const second = await (async () => {
      const { db, bookId, bookRef } = await seedBook();
      const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: quotes(), date: S[0] });
      const c = { db, bookId, bookRef, ideaId: r.ideaId };
      for (let i = 0; i < 10; i += 1) await closeDay(c, S[i]);
      return c;
    })();
    second.db._store.set(`mandates/${second.bookId}/ideas/${second.ideaId}/evidence/result`, { data: { planted: true }, version: 1 });
    const planted = dumpStore(second.db);
    await expect(closeOn(second.db, second.bookId, DUE, quotes())).rejects.toThrow(/ALREADY_EXISTS/);
    const withSnapshot = JSON.parse(planted);
    expect(Object.keys(JSON.parse(dumpStore(second.db))).filter((p) => !(p in withSnapshot))).toEqual([`mandateUniverseSnapshots/${DUE}_close`]); // only the snapshot the test stored
    expect(ideaOf(second).result).toBeNull();
  });

  it('an idea with an endpoint and no inception row cannot get a result packet: the close refuses it, writing nothing', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
    for (let i = 0; i < 10; i += 1) await closeDay(ctx, S[i]);
    db._store.delete(`mandates/${bookId}/ideas/${r.ideaId}/rows/inception`);
    const before = dumpStore(db);
    await expect(closeOn(db, bookId, DUE, quotes())).rejects.toThrow(/inception_row_missing/);
    expect(Object.keys(JSON.parse(dumpStore(db))).filter((p) => !(p in JSON.parse(before)))).toEqual([`mandateUniverseSnapshots/${DUE}_close`]);
  });
});

describe('copies outlive the engine\'s snapshots: the retention clean-up never reaches under a book', () => {
  it('runRetentionCleanup deletes old snapshots and daily documents and leaves every document under mandates/ — evidence, rows, the window ledger — untouched', async () => {
    const OLD = '2026-01-05';
    const db = makeMandateFakeDb({
      [`mandateUniverseSnapshots/${OLD}_open30`]: { old: true },
      [`mandateUniverseSnapshots/${OLD}_close`]: { old: true },
      [`mandateUniverseDaily/${OLD}`]: { old: true },
      [`mandates/pf_x/ideas/idea_x/evidence/result`]: { packetId: 'result', endpoint: { session: OLD } },
      [`mandates/pf_x/ideas/idea_x/evidence/admission`]: { packetId: 'admission' },
      [`mandates/pf_x/ideas/idea_x/rows/${OLD}`]: { date: OLD },
      [`mandates/pf_x/windows/${OLD}_close`]: { sessionDate: OLD },
      [`mandates/pf_x/dailyRows/${OLD}`]: { date: OLD },
      [`mandates/${OLD}_book`]: { kind: 'idea_book' }, // even a book whose id sorts like an old date
    });
    const keep = Object.fromEntries([...db._store.keys()].filter((p) => p.startsWith('mandates/')).map((p) => [p, JSON.stringify(db._store.get(p))]));
    const deleted = await runRetentionCleanup(db, { now: new Date('2026-11-17T21:30:00Z') });
    expect(deleted).toBe(3);
    for (const p of [`mandateUniverseSnapshots/${OLD}_open30`, `mandateUniverseSnapshots/${OLD}_close`, `mandateUniverseDaily/${OLD}`]) expect(db._get(p), p).toBeUndefined();
    for (const [p, bytes] of Object.entries(keep)) expect(JSON.stringify(db._store.get(p)), p).toBe(bytes);
  });

  it('…and its source names only the stores it may clean: the snapshots, the daily documents and the batch bookkeeping', () => {
    const src = readFileSync(new URL('../mandateClosePass.js', import.meta.url), 'utf8');
    const start = src.indexOf('export async function runRetentionCleanup(');
    const body = src.slice(start, src.indexOf('\n}\n', start) > 0 ? src.indexOf('\n}\n', start) : src.indexOf('\r\n}\r\n', start));
    expect(body.length).toBeGreaterThan(200);
    expect(body).not.toMatch(/mandates|MANDATES_COLLECTION|collectionGroup|recursiveDelete/);
    const literals = [...body.matchAll(/collection\(([^)]+)\)/g)].map((m) => m[1].trim());
    expect(literals).toEqual(['collection', 'MANDATE_BATCH_COLLECTION']);
    expect(body).toMatch(/for \(const collection of \['mandateUniverseSnapshots', 'mandateUniverseDaily'\]\)/);
  });
});
