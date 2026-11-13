// The two-view shell's VIEW STATE MACHINE, pure (spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-4): the pills a mount shows,
// where it opens, the timeframe a switch sets, "see on chart"'s timeframe and
// the plot height. The modal's rows drive the same functions through the real
// modal (AssetResearchModal.shell.jsdom.test.jsx).

import { describe, it, expect } from 'vitest';
import { shellViewsFor, openingView, bombOnlyOpensOnBomb, switchView, seeOnChartTimeframe, isChartTimeframe, shellChartHeight, isLiveZoneMode, viewOnShellAppear } from './shellView.js';

describe('the warm 💣 pill and the shell appearing on an open modal', () => {
  it('warm only in a live zone: the red zone (its approach, its banked moment) and the Danger Zone; never frozen, never the Fuse', () => {
    expect(['approaching', 'banked', 'danger', 'closed', 'dangerClosed', 'fuse', null].map(isLiveZoneMode)).toEqual([true, true, true, false, false, false, false]);
  });
  it('the view of the series on screen: 💣 on the bomb series with Bomb mode, the Chart view for the legacy bomb chart, else Analysis', () => {
    expect(viewOnShellAppear({ timeframe: 'bomb', bomb: true })).toBe('bomb');
    expect(viewOnShellAppear({ timeframe: 'spectate', bomb: true })).toBe('bomb');
    expect(viewOnShellAppear({ timeframe: 'bomb', bomb: false })).toBe('chart');
    expect(viewOnShellAppear({ timeframe: '1D', bomb: true })).toBe('analysis');
    expect(viewOnShellAppear({ timeframe: '1W', bomb: false })).toBe('analysis');
  });
});

describe('the pills and the opening view', () => {
  it('three pills with Bomb mode, two without (browse)', () => {
    expect(shellViewsFor({ bomb: true })).toEqual(['analysis', 'chart', 'bomb']);
    expect(shellViewsFor({ bomb: false })).toEqual(['analysis', 'chart']);
  });
  it('Analysis on open; 💣 only when FQ-9 / BD-7 decided so at open', () => {
    expect(openingView({ opensOnBomb: false })).toBe('analysis');
    expect(openingView({ opensOnBomb: undefined })).toBe('analysis');
    expect(openingView({ opensOnBomb: true })).toBe('bomb');
  });
  it('BS-1: a Bomb-only mount asks for 💣 by its own defaultTab or defaultTimeframe, else Analysis', () => {
    expect(bombOnlyOpensOnBomb({ defaultTab: 'baggerbomb', defaultTimeframe: '1D' })).toBe(true);
    expect(bombOnlyOpensOnBomb({ defaultTab: null, defaultTimeframe: 'bomb' })).toBe(true);
    expect(bombOnlyOpensOnBomb({ defaultTab: undefined, defaultTimeframe: 'spectate' })).toBe(true);
    expect(bombOnlyOpensOnBomb({ defaultTab: 'fundamental', defaultTimeframe: '1D' })).toBe(false);
    expect(bombOnlyOpensOnBomb({ defaultTab: undefined, defaultTimeframe: undefined })).toBe(false);
  });
});

describe('a switch and its timeframe', () => {
  it.each([
    // [to, timeframe now, last chart timeframe] → timeframe to set
    ['bomb', '1D', '1D', 'bomb'],
    ['bomb', '1W', '1W', 'bomb'],
    ['bomb', 'spectate', '1D', null], // already on the 💣 view's own series (the red zone)
    ['chart', 'bomb', '1W', '1W'], // leaving 💣 restores the LAST chart timeframe…
    ['chart', 'spectate', '1W', '1W'],
    ['analysis', 'bomb', '1W', '1W'], // …from Analysis too
    ['analysis', 'bomb', '1D', '1D'],
    ['chart', 'bomb', undefined, '1D'], // none known → 1D
    ['chart', '1D', '1D', null], // Analysis ↔ Chart: no timeframe, nothing refetched
    ['analysis', '1W', '1W', null],
  ])('to %s from %s (last %s) → %s', (to, timeframe, lastChartTf, want) => {
    expect(switchView({ to, timeframe, lastChartTf })).toEqual({ view: to, timeframe: want });
  });
  it('the chart timeframes are 1D and 1W only', () => {
    expect(['1D', '1W', 'bomb', 'spectate', '1M', null].map(isChartTimeframe)).toEqual([true, true, false, false, false, false]);
  });
});

describe('"see on chart ›": the timeframe the pin is drawn on', () => {
  it('a time pin draws on 1D only; a price pin on 1D and 1W', () => {
    expect(seeOnChartTimeframe({ pin: { type: 'time' }, timeframe: '1D' })).toBe(null);
    expect(seeOnChartTimeframe({ pin: { type: 'time' }, timeframe: '1W' })).toBe('1D');
    expect(seeOnChartTimeframe({ pin: { type: 'price' }, timeframe: '1W' })).toBe(null);
    expect(seeOnChartTimeframe({ pin: { type: 'price' }, timeframe: 'bomb' })).toBe('1D');
    expect(seeOnChartTimeframe({ pin: null, timeframe: '1W' })).toBe(null);
  });
});

describe('the plot height', () => {
  it('the view less the 44 px control row and a 72 px peek, between 240 and 560', () => {
    expect(shellChartHeight(0)).toBe(240);
    expect(shellChartHeight(NaN)).toBe(240);
    expect(shellChartHeight(600)).toBe(484);
    expect(shellChartHeight(2000)).toBe(560);
  });
});
