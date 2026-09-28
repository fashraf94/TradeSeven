// api/_utils/filmTape/tapeReview.test.js
//
// THE §2 REVIEW ROWS (build report §7): one row per CONFIRMED finding of the
// adversarial review that the build's own suites could not fail on, each named
// by its finding id (L1-…, L2-…, L3-…, L4-…). Every row was red against the
// reviewed tip (19f897e7) or pins a behaviour a mutation of the fix turns red
// (the mutation lens and the re-run of L4's mutants, §7.5).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of the writer,
// the close pass, the candle pass, the assembler and the read-out. Never mock
// them. The flag module is mocked by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { runClosePass, runBackfill, parseBackfillRange } from './closePass.js';
import { assembleTape, directiveWindow } from './tapeAssemble.js';
import { etDayBounds } from './tapeTime.js';
import { formatTapeMarkdown } from './tapeExport.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import {
  AGENT, seedDay, capturedDay, noTriggerDay, completedDay, multiDay, sessionRuns,
} from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');
const DAY = 86_400_000;
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

let errSpy;
beforeEach(() => { flags.writer = true; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

// ── the tape document (lens L1) ─────────────────────────────────────────────

describe('L1 — the tape document', () => {
  it('L1-F2: guardrail-override text the platform wrote is not copied as the agent\'s words', async () => {
    const fx = await capturedDay();
    const e12 = fx.battle.evaluations.find((e) => e.evalId === 'b-captured:e12');
    Object.assign(e12, { rationale: 'Guardrail override (hard): Stop loss hit on MSFT', hypothesis: 'Hypothesis: deterministic guardrail enforcement — Stop loss hit on MSFT', haikuError: null });
    const t = world(fx);
    await write(t, fx);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.rationale.map((r) => r.evalId)).not.toContain('b-captured:e12');
    expect(JSON.stringify(tape.rationale)).not.toMatch(/Guardrail override|deterministic guardrail/);
    expect(tape.coverage.rationale.note).toMatch(/guardrail override/);
  });

  it('L1-F4: a directive filed the evening before the battle\'s first session is on its first tape, and the coverage says so', async () => {
    const fx = await capturedDay();
    fx.battle.activatedAt = '2026-09-23T22:30:00.000Z'; // 18:30 ET the evening before its session
    fx.battle.chatExchanges.unshift({
      userMessage: 'Trade calmly tomorrow.', agentResponse: 'Noted.', hasDirective: true, directiveThreadId: 'th-0',
      directive: { text: 'Keep swaps rare.', expiry: 'end_of_battle', directiveThreadId: 'th-0', adjustmentId: 'SP-calm', canonicalTextVersion: 1 },
      timestamp: '2026-09-23T23:30:00.000Z', mode: 'battle',
      archetypeGate: { classification: 'in_archetype', selectedAdjustmentId: 'SP-calm', status: 'committed', repairUsed: false, originalUserAsk: 'X', counterOfferText: null, rejectionReason: null },
    });
    const t = world(fx);
    await write(t, fx);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.directives[0]).toMatchObject({ threadId: 'th-0', filedAt: '2026-09-23T23:30:00.000Z', cardState: 'committed', canonicalText: 'Keep swaps rare.', playerText: 'Trade calmly tomorrow.' });
    expect(tape.coverage.directives.note).toMatch(/filed before this ET day/);
  });

  it('L5 S3: on a later trading day the window opens where the previous one closed — a weekend filing lands on Monday\'s tape, never Friday\'s', () => {
    const battle = { activatedAt: '2026-09-25T12:00:00.000Z', timing: { tradingDays: ['2026-09-25', '2026-09-28'] } };
    const fri = directiveWindow({ battle, etDate: '2026-09-25', bounds: etDayBounds('2026-09-25') });
    const mon = directiveWindow({ battle, etDate: '2026-09-28', bounds: etDayBounds('2026-09-28') });
    const saturday = Date.parse('2026-09-26T15:00:00.000Z');
    expect(saturday >= fri.startMs && saturday < fri.endMs).toBe(false);
    expect(saturday >= mon.startMs && saturday < mon.endMs).toBe(true);
    expect(mon.startMs).toBe(fri.endMs); // the windows partition time: every card lands on exactly one tape
  });

  it('L1-F5: a later admitted check known only by its entry is the day\'s last recorded score', async () => {
    const fx = await capturedDay();
    const last = fx.battle.evaluations.at(-1);
    fx.battle.evaluations.push({ ...structuredClone(last), evalId: 'b-captured:e-late', timestamp: '2026-09-24T19:59:50.000Z', promptBuiltAt: '2026-09-24T19:59:42.000Z', scores: { active: 90, banked: 9, total: 99 } });
    const t = world(fx);
    await write(t, fx);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.score.lastCheck).toMatchObject({ at: '2026-09-24T19:59:50.000Z', tickSeq: null, total: 99 });
    expect(tape.score.dayChange).toMatchObject({ value: 99, basis: 'battle_start' });
  });

  it('L1-F7: heard is the EARLIER of the first stamped entry and the first tick control', async () => {
    const fx = await capturedDay();
    fx.battle.evaluations = fx.battle.evaluations.filter((e) => e.evalId !== 'b-captured:e6'); // the first stamped entry is gone
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).directives.find((d) => d.threadId === 'th-1').heard).toEqual({ at: '2026-09-24T14:45:20.000Z', tickSeq: 6, source: 'tick' });
  });

  it('L1-F7 (merge): a re-run never replaces a saved heard stamp with a later one', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).directives[0].heard).toMatchObject({ at: '2026-09-24T14:45:15.000Z', source: 'entry' });
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.evaluations = battle.evaluations.filter((e) => e.evalId !== 'b-captured:e6');
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    const tick6 = t.store.get(`agentBattles/${fx.battleId}/ticks/${fx.battleId}:6`);
    t.store.set(`agentBattles/${fx.battleId}/ticks/${fx.battleId}:6`, { ...tick6, controls: null });
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).directives[0].heard).toMatchObject({ at: '2026-09-24T14:45:15.000Z', source: 'entry' });
  });

  it('L4-F2: a suppressed stamp is never "heard" — on the entry or on the tick', async () => {
    const fx = await capturedDay();
    for (const e of fx.battle.evaluations) if (e.heard) e.heard = { ...e.heard, suppressed: 'mode_not_enforce' };
    fx.ticks = fx.ticks.map((tk) => (tk.controls ? { ...tk, controls: { ...tk.controls, directiveSuppressed: 'mode_not_enforce' } } : tk));
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).directives.find((d) => d.threadId === 'th-1').heard).toBeNull();
  });

  it('L1-Q3: a committed gate with no directive record (OBSERVE mode, a withheld turn) filed nothing', async () => {
    const fx = await capturedDay();
    fx.battle.chatExchanges[0].directive = null;
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).directives[0]).toMatchObject({ cardState: 'not_filed', canonicalText: null, threadId: null });
  });

  it.each(['no_proposal', 'invalid_id'])('L4-F10 d01: gate status %s is a "no change" card', async (status) => {
    const fx = await capturedDay();
    fx.battle.chatExchanges[1].archetypeGate.status = status;
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).directives[1].cardState).toBe('no_change');
  });

  it('L4-F10 d03: a call minted the day before and resolved on the day is on the day\'s tape', async () => {
    const fx = await capturedDay();
    fx.calls[1].stateChangedAt = Date.parse('2026-09-24T15:00:00.000Z');
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).calls.map((c) => c.callId)).toContain('b-captured:old:call:0');
  });

  it('L1-F13: a day no check of which reached the model says so — nothing is missing, so the calls section is complete', async () => {
    const fx = await noTriggerDay();
    fx.battle.evaluations = [];
    // Check 9 is a no-trigger check too, so no check of the day reached the
    // model. (Emptying evaluations[] alone kept tick 9's evalId: a model check
    // with its entry absent — Astra's R14, now F5 in tapeAstraReview.test.js.)
    fx.ticks = fx.ticks.map((tk) => (tk.tickSeq === 9 ? { ...tk, exitReason: 'no_trigger', stageReached: 'trigger_evaluated', evalId: null, decision: null } : tk));
    const t = world(fx);
    await write(t, fx);
    const cov = tapeOf(t, fx.battleId).coverage.calls;
    expect(cov.status).toBe('complete');
    // BA-26's wording: what was observed among the known checks, never a categorical claim about the day
    expect(cov.note).toMatch(/no model check recorded among the 26 known check\(s\)/);
    expect(cov.note).not.toMatch(/reached the model|not being minted/);
    expect(cov.unknownChecks).toBe(0);
  });

  it('L4-F6 m15: a day whose entries carry no declarations phase says so — a fact, so nothing is missing', async () => {
    const fx = await noTriggerDay();
    for (const e of fx.battle.evaluations) delete e.declarationsPhase;
    const t = world(fx);
    await write(t, fx);
    const cov = tapeOf(t, fx.battleId).coverage.calls;
    expect(cov.status).toBe('complete');
    expect(cov.note).toMatch(/no evaluation entry of this day carries a declarations phase/);
  });

  it('L4-F6 m13: entries at the 150 cap with capture incomplete — a heard stamp may be missing, and the directives section says so', async () => {
    const fx = await capturedDay();
    const e0 = fx.battle.evaluations[0];
    const pads = Array.from({ length: 150 - fx.battle.evaluations.length }, (_, i) => ({
      ...e0, evalId: `pad${i}`, heard: null, timestamp: new Date(Date.parse(`${D}T12:00:00.000Z`) + i * 1_000).toISOString(),
    }));
    fx.battle.evaluations = [...pads, ...fx.battle.evaluations];
    const t = world(fx);
    await write(t, fx);
    const doc = tapeOf(t, fx.battleId);
    expect(doc.passes.close.capture).not.toBe('present');
    expect(doc.coverage.directives.status).toBe('partial');
    expect(doc.coverage.directives.note).toMatch(/evaluation entries may be evicted and capture is incomplete — a heard stamp may be missing/);
  });

  it('L1-F12: an evaluator slot with no run record (a killed run) keeps the checks section from claiming complete', async () => {
    const fx = await noTriggerDay();
    const complete = world(fx);
    await write(complete, fx);
    expect(tapeOf(complete, fx.battleId).coverage.checks.status).toBe('complete');
    fx.runs = sessionRuns(D, { skip: ['15:00'] });
    const t = world(fx);
    await write(t, fx);
    const cov = tapeOf(t, fx.battleId).coverage.checks;
    expect(cov.status).toBe('partial');
    expect(cov.note).toMatch(/no run record for 1 evaluator slot\(s\) \(11:00 ET\)/);
  });

  it('L1-Q1: a check whose capture failed but whose entry survives is ONE row — its number stays among the gaps', async () => {
    const fx = await capturedDay();
    fx.ticks = fx.ticks.filter((tk) => tk.tickSeq !== 16); // check 16 (13:30 ET) wrote its entry, lost its tick
    const t = world(fx);
    await write(t, fx);
    const tape = tapeOf(t, fx.battleId);
    const between = tape.checks.filter((c) => c.at > '2026-09-24T17:15:20.000Z' && c.at < '2026-09-24T17:45:20.000Z');
    expect(between).toHaveLength(1);
    expect(between[0]).toMatchObject({ rowSource: 'entry', evalId: 'b-captured:e16', state: 'completed' });
    expect(tape.checks.some((c) => c.state === 'no_record' && c.tickSeq === 16)).toBe(false);
    expect(tape.passes.close.gaps).toEqual([13, 16]);
  });

  it('L1-Q4: a plan\'s time is its entry\'s time (BA-10), and its price is sampled there', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const e11 = fx.battle.evaluations.find((e) => e.evalId === 'b-captured:e11');
    expect(tapeOf(t, fx.battleId).plans.every((p) => p.at === e11.timestamp)).toBe(true);
  });

  it('L1-F10: a check first known by its entry, then by its tick record, is one check — nothing "preserved", and the next identical run writes nothing', async () => {
    const fx = await capturedDay();
    const tick12 = fx.ticks.find((tk) => tk.tickSeq === 12);
    const t = world({ ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== 12) });
    await write(t, fx);
    t.store.set(`agentBattles/${fx.battleId}/ticks/${tick12.tickId}`, tick12); // the late tick record lands
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).coverage.checks.preservedFrom).toBeNull();
    expect((await write(t, fx, NIGHT + 120_000)).status).toBe('unchanged');
  });
});

// ── the close pass lifecycle (L1-F3 / L3-F1, L1-F11, L3-F7, L3-F4) ──────────

describe('the close pass — completions that land after the final day\'s pass', () => {
  async function completion({ tradingDays = [D], completedAt }) {
    const fx = await noTriggerDay({ battleId: 'b-life' });
    fx.battle.timing = { tradingDays, currentTradingDay: 1, timezone: 'America/New_York' };
    if (tradingDays[0] !== D) { fx.ticks = []; fx.battle.evaluations = []; fx.runs = []; }
    const t = world(fx);
    const finalDay = tradingDays.at(-1);
    const night = Date.parse(`${finalDay}T23:59:00.000Z`) + 2 * 3600_000 + 16 * 60_000; // 02:15 UTC after the final day
    const s0 = await runClosePass({ db: t.db, clock: () => night });
    expect(s0.written.map((w) => w.battleId)).toEqual(['b-life']);
    const battle = t.store.get('agentBattles/b-life');
    Object.assign(battle, { status: 'completed', completedAt, scoreState: { ...battle.scoreState, currentScore: 41, opponentScore: 30 } });
    t.store.set('agentBattles/b-life', battle);
    return { t, finalDay };
  }
  const passAt = (t, iso) => runClosePass({ db: t.db, clock: () => Date.parse(iso) });

  it('a holiday completion (the evaluator\'s sweep runs on Thanksgiving) reaches the final-day tape on the next session\'s pass', async () => {
    const { t, finalDay } = await completion({ tradingDays: ['2026-11-25'], completedAt: '2026-11-26T13:00:30.000Z' });
    expect(await passAt(t, '2026-11-27T02:15:30.000Z')).toEqual({ skipped: true, reason: 'not_a_trading_day', etDate: '2026-11-26' });
    await passAt(t, '2026-11-28T02:15:30.000Z'); // Friday 11-27 (early close) pass
    expect(tapeOf(t, 'b-life', finalDay).battle).toMatchObject({ status: 'completed', completedAt: '2026-11-26T13:00:30.000Z', final: { total: 41, opponent: 30 } });
  });

  it('a weekend completion (decide marks the old battle complete on a redeploy) is taped on Monday\'s pass', async () => {
    const { t } = await completion({ completedAt: '2026-09-26T16:00:00.000Z' });
    await passAt(t, '2026-09-29T02:15:30.000Z');
    expect(tapeOf(t, 'b-life').battle.status).toBe('completed');
  });

  it('a completion after that night\'s pass ran is taped on the next session\'s pass', async () => {
    const { t } = await completion({ completedAt: '2026-09-25T03:30:00.000Z' }); // Thu 23:30 EDT
    await passAt(t, '2026-09-26T02:15:30.000Z');
    expect(tapeOf(t, 'b-life').battle.status).toBe('completed');
  });

  it('an already-recorded completion is skipped on one document read — none of the day\'s sources are read again', async () => {
    const { t } = await completion({ completedAt: '2026-09-26T16:00:00.000Z' });
    await passAt(t, '2026-09-29T02:15:30.000Z');
    const reads = t.readLog.length;
    const s = await passAt(t, '2026-09-29T02:15:30.000Z');
    expect(s.unchanged).toContain('b-life');
    expect(t.readLog.slice(reads).some((r) => String(r).includes('b-life/ticks'))).toBe(false);
  });

  it('the backfill re-merges a completed battle\'s final day whose tape was written before the completion', async () => {
    const { t } = await completion({ completedAt: '2026-09-26T16:00:00.000Z' });
    const s = await runBackfill({ db: t.db, clock: () => Date.parse('2026-10-01T15:00:00.000Z'), dates: [D] });
    expect(s.written.map((w) => w.battleId)).toEqual(['b-life']);
    expect(tapeOf(t, 'b-life').battle.status).toBe('completed');
    const again = await runBackfill({ db: t.db, clock: () => Date.parse('2026-10-01T15:05:00.000Z'), dates: [D] });
    expect(again.alreadyDone.map((x) => x.battleId)).toEqual(['b-life']);
  });

  it('L1-F11: the close pass never tapes a session in progress', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    expect(await runClosePass({ db: t.db, clock: () => Date.parse('2026-09-24T15:00:00.000Z') })).toEqual({ skipped: true, reason: 'session_not_closed', etDate: D });
    expect(t.writeLog).toEqual([]);
  });

  it('L3-F7: outside the maintained calendar every pass fails loudly — calendar_missing, never a quiet "no session"', async () => {
    const t = makeTapeDb({});
    expect(await runClosePass({ db: t.db, clock: () => Date.parse('2028-01-05T02:15:30.000Z') })).toEqual({ skipped: true, reason: 'calendar_missing', etDate: '2028-01-04' });
    expect(await runCandlePass({ db: t.db, fetchCandles: async () => [], clock: () => Date.parse('2028-01-05T11:00:30.000Z') })).toMatchObject({ skipped: true, reason: 'calendar_missing' });
    expect(parseBackfillRange('2027-12-28..2028-01-04')).toEqual({ error: 'calendar_missing' });
    expect(t.readLog).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
  });

  it('L3-F4: every pass refuses with the writer flag off — before any read', async () => {
    flags.writer = false;
    const fx = await capturedDay();
    const t = world(fx);
    await expect(runCandlePass({ db: t.db, fetchCandles: async () => [], clock: () => MORNING })).rejects.toThrow('film_tape_write_disabled');
    await expect(runClosePass({ db: t.db, clock: () => NIGHT })).rejects.toThrow('film_tape_write_disabled');
    await expect(runBackfill({ db: t.db, clock: () => NIGHT, dates: [D] })).rejects.toThrow('film_tape_write_disabled');
    expect(t.readLog).toEqual([]);
    expect(t.writeLog).toEqual([]);
  });
});

// ── the candle pass (lens L2) ───────────────────────────────────────────────

describe('L2 — the candle pass never loses what it saved', () => {
  it('L2-F1: an outage on the retry morning keeps morning 1\'s replays, prices, series and coverage', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ XLP: new Error('down') }));
    const m1 = structuredClone(tapeOf(t, fx.battleId));
    const series1 = [...t.store.keys()].filter((k) => k.startsWith(`${tapePath(fx.battleId)}/series/`)).sort();
    expect(m1.passes.candles).toMatchObject({ status: 'partial', attempts: 1, symbolsMissing: ['XLP'] });
    expect(m1.actions.every((a) => a.replay && a.replay.gapPoints !== null)).toBe(true);
    const outage = Object.fromEntries(Object.keys(PRICES).map((s) => [s, new Error('outage')]));
    await morning(t, outage, MORNING + DAY);
    const m2 = tapeOf(t, fx.battleId);
    // BA-36: the kept units hold morning 1's facts, and each says it was kept (preservedFrom)
    const facts = (u) => ({ ...u, preservedFrom: undefined });
    expect(m2.actions.map((a) => facts(a.replay))).toEqual(m1.actions.map((a) => a.replay));
    expect(m2.plans.map((p) => facts(p.price))).toEqual(m1.plans.map((p) => p.price));
    for (const u of [...m2.actions.map((a) => a.replay), ...m2.plans.map((p) => p.price)]) expect(u.preservedFrom).toBe(m1.passes.candles.writtenAt);
    expect(m2.passes.candles).toMatchObject({ status: 'partial', attempts: 2, symbolsMissing: ['XLP'] });
    expect(m2.coverage.replay.status).toBe(m1.coverage.replay.status);
    expect([...t.store.keys()].filter((k) => k.startsWith(`${tapePath(fx.battleId)}/series/`)).sort()).toEqual(series1);
  });

  it('L2-F1: a success on a later morning completes it — written, nothing missing', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ XLP: new Error('down') }));
    await morning(t, allBars(), MORNING + DAY);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'written', attempts: 2, symbolsMissing: [] });
  });

  it('L2-F3a / L1-F6: a re-run whose receipts are gone keeps the saved replay inputs whole', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const before = structuredClone(tapeOf(t, fx.battleId).actions.map((a) => a.replayInputs));
    expect(before.every((ri) => ri.ghost && ri.bought)).toBe(true);
    for (const k of [...t.store.keys()].filter((key) => key.startsWith('learningReceipts/'))) t.store.delete(k);
    await write(t, fx, NIGHT + 60_000);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.actions.map((a) => a.replayInputs)).toEqual(before);
    expect(tape.actions.every((a) => a.receiptMatched && a.replayMissing.length === 0)).toBe(true);
    expect(tape.coverage.actions.preservedFrom).not.toBeNull();
  });

  it('L2-F3b: inputs that became complete on a re-run re-queue the candle pass', async () => {
    const fx = await capturedDay();
    const t = world({ ...fx, receipts: [] });
    await write(t, fx);
    await morning(t);
    expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
    for (const r of fx.receipts) t.store.set(`learningReceipts/${fx.battleId}/receipts/${AGENT}_seq${r.receiptSeq}`, r);
    await write(t, fx, MORNING + 3_600_000);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'pending', reason: 'sources_changed', attempts: 0 });
  });

  it('L4-F10 o03: a plan added after the candle pass re-queues it', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.evaluations.find((e) => e.evalId === 'b-captured:e11').candidates.push({ symbol: 'SNOW', direction: 'potential_entry', signalSummary: 'Watching', threshold: 'Above 185.' });
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, MORNING + 3_600_000);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'pending', reason: 'sources_changed', attempts: 0 });
  });

  it('L2-F5 / L4-F10 o02: outside the candle window, an action added later is stated as not replayed — never a stale "written"', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades.push({ ...battle.trades[1], symbolOut: 'PEP', symbolIn: 'COST', slotIndex: 0, tier: 'support', entryPrice: 170, exitPrice: 171, lockedPoints: 0.6, lockedGainPct: 0.588, swappedOutAt: '2026-09-24T18:00:10.000Z' });
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, Date.parse('2026-10-26T02:15:30.000Z')); // a month on: no candle pass comes back
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.candles).toMatchObject({ status: 'partial', reason: 'sources_changed_outside_window' });
    expect(tape.coverage.replay.status).toBe('partial');
    expect(tape.coverage.replay.note).toMatch(/outside its retry window/);
  });

  it('L2-F6: one failed close-out marker never costs the morning — the other tapes are processed', async () => {
    const fx = await capturedDay();
    // The aged tape's writes fail on its PATH: since review F1 the candle pass
    // builds every reference from the validated ids, never the query's own.
    const t = makeTapeDb(seedDay({}, fx), {
      hooks: { beforeWrite: (op, path) => { if (path === 'agentBattles/b-aged/tape/2026-09-09') throw new Error('14 UNAVAILABLE'); } },
    });
    await write(t, fx);
    const aged = { ...structuredClone(tapeOf(t, fx.battleId)), battleId: 'b-aged', etDate: '2026-09-09' };
    t.store.set('agentBattles/b-aged/tape/2026-09-09', aged);
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(s.failed.map((f) => f.path)).toContain('agentBattles/b-aged/tape/2026-09-09');
    expect(s.written.map((w) => w.path)).toEqual([tapePath(fx.battleId)]);
  });

  it('L2-F4: a thrown attempt is counted from the tape as it stands — a close-pass re-queue landing mid-run is not overwritten as terminal', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    // two earlier failed mornings: attempts 2
    const tp = tapePath(fx.battleId);
    t.store.set(tp, { ...tapeOf(t, fx.battleId), passes: { ...tapeOf(t, fx.battleId).passes, candles: { ...tapeOf(t, fx.battleId).passes.candles, status: 'failed', attempts: 2, reason: 'fetch_failed' } } });
    const fetchCandles = async () => {
      // mid-run: the close pass re-queues it (sources changed), then this attempt throws
      const cur = t.store.get(tp);
      t.store.set(tp, { ...cur, passes: { ...cur.passes, candles: { ...cur.passes.candles, status: 'pending', attempts: 0, reason: 'sources_changed' } } });
      throw new Error('boom');
    };
    t.db.failNextTransactions(1);
    await runCandlePass({ db: t.db, fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(t.store.get(tp).passes.candles).toMatchObject({ status: 'failed', attempts: 1 });
    expect(t.store.get(tp).passes.candles.reason).not.toBe('attempts_exhausted');
  });

  it('L4-F10 o01: oldest first — with the floor reached after one tape, the newer one waits', async () => {
    const m = await multiDay();
    const t = world(m);
    await write(t, { ...m, etDate: '2026-09-22' }, Date.parse('2026-09-23T02:15:30.000Z'), '2026-09-22');
    await write(t, { ...m, etDate: '2026-09-23' }, Date.parse('2026-09-24T02:15:30.000Z'), '2026-09-23');
    let now = MORNING;
    const start = now;
    const s = await runCandlePass({
      db: t.db,
      fetchCandles: async (symbol, opts) => { now = start + 280_000; return fetcherOf(allBars({}, ['2026-09-22', '2026-09-23'])).fetchCandles(symbol, opts); },
      clock: () => now, startMs: start,
    });
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-multi', '2026-09-22')]);
    expect(s.notReached).toEqual([tapePath('b-multi', '2026-09-23')]);
  });

  it('L4-F3: a later trade in the same slot counts, and the read-out marks both continued lines hypothetical', async () => {
    const fx = await capturedDay();
    fx.battle.trades.push({ ...fx.battle.trades[0], symbolOut: 'TSLA', symbolIn: 'COST', entryPrice: 240, exitPrice: 245, lockedPoints: 3, lockedGainPct: 2.083, swappedOutAt: '2026-09-24T18:00:10.000Z', source: 'haiku', exitReason: 'haiku_decision' });
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const tape = tapeOf(t, fx.battleId);
    const first = tape.actions.find((a) => a.symbolOut === 'AMD');
    expect(first.subsequentTradesInSlot).toBe(1);
    expect(first.replay.subsequentTradesInSlot).toBe(1);
    expect(formatTapeMarkdown(tape, [])).toContain('later trades in this slot (1 (derived)): both continued lines are hypothetical');
  });
});

// ── merge rules the build's suites could not fail on (L4-F5) ────────────────

describe('L4-F5 — the merge keeps facts a later read lost', () => {
  it('m02: the day change keeps its reference when the prior day\'s tape cannot be read on a re-run', async () => {
    const m = await multiDay();
    const t = world(m);
    await write(t, { ...m, etDate: '2026-09-21' }, Date.parse('2026-09-22T02:15:30.000Z'), '2026-09-21');
    await write(t, { ...m, etDate: '2026-09-22' }, Date.parse('2026-09-23T02:15:30.000Z'), '2026-09-22');
    const before = tapeOf(t, 'b-multi', '2026-09-22').score.dayChange;
    expect(before.basis).toBe('prior_day_tape');
    t.store.delete(tapePath('b-multi', '2026-09-21'));
    await write(t, { ...m, etDate: '2026-09-22' }, Date.parse('2026-09-23T03:00:00.000Z'), '2026-09-22');
    expect(tapeOf(t, 'b-multi', '2026-09-22').score.dayChange).toEqual(before);
  });

  it('L5 M42a: the last check keeps the later instant when a re-run cannot see that check', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    const before = tapeOf(t, fx.battleId).score.lastCheck;
    const last = fx.ticks[fx.ticks.length - 1].tickSeq;
    expect(before.tickSeq).toBe(last);
    t.store.delete(`agentBattles/${fx.battleId}/ticks/${fx.battleId}:${last}`);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).score.lastCheck).toEqual(before);
  });

  it('L5 M42a (first check): the first check keeps the earlier instant when a re-run cannot see that check', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    const before = tapeOf(t, fx.battleId).score.firstCheck;
    expect(before.tickSeq).toBe(1);
    t.store.delete(`agentBattles/${fx.battleId}/ticks/${fx.battleId}:1`);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).score.firstCheck).toEqual(before);
  });

  it('m04: a stored result is not replaced by a derived one', async () => {
    const fx = await completedDay();
    fx.battle.result = 'win';
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).battle.result).toEqual({ value: 'win', basis: 'stored' });
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    delete battle.result;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).battle.result).toEqual({ value: 'win', basis: 'stored' });
  });

  it('m05: intraday views seen once stay "present"', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    t.store.set(`agentBattles/${fx.battleId}/intradayViews/v1`, { evaluatedAt: Date.parse('2026-09-24T15:00:00.000Z') });
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).diagnostics.intradayViews).toBe('present');
    t.store.delete(`agentBattles/${fx.battleId}/intradayViews/v1`);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).diagnostics.intradayViews).toBe('present');
  });

  it('m06: a truncated deferral list stays recorded when the run records are gone on a re-run', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).passes.close.deferralsTruncated).toBe(true);
    for (const k of [...t.store.keys()].filter((key) => key.startsWith('agentEvalRuns/'))) t.store.delete(k);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).passes.close.deferralsTruncated).toBe(true);
  });

  it('m07: a sector seen once stays among the comparables', async () => {
    const fx = await capturedDay();
    fx.battle.evaluations.find((e) => e.evalId === 'b-captured:e11').candidates.push({ symbol: 'SNOW', direction: 'potential_entry', signalSummary: 'Watching', threshold: 'Above 185.' });
    const t = world(fx);
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).comparables.sectors.SNOW).toBe('XLK');
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.evaluations = battle.evaluations.filter((e) => e.evalId !== 'b-captured:e11');
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).comparables.sectors.SNOW).toBe('XLK');
  });

  it('m10: a section\'s span never shrinks', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const span = tapeOf(t, fx.battleId).coverage.checks.span;
    for (const s of [1, 2, 3]) t.store.delete(`agentBattles/${fx.battleId}/ticks/${fx.battleId}:${s}`);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).coverage.checks.span.from).toBe(span.from);
  });

  it('L5 S2: a section\'s span end never moves earlier', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    const span = tapeOf(t, fx.battleId).coverage.checks.span;
    const last = fx.ticks[fx.ticks.length - 1].tickSeq;
    t.store.delete(`agentBattles/${fx.battleId}/ticks/${fx.battleId}:${last}`);
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).coverage.checks.span.to).toBe(span.to);
  });
});

// ── coverage reasons the build's suites could not fail on (L4-F6) ────────────

describe('L4-F6 — every BA-20 reason lowers its section', () => {
  async function assembled(mutate) {
    const fx = await capturedDay();
    const inputs = {
      battle: { ...fx.battle, id: fx.battleId }, etDate: D, bounds: etDayBounds(D), nowMs: NIGHT,
      ticksRead: { ticks: fx.ticks, prevSeq: null, nextSeq: null, method: 'range' },
      runsRead: { ok: true, runs: fx.runs },
      receiptsRead: { ok: true, receipts: fx.receipts },
      callsRead: { ok: true, calls: fx.calls },
      declarationsRead: { ok: true, present: new Set(fx.declarations) },
    };
    mutate(inputs, fx);
    return assembleTape(inputs);
  }

  it('C2: run records unreadable → checks partial, and says why', async () => {
    const tape = await assembled((i) => { i.runsRead = { ok: false, error: 'boom', runs: [] }; });
    expect(tape.coverage.checks.status).toBe('partial');
    expect(tape.coverage.checks.note).toMatch(/run records unreadable \(boom\)/);
  });

  it('C3: learning receipts unreadable → actions not complete, and says why', async () => {
    const tape = await assembled((i) => { i.receiptsRead = { ok: false, error: 'boom', receipts: [] }; });
    expect(tape.coverage.actions.status).not.toBe('complete');
    expect(tape.coverage.actions.note).toMatch(/learning receipts unreadable/);
  });

  it('C4: an expected declarations record that is absent → calls partial', async () => {
    const tape = await assembled((i) => { i.declarationsRead = { ok: true, present: new Set() }; });
    expect(tape.coverage.calls.status).toBe('partial');
    expect(tape.coverage.calls.note).toMatch(/expected a declarations record that is absent/);
  });

  it('C5: a tick naming an evalId whose entry is absent → plans, rationale and evidence partial', async () => {
    const tape = await assembled((i) => { i.battle = { ...i.battle, evaluations: i.battle.evaluations.filter((e) => e.evalId !== 'b-captured:e5') }; });
    for (const s of ['plans', 'rationale', 'evidence']) {
      expect(tape.coverage[s].status, s).toBe('partial');
      expect(tape.coverage[s].note, s).toMatch(/evalId whose evaluation entry is absent/);
    }
  });

  it('C6: capture incomplete with trades[] at its 50 cap → actions partial (a swap on an unrecorded check may be missing)', async () => {
    const tape = await assembled((i) => {
      const pad = Array.from({ length: 48 }, (_, n) => ({ ...i.battle.trades[0], symbolOut: `PAD${n}`, symbolIn: `PADIN${n}`, swappedOutAt: new Date(Date.parse('2026-09-24T13:00:00.000Z') + n * 1000).toISOString() }));
      i.battle = { ...i.battle, trades: [...pad, ...i.battle.trades] };
    });
    expect(tape.coverage.actions.status).toBe('partial');
    expect(tape.coverage.actions.note).toMatch(/50-entry cap/);
  });
});
