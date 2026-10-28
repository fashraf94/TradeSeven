// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomDeepDive.noChart.writer.jsdom.test.jsx
//
// Film Room B2.1 A2 — PER-SYMBOL CHART COVERAGE ON SCREEN (the tester's FR-02;
// Amendment J RJ-2). Deep dive for a symbol with no series never shows the
// section's "complete" beside it: it says that symbol's own state — the reason
// the tape records (the candle pass's W5 list, coverage.series.notCharted),
// else the plain sentence. With no chart there is no marker, so the marker
// instructions do not render and the stamps' recorded prices are listed by
// check instead, each by its path with its class.
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
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import {
  mounter, battleOf, readersOf, NOW, sep23Tape, sep23Series, clone, sweepNumbers, sweepWords, sweepSigns, quoteDefects, storedNoteDefects,
} from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const m = mounter();
let hadMatchMedia;
beforeEach(() => { globalThis.localStorage.clear(); hadMatchMedia = window.matchMedia; m.setup(); });
afterEach(() => { m.teardown(); window.matchMedia = hadMatchMedia; });

let noBars;   // the Sep-23 day through the real passes, DE's bars withheld by the provider
beforeAll(async () => {
  const fx = await sep23Day({ battleId: 'b-a2-nobars' });
  const bars = sep23Bars();
  delete bars.DE;
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  noBars = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars });
  errSpy.mockRestore();
});

async function deepAt(tape, series, sym, { desktop = false } = {}) {
  m.teardown(); m.setup(); globalThis.localStorage.clear();
  window.matchMedia = desktop ? () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) : hadMatchMedia;
  m.render(<FilmRoomScreenV2 battle={battleOf(tape)} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [tape.etDate]: tape }, series)} nowMs={NOW} />);
  await m.flush();
  m.click(m.tab('Deep dive')); await m.flush();
  m.click(m.qa('[data-region="symbol-picker"] button').find((x) => x.textContent === sym)); await m.flush();
}
const docsOf = (tape, series) => ({ tape, battle: battleOf(tape), ...Object.fromEntries(series.map((s) => [`series:${s.symbol}`, s])) });
const clean = (docs, where) => {
  expect(sweepNumbers(m.container, docs), where).toEqual([]);
  expect(sweepWords(m.container, docs), where).toEqual([]);
  expect(sweepSigns(m.container), where).toEqual([]);
  expect(quoteDefects(m.container, docs), where).toEqual([]);
  expect(storedNoteDefects(m.container, docs), where).toEqual([]);
};

describe('FR-02 — a symbol with no series: its own state, never the section\'s "complete" beside it', () => {
  it('BTC on the committed fixture (the tape records crypto_not_supported): the reason, and no "complete" line in the chart section', async () => {
    expect(sep23Tape.coverage.series).toMatchObject({ status: 'complete', notCharted: [{ symbol: 'BTC', reason: 'crypto_not_supported' }] });
    await deepAt(sep23Tape, sep23Series, 'BTC');
    const sec = m.q('#deep-chart');
    expect(sec.querySelector('[data-no-chart="BTC"]').textContent).toBe('No chart for BTC: crypto is not charted.');
    expect(sec.querySelector('[data-coverage]')).toBeNull();
    expect(sec.textContent).not.toMatch(/\bcomplete\b/);
    expect(m.q('[data-region="price-chart"]')).toBeNull();
    expect(sec.textContent).not.toContain(COPY.evidenceOverlayNote);
    clean(docsOf(sep23Tape, sep23Series), 'BTC');
  });

  it('a charted symbol on the same day keeps the section\'s "complete" line (the control)', async () => {
    await deepAt(sep23Tape, sep23Series, 'INTC');
    expect(m.q('#deep-chart [data-coverage]').getAttribute('data-coverage')).toBe('complete');
    expect(m.q('[data-region="price-chart"]')).not.toBeNull();
  });

  it('a tape that records no reason (written before W5): the plain sentence — still no "complete" beside it', async () => {
    const t = clone(sep23Tape);
    delete t.coverage.series.notCharted;
    await deepAt(t, sep23Series, 'BTC');
    expect(m.q('[data-no-chart="BTC"]').textContent).toBe('No chart was recorded for this symbol.');
    expect(m.q('[data-no-chart="BTC"]').getAttribute('data-no-chart-reason')).toBe('none');
    expect(m.q('#deep-chart [data-coverage]')).toBeNull();
  });

  it('a reason the screen has no words for is never shown in its voice: the plain sentence', async () => {
    const t = clone(sep23Tape);
    t.coverage.series.notCharted = [{ symbol: 'BTC', reason: 'something_new' }];
    await deepAt(t, sep23Series, 'BTC');
    expect(m.q('[data-no-chart="BTC"]').textContent).toBe('No chart was recorded for this symbol.');
  });

  it('desktop: the grid\'s BTC tile says its own state, and the grid withholds the section\'s "complete"', async () => {
    await deepAt(sep23Tape, sep23Series, 'INTC', { desktop: true });
    expect(m.q('[data-mini="BTC"] [data-no-chart="BTC"]').textContent).toBe('No chart for BTC: crypto is not charted.');
    expect(m.q('#deep-all [data-coverage]')).toBeNull();
    expect(m.q('#deep-chart [data-coverage]').getAttribute('data-coverage')).toBe('complete');
    clean(docsOf(sep23Tape, sep23Series), 'desktop INTC');
  });
});

describe('a held name the provider returned no bars for, through the real passes', () => {
  it('the tape records it (no_bars) and the section is partial with its own reason', () => {
    expect(noBars.tape.coverage.series.notCharted).toEqual([{ symbol: 'BTC', reason: 'crypto_not_supported' }, { symbol: 'DE', reason: 'no_bars' }]);
    expect(noBars.tape.coverage.series.status).toBe('partial');
    expect(noBars.series.some((s) => s.symbol === 'DE')).toBe(false);
  });

  it('Deep dive DE: its reason; the section\'s partial line and stored reason stay (not "complete"); no marker instructions; the stamps\' recorded prices, by check, each opening its stamp', async () => {
    await deepAt(noBars.tape, noBars.series, 'DE');
    expect(m.q('[data-no-chart="DE"]').textContent).toBe('No chart for DE: no bars were returned for it.');
    expect(m.q('#deep-chart [data-coverage]').getAttribute('data-coverage')).toBe('partial');
    expect(m.q('#deep-chart [data-stored-note="coverage.series.note"]').textContent).toContain('no bars for: DE');
    const ev = m.q('[data-region="evidence-overlay"]');
    expect(ev.getAttribute('data-evidence-mode')).toBe('list');
    expect(ev.textContent).not.toContain(COPY.evidenceOverlayNote);
    const rows = m.qa('[data-recorded-price]');
    const stamped = noBars.tape.checks.map((c, i) => ({ c, i })).filter(({ c }) => typeof c.evidence?.DE?.px === 'number' && c.evidenceAt).map(({ i }) => String(i));
    expect(rows.map((r) => r.getAttribute('data-recorded-price'))).toEqual(stamped);
    expect(stamped.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.querySelector('[data-num]').getAttribute('data-num')).toBe(`checks[${r.getAttribute('data-recorded-price')}].evidence.DE.px`);
    clean(docsOf(noBars.tape, noBars.series), 'DE list');
    m.click(rows[0]);
    expect(m.q(`[data-evidence-panel="${stamped[0]}"]`)).not.toBeNull();
    clean(docsOf(noBars.tape, noBars.series), 'DE stamp open');
  });

  it('a charted name the same day keeps the markers and their instructions', async () => {
    await deepAt(noBars.tape, noBars.series, 'INTC');
    const ev = m.q('[data-region="evidence-overlay"]');
    expect(ev.hasAttribute('data-evidence-mode')).toBe(false);   // the markers mode adds no attribute: the cards-off bytes stay
    expect(ev.textContent).toContain(COPY.evidenceOverlayNote);
    expect(m.qa('[data-evidence-marker]').length).toBeGreaterThan(0);
  });
});
