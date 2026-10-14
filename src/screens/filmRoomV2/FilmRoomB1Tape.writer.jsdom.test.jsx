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
//   · THE ONE VISIBLE CONSEQUENCE, stated: the leg's new series document is a
//     day series like any other, so the Deep dive's symbol picker offers it,
//     as "price series", its numbers marked as market data. Nothing else moves.
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
import {
  mounter, battleOf, readersOf, NOW, sweepNumbers, sweepWords, sweepSigns, quoteDefects, storedNoteDefects,
} from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const m = mounter();
beforeEach(() => { globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

const DIAGNOSIS = 'Technology sector dragging performance (2.1% loss, 40% of total negative P&L).';
let b1;
beforeAll(async () => {
  const fx = await sep23Day({ battleId: 'b-sep23-b1' });
  fx.battle.agentContext = { ...fx.battle.agentContext, archetype: 'momentum_chaser' };
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
