// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomScreenV2.review.jsdom.test.jsx
//
// Film Room A2 — the BUILD_RULES §2 review's rows (lens ids A2L1-n … A2L4-n,
// docs/audits/20261008_BUILD_FILM_ROOM_A2.md §3). Each row fails at the
// reviewed commit 1930a834 and passes with its fix.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import FilmRoomScreenV2 from './FilmRoomScreenV2';
import FilmRoomStudy from './FilmRoomStudy';
import FilmRoomGlance from './FilmRoomGlance';
import FilmRoomDeepDive from './FilmRoomDeepDive';
import { REPLAY_VERSION_NOTE } from './filmRoomCopy';
import { deriveHoldings, roleOf, evidenceMarkers } from './filmRoomModel';
import {
  mounter, sep23Tape, sep23Series, emptyTape, emptySeries, clone, battleOf, readersOf, NOW, sweepNumbers,
} from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 30_000 });

const m = mounter();
beforeEach(() => { globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

function Study({ tape }) {
  const [selected, setSelected] = React.useState(null);
  return <FilmRoomStudy tape={tape} selected={selected} onSelect={setSelected} onDeep={() => {}} jump={() => {}} />;
}
function Glance({ tape }) {
  const [selected, setSelected] = React.useState(null);
  return <FilmRoomGlance tape={tape} selected={selected} onSelect={setSelected} />;
}
function Deep({ tape, series, start }) {
  const [sym, setSym] = React.useState(start);
  return <FilmRoomDeepDive tape={tape} seriesState={{ status: 'ready', series }} sym={sym} onSym={setSym} />;
}
async function openScreen(battle, readers) {
  m.render(<FilmRoomScreenV2 battle={battle} onBack={() => {}} viewerId="viewer-1" readers={readers} nowMs={NOW} />);
  await m.flush();
}
const depth = async (label) => { m.click(m.tab(label)); await m.flush(); };

describe('lens 1 — what the screen says', () => {
  it('A2L1-1: an exit maker the tape does not record, or the gameplan meeting, is never called "a platform rule"', () => {
    const t = clone(sep23Tape);
    t.actions[0].mechanism = 'unrecorded'; t.actions[0].exitReason = null;
    t.actions[2].mechanism = 'gameplan_meeting'; t.actions[2].exitReason = 'gameplan_rotation';
    const h = deriveHoldings(t);
    expect(h.changes.map((c) => c.by)).toEqual(['unrecorded', 'agent', 'gameplan']);
    expect(roleOf(t, 'CRWD', h).text).toBe('entered at 12:45 PM · a swap by a maker not recorded');
    expect(roleOf(t, 'PANW', h).text).toBe('entered at 3:00 PM · a swap by the gameplan meeting');
    m.render(<Study tape={t} />);
    const grid = m.q('[data-region="holdings"]');
    expect([...grid.querySelectorAll('[data-holding-tone]')].map((e) => e.getAttribute('data-holding-tone')).filter((x) => !['held', 'out'].includes(x))).toEqual(['agent', 'gameplan', 'unrecorded']);   // slots DE, ETN, MSFT
    expect(grid.textContent).toContain('not recorded');
    expect(grid.textContent).toContain('meeting');
    m.render(<Glance tape={t} />);
    expect(m.qa('[data-swap-caret]').map((c) => c.getAttribute('data-swap-caret'))).toEqual(['unrecorded', 'agent', 'gameplan']);
    expect(m.container.textContent).toContain('swap · the gameplan meeting, or a maker not recorded');
  });

  it('A2L1-2: a day with no check records says "No checks were recorded this day." — never that none ran', () => {
    m.render(<Study tape={emptyTape} />);
    expect(m.q('#checks').textContent).toContain('No checks were recorded this day.');
    expect(m.container.textContent).not.toContain('No checks ran');
  });

  it('A2L1-3: an earlier day of a completed battle says "battle complete" and points to the final result on the last day', async () => {
    const D1 = '2026-09-22';
    const early = clone(sep23Tape);
    early.etDate = D1;
    early.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
    const readers = readersOf({ [D1]: early, [sep23Tape.etDate]: sep23Tape }, sep23Series);
    await openScreen(battleOf(sep23Tape, { timing: { tradingDays: [D1, sep23Tape.etDate] } }), readers);
    m.click(m.qa('[data-region="day-picker"] button')[0]);
    await m.flush();
    expect(m.container.textContent).toContain('Sep 22 · battle complete');
    const card = m.q('[data-result-elsewhere]');
    expect(card.textContent).toContain("the battle's final result is recorded on its last day");
    m.click(card.querySelector('button'));
    await m.flush();
    expect(m.q('[data-region="final-result"] [data-result="win"]')).toBeTruthy();
  });

  it('A2L1-6 / A2L1-7 / A2L1-8: the overlay carries the evidence coverage line; the stamp\'s risk uses BA-7\'s words; a stamp without evidenceAt gets no marker', () => {
    const t = clone(sep23Tape);
    const i = t.checks.findIndex((c) => c.evidence?.META);
    t.checks[i].evidenceAt = null;
    expect(evidenceMarkers(t, 'META').map((x) => x.index)).not.toContain(i);
    m.render(<Deep tape={t} series={sep23Series} start="META" />);
    const overlay = m.q('[data-region="evidence-overlay"]');
    expect(overlay.textContent).toContain('Evidence coverage');
    expect(overlay.querySelector('[data-coverage]').getAttribute('data-coverage')).toBe(t.coverage.evidence.status);
    expect(m.q(`[data-evidence-marker="${i}"]`)).toBeNull();
    m.click(m.qa('[data-evidence-marker]')[0]);
    expect(m.q('[data-evidence-panel]').textContent).toContain('Risk decision recorded: HOLD');
  });

  it('A2L1-9: the chart legend\'s markers are the series documents\' own declarations; no sector series → no marker', () => {
    const series = clone(sep23Series);
    const spy = series.find((s) => s.symbol === 'SPY');
    spy.numberClasses = { ...spy.numberClasses, 'bars[].c': 'rebuilt' };
    m.render(<Deep tape={sep23Tape} series={series} start="MSFT" />);
    const market = m.qa('[data-region="chart-legend"] button').find((b) => b.textContent.startsWith('Market'));
    expect(market.querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('rebuilt');
    const t = clone(sep23Tape);
    t.comparables.sectors.MSFT = null;
    m.render(<Deep tape={t} series={sep23Series} start="MSFT" />);
    const sector = m.qa('[data-region="chart-legend"] button').find((b) => b.textContent.startsWith('Sector'));
    expect(sector.textContent).toContain('Sector · none');
    expect(sector.querySelector('[data-kind-mark]')).toBeNull();
  });

  it('A2L1-10 / A2L1-13 / A2L1-14 / A2L1-16: the label reads the way the number is computed; the not-filed example states its gap; an early filing shows its date; "1 swap"', () => {
    const t = clone(sep23Tape);
    t.directives[0].filedAt = '2026-09-23T00:30:00.000Z';   // Sep 22, 8:30 PM ET — the evening before
    t.directives[1].after = { checks: 1, holds: 1, swaps: 1 };
    m.render(<Study tape={t} />);
    expect(m.q('[data-swap-card="0"] [data-result-row="closed-leg"]').textContent).toContain('At the sale · rebuilt minus banked');
    expect(m.q('[data-directive-card="0"]').textContent).toContain('Directive · Sep 22, 8:30 PM');
    expect(m.q('[data-directive-card="1"]').textContent).toContain('check followed:');
    expect(m.q('[data-directive-card="1"]').textContent).toMatch(/1\s?D?\s*hold ·/);
    expect(m.q('[data-directive-card="1"]').textContent).toMatch(/1\s?D?\s*swap$/);
    m.click(m.buttons('How a directive card reads')[0]);
    expect(m.q('[data-directive-card="example-not_filed"] [data-reply-differs]')).toBeTruthy();
    expect(sweepNumbers(m.container, { tape: t })).toEqual([]);
  });

  it('A2L1-15: a swap after the last recorded check sits past the strip, never on a check it was not made in', () => {
    const t = clone(sep23Tape);
    t.actions[2].tickSeq = null;
    t.actions[2].at = '2026-09-23T19:55:00.000Z';
    m.render(<Glance tape={t} />);
    const carets = m.qa('[data-swap-caret]');
    expect(carets[2].getAttribute('data-after-last-check')).toBe('yes');
    expect(carets[0].getAttribute('data-after-last-check')).toBe('no');
  });

  it('A2L1-16: the empty day never says "No series for ."', () => {
    m.render(<Deep tape={emptyTape} series={emptySeries} start={null} />);
    expect(m.container.textContent).not.toContain('No series for .');
  });
});

describe('lens 3 — reads and lifecycle', () => {
  it('A2L3-1: a replay an earlier replay logic built (no split) says so in both groups — never "No replay" beside a drawn replay', () => {
    const t = clone(sep23Tape);
    for (const a of t.actions) { delete a.replay.reconciliation.soldAtSale; delete a.replay.reconciliation.boughtAtSale; delete a.replay.note; }
    t.actions[1].replay.note = REPLAY_VERSION_NOTE;
    m.render(<Study tape={t} />);
    for (const i of [0, 1, 2]) {
      expect(m.q(`[data-swap-card="${i}"] [data-line="hold"]`), `${i}`).toBeTruthy();
      expect(m.q(`[data-swap-card="${i}"] [data-split-missing="sale"]`).textContent).toBe(REPLAY_VERSION_NOTE);
      expect(m.q(`[data-swap-card="${i}"] [data-split-missing="fill"]`).textContent).toBe(REPLAY_VERSION_NOTE);
      expect(m.q(`[data-swap-card="${i}"]`).textContent).not.toContain('No replay for this swap.');
    }
  });

  it('A2L3-2: a failed series read is said as a failed read — never "No series for X" under a complete coverage line', () => {
    m.render(<FilmRoomDeepDive tape={sep23Tape} seriesState={{ status: 'error', series: [] }} sym="AMD" onSym={() => {}} />);
    expect(m.q('[data-state="series-error"]').textContent).toBe('The series for this day could not be read.');
    expect(m.container.textContent).not.toContain('No series for');
  });

  it('A2L3-3 / A2L3-4: switching to an already-read day starts its depth fresh — no carried marker, no carried plan filter', async () => {
    const DA = sep23Tape.etDate;
    const DB = '2026-09-24';
    const b = clone(sep23Tape);
    b.etDate = DB;
    b.checks = b.checks.slice(0, 10);
    b.plans = b.plans.map((p) => ({ ...p, symbol: 'ZZZZ' }));
    const readers = readersOf({ [DA]: sep23Tape, [DB]: b }, sep23Series);
    await openScreen(battleOf(sep23Tape, { timing: { tradingDays: [DA, DB] } }), readers);
    const chips = () => m.qa('[data-region="day-picker"] button');
    m.click(chips()[0]); await m.flush();
    m.click(chips()[1]); await m.flush();
    m.click(chips()[0]); await m.flush();
    await depth('Deep dive');
    m.click(m.qa('[data-region="symbol-picker"] button').find((x) => x.textContent === 'META'));
    const marks = m.qa('[data-evidence-marker]');
    m.click(marks[marks.length - 1]);
    expect(m.q('[data-evidence-panel]')).toBeTruthy();
    m.click(chips()[1]); await m.flush();
    expect(m.q('[data-evidence-panel]')).toBeNull();
    await depth('Study');
    m.click(m.qa('[data-region="plan-chips"] button').find((x) => x.querySelector('[data-record-text]')?.textContent === 'ZZZZ'));
    m.click(chips()[0]); await m.flush();
    expect(m.qa('[data-plan]')).toHaveLength(sep23Tape.plans.length);
  });

  it('A2L3-6: a failed read is not kept — returning to the day reads it again', async () => {
    const DA = sep23Tape.etDate;
    const DB = '2026-09-24';
    let failOnce = true;
    const calls = [];
    const readers = {
      readTape: async (_id, d) => { calls.push(d); if (d === DA && failOnce) { failOnce = false; return { status: 'error', tape: null }; } return d === DA ? { status: 'ready', tape: sep23Tape } : { status: 'missing', tape: null }; },
      readSeries: async () => ({ status: 'ready', series: [] }),
    };
    await openScreen(battleOf(sep23Tape, { status: 'active', timing: { tradingDays: [DA, DB] } }), readers);   // an active battle opens on its latest begun day, DB
    m.click(m.qa('[data-region="day-picker"] button')[0]); await m.flush();
    expect(m.q('[data-state="error"]')).toBeTruthy();
    m.click(m.qa('[data-region="day-picker"] button')[1]); await m.flush();
    m.click(m.qa('[data-region="day-picker"] button')[0]); await m.flush();
    expect(calls).toEqual([DB, DA, DA]);
    expect(m.q('[data-depth="glance"]')).toBeTruthy();
  });

  it('A2L3-11: a replay whose points carry no instant draws no fork and does not throw', () => {
    const t = clone(sep23Tape);
    for (const p of [...t.actions[0].replay.holdPath, ...t.actions[0].replay.swapPath]) p.at = null;
    m.render(<Study tape={t} />);
    expect(m.q('[data-region="fork-0"]')).toBeNull();
    expect(m.q('[data-region="fork-1"]')).toBeTruthy();
  });
});

describe('refuter A2V1-11 — a name bought before the first risk record never reads as held all along', () => {
  it('the swap is stated: CRWD reads as entered at 12:45 by a platform rule, not "held at the first and the last risk record"', () => {
    const t = clone(sep23Tape);
    for (let i = 0; i <= 11; i += 1) t.checks[i].risk = null;    // the 12:45 swap's check and every one before it carry no risk record
    const h = deriveHoldings(t);
    expect(h.status).toBe('derived');
    expect(h.start.symbols).toContain('CRWD');
    expect(roleOf(t, 'CRWD', h)).toMatchObject({ kind: 'entered', text: 'entered at 12:45 PM · a swap by a platform rule · stagnation' });
    expect(roleOf(t, 'META', h).kind).toBe('held');
  });
});
