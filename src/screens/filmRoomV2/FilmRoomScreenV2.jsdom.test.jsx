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
import { renderToString } from 'react-dom/server';
import FilmRoomScreenV2, { noTapeLine, defaultDay, battleDays, headerParts } from './FilmRoomScreenV2';
import { FIRST_OPEN_KEY } from './filmRoomSeen';
import { FORBIDDEN_WORDS } from './filmRoomCopy';
import {
  mounter, sep23Tape, sep23Series, emptyTape, emptySeries, clone, battleOf, readersOf, NOW, sweepNumbers, sweepWords, sweepSigns, quoteDefects, SPEC_FORBIDDEN_WORDS, SPEC_AGGREGATE_CLASSES, SPEC_NUMBER_WORDS,
} from './__fixtures__/filmRoomHarness';
import { COMPANY_NAMES } from '../../config/stockData';

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
    // the battle length is a marked number (R8): "one-day battle" with its marker, D
    expect(m.q('[data-header-subtitle]').textContent).toBe('Trend Follower · BaggerBomb · one-day battleD · Wed, Sep 23, 2026');
    // a separator travels with the part after it: a wrapped line never starts or ends on " · " (review A2P3-3)
    expect([...m.q('[data-header-subtitle]').children].map((s) => s.textContent)).toEqual(['Trend Follower', '· BaggerBomb', '· one-day battleD', '· Wed, Sep 23, 2026']);
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

  it('the design of record\'s header: the agent\'s mark (the cockpit\'s still avatar, no score passed), "Battles" back', async () => {
    const onBack = vi.fn();
    m.render(<FilmRoomScreenV2 battle={battleOf(sep23Tape)} onBack={onBack} viewerId="viewer-1" readers={readersOf({ [sep23Tape.etDate]: sep23Tape }, sep23Series)} nowMs={NOW} />);
    await m.flush();
    const back = m.qa('header button')[0];
    expect(back.textContent).toBe('‹ Battles');
    m.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    const mark = m.q('header [data-agent-mark]');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.querySelector('svg')).toBeTruthy();   // the presence face (AGENT_PRESENCE_ENABLED), painted once
    expect(mark.compareDocumentPosition(m.q('header h1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the mark is the cockpit\'s still avatar given NO score — static, its environment off, its standing neutral (no mood about the day)', async () => {
    vi.resetModules();
    const seen = [];
    vi.doMock('../../components/AgentPresence/AgentPresenceMount', () => ({ default: function MockPresenceMount(props) { seen.push(props); return null; } }));
    try {
      const Fresh = (await import('./FilmRoomScreenV2')).default;
      const battle = battleOf(sep23Tape);
      renderToString(<Fresh battle={battle} onBack={() => {}} viewerId="viewer-1" readers={readersOf({})} nowMs={NOW} />);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ surface: 'duel', reactivityLevel: 'static', enableEnvironment: false });
      expect(seen[0].agent).toBe(battle);
      expect(seen[0].duel).toBeUndefined();   // no duel record at all: no playerScore / opponentScore, no feed
    } finally {
      vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
      vi.resetModules();
    }
  });

  it('the subtitle names only what the record carries: archetype · BaggerBomb · length · date', () => {
    const D = sep23Tape.etDate;
    const base = { agentContext: { archetype: 'momentum_chaser' }, timing: { tradingDays: ['2026-09-22', D] } };
    expect(headerParts(base, sep23Tape, D)).toEqual({ archetype: 'Trend Follower', game: 'BaggerBomb', length: { days: 2, source: 'timing' }, date: 'Wed, Sep 23, 2026' });
    // no timeline: the tape's day number on its final day; on another day, no length at all (never battleDays' one-day fallback)
    expect(headerParts({ agentContext: {} }, sep23Tape, D).length).toEqual({ days: 1, source: 'dayNumber' });
    expect(headerParts({ agentContext: {} }, { ...sep23Tape, isFinalDay: false, dayNumber: 1 }, D).length).toBeNull();
    expect(battleDays({ completedAt: sep23Tape.battle.completedAt })).toEqual([D]);   // the screen's own one-day fallback…
    expect(headerParts({ completedAt: sep23Tape.battle.completedAt }, { ...sep23Tape, isFinalDay: false }, D).length).toBeNull();   // …never states a length
    expect(headerParts({}, null, D)).toEqual({ archetype: null, game: 'BaggerBomb', length: null, date: 'Wed, Sep 23, 2026' });
    // the archetype: the battle's, else the tape's (a code the directory does not name is humanised by the directory itself)
    expect(headerParts({}, sep23Tape, D).archetype).toBe('Momentum');
    // review A2P1-9 / A2P3-4: every agent battle is a BaggerBomb game (the tournament mode too) — it never waits on the tape
    expect(headerParts(base, null, D).game).toBe('BaggerBomb');
    expect(headerParts({ ...base, gameMode: 'baggerbomb_tournament' }, { passes: { close: { status: 'skipped_mode' } } }, D).game).toBe('BaggerBomb');
    // review A2P1-6: the writer's 'unknown' sentinel is not an archetype
    expect(headerParts({ agentContext: { archetype: 'unknown' } }, { ...sep23Tape, archetype: 'unknown' }, D).archetype).toBeNull();
    expect(headerParts({ agentContext: { archetype: 'unknown' } }, sep23Tape, D).archetype).toBe('Momentum');
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
    const docs = { ...docsFor(tape, series), battle: battleOf(tape) };
    for (const label of ['Glance', 'Study', 'Deep dive']) {
      await depth(label);
      m.expandAll();
      const pip = m.q('[data-check-pip="9"]') || m.q('[data-check-row="9"]');
      if (pip) m.click(pip);
      const mark = m.qa('[data-evidence-marker]')[0];
      if (mark) m.click(mark);
      expect(sweepNumbers(m.container, docs), label).toEqual([]);
      expect(sweepSigns(m.container), label).toEqual([]);
      expect(sweepWords(m.container, docs), label).toEqual([]);
      expect(quoteDefects(m.container, docs), label).toEqual([]);
      const notes = m.container.textContent.split('This does not show which protections were armed or checked.').length - 1;
      expect(notes, label).toBe(label === 'Deep dive' && !m.q('[data-region="evidence-overlay"]') ? 0 : 1);
    }
  });

  it('desktop (≥ 1024 px) lays every depth out and passes the same sweeps — every depth, everything opened (review A2P2-2)', async () => {
    const had = window.matchMedia;
    window.matchMedia = () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    try {
      await open();
      expect(m.qa('[data-region="all-symbols"]')).toHaveLength(0);
      const docs = { ...docsFor(sep23Tape, sep23Series), battle: battleOf(sep23Tape) };
      for (const label of ['Glance', 'Study', 'Deep dive']) {
        await depth(label);
        m.expandAll();
        const pip = m.q('[data-check-pip="9"]') || m.q('[data-check-row="9"]');
        if (pip) m.click(pip);
        const mark = m.qa('[data-evidence-marker]')[0];
        if (mark) m.click(mark);
        expect(sweepNumbers(m.container, docs), label).toEqual([]);
        expect(sweepSigns(m.container), label).toEqual([]);
        expect(sweepWords(m.container, docs), label).toEqual([]);
        expect(quoteDefects(m.container, docs), label).toEqual([]);
      }
      expect(m.q('[data-region="all-symbols"]')).toBeTruthy();
      expect(m.qa('[data-fork-ends]')).toHaveLength(0);   // the Deep dive is showing; the Study's desktop fork ends were swept above
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

  it('addendum R4(b)/(d): a tick label is exempt only as marked scaffolding of an axis captioned ONCE with its declared class; a name only as the directory\'s own', () => {
    const docs = { tape: sep23Tape, 'series:MSFT': sep23Series.find((s) => s.symbol === 'MSFT') };
    const inChart = (html) => { const box = document.createElement('div'); box.innerHTML = `<div data-region="price-chart">${html}</div>`; return box; };
    const tick = '<span data-axis-scaffolding="price">500.00</span>';
    const caption = (cls) => `<span data-axis-caption="price" data-axis-doc="series:MSFT" data-axis-path="bars[0].c">Price axis<span data-kind-mark="${cls}">M</span></span>`;
    expect(sweepNumbers(inChart(tick + caption('market')), docs)).toEqual([]);
    expect(sweepNumbers(inChart(tick), docs)).toEqual(['axis price: 0 captions', 'stray digit: “500.00”']);
    expect(sweepNumbers(inChart(tick + caption('derived')), docs)).toEqual(['axis price: caption marker derived, declared market', 'stray digit: “500.00”']);
    expect(sweepNumbers(inChart(tick + caption('market') + caption('market')), docs)).toEqual(['axis price: 2 captions', 'stray digit: “500.00”']);
    const outside = document.createElement('div');
    outside.innerHTML = tick + caption('market');
    expect(sweepNumbers(outside, docs)).toEqual(['axis scaffolding outside the chart: “500.00”']);
    expect(sweepNumbers(inChart('<span data-axis-scaffolding="price">500.00</span><span data-axis-caption="price" data-axis-aggregate="nope">Price axis<span data-kind-mark="market">M</span></span>'), docs))
      .toEqual(['axis price: caption marker market, declared null', 'stray digit: “500.00”']);
    const names = document.createElement('div');
    names.innerHTML = '<span data-display-name="PSX">Phillips 66</span>';
    expect(sweepNumbers(names, docs)).toEqual([]);
    names.innerHTML = '<span data-display-name="MSFT">Microsoft 365</span><span data-display-name="MSFT">Phillips 66</span>';   // not ITS entry (review A2P2-10)
    expect(sweepNumbers(names, docs)).toEqual(['stray digit: “Microsoft 365”', 'stray digit: “Phillips 66”']);
    // a directory name is not exempt from the word sweep: the forbidden list stands as written (R5; review A2P1-2)
    names.innerHTML = '<span data-display-name="BBY">Best Buy</span>';
    expect(sweepWords(names)).toEqual(['best']);
  });

  it('review A2P2-1 / A2P2-5 / A2P2-10: a computed number bites outside its site, when its text and value differ, or off the documents\' value', () => {
    const agg = (name, value, text, cls = SPEC_AGGREGATE_CLASSES[name]) => `<span data-num-aggregate="${name}" data-num-class="${cls}" data-agg-value="${value}"><span data-num-text>${text}</span><span data-kind-mark="${cls}">X</span></span>`;
    const at = (html) => { const box = document.createElement('div'); box.innerHTML = html; return box; };
    const n = sep23Tape.actions.length;
    // the recorded slot index shown as a computed count, outside the swaps' count pill (M10)
    expect(sweepNumbers(at(`<div data-swap-card="0">slot ${agg('count(actions[])', 1, '1')}</div>`), { tape: sep23Tape })).toEqual(['aggregate count(actions[]): outside its site', `aggregate count(actions[]): computed 1, the documents give ${n}`]);
    // in its site, showing another number than it computed (M20)
    expect(sweepNumbers(at(`<section id="swaps"><span data-section-count>${agg('count(actions[])', n, String(n + 1))}</span></section>`), { tape: sep23Tape })).toEqual([`aggregate count(actions[]): shows ${n + 1}, computed ${n}`]);
    // in its site, computed from another list (the oracle recomputes it from the tape)
    expect(sweepNumbers(at(`<section id="swaps"><span data-section-count>${agg('count(actions[])', 7, '7')}</span></section>`), { tape: sep23Tape })).toEqual([`aggregate count(actions[]): computed 7, the documents give ${n}`]);
    // the clean case
    expect(sweepNumbers(at(`<section id="swaps"><span data-section-count>${agg('count(actions[])', n, String(n))}</span></section>`), { tape: sep23Tape })).toEqual([]);
    // the class check stands (M14)
    expect(sweepNumbers(at(`<section id="swaps"><span data-section-count>${agg('count(actions[])', n, String(n), 'market')}</span></section>`), { tape: sep23Tape })).toEqual(['aggregate count(actions[]): marker market, declared derived']);
  });

  it('review A2P2-10: a caption with two markers, and scaffolding that wraps a marked number, are defects', () => {
    const docs = { tape: sep23Tape, 'series:MSFT': sep23Series.find((s) => s.symbol === 'MSFT') };
    const box = document.createElement('div');
    box.innerHTML = '<div data-region="price-chart"><span data-axis-scaffolding="price">500.00</span><span data-axis-caption="price" data-axis-doc="series:MSFT" data-axis-path="bars[0].c">Price axis<span data-kind-mark="market">M</span><span data-kind-mark="derived">D</span></span></div>';
    expect(sweepNumbers(box, docs)).toEqual(['axis price: caption marker market+derived, declared market', 'stray digit: “500.00”']);
    box.innerHTML = '<div data-region="price-chart"><span data-axis-scaffolding="price">500.00<span data-num="sessionOpen.value" data-num-doc="series:MSFT" data-num-class="market"><span data-num-text>500.60</span><span data-kind-mark="market">M</span></span></span><span data-axis-caption="price" data-axis-doc="series:MSFT" data-axis-path="bars[0].c">Price axis<span data-kind-mark="market">M</span></span></div>';
    expect(sweepNumbers(box, docs)).toEqual(['axis scaffolding holds a marked number: “500.00500.60M”']);
  });

  it('review A2L4-7: the production word list is the build prompt\'s, pinned by the oracle (not the other way round)', () => {
    expect([...FORBIDDEN_WORDS]).toEqual([...SPEC_FORBIDDEN_WORDS]);
  });
});

describe('Amendment E addendum 2, R8 (Astra A2 F3) — the battle length is a marked number', () => {
  const D = sep23Tape.etDate;
  /** The subtitle's one number: the battle length, a declared aggregate or the tape's own field. */
  const lengthEl = () => m.q('[data-header-subtitle] [data-num-aggregate], [data-header-subtitle] [data-num]');

  it('Astra\'s setup — the complete Sep-23 tape, timing.tradingDays holding its one session: "one-day battle" is the count of the timeline, derived, with its marker', async () => {
    const battle = battleOf(sep23Tape);
    expect(battle.timing.tradingDays).toEqual([D]);
    await open(sep23Tape, { battle });
    const el = lengthEl();
    expect(el.getAttribute('data-num-aggregate')).toBe('count(timing.tradingDays)');
    expect(SPEC_AGGREGATE_CLASSES['count(timing.tradingDays)']).toBe('derived');
    expect(el.getAttribute('data-num-class')).toBe('derived');
    expect([...el.querySelectorAll('[data-kind-mark]')].map((k) => k.getAttribute('data-kind-mark'))).toEqual(['derived']);
    expect(el.getAttribute('data-agg-value')).toBe('1');
    expect(el.querySelector('[data-num-text]').textContent).toBe('one');
    expect(el.textContent).toBe('one-day battleD');   // the word styling stays; the marker follows it
    const docs = { tape: sep23Tape, battle };
    expect(sweepNumbers(m.container, docs)).toEqual([]);
    expect(sweepWords(m.container, docs)).toEqual([]);
  });

  it('the count is the battle\'s own timeline — two trading days read "two", whatever the tape\'s day number says; the oracle recounts it', async () => {
    const battle = battleOf(sep23Tape, { timing: { tradingDays: ['2026-09-22', D] } });
    expect(sep23Tape.dayNumber).toBe(1);
    await open(sep23Tape, { battle });
    const el = lengthEl();
    expect([el.getAttribute('data-agg-value'), el.querySelector('[data-num-text]').textContent]).toEqual(['2', 'two']);
    expect(sweepNumbers(m.container, { tape: sep23Tape, battle })).toEqual([]);
    // another timeline in the documents: the oracle's count disagrees with the shown one
    const other = { ...battle, timing: { tradingDays: ['2026-09-21', '2026-09-22', D] } };
    expect(sweepNumbers(m.container, { tape: sep23Tape, battle: other })).toEqual(['aggregate count(timing.tradingDays): computed 2, the documents give 3']);
  });

  it('no timeline: the final tape\'s dayNumber, by its path, with THAT document\'s declared class and marker', async () => {
    const battle = { ...battleOf(sep23Tape), timing: undefined };
    for (const cls of ['derived', 'recorded']) {
      const tape = clone(sep23Tape);
      tape.numberClasses.dayNumber = cls;   // the marker follows the document, never a constant
      m.teardown(); m.setup(); globalThis.localStorage.clear();
      await open(tape, { battle });
      const el = lengthEl();
      expect(el.getAttribute('data-num'), cls).toBe('dayNumber');
      expect(el.getAttribute('data-num-class'), cls).toBe(cls);
      expect(el.querySelector('[data-kind-mark]').getAttribute('data-kind-mark'), cls).toBe(cls);
      expect(el.textContent, cls).toBe(`one-day battle${cls === 'derived' ? 'D' : 'R'}`);
      expect(m.q('[data-num-aggregate="count(timing.tradingDays)"]')).toBeNull();
      expect(sweepNumbers(m.container, { tape })).toEqual([]);
    }
  });

  it('review A2A3-2: words up to "ten"; a longer timeline omits the length — never a bare "-day battle"', async () => {
    const before = (n) => Array.from({ length: n }, (_, k) => `2026-09-${String(23 - n + 1 + k).padStart(2, '0')}`);
    const ten = battleOf(sep23Tape, { timing: { tradingDays: before(10) } });
    expect(ten.timing.tradingDays.at(-1)).toBe(D);
    await open(sep23Tape, { battle: ten });
    expect([lengthEl().getAttribute('data-agg-value'), lengthEl().textContent]).toEqual(['10', 'ten-day battleD']);
    expect(sweepNumbers(m.container, { tape: sep23Tape, battle: ten })).toEqual([]);
    m.teardown(); m.setup();
    await open(sep23Tape, { battle: battleOf(sep23Tape, { timing: { tradingDays: before(11) } }) });
    expect(lengthEl()).toBeNull();
    expect(m.q('[data-header-subtitle]').textContent).not.toMatch(/day battle/);
  });

  it('review A2A3-4: with no tape for the day (missing, unreadable), the length still shows, marked — and its oracle still recounts it', async () => {
    const battle = battleOf(sep23Tape);
    await open(sep23Tape, { battle, readers: { readTape: async () => ({ status: 'missing', tape: null }), readSeries: async () => ({ status: 'ready', series: [] }) } });
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    expect(lengthEl().textContent).toBe('one-day battleD');
    expect(sweepNumbers(m.container, { battle })).toEqual([]);
    expect(sweepWords(m.container, { battle })).toEqual([]);
    expect(sweepNumbers(m.container, { battle: { ...battle, timing: { tradingDays: ['2026-09-21', '2026-09-22', D] } } }))
      .toEqual(['aggregate count(timing.tradingDays): computed 1, the documents give 3']);
  });

  it('review A2A3-8: the length counts the days the timeline names, as the day picker reads them', async () => {
    const battle = battleOf(sep23Tape, { timing: { tradingDays: [D, null, 7] } });
    await open(sep23Tape, { battle });
    expect(lengthEl().textContent).toBe('one-day battleD');
    expect(m.q('[data-region="day-picker"]')).toBeNull();
    expect(sweepNumbers(m.container, { tape: sep23Tape, battle })).toEqual([]);
  });

  it('neither source: the length is omitted', async () => {
    await open({ ...clone(sep23Tape), isFinalDay: false }, { battle: { ...battleOf(sep23Tape), timing: undefined } });
    expect(lengthEl()).toBeNull();
    expect(m.q('[data-header-subtitle]').textContent).not.toMatch(/day battle/);
  });
});

describe('R8 — the screen\'s own voice spells no number as a word outside a marked number (the class, not the instance)', () => {
  const box = (html) => { const el = document.createElement('div'); el.innerHTML = html; return el; };

  it('a cardinal word in copy, a label or an attribute bites — zero through twenty, "single", "dozen", inflected', () => {
    expect(sweepWords(box('<p>Holdings · seven slots</p>'))).toEqual(['number word “seven”: Holdings · seven slots']);
    expect(sweepWords(box('<h3>Twenty checks</h3>'))).toEqual(['number word “Twenty”: Twenty checks']);
    expect(sweepWords(box('<span title="a single check"></span><button aria-label="dozens of swaps"></button>'))).toEqual(['number word “single” in title: a single check', 'number word “dozens” in aria-label: dozens of swaps']);
    expect(sweepWords(box('<p>a one-step hypothetical</p>'))).toEqual(['number word “one”: a one-step hypothetical']);
    expect(sweepWords(box('<p>someone, often, none, ninety</p>'))).toEqual([]);   // whole words only
  });

  it('a marked number\'s own text is exempt — the words beside it are not', () => {
    const agg = (rest) => `<span data-header-subtitle><span data-num-aggregate="count(timing.tradingDays)" data-num-class="derived" data-agg-value="1"><span><span data-num-text>one</span>${rest}</span><span data-kind-mark="derived">D</span></span></span>`;
    expect(sweepWords(box(agg('-day battle')))).toEqual([]);
    expect(sweepWords(box(agg('-day battle, twelve checks')))).toEqual(['number word “twelve”: -day battle, twelve checks']);
    expect(sweepWords(box('<span><span data-num-text>one</span>-day battle</span>'))).toEqual(['number word “one”: one']);   // unmarked: a bare data-num-text is not a marked number
  });

  it('R4(d): the directory\'s own name for its symbol ("Capital One") is exempt — the same words anywhere else are not', () => {
    expect(COMPANY_NAMES.COF).toBe('Capital One');
    expect(sweepWords(box('<span data-display-name="COF">Capital One</span>'))).toEqual([]);
    expect(sweepWords(box('<span data-display-name="MSFT">Capital One</span>'))).toEqual(['number word “One”: Capital One']);
  });

  it('R1: the tape\'s own stored text, verbatim and marked as the record\'s, is exempt — screen words around it, or the same words unmarked, are not', () => {
    const label = sep23Tape.actions[0].replay.label;
    expect(label).toMatch(/^one-step hypothetical/);
    const docs = { tape: sep23Tape };
    expect(sweepWords(box(`<span data-record-text>${label}</span>`), docs)).toEqual([]);
    expect(sweepWords(box(`<span data-record-text>${label} · one more</span>`), docs)).toEqual(['number word “one”: ' + `${label} · one more`.slice(0, 80)]);
    expect(sweepWords(box(`<span>${label}</span>`), docs)).toEqual([`number word “one”: ${label}`.slice(0, 'number word “one”: '.length + 80)]);
  });

  it('review A2A3-3: EVERY word on the pinned list bites, singular and plural', () => {
    for (const w of SPEC_NUMBER_WORDS) {
      expect(sweepWords(box(`<p>a ${w} thing</p>`)), w).toEqual([`number word “${w}”: a ${w} thing`]);
      expect(sweepWords(box(`<p>the ${w}s</p>`)), `${w}s`).toEqual([`number word “${w}s”: the ${w}s`]);
    }
  });

  it('review A2A3-1: a marked number holds ONE number text — a second one is neither exempt nor a number', () => {
    const two = '<span data-header-subtitle><span data-num-aggregate="count(timing.tradingDays)" data-num-class="derived" data-agg-value="1"><span data-num-text>one</span><span data-num-text>-day battle, twelve checks</span><span data-kind-mark="derived">D</span></span></span>';
    const battle = battleOf(sep23Tape);
    expect(sweepWords(box(two))).toEqual(['number word “one”: one', 'number word “twelve”: -day battle, twelve checks']);
    expect(sweepNumbers(box(two), { battle })).toEqual(['aggregate count(timing.tradingDays): 2 number texts — a marked number holds exactly one (review A2A3-1)']);
  });

  it('the production word list for the sweep is the fix prompt\'s, pinned in the harness', () => {
    expect([...SPEC_NUMBER_WORDS]).toEqual(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'single', 'dozen']);
  });
});
