// @vitest-environment jsdom
//
// Bomb mode refinement (2026-11-10) — the hook in both directions: the lead
// side lives in useBombView next to the zone state and resets with the symbol
// (BD-2); the Danger Zone is a zone of the hook (the spectate series, the
// 1-second clock) and a hit the modal SEES gets its check (BD-5, BA-4).

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import useBombView from './useBombView.js';
import BombPlot from './BombPlot.jsx';
import BombSheet from './BombSheet.jsx';
import { amznRecord, measuredRecord } from './__fixtures__/bombBattles.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let out;
let root;
function Probe(props) { out = useBombView(props); return null; }
afterEach(() => { act(() => root?.unmount()); root = null; vi.useRealTimers(); });
const bar = (iso, c) => ({ timestamp: Date.parse(iso) / 1000, close: c });
const thirty = [bar('2026-11-10T16:30:00.000Z', 269.5), bar('2026-11-10T17:00:00.000Z', 269.1), bar('2026-11-10T17:30:00.000Z', 268.7)];
const props = (record, live, over = {}) => ({
  on: true, symbol: record.symbol, live, timeframe: 'bomb', bars: thirty, previousClose: 270, assetThreshold: 4, setTimeframe: () => {},
  context: { kind: 'agent', battleId: 'b1', held: true, record }, ...over,
});
const render = async (p) => { await act(async () => { root.render(<Probe {...p} />); }); };
const start = (iso = '2026-11-10T18:02:30.000Z') => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); root = createRoot(document.createElement('div')); };

describe('BD-2 — the lead side in the hook', () => {
  it('the founder\'s AMZN at $268.09 leads down; at $277.50 up', async () => {
    start();
    await render(props(amznRecord(), 268.09));
    expect(out.lead).toBe('down');
    expect(out.goDown).toMatchObject({ side: 'down', rungShown: 259.53, bricks: 5 });
    await render(props(amznRecord(), 277.5));
    expect(out.lead).toBe('up');
  });
  it('the band holds in the hook: from the baseline (up) a 0.8-brick tilt down keeps up; 1.1 bricks moves it', async () => {
    start();
    await render(props(amznRecord(), 270.22));
    expect(out.lead).toBe('up');
    await render(props(amznRecord(), 269.5)); // up 6.4 bricks, down 5.6: 0.8 apart
    expect(out.lead).toBe('up');
    await render(props(amznRecord(), 269.2)); // up 6.6, down 5.4: 1.1 apart
    expect(out.lead).toBe('down');
    await render(props(amznRecord(), 269.6)); // back inside the band: stays down
    expect(out.lead).toBe('down');
  });
  it('resets with the symbol, the way the zone state does (never carried to another stock)', async () => {
    start();
    await render(props(amznRecord(), 269.2));
    await render(props(amznRecord(), 269.6));
    expect(out.lead).toBe('down');
    const xom = measuredRecord({ symbol: 'XOM', positionId: 'pos-xom', fill: 110, thresholdPct: 2, lastScoredAt: '2026-11-10T18:00:58.000Z' });
    await render(props(xom, 110.05)); // a hair above its baseline: a fresh first look → up
    expect(out.lead).toBe('up');
  });
  it('the sheet line follows the lead', async () => {
    start();
    await render(props(amznRecord(), 268.09));
    expect(out.sheetLine).toMatch(/^Bust \(−10\) if it's at or below \$259\.53 at a check · \+15 needs \$280\.91/);
    await render(props(amznRecord(), 277.5));
    expect(out.sheetLine).toMatch(/^Needs \$280\.91 at a check for \+15 · Bust at \$259\.53/);
  });
  it('the chip names the check (BD-8): the 1:02 PM screen reads "at the 1:00 check"', async () => {
    start();
    await render(props(amznRecord(), 268.12));
    expect(out.sheetScored).toBe('live $268.12 · scored $268.09 at the 1:00 check');
  });
});

describe('BD-5 — the Danger Zone in the hook', () => {
  it('within 0.5 % above Bust in the session: the Danger Zone, the spectate series once the 30-minute bars are in, the 1-second clock, the lead down', async () => {
    start();
    const setTimeframe = vi.fn();
    await render(props(amznRecord(), 260.4, { setTimeframe }));
    expect(out.mode).toBe('danger');
    expect(out.lead).toBe('down');
    expect(setTimeframe).toHaveBeenCalledWith('spectate');
    await render(props(amznRecord(), 260.4, { setTimeframe, timeframe: 'spectate' }));
    const t0 = out.nowMs;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(out.nowMs).toBe(t0 + 1000);
  });
  it('the plot draws the Danger Zone view, and the chip reads "Danger zone"', async () => {
    start();
    await render(props(amznRecord(), 260.4, { timeframe: 'spectate' }));
    const html = renderToStaticMarkup(<BombPlot view={out} height={354} />);
    expect(html).toContain('data-bomb-view="dangerzone"');
    expect(html).toContain('to Bust −10 · 0.33%');
  });
  it('never for a preview (a held legacy-scored stock): the Fuse — with the price INSIDE the band above its Bust (review C5)', async () => {
    start();
    const legacy = { symbol: 'AMZN', model: 'legacy', positionId: 'pos-amzn' };
    await render({ ...props(amznRecord(), 260.4), context: { kind: 'agent', battleId: 'b1', held: true, record: legacy }, previousClose: 271, assetThreshold: 4 });
    expect(out.ladder.kind).toBe('preview');
    expect(out.goDown.pctShown).toBeLessThanOrEqual(0.5); // in band: only `held` keeps it out
    expect(out.mode).toBe('fuse');
  });
  it('a hit the modal SEES gets its check (BA-4); no moment plays; the zone re-bases to Crash or leaves', async () => {
    start('2026-11-10T18:16:10.000Z');
    await render(props(amznRecord(), 259.9)); // inside the band above Bust
    expect(out.mode).toBe('danger');
    const after = amznRecord({ crossedTiers: ['bust'], lastScoredAt: '2026-11-10T18:15:58.000Z', scored: { price: 259.4, atMs: Date.parse('2026-11-10T17:59:00.000Z'), checkAtMs: Date.parse('2026-11-10T18:15:30.000Z') } });
    await render(props(after, 259.4)); // Crash ($254.19) is 2 % away: the zone leaves
    expect(out.hitTimes).toEqual({ bust: Date.parse('2026-11-10T18:15:00.000Z') });
    expect(out.moment).toBeNull();
    expect(out.mode).toBe('fuse');
    expect(out.sheetLine).toBe('Bust −10 hit at the 1:15 check · next below: Crash at $254.19');
  });
  it('a rung already hit at the first look has no seen time (no invented check)', async () => {
    start('2026-11-10T18:16:10.000Z');
    await render(props(amznRecord({ crossedTiers: ['bust'] }), 258));
    expect(out.hitTimes).toEqual({});
    expect(out.sheetLine).toBe('Bust −10 hit · next below: Crash at $254.19');
  });
});

describe('review A8 — a side with no next rung never leads, not even for one render', () => {
  it('the last upside rung banks: no frame draws an up lead with nothing left above', async () => {
    start();
    const frames = [];
    function Rec(p) { const v = useBombView(p); frames.push(v ? { lead: v.lead, hasUp: !!v.go, line: v.sheetLine } : null); return null; }
    const draw = async (p) => { await act(async () => { root.render(<Rec {...p} />); }); };
    await draw(props(amznRecord(), 290));
    await draw(props(amznRecord({ crossedTiers: ['bagger', 'doubleBagger', 'tenBagger'] }), 292));
    const after = frames.slice(frames.findIndex((f) => f && !f.hasUp));
    expect(after.length).toBeGreaterThan(0);
    for (const f of after) expect(f.lead, f.line).toBe('down');
  });
});

describe('review B1, B2, B4 — what a new position, a null blip and a preview turning held start with', () => {
  const pos2 = (over = {}) => amznRecord({ positionId: 'pos-amzn-2', fill: 262, enteredAt: '2026-11-10T18:50:00.000Z', quoteAsOf: '2026-11-10T18:34:00.000Z', ...over });
  it('B1: a second position of the same symbol records ITS hit at ITS check (not the first position\'s)', async () => {
    start('2026-11-10T18:16:10.000Z');
    await render(props(amznRecord(), 259.9));
    await render(props(amznRecord({ crossedTiers: ['bust'], lastScoredAt: '2026-11-10T18:15:58.000Z' }), 259.4));
    expect(out.hitTimes).toEqual({ bust: Date.parse('2026-11-10T18:15:00.000Z') });
    await render({ ...props(amznRecord(), 259.4), context: { kind: 'agent', battleId: 'b1', held: false, record: null } }); // sold: a preview frame
    vi.setSystemTime(new Date('2026-11-10T19:31:10.000Z'));
    await render(props(pos2(), 252.1)); // bought again: a new position, 0.3 % above its Bust ($251.64)
    await render(props(pos2({ crossedTiers: ['bust'], lastScoredAt: '2026-11-10T19:30:58.000Z' }), 251.2));
    expect(out.hitTimes).toEqual({ bust: Date.parse('2026-11-10T19:30:00.000Z') });
    expect(out.sheetLine).toMatch(/^Bust −10 hit at the 2:30 check/);
  });
  it('B1: a null blip (one not-held frame) is not a new position — the times the modal saw survive it', async () => {
    start('2026-11-10T18:16:10.000Z');
    await render(props(amznRecord(), 280.6));
    await render(props(amznRecord({ crossedTiers: ['bagger'], lastScoredAt: '2026-11-10T18:15:58.000Z' }), 281.2));
    expect(out.bankedTimes).toEqual({ bagger: Date.parse('2026-11-10T18:15:00.000Z') });
    await render({ ...props(amznRecord(), 281.2), context: { kind: 'agent', battleId: 'b1', held: true, record: null } });
    await render(props(amznRecord({ crossedTiers: ['bagger'], lastScoredAt: '2026-11-10T18:15:58.000Z' }), 281.2));
    expect(out.bankedTimes).toEqual({ bagger: Date.parse('2026-11-10T18:15:00.000Z') });
  });
  it('B2: a preview that turns held takes a fresh first look (AMZN at $269.50 leads down, whatever the preview led)', async () => {
    start();
    const preview = { ...props(amznRecord(), 269.5), context: { kind: 'bench' }, previousClose: 268, assetThreshold: 4 };
    await render(preview);
    expect(out.ladder.kind).toBe('preview');
    expect(out.lead).toBe('up');
    await render(props(amznRecord(), 269.5));
    expect(out.ladder.kind).toBe('held');
    expect(out.lead).toBe('down');
  });
  it('B4: the first frame\'s mode is the Fuse, by name', async () => {
    start();
    const modes = [];
    function Rec(p) { const v = useBombView(p); modes.push(v?.mode); return null; }
    await act(async () => { root.render(<Rec {...props(amznRecord(), 268.09)} />); });
    expect(modes[0]).toBe('fuse');
  });
});

describe('review fixes (2026-11-11), lens C — the hook through the plot and the sheet', () => {
  it('C2: the Fuse draws the hook\'s banded lead, not its own first look ($270.22 → $269.50 keeps up; a first look says down)', async () => {
    start();
    await render(props(amznRecord(), 270.22));
    await render(props(amznRecord(), 269.5));
    expect(out.lead).toBe('up');
    const html = renderToStaticMarkup(<BombPlot view={out} height={354} />);
    expect(html).toContain('data-fuse-lead="up"');
    expect(html).toMatch(/data-fuse-togo="up" data-togo-lead="1"/);
  });
  it('C3: the Danger Zone in the plot carries the hook\'s chip, naming the check; after the close it says "last"', async () => {
    start();
    await render(props(amznRecord(), 260.4, { timeframe: 'spectate' }));
    expect(renderToStaticMarkup(<BombPlot view={out} height={354} />)).toContain('live $260.40 · scored $268.09 at the 1:00 check');
    vi.setSystemTime(new Date('2026-11-10T21:30:00.000Z')); // Tue 4:30 PM ET
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await render(props(amznRecord(), 260.4, { timeframe: 'spectate' }));
    expect(out.mode).toBe('dangerClosed');
    expect(renderToStaticMarkup(<BombPlot view={out} height={354} />)).toContain('last $260.40 · scored $268.09 at the 1:00 check');
  });
  it('C3: a hit the modal saw is named in the plot\'s Danger Zone when it re-bases to the next rung below', async () => {
    start('2026-11-10T18:16:10.000Z');
    await render(props(amznRecord(), 259.9, { timeframe: 'spectate' }));
    await render(props(amznRecord({ crossedTiers: ['bust'], lastScoredAt: '2026-11-10T18:15:58.000Z' }), 254.7, { timeframe: 'spectate' }));
    expect(out.mode).toBe('danger'); // Crash $254.19 is 0.2 % below
    expect(renderToStaticMarkup(<BombPlot view={out} height={354} />)).toContain('Bust · −10 · hit at the 1:15 check');
  });
  it('C6: the record\'s Details reach the sheet unchanged through the hook', async () => {
    start();
    const details = { scoringPctDecimal: '3.954943', targets: [{ key: 'bagger', label: 'BaggerBomb', target: 280.907 }], currentPrice: 268.09, providerAsOf: '2026-11-10T17:44:00.000Z', positionId: 'pos-amzn', receiptHash: 'b'.repeat(64), inputRef: 'stockThresholdInputs/snap', modelId: 'stock_measured_atr14_fullday_v2' };
    await render(props(amznRecord({ details }), 268.09));
    expect(out.details).toBe(details);
    expect(renderToStaticMarkup(<BombSheet view={out} />)).toContain('Quote $268.09 as of 2026-11-10T17:44:00.000Z');
  });
});
