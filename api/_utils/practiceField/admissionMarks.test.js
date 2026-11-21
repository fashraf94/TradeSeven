// api/_utils/practiceField/admissionMarks.test.js
//
// Practice Field T1a-2b-2 §1 — ADMISSION AT CURRENT MARKS, AND ONLY AFTER THE BOOK HAS CLOSED (Astra T1A-05; T1a-2a
// C-2). One set of marks for the whole decision — the newest snapshot of the session in progress, else the last
// completed session's close — every held name with a full-quality mark in it or the admission is refused by symbol; and
// no admission while a completed session is unclosed. T2C-01 (Astra, 17 Nov 2026): and every held name covered by that
// session's daily layer, its corporate-action fetch succeeded.

import { vendorAnswering } from './__testsupport__/fixtures.js';
import { makeParseReportingFetcher } from './caParseReport.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { admitIdea, evaluateAdmission } from './admission.js';
import { normalizeIdeaContract } from './contract.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { verifyPacket } from './evidence.js';
import {
  closeOwedSession, admissionMarkSetCandidates, lastCompletedSessionAt, sessionInProgressAt, ADMISSION_MARK_BASIS,
} from './admissionMarks.js';
import { ensureDailySnapshot, ensureUniverseSnapshot } from '../mandateUniverseSnapshot.js';
import {
  seedBook, admitAndEnter, closeOn, contractOf, getBook, getIdea, etIso, DAYS, storeTickSnapshot, snapshotOf, tickSnapshot,
  closeSnapshot, moneyStoreBytes, windowAt, placeSnapshot, slotOpenIso, storeDailyLayer, ADMIT_ISO,
} from './__testsupport__/fixtures.js';

const AAPL = 231.47;
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12 };
const q = (prices) => Object.fromEntries(Object.entries(prices).map(([s, p]) => [s, CAPS[s] && typeof p === 'number' ? { price: p, marketCap: CAPS[s] } : p]));
const codes = (res) => res.refusals.map((r) => r.code).sort();
const packetOf = (db, bookId, ideaId) => db._get(`mandates/${bookId}/ideas/${ideaId}/evidence/admission`);

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

/**
 * Astra's T1A-05 book: $100,000, a long one-name AAPL idea of $30,000 entered on D1 at $231.47 and closed there — the
 * book RECORDS $99,991.00 (the entry's $9 of friction). D2's 10:00 window snapshot prices AAPL at `d2Price`; D2's daily
 * layer covers AAPL, its corporate-action fetch succeeded with nothing listed (Astra T2C-01).
 */
async function t1a05Book(d2Price) {
  const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'momentum_chaser' });
  const held = await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'long', names: ['AAPL'], capitalUsd: 30000 }), opId: 'held', quotes: q({ AAPL, SPY: 597.31 }) });
  expect(held.entry.outcome).toBe('entered');
  await closeOn(db, bookId, DAYS.d1, q({ AAPL, SPY: 597.31 }));
  expect(getBook(db, bookId).portfolio.totalValue).toBe(99991);
  storeDailyLayer(db, DAYS.d2, ['AAPL']);
  await storeTickSnapshot(db, DAYS.d2, 'open30', q({ AAPL: d2Price, MSFT: 418.13, NVDA: 141.29, SPY: 597.31 }));
  return { db, bookId, bookRef, heldId: held.ideaId };
}
const AT_11 = etIso(DAYS.d2, 11, 0);

describe('Astra T1A-05 — every limit, at the newest snapshot of the session', () => {
  it('a 20% DECLINE: the short cap is $18,798.56 of the current $93,992.80 — not $19,998.20 of the recorded $99,991.00; $19,000 is refused, the cap itself admitted', async () => {
    const { db, bookId } = await t1a05Book(185.176); // 231.47 × 0.8
    const before = moneyStoreBytes(db);
    const over = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 19000 }), opId: 'over', nowIso: AT_11 });
    expect(over.ok).toBe(false);
    expect(over.refusals).toEqual([{ code: 'capital_exceeds_slot_cap', constraint: 'slot_cap', slot: 'short', limitUsd: 18798.56, requestedUsd: 19000 }]);
    expect(over.permittedMaxUsd).toBe(18798.56);
    expect(over.binding).toEqual([{ constraint: 'slot_cap', slot: 'short', limitUsd: 18798.56 }]);
    expect(moneyStoreBytes(db)).toBe(before); // a refusal writes nothing
    expect((await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 18798.57 }), opId: 'cent-over', nowIso: AT_11 })).ok).toBe(false);
    const at = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 18798.56 }), opId: 'at-cap', nowIso: AT_11 });
    expect(at).toMatchObject({ ok: true, permittedMaxUsd: 18798.56 });
    // The packet records the set: its key, the mark with its source and age, and the equity derived from it — beside the
    // recorded equity, which admission does not move.
    const packet = packetOf(db, bookId, at.ideaId);
    expect(verifyPacket(packet)).toBe(true);
    expect(packet.measuredAgainst).toMatchObject({ equityUsd: 93992.8, recordedEquityUsd: 99991 });
    expect(packet.measuredAgainst.admissionMarks).toEqual({
      basis: 'session_snapshot', session: DAYS.d2, snapshotKey: `${DAYS.d2}_open30`, snapshotBuiltAt: new Date(Date.parse(slotOpenIso(DAYS.d2)) + 60_000).toISOString(),
      considered: [`${DAYS.d2}_open30`], passedOver: [], at: AT_11,
      // Astra T2C-01: the daily layer read, and the held name covered there with its fetch succeeded.
      caCoverage: { dailyKey: DAYS.d2, dailyPresent: true, symbols: { AAPL: { covered: true, fetchSucceeded: true } } },
      marks: { AAPL: { price: 185.176, quality: 'vendor_time', vendorTimeIso: etIso(DAYS.d2, 9, 45), ageAtAdmissionMs: 75 * 60_000, snapshotKey: `${DAYS.d2}_open30` } },
      treasuryUsd: 70000, ideasCashUsd: 0, holdingsUsd: 23992.8, equityUsd: 93992.8,
    });
    expect(packet.limits.all.find((l) => l.constraint === 'slot_cap').limitUsd).toBe(18798.56);
    expect(getBook(db, bookId).portfolio.totalValue).toBe(99991);
  });

  it('a 20% RISE: the cash floor ($59,401.08) and the Technology headroom ($17,005.40) are measured at the current $105,989.20 — a $19,000 Technology idea the recorded figures would have admitted is refused', async () => {
    const { db, bookId } = await t1a05Book(277.764); // 231.47 × 1.2
    const over = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 19000 }), opId: 'over', nowIso: AT_11 });
    // Recorded: Technology 29,991.00 against half of 99,991.00 — $20,004.50 of room. Current: 35,989.20 against half of
    // 105,989.20 — $17,005.40.
    expect(over.refusals).toEqual([{
      code: 'sector_cap_exceeded', constraint: 'sector_cap', sector: 'Technology', capCents: 5299460, existingCents: 3598920, limitUsd: 17005.4, requestedUsd: 19000,
    }]);
    expect(over.permittedMaxUsd).toBe(17005.4);
    const at = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 17005.4 }), opId: 'at-cap', nowIso: AT_11 });
    expect(at.ok).toBe(true);
    const all = packetOf(db, bookId, at.ideaId).limits.all;
    // The 10% floor of $105,989.20 is $10,598.92: the treasury's $70,000 keeps it with $59,401.08 to spare (recorded:
    // $60,000.90). The short cap rises with the equity: 20% is $21,197.84.
    expect(all.find((l) => l.constraint === 'cash_floor').limitUsd).toBe(59401.08);
    expect(all.find((l) => l.constraint === 'slot_cap').limitUsd).toBe(21197.84);
    expect(all.find((l) => l.constraint === 'sector_cap')).toMatchObject({ capCents: 5299460, existingCents: 3598920, limitUsd: 17005.4 });
    expect(packetOf(db, bookId, at.ideaId).measuredAgainst.admissionMarks).toMatchObject({ equityUsd: 105989.2, holdingsUsd: 35989.2, marks: { AAPL: { price: 277.764 } } });
  });

  it('no move: a book whose newest snapshot prices it at its recorded marks is measured at exactly its recorded equity', async () => {
    const { db, bookId } = await t1a05Book(AAPL);
    const res = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 19998.2 }), opId: 'x', nowIso: AT_11 });
    expect(res).toMatchObject({ ok: true, permittedMaxUsd: 19998.2 });
    expect(packetOf(db, bookId, res.ideaId).measuredAgainst).toMatchObject({ equityUsd: 99991, recordedEquityUsd: 99991 });
  });

  it('the NEWEST snapshot of the session is the set: at 13:00, 12:45\'s — never an older one that still has the name; one built after the decision\'s instant is not one it was made against', async () => {
    const { db, bookId } = await t1a05Book(185.176);
    // 12:45's window: AAPL at a third price.
    await storeTickSnapshot(db, DAYS.d2, 'midday', q({ AAPL: 250.01, MSFT: 418.13, SPY: 597.31 }));
    const one = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'one', nowIso: etIso(DAYS.d2, 13, 0) });
    expect(packetOf(db, bookId, one.ideaId).measuredAgainst.admissionMarks).toMatchObject({ snapshotKey: `${DAYS.d2}_midday`, considered: [`${DAYS.d2}_midday`, `${DAYS.d2}_open30`], marks: { AAPL: { price: 250.01 } } });
    // A newest snapshot WITHOUT the held name: refused, by name — the older one that has it is not used.
    const b = await t1a05Book(185.176);
    await storeTickSnapshot(b.db, DAYS.d2, 'midday', q({ MSFT: 418.13, SPY: 597.31 }));
    const missing = await admitIdea(b.db, { bookId: b.bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'm', nowIso: etIso(DAYS.d2, 13, 0) });
    expect(missing.refusals).toEqual([{
      code: 'admission_marks_unavailable', symbols: ['AAPL'], unavailable: [{ symbol: 'AAPL', ideaId: b.heldId, reason: 'no_quote' }],
      basis: 'session_snapshot', session: DAYS.d2, snapshotKey: `${DAYS.d2}_midday`,
    }]);
    // A midday snapshot built at 12:47 is not there for a decision at 12:46: the set is 10:00's.
    const c = await t1a05Book(185.176);
    placeSnapshot(c.db, snapshotOf({ tickKey: `${DAYS.d2}_midday`, sessionDate: DAYS.d2, builtAt: etIso(DAYS.d2, 12, 47), quoteAt: etIso(DAYS.d2, 12, 40), quotes: q({ AAPL: 250.01, MSFT: 418.13, SPY: 597.31 }) }));
    const early = await admitIdea(c.db, { bookId: c.bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'e', nowIso: etIso(DAYS.d2, 12, 46) });
    expect(packetOf(c.db, c.bookId, early.ideaId).measuredAgainst.admissionMarks).toMatchObject({
      snapshotKey: `${DAYS.d2}_open30`, marks: { AAPL: { price: 185.176 } },
      // review A7: the newer document passed over is named, with why — a race, not a bad document.
      passedOver: [{ key: `${DAYS.d2}_midday`, reason: 'snapshot_after_decision' }],
    });
    // …and a newer document that is not its key's own is named as such.
    const d = await t1a05Book(185.176);
    placeSnapshot(d.db, { ...tickSnapshot(DAYS.d2, 'midday', q({ AAPL: 250.01, MSFT: 418.13, SPY: 597.31 })), sessionDate: DAYS.d1 });
    const bad = await admitIdea(d.db, { bookId: d.bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'b', nowIso: etIso(DAYS.d2, 13, 0) });
    expect(packetOf(d.db, d.bookId, bad.ideaId).measuredAgainst.admissionMarks).toMatchObject({
      snapshotKey: `${DAYS.d2}_open30`, passedOver: [{ key: `${DAYS.d2}_midday`, reason: 'snapshot_invalid' }],
    });
  });
});

describe('fail closed — a held name with no full-quality mark in the set is refused by symbol; nothing falls back', () => {
  const tryAdmit = async (setup) => {
    const { db, bookId, heldId } = await t1a05Book(185.176);
    const nowIso = await setup(db);
    const before = moneyStoreBytes(db);
    const res = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'x', nowIso });
    expect(moneyStoreBytes(db)).toBe(before);
    expect(res.ok).toBe(false);
    // Nothing is measured: no limit, no permitted maximum — never one taken from `lastMark` or `totalValue`.
    expect(codes(res)).toEqual(['admission_marks_unavailable']);
    expect(res.permittedMaxUsd).toBeNull();
    expect(res.binding).toEqual([]);
    return { res, heldId, u: res.refusals[0] };
  };

  it('a quote the vendor gave no time for; an incomplete quote; a print from before the open; a quote older than 30 minutes at its snapshot\'s build', async () => {
    const at = (quotes, quoteAt = etIso(DAYS.d2, 12, 40)) => async (db) => {
      placeSnapshot(db, snapshotOf({ tickKey: `${DAYS.d2}_midday`, sessionDate: DAYS.d2, builtAt: etIso(DAYS.d2, 12, 46), quoteAt, quotes: q({ MSFT: 418.13, SPY: 597.31, ...quotes }) }));
      return etIso(DAYS.d2, 13, 0);
    };
    expect((await tryAdmit(at({ AAPL: { price: 250.01, marketCap: 3.4e12, at: null } }))).u.unavailable[0].reason).toBe('receipt_time_fallback');
    expect((await tryAdmit(at({ AAPL: { price: null } }))).u.unavailable[0].reason).toBe('no_quote');
    expect((await tryAdmit(at({ AAPL: { price: 250.01, marketCap: 3.4e12, at: etIso(DAYS.d2, 9, 0) } }))).u.unavailable[0].reason).toBe('pre_open_print');
    // 12:15:59 at a 12:46 build is 30 min 1 s old: stale; 12:16 is exactly 30 minutes: fresh.
    expect((await tryAdmit(at({ AAPL: { price: 250.01, marketCap: 3.4e12, at: new Date(Date.parse(etIso(DAYS.d2, 12, 16)) - 1000).toISOString() } }))).u.unavailable[0].reason).toBe('stale_quote');
    const fresh = await t1a05Book(185.176);
    await at({ AAPL: { price: 250.01, marketCap: 3.4e12, at: etIso(DAYS.d2, 12, 16) } })(fresh.db);
    expect((await admitIdea(fresh.db, { bookId: fresh.bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'x', nowIso: etIso(DAYS.d2, 13, 0) })).ok).toBe(true);
  });

  it('no snapshot yet in the session (09:45, before its first window): every held name is refused — the previous close is not used', async () => {
    const { u } = await tryAdmit(async () => etIso(DAYS.d2, 9, 45));
    expect(u).toMatchObject({ symbols: ['AAPL'], basis: 'session_snapshot', session: DAYS.d2, snapshotKey: null, unavailable: [{ symbol: 'AAPL', reason: 'no_snapshot_yet' }] });
  });

  it('a split-shaped move no feed row explains (a suspected corporate action) gives the price no share count to be trusted against', async () => {
    const { u } = await tryAdmit(async (db) => {
      placeSnapshot(db, tickSnapshot(DAYS.d2, 'midday', q({ AAPL: 115.735, MSFT: 418.13, SPY: 597.31 }))); // half of 231.47
      return etIso(DAYS.d2, 13, 0);
    });
    expect(u.unavailable).toEqual([{ symbol: 'AAPL', ideaId: expect.any(String), reason: 'suspected_corporate_action' }]);
  });

  it('a split the feed lists for today, not yet applied: the intraday price is on the new basis, the holding on the old — refused until the close applies it', async () => {
    const { u } = await tryAdmit(async (db) => {
      const split = { type: 'split', ticker: 'AAPL', effectiveDate: DAYS.d2, ratio: 2, source: 'eodhd_splits' };
      placeSnapshot(db, tickSnapshot(DAYS.d2, 'midday', q({ AAPL: { price: 115.735, marketCap: 3.4e12, corporateActions: [split] }, MSFT: 418.13, SPY: 597.31 })));
      return etIso(DAYS.d2, 13, 0);
    });
    expect(u.unavailable).toEqual([{ symbol: 'AAPL', ideaId: expect.any(String), reason: 'corporate_action_pending' }]);
  });

  it('review A2 — an unmarked holding hides nothing that needs no mark: a bad epoch number and the position count are still refused beside it, and no dollar limit or maximum is measured', async () => {
    const { db, bookId, bookRef } = await t1a05Book(185.176);
    const epochRef = bookRef.collection('epochs').doc('epoch-0001');
    const epoch = (await epochRef.get()).data();
    await epochRef.set({ ...epoch, gateConfig: { ...epoch.gateConfig, cashFloorPct: null, maxPositions: 1 } });
    const res = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'x', nowIso: etIso(DAYS.d2, 9, 45) });
    expect(codes(res)).toEqual(['admission_marks_unavailable', 'epoch_config_invalid', 'position_count_exceeded']);
    expect(res.refusals.find((r) => r.code === 'epoch_config_invalid')).toEqual({ code: 'epoch_config_invalid', constraints: ['cash_floor'] });
    expect(res.refusals.find((r) => r.code === 'position_count_exceeded')).toMatchObject({ positionsAfter: 2, maxPositions: 1 });
    expect(res.permittedMaxUsd).toBeNull();
    expect(res.binding).toEqual([]);
  });

  it('review A1 — a draft whose shape fails still hears the owed close and the missing marks, which need no contract', async () => {
    const { db, bookId } = await t1a05Book(185.176);
    // D2 at 09:45: no snapshot yet (AAPL unmarked); D1 closed, D2 not ended — and then D3 at 11:00, D2 never closed.
    const broken = contractOf({ slot: 'nope' });
    const morning = await admitIdea(db, { bookId, contract: broken, opId: 'x', nowIso: etIso(DAYS.d2, 9, 45) });
    expect(morning.refusals.map((r) => r.code)).toEqual(['slot_invalid', 'admission_marks_unavailable']);
    const thesis = contractOf({ thesis: { text: 'Breaks \uD83D here', author: 'founder_fixture' } });
    const later = await admitIdea(db, { bookId, contract: thesis, opId: 'y', nowIso: etIso(DAYS.d3, 11, 0) });
    expect(later.refusals.map((r) => r.code)).toEqual(['text_invalid', 'close_owed', 'admission_marks_unavailable']);
    expect(later.refusals[1]).toEqual({ code: 'close_owed', session: DAYS.d2, completedAt: etIso(DAYS.d2, 16, 0) });
    // …and the epoch's stamp (its refuter): an uncorrected epoch is said beside a broken draft too.
    const vb = await seedBook({ uid: 'owner-v' });
    const epochRef = vb.bookRef.collection('epochs').doc('epoch-0001');
    const epoch = (await epochRef.get()).data();
    const { sectorCapConversionVersion: _stamp, ...unstamped } = epoch.gateConfig;
    await epochRef.set({ ...epoch, gateConfig: { ...unstamped, sectorConcentrationCap: 2 } });
    const v = await admitIdea(vb.db, { bookId: vb.bookId, contract: broken, opId: 'v', nowIso: etIso(DAYS.admit, 11, 0) });
    expect(v.refusals.map((r) => r.code)).toEqual(['slot_invalid', 'vintage_uncorrected']);
    // …and the epoch's own numbers, all but the slot's cap (fix-round refuter F2): the same as a whole draft says.
    const eb = await seedBook({ uid: 'owner-e' });
    const eRef = eb.bookRef.collection('epochs').doc('epoch-0001');
    const eDoc = (await eRef.get()).data();
    await eRef.set({ ...eDoc, gateConfig: { ...eDoc.gateConfig, cashFloorPct: null, maxSinglePositionWeightPct: 'x' } });
    const e = await admitIdea(eb.db, { bookId: eb.bookId, contract: broken, opId: 'e', nowIso: etIso(DAYS.admit, 11, 0) });
    expect(e.refusals).toEqual([{ code: 'slot_invalid' }, { code: 'epoch_config_invalid', constraints: ['cash_floor', 'single_position_cap'] }]);
    const whole = await admitIdea(eb.db, { bookId: eb.bookId, contract: contractOf(), opId: 'w', nowIso: etIso(DAYS.admit, 11, 0) });
    expect(whole.refusals.find((r) => r.code === 'epoch_config_invalid')).toEqual({ code: 'epoch_config_invalid', constraints: ['cash_floor', 'single_position_cap'] });
  });

  it('a book that holds NOTHING needs no mark: it is measured at its cash with no snapshot at all', async () => {
    const { db, bookId } = await seedBook();
    const res = await admitIdea(db, { bookId, contract: contractOf({ capitalUsd: 20000 }), opId: 'x', nowIso: etIso(DAYS.admit, 9, 45) });
    expect(res).toMatchObject({ ok: true, permittedMaxUsd: 20000 });
    expect(packetOf(db, bookId, res.ideaId).measuredAgainst.admissionMarks).toMatchObject({ snapshotKey: null, marks: {}, equityUsd: 100000 });
  });
});

describe('C-2 — no admission while the book owes a close', () => {
  it('between a session\'s end and its close being written the admission is refused `close_owed`; after the close it succeeds, measured at that close', async () => {
    const { db, bookId } = await t1a05Book(185.176);
    const contract = contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 });
    // 15:59:59.999 is still D2's session; 16:00 has completed it.
    expect((await admitIdea(db, { bookId, contract, opId: 'before-end', nowIso: new Date(Date.parse(etIso(DAYS.d2, 16, 0)) - 1).toISOString() })).ok).toBe(true);
    const owed = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'owed', nowIso: etIso(DAYS.d2, 16, 0) });
    expect(owed.refusals).toContainEqual({ code: 'close_owed', session: DAYS.d2, completedAt: etIso(DAYS.d2, 16, 0) });
    const at1610 = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'owed-2', nowIso: etIso(DAYS.d2, 16, 10) });
    expect(at1610.refusals.map((r) => r.code)).toContain('close_owed');
    await closeOn(db, bookId, DAYS.d2, q({ AAPL: 190.03, MSFT: 418.13, NVDA: 141.29, SPY: 597.31 }));
    const after = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'after', nowIso: etIso(DAYS.d2, 16, 30) });
    expect(after.ok).toBe(true);
    // Outside a session: the last completed session's close is the set.
    expect(packetOf(db, bookId, after.ideaId).measuredAgainst.admissionMarks).toMatchObject({
      basis: 'last_close', session: DAYS.d2, snapshotKey: `${DAYS.d2}_close`, considered: [`${DAYS.d2}_close`], marks: { AAPL: { price: 190.03 } },
    });
  });

  it('a missed close: an admission on D3 is refused while D2 is unclosed — it would appear on D2\'s caught-up row — and admitted once the window has caught D2 up, never on D2\'s row', async () => {
    const { db, bookId } = await t1a05Book(185.176);
    const contract = contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 });
    const d3quotes = q({ AAPL: 186.01, MSFT: 418.13, SPY: 597.31 });
    storeDailyLayer(db, DAYS.d3, ['AAPL']);
    await storeTickSnapshot(db, DAYS.d3, 'open30', d3quotes);
    const refused = await admitIdea(db, { bookId, contract, opId: 'x', nowIso: etIso(DAYS.d3, 11, 0) });
    expect(refused.refusals).toEqual([{ code: 'close_owed', session: DAYS.d2, completedAt: etIso(DAYS.d2, 16, 0) }]);
    // D3's 10:00 window catches D2 up (no stored close: unobserved), then the admission goes through.
    const errors = console.error; console.error = () => {};
    try { await windowAt(db, bookId, { date: DAYS.d3, quotes: d3quotes }); } finally { console.error = errors; }
    expect(getBook(db, bookId).execState.lastCloseKey).toBe(DAYS.d2);
    const ok = await admitIdea(db, { bookId, contract, opId: 'x', nowIso: etIso(DAYS.d3, 11, 0) });
    expect(ok.ok).toBe(true);
    expect(db._get(`mandates/${bookId}/dailyRows/${DAYS.d2}`).openIdeaIds).not.toContain(ok.ideaId);
  });

  it('the early close: on 27 November 2026 the session completes at 13:00 Eastern', async () => {
    const day = '2026-11-27';
    const { db, bookId } = await seedBook({ nowIso: etIso(day, 9, 0) });
    expect((await admitIdea(db, { bookId, contract: contractOf(), opId: 'a', nowIso: new Date(Date.parse(etIso(day, 13, 0)) - 1).toISOString() })).ok).toBe(true);
    const owed = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'b', nowIso: etIso(day, 13, 0) });
    expect(owed.refusals).toEqual([{ code: 'close_owed', session: day, completedAt: etIso(day, 13, 0) }]);
    expect(closeOwedSession(getBook(db, bookId), etIso(day, 12, 59))).toBeNull();
    expect(sessionInProgressAt(Date.parse(etIso(day, 12, 59)))).toBe(day);
    expect(sessionInProgressAt(Date.parse(etIso(day, 13, 0)))).toBeNull();
    expect(lastCompletedSessionAt(Date.parse(etIso(day, 13, 0)))).toBe(day);
    expect(lastCompletedSessionAt(Date.parse(etIso(day, 12, 59)))).toBe('2026-11-25'); // Thanksgiving is no session
  });

  it('a book created after a session\'s close pass is not owed it; one whose cursor cannot be read is owed (fail closed)', () => {
    const at = (iso) => ({ createdAt: new Date(iso), execState: {} });
    expect(closeOwedSession(at(etIso(DAYS.d1, 18, 30)), etIso(DAYS.d2, 9, 0))).toBeNull(); // starts D2
    expect(closeOwedSession(at(etIso(DAYS.d1, 17, 0)), etIso(DAYS.d1, 17, 30))).toEqual({ session: DAYS.d1, completedAtIso: etIso(DAYS.d1, 16, 0) });
    expect(closeOwedSession({ execState: {} }, etIso(DAYS.d1, 11, 0))).toEqual({ session: null, completedAtIso: null });
    // review A6: a cursor that is not a date is one that cannot be read — owed, typed, never a throw.
    expect(closeOwedSession({ createdAt: new Date(etIso(DAYS.d1, 9, 0)), execState: { lastCloseKey: 'not-a-date' } }, etIso(DAYS.d1, 11, 0))).toEqual({ session: null, completedAtIso: null });
    expect(closeOwedSession({ createdAt: new Date(etIso(DAYS.d1, 9, 0)), execState: { windowsAccountedThrough: '2026-13-45x' } }, etIso(DAYS.d1, 11, 0))).toEqual({ session: null, completedAtIso: null });
    // …and a date-shaped string naming no real day, or a cursor that is not a string at all (fix-round refuter F1, N4).
    const created = new Date(etIso(DAYS.d1, 9, 0));
    for (const bad of ['2026-11-99', '2026-13-45', '2026-02-30', 20261113, { d: 1 }, true]) {
      expect(closeOwedSession({ createdAt: created, execState: { lastCloseKey: bad } }, etIso(DAYS.d1, 11, 0)), String(bad)).toEqual({ session: null, completedAtIso: null });
      expect(closeOwedSession({ createdAt: created, execState: { lastCloseKey: DAYS.admit, windowsAccountedThrough: bad } }, etIso(DAYS.d3, 11, 0)), String(bad)).toEqual({ session: null, completedAtIso: null });
    }
    // The control: a real cursor names the real session.
    expect(closeOwedSession({ createdAt: created, execState: { lastCloseKey: DAYS.d1, windowsAccountedThrough: DAYS.d1 } }, etIso(DAYS.d3, 11, 0))).toEqual({ session: DAYS.d2, completedAtIso: etIso(DAYS.d2, 16, 0) });
    // A closed book owes nothing — it is refused as not active (fix-round refuter N2).
    expect(closeOwedSession({ createdAt: created, status: 'closed', execState: { lastCloseKey: DAYS.d1, windowsAccountedThrough: DAYS.d1 } }, etIso(DAYS.d3, 11, 0))).toBeNull();
  });
});

describe('outside a session — the last completed session\'s close', () => {
  it('on a Saturday and before Monday\'s open the set is Friday\'s close; a stored close that is gone leaves the held names without a mark', async () => {
    const fri = '2026-11-20';
    const { db, bookId } = await t1a05Book(185.176);
    for (const d of [DAYS.d2, DAYS.d3, DAYS.d4]) await closeOn(db, bookId, d, q({ AAPL: 200.02, SPY: 597.31 }));
    await closeOn(db, bookId, fri, q({ AAPL: 210.37, SPY: 597.31 }));
    storeDailyLayer(db, fri, ['AAPL']);
    expect(admissionMarkSetCandidates(etIso('2026-11-21', 12, 0))).toEqual({ basis: ADMISSION_MARK_BASIS.LAST_CLOSE, session: fri, keys: [`${fri}_close`] });
    expect(admissionMarkSetCandidates(etIso('2026-11-23', 9, 0))).toEqual({ basis: ADMISSION_MARK_BASIS.LAST_CLOSE, session: fri, keys: [`${fri}_close`] });
    const sat = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'sat', nowIso: etIso('2026-11-21', 12, 0) });
    expect(packetOf(db, bookId, sat.ideaId).measuredAgainst.admissionMarks).toMatchObject({ basis: 'last_close', session: fri, snapshotKey: `${fri}_close`, marks: { AAPL: { price: 210.37, vendorTimeIso: etIso(fri, 16, 0) } } });
    // A book caught up and not owed a close always has its last completed session's close stored (a session closes
    // only from its stored snapshot, or is caught up at the next session's window — inside a session). Should that
    // document be gone (an operator, a retention run), the held names are refused by name — never valued at the
    // recorded mark.
    const u = await t1a05Book(185.176);
    for (const d of [DAYS.d2, DAYS.d3, DAYS.d4, fri]) await closeOn(u.db, u.bookId, d, q({ AAPL: 200.02, SPY: 597.31 }));
    u.db._store.delete(`mandateUniverseSnapshots/${fri}_close`);
    const res = await admitIdea(u.db, { bookId: u.bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'x', nowIso: etIso('2026-11-21', 12, 0) });
    expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', symbols: ['AAPL'], basis: 'last_close', snapshotKey: null, unavailable: [{ symbol: 'AAPL', ideaId: u.heldId, reason: 'no_snapshot' }] })]);
  });
});

describe('integer cents throughout', () => {
  it('a price that leaves fractions of a cent: the equity, every limit and the permitted maximum are whole cents, and the boundary is decided by arithmetic', async () => {
    const { db, bookId } = await t1a05Book(187.3333);
    const { contract } = normalizeIdeaContract(contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }));
    const book = getBook(db, bookId);
    const ideas = book.openIdeaIds.map((id) => getIdea(db, bookId, id));
    const markSet = {
      basis: 'session_snapshot', session: DAYS.d2, snapshotKey: `${DAYS.d2}_open30`, snapshot: db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`), builtAtIso: null, considered: [],
      daily: { key: DAYS.d2, present: true, symbols: db._get(`mandateUniverseDaily/${DAYS.d2}`).symbols, doc: db._get(`mandateUniverseDaily/${DAYS.d2}`), parseReport: db._get(`practiceFieldCaParseReports/${DAYS.d2}`) ?? null },
    };
    const epoch = db._get(`mandates/${bookId}/epochs/epoch-0001`);
    const v = evaluateAdmission({ book, epoch, ideas, coverageData: null, contract, ideaRefKey: `${bookId}/x`, nowIso: AT_11, admitsOwner: true, markSet });
    const shares = ideas[0].ledger.holdings.AAPL.shares;
    const holdingsCents = Math.round(shares * 187.3333 * 100); // one rounding of shares × price
    expect(v.measured).toMatchObject({ treasuryCents: 7000000, ideasCashCents: 0, holdingsCents, equityCents: 7000000 + holdingsCents });
    for (const k of ['treasuryCents', 'ideasCashCents', 'holdingsCents', 'equityCents']) expect(Number.isInteger(v.measured[k]), k).toBe(true);
    for (const l of v.limits) expect(Number.isInteger(Math.round(l.limitUsd * 100)) && Math.abs(l.limitUsd * 100 - Math.round(l.limitUsd * 100)) < 1e-6, l.constraint).toBe(true);
    const slotCap = v.limits.find((l) => l.constraint === 'slot_cap').limitUsd;
    expect(Math.round(slotCap * 100)).toBe(Math.floor((7000000 + holdingsCents) / 5));
    expect(v.permittedMaxUsd).toBe(slotCap);
    // The boundary: the cap admitted, one cent more refused.
    expect((await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: Math.round((slotCap + 0.01) * 100) / 100 }), opId: 'over', nowIso: AT_11 })).ok).toBe(false);
    expect((await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: slotCap }), opId: 'at', nowIso: AT_11 })).ok).toBe(true);
  });

  it('the close snapshot set reads its marks from THE stored document only: a key or session that is not its own is not a set', async () => {
    const { db, bookId } = await t1a05Book(185.176);
    placeSnapshot(db, { ...closeSnapshot(DAYS.d1, q({ AAPL, SPY: 597.31 })), tickKey: `${DAYS.d2}_open30` }); // D1's document stored under D2's 10:00 key
    const res = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['MSFT'], capitalUsd: 1000 }), opId: 'x', nowIso: AT_11 });
    expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', snapshotKey: null, unavailable: [expect.objectContaining({ reason: 'snapshot_invalid' })] })]);
  });
});

describe('Astra T2C-01 — a held name is valued only when the day\'s corporate-action fetch for it SUCCEEDED (the daily layer, read in admission\'s transaction)', () => {
  const T2C_Q = { AAPL: { price: 231.47, marketCap: 3.4e12 }, SPY: 597.31 };
  // A 4-for-5 reverse split (the feed parser's `reverse_split`, ratio 0.8) on D2: AAPL prints at 231.47 / 0.8 — a 25% rise,
  // under the gap screen's 40%, so no suspected-split hold catches it.
  const D2_AAPL = 289.3375;
  const REVERSE = { type: 'reverse_split', ticker: 'AAPL', effectiveDate: DAYS.d2, ratio: 0.8, source: 'eodhd_splits' };
  const FETCH_OK = { actions: [], calls: 0, failed: false };
  const shortJpm = (capitalUsd = 21000) => contractOf({ slot: 'short', names: ['JPM'], capitalUsd });

  /**
   * Astra's book: $30,000 of AAPL entered on D1 at $231.47 and closed there (equity $99,991.00, 129.567558 shares). D2's
   * daily layer is built by the engine's OWN daily builder, AAPL's corporate actions answered by `aaplCa` (AAPL left out
   * of its build set with `aaplInDaily: false`; no daily build at all with `daily: false`), and D2's 10:00 snapshot by its
   * OWN fast builder, from that daily document: AAPL at $289.3375, vendor-timed 09:45. No upstream call is made.
   */
  async function t2c01Book({ aaplCa = FETCH_OK, aaplInDaily = true, daily = true } = {}) {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'momentum_chaser' });
    const held = await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'long', names: ['AAPL'], capitalUsd: 30000 }), opId: 'held', quotes: T2C_Q });
    expect(held.entry.outcome).toBe('entered');
    await closeOn(db, bookId, DAYS.d1, T2C_Q);
    expect(getBook(db, bookId).portfolio.totalValue).toBe(99991);
    const quiet = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {})];
    try {
      if (daily) {
        await ensureDailySnapshot(db, {
          date: DAYS.d2, heldTickers: aaplInDaily ? ['AAPL', 'SPY'] : ['SPY'], candidateUniverse: [], now: new Date(etIso(DAYS.d2, 9, 0)),
          getFundamentals: async () => ({ fundamentals: { sector: 'Technology', industry: 'Consumer Electronics', marketCap: 3.4e12 }, cacheStatus: { fundamentals: 'cache' } }),
          // (T1a-2b-4: as the cron hands it for an idea book's coverage — the parse-reporting wrapper, which writes the
          // session's parse report; the stub answers through the vendor fake so the report observes it.)
          fetchCorporateActions: (() => { const v = vendorAnswering(async (sym) => (sym === 'AAPL' ? aaplCa : FETCH_OK)); return makeParseReportingFetcher(db, { symbols: ['AAPL', 'SPY'], base: v.fetchCorporateActions, fetchImpl: v.caFetchImpl }); })(),
        });
      }
      await ensureUniverseSnapshot(db, {
        tickKey: `${DAYS.d2}_open30`, sessionDate: DAYS.d2, heldTickers: ['AAPL', 'SPY'], candidateUniverse: [], minCandidateCapacity: 0,
        now: new Date(etIso(DAYS.d2, 10, 1)), dailyDoc: db._get(`mandateUniverseDaily/${DAYS.d2}`) ?? null,
        fetchQuotes: async (syms) => Object.fromEntries(syms.map((s) => [s, { close: s === 'AAPL' ? D2_AAPL : 597.31, timestamp: Date.parse(etIso(DAYS.d2, 9, 45)) / 1000 }])),
      });
    } finally { for (const s of quiet) s.mockRestore(); }
    return { db, bookId, heldId: held.ideaId };
  }
  const refusedFor = (heldId, reason) => ({
    ok: false, permittedMaxUsd: null, binding: [],
    refusals: [{
      code: 'admission_marks_unavailable', symbols: ['AAPL'], unavailable: [{ symbol: 'AAPL', ideaId: heldId, reason }],
      basis: 'session_snapshot', session: DAYS.d2, snapshotKey: `${DAYS.d2}_open30`,
    }],
  });

  it('Astra\'s regression: D2\'s fetch FAILED for AAPL and the reverse split prints $289.3375 — a $21,000 short JPM idea is refused `ca_fetch_failed` for AAPL, nothing is written; the true short cap was $19,998.20', async () => {
    const { db, bookId, heldId } = await t2c01Book({ aaplCa: { actions: [], calls: 0, failed: true } });
    // The builders as they are: the daily layer records the failure; the snapshot carries the adjusted price and no
    // action — and nothing of the failure.
    expect(db._get(`mandateUniverseDaily/${DAYS.d2}`).symbols.AAPL.caFetchFailed).toBe(true);
    const aapl = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols.AAPL;
    expect(aapl).toMatchObject({ price: D2_AAPL, complete: true, priceAsOf: etIso(DAYS.d2, 9, 45) });
    expect(aapl).not.toHaveProperty('corporateActions');
    expect(aapl).not.toHaveProperty('caFetchFailed');
    const before = moneyStoreBytes(db);
    const res = await admitIdea(db, { bookId, contract: shortJpm(), opId: 'short-jpm', nowIso: AT_11 });
    expect(res).toEqual(refusedFor(heldId, 'ca_fetch_failed'));
    // A draft whose shape fails hears it too (the marks need no contract).
    const broken = await admitIdea(db, { bookId, contract: contractOf({ slot: 'nope' }), opId: 'broken', nowIso: AT_11 });
    expect(broken.refusals).toEqual([{ code: 'slot_invalid' }, refusedFor(heldId, 'ca_fetch_failed').refusals[0]]);
    expect(moneyStoreBytes(db)).toBe(before);
    // What admission would have measured against: presented with the split at the same price, the close values the book
    // at $99,991.00 — its short cap $19,998.20, $1,001.80 under the $21,000 (Astra's diagnostic control, not a change).
    await closeOn(db, bookId, DAYS.d2, { ...T2C_Q, AAPL: { ...T2C_Q.AAPL, price: D2_AAPL, corporateActions: [REVERSE] } });
    const equityCents = Math.round(getBook(db, bookId).portfolio.totalValue * 100);
    expect(equityCents).toBe(9999100);
    expect(Math.floor(equityCents / 5)).toBe(1999820);
  });

  it('a daily document with NO ENTRY for the held name (built without the idea book\'s coverage): refused `ca_coverage_missing`, nothing written', async () => {
    const { db, bookId, heldId } = await t2c01Book({ aaplInDaily: false });
    expect(Object.keys(db._get(`mandateUniverseDaily/${DAYS.d2}`).symbols)).toEqual(['SPY']);
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols.AAPL).toMatchObject({ price: D2_AAPL, complete: true });
    const before = moneyStoreBytes(db);
    expect(await admitIdea(db, { bookId, contract: shortJpm(), opId: 'short-jpm', nowIso: AT_11 })).toEqual(refusedFor(heldId, 'ca_coverage_missing'));
    expect(moneyStoreBytes(db)).toBe(before);
  });

  it('NO daily document for the session at all, with a held name: refused — stricter than a sale, on purpose; nothing written (T1a-2b-3: the snapshot names no daily layer, so it is not used — Amendment F-2, R7d)', async () => {
    const { db, bookId, heldId } = await t2c01Book({ daily: false });
    expect(db._get(`mandateUniverseDaily/${DAYS.d2}`)).toBeUndefined();
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`)).toMatchObject({ dailyRef: null, symbols: { AAPL: { price: D2_AAPL } } });
    const before = moneyStoreBytes(db);
    // The snapshot is not used (F-2): no key is named for the marks; the refusal says why, by symbol.
    const refused = refusedFor(heldId, 'snapshot_daily_mismatch');
    refused.refusals[0].snapshotKey = null;
    expect(await admitIdea(db, { bookId, contract: shortJpm(), opId: 'short-jpm', nowIso: AT_11 })).toEqual(refused);
    expect(moneyStoreBytes(db)).toBe(before);
  });

  it('control — the feed SUCCEEDED with nothing listed: the same 25% rise is a genuine one, and the $21,000 is admitted at the new equity ($107,488.75; short cap $21,497.75), the coverage recorded', async () => {
    const { db, bookId } = await t2c01Book();
    const res = await admitIdea(db, { bookId, contract: shortJpm(), opId: 'short-jpm', nowIso: AT_11 });
    expect(res).toMatchObject({ ok: true, permittedMaxUsd: 21497.75 });
    const packet = packetOf(db, bookId, res.ideaId);
    expect(verifyPacket(packet)).toBe(true);
    expect(packet.measuredAgainst).toMatchObject({ equityUsd: 107488.75, recordedEquityUsd: 99991 });
    expect(packet.measuredAgainst.admissionMarks).toMatchObject({
      snapshotKey: `${DAYS.d2}_open30`, marks: { AAPL: { price: D2_AAPL } },
      caCoverage: { dailyKey: DAYS.d2, dailyPresent: true, symbols: { AAPL: { covered: true, fetchSucceeded: true } } },
    });
  });

  it('control — the feed SUCCEEDED and LISTS the reverse split: the coverage passes, and the holding\'s basis is refused `corporate_action_pending`, as before', async () => {
    const { db, bookId, heldId } = await t2c01Book({ aaplCa: { actions: [REVERSE], calls: 0, failed: false } });
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols.AAPL.corporateActions).toEqual([REVERSE]);
    const before = moneyStoreBytes(db);
    expect(await admitIdea(db, { bookId, contract: shortJpm(), opId: 'short-jpm', nowIso: AT_11 })).toEqual(refusedFor(heldId, 'corporate_action_pending'));
    expect(moneyStoreBytes(db)).toBe(before);
  });

  it('control — a book holding NOTHING admits with no daily document anywhere; the packet records the key it would have read, absent', async () => {
    const { db, bookId } = await seedBook();
    expect([...db._store.keys()].some((p) => p.startsWith('mandateUniverseDaily/'))).toBe(false);
    const res = await admitIdea(db, { bookId, contract: contractOf({ capitalUsd: 20000 }), opId: 'x', nowIso: ADMIT_ISO });
    expect(res).toMatchObject({ ok: true, permittedMaxUsd: 20000 });
    expect(packetOf(db, bookId, res.ideaId).measuredAgainst.admissionMarks.caCoverage).toEqual({ dailyKey: DAYS.admit, dailyPresent: false, symbols: {} });
  });

  it('control — outside a session the close basis reads the LAST COMPLETED session\'s daily layer: never the next session\'s, even one already built before its open', async () => {
    const book = async () => {
      const { db, bookId } = await seedBook({ archetypeCodeId: 'momentum_chaser' });
      const held = await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'long', names: ['AAPL'], capitalUsd: 30000 }), opId: 'held', quotes: T2C_Q });
      await closeOn(db, bookId, DAYS.d1, T2C_Q);
      return { db, bookId, heldId: held.ideaId };
    };
    // D1's fetch failed; D2's daily layer (built at 09:00 on D2) succeeded. At 17:00 on D1, and at 09:15 on D2 before its
    // open, the basis is D1's close: refused for D1's failure.
    const a = await book();
    storeDailyLayer(a.db, DAYS.d1, [], { failed: ['AAPL'] });
    storeDailyLayer(a.db, DAYS.d2, ['AAPL']);
    for (const nowIso of [etIso(DAYS.d1, 17, 0), etIso(DAYS.d2, 9, 15)]) {
      const res = await admitIdea(a.db, { bookId: a.bookId, contract: shortJpm(1000), opId: `x-${nowIso}`, nowIso });
      expect(res.refusals, nowIso).toEqual([{
        code: 'admission_marks_unavailable', symbols: ['AAPL'], unavailable: [{ symbol: 'AAPL', ideaId: a.heldId, reason: 'ca_fetch_failed' }],
        basis: 'last_close', session: DAYS.d1, snapshotKey: `${DAYS.d1}_close`,
      }]);
    }
    // The reverse — D1 covered, D2 failed: admitted at D1's close, and the packet names D1's daily layer.
    const b = await book();
    storeDailyLayer(b.db, DAYS.d1, ['AAPL']);
    storeDailyLayer(b.db, DAYS.d2, [], { failed: ['AAPL'] });
    const ok = await admitIdea(b.db, { bookId: b.bookId, contract: shortJpm(1000), opId: 'x', nowIso: etIso(DAYS.d2, 9, 15) });
    expect(ok.ok).toBe(true);
    expect(packetOf(b.db, b.bookId, ok.ideaId).measuredAgainst.admissionMarks).toMatchObject({
      basis: 'last_close', session: DAYS.d1, snapshotKey: `${DAYS.d1}_close`,
      caCoverage: { dailyKey: DAYS.d1, dailyPresent: true, symbols: { AAPL: { covered: true, fetchSucceeded: true } } },
    });
  });
});
