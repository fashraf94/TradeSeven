// api/_utils/filmTape/tapeAstraReview.test.js
//
// THE ASTRA A1 BRANCH REVIEW ROWS (docs/audits/20260928_ASTRA_REVIEW_FILM_TAPE_A1_BRANCH.md,
// build report §8). One describe per finding, each row named by its finding id
// and, where the review gave one, its repro id (R01, R02, …). Every repro row
// was red at the reviewed tip (e7e527e7) before its fix; the rulings are spec
// V1.2 Amendment A, BA-23 … BA-30
// (docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_A_20260928.md).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of the writer,
// the close pass and the candle pass. Never mock them. The flag module is
// mocked by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { parse } from 'acorn';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { writeTapeDay, markCloseFailed } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { scanProtectedStoreWrites, siteKey } from '../compositionProtectedStoresScan.js';
import { stableStringify } from './tapeMerge.js';
import { formatTapeMarkdown } from './tapeExport.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, earlyCloseDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, sessionRows, fetcherOf } from './__fixtures__/tapeBars.js';
import { sessionFor } from './tapeTime.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z'); // run 2026-09-25: window from 2026-09-11, scan from 2026-09-03
const tapePath = (id, d = D) => `agentBattles/${id}/tape/${d}`;
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, TSLA: 242, NFLX: 704, SNOW: 180, COST: 900, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };
const allBars = (over = {}, days = [D]) => {
  const out = {};
  for (const [s, p] of Object.entries(PRICES)) out[s] = days.flatMap((d) => flatRows(d, p));
  return { ...out, ...over };
};

const world = (...fxs) => { const store = {}; for (const fx of fxs) seedDay(store, fx); return makeTapeDb(store); };
const write = (t, fx, now = NIGHT, d = fx.etDate ?? D) => writeTapeDay(fx.battleId, d, { db: t.db, now });
const tapeOf = (t, id, d = D) => t.store.get(tapePath(id, d));
const morning = (t, bars = allBars(), at = MORNING) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
const under = (t, prefix) => t.writeLog.filter((w) => w.path === prefix || w.path.startsWith(`${prefix}/`));

let errSpy;
beforeEach(() => { flags.writer = true; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

// ── F1 — BA-23: the candle pass writes only agentBattles/{battleId}/tape/{etDate} ─────────

describe('F1 — BA-23: a collection-group result is never written on the strength of its collection name', () => {
  /** The sanctioned tape, written by the close pass, and a copy of it planted at `path` with the given etDate. */
  async function planted(paths, { etDate = D, battleId = 'b-captured' } = {}) {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const tape = { ...structuredClone(tapeOf(t, fx.battleId)), battleId, etDate };
    for (const p of paths) t.store.set(p, structuredClone(tape));
    return { t, fx, tape };
  }
  const FOREIGN = (d = D) => `otherRoot/otherOwner/tape/${d}`;
  const DEEP = (d = D) => `agentBattles/b-deep/archive/2026/tape/${d}`;

  it('F1 R01: an otherwise valid pending tape at otherRoot/otherOwner/tape/2026-09-24 receives zero writes — the sanctioned tape is enriched', async () => {
    const { t } = await planted([FOREIGN()]);
    const before = stableStringify(t.store.get(FOREIGN()));
    const s = await morning(t);
    expect(under(t, FOREIGN())).toEqual([]);                                   // neither the document nor series/*
    expect(stableStringify(t.store.get(FOREIGN()))).toBe(before);
    expect([...t.store.keys()].some((k) => k.startsWith(`${FOREIGN()}/series/`))).toBe(false);
    expect(s.invalid).toEqual([FOREIGN()]);                                    // skipped and counted
    expect(tapeOf(t, 'b-captured').passes.candles.status).toBe('written');     // positive control
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
  });

  it('F1 (enrichment): foreign-parent and wrong-depth tapes are skipped and counted; the sanctioned tape is fetched and enriched', async () => {
    const { t } = await planted([FOREIGN(), DEEP()]);
    const fetcher = fetcherOf(allBars());
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcher.fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(under(t, 'agentBattles/b-deep')).toEqual([]);
    expect([...s.invalid].sort()).toEqual([DEEP(), FOREIGN()].sort());
    expect(s.selected).toBe(1);                                                // only the sanctioned tape was processed
    expect(t.writeLog.every((w) => w.path.startsWith(tapePath('b-captured')))).toBe(true);
    expect(tapeOf(t, 'b-captured').passes.candles.status).toBe('written');
  });

  it('F1 (expiry): aged-out foreign-parent and wrong-depth tapes are never closed out; the sanctioned aged tape is', async () => {
    const aged = '2026-09-08'; // inside the scan, older than the 10-session window of 2026-09-25
    const { t } = await planted([FOREIGN(aged), DEEP(aged), tapePath('b-aged', aged)], { etDate: aged, battleId: 'b-aged' });
    const s = await morning(t);
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(under(t, 'agentBattles/b-deep')).toEqual([]);
    expect(t.store.get(FOREIGN(aged)).passes.candles.status).toBe('pending');
    expect(t.store.get(DEEP(aged)).passes.candles.status).toBe('pending');
    expect([...s.invalid].sort()).toEqual([DEEP(aged), FOREIGN(aged)].sort());
    expect(s.expired).toEqual([tapePath('b-aged', aged)]);                     // positive control
    expect(t.store.get(tapePath('b-aged', aged)).passes.candles).toMatchObject({ status: 'failed', reason: 'retry_window_elapsed' });
  });

  it('F1 (failure record): foreign-parent and wrong-depth tapes whose attempt would throw get no failure record; the sanctioned one does', async () => {
    const weekend = '2026-09-19'; // a Saturday: processing throws not_a_session, which takes the failure-record path
    const { t } = await planted([FOREIGN(weekend), DEEP(weekend), tapePath('b-weekend', weekend)], { etDate: weekend, battleId: 'b-weekend' });
    const s = await morning(t);
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(under(t, 'agentBattles/b-deep')).toEqual([]);
    expect(t.store.get(FOREIGN(weekend)).passes.candles).toMatchObject({ status: 'pending', attempts: 0 });
    expect([...s.invalid].sort()).toEqual([DEEP(weekend), FOREIGN(weekend)].sort());
    const control = t.store.get(tapePath('b-weekend', weekend)).passes.candles;       // positive control
    expect(control).toMatchObject({ status: 'failed', attempts: 1 });
    expect(control.reason).toMatch(/^error: not_a_session/);
  });

  it('F1: a sanctioned-looking path whose etDate is malformed, or whose document names another battle or day, is skipped', async () => {
    const bad = ['agentBattles/b-captured/tape/2026-9-24', 'agentBattles/b-captured/tape/2026-02-30', 'agentBattles/b-other/tape/2026-09-24', 'agentBattles/b-captured/tape/2026-09-23'];
    const { t } = await planted(bad);
    const s = await morning(t);
    for (const p of bad) expect(under(t, p), p).toEqual([]);
    expect([...s.invalid].sort()).toEqual([...bad].sort());
    expect(tapeOf(t, 'b-captured').passes.candles.status).toBe('written');
  });
});

// ── F9 — BA-23: the scanner sees every physical write site the tape runs ────

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** The tape's own source files: the passes, the handlers and the read-out — never a test or a fixture. */
const TAPE_SOURCE = /^(api\/_utils\/filmTape\/[^/]+\.js|api\/cron\/film-tape-[^/]+\.js|scripts\/export-film-tape\.js)$/;

/**
 * The enclosing named function of a source position, by the scanner's own
 * rule (compositionProtectedStoresScan.js scanFile): the smallest function
 * declaration, or const-bound arrow/function expression, containing it.
 */
function enclosingFnAt(file, line, column) {
  const src = readFileSync(resolve(REPO, file), 'utf8');
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  const lineStart = [0];
  for (let i = 0; i < src.length; i += 1) if (src[i] === '\n') lineStart.push(i + 1);
  const pos = lineStart[line - 1] + (column - 1);
  const ranges = [];
  const walk = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'FunctionDeclaration' && n.id) ranges.push({ start: n.start, end: n.end, name: n.id.name });
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && (n.init?.type === 'ArrowFunctionExpression' || n.init?.type === 'FunctionExpression')) ranges.push({ start: n.init.start, end: n.init.end, name: n.id.name });
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  };
  walk(ast);
  let best = null;
  for (const r of ranges) if (pos >= r.start && pos <= r.end && (!best || r.end - r.start < best.end - best.start)) best = r;
  return best?.name ?? '<top>';
}

/** The first frame of a recorded write call inside the tape's own source: { file, line, column }. */
function callerOf(stack) {
  for (const l of stack.split('\n')) {
    const m = l.match(/\(?(\/[^()\s]+?\.js):(\d+):(\d+)\)?\s*$/);
    if (!m) continue;
    const file = relative(REPO, m[1]).split('\\').join('/');
    if (TAPE_SOURCE.test(file)) return { file, line: Number(m[2]), column: Number(m[3]) };
  }
  return null;
}

describe('F9 — BA-23: every physical write site is a named writer the protected-store scanner sees', () => {
  it('F9: the scanner\'s census of the tape\'s write sites equals the write sites that actually run — by function, method and count', async () => {
    // STATIC: every Firestore-shaped write the scanner finds in the tape's source.
    const scan = scanProtectedStoreWrites(REPO);
    const staticCounts = {};
    for (const s of scan.all.filter((x) => TAPE_SOURCE.test(x.file))) {
      const k = `${s.file}::${s.fn}::${s.method}`;
      staticCounts[k] = (staticCounts[k] ?? 0) + 1;
    }
    // Every one of them is on the deny-by-default allowlist (the human review record).
    for (const s of scan.needsListing.filter((x) => TAPE_SOURCE.test(x.file))) expect(scan.all).toContain(s);

    // RUNTIME: drive every write path the tape has, recording each write CALL's caller.
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx), { hooks: { recordCallSites: true } });
    await write(t, fx);                                                                    // the close pass's merge write
    await markCloseFailed(t.db, { id: fx.battleId, ownerId: 'owner-1' }, '2026-09-23', 'census', { now: NIGHT }); // a failure with no stored tape
    await markCloseFailed(t.db, { id: fx.battleId }, D, 'census', { now: NIGHT });        // a failure beside a stored tape
    const copy = (battleId, etDate) => t.store.set(tapePath(battleId, etDate), { ...structuredClone(tapeOf(t, fx.battleId)), battleId, etDate });
    copy('b-aged', '2026-09-08');                                                         // aged out of the window: the close-out
    copy('b-weekend', '2026-09-19');                                                      // throws not_a_session: the failure record
    await morning(t);                                                                     // series + targeted update on b-captured
    const runtime = {};
    for (const c of t.callSites) {
      const at = callerOf(c.stack);
      expect(at, `a write to ${c.path} was called from outside the tape's source`).not.toBeNull();
      const method = c.op.replace(/^(tx|batch)\./, '');
      const k = `${at.file}::${enclosingFnAt(at.file, at.line, at.column)}::${method}`;
      (runtime[k] ??= new Set()).add(`${at.file}:${at.line}`);
    }
    const runtimeCounts = Object.fromEntries(Object.entries(runtime).map(([k, lines]) => [k, lines.size]));
    expect(runtimeCounts).toEqual(staticCounts);
    // The physical census the review names: seven sites.
    expect(Object.values(staticCounts).reduce((a, b) => a + b, 0)).toBe(7);
  }, 60_000);
});

// ── F2 — BA-24: a stale bar never stands for an instant; a short session is not a whole one ───

describe('F2 — BA-24: sample freshness and session completeness', () => {
  /** The session's first `n` one-minute bars and nothing after — a hole through the close. */
  const firstBars = (price, n) => sessionRows(D, () => price, { extras: false }).slice(0, n);

  it('F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar\'s time shown, never "complete", never "written"', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AMD: firstBars(144, 61) }));
    const tape = tapeOf(t, fx.battleId);
    const risk = tape.actions.find((a) => a.symbolOut === 'AMD');
    expect(risk.replay.ghost.atSwap).toEqual(expect.any(Number));          // 10:30:10 — the 10:29 bar closed 10 s before: fresh
    expect(risk.replay.ghost.atClose).toBeNull();
    expect(risk.replay.gapPoints).toBeNull();
    expect(risk.replay.missingInputs).toContain('price:AMD@close');
    expect(risk.replay.holdPath.at(-1)).toMatchObject({ tickSeq: null, points: null, barClosedAt: '2026-09-24T14:31:00.000Z' });
    expect(tape.coverage.replay.status).toBe('partial');
    const amd = t.store.get(`${tapePath(fx.battleId)}/series/AMD`);
    expect(amd.bars).toHaveLength(7);                                       // 09:30 … 10:30 — of 39
    const late = amd.atChecks.filter((a) => a.at > '2026-09-24T14:36:00.000Z');
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((a) => a.price === null && a.barClosedAt === '2026-09-24T14:31:00.000Z')).toBe(true);
    expect(tape.coverage.series.status).toBe('partial');
    expect(tape.coverage.series.note).toMatch(/AMD: 7 of 39 ten-minute bars/);
    expect(tape.passes.candles).toMatchObject({ status: 'partial', reason: 'bars_incomplete', symbolsMissing: [], symbolsIncomplete: ['AMD'] }); // retryable: symbolsMissing empty is not completeness
    // the founder read-out shows the null with its bar's age, and the incomplete symbol
    const md = formatTapeMarkdown(tape, [amd]);
    expect(md).toContain('close — (last bar closed 10:31 AM ET)');
    expect(md).toMatch(/missing: none · incomplete: AMD/);
  });

  it('F2: every sample kind obeys the age rule — the bought leg, a plan\'s two prices, the comparables — null with the stale bar\'s time and the input named', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ NFLX: firstBars(704, 61), SPY: firstBars(560, 61) }));
    const tape = tapeOf(t, fx.battleId);
    const model = tape.actions.find((a) => a.symbolIn === 'NFLX');           // swapped 12:30:05 ET
    expect(model.replay.bought.atClose).toBeNull();
    expect(model.replay.missingInputs).toEqual(expect.arrayContaining(['price:NFLX@close', 'price:SPY@swap', 'price:SPY@close']));
    expect(model.replay.marketChangeAfter.SPY).toBeNull();
    expect(model.replay.reconciliation.boughtVsEvidence).toBeNull();      // a stale price is never reconciled against the record
    const plan = tape.plans.find((p) => p.symbol === 'NFLX');               // planned 12:00 ET
    expect(plan.price.atPlan).toEqual({ value: null, at: '2026-09-24T14:31:00.000Z', basis: 'stale_bar' });
    expect(plan.price.atClose).toEqual({ value: null, at: '2026-09-24T14:31:00.000Z', basis: 'stale_bar' });
    expect(plan.price.missingInputs).toEqual(['price:NFLX@plan', 'price:NFLX@close']);
    expect(tape.passes.candles.status).toBe('partial');
  });

  it('F2 (M11): an early-close session is a whole session — the real processTape keeps 21 ten-minute bars (from the calendar) and writes the pass', async () => {
    const fx = await earlyCloseDay();
    const t = world(fx);
    await write(t, fx, Date.parse('2026-11-28T02:15:30.000Z'));
    const bars = {};
    for (const [sym, p] of Object.entries(PRICES)) bars[sym] = flatRows(fx.etDate, p, { openUtc: '14:30' }); // EST: 09:30 ET = 14:30Z
    const at = Date.parse('2026-11-28T11:00:30.000Z');
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
    const session = sessionFor(fx.etDate);
    expect(session.isEarlyClose).toBe(true);
    const expected = (session.closeMs - session.openMs) / 600_000;          // the calendar's 13:00 close: 21
    expect(expected).toBe(21);
    const series = [...t.store.entries()].filter(([k]) => k.startsWith(`${tapePath(fx.battleId, fx.etDate)}/series/`)).map(([, v]) => v);
    expect(series.length).toBeGreaterThan(5);
    for (const doc of series) {
      expect(doc.bars, doc.symbol).toHaveLength(expected);
      expect(doc.bars.reduce((n, b) => n + b.n, 0), doc.symbol).toBe(210);
    }
    const tape = tapeOf(t, fx.battleId, fx.etDate);
    expect(tape.coverage.series.status).toBe('complete');
    expect(tape.passes.candles).toMatchObject({ status: 'written', symbolsMissing: [] });
    expect(s.written).toHaveLength(1);
  });
});

// ── F3 — BA-25: nothing shrinks on retry ────────────────────────────────────

describe('F3 — BA-25: a retry never replaces a saved series with a poorer one', () => {
  const DAY = 86_400_000;
  const firstBars = (price, n) => sessionRows(D, () => price, { extras: false }).slice(0, n);
  const seriesAt = (t, id, sym) => t.store.get(`${tapePath(id)}/series/${sym}`);

  it('F3 R03: morning 1 saves AAPL whole (39 bars) while SPY fails; morning 2 brings SPY but one AAPL minute — the 39 bars stay, marked preservedFrom', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ SPY: new Error('EODHD 500') }));
    const saved = structuredClone(seriesAt(t, fx.battleId, 'AAPL'));
    expect(saved.bars).toHaveLength(39);
    expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('partial');   // retryable: SPY missing
    await morning(t, allBars({ AAPL: firstBars(231, 1) }), MORNING + DAY);
    const aapl = seriesAt(t, fx.battleId, 'AAPL');
    expect(aapl.bars).toEqual(saved.bars);                                  // 39, not 1
    expect(aapl.atChecks).toEqual(saved.atChecks);
    expect(aapl.preservedFrom).toBe(saved.writtenAt);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.coverage.series.preservedFrom).toBe(saved.writtenAt);
    expect(tape.coverage.series.note).toMatch(/kept from an earlier attempt: AAPL \(a shorter response\)/);
    expect(seriesAt(t, fx.battleId, 'SPY').bars).toHaveLength(39);          // what morning 2 did bring is written
  });

  it('F3: a LONGER response replaces the saved series — the whole session wins over a saved hole, and nothing is marked preserved', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: firstBars(231, 300) }));              // 30 of 39 ten-minute bars
    expect(seriesAt(t, fx.battleId, 'AAPL').bars).toHaveLength(30);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'partial', symbolsIncomplete: ['AAPL'] });
    await morning(t, allBars(), MORNING + DAY);
    const aapl = seriesAt(t, fx.battleId, 'AAPL');
    expect(aapl.bars).toHaveLength(39);
    expect(aapl.preservedFrom ?? null).toBeNull();
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'written', symbolsIncomplete: [] });
  });

  it('F3: a saved series whose refetch fails stands, and the coverage judges it by its own bars — never "no bars", never complete when it is short', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: firstBars(231, 300) }));
    await morning(t, allBars({ AAPL: new Error('EODHD 500') }), MORNING + DAY);
    const tape = tapeOf(t, fx.battleId);
    expect(seriesAt(t, fx.battleId, 'AAPL').bars).toHaveLength(30);
    expect(tape.passes.candles).toMatchObject({ status: 'partial', reason: 'bars_incomplete', symbolsMissing: [], symbolsIncomplete: ['AAPL'] });
    expect(tape.coverage.series.note).toMatch(/AAPL: 30 of 39 ten-minute bars/);
    expect(tape.coverage.series.note).toMatch(/kept from an earlier attempt: AAPL \(no bars this attempt\)/);
  });
});
