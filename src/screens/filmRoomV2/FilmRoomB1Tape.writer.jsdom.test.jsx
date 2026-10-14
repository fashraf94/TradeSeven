// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomB1Tape.writer.jsdom.test.jsx
//
// Film Room B1 exit criterion 6 — THE LIVE v2 SCREEN ON A B1-WRITTEN TAPE.
// The Sep-23 day goes through the REAL close and candle passes with the B1
// inputs present: an archetype the registry knows (so `tags` carries items),
// the CPU opponent (T1 copies it at every check) and a rejected gameplan
// meeting whose leg names a symbol the day held nowhere else (T2: the
// meeting is on the tape; the candle pass gives the leg its bars).
//
//   · NEW FIELDS ARE UNRENDERED: the whole screen at Glance and Study — and the
//     Deep dive with the same symbol open — is the same HTML, byte for byte
//     (React's useId values renumbered), with the B1 fields stripped from the tape.
//   · THE VISIBLE CONSEQUENCES, stated: the leg's new series document is a
//     day series like any other, so the Deep dive's symbol picker offers it,
//     as "price series", its numbers marked as market data (the export lists it
//     too); and a leg with no bars is named in the series coverage line's note,
//     the section's status untouched (best effort, candlePass.js processTape).
//   · A battle with no opponent (basis none), completed: its result reads
//     unavailable with its reason, and every sweep is clean (review C-1).
//     One that STORES a draw too — a fresh write, a pre-T1 tape refreshed and
//     a kept completed block (Astra F1): nothing reads "Draw" in the screen's
//     own voice; the platform's completion message is still quoted as its words.
//   · Every sweep (numbers and their classes, words, signs, quotations, stored
//     notes) is clean at every depth, the leg's series open included.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2';
import { sep23Day, sep23Bars, buildTapeDay, SEP23, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { sessionRows } from '../../../api/_utils/filmTape/__fixtures__/tapeBars.js';
import { writeTapeDay } from '../../../api/_utils/filmTape/writeTapeDay.js';
import { makeTapeDb } from '../../../api/_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay } from '../../../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { NO_OPPONENT_NOTE } from '../../../api/_utils/filmTape/tapeAssemble.js';
import {
  mounter, battleOf, readersOf, NOW, sweepNumbers, sweepWords, sweepSigns, quoteDefects, storedNoteDefects,
} from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const m = mounter();
beforeEach(() => { globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

const DIAGNOSIS = 'Technology sector dragging performance (2.1% loss, 40% of total negative P&L).';
/** The battle's book and bench as the server wrote them (review RF-1: a leg names one of these or none). */
const ROSTER23 = Object.freeze({ star: [{ symbol: 'INTC' }], core: [], support: [], bench: { stocks: [{ symbol: 'ORCL' }], crypto: null } });
let b1;
beforeAll(async () => {
  const fx = await sep23Day({ battleId: 'b-sep23-b1' });
  fx.battle.agentContext = { ...fx.battle.agentContext, archetype: 'momentum_chaser' };
  fx.battle.portfolio = { ...fx.battle.portfolio, ...ROSTER23 };
  fx.battle.gameplanMeetingHistory = [{
    id: 'gpm_b1', createdAt: `${SEP23}T17:20:00.000Z`, diagnosis: DIAGNOSIS, opportunity: 'Industrials has momentum.',
    proposedAction: 'rotate_sector', fromSector: 'Technology', toSectors: ['Technology'],
    suggestedSwaps: [{ symbolOut: 'INTC', symbolIn: 'ORCL', rationale: 'INTC down 2.1%, ORCL (Technology) has tech score 74.' }],
    status: 'rejected', expiresAt: `${SEP23}T20:00:00.000Z`, resolvedAt: `${SEP23}T17:31:00.000Z`, resolvedBy: 'coach',
  }];
  const bars = { ...sep23Bars(), ORCL: sessionRows(SEP23, (i) => Math.round(181.2 * (1 + 0.001 * Math.sin(i / 29)) * 100) / 100, { volume: 1500 }) };
  // W3: one INTC minute (09:33 ET; rows[0] is pre-market) arrives without its volume
  bars.INTC = bars.INTC.map((r, i) => (i === 4 ? { ...r, volume: null } : r));
  b1 = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars });
});

/** The tape with every B1 addition removed — what the A2 writer would have stored for the same day. */
function stripB1(tape) {
  const t = structuredClone(tape);
  delete t.tags; delete t.meetings;
  delete t.coverage.tags; delete t.coverage.meetings;
  delete t.score.opponentBasis;
  for (const c of t.checks) if (c.scores) delete c.scores.opponent;
  for (const k of Object.keys(t.numberClasses)) if (k.startsWith('tags.') || k === 'checks[].scores.opponent') delete t.numberClasses[k];
  return t;
}
/** React 19's useId values come from a process-wide counter: renumber by first appearance before comparing. */
function normalized(html) {
  const ids = {};
  let n = 0;
  return html.replace(/_r_[0-9a-z]+_/g, (id) => { if (!(id in ids)) { ids[id] = `_r_${n}_`; n += 1; } return ids[id]; });
}
async function openAt(tape, series, label, sym = null) {
  m.teardown(); m.setup(); globalThis.localStorage.clear();
  m.render(<FilmRoomScreenV2 battle={battleOf(tape)} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [tape.etDate]: tape }, series)} nowMs={NOW} />);
  await m.flush();
  m.click(m.tab(label)); await m.flush();
  if (sym) { m.click(m.qa('[data-region="symbol-picker"] button').find((x) => x.textContent === sym)); await m.flush(); }
  return normalized(m.container.innerHTML);
}
const pickerSymbols = () => m.qa('[data-region="symbol-picker"] button').map((b) => b.textContent);

describe('the B1-written tape carries the additions (the precondition of every row below)', () => {
  it('tags with items, the opponent at every tick-backed check, the meeting, and the leg\'s series as `meeting`', () => {
    expect(b1.tape.tags.items.length).toBeGreaterThan(0);
    expect(b1.tape.score.opponentBasis).toBe('cpu_portfolio');
    expect(b1.tape.checks.filter((c) => c.rowSource === 'tick').every((c) => typeof c.scores.opponent === 'number')).toBe(true);
    expect(b1.tape.meetings.map((x) => [x.status, x.legs])).toEqual([['rejected', [{ symbolOut: 'INTC', symbolIn: 'ORCL' }]]]);
    expect(b1.series.find((s) => s.symbol === 'ORCL')).toMatchObject({ role: 'meeting' });
    expect(b1.tape.passes.candles.status).toBe('written');
  });
});

describe('new fields are unrendered — the screen is the same HTML with them stripped', () => {
  it.each(['Glance', 'Study'])('%s: byte for byte', async (label) => {
    const series = b1.series;
    const withB1 = await openAt(b1.tape, series, label);
    const without = await openAt(stripB1(b1.tape), series, label);
    expect(withB1.length).toBeGreaterThan(5000);
    expect(withB1).toBe(without);
    expect(withB1).not.toContain(DIAGNOSIS);
    expect(withB1).not.toContain('stalled');
  });

  it('Deep dive, the same symbol open: byte for byte with the leg\'s series in both — the tape\'s new fields move nothing', async () => {
    const withB1 = await openAt(b1.tape, b1.series, 'Deep dive', 'INTC');
    const without = await openAt(stripB1(b1.tape), b1.series, 'Deep dive', 'INTC');
    expect(withB1).toBe(without);
  });
});

describe('THE ONE VISIBLE CONSEQUENCE: the leg\'s new series is offered in the Deep dive, as a price series', () => {
  it('the picker gains ORCL — and only ORCL — against the same day without the meeting\'s series', async () => {
    await openAt(b1.tape, b1.series, 'Deep dive');
    const offered = pickerSymbols();
    await openAt(b1.tape, b1.series.filter((s) => s.symbol !== 'ORCL'), 'Deep dive');
    const before = pickerSymbols();
    expect(offered.filter((s) => !before.includes(s))).toEqual(['ORCL']);
    expect(before.filter((s) => !offered.includes(s))).toEqual([]);
  });

  it('opened, it reads "price series" and its numbers carry the market marker', async () => {
    await openAt(b1.tape, b1.series, 'Deep dive', 'ORCL');
    expect(m.container.textContent).toContain('price series');
    expect(m.container.textContent).not.toContain(DIAGNOSIS);
  });
});

describe('W3 on the screen: a bucket whose volume is missing stays missing', () => {
  it('the stored INTC series holds the null; the Deep dive draws no volume bar for it and withholds the session total — never a 0', async () => {
    const intc = b1.series.find((s) => s.symbol === 'INTC');
    expect(intc.bars[0].v).toBeNull();
    expect(intc.bars.slice(1).every((b) => typeof b.v === 'number')).toBe(true);
    await openAt(b1.tape, b1.series, 'Deep dive', 'INTC');
    expect(m.qa('[data-volume-bar]')).toHaveLength(intc.bars.length - 1);
    expect(m.qa('[data-volume-bar="0"]')).toEqual([]);
    expect(m.container.textContent).not.toContain('Volume · session');
    // the control: a symbol whose every bucket has its volume shows the total
    await openAt(b1.tape, b1.series, 'Deep dive', 'AMD');
    expect(m.container.textContent).toContain('Volume · session');
  });
});

describe('every sweep is clean at every depth, on the B1-written tape (A2\'s criteria)', () => {
  const CASES = [['Glance', null], ['Study', null], ['Deep dive', 'INTC'], ['Deep dive', 'ORCL']];
  it.each(CASES)('%s %s', async (label, sym) => {
    await openAt(b1.tape, b1.series, label, sym);
    const docs = { tape: b1.tape, battle: battleOf(b1.tape), ...Object.fromEntries(b1.series.map((s) => [`series:${s.symbol}`, s])) };
    const where = `${label} ${sym ?? ''}`;
    expect(sweepNumbers(m.container, docs), where).toEqual([]);
    expect(sweepWords(m.container, docs), where).toEqual([]);
    expect(sweepSigns(m.container), where).toEqual([]);
    expect(quoteDefects(m.container, docs), where).toEqual([]);
    expect(storedNoteDefects(m.container, docs), where).toEqual([]);
  });
});

describe('review C-1 — a completed battle with no opponent (basis none), on the screen', () => {
  let none;
  beforeAll(async () => {
    const fx = await sep23Day({ battleId: 'b-sep23-none' });
    fx.battle.opponent = null;
    fx.battle.scoreState = { ...fx.battle.scoreState, opponentScore: 0 };
    for (const tk of fx.ticks) if (tk.scores) tk.scores.opponent = 0;
    none = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() });
  });

  it('the tape: no opponent number anywhere, the result unavailable with its reason', () => {
    expect(none.tape.score.opponentBasis).toBe('none');
    expect(none.tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: 'no opponent: the battle was created without a CPU opponent' });
    expect(none.tape.battle.final.opponent).toBeNull();
  });

  it.each(['Glance', 'Study', 'Deep dive'])('%s: the reason is shown, and every sweep is clean', async (label) => {
    await openAt(none.tape, none.series, label);
    if (label === 'Glance') expect(m.container.textContent).toContain('no opponent: the battle was created without a CPU opponent');
    const docs = { tape: none.tape, battle: battleOf(none.tape), ...Object.fromEntries(none.series.map((s) => [`series:${s.symbol}`, s])) };
    expect(sweepNumbers(m.container, docs), label).toEqual([]);
    expect(sweepWords(m.container, docs), label).toEqual([]);
    expect(sweepSigns(m.container), label).toEqual([]);
    expect(quoteDefects(m.container, docs), label).toEqual([]);
    expect(storedNoteDefects(m.container, docs), label).toEqual([]);
  });
});

describe('review RF-1 — a leg symbol outside the battle\'s portfolio and bench never reaches the screen', () => {
  const PLANTED = ['BEST', 'GRADE', 'ONE'];
  let planted;
  beforeAll(async () => {
    const fx = await sep23Day({ battleId: 'b-sep23-rf1' });
    fx.battle.agentContext = { ...fx.battle.agentContext, archetype: 'momentum_chaser' };
    fx.battle.portfolio = { ...fx.battle.portfolio, ...ROSTER23 };
    fx.battle.gameplanMeetingHistory = [{
      id: 'gpm_rf1', createdAt: `${SEP23}T17:20:00.000Z`, diagnosis: DIAGNOSIS, status: 'rejected', resolvedBy: 'coach',
      suggestedSwaps: [{ symbolOut: 'INTC', symbolIn: 'BEST', rationale: 'r' }, { symbolOut: 'GRADE', symbolIn: 'ONE', rationale: 'r' }],
      expiresAt: `${SEP23}T20:00:00.000Z`, resolvedAt: `${SEP23}T17:31:00.000Z`,
    }];
    // every planted name HAS bars, so only the roster keeps it off the tape and the screen
    const flat = (p) => sessionRows(SEP23, () => p, { volume: 1000 });
    planted = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: { ...sep23Bars(), BEST: flat(50), GRADE: flat(20), ONE: flat(10) } });
  });

  it('the tape: the planted symbols are null and counted, and no series is written for them', () => {
    expect(planted.tape.meetings[0].legs).toEqual([{ symbolOut: 'INTC', symbolIn: null }, { symbolOut: null, symbolIn: null }]);
    expect(planted.tape.coverage.meetings).toMatchObject({ status: 'partial', note: "3 leg symbols outside the battle's portfolio and bench not copied" });
    expect(planted.series.map((s) => s.symbol).filter((s) => PLANTED.includes(s))).toEqual([]);
  });

  it.each(['Glance', 'Study', 'Deep dive'])('%s: the picker offers none of them, and every sweep is clean', async (label) => {
    await openAt(planted.tape, planted.series, label);
    if (label === 'Deep dive') expect(pickerSymbols().filter((s) => PLANTED.includes(s))).toEqual([]);
    const docs = { tape: planted.tape, battle: battleOf(planted.tape), ...Object.fromEntries(planted.series.map((s) => [`series:${s.symbol}`, s])) };
    expect(sweepNumbers(m.container, docs), label).toEqual([]);
    expect(sweepWords(m.container, docs), label).toEqual([]);
    expect(sweepSigns(m.container), label).toEqual([]);
    expect(quoteDefects(m.container, docs), label).toEqual([]);
    expect(storedNoteDefects(m.container, docs), label).toEqual([]);
  });
});

describe('Astra F1 — a completed battle with no opponent that STORES a draw: on the screen nothing reads "Draw"', () => {
  const FEED_TEXT = 'Battle complete. Result: Draw.';
  const tapes = {};
  let series;
  /** The stored draw over a fresh write, a pre-T1 tape refreshed, and a kept completed block refreshed — the real writer each time. */
  beforeAll(async () => {
    const fx = await sep23Day({ battleId: 'b-sep23-f1' });
    fx.battle.opponent = null;
    fx.battle.result = 'draw';
    fx.battle.scoreState = { ...fx.battle.scoreState, opponentScore: 0 };
    fx.battle.statusFeed = [{ action: 'battle_complete', message: FEED_TEXT, timestamp: fx.battle.completedAt }];
    for (const tk of fx.ticks) if (tk.scores) tk.scores.opponent = 0;
    const fresh = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() });
    tapes.fresh = fresh.tape;
    series = fresh.series;
    const refresh = async (old) => {
      const t = makeTapeDb(seedDay({}, fx));
      const where = `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
      t.store.set(where, old);
      await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT + 60_000 });
      return t.store.get(where);
    };
    // as the A1 writer left it: no basis, the 0s copied, the stored draw
    const preT1 = structuredClone(fresh.tape);
    delete preT1.score.opponentBasis;
    if (preT1.score.lastCheck) preT1.score.lastCheck.opponent = 0;
    preT1.battle.final.opponent = 0;
    preT1.battle.result = { value: 'draw', basis: 'stored' };
    for (const c of preT1.checks) if (c.scores) delete c.scores.opponent;
    tapes.preT1 = await refresh(preT1);
    // as the B1 head wrote it: basis none, the final opponent null, the stored draw — the block is kept (BA-27)
    const kept = structuredClone(fresh.tape);
    kept.battle.result = { value: 'draw', basis: 'stored' };
    tapes.kept = await refresh(kept);
  });

  it.each(['fresh', 'preT1', 'kept'])('the %s tape: the result unavailable with the no-opponent note; the platform\'s words kept', (which) => {
    expect(tapes[which].battle.result).toEqual({ value: null, basis: 'unavailable', note: NO_OPPONENT_NOTE });
    expect(tapes[which].battle.completionMessage?.text).toBe(FEED_TEXT);
  });

  const CASES = ['fresh', 'preT1', 'kept'].flatMap((which) => ['Glance', 'Study', 'Deep dive'].map((label) => [which, label]));
  it.each(CASES)('%s, %s: no "Draw" in the screen\'s own voice; the completion message quoted as the platform\'s; every sweep clean', async (which, label) => {
    const tape = tapes[which];
    await openAt(tape, series, label);
    expect(m.qa('[data-result="draw"]')).toEqual([]);
    // the screen's own words: every text node outside a quotation of the tape
    const walk = document.createTreeWalker(m.container, NodeFilter.SHOW_TEXT);
    const own = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement?.closest('[data-quote-path]')) own.push(n.textContent);
    expect(own.join(' ')).not.toMatch(/\bdraw\b/i);
    if (label === 'Glance') {
      expect(m.qa('[data-result="unavailable"]')).toHaveLength(1);
      expect(m.container.textContent).toContain(NO_OPPONENT_NOTE);
      expect(m.q('[data-quote-path="battle.completionMessage.text"]').textContent).toBe(FEED_TEXT);
    }
    const docs = { tape, battle: battleOf(tape), ...Object.fromEntries(series.map((s) => [`series:${s.symbol}`, s])) };
    expect(sweepNumbers(m.container, docs), label).toEqual([]);
    expect(sweepWords(m.container, docs), label).toEqual([]);
    expect(sweepSigns(m.container), label).toEqual([]);
    expect(quoteDefects(m.container, docs), label).toEqual([]);
    expect(storedNoteDefects(m.container, docs), label).toEqual([]);
  });
});
