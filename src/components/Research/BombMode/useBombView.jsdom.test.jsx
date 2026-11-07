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
import { legacyBattle } from './__fixtures__/bombBattles.js';

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

// A held legacy EOG (previous close $155.60, threshold 3.6 %: +30 at $164.00).
const eog = (over = {}) => legacyBattle({ expiresAt: '2026-10-20T20:00:00.000Z', ...over });
const heldProps = (battle, live, timeframe) => ({
  symbol: 'EOG', live, timeframe, previousClose: 155.6, assetThreshold: 3.6,
  context: { kind: 'agent', battleId: battle.id, held: true, record: selectBombRecord(battle, 'EOG', Date.now()) },
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
    const after = eog({ thresholdHistory: { EOG: { maxMultiplier: 1.55, minMultiplier: -0.31 } }, scoreState: { lastScoredAt: '2026-10-14T17:15:40.000Z' }, cronState: { lastTickPrice: { EOG: 164.05 }, lastTickTimestamp: { EOG: Date.parse('2026-10-14T17:15:31.000Z') } } });
    await render(heldProps(after, 164.05, 'spectate'));
    expect(Object.keys(out.bankedTimes)).toEqual(['doubleBagger']);
    await render({ symbol: 'XOM', live: 101, timeframe: 'bomb', previousClose: 100, assetThreshold: 2, context: { kind: 'bench' } });
    expect(out.bankedTimes).toEqual({});
  });
  it('a new symbol starts its own red-zone memory: rungs already banked on it are not a fresh bank (no false moment; refuter C, V-B5)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:16:00.000Z'));
    root = createRoot(document.createElement('div'));
    const battle = eog({ thresholdHistory: { EOG: { maxMultiplier: 1.12, minMultiplier: -0.31 }, XOM: { maxMultiplier: 1.55, minMultiplier: 0 } } });
    await render(heldProps(battle, 158, 'bomb')); // EOG: +15 seen banked
    expect(out.moment).toBeNull();
    await render({ symbol: 'XOM', live: 115, timeframe: 'bomb', previousClose: 112, assetThreshold: 2.2, context: { kind: 'agent', battleId: battle.id, held: true, record: selectBombRecord(battle, 'XOM', Date.now()) } });
    expect(out.ladder.up.filter((r) => r.banked).map((r) => r.key)).toEqual(['bagger', 'doubleBagger']);
    expect(out.moment).toBeNull();
    expect(out.mode).not.toBe('banked');
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
