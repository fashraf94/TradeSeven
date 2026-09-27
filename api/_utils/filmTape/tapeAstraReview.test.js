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

const flags = vi.hoisted(() => ({ writer: true, v2: false }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
  get FILM_ROOM_V2_ENABLED() { return flags.v2; },
}));

import { writeTapeDay, markCloseFailed } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { runClosePass } from './closePass.js';
import { getReviewAvailability } from '../../../src/utils/reviewAvailability.js';
import { scanProtectedStoreWrites, siteKey } from '../compositionProtectedStoresScan.js';
import { stableStringify, mergeTape } from './tapeMerge.js';
import { assembleTape } from './tapeAssemble.js';
import { etDayBounds } from './tapeTime.js';
import { formatTapeMarkdown } from './tapeExport.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, earlyCloseDay, noTriggerDay, completedDay, sessionRuns } from './__fixtures__/tapeFixtures.js';
import { composeEvalRunRecord } from '../../cron/agent-evaluate.js';
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
beforeEach(() => { flags.writer = true; flags.v2 = false; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
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

// ── F4 — BA-25: candle output tracks its inputs ─────────────────────────────

describe('F4 — BA-25: when the candle pass\'s inputs change, its output is re-queued or labelled — never left "written"', () => {
  const DAY = 86_400_000;
  /** capturedDay written WITHOUT tick 10 and enriched; returns the world and the withheld tick. */
  async function withoutTick10() {
    const fx = await capturedDay();
    const tick10 = fx.ticks.find((tk) => tk.tickSeq === 10);
    const t = world({ ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== 10) });
    await write(t, fx);
    await morning(t);
    expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
    t.store.set(`agentBattles/${fx.battleId}/ticks/${tick10.tickId}`, tick10);            // the real check is recovered
    return { t, fx };
  }

  it('F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, labelled; the next morning prices tick 10', async () => {
    const { t, fx } = await withoutTick10();
    const aaplBefore = structuredClone(t.store.get(`${tapePath(fx.battleId)}/series/AAPL`));
    expect(aaplBefore.atChecks.some((a) => a.tickSeq === 10)).toBe(false);
    await write(t, fx, MORNING + 3_600_000);                                          // the close pass re-runs
    const tape = tapeOf(t, fx.battleId);
    expect(tape.checks.some((c) => c.tickSeq === 10 && c.rowSource === 'tick')).toBe(true);
    expect(tape.passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', attempts: 0, changedInputs: ['checks'] });
    expect(tape.actions.every((a) => a.replay && a.replay.gapPoints !== null)).toBe(true);      // stays in place until replaced
    for (const s of ['replay', 'series']) {
      expect(tape.coverage[s].status, s).toBe('partial');
      expect(tape.coverage[s].note, s).toMatch(/built before the candle inputs changed \(checks\) — awaiting the next candle pass/);
    }
    expect(formatTapeMarkdown(tape, [])).toContain('inputs changed since it was built: checks');
    await morning(t, allBars(), MORNING + DAY);
    const after = tapeOf(t, fx.battleId);
    expect(after.passes.candles).toMatchObject({ status: 'written' });
    expect(after.passes.candles.changedInputs).toBeUndefined();
    expect(after.coverage.series.note ?? '').not.toMatch(/built before/);
    expect(t.store.get(`${tapePath(fx.battleId)}/series/AAPL`).atChecks.find((a) => a.tickSeq === 10)).toMatchObject({ price: 231 });
  });

  it('F4: outside the window, changed inputs lower a written pass to partial and name what changed; the output stays, labelled "not rebuilt"', async () => {
    const { t, fx } = await withoutTick10();
    await write(t, fx, Date.parse('2026-10-26T02:15:30.000Z'));                        // a month on: no candle pass comes back
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.candles).toMatchObject({ status: 'partial', reason: 'inputs_changed_outside_window', changedInputs: ['checks'] });
    expect(tape.actions.every((a) => a.replay && a.replay.gapPoints !== null)).toBe(true);
    for (const s of ['replay', 'series']) {
      expect(tape.coverage[s].status, s).toBe('partial');
      expect(tape.coverage[s].note, s).toMatch(/built before the candle inputs changed \(checks\) — outside its retry window, not rebuilt/);
    }
  });

  it('F4: a re-run with unchanged inputs changes nothing — the fingerprint is stored by the candle pass and matched by the close pass', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const enriched = structuredClone(tapeOf(t, fx.battleId));
    expect(enriched.passes.candles.inputFingerprint).toEqual({
      checks: expect.any(String), evidence: expect.any(String), actions: expect.any(String), plans: expect.any(String), symbols: expect.any(String),
    });
    expect((await write(t, fx, MORNING + 3_600_000)).status).toBe('unchanged');
    expect(stableStringify(tapeOf(t, fx.battleId))).toBe(stableStringify(enriched));
  });
});

describe('F4 — the fingerprint moves with every input the ruling names, and with nothing the candle pass writes', () => {
  it('F4: each named input moves its own part; replay, prices, candle status and coverage move nothing', async () => {
    const { candleInputFingerprint, changedInputParts } = await import('./candleInputs.js');
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const base = tapeOf(t, fx.battleId);
    const fp = candleInputFingerprint(base);
    const moved = (mutate) => { const d = structuredClone(base); mutate(d); return changedInputParts(fp, candleInputFingerprint(d)); };
    const firstTick = (d) => d.checks.find((c) => c.rowSource === 'tick' && c.state === 'no_trigger');
    expect(moved((d) => { firstTick(d).at = '2026-09-24T13:30:21.000Z'; })).toEqual(['checks']);                 // a check's time
    expect(moved((d) => { firstTick(d).stageReached = 'quotes_checked'; })).toEqual(['checks']);                  // its stageReached
    expect(moved((d) => { d.checks.push({ ...structuredClone(firstTick(d)), key: 'seq:99', tickSeq: 99 }); })).toEqual(['checks']); // a recovered check
    expect(moved((d) => { d.checks.find((c) => c.evidence).evidence = null; })).toEqual(['evidence']);            // evidence presence
    expect(moved((d) => { d.actions[0].replayInputs = { ...d.actions[0].replayInputs, ghost: null }; })).toEqual(['actions']); // replay-input presence
    expect(moved((d) => { d.plans.push({ ...structuredClone(d.plans[0]), key: 'x:9', symbol: 'SNOW' }); })).toEqual(['plans', 'symbols']);
    expect(moved((d) => { d.comparables.sectors.SNOW = 'XLK'; })).toEqual(['symbols']);                          // the symbol-role set
    expect(moved((d) => {
      for (const a of d.actions) a.replay = { gapPoints: 1 };
      for (const p of d.plans) p.price = { atPlan: { value: 1 } };
      d.passes.candles = { status: 'written', attempts: 3 };
      d.coverage.replay = { status: 'complete' };
      d.writtenAt = 'later';
    })).toEqual([]);
  });
});

// ── F5 — BA-26 (and BA-20 amended): coverage is evidence, not rank ──────────

describe('F5 — BA-26: an unknown check is never "complete", and a caveat learned later survives the merge', () => {
  const ENTRY_SECTIONS = ['plans', 'rationale', 'evidence', 'calls', 'directives'];

  it('F5 R05: the model check lost its tick, its entry and its run — no section that would have read it is complete, and the calls note states only what was observed', async () => {
    const fx = await noTriggerDay();                                   // the one model check is tick 9 (15:30Z)
    fx.ticks = fx.ticks.filter((tk) => tk.tickSeq !== 9);
    fx.battle.evaluations = [];
    fx.runs = sessionRuns(D, { skip: ['15:30'] });
    const t = world(fx);
    await write(t, fx);
    const cov = tapeOf(t, fx.battleId).coverage;
    expect(cov.checks.status).toBe('partial');                         // tick 9 is a known gap
    for (const s of ENTRY_SECTIONS) {
      expect(cov[s].status, s).not.toBe('complete');
      expect(cov[s].unknownChecks, s).toBe(1);
    }
    expect(cov.calls.note).toMatch(/no model check recorded among the 25 known check\(s\); 1 check\(s\) have no record/);
    expect(cov.calls.note).not.toMatch(/reached the model/);
  });

  it('F5 R14: a tick names its evalId but the entry is absent — calls and directives are no longer complete, and nothing claims the model was never reached', async () => {
    const fx = await noTriggerDay();
    fx.battle.evaluations = [];                                        // tick 9 keeps its evalId
    const t = world(fx);
    await write(t, fx);
    const cov = tapeOf(t, fx.battleId).coverage;
    expect(cov.plans.status).toBe('unavailable');
    for (const s of ['calls', 'directives']) {
      expect(cov[s].status, s).not.toBe('complete');
      expect(cov[s].unknownChecks, s).toBe(1);
    }
    expect(cov.calls.note).not.toMatch(/no model check|reached the model/);
    expect(cov.calls.note).toMatch(/evaluation entry is absent/);
  });

  it('F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the caveat outlives the run records', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).coverage.checks).toMatchObject({ status: 'complete', note: null });
    // a duplicate invocation inside the already-covered 15:30Z slot: 250 deferred, 200 listed
    const start = Date.parse('2026-09-24T15:32:00.000Z');
    const late = composeEvalRunRecord({
      startTime: start, endTime: start + 250_000, battlesTotal: 400, evaluated: 150,
      summary: { lockSkipped: 0, triggered: 10, modelCalls: 10, budgetSkipped: 0 },
      deferredBattleIds: Array.from({ length: 250 }, (_, i) => `b-other-${i}`),
    });
    t.store.set(`agentEvalRuns/${late.startedAt}`, late);
    await write(t, fx, NIGHT + 60_000);
    let tape = tapeOf(t, fx.battleId);
    expect(tape.passes.close.deferralsTruncated).toBe(true);
    expect(tape.coverage.checks.status).toBe('partial');
    expect(tape.coverage.checks.note).toMatch(/deferred list was truncated/);
    // the run records gone on a later re-run: the flag and the caveat stay
    for (const k of [...t.store.keys()].filter((key) => key.startsWith('agentEvalRuns/'))) t.store.delete(k);
    await write(t, fx, NIGHT + 120_000);
    tape = tapeOf(t, fx.battleId);
    expect(tape.passes.close.deferralsTruncated).toBe(true);
    expect(tape.coverage.checks.status).toBe('partial');
    expect(tape.coverage.checks.note).toMatch(/deferred list was truncated/);
  });

  it('F5 R13 (BA-20 amended): at the 150 cap with the oldest surviving entry before this day nothing of the day was evicted — the cap alone does not lower coverage; with the oldest on this day it does', async () => {
    const pad = (fx, fromIso) => {
      const e = fx.battle.evaluations[0];
      const pads = Array.from({ length: 149 }, (_, i) => ({ ...structuredClone(e), evalId: `old${i}`, timestamp: new Date(Date.parse(fromIso) + i * 1_000).toISOString() }));
      fx.battle.evaluations = [...pads, ...fx.battle.evaluations];
      expect(fx.battle.evaluations).toHaveLength(150);
    };
    const before = await noTriggerDay();
    pad(before, '2026-09-23T14:00:00.000Z');                            // the oldest surviving entry predates the day
    const t1 = world(before);
    await write(t1, before);
    for (const s of ['plans', 'rationale', 'evidence', 'calls']) expect(tapeOf(t1, before.battleId).coverage[s].status, s).toBe('complete');
    const onDay = await noTriggerDay();
    pad(onDay, '2026-09-24T13:00:00.000Z');                             // the oldest surviving entry is on the day: its first entries may be gone
    const t2 = world(onDay);
    await write(t2, onDay);
    for (const s of ['plans', 'rationale', 'evidence']) {
      expect(tapeOf(t2, onDay.battleId).coverage[s].status, s).toBe('partial');
      expect(tapeOf(t2, onDay.battleId).coverage[s].note, s).toMatch(/150-entry cap/);
    }
  });
});

// ── F7 — BA-27: completion is terminal ──────────────────────────────────────

describe('F7 — BA-27: a stale assembly can add facts; it can never move the battle backward', () => {
  /** assembleTape over a fixture day, as the close pass would assemble it from `battle`. */
  const assembleFrom = (fx, battle, nowMs) => assembleTape({
    battle: { ...battle, id: fx.battleId }, etDate: D, bounds: etDayBounds(D), nowMs,
    ticksRead: { ok: true, ticks: fx.ticks, prevSeq: null, nextSeq: null, method: 'capturedAt_range' },
    runsRead: { ok: true, runs: fx.runs }, receiptsRead: { ok: true, receipts: fx.receipts }, callsRead: { ok: true, calls: fx.calls },
    declarationsRead: { ok: true, present: new Set(fx.declarations) }, resolveResult: () => 'win',
  });

  it('F7 R11: an ACTIVE day assembled before the completion, merged after the completed day landed — the battle stays completed, every lifecycle field together', async () => {
    const fx = await completedDay();
    fx.battle.scoreState = { ...fx.battle.scoreState, currentScore: 42 };
    const active = { ...structuredClone(fx.battle), status: 'active', completedAt: null };
    const completedDoc = mergeTape(null, assembleFrom(fx, fx.battle, NIGHT), { nowIso: new Date(NIGHT).toISOString(), withinWindow: true }).doc;
    expect(completedDoc.battle).toMatchObject({ status: 'completed', final: { total: 42 }, result: { value: 'win' } });
    const { doc } = mergeTape(completedDoc, assembleFrom(fx, active, NIGHT - 60_000), { nowIso: new Date(NIGHT + 60_000).toISOString(), withinWindow: true });
    expect(doc.battle).toEqual(completedDoc.battle);                      // status, completedAt, final, result — one unit
    expect(doc.battleStatusAtWrite).toBe('completed');
  });

  it('F7: the writer re-reads the battle inside its transaction — a stale active battle handed to it cannot write "active" over a completion that has landed', async () => {
    const fx = await completedDay();
    const t = world(fx);
    const stale = { ...structuredClone(fx.battle), id: fx.battleId, status: 'active', completedAt: null };
    // first write, from the stale object: the battle document already says completed
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT, battle: stale });
    let tape = tapeOf(t, fx.battleId);
    expect(tape.battleStatusAtWrite).toBe('completed');
    expect(tape.battle).toMatchObject({ status: 'completed', completedAt: '2026-09-24T20:05:00.000Z', final: { total: 46, opponent: 36 } });
    // and again over the stored completed tape
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT + 60_000, battle: stale });
    tape = tapeOf(t, fx.battleId);
    expect(tape.battleStatusAtWrite).toBe('completed');
    expect(tape.battle.status).toBe('completed');
  });
});

// ── F6 — BA-28: one calendar, one eligibility rule ──────────────────────────

describe('F6 — BA-28: the hub helper says "pending" only when the close pass\'s own selection will tape the battle', () => {
  const tiered = (over) => ({
    id: 'b-hub', ownerId: 'owner-1', agentId: 'agent-1', gameMode: 'baggerbomb_agent', status: 'completed',
    dailyReviews: [], evaluations: [], trades: [], chatExchanges: [], scoreState: { currentScore: 12, opponentScore: 8 }, ...over,
  });
  const helper = (battle, nowIso, readTape = async () => null) => getReviewAvailability(battle, { readTape, now: Date.parse(nowIso) });
  const passAt = (t, iso) => runClosePass({ db: t.db, clock: () => Date.parse(iso) });
  const storeWith = (battle) => makeTapeDb({ [`agentBattles/${battle.id}`]: battle });

  it('F6 R04: timing.tradingDays = ["not-a-date"] — "unavailable", and the close pass that night tapes nothing', async () => {
    flags.v2 = true;
    const battle = tiered({ timing: { tradingDays: ['not-a-date'] }, activatedAt: '2026-09-28T12:00:00.000Z', completedAt: '2026-09-28T20:05:00.000Z' });
    expect(await helper(battle, '2026-09-28T23:00:00.000Z')).toEqual({ ready: false, target: 'filmRoom', availability: 'unavailable' });
    const t = storeWith(battle);
    const s = await passAt(t, '2026-09-29T02:15:30.000Z');
    expect(s.notBattleDay).toContain(battle.id);                       // the writer agrees: selected, never taped
    expect(t.writeLog).toEqual([]);
  });

  it('F6 R17: a completion on the 2027-01-18 holiday is pending until the 2027-01-19 session\'s pass has run — the pass that tapes the 2027-01-15 final day', async () => {
    flags.v2 = true;
    const battle = tiered({ timing: { tradingDays: ['2027-01-15'] }, activatedAt: '2027-01-15T12:00:00.000Z', completedAt: '2027-01-18T15:00:00.000Z' });
    expect((await helper(battle, '2027-01-18T22:00:00.000Z')).availability).toBe('pending');
    expect((await helper(battle, '2027-01-19T12:00:00.000Z')).availability).toBe('pending');  // the next morning: Tuesday's pass is still to run
    expect((await helper(battle, '2027-01-20T02:20:00.000Z')).availability).toBe('unavailable'); // it has had its full run and nothing was read back
    const t = storeWith(battle);
    expect(await passAt(t, '2027-01-19T02:15:30.000Z')).toMatchObject({ skipped: true, reason: 'not_a_trading_day' }); // no pass on the holiday
    const s = await passAt(t, '2027-01-20T02:15:30.000Z');
    expect(s.written.map((w) => [w.battleId, w.etDate])).toEqual([[battle.id, '2027-01-15']]);
    const tape = t.store.get(`agentBattles/${battle.id}/tape/2027-01-15`);
    expect(await helper(battle, '2027-01-20T02:21:00.000Z', async () => tape)).toEqual({ ready: true, target: 'filmRoom', availability: 'ready' });
  });

  it('F6 R09: an owning pass beyond the maintained calendar (2028) — "unavailable", and the close pass refuses calendar_missing', async () => {
    flags.v2 = true;
    const battle = tiered({ timing: { tradingDays: ['2027-12-31'] }, activatedAt: '2027-12-31T12:00:00.000Z', completedAt: '2028-01-03T15:00:00.000Z' });
    expect((await helper(battle, '2028-01-03T20:00:00.000Z')).availability).toBe('unavailable');
    const t = storeWith(battle);
    expect(await passAt(t, '2028-01-04T02:15:30.000Z')).toMatchObject({ skipped: true, reason: 'calendar_missing' });
    expect(t.writeLog).toEqual([]);
  });

  it('F6: one calendar and one rule — the server schedule and the helper use the same module functions, and the helper keeps exactly three keys', async () => {
    const calendar = await import('../../../src/utils/marketCalendar.js');
    const schedule = await import('../../../src/utils/tapeSchedule.js');
    const server = await import('../marketSchedule.js');
    const close = await import('./closePass.js');
    const hub = await import('../../../src/utils/reviewAvailability.js');
    expect(server.getSessionForDate).toBe(calendar.getSessionForDate);
    expect(server.getPreviousSessionDate).toBe(calendar.getPreviousSessionDate);
    expect(server.isMarketHoliday).toBe(calendar.isMarketHoliday);
    expect(close.tapeDateFor).toBe(schedule.tapeDateFor);
    expect(close.completionsSinceMs).toBe(schedule.completionsSinceMs);
    expect(hub.owningPassDate).toBe(schedule.owningPassDate);
    flags.v2 = true;
    const battle = tiered({ timing: { tradingDays: ['2026-09-28'] }, completedAt: '2026-09-28T20:05:00.000Z' });
    expect(Object.keys(await helper(battle, '2026-09-28T23:00:00.000Z')).sort()).toEqual(['availability', 'ready', 'target']);
  });
});

// ── F8 — BA-29: expiry is a sweep ───────────────────────────────────────────

describe('F8 — BA-29: every candle run sweeps, in a bounded batch, non-terminal tapes older than the window', () => {
  /** A copy of the written capturedDay tape planted for another battle and day, with its candle block overridden. */
  async function withOldTapes(specs) {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const base = tapeOf(t, fx.battleId);
    for (const { battleId, etDate, candles = {}, path } of specs) {
      const tape = { ...structuredClone(base), battleId, etDate, passes: { ...base.passes, candles: { ...base.passes.candles, ...candles } } };
      t.store.set(path ?? tapePath(battleId, etDate), tape);
    }
    return { t, fx };
  }
  const run = (t, at = MORNING, sweep) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => at, startMs: at, ...(sweep ? { sweep } : {}) });

  it('F8 R20: a pending 2026-09-01 tape — behind the 2026-09-25 scan (which starts 2026-09-03) — is closed out: failed, retry_window_elapsed', async () => {
    const { t } = await withOldTapes([{ battleId: 'b-sept1', etDate: '2026-09-01', candles: { status: 'pending', attempts: 0 } }]);
    const s = await run(t);
    expect(t.store.get(tapePath('b-sept1', '2026-09-01')).passes.candles).toMatchObject({ status: 'failed', reason: 'retry_window_elapsed', attempts: 0 });
    expect(s.expired).toContain(tapePath('b-sept1', '2026-09-01'));
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);   // the morning's own work still done
  });

  it('F8: bounded and resumable — at most maxMarks close-outs a run; the next morning continues where this one stopped', async () => {
    const old = ['2026-08-25', '2026-08-26', '2026-08-27'].map((d, i) => ({ battleId: `b-old${i}`, etDate: d, candles: { status: i === 1 ? 'partial' : 'pending', attempts: 1 } }));
    const { t } = await withOldTapes(old);
    const s1 = await run(t, MORNING, { maxMarks: 2 });
    expect(s1.sweep).toMatchObject({ expired: 2, complete: false });
    const still = old.filter((o) => t.store.get(tapePath(o.battleId, o.etDate)).passes.candles.reason !== 'retry_window_elapsed');
    expect(still).toHaveLength(1);
    const s2 = await run(t, MORNING + 86_400_000, { maxMarks: 2 });
    expect(s2.sweep).toMatchObject({ expired: 1, complete: true });
    for (const o of old) expect(t.store.get(tapePath(o.battleId, o.etDate)).passes.candles.reason, o.etDate).toBe('retry_window_elapsed');
  });

  it('F8: terminal tapes are never rewritten, and a pending tape behind more of them than a page still gets closed out', async () => {
    const terminal = Array.from({ length: 5 }, (_, i) => ({ battleId: `b-done${i}`, etDate: `2026-08-1${i}`, candles: { status: 'failed', attempts: 3, reason: 'attempts_exhausted' } }));
    const elapsed = { battleId: 'b-elapsed', etDate: '2026-08-20', candles: { status: 'failed', attempts: 1, reason: 'retry_window_elapsed' } };
    const pending = { battleId: 'b-late', etDate: '2026-08-31', candles: { status: 'pending', attempts: 0 } };
    const retryable = { battleId: 'b-retry', etDate: '2026-08-28', candles: { status: 'failed', attempts: 1, reason: 'fetch_failed' } };
    const { t } = await withOldTapes([...terminal, elapsed, pending, retryable]);
    const before = t.writeLog.length;
    const s = await run(t, MORNING, { page: 2 });
    const wrote = t.writeLog.slice(before).map((w) => w.path);
    for (const o of [...terminal, elapsed]) expect(wrote, o.battleId).not.toContain(tapePath(o.battleId, o.etDate));
    expect(t.store.get(tapePath('b-late', '2026-08-31')).passes.candles).toMatchObject({ status: 'failed', reason: 'retry_window_elapsed' });
    expect(t.store.get(tapePath('b-retry', '2026-08-28')).passes.candles).toMatchObject({ status: 'failed', reason: 'retry_window_elapsed', attempts: 1 });
    expect(s.sweep.complete).toBe(true);
  });

  it('F8 (BA-23): the sweep validates every path too — an old foreign tape is skipped and counted, never closed out', async () => {
    const foreign = 'otherRoot/otherOwner/tape/2026-09-01';
    const { t } = await withOldTapes([{ battleId: 'b-captured', etDate: '2026-09-01', candles: { status: 'pending' }, path: foreign }]);
    const s = await run(t);
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(s.invalid).toContain(foreign);
  });
});
