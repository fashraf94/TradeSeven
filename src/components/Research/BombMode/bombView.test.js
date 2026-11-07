// Research Modal Build A — the view helpers (spec §3.2, §3.5, §4.3, BA-1, BA-4, BA-6).
import { describe, it, expect } from 'vitest';
import { buildLadder, scoredChipText, sheetLine, traceParts, checkSlotOf } from './bombView.js';
import { previewLadder, legacyLadder, measuredLadder } from './ladder.js';
import { selectBombRecord } from './selectBombRecord.js';
import { legacyBattle } from './__fixtures__/bombBattles.js';
import { baselineText, toGoText } from './FuseChart.jsx';
import { toGo } from './ladder.js';

const WED_1PM = Date.parse('2026-10-14T17:00:00.000Z');
const at = (iso) => Date.parse(iso);

describe('buildLadder — which ladder a mount gets (BA-1)', () => {
  const record = selectBombRecord(legacyBattle(), 'EOG', WED_1PM);
  it('an agent battle\'s record for THIS symbol → the held ladder', () => {
    expect(buildLadder({ context: { kind: 'agent' }, record, previousClose: 155.6, threshold: 2.5, symbol: 'EOG', nowMs: WED_1PM })).toMatchObject({ kind: 'held', model: 'legacy' });
  });
  it('a record for another symbol, or none → a preview from yesterday\'s close × the Bomb tab threshold', () => {
    const l = buildLadder({ context: { kind: 'agent' }, record, previousClose: 120, threshold: 2.5, symbol: 'XOM', nowMs: WED_1PM });
    expect(l).toMatchObject({ kind: 'preview', model: 'preview', baseline: { price: 120 } });
    expect(buildLadder({ context: { kind: 'agent' }, record: null, previousClose: 120, threshold: 2.5, symbol: 'XOM', nowMs: WED_1PM }).kind).toBe('preview');
    expect(buildLadder({ context: { kind: 'bench' }, record: null, previousClose: 120, threshold: 2.5, symbol: 'XOM', nowMs: WED_1PM }).kind).toBe('preview');
  });
  it('v4: today\'s levels → the V4 preview; none → the close preview', () => {
    const dailyLevels = { date: '2026-10-14', assets: { EOG: { baseline: 150, baggerBomb: 154.5, doubleBagger: 156.75, tenBagger: 159, bust: 145.5, crash: 143.25, meltdown: 141, threshold: 3 } } };
    expect(buildLadder({ context: { kind: 'v4', dailyLevels }, symbol: 'EOG', previousClose: 149, threshold: 3, nowMs: WED_1PM }).model).toBe('v4');
    expect(buildLadder({ context: { kind: 'v4', dailyLevels }, symbol: 'XOM', previousClose: 149, threshold: 3, nowMs: WED_1PM }).model).toBe('preview');
  });
});

describe('the LIVE · SCORED chip (spec §3.2)', () => {
  const scored = { price: 160.19, atMs: at('2026-10-14T17:00:31.000Z') };
  it('format: live $160.27 · scored $160.19 at 1:00, from the shared priceFormat', () => {
    expect(scoredChipText({ live: 160.27, scored, decimals: 2, always: true })).toBe('live $160.27 · scored $160.19 at 1:00');
  });
  it('red zone: always, even when the two agree', () => { expect(scoredChipText({ live: 160.19, scored, decimals: 2, always: true })).toBe('live $160.19 · scored $160.19 at 1:00'); });
  it('elsewhere: only when they differ by at least one display unit', () => {
    expect(scoredChipText({ live: 160.194, scored, decimals: 2 })).toBeNull();
    expect(scoredChipText({ live: 160.2, scored, decimals: 2 })).toBe('live $160.20 · scored $160.19 at 1:00');
  });
  it('the closed view says last tick', () => { expect(scoredChipText({ live: 162.86, scored, decimals: 2, always: true, frozen: true })).toBe('last $162.86 · scored $160.19 at 1:00'); });
  it('no scored price (a preview) → no chip', () => { expect(scoredChipText({ live: 160, scored: null, always: true })).toBeNull(); });
  it('a sub-dollar asset prints with its own decimals', () => { expect(scoredChipText({ live: 0.2049, scored: { price: 0.2051, atMs: scored.atMs }, decimals: 4 })).toBe('live $0.2049 · scored $0.2051 at 1:00'); });
});

describe('what has to happen — templates only (spec §4.3)', () => {
  const held = legacyLadder({ record: selectBombRecord(legacyBattle({ thresholdHistory: {} }), 'EOG', WED_1PM), previousClose: 155.6, nowMs: WED_1PM });
  it('held: Needs $X at a check · next check 3:45', () => { expect(sheetLine({ ladder: held, clockLabel: '3:45', decimals: 2 })).toBe('Needs $161.20 at a check · next check 3:45'); });
  it('after a bank the modal SAW: +15 banked at the 1:15 check. Next: …', () => {
    const banked = legacyLadder({ record: selectBombRecord(legacyBattle(), 'EOG', WED_1PM), previousClose: 155.6, nowMs: WED_1PM });
    expect(sheetLine({ ladder: banked, bankedTimes: { bagger: at('2026-10-14T17:15:00.000Z') }, decimals: 2 })).toBe('+15 banked at the 1:15 check. Next: $164.00 at a check');
  });
  it('BA-4: a bank the modal did not see carries no time', () => {
    const banked = legacyLadder({ record: selectBombRecord(legacyBattle(), 'EOG', WED_1PM), previousClose: 155.6, nowMs: WED_1PM });
    expect(sheetLine({ ladder: banked, bankedTimes: {}, decimals: 2 })).toBe('+15 banked. Next: $164.00 at a check');
  });
  it('preview: Preview · rungs if it entered at yesterday\'s close ($X) — never "entry price"', () => {
    const line = sheetLine({ ladder: previewLadder({ previousClose: 99, threshold: 2 }), decimals: 2 });
    expect(line).toBe("Preview · rungs if it entered at yesterday's close ($99.00)");
    expect(line).not.toMatch(/entry price/i);
  });
  it('every rung banked', () => {
    const m = measuredLadder({ measured: { measured: true, baselinePrice: 100, targets: [['bagger', 102], ['doubleBagger', 103], ['tenBagger', 104], ['bust', 98], ['crash', 97], ['meltdown', 96]].map(([key, price]) => ({ key, price })), crossedTiers: ['bagger', 'doubleBagger', 'tenBagger'] } });
    expect(sheetLine({ ladder: m, decimals: 2 })).toBe('+95 banked · every rung is banked');
  });
});

describe('the baseline label — never "entry" on a preview (BA-1)', () => {
  it('preview: Yesterday\'s close $X; V4: Today\'s baseline $X; held from close: From yesterday\'s close $X; held: Entry $X · when', () => {
    expect(baselineText(previewLadder({ previousClose: 99, threshold: 2 }), 2)).toBe("Yesterday's close $99.00");
    const m = measuredLadder({ measured: { measured: true, baselinePrice: 100.75, targets: [['bagger', 102.765], ['doubleBagger', 103.7725], ['tenBagger', 104.78], ['bust', 98.735], ['crash', 97.7275], ['meltdown', 96.72]].map(([key, price]) => ({ key, price })), crossedTiers: [] }, entryAtMs: at('2026-10-13T13:45:00.000Z') });
    expect(baselineText(m, 2)).toBe('Entry $100.75 · Tue 9:45 AM');
    const fromClose = legacyLadder({ record: selectBombRecord(legacyBattle(), 'EOG', WED_1PM), previousClose: 155.6, nowMs: WED_1PM });
    expect(baselineText(fromClose, 2)).toBe("From yesterday's close $155.60");
    expect(baselineText(previewLadder({ previousClose: 99, threshold: 2 }), 2)).not.toMatch(/entr/i);
  });
  it('the to-go pill: brick wording, and inside the band the live number (R-11′(d))', () => {
    const l = previewLadder({ previousClose: 100, threshold: 6 }); // bagger $106, brick $1
    expect(toGoText(l, toGo(l, 104))).toBe('1.9% · 2 bricks to +15');
    expect(toGoText(l, toGo(l, 105.6))).toBe('0.38% · 1 brick to +15 · live $105.60');
    expect(toGoText(l, toGo(l, 106.2))).toBe('At +15 · a check decides · live $106.20');
  });
});

describe('the trace (BA-6) — bars to their last bar, then observed quotes as separate dots', () => {
  const bar = (iso, c) => ({ timestamp: at(iso) / 1000, close: c });
  const bars = [bar('2026-10-14T16:50:00.000Z', 160.1), bar('2026-10-14T16:51:00.000Z', 160.15), bar('2026-10-14T16:52:00.000Z', 160.2)];
  it('observations at or before the last bar are dropped; later ones are dots, not line points', () => {
    const obs = [{ atMs: at('2026-10-14T16:51:30.000Z'), price: 160.18 }, { atMs: at('2026-10-14T16:58:00.000Z'), price: 160.24 }, { atMs: at('2026-10-14T17:01:00.000Z'), price: 160.27 }];
    const t = traceParts(bars, obs);
    expect(t.line.map((p) => p.c)).toEqual([160.1, 160.15, 160.2]);
    expect(t.lastBarMs).toBe(at('2026-10-14T16:52:00.000Z'));
    expect(t.dots.map((o) => o.price)).toEqual([160.24, 160.27]);
    expect(t.line).toHaveLength(bars.length); // never interpolated into the gap
    expect(t.intervalMin).toBe(1);
  });
  it('a 30-minute fallback series is named by its own spacing', () => {
    const t = traceParts([bar('2026-10-14T16:00:00.000Z', 1), bar('2026-10-14T16:30:00.000Z', 2)], []);
    expect(t.intervalMin).toBe(30);
  });
});

describe('the check a scored instant belongs to (BA-4)', () => {
  it('the latest slot at or before it (a late queue still names its slot)', () => {
    expect(checkSlotOf(at('2026-10-14T17:15:40.000Z'))).toBe(at('2026-10-14T17:15:00.000Z'));
    expect(checkSlotOf(at('2026-10-14T17:19:10.000Z'))).toBe(at('2026-10-14T17:15:00.000Z'));
    expect(checkSlotOf(null)).toBeNull();
  });
});
