// @vitest-environment jsdom
//
// Research Modal Build A — useBombView's lifecycle rules (review lens C C9,
// lens B B3/B8): a new symbol starts clean (no other symbol's quotes as dots,
// no other symbol's banked times); the Fuse's ghost never takes minute bars;
// off, the hook returns nothing and starts no timer.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useBombView from './useBombView.js';
import { selectBombRecord } from './selectBombRecord.js';
import { legacyBattle, measuredEogRecord, measuredRecord } from './__fixtures__/bombBattles.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let out;
function Probe(props) { out = useBombView(props); return null; }
const bar = (iso, c) => ({ timestamp: Date.parse(iso) / 1000, close: c });
const minute = [bar('2026-10-14T16:56:00.000Z', 101), bar('2026-10-14T16:57:00.000Z', 101.1)];
const thirty = [bar('2026-10-14T15:30:00.000Z', 100.5), bar('2026-10-14T16:00:00.000Z', 100.8), bar('2026-10-14T16:30:00.000Z', 101)];
const base = { on: true, context: { kind: 'bench' }, isOriginal: true, assetThreshold: 2, previousClose: 99, setTimeframe: () => {} };

let root;
afterEach(() => { act(() => root?.unmount()); vi.useRealTimers(); });
const render = async (props) => { await act(async () => { root.render(<Probe {...base} {...props} />); }); };

describe('useBombView lifecycle', () => {
  it('off: returns null and starts no timer', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render({ on: false, symbol: 'AAPL', live: 101 });
    expect(out).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a new symbol drops the old symbol\'s observed quotes (BA-6 dots never cross symbols)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render({ symbol: 'AAPL', live: 101.2, timeframe: 'spectate', bars: minute });
    await render({ symbol: 'AAPL', live: 101.3, timeframe: 'spectate', bars: minute });
    expect(out.trace.dots.map((o) => o.price)).toEqual([101.2, 101.3]);
    await render({ symbol: 'MSFT', live: 400.5, timeframe: 'spectate', bars: minute });
    expect(out.trace.dots.map((o) => o.price)).toEqual([400.5]);
  });
  it('the ghost keeps 30-minute bars only — minute bars left over after spectate → bomb are never drawn as the ghost', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: thirty });
    expect(out.ghost).toHaveLength(3);
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: minute }); // the hook's stale minute series for one commit
    expect(out.ghost).toHaveLength(3);
  });
  it('…nor the 1D chart\'s daily bars, still held while the 30-minute series loads after 1D → 💣 (refuter B, B3)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    const daily = [bar('2026-10-12T20:00:00.000Z', 99), bar('2026-10-13T20:00:00.000Z', 99.5), bar('2026-10-14T17:00:00.000Z', 101)];
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: daily });
    expect(out.ghost).toEqual([]);
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: thirty });
    expect(out.ghost).toHaveLength(3);
  });
});

// A held MEASURED EOG at the legacy fixture's rung prices (fill $155.60, 3.6 %:
// +30 at $164.00). Since the 2026-11-07 ruling on §0.4(a) only a measured
// position has a held ladder — and so a clock, a red zone and banked times.
const eog = (over = {}) => measuredEogRecord(over);
const heldProps = (record, live, timeframe) => ({
  symbol: record.symbol, live, timeframe, previousClose: 155.6, assetThreshold: 3.6,
  context: { kind: 'agent', battleId: 'battle-measured', held: true, record },
});

describe('useBombView — the held clock and the banked times', () => {
  it('the 1-second clock runs only while the red zone is on screen (review B8): on the 1D chart it ticks every 15 s', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render(heldProps(eog(), 163.6, '1D'));
    expect(out.mode).toBe('approaching');
    const t0 = out.nowMs;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(out.nowMs).toBe(t0);
    expect(Date.now()).toBe(t0 + 1000);
    await render(heldProps(eog(), 163.6, 'spectate'));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(out.nowMs).toBe(Date.now()); // on screen: the clock caught up within one second
  });
  it('a new symbol drops the banked times the modal saw for the old one (BA-4 never crosses symbols)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:16:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render(heldProps(eog(), 163.95, 'spectate'));
    const after = eog({ crossedTiers: ['bagger', 'doubleBagger'], lastScoredAt: '2026-10-14T17:15:40.000Z', scored: { price: 164.05, atMs: Date.parse('2026-10-14T17:15:31.000Z') } });
    await render(heldProps(after, 164.05, 'spectate'));
    expect(Object.keys(out.bankedTimes)).toEqual(['doubleBagger']);
    await render({ symbol: 'XOM', live: 101, timeframe: 'bomb', previousClose: 100, assetThreshold: 2, context: { kind: 'bench' } });
    expect(out.bankedTimes).toEqual({});
  });
  it('a new symbol starts its own red-zone memory: rungs already banked on it are not a fresh bank (no false moment; refuter C, V-B5)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:16:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render(heldProps(eog(), 158, 'bomb')); // EOG: +15 seen banked
    expect(out.moment).toBeNull();
    const xom = measuredRecord({ symbol: 'XOM', positionId: 'pos-xom', tier: 'core', fill: 112, thresholdPct: 2.2, crossedTiers: ['bagger', 'doubleBagger'] });
    await render({ ...heldProps(xom, 115, 'bomb'), previousClose: 112, assetThreshold: 2.2 });
    expect(out.ladder.up.filter((r) => r.banked).map((r) => r.key)).toEqual(['bagger', 'doubleBagger']);
    expect(out.moment).toBeNull();
    expect(out.mode).not.toBe('banked');
  });
});

describe('useBombView — the red zone waits for the 30-minute series before it asks for the minute series (found on the way, 2026-11-07)', () => {
  it('in the band on open: no switch to spectate until this symbol\'s 30-minute bars have arrived — the hook\'s empty-minute fallback reads them from its cache', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    const setTimeframe = vi.fn();
    await render({ ...heldProps(eog(), 163.6, 'bomb'), bars: null, setTimeframe });
    expect(out.mode).toBe('approaching');
    expect(setTimeframe).not.toHaveBeenCalled();
    await render({ ...heldProps(eog(), 163.6, 'bomb'), bars: [], setTimeframe }); // an empty answer is not the series
    expect(setTimeframe).not.toHaveBeenCalled();
    await render({ ...heldProps(eog(), 163.6, 'bomb'), bars: thirty, setTimeframe });
    expect(setTimeframe).toHaveBeenCalledWith('spectate');
  });
});

describe('useBombView — a held legacy-scored position (ruling 2026-11-07, §0.4(a) rule (i))', () => {
  const legacyProps = (battle, symbol, live, timeframe) => ({
    symbol, live, timeframe, previousClose: 155.6, assetThreshold: 3.6, isCrypto: battle.portfolio.star[0].isCrypto === true,
    context: { kind: 'agent', battleId: battle.id, held: true, record: selectBombRecord(battle, symbol, Date.now()) },
  });
  it('the preview, marked held: no clock, no timer, no scored chip, no check dots, nothing banked, never the red zone', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    // +15 and +30 held in the legacy history (maxMultiplier 1.55); live 0.24 % under the would-be +50.
    const battle = legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z', thresholdHistory: { EOG: { maxMultiplier: 1.55, minMultiplier: -0.31 } } });
    await render(legacyProps(battle, 'EOG', 166.4, 'spectate'));
    expect(out.ladder).toMatchObject({ status: 'ok', kind: 'preview', model: 'preview', heldPreview: true, bankedPoints: 0 });
    expect(out.ladder.rungs.some((r) => r.banked)).toBe(false);
    expect(out.mode).toBe('fuse');
    expect(out.clock).toBeNull();
    expect(out.checkDots).toEqual([]);
    expect(out.redZoneScored).toBeNull();
    expect(out.sheetScored).toBeNull();
    expect(out.moment).toBeNull();
    expect(out.sheetLine).toBe("Held · rungs shown from yesterday's close ($155.60) · this position's live ladder isn't shown here");
    expect(vi.getTimerCount()).toBe(0); // no 1 s / 15 s clock
  });
  it('a held crypto (legacy-scored on any battle): the same', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    const battle = legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z' });
    battle.portfolio = { ...battle.portfolio, star: [{ ...battle.portfolio.star[0], isCrypto: true }] };
    await render(legacyProps(battle, 'EOG', 163.6, 'bomb'));
    expect(out.ladder).toMatchObject({ kind: 'preview', heldPreview: true, bankedPoints: 0 });
    expect(out.clock).toBeNull();
    expect(out.mode).toBe('fuse');
    expect(out.sheetLine).toBe("Held · rungs shown from yesterday's close ($155.60) · this position's live ladder isn't shown here");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useBombView — the ghost through a red-zone round trip (refuter C, V-O3)', () => {
  it('the minute bars the red zone shows never become the ghost: 30-min → spectate (1-min) → back on the Fuse with the stale 1-min bars', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: thirty });
    expect(out.ghost).toHaveLength(3);
    await render({ symbol: 'AAPL', live: 101, timeframe: 'spectate', bars: minute });
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: minute });
    expect(out.ghost).toHaveLength(3);
    expect(out.ghost[0].close).toBe(100.5);
  });
});
