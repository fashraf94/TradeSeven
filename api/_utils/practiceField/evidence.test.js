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
import { closeIdeaBook, catchUpIdeaBook } from './close.js';
import { assertReconciled } from './reconcile.js';
import {
  verifyPacket, resultPacketMissingMarks, resultPacketProvenanceProblems, recomputeResultFromPacket, jsonPure, EVIDENCE_HASH_ALGORITHM,
  buildAdmissionPacket, RESULT_RECEIPT_PART_PREFIX, resultPacketPartProblems, resultPacketReceipts,
  buildResultEvidence, firestoreValueBytes, RESULT_RECEIPT_BOUND, RESULT_RECEIPT_PART_MAX_BYTES,
} from './evidence.js';
import { nextSessionDate, sessionAfter, slotSessions } from './windows.js';
import { FROZEN_BASKET_SIZE } from './constants.js';
import { parseSplitsPayload, parseDividendsPayload } from '../mandateCorporateActions.js';
import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';
import { valueLedger } from './ledger.js';
import { canonicalContentHash } from '../canonicalHash.js';
import { runRetentionCleanup } from '../mandateClosePass.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, contractOf, closeOn, windowAt, getBook, getIdea, dumpStore, closeNowOf, etIso, ADMIT_ISO, makeMandateFakeDb,
  storeTickSnapshot, coverHeldNames,
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
/**
 * A document's size by Firestore's storage-size rules (firebase.google.com/docs/firestore/storage-size): a string is
 * its UTF-8 bytes + 1; a number, 8; a boolean or null, 1; a map, the sum of its keys (as strings) and values; an array,
 * the sum of its values; the document, its name's size (each path segment as a string, + 16) + its fields + 32.
 */
function firestoreDocumentBytes(name, data) {
  const str = (s) => Buffer.byteLength(s, 'utf8') + 1;
  const val = (v) => {
    if (v === null || typeof v === 'boolean') return 1;
    if (typeof v === 'number') return 8;
    if (typeof v === 'string') return str(v);
    if (Array.isArray(v)) return v.reduce((n, x) => n + val(x), 0);
    return Object.entries(v).reduce((n, [k, x]) => n + str(k) + val(x), 0);
  };
  const nameBytes = name.split('/').slice(5).reduce((n, seg) => n + str(seg), 16);
  return nameBytes + val(data) + 32;
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
    // S[1]'s 10:00 window snapshot: admission at 11:00 measures the book at it (T1a-2b-2 §1). MSFT is there at the
    // close's price, so the measured equity is the recorded one — the packet carries both.
    await storeTickSnapshot(ctx.db, S[1], 'open30', quotes({ MSFT: 420.11 }));
    const bookBefore = getBook(ctx.db, ctx.bookId);
    const contract = contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000, origin: { kind: 'research', initiatedBy: 'agent' }, sources: [{ kind: 'research', ref: 'rw-0042' }] });
    coverHeldNames(ctx.db, ctx.bookId, etIso(S[1], 11, 0)); // S[1]'s corporate-action coverage (Astra T2C-01)
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
        bookRevision: bookBefore.revision, equityUsd: bookBefore.portfolio.totalValue, recordedEquityUsd: bookBefore.portfolio.totalValue,
        cashUsd: bookBefore.portfolio.cash, treasuryUnreservedUsd: bookBefore.treasury.unreservedCash,
        // T1a-2b-2 §1: the ONE set it was measured at — S[1]'s newest snapshot at 11:00, its 10:00 window's — each mark
        // copied with its quality, vendor time and age, and the equity derived from them.
        admissionMarks: {
          basis: 'session_snapshot', session: S[1], snapshotKey: `${S[1]}_open30`, considered: [`${S[1]}_open30`], at: etIso(S[1], 11, 0),
          marks: { MSFT: { price: 420.11, quality: 'vendor_time', vendorTimeIso: etIso(S[1], 9, 45), ageAtAdmissionMs: 75 * 60_000, snapshotKey: `${S[1]}_open30` } },
          treasuryUsd: bookBefore.treasury.unreservedCash, equityUsd: bookBefore.portfolio.totalValue,
        },
        positions: { MSFT: {
          shares: bookBefore.portfolio.positions.MSFT.shares, lastMark: 420.11, lastMarkSource: 'snapshot', ideaId: first.ideaId,
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

  it('review B1, Astra T2B-01 — each mark names its OWN source: a fill since the last close names its entry window; a mark carried at an unobserved close names the close it was last observed at — its snapshot and its own time', async () => {
    // (a) No close yet: MSFT was bought at S[0]'s open30; a later window served nothing; admission at 13:30.
    const a = await seedBook();
    const first = await admitAndEnter(a.db, a.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await windowAt(a.db, a.bookId, { date: S[0], slot: 'midday', quotes: quotes({ MSFT: 425.5 }) });
    coverHeldNames(a.db, a.bookId, etIso(S[0], 13, 30)); // S[0]'s corporate-action coverage (Astra T2C-01)
    const ra = await admitIdea(a.db, { bookId: a.bookId, contract: contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[0], 13, 30) });
    const pa = a.db._get(`mandates/${a.bookId}/ideas/${ra.ideaId}/evidence/admission`);
    expect(pa.measuredAgainst.lastClose).toBeNull();
    expect(pa.measuredAgainst.positions.MSFT).toMatchObject({ lastMark: 418.13, markSource: { kind: 'entry_fill', source: 'fill', symbol: 'MSFT', snapshotKey: `${S[0]}_open30`, session: S[0], quality: 'vendor_time' } });
    // The fill's quote's own time — the open30 snapshot's quotes are observed 15 minutes before the slot opens.
    expect(pa.measuredAgainst.positions.MSFT.markSource.vendorTimeIso).toBe(getIdea(a.db, a.bookId, first.ideaId).ledger.holdings.MSFT.lastMarkProvenance.vendorTimeIso);
    expect(typeof pa.measuredAgainst.positions.MSFT.markSource.vendorTimeIso).toBe('string');
    // The window that bought nothing is not named as the SOURCE of a recorded mark — it is the snapshot admission
    // measured against at 13:30 (T1a-2b-2 §1: the newest of the session), and the packet says that, apart.
    expect(JSON.stringify(pa.measuredAgainst.positions)).not.toMatch(/_midday/);
    expect(pa.measuredAgainst.admissionMarks).toMatchObject({ basis: 'session_snapshot', snapshotKey: `${S[0]}_midday`, marks: { MSFT: { price: 425.5 } } });
    expect(first.entry.outcome).toBe('entered');
    // (b) S[0] closed; S[1] never stored, caught up as unobserved by S[2]'s window; admission on S[2].
    const b = await seedBook({ uid: 'owner-2', opId: 'c2' });
    const fb = await admitAndEnter(b.db, b.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await closeDay({ ...b, ideaId: fb.ideaId }, S[0], { MSFT: 420.11 });
    const vendorAtS0 = getBook(b.db, b.bookId).portfolio.positions.MSFT.lastMarkAsOf;
    const original = console.error; console.error = () => {};
    try { await windowAt(b.db, b.bookId, { date: S[2], quotes: quotes() }); } finally { console.error = original; }
    expect(getBook(b.db, b.bookId).execState.lastCloseKey).toBe(S[1]);
    coverHeldNames(b.db, b.bookId, etIso(S[2], 11, 0)); // S[2]'s corporate-action coverage (Astra T2C-01)
    const rb = await admitIdea(b.db, { bookId: b.bookId, contract: contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[2], 11, 0) });
    const pb = b.db._get(`mandates/${b.bookId}/ideas/${rb.ideaId}/evidence/admission`);
    expect(pb.measuredAgainst.lastClose).toEqual({ session: S[1], observed: false, closeSnapshotKey: null });
    // Carried through the unobserved S[1]: the price is S[0]'s close, and the packet says so — that close's snapshot, its
    // quality and its own vendor time (Astra T2B-01; before, a carried mark named no snapshot).
    expect(pb.measuredAgainst.positions.MSFT).toMatchObject({ lastMark: 420.11, markSource: { kind: 'carried', source: 'close', snapshotKey: `${S[0]}_close`, session: S[0], quality: 'vendor_time', vendorTimeIso: vendorAtS0, recordedMarkAsOf: vendorAtS0 } });
    expect(JSON.stringify(pb)).not.toMatch(new RegExp(`${S[1]}_close`)); // a document that never existed is never named
    // (c) R-B1c: S[0]'s close quote for MSFT carries NO vendor time. The mark is that close's (its snapshot is named),
    // its quality says so, and no vendor time is claimed — the morning quote's time stays only as what was recorded.
    const c = await seedBook({ uid: 'owner-3', opId: 'c3' });
    const fc = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await closeDay({ ...c, ideaId: fc.ideaId }, S[0], { MSFT: { price: 431.17, at: null } });
    await storeTickSnapshot(c.db, S[1], 'open30', quotes()); // S[1]'s 10:00 window (T1a-2b-2 §1)
    coverHeldNames(c.db, c.bookId, etIso(S[1], 11, 0)); // S[1]'s corporate-action coverage (Astra T2C-01)
    const rc = await admitIdea(c.db, { bookId: c.bookId, contract: contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[1], 11, 0) });
    const pc = c.db._get(`mandates/${c.bookId}/ideas/${rc.ideaId}/evidence/admission`);
    expect(pc.measuredAgainst.positions.MSFT).toMatchObject({
      lastMark: 431.17, markSource: { kind: 'close', snapshotKey: `${S[0]}_close`, quality: 'receipt_time_fallback', vendorTimeIso: null },
    });
    // (d) Astra T2B-01: that untimed S[0] close is then CARRIED through an unobserved S[1]. It stays untimed: the packet
    // names S[0]'s snapshot and no vendor time — never the morning quote's time, which the position keeps only as its
    // recorded `lastMarkAsOf` (the gap screen's anchor, ledger.js).
    const d = await seedBook({ uid: 'owner-4', opId: 'c4' });
    const fd = await admitAndEnter(d.db, d.bookId, { contract: contractOf({ names: ['MSFT'] }), opId: 'first', quotes: quotes(), date: S[0] });
    await closeDay({ ...d, ideaId: fd.ideaId }, S[0], { MSFT: { price: 431.17, at: null } });
    const morning = getBook(d.db, d.bookId).portfolio.positions.MSFT.lastMarkAsOf;
    expect(typeof morning).toBe('string');
    const quiet = console.error; console.error = () => {};
    try { await windowAt(d.db, d.bookId, { date: S[2], quotes: quotes() }); } finally { console.error = quiet; }
    expect(getBook(d.db, d.bookId).execState.lastCloseKey).toBe(S[1]);
    coverHeldNames(d.db, d.bookId, etIso(S[2], 11, 0)); // S[2]'s corporate-action coverage (Astra T2C-01)
    const rd = await admitIdea(d.db, { bookId: d.bookId, contract: contractOf({ slot: 'medium', names: ['AAPL'], capitalUsd: 25000 }), opId: 'second', nowIso: etIso(S[2], 11, 0) });
    const pd = d.db._get(`mandates/${d.bookId}/ideas/${rd.ideaId}/evidence/admission`);
    expect(pd.measuredAgainst.positions.MSFT.markSource).toEqual({
      kind: 'carried', source: 'close', symbol: 'MSFT', session: S[0], snapshotKey: `${S[0]}_close`, quality: 'receipt_time_fallback', vendorTimeIso: null, recordedMarkAsOf: morning,
    });
    // Review P-1: the morning time is not sealed beside the untimed price — only inside markSource, labelled.
    expect(pd.measuredAgainst.positions.MSFT).not.toHaveProperty('lastMarkAsOf');
    expect(JSON.stringify(pd).split(morning)).toHaveLength(2);
  });

  it('review B12 — the hash is of what Firestore stores: a lone surrogate (stored as U+FFFD) is made well-formed first, so the packet still verifies after the round trip', async () => {
    const ctx = await seedBook();
    const broken = `A thesis with a broken character \uD800 inside it, for the round trip.`;
    // Since T1a-2b-2 §2 admission refuses such a thesis before any packet is built …
    expect(await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ thesis: { text: broken, author: 'founder_fixture' } }), opId: 'surrogate', nowIso: ADMIT_ISO }))
      .toMatchObject({ ok: false, refusals: [{ code: 'text_invalid', field: 'thesis.text' }] });
    // … and the packet's own guard stays behind it: a packet sealed over a contract holding one.
    const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf(), opId: 'whole', nowIso: ADMIT_ISO });
    const idea = getIdea(ctx.db, ctx.bookId, res.ideaId);
    const packet = buildAdmissionPacket({
      bookId: ctx.bookId, book: getBook(ctx.db, ctx.bookId), ideas: [], verdict: null, nowIso: ADMIT_ISO,
      idea: { ...idea, contract: { ...idea.contract, thesis: { ...idea.contract.thesis, text: broken } } },
    });
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
    // The corporate actions applied: AAPL's dividend on the idea's ledger only (the comparison holds XLK, SPY holds SPY)
    // — in the packet's one numbered part (T1a-2b-2 §4.4), whose hash the packet records.
    const partDocs = { [`${RESULT_RECEIPT_PART_PREFIX}001`]: ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/evidence/${RESULT_RECEIPT_PART_PREFIX}001`) };
    expect(packet.corporateActions).toMatchObject({ receipts: 1, byLedger: { idea: 1, comparison: 0, spy: 0 }, parts: [{ id: `${RESULT_RECEIPT_PART_PREFIX}001`, receipts: 1 }] });
    expect(resultPacketPartProblems(packet, partDocs)).toEqual([]);
    expect(resultPacketReceipts(packet, partDocs).map((r) => `${r.ledger}:${r.actionId}`)).toEqual([`idea:cash_dividend_AAPL_${S[4]}`]);
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

  it('review B2, Astra T2B-01 — a mark CARRIED at the endpoint (its symbol missing from the close document) names its source — the close it was last observed at, its snapshot, quality and time; without it the packet is not whole', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
    for (let i = 0; i < 10; i += 1) await closeDay(ctx, S[i]);
    const spyAt = ideaOf(ctx).spyLedger.holdings.SPY.lastMarkAsOf;
    expect(typeof spyAt).toBe('string');
    await closeDay(ctx, DUE, { SPY: undefined }); // the due session's close document has no SPY quote
    const packet = packetOf(ctx, 'result');
    const endpointRow = ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/endpoint`);
    expect(packet.endpoint.ledgers.spy.marks.SPY).toMatchObject({
      markQuality: 'carried_forward', markVendorTimeIso: null, markSource: 'carry_over', snapshotKey: `${S[9]}_close`,
      carriedFrom: { source: 'close', symbol: 'SPY', session: S[9], snapshotKey: `${S[9]}_close`, quality: 'vendor_time', vendorTimeIso: spyAt },
    });
    expect(packet.endpoint.ledgers.idea.marks.AAPL).not.toHaveProperty('carriedFrom'); // a fresh mark carries its own time
    expect(packet.endpoint.ledgers.idea.marks.AAPL).toMatchObject({ markSource: 'snapshot', snapshotKey: `${DUE}_close` });
    expect(resultPacketMissingMarks(packet, endpointRow)).toEqual([]);
    const withSpy = (m) => ({ ...packet, endpoint: { ...packet.endpoint, ledgers: { ...packet.endpoint.ledgers, spy: { ...packet.endpoint.ledgers.spy, marks: { SPY: m } } } } });
    const spyMark = packet.endpoint.ledgers.spy.marks.SPY;
    // Not whole: no source; a timed source with its time dropped; a source with no snapshot.
    expect(resultPacketMissingMarks(withSpy({ ...spyMark, carriedFrom: null }), endpointRow)).toEqual(['spy:SPY']);
    expect(resultPacketMissingMarks(withSpy({ ...spyMark, carriedFrom: { ...spyMark.carriedFrom, vendorTimeIso: null } }), endpointRow)).toEqual(['spy:SPY']);
    expect(resultPacketMissingMarks(withSpy({ ...spyMark, carriedFrom: { ...spyMark.carriedFrom, snapshotKey: null }, snapshotKey: null }), endpointRow)).toEqual(['spy:SPY']);
    // …and the running record the result's decline and exposure were computed from is copied too (review B13).
    expect(packet.track).toEqual(jsonPure(ideaOf(ctx).track));
  });

  it('fix-round refuter NF-2 — a FRESH endpoint price the vendor gave no time for (receipt_time_fallback) borrows no earlier quote\'s time, and the packet is whole without one', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
    for (let i = 0; i < 10; i += 1) await closeDay(ctx, S[i]);
    const earlier = ideaOf(ctx).ledger.holdings.AAPL.lastMarkAsOf;
    expect(typeof earlier).toBe('string');
    await closeDay(ctx, DUE, { AAPL: { price: 240.55, at: null } }); // the due close's AAPL quote has no vendor time
    const packet = packetOf(ctx, 'result');
    const endpointRow = ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/endpoint`);
    expect(endpointRow.idea.holdings.AAPL).toMatchObject({ mark: 240.55, markQuality: 'receipt_time_fallback', markVendorTimeIso: null });
    const aapl = packet.endpoint.ledgers.idea.marks.AAPL;
    expect(aapl).toMatchObject({ mark: 240.55, markQuality: 'receipt_time_fallback', markVendorTimeIso: null });
    expect(aapl).not.toHaveProperty('carriedFrom'); // this close's own price: no earlier time is paired with it
    expect(aapl).toMatchObject({ markSource: 'snapshot', snapshotKey: `${DUE}_close` });
    expect(resultPacketMissingMarks(packet, endpointRow)).toEqual([]);
    // A packet that paired this price with the earlier quote's time is named — as its own time, or as a carried one.
    const withAapl = (m) => ({ ...packet, endpoint: { ...packet.endpoint, ledgers: { ...packet.endpoint.ledgers, idea: { ...packet.endpoint.ledgers.idea, marks: { ...packet.endpoint.ledgers.idea.marks, AAPL: m } } } } });
    expect(resultPacketMissingMarks(withAapl({ ...aapl, markVendorTimeIso: earlier }), endpointRow)).toEqual(['idea:AAPL']);
    expect(resultPacketMissingMarks(withAapl({ ...aapl, carriedFrom: { source: 'close', symbol: 'AAPL', session: S[9], snapshotKey: `${S[9]}_close`, quality: 'vendor_time', vendorTimeIso: earlier } }), endpointRow)).toEqual(['idea:AAPL']);
  });

  describe('Astra T2B-01 — a carried untimed quote never acquires another quote\'s vendor time, on any ledger, through any carry', () => {
    // Her sequence: AAPL against XLK (SPY beside), normal closes through 27 Nov (an early close: its quotes are timed
    // 13:00 Eastern, 2026-11-27T18:00:00Z); on 30 Nov the close quotes of all three carry NO vendor time; the due session
    // 1 Dec carries them — its close document lacks them (observed), or it has no stored document at all (unobserved,
    // caught up). Controls: a fresh untimed endpoint, and a carried GENUINELY timed quote.
    const UNTIMED = { AAPL: { price: 101.234, at: null }, XLK: { price: 202.345, at: null }, SPY: { price: 503.456, at: null } };
    const TIMED = { AAPL: 101.234, XLK: 202.345, SPY: 503.456 };
    const NOV27 = '2026-11-27T18:00:00.000Z';
    const DROPPED = { AAPL: undefined, XLK: undefined, SPY: undefined };
    async function run({ nov30, dec1 }) {
      const { db, bookId, bookRef } = await seedBook();
      const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: quotes(), date: S[0] });
      const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
      for (let i = 0; i < 9; i += 1) await closeDay(ctx, S[i]);
      expect(ideaOf(ctx).ledger.holdings.AAPL.lastMarkAsOf).toBe(NOV27);
      await closeDay(ctx, S[9], nov30);
      if (dec1 === 'unobserved') {
        const quiet = console.error; console.error = () => {};
        try { await catchUpIdeaBook(db, bookRef, { before: S[11], now: closeNowOf(S[11]) }); } finally { console.error = quiet; }
      } else {
        await closeDay(ctx, DUE, dec1);
      }
      const packet = packetOf(ctx, 'result');
      const endpointRow = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/endpoint`);
      expect(packet.endpoint.session).toBe(DUE);
      expect(verifyPacket(packet)).toBe(true);
      expect(resultPacketMissingMarks(packet, endpointRow)).toEqual([]);
      return { packet, endpointRow, marks: ['idea', 'comparison', 'spy'].map((k) => [k, packet.endpoint.ledgers[k].marks]) };
    }
    const nov30Source = (symbol, over = {}) => ({ source: 'close', symbol, session: S[9], snapshotKey: `${S[9]}_close`, quality: 'receipt_time_fallback', vendorTimeIso: null, ...over });

    for (const [label, dec1] of [['1 Dec observed, its close document without the three quotes', DROPPED], ['1 Dec never stored, caught up as unobserved', 'unobserved']]) {
      it(`untimed on 30 Nov, carried at the endpoint — ${label}: every ledger names 30 Nov's snapshot and NO vendor time`, async () => {
        const { packet, marks, endpointRow } = await run({ nov30: UNTIMED, dec1 });
        for (const [k, m] of marks) {
          const [sym] = Object.keys(m);
          expect(m[sym], k).toMatchObject({ mark: UNTIMED[sym].price, markVendorTimeIso: null, snapshotKey: `${S[9]}_close`, carriedFrom: nov30Source(sym) });
        }
        expect(JSON.stringify(packet.endpoint)).not.toContain(NOV27);
        // The borrowed pairing — 30 Nov's price with 27 Nov's time — is refused, on every ledger.
        for (const [k, m] of marks) {
          const [sym] = Object.keys(m);
          const borrowed = { ...packet, endpoint: { ...packet.endpoint, ledgers: { ...packet.endpoint.ledgers, [k]: { ...packet.endpoint.ledgers[k], marks: { [sym]: { ...m[sym], carriedFrom: { ...m[sym].carriedFrom, vendorTimeIso: NOV27 } } } } } } };
          expect(resultPacketMissingMarks(borrowed, endpointRow), k).toEqual([`${k}:${sym}`]);
        }
      });
    }

    it('control — a FRESH untimed endpoint price: this close\'s own, no vendor time, nothing carried', async () => {
      const { packet, marks } = await run({ nov30: {}, dec1: UNTIMED });
      for (const [k, m] of marks) {
        const [sym] = Object.keys(m);
        expect(m[sym], k).toMatchObject({ mark: UNTIMED[sym].price, markQuality: 'receipt_time_fallback', markVendorTimeIso: null, markSource: 'snapshot', snapshotKey: `${DUE}_close` });
        expect(m[sym], k).not.toHaveProperty('carriedFrom');
      }
      expect(JSON.stringify(packet.endpoint)).not.toContain(NOV27);
    });

    it('control — a GENUINELY timed 30 Nov quote, carried at the endpoint: it keeps its own time (16:00 Eastern on 30 Nov)', async () => {
      const { marks } = await run({ nov30: TIMED, dec1: DROPPED });
      for (const [k, m] of marks) {
        const [sym] = Object.keys(m);
        expect(m[sym], k).toMatchObject({ mark: TIMED[sym], carriedFrom: nov30Source(sym, { quality: 'vendor_time', vendorTimeIso: etIso(S[9], 16, 0) }) });
      }
    });
  });

  describe('Astra T2B-03 — the packet holds every close its decline and exposure rest on, and they are recomputed from it alone', () => {
    // Her case: a short AAPL idea against XLK, entered and ended at ordinary quotes, with ONE close — 19 Nov — at
    // AAPL 123.4567 and XLK 234.5678: the peak both largest declines are measured from.
    const Q = { AAPL: { price: 100, marketCap: 3e12 }, XLK: 200, SPY: 500 };
    const PEAK = { AAPL: { price: 123.4567, marketCap: 3e12 }, XLK: 234.5678, SPY: 501.2345 };
    async function herCase() {
      const { db, bookId, bookRef } = await seedBook();
      const r = await admitAndEnter(db, bookId, { contract: contractOf({ comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: Q, date: S[0] });
      for (let i = 0; i <= 10; i += 1) await closeOn(db, bookId, S[i], i === 3 ? PEAK : Q);
      const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
      return { ctx, packet: packetOf(ctx, 'result'), idea: ideaOf(ctx) };
    }

    it('19 Nov\'s prices are in the packet, on every ledger, as that close\'s row recorded them — with every other close from entry to endpoint', async () => {
      const { ctx, packet, idea } = await herCase();
      expect(verifyPacket(packet)).toBe(true);
      expect(packet.observations.map((o) => o.date)).toEqual(S.slice(0, 11));
      const nov19 = packet.observations.find((o) => o.date === S[3]);
      const row = ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/${S[3]}`);
      expect(nov19).toMatchObject({ observed: true, fullQuality: true, closeSnapshotKey: `${S[3]}_close` });
      expect(nov19.ledgers.idea).toMatchObject({ markedValueUsd: row.markedValue, cashUsd: row.cash, markedHoldingsValueUsd: row.markedHoldingsValue });
      expect(nov19.ledgers.idea.holdings.AAPL).toEqual({ shares: row.quantities.AAPL, mark: 123.4567, quality: 'vendor_time', vendorTimeIso: row.marks.AAPL.vendorTimeIso, markSource: 'snapshot', snapshotKey: `${S[3]}_close` });
      expect(nov19.ledgers.comparison.holdings.XLK).toMatchObject({ mark: 234.5678, snapshotKey: `${S[3]}_close` });
      expect(nov19.ledgers.spy.holdings.SPY).toMatchObject({ mark: 501.2345 });
      expect(nov19.ledgers.comparison).toMatchObject({ markedValueUsd: row.comparisonMarkedValue, cashUsd: row.comparisonCash });
      // Her figures: the largest declines measured from that peak.
      expect(idea.result.largestDecline.idea).toMatchObject({ usd: 4689.93, peakOn: S[3] });
      expect(idea.result.largestDecline.comparison).toMatchObject({ usd: 3455.74, peakOn: S[3] });
      expect(resultPacketProvenanceProblems(packet)).toEqual([]);
    });

    it('the largest decline and the exposure are RECOMPUTED from the packet alone — every snapshot and row deleted, its own `track` removed — and equal the result', async () => {
      const { ctx, packet, idea } = await herCase();
      for (const p of [...ctx.db._store.keys()]) if (p.startsWith('mandateUniverseSnapshots/') || /\/rows\//.test(p)) ctx.db._store.delete(p);
      const alone = JSON.parse(JSON.stringify(packet));
      delete alone.track;
      const re = recomputeResultFromPacket(alone);
      expect(re.problems).toEqual([]);
      expect(re.observations).toBe(11);
      expect(re.largestDecline).toEqual(jsonPure(idea.result.largestDecline));
      expect(re.investedExposure).toEqual(jsonPure(idea.result.investedExposure));
      expect({ rows: re.rows, rowsNotFullQuality: re.rowsNotFullQuality }).toEqual({ rows: idea.result.dataQuality.rows, rowsNotFullQuality: idea.result.dataQuality.rowsNotFullQuality });
      // Without its observations the packet cannot say what the result rests on: nothing to recompute from.
      expect(recomputeResultFromPacket({ ...alone, observations: [] })).toBeNull();
      // One close fewer — the peak — and the recomputation no longer gives the result.
      const without = { ...alone, observations: alone.observations.filter((o) => o.date !== S[3]) };
      expect(recomputeResultFromPacket(without).largestDecline).not.toEqual(jsonPure(idea.result.largestDecline));
    });

    it('a tampered observation fails verification — the hash, and the recomputation of its own values', async () => {
      const { packet } = await herCase();
      const i = packet.observations.findIndex((o) => o.date === S[3]);
      const tampered = JSON.parse(JSON.stringify(packet));
      tampered.observations[i].ledgers.idea.holdings.AAPL.mark = 113.4567;
      expect(verifyPacket(tampered)).toBe(false);
      expect(recomputeResultFromPacket(tampered).problems).toEqual([`value:${S[3]}:idea`, `holdings:${S[3]}:idea`, 'result:largestDecline']);
      const shifted = JSON.parse(JSON.stringify(packet));
      shifted.observations[i].ledgers.comparison.markedValueUsd += 0.01;
      expect(verifyPacket(shifted)).toBe(false);
      expect(recomputeResultFromPacket(shifted).problems).toEqual([`value:${S[3]}:comparison`]);
    });

    it('review O-1, O-1b — even RE-SEALED, a packet missing a close, out of order, missing a ledger, or stating a result its closes do not give is named', async () => {
      const { packet } = await herCase();
      const reseal = (body) => { const { contentHash, hashAlgorithm, ...rest } = body; return { ...rest, hashAlgorithm, contentHash: canonicalContentHash(jsonPure(rest)) }; };
      const base = JSON.parse(JSON.stringify(packet));
      // The peak close dropped: a gap, and the result no longer follows.
      const dropped = reseal({ ...base, observations: base.observations.filter((o) => o.date !== S[3]) });
      expect(verifyPacket(dropped)).toBe(true);
      expect(recomputeResultFromPacket(dropped).problems).toEqual([`coverage:gap:${S[2]}..${S[4]}`, 'result:largestDecline', 'result:investedExposure', 'result:rows']);
      // The first or the last close dropped.
      expect(recomputeResultFromPacket(reseal({ ...base, observations: base.observations.slice(1) })).problems).toEqual(expect.arrayContaining([`coverage:first:${S[1]}`]));
      expect(recomputeResultFromPacket(reseal({ ...base, observations: base.observations.slice(0, -1) })).problems).toEqual(expect.arrayContaining([`coverage:last:${S[9]}`]));
      // Two closes swapped: out of order.
      const swapped = [...base.observations];
      [swapped[4], swapped[5]] = [swapped[5], swapped[4]];
      expect(recomputeResultFromPacket(reseal({ ...base, observations: swapped })).problems).toEqual(expect.arrayContaining([`order:${S[4]}`]));
      // One ledger missing on one close: a problem, never folded as $0 (it moved the comparison's decline before).
      const noCmp = JSON.parse(JSON.stringify(base));
      delete noCmp.observations[5].ledgers.comparison;
      expect(recomputeResultFromPacket(reseal(noCmp)).problems).toEqual(expect.arrayContaining([`ledger:${S[5]}:comparison`]));
      // A result the closes do not give.
      const lying = reseal({ ...base, result: { ...base.result, investedExposure: { mean: 0.5, closes: 11 } } });
      expect(recomputeResultFromPacket(lying).problems).toEqual(['result:investedExposure']);
    });

    it('review O-3 — a stated value is checked against its prices up to the order they were summed in: an honest valuation in another order agrees; a cent off does not', () => {
      // valueLedger sums in the holdings' own order (here not sorted, as after a ticker change); the recomputation in
      // symbol order differs in the last bit, at a half-cent tie.
      const ledger = { kind: 'idea', cash: 0, holdings: {
        ZZZ: { shares: 26.303096, costBasisTotal: 7000, lastMark: 273.5776 },
        AAA: { shares: 12.694592, costBasisTotal: 3500, lastMark: 290.5824 },
        MMM: { shares: 38.088885, costBasisTotal: 3300, lastMark: 83.9907 },
      } };
      const v = valueLedger(ledger, null, { sessionDate: S[1] });
      const sorted = Object.keys(ledger.holdings).sort().reduce((a, k) => a + ledger.holdings[k].shares * ledger.holdings[k].lastMark, 0);
      expect(roundUsd(sorted)).not.toBe(v.markedHoldingsValue); // the order alone moves the rounding by a cent
      const obsOf = (stated) => ({ date: S[0], observed: true, fullQuality: true, ledgers: {
        idea: { markedValueUsd: stated, cashUsd: 0, markedHoldingsValueUsd: stated, holdings: Object.fromEntries(Object.entries(ledger.holdings).map(([k, h]) => [k, { shares: h.shares, mark: h.lastMark }])) },
        comparison: { markedValueUsd: 100, cashUsd: 100, holdings: {} },
        spy: { markedValueUsd: 100, cashUsd: 100, holdings: {} },
      } });
      const packetOfObs = (stated) => ({ entry: { sessionDate: S[0] }, endpoint: { session: S[0] }, observations: [obsOf(stated)] });
      expect(recomputeResultFromPacket(packetOfObs(v.markedValue)).problems).toEqual(['result:missing']);
      expect(recomputeResultFromPacket(packetOfObs(roundUsd(v.markedValue - 0.01))).problems).toEqual([`value:${S[0]}:idea`, `holdings:${S[0]}:idea`, 'result:missing']);
    });

    it('review O-2 — a close missing between entry and endpoint: the endpoint close refuses `observation_row_missing` and writes nothing', async () => {
      const { db, bookId, bookRef } = await seedBook();
      const r = await admitAndEnter(db, bookId, { contract: contractOf({ comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: Q, date: S[0] });
      for (let i = 0; i < 10; i += 1) await closeOn(db, bookId, S[i], Q);
      db._store.delete(`mandates/${bookId}/ideas/${r.ideaId}/rows/${S[4]}`);
      const before = dumpStore(db);
      await expect(closeOn(db, bookId, S[10], Q)).rejects.toThrow(/observation_row_missing/);
      expect(Object.keys(JSON.parse(dumpStore(db))).filter((p) => !(p in JSON.parse(before)) && !p.startsWith('mandateUniverseDaily/'))).toEqual([`mandateUniverseSnapshots/${S[10]}_close`]); // (and its daily layer: fixtures.js)
      expect(bookRef).toBeTruthy();
    });

    it('a carried mark\'s source is checked against the packet\'s own observation of it: a time that close never had is refused (T2B-01 with T2B-03)', async () => {
      const { db, bookId, bookRef } = await seedBook();
      const r = await admitAndEnter(db, bookId, { contract: contractOf({ comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: Q, date: S[0] });
      for (let i = 0; i < 10; i += 1) await closeOn(db, bookId, S[i], i === 9 ? { AAPL: { price: 101.234, at: null, marketCap: 3e12 }, XLK: 202.345, SPY: 503.456 } : Q);
      await closeOn(db, bookId, S[10], { XLK: 200, SPY: 500 }); // AAPL carried at the endpoint, from 30 Nov's untimed quote
      const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
      const packet = packetOf(ctx, 'result');
      const endpointRow = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/endpoint`);
      expect(resultPacketMissingMarks(packet, endpointRow)).toEqual([]);
      expect(resultPacketProvenanceProblems(packet)).toEqual([]);
      const aapl = packet.endpoint.ledgers.idea.marks.AAPL;
      expect(aapl.carriedFrom).toMatchObject({ session: S[9], quality: 'receipt_time_fallback', vendorTimeIso: null });
      // Claimed as a timed quote of that close (a whole-looking provenance): the packet's own 30 Nov observation says otherwise.
      const claimed = { ...aapl, carriedFrom: { ...aapl.carriedFrom, quality: 'vendor_time', vendorTimeIso: etIso(S[9], 16, 0) } };
      const forged = { ...packet, endpoint: { ...packet.endpoint, ledgers: { ...packet.endpoint.ledgers, idea: { ...packet.endpoint.ledgers.idea, marks: { AAPL: claimed } } } } };
      expect(resultPacketMissingMarks(forged, endpointRow)).toEqual(['idea:AAPL']);
      // …and the same claim on the copied endpoint CLOSE (its observation) is named by the provenance check (review O-2).
      const copied = JSON.parse(JSON.stringify(packet));
      const last = copied.observations[copied.observations.length - 1];
      expect(last.ledgers.idea.holdings.AAPL.markSource).toBe('carry_over');
      last.ledgers.idea.holdings.AAPL.carriedFrom = { ...last.ledgers.idea.holdings.AAPL.carriedFrom, quality: 'vendor_time', vendorTimeIso: etIso(S[9], 16, 0) };
      expect(resultPacketProvenanceProblems(copied)).toEqual([`${S[10]}:idea:AAPL`]);
    });

    it('the largest shape stays well under Firestore\'s 1 MiB document limit: a long slot (60 sessions), four names, an eight-name frozen basket and SPY, every close between entry and endpoint carried', async () => {
      const NAMES = ['AAPL', 'JPM', 'XOM', 'LLY'];
      const BASKET = ['MSFT', 'NVDA', 'BAC', 'CVX', 'HON', 'UNH', 'PG', 'KO'];
      const px = { AAPL: 231.47, JPM: 241.37, XOM: 118.53, LLY: 803.17, MSFT: 418.13, NVDA: 141.29, BAC: 46.27, CVX: 157.19, HON: 226.43, UNH: 512.31, PG: 168.77, KO: 62.41, SPY: 597.31 };
      const all = (k) => Object.fromEntries(Object.entries(px).map(([s, p]) => [s, s === 'SPY' ? roundUsd(p * (1 + k / 1000)) : { price: roundUsd(p * (1 + k / 1000)), marketCap: 5e11 }]));
      const { db, bookId, bookRef } = await seedBook();
      const r = await admitAndEnter(db, bookId, {
        contract: contractOf({ slot: 'long', names: NAMES, comparison: { type: 'frozen_basket', symbols: BASKET }, capitalUsd: 40000 }), quotes: all(0), date: S[0],
      });
      expect(r.entry.outcome).toBe('entered');
      const idea0 = getIdea(db, bookId, r.ideaId);
      expect(idea0.contract.schedule.sessions).toBe(60);
      const sessions = [S[0]];
      while (sessions[sessions.length - 1] < idea0.contract.schedule.dueSession) sessions.push(nextSessionDate(sessions[sessions.length - 1]));
      expect(sessions).toHaveLength(61);
      // Every close between entry and endpoint has no quote at all: every mark carried, each naming its source — the
      // most a close can carry, so the largest packet this shape can make.
      for (let i = 0; i < sessions.length; i += 1) await closeOn(db, bookId, sessions[i], i > 0 && i < sessions.length - 1 ? {} : all(i % 7));
      const packet = db._get(`mandates/${bookId}/ideas/${r.ideaId}/evidence/result`);
      expect(packet.observations).toHaveLength(61);
      expect(verifyPacket(packet)).toBe(true);
      expect(recomputeResultFromPacket(packet).problems).toEqual([]);
      expect(resultPacketProvenanceProblems(packet)).toEqual([]);
      const size = firestoreDocumentBytes(`projects/p/databases/(default)/documents/mandates/${bookId}/ideas/${r.ideaId}/evidence/result`, packet);
      // Measured by Firestore's own storage-size rules; asserted under a quarter of the 1 MiB limit (one document built).
      const jsonBytes = Buffer.byteLength(JSON.stringify(packet), 'utf8');
      console.log(`PF_RESULT_PACKET_SIZE firestore=${size} json=${jsonBytes} observations=${packet.observations.length}`);
      expect(size).toBeLessThan(256 * 1024);

      // ── T1a-2b-2 §4.4 — THE RECEIPT BOUND, derived here from the code and the calendar ──────────────────────────
      // H: four names, an eight-name frozen basket, SPY.
      expect(PRACTICE_FIELD_SLOTS.B3_NAMES_PER_IDEA.max + FROZEN_BASKET_SIZE.max + 1).toBe(RESULT_RECEIPT_BOUND.holdings);
      // T: every kind the corporate-action feed's two parsers can produce (a forward and a reverse split, a dividend).
      const kinds = new Set([
        ...parseSplitsPayload('aapl', [{ date: '2026-11-20', split: '2/1' }, { date: '2026-11-20', split: '1/2' }, { date: '2026-11-20', split: '3.000000/2.000000' }]).actions,
        ...parseDividendsPayload('aapl', [{ date: '2026-11-20', value: 0.26 }, { date: '2026-11-20', unadjustedValue: 0.25 }]).actions,
      ].map((a) => a.type));
      expect([...kinds].sort()).toEqual(['cash_dividend', 'reverse_split', 'split']);
      expect(kinds.size).toBe(RESULT_RECEIPT_BOUND.kindsPerDate);
      // D: the most calendar dates after a long slot's entry session and on or before its due session, over every start
      // session of the maintained calendar.
      let maxDates = 0;
      for (let s = '2026-01-02'; s; s = nextSessionDate(s)) {
        const due = sessionAfter(s, slotSessions('long'));
        if (!due) break;
        maxDates = Math.max(maxDates, (Date.parse(`${due}T12:00:00Z`) - Date.parse(`${s}T12:00:00Z`)) / 86_400_000);
      }
      expect(maxDates).toBe(RESULT_RECEIPT_BOUND.calendarDates);
      expect(RESULT_RECEIPT_BOUND.receipts).toBe(3549);

      // This shape's ideas carried to the bound: every holding of every ledger a receipt of each kind on every date —
      // each receipt with every field the applier can write (ledger.js: an applied action's receipt, `held` from a
      // record it waited on, `explainedSuspicion` from a suspicion it settled) at long but real values.
      const ideaAtEnd = getIdea(db, bookId, r.ideaId);
      const dates = [];
      for (let d = new Date(`${S[0]}T12:00:00Z`).getTime() + 86_400_000; dates.length < RESULT_RECEIPT_BOUND.calendarDates; d += 86_400_000) dates.push(new Date(d).toISOString().slice(0, 10));
      const receiptsFor = (ledger) => Object.keys(ledger.holdings).length > 0 ? Object.keys(ledger.holdings) : [];
      const symbolsOf = { ledger: [...NAMES], comparisonLedger: [...BASKET], spyLedger: ['SPY'] };
      const big = (sym, type, date) => ({
        actionId: `${type}_${sym}_${date}`, type, ticker: sym, effectiveDate: date,
        ratio: type === 'cash_dividend' ? null : 1.6, amount: type === 'cash_dividend' ? 1.234567 : null, incomeUsd: type === 'cash_dividend' ? 12345.67 : 0,
        applied: true, appliedOn: date, source: type === 'cash_dividend' ? 'eodhd_dividends' : 'eodhd_splits',
        note: type === 'cash_dividend' ? 'cash_dividend $1.234567/sh × 123456.789012 sh = $152415.79 (income, not trading P&L)' : `${type} ×1.6: shares 123456.789012→197530.862419, basis unchanged`,
        held: true, heldOn: date, explainedSuspicion: { suspectedOn: date, ratio: 1.6, frozenMark: 1234.567891 },
      });
      const atBound = { ...ideaAtEnd };
      let made = 0;
      for (const field of ['ledger', 'comparisonLedger', 'spyLedger']) {
        const list = [];
        for (const sym of symbolsOf[field]) for (const date of dates) for (const type of ['cash_dividend', 'reverse_split', 'split']) list.push(big(sym, type, date));
        made += list.length;
        atBound[field] = { ...ideaAtEnd[field], corporateActionReceipts: list };
      }
      expect(receiptsFor(ideaAtEnd.spyLedger)).toEqual(['SPY']);
      expect(made).toBe(RESULT_RECEIPT_BOUND.receipts);
      const rowsRef = (id) => db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/${id}`);
      const { packet: boundPacket, parts } = buildResultEvidence({
        bookId, idea: atBound, endpointRow: rowsRef('endpoint'), inception: rowsRef('inception'), closeRows: sessions.map(rowsRef), nowIso: packet.writtenAt,
      });
      const docBytes = (id, doc) => firestoreDocumentBytes(`projects/p/databases/(default)/documents/mandates/${bookId}/ideas/${r.ideaId}/evidence/${id}`, doc);
      const receiptBytes = parts.reduce((n, p) => n + firestoreValueBytes(p.doc.receipts), 0);
      const partBytes = parts.map((p) => docBytes(p.id, p.doc));
      const boundBytes = docBytes('result', boundPacket);
      console.log(`PF_RESULT_RECEIPT_BOUND receipts=${made} receiptBytes=${receiptBytes} parts=${parts.length} partBytes=${partBytes.join(',')} packet=${boundBytes}`);
      // At the bound the receipts alone pass 900 KiB — so one document could not hold them beside the closes …
      expect(receiptBytes + size).toBeGreaterThan(900 * 1024);
      // … and so they are in numbered parts, each well under it, and the packet stays the size it was without them.
      expect(parts.map((p) => p.id)).toEqual(parts.map((_p, i) => `${RESULT_RECEIPT_PART_PREFIX}${String(i + 1).padStart(3, '0')}`));
      for (const b of partBytes) expect(b).toBeLessThan(RESULT_RECEIPT_PART_MAX_BYTES + 1024);
      for (const b of partBytes) expect(b).toBeLessThan(900 * 1024);
      expect(boundBytes).toBeLessThan(256 * 1024);
      expect(boundPacket.corporateActions).toMatchObject({ receipts: 3549, byLedger: { idea: 4 * 91 * 3, comparison: 8 * 91 * 3, spy: 91 * 3 } });
      const partDocs = Object.fromEntries(parts.map((p) => [p.id, jsonPure(p.doc)]));
      expect(resultPacketPartProblems(boundPacket, partDocs)).toEqual([]);
      expect(resultPacketReceipts(boundPacket, partDocs).map((x) => `${x.ledger}:${x.actionId}`)).toEqual(
        ['idea', 'comparison', 'spy'].flatMap((name, i) => atBound[['ledger', 'comparisonLedger', 'spyLedger'][i]].corporateActionReceipts.map((x) => `${name}:${x.actionId}`)),
      );
      // A part changed, missing, or out of order is named; the packet's own hash covers every part's.
      const [first] = parts;
      expect(resultPacketPartProblems(boundPacket, { ...partDocs, [first.id]: { ...partDocs[first.id], receipts: partDocs[first.id].receipts.slice(1) } })).toEqual([`part:${first.id}:hash`, `part:${first.id}:count`, 'parts:count']);
      expect(resultPacketPartProblems(boundPacket, { ...partDocs, [first.id]: undefined })).toEqual([`part:${first.id}:missing`, 'parts:count']);
      expect(verifyPacket({ ...boundPacket, corporateActions: { ...boundPacket.corporateActions, parts: boundPacket.corporateActions.parts.slice(1) } })).toBe(false);

      // Review C1 and its refuter: the BINDING document is now the IDEA, which keeps every receipt on its ledgers and is
      // rewritten by every close. Measured at this shape: past 1 MiB at the bound, and the count it holds — the limit a
      // real feed (tens of receipts) never nears. Taking the receipts off it is T1a-2b-3's (ledger.js).
      const ideaPath = `projects/p/databases/(default)/documents/mandates/${bookId}/ideas/${r.ideaId}`;
      const ideaDocBytes = firestoreDocumentBytes(ideaPath, jsonPure(atBound));
      const baseIdeaBytes = firestoreDocumentBytes(ideaPath, jsonPure(ideaAtEnd));
      const perReceipt = (ideaDocBytes - baseIdeaBytes) / made;
      const fits = Math.floor((1024 * 1024 - baseIdeaBytes) / perReceipt);
      console.log(`PF_IDEA_DOC_AT_BOUND bytes=${ideaDocBytes} withoutReceipts=${baseIdeaBytes} perReceipt=${perReceipt.toFixed(1)} fits=${fits}`);
      expect(ideaDocBytes).toBeGreaterThan(1024 * 1024);
      expect(fits).toBeGreaterThan(2000);
      expect(fits).toBeLessThan(RESULT_RECEIPT_BOUND.receipts);
      // Every holding paying monthly over the long slot is about 52 receipts: far inside.
      expect(baseIdeaBytes + 52 * perReceipt).toBeLessThan(64 * 1024);
    }, 60_000);
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
    expect(Object.keys(JSON.parse(dumpStore(second.db))).filter((p) => !(p in withSnapshot) && !p.startsWith('mandateUniverseDaily/'))).toEqual([`mandateUniverseSnapshots/${DUE}_close`]); // only the snapshot the test stored (and its daily layer: fixtures.js)
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
    expect(Object.keys(JSON.parse(dumpStore(db))).filter((p) => !(p in JSON.parse(before)) && !p.startsWith('mandateUniverseDaily/'))).toEqual([`mandateUniverseSnapshots/${DUE}_close`]); // (and its daily layer: fixtures.js)
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
