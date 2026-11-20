// api/_utils/practiceField/corporateActionCorrections.fixRound.test.js
//
// Practice Field T1a-2b-4 — THE FIX-ROUND REFUTER'S REPRODUCTIONS (RFX, on de858e26), kept as rows: each failed there and
// holds after its fix — RFX-1 (the B-3 floor reached before the idea's entry: a doubt only a founder ruling could clear),
// RFX-2 (two share-basis rows of one date on a closed holding waited on each other for good), RFX-3 (a resulted idea's
// `lateDataUnsettled` compared in written key order, which Firestore does not keep). The refuter's own scenarios; printed
// observations are muted.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';
import { roundUsd } from '../mandateRounding.js';
import { seedBook, admitAndEnter, contractOf, getIdea, getRow, closeOn, closeNowOf, storeCloseSnapshot, storeParseReport, takeSeededDbs, windowAt, founderRules, storeTickSnapshot, etIso, getBook, omitParseReport } from './__testsupport__/fixtures.js';
import { admitIdea } from './admission.js';
import { legReportOf, parseReportEntryOf } from './caParseReport.js';
import { closeIdeaBook } from './close.js';
import { openAmbiguities } from './ledger.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { nextSessionDate } from './windows.js';

describe("RFX-1 — a rejected row dated on or before the idea's entry never lowers its covered-through date", () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });
  // RFX probe — the B-3 covered-through floor and a rejected row dated BEFORE the idea's entry (an action the idea can
  // never be owed: entitlement needs the holding across the ex-date). Listed late (first seen after the entry, inside the
  // 5-day window), the floor lowers caCoveredThrough to before the entry; once the row leaves the window, the gap needs a
  // backfill from that date — which re-fetches the same malformed row and fails. The doubt then holds until a founder
  // ruling. Printed per session; the assertions state what 994ccc2e did (the doubt healed when the row left the window).








  const S = ['2026-11-16'];
  while (S.length < 14) S.push(nextSessionDate(S.at(-1)));
  const PRE_ENTRY = '2026-11-13'; // the Friday before the entry (S0 = Monday 11-16)
  const q = (p = 100) => ({ AAPL: { price: p, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
  let restore;
  beforeEach(() => { restore = setPracticeFieldModeForTests('on'); takeSeededDbs(); vi.stubEnv('EODHD_API_KEY', 'k'); vi.stubGlobal('fetch', async () => { throw new Error('offline'); }); vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { restore(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const BAD = { date: PRE_ENTRY, value: null };
  let BADSYM = 'AAPL';
  /** The vendor as EODHD answers from/to: AAPL's dividends leg lists the malformed pre-entry row when it is in range. */
  const vendor = async (url) => {
    const u = new URL(url);
    const leg = u.pathname.includes('/splits/') ? 'splits' : 'dividends';
    const sym = decodeURIComponent(u.pathname.split('/').pop()).replace(/\.US$/, '');
    const from = u.searchParams.get('from'); const to = u.searchParams.get('to');
    const rows = sym === BADSYM && leg === 'dividends' ? [BAD].filter((r) => r.date >= from && r.date <= to) : [];
    return { ok: true, status: 200, json: async () => rows };
  };
  /** The parse report the wrapper writes for AAPL when its dividends leg returns only the malformed row. */
  const rejectedEntry = () => parseReportEntryOf({
    splits: legReportOf(BADSYM, 'splits', { answered: true, status: 200, hasBody: true, body: [] }),
    dividends: legReportOf(BADSYM, 'dividends', { answered: true, status: 200, hasBody: true, body: [BAD] }),
  }, { at: null, actions: [] });

  async function run({ rule = false, sell = false, onTime = false } = {}) {
    const ctx = await seedBook();
    const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: q(), date: S[0] });
    if (a.entry.outcome !== 'entered') throw new Error(JSON.stringify(a.entry));
    const c = { ...ctx, ideaId: a.ideaId };
    const idea = () => getIdea(c.db, c.bookId, c.ideaId);
    const log = [];
    if (onTime) {
      // ON TIME: the vendor has listed the malformed 11-13 row since 11-13; the idea was admitted on 11-13 (admission reads
      // only the book's existing holdings) and entered at S0 — entry reads no corporate-action coverage. S0's report rejects it.
      await storeCloseSnapshot(c.db, S[0], q());
      storeParseReport(c.db, S[0], BADSYM, rejectedEntry());
      await closeIdeaBook(c.db, c.bookRef, { date: S[0], now: closeNowOf(S[0]), caFetchImpl: vendor });
      log.push(`${S[0]} (entry session, row in window): coveredThrough=${idea().caCoveredThrough?.[BADSYM]} gap=${idea().caCoverageGaps?.[BADSYM]?.since ?? null}`);
    } else await closeOn(c.db, c.bookId, S[0], q());
    for (let i = 1; i <= 9; i += 1) {
      // S1, S2: the 5-day window [S−5, S+2] still reaches 11-13, and the vendor lists the malformed row (first time at S1).
      const inWindow = i <= 2;
      let price = 100;
      if (sell && i === 6) price = roundUsd(idea().lines.find((l) => l.symbol === 'AAPL').level - 0.5);
      await storeCloseSnapshot(c.db, S[i], q(price));
      if (inWindow) storeParseReport(c.db, S[i], BADSYM, rejectedEntry());
      if (rule && i === 7 && idea().caCoverageGaps?.AAPL) {
        const gap = idea().caCoverageGaps?.AAPL;
        const out = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${gap.since}`, decision: 'no_action' });
        log.push(`  founder coverage_gap no_action: ${out.status}`);
      }
      const res = await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]), caFetchImpl: vendor });
      const it = idea();
      const bf = c.db._get('practiceFieldCaBackfill/AAPL');
      log.push(`${S[i]}: AAPL quality=${getRow(c.db, c.bookId, c.ideaId, S[i])?.marks?.AAPL?.quality} rowFQ=${getRow(c.db, c.bookId, c.ideaId, S[i])?.fullQuality} coveredThrough=${it.caCoveredThrough?.AAPL} gap=${it.caCoverageGaps?.AAPL ? `${it.caCoverageGaps.AAPL.since}/${it.caCoverageGaps.AAPL.reason}` : null} backfill=${bf ? `${bf.from}..${bf.to} failed=${bf.failed} rej=${bf.parseReport?.rowsRejected}` : null} exitPending=${!!it.ledger.holdings.AAPL?.exitPending} gapAlerts=${(res.alerts || []).filter((x) => /COVERAGE_GAP|BACKFILL/.test(x)).length}`);
      if (sell && i === 6) {
        const w = await windowAt(c.db, c.bookId, { date: S[7], slot: 'open30', quotes: q(price) });
        log.push(`  S7 open30 window: sales=${JSON.stringify(w.sales?.sales ?? w.sales).slice(0, 300)}; AAPL still held=${Object.hasOwn(idea().ledger.holdings, 'AAPL')}`);
      }
    }
    return { c, log, idea: idea() };
  }

  describe('RFX B-3 floor: SPY (in every idea)', () => {
    afterEach(() => { BADSYM = 'AAPL'; });
    it('a malformed pre-entry SPY distribution listed late: the SPY ledger after the row left the window', async () => {
      BADSYM = 'SPY';
      const { c, log, idea } = await run();
      const rows = [5, 7, 9].map((i) => `${S[i]} rowFQ=${getRow(c.db, c.bookId, c.ideaId, S[i])?.fullQuality} SPY quality=${getRow(c.db, c.bookId, c.ideaId, S[i])?.marks?.SPY?.quality ?? JSON.stringify(Object.keys(getRow(c.db, c.bookId, c.ideaId, S[i])?.marks || {}))}`);
      void log;
      console.info(`[RFX b3 SPY] ${rows.join(' | ')} || SPY coveredThrough=${idea.caCoveredThrough?.SPY} gap=${JSON.stringify(idea.caCoverageGaps?.SPY ?? null)}`);
      expect(idea.caCoverageGaps?.SPY ?? null).toBeNull();
    });
  });

  describe('RFX B-3 floor: a malformed row dated before the entry, listed late', () => {
    it('the doubt after the row left the window (S3..S9)', async () => {
      const { log, idea } = await run();
      console.info(`[RFX b3 pre-entry]\n${log.join('\n')}`);
      // 994ccc2e: the doubt lasted only while the row was listed (S1, S2); from S3 the window covers from the entry on.
      expect(idea.caCoverageGaps?.AAPL ?? null, 'a doubt about an action dated before the entry, held after the row left the window').toBeNull();
    });
    it('ON TIME: the row listed since its date, the idea entered while it is in the window', async () => {
      const { log, idea } = await run({ onTime: true });
      console.info(['[RFX b3 pre-entry ON TIME]', ...log].join(' || '));
      expect(idea.caCoverageGaps?.AAPL ?? null, 'a doubt about an action dated before the entry').toBeNull();
    });
    it('no gap is recorded, so there is nothing for the founder to rule (S7)', async () => {
      const { idea } = await run();
      expect(idea.caCoverageGaps?.AAPL ?? null).toBeNull();
      expect(idea.caCoveredThrough.AAPL).toBe(S[9]);
    });
    it('a second idea admitted to the book at S5 (10:30), while the first idea\'s AAPL is in this doubt', async () => {
      const { c, log } = await run();
      // (The run closed through S9; replay the question at a session inside the doubt: S10's window, after S9's close.)
      await storeTickSnapshot(c.db, S[10], 'open30', q());
      const out = await admitIdea(c.db, { bookId: c.bookId, contract: contractOf({ names: ['NVDA'], capitalUsd: 5000, slot: 'medium' }), opId: 'idea-2', nowIso: etIso(S[10], 10, 30) });
      console.info(`[RFX b3 pre-entry + admission]\n${log.slice(-1).join('\n')}\n  admission at ${S[10]} 10:30: ok=${out.ok} ${JSON.stringify(out.refusals ?? out.reason ?? null).slice(0, 400)}`);
      expect(out.ok, 'the whole book refuses new ideas over a pre-entry row').toBe(true);
    });
    it('a line breach at S6: the S7 window sale', async () => {
      const { log, idea } = await run({ sell: true });
      console.info(`[RFX b3 pre-entry + sale]\n${log.join('\n')}`);
      expect(Object.hasOwn(idea.ledger.holdings, 'AAPL'), 'the line sale waited on a doubt about a pre-entry row').toBe(false);
    });
  });
});

describe('RFX-2 — two share-basis rows of one date on a closed holding apply in order, never wait on each other', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });
  // RFX probe — A-1's shareDoubtOn holds a closed holding's row behind ANY other waiting share-basis row of the symbol dated
  // on or before it (`closedHeldRows`), excluding only itself. Two share-basis rows of one symbol on ONE date under two ids
  // (a forward split and a reverse split: `split_AAPL_D`, `reverse_split_AAPL_D`) — once both wait, each holds the other.
  // Realistic shape: the vendor lists a 10-for-1 during a doubt, then corrects the direction to 1-for-10.









  const S = ['2026-11-16'];
  while (S.length < 20) S.push(nextSessionDate(S.at(-1)));
  const div = (i, v = 1, s = 'AAPL') => parseDividendsPayload(s, [{ date: S[i], unadjustedValue: v }]).actions[0];
  const spl = (i, r, s = 'AAPL') => parseSplitsPayload(s, [{ date: S[i], split: r }]).actions[0];
  const q = (p = 100, a = []) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
  const SECTOR = { comparison: { type: 'sector_fund', symbols: ['XLK'] } };

  async function start() {
    const ctx = await seedBook();
    const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, ...SECTOR }), quotes: q(), date: S[0] });
    if (a.entry.outcome !== 'entered') throw new Error(JSON.stringify(a.entry));
    return { ...ctx, ideaId: a.ideaId };
  }
  const ideaOf = (c) => getIdea(c.db, c.bookId, c.ideaId);
  const recon = (c) => { const b = getBook(c.db, c.bookId); return assertReconciled(b, b.openIdeaIds.map((id) => getIdea(c.db, c.bookId, id))); };
  const close = async (c, i, p, a = []) => { const out = await closeOn(c.db, c.bookId, S[i], q(p, a)); recon(c); return out; };
  async function closeUncovered(c, i, p, rows) {
    await storeCloseSnapshot(c.db, S[i], q(p, rows));
    omitParseReport(c.db, S[i], ['AAPL']);
    const out = await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
    recon(c);
    return out;
  }
  const belowLine = (c) => roundUsd(ideaOf(c).lines.find((l) => l.symbol === 'AAPL').level - 0.5);

  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); vi.stubEnv('EODHD_API_KEY', ''); vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); takeSeededDbs(); });

  async function scenario(first, then) {
    const c = await start();
    await close(c, 0, 100);
    const p = belowLine(c);
    await close(c, 1, p);
    const w = await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(p) });
    if (!(w.sales?.sold >= 1)) throw new Error(`not sold: ${JSON.stringify(w.sales)}`);
    await close(c, 2, p);
    const log = [];
    // S3: one uncovered close (AAPL's parse report missing) lists `first`.
    const o3 = await closeUncovered(c, 3, p, first);
    log.push(`${S[3]} (uncovered): closedHeldRows=${JSON.stringify((ideaOf(c).ledger.closedHeldRows || []).map((r) => r.actionId))}`);
    for (let i = 4; i <= 9; i += 1) {
      const out = await close(c, i, p, then);
      const idea = ideaOf(c);
      const row = getRow(c.db, c.bookId, c.ideaId, S[i]);
      log.push(`${S[i]}: closedHeldRows=${JSON.stringify((idea.ledger.closedHeldRows || []).map((r) => r.actionId))} history=${JSON.stringify((idea.ledger.corporateActionReceipts || []).filter((r) => r.historyOnly).map((r) => [r.actionId, r.ratio]))} adjustments=${JSON.stringify((idea.ledger.adjustments || []).map((a) => [a.kind, a.actionId, a.amountUsd]))} openAmbiguities=${openAmbiguities(idea.ledger).length} rowFQ=${row?.fullQuality} waitingAlerts=${(out.alerts || []).filter((x) => x.startsWith('PRACTICE_FIELD_LATE_ROW_WAITING')).length}`);
    }
    void o3;
    return { c, log };
  }

  // (T1a-2b-4 fix round, L-5 — Q-9 answered with a hold: two share-basis ids of one symbol and one date are ONE AMBIGUITY.
  // The two rows no longer apply in order: both are recorded for the founder's conflict ruling — reachable, so nothing waits
  // for good — and the dividend dated after them waits on that ambiguity, then is proposed once it is ruled.)
  const SPLIT = `split_AAPL_${S[1]}`;
  const REVERSE = `reverse_split_AAPL_${S[1]}`;
  const sameDateRecords = (c) => (ideaOf(c).ledger.corporateActionReceipts || []).filter((r) => r.reason === 'possible_redate').map((r) => [r.actionId, r.kinds[0]]).sort();
  describe('RFX: two same-date share-basis rows on a closed holding (L-5: one ambiguity, for the founder)', () => {
    it('A: both listed during one doubt (10/1 and 1/10 dated S1), then listed on clean closes with a $1 dated S2 — one ambiguity; the founder reaches both; the dividend is proposed once they are ruled', async () => {
      const { c, log } = await scenario([spl(1, '10/1'), spl(1, '1/10')], [spl(1, '10/1'), spl(1, '1/10'), div(2, 1)]);
      console.info(`[RFX same-date A]\n${log.join('\n')}`);
      expect(sameDateRecords(c)).toEqual([[REVERSE, 'same_date_share_basis'], [SPLIT, 'same_date_share_basis']]);
      expect((ideaOf(c).ledger.closedHeldRows ?? []).map((r) => r.actionId), 'only the dividend waits — on the ambiguity, never on each other').toEqual([`cash_dividend_AAPL_${S[2]}`]);
      const r1 = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: SPLIT, decision: 'none' }, { expectOk: false, requestKey: 'r1' });
      const r2 = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: REVERSE, decision: 'none' }, { expectOk: false, requestKey: 'r2' });
      expect([r1.status, r2.status], 'the founder reaches both').toEqual([200, 200]);
      await close(c, 10, belowLine(c), [spl(1, '10/1'), spl(1, '1/10'), div(2, 1)]);
      expect(ideaOf(c).ledger.closedHeldRows ?? []).toEqual([]);
      expect((ideaOf(c).ledger.lateProposals || []).map((p) => [p.actionId, p.netUsd, p.entitledShares])).toEqual([[`cash_dividend_AAPL_${S[2]}`, 99.97, 99.970008]]);
    });
    it('B: the vendor lists 10/1 during a doubt, then corrects the direction to 1/10 (only), with a $1 dated S2 — the waiting row and the correction are one ambiguity', async () => {
      const { c, log } = await scenario([spl(1, '10/1')], [spl(1, '1/10'), div(2, 1)]);
      console.info(`[RFX same-date B]\n${log.join('\n')}`);
      expect(sameDateRecords(c)).toEqual([[REVERSE, 'same_date_share_basis'], [SPLIT, 'same_date_share_basis']]);
      expect((ideaOf(c).ledger.closedHeldRows ?? []).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[2]}`]);
    });
    it('control: the same first row, the vendor then lists it unchanged — applied once', async () => {
      const { c, log } = await scenario([spl(1, '10/1')], [spl(1, '10/1'), div(2, 1)]);
      console.info(`[RFX mutual wait control]\n${log.join('\n')}`);
      expect(ideaOf(c).ledger.closedHeldRows ?? []).toEqual([]);
    });
  });

  describe('RFX: variant B through the idea\'s result (L-5: unruled at the endpoint, the ambiguity leaves the result unmeasurable, named)', () => {
    const qm = (p, a = [], msft = 200) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: msft, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
    it('MSFT sold on its line after the lock: the endpoint, the result, the look-back', async () => {
      const c = await start();
      await close(c, 0, 100);
      const p = belowLine(c);
      await close(c, 1, p);
      await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(p) });
      await close(c, 2, p);
      await closeUncovered(c, 3, p, [spl(1, '10/1')]);
      await close(c, 4, p, [spl(1, '1/10'), div(2, 1)]);
      const lines = [];
      lines.push(`S4 closedHeldRows=${JSON.stringify((ideaOf(c).ledger.closedHeldRows || []).map((r) => r.actionId))}`);
      const mb = roundUsd(ideaOf(c).lines.find((l) => l.symbol === 'MSFT').level - 0.5);
      await closeOn(c.db, c.bookId, S[5], qm(p, [spl(1, '1/10'), div(2, 1)], mb));
      await windowAt(c.db, c.bookId, { date: S[6], slot: 'open30', quotes: qm(p, [], mb) });
      await closeOn(c.db, c.bookId, S[6], qm(p, [spl(1, '1/10'), div(2, 1)], mb));
      const idea = ideaOf(c);
      const ep = getRow(c.db, c.bookId, c.ideaId, 'endpoint');
      lines.push(`S6 status=${idea.status} economic=${idea.result?.economicResult} endpoint idea.fullQuality=${ep?.idea?.fullQuality} unsettled=${JSON.stringify(ep?.idea?.unsettledActions)} dataQuality=${JSON.stringify(idea.result?.dataQuality)}`);
      const seen = [];
      for (let i = 7; i <= 14; i += 1) {
        const out = await closeOn(c.db, c.bookId, S[i], qm(p, [spl(1, '1/10'), div(2, 1)], mb));
        seen.push(...(out.alerts || []).filter((a) => /LATE_DATA_(LEFT_)?UNSETTLED/.test(a)).map((a) => `${S[i]}:${a.split(' ')[0]}`));
      }
      const fin = ideaOf(c);
      lines.push(`after S14 closedHeldRows=${JSON.stringify((fin.ledger.closedHeldRows || []).map((r) => r.actionId))} adjustments=${JSON.stringify((fin.ledger.adjustments || []).map((a) => [a.kind, a.amountUsd]))} lateDataUnsettled=${JSON.stringify(fin.lateDataUnsettled)} economic=${fin.result?.economicResult}`);
      lines.push(`alerts ${JSON.stringify(seen)}`);
      console.info(['[RFX same-date to result]', ...lines].join(' || '));
      // (L-5: the founder never ruled the two same-date ids before the endpoint — the result is unmeasurable under its own
      // reason, the ambiguity named there and, after the result, on the idea; nothing posts — L-8.)
      expect(fin.result?.economicResult).toBe('unmeasurable');
      expect(fin.result.economic.unmeasurableBecause).toContain('idea_unsettled_corporate_action');
      expect(ep.idea.unsettledActions).toEqual(expect.arrayContaining([SPLIT, REVERSE]));
      expect(fin.lateDataUnsettled.actions.map((a) => a.actionId)).toEqual(expect.arrayContaining([SPLIT, REVERSE]));
      expect(fin.ledger.adjustments ?? []).toEqual([]);
    });
  });
});

describe('RFX-3 — a resulted idea is not rewritten at every look-back close when nothing changed', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });
  // RFX probe — closeResultedIdea compares `lateDataUnsettled` with JSON.stringify against the idea AS READ. Firestore
  // need not hand a map back in the order it was written (the repo's own rule: mandateUniverseSnapshot.js:356, the
  // canonicalHash.js header); the fake store does. Simulated here by re-storing the idea with every map's keys sorted (what
  // the server returns) between closes. With nothing new, does each look-back close rewrite the resulted idea?







  const S = ['2026-11-16'];
  while (S.length < 12) S.push(nextSessionDate(S.at(-1)));
  const div = (i, v = 1, s = 'AAPL') => parseDividendsPayload(s, [{ date: S[i], unadjustedValue: v }]).actions[0];
  const q = (p = 100, a = []) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });

  const isPlain = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
  const deepSorted = (v) => (Array.isArray(v) ? v.map(deepSorted) : (isPlain(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, deepSorted(v[k])])) : v));

  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); vi.stubEnv('EODHD_API_KEY', ''); vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); takeSeededDbs(); });

  async function run({ firestoreOrder, only = null }) {
    const ctx = await seedBook();
    const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL'], capitalUsd: 10000 }), quotes: q(), date: S[0] });
    const c = { ...ctx, ideaId: a.ideaId };
    const path = `mandates/${c.bookId}/ideas/${c.ideaId}`;
    await closeOn(c.db, c.bookId, S[0], q());
    const p = roundUsd(getIdea(c.db, c.bookId, c.ideaId).lines[0].level - 0.5);
    await closeOn(c.db, c.bookId, S[1], q(p));
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(p) });
    await closeOn(c.db, c.bookId, S[2], q(p));
    if (getIdea(c.db, c.bookId, c.ideaId).status !== 'resulted') throw new Error('not resulted');
    const log = [];
    // S3: the $1 dated S1 listed while AAPL's parse report is missing → it waits (named in lateDataUnsettled). S4..S6: the
    // same, nothing new.
    for (let i = 3; i <= 6; i += 1) {
      await storeCloseSnapshot(c.db, S[i], q(p, [div(1, 1)]));
      omitParseReport(c.db, S[i], ['AAPL']);
      const before = c.db._store.get(path);
      await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
      const after = c.db._store.get(path);
      log.push(`${S[i]}: revision ${before.data.revision}→${after.data.revision} storeVersion ${before.version}→${after.version} written=${after.version !== before.version} lateDataUnsettled=${JSON.stringify(after.data.lateDataUnsettled)}`);
      if (firestoreOrder) {
        let data = after.data;
        if (only === 'lateDataUnsettled') data = { ...data, ...(data.lateDataUnsettled ? { lateDataUnsettled: deepSorted(data.lateDataUnsettled) } : {}) };
        else if (only === 'allButLateDataUnsettled') { const { lateDataUnsettled: keep, ...rest } = data; data = { ...deepSorted(rest), ...(keep ? { lateDataUnsettled: keep } : {}) }; }
        else data = deepSorted(data);
        c.db._store.set(path, { data, version: after.version });
      }
    }
    return { log, c, path };
  }

  describe('RFX: lateDataUnsettled after a Firestore read', () => {
    it('control — key order as written (the fake store): written once, at S3', async () => {
      const { log } = await run({ firestoreOrder: false });
      console.info(`[RFX unsettled control]\n${log.join('\n')}`);
      expect(log.filter((l) => l.includes('written=true')).length).toBe(1);
    });
    it('only lateDataUnsettled in server key order', async () => {
      const { log } = await run({ firestoreOrder: true, only: 'lateDataUnsettled' });
      console.info(['[RFX unsettled only-field]', ...log.map((l) => l.slice(0, 90))].join(' || '));
      expect(log.filter((l) => l.includes('written=true')).length).toBe(1);
    });
    it('everything but lateDataUnsettled in server key order', async () => {
      const { log } = await run({ firestoreOrder: true, only: 'allButLateDataUnsettled' });
      console.info(['[RFX unsettled all-but-field]', ...log.map((l) => l.slice(0, 90))].join(' || '));
      expect(log.filter((l) => l.includes('written=true')).length).toBe(1);
    });
    it('keys as the server returns them: is the resulted idea rewritten at every close with nothing new?', async () => {
      const { log } = await run({ firestoreOrder: true });
      console.info(`[RFX unsettled firestore order]\n${log.join('\n')}`);
      expect(log.filter((l) => l.includes('written=true')).length, 'rewritten (revision bumped) with nothing changed').toBe(1);
    });
  });
});
