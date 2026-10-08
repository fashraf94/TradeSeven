// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomScreenV2.jsdom.test.jsx
//
// Film Room A2 item 4 — THE SHELL (V1.2 §7; Amendment E BA-41, BA-42, BA-49):
// the header, the depth tabs, ONE number-kind legend, the first-open notice
// once per viewer, the day picker for a multi-day battle, and the honest
// states of a day with no tape. Then the whole screen, every depth, both
// fixture days, everything opened, through the sweeps.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import FilmRoomScreenV2, { noTapeLine, defaultDay, battleDays } from './FilmRoomScreenV2';
import { FIRST_OPEN_KEY } from './filmRoomSeen';
import { FORBIDDEN_WORDS } from './filmRoomCopy';
import {
  mounter, sep23Tape, sep23Series, emptyTape, emptySeries, clone, battleOf, readersOf, NOW, sweepNumbers, sweepWords, sweepSigns, SPEC_FORBIDDEN_WORDS,
} from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 30_000 });

const m = mounter();
beforeEach(() => { globalThis.localStorage.clear(); m.setup(); });
afterEach(() => { m.teardown(); vi.restoreAllMocks(); });

const FIRST_OPEN = 'Film Room now includes held positions in its recorded score. Earlier Film Room summaries left them out, so the same battle may show a different number here. Check the timestamp: this score may be from the last recorded check rather than market close.';

async function open(tape = sep23Tape, { series = sep23Series, battle = battleOf(tape), viewerId = 'viewer-1', readers = readersOf({ [tape.etDate]: tape }, series), nowMs = NOW } = {}) {
  m.render(<FilmRoomScreenV2 battle={battle} onBack={() => {}} viewerId={viewerId} readers={readers} nowMs={nowMs} />);
  await m.flush();
  return readers;
}
const depth = async (label) => { m.click(m.tab(label)); await m.flush(); };
const docsFor = (tape, series) => ({ tape, ...Object.fromEntries(series.map((s) => [`series:${s.symbol}`, s])) });

describe('the header (BA-41, BA-42)', () => {
  it('the title, the day\'s pills, the three depths, and ONE number-kind legend with the four classes', async () => {
    await open();
    const text = m.container.textContent;
    expect(text).toContain('Film Room');
    expect(text).toContain('Sep 23 · battle complete');
    expect(text).toContain('Momentum chaser · Wed, Sep 23, 2026');
    expect(m.qa('[role="tab"]').map((t) => t.textContent)).toEqual(['Glance', 'Study', 'Deep dive']);
    const legends = m.qa('[data-legend]');
    expect(legends).toHaveLength(1);
    expect([...legends[0].querySelectorAll('[data-kind-mark]')].map((k) => k.getAttribute('data-kind-mark'))).toEqual(['recorded', 'derived', 'rebuilt', 'market']);
    expect(legends[0].textContent).toContain("rebuilt from 1-minute bars at the battle's check times");
  });

  it('the tabs switch depths; the legend stays one per screen at every depth', async () => {
    await open();
    for (const [label, d] of [['Study', 'study'], ['Deep dive', 'deep'], ['Glance', 'glance']]) {
      await depth(label);
      expect(m.q(`[data-depth="${d}"]`), d).toBeTruthy();
      expect(m.qa('[data-legend]'), d).toHaveLength(1);
    }
  });

  it('a Deep dive door on a swap card opens that symbol', async () => {
    await open();
    await depth('Study');
    m.click(m.buttons('Deep dive · PLTR›')[0] || m.qa('button').find((b) => b.textContent.startsWith('Deep dive · PLTR')));
    await m.flush();
    expect(m.q('[data-region="price-chart"]').getAttribute('data-symbol')).toBe('PLTR');
  });
});

describe('BA-49 — the first-open notice, once per viewer', () => {
  it('shows the spec\'s words on a viewer\'s first open; "Got it" hides it; it never shows to that viewer again', async () => {
    await open();
    expect(m.q('[data-region="first-open"]').textContent).toContain(FIRST_OPEN);
    m.click(m.buttons('Got it')[0]);
    expect(m.q('[data-region="first-open"]')).toBeNull();
    m.teardown(); m.setup();
    await open();
    expect(m.q('[data-region="first-open"]')).toBeNull();
  });

  it('shown once means once — leaving without dismissing still counts; another viewer sees it once', async () => {
    await open();
    expect(m.q('[data-region="first-open"]')).toBeTruthy();
    m.teardown(); m.setup();
    await open();
    expect(m.q('[data-region="first-open"]')).toBeNull();
    m.teardown(); m.setup();
    await open(sep23Tape, { viewerId: 'viewer-2' });
    expect(m.q('[data-region="first-open"]')).toBeTruthy();
    expect(JSON.parse(globalThis.localStorage.getItem(FIRST_OPEN_KEY))).toEqual({ 'viewer-1': true, 'viewer-2': true });
  });

  it('storage unavailable: the notice shows (never suppressed by a storage failure) and nothing throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await open();
    expect(m.q('[data-region="first-open"]')).toBeTruthy();
  });
});

describe('the day picker and the days with no tape (§7)', () => {
  const D2 = '2026-09-24';

  it('a multi-day battle gets a day picker; a one-day battle does not', async () => {
    await open(sep23Tape, { battle: battleOf(sep23Tape, { timing: { tradingDays: [sep23Tape.etDate, D2] } }) });
    expect(m.qa('[data-region="day-picker"] button').map((b) => b.textContent)).toEqual(['Sep 23', 'Sep 24']);
    m.teardown(); m.setup();
    await open();
    expect(m.q('[data-region="day-picker"]')).toBeNull();
  });

  it('a day with no tape: "No tape for this day" — "Not available." when no pass is scheduled for it', async () => {
    const readers = await open(sep23Tape, { battle: battleOf(sep23Tape, { timing: { tradingDays: [sep23Tape.etDate, D2] } }) });
    expect(m.q('[data-state="missing"]').textContent).toBe('No tape for this day · Not available.');
    m.click(m.qa('[data-region="day-picker"] button')[0]);
    await m.flush();
    expect(m.q('[data-depth="glance"]')).toBeTruthy();
    expect(readers.calls.map((c) => c[2])).toEqual([D2, sep23Tape.etDate]);
  });

  it('names the close pass only when one is actually scheduled for the day', () => {
    const active = { id: 'b', status: 'active', timing: { tradingDays: ['2026-10-08'] } };
    expect(noTapeLine(active, '2026-10-08', Date.parse('2026-10-08T18:00:00.000Z'))).toBe('The close pass for this day is scheduled at 10:15 PM ET.');
    expect(noTapeLine(active, '2026-10-08', Date.parse('2026-10-09T03:00:00.000Z'))).toBe('Not available.');
    expect(noTapeLine({ ...active, timing: { tradingDays: ['2026-09-23'] } }, '2026-09-23', NOW)).toBe('Not available.');
    const lateCompletion = { id: 'b', status: 'completed', completedAt: '2026-10-08T03:30:00.000Z', timing: { tradingDays: ['2026-10-07'] } };
    expect(noTapeLine(lateCompletion, '2026-10-07', Date.parse('2026-10-08T15:00:00.000Z'))).toBe('The close pass that tapes this day has not run yet.');
  });

  it('the opening day: a completed battle\'s last day; an active battle\'s latest begun day; a battle without a timeline its own instant\'s day', () => {
    expect(defaultDay({ status: 'completed' }, ['2026-09-22', '2026-09-23'], NOW)).toBe('2026-09-23');
    expect(defaultDay({ status: 'active' }, ['2026-10-07', '2026-10-08', '2026-10-09'], NOW)).toBe('2026-10-08');
    expect(battleDays({ completedAt: '2026-09-23T20:05:00.000Z' })).toEqual(['2026-09-23']);
  });

  it('a flat6/tournament tape: "This battle mode is not taped."; a read failure says so — never "no tape"', async () => {
    const skipped = { ...clone(sep23Tape), passes: { close: { status: 'skipped_mode' }, candles: { status: 'skipped' } } };
    delete skipped.checks;
    await open(skipped);
    expect(m.q('[data-state="skipped-mode"]').textContent).toBe('This battle mode is not taped.');
    m.teardown(); m.setup();
    await open(sep23Tape, { readers: { readTape: async () => ({ status: 'error', tape: null }), readSeries: async () => ({ status: 'ready', series: [] }) } });
    expect(m.q('[data-state="error"]').textContent).toBe('The tape for this day could not be read.');
  });

  it('the empty day renders every depth, honestly', async () => {
    await open(emptyTape, { series: emptySeries });
    for (const [label, d] of [['Glance', 'glance'], ['Study', 'study'], ['Deep dive', 'deep']]) {
      await depth(label);
      expect(m.q(`[data-depth="${d}"]`), label).toBeTruthy();
    }
    await depth('Glance');
    expect(m.q('[data-region="recorded-score"]')).toBeTruthy();
    expect(m.q('[data-region="final-result"] [data-result="unavailable"]')).toBeTruthy();
    await depth('Study');
    for (const id of ['holdings', 'swaps', 'directives', 'plans', 'rationale', 'checks']) expect(m.q(`#${id} [data-coverage]`), id).toBeTruthy();
  });
});

describe('the whole screen through the sweeps — every depth, both days, everything opened', () => {
  it.each([['Sep-23', sep23Tape, sep23Series], ['empty', emptyTape, emptySeries]])('%s', async (_l, tape, series) => {
    await open(tape, { series });
    const docs = docsFor(tape, series);
    for (const label of ['Glance', 'Study', 'Deep dive']) {
      await depth(label);
      m.expandAll();
      const pip = m.q('[data-check-pip="9"]') || m.q('[data-check-row="9"]');
      if (pip) m.click(pip);
      const mark = m.qa('[data-evidence-marker]')[0];
      if (mark) m.click(mark);
      expect(sweepNumbers(m.container, docs), label).toEqual([]);
      expect(sweepSigns(m.container), label).toEqual([]);
      expect(sweepWords(m.container), label).toEqual([]);
      const notes = m.container.textContent.split('This does not show which protections were armed or checked.').length - 1;
      expect(notes, label).toBe(label === 'Deep dive' && !m.q('[data-region="evidence-overlay"]') ? 0 : 1);
    }
  });

  it('desktop (≥ 1024 px) lays every depth out and passes the same sweeps', async () => {
    const had = window.matchMedia;
    window.matchMedia = () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    try {
      await open();
      expect(m.qa('[data-region="all-symbols"]')).toHaveLength(0);
      await depth('Deep dive');
      expect(m.q('[data-region="all-symbols"]')).toBeTruthy();
      expect(sweepNumbers(m.container, docsFor(sep23Tape, sep23Series))).toEqual([]);
    } finally {
      window.matchMedia = had;
    }
  });
});

describe('the sweeps bite (a guard that cannot fail guards nothing)', () => {
  it('an undeclared class, a wrong value, a stray digit, a sign colour off a recorded score, a forbidden word, "Why?"', async () => {
    const t = clone(sep23Tape);
    delete t.numberClasses['score.lastCheck.total'];
    await open(t);
    expect(sweepNumbers(m.container, { tape: t }).some((b) => b.startsWith('score.lastCheck.total'))).toBe(true);
    expect(sweepNumbers(m.container, { tape: { ...sep23Tape, score: { ...sep23Tape.score, lastCheck: { ...sep23Tape.score.lastCheck, total: -46 } } } }).some((b) => b.includes('the document holds -46'))).toBe(true);
    const box = document.createElement('div');
    box.innerHTML = '<p>Swaps 3</p><span data-num="x" data-num-class="rebuilt" style="color: var(--ft-success)"><span data-num-text>1</span></span><h3>Why?</h3><p>the best trade</p>';
    expect(sweepNumbers(box, { tape: sep23Tape }).some((b) => b.includes('stray digit'))).toBe(true);
    expect(sweepSigns(box)).toEqual(['x: sign colour on a rebuilt number']);
    expect(sweepWords(box)).toEqual(['best', 'Why?', 'heading: Why?']);
  });

  it('review A2L4-1 / A2L4-6 / A2L4-8: a word at an element\'s edge or inflected, a "Why" heading, a digit in an attribute or a bare numeral, a sign colour on a wrapper, a line or through the rgb triplet', () => {
    const box = document.createElement('div');
    box.innerHTML = '<section><h3>Rationale · the best</h3><div>Coverage</div></section><h3>Swaps · biggest</h3><span>Coverage</span><p>two lessons</p><p>graded</p>';
    expect(sweepWords(box)).toEqual(expect.arrayContaining(['best', 'biggest', 'lesson', 'grade']));
    const why = document.createElement('div');
    why.innerHTML = '<h3>Why it happened</h3>';
    expect(sweepWords(why)).toEqual(['heading: Why it happened']);
    const attr = document.createElement('div');
    attr.innerHTML = '<button aria-label="Check at 10:15 AM · score 47"></button><span title="the worst"></span><span data-num-text>12</span>';
    expect(sweepNumbers(attr, { tape: sep23Tape })).toEqual(['stray digit: “12”', 'stray digit in aria-label: “Check at 10:15 AM · score 47”']);
    expect(sweepWords(attr)).toEqual(['worst']);
    const signs = document.createElement('div');
    signs.innerHTML = '<div style="background: var(--ft-success)"><span data-num="plans[0].price.atPlan.value" data-num-class="market" style="color: rgba(var(--ft-success-rgb), 1)"><span data-num-text>1</span></span></div><svg><path data-line="hold" style="stroke: var(--ft-danger)"></path></svg>';
    expect(sweepSigns(signs)).toEqual(['sign colour on a div', 'plans[0].price.atPlan.value: sign colour on a market number', 'sign colour on a path line hold']);
  });

  it('review A2L4-7: the production word list is the build prompt\'s, pinned by the oracle (not the other way round)', () => {
    expect([...FORBIDDEN_WORDS]).toEqual([...SPEC_FORBIDDEN_WORDS]);
  });
});
