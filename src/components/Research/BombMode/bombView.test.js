// Research Modal Build A — the view helpers (spec §3.2, §3.5, §4.3, BA-1, BA-4, BA-6).
import { describe, it, expect } from 'vitest';
import { buildLadder, scoredChipText, sheetLine, traceParts, checkSlotOf } from './bombView.js';
import { previewLadder, legacyLadder, measuredLadder } from './ladder.js';
import { selectBombRecord } from './selectBombRecord.js';
import { legacyBattle, measuredEogRecord } from './__fixtures__/bombBattles.js';
import { baselineText, toGoText } from './FuseChart.jsx';
import { toGo } from './ladder.js';

const WED_1PM = Date.parse('2026-10-14T17:00:00.000Z');
const at = (iso) => Date.parse(iso);

describe('buildLadder — BS-4: the ATR arm (a non-held stock in a measured battle; the modal hands atrReading only there)', () => {
  const ready = { status: 'ready', pct: 4.05, asOfMs: Date.parse('2026-10-14T16:05:00.000Z') };
  it('the rungs take the reading, never the screen\'s threshold (6.48 = atrPercentile × 8)', () => {
    const l = buildLadder({ context: { kind: 'agent' }, record: null, previousClose: 300, threshold: 6.48, symbol: 'ACN', nowMs: WED_1PM, atrReading: ready });
    expect(l).toMatchObject({ status: 'ok', kind: 'preview', model: 'preview', threshold: 4.05, atrReading: { pct: 4.05, asOfMs: ready.asOfMs } });
    expect(l.rungs.find((r) => r.key === 'bagger').price).toBeCloseTo(312.15, 9);
    expect(sheetLine({ ladder: l, decimals: 2, nowMs: WED_1PM })).toBe("Preview · rungs if it entered at yesterday's close ($300.00) · estimated rung size · ATR reading 4.0% · as of 12:05 PM");
  });
  it('no reading → "No ladder yet": atr_unavailable for an unranked name, preview_unavailable while loading or after a failed read — never the 2.5 default', () => {
    for (const [status, want] of [['none', 'atr_unavailable'], ['loading', 'preview_unavailable'], ['failed', 'preview_unavailable']]) {
      const l = buildLadder({ context: { kind: 'agent' }, record: null, previousClose: 300, threshold: 2.5, symbol: 'ZZZZ', nowMs: WED_1PM, atrReading: { status, pct: null, asOfMs: null } });
      expect(l.status, status).toBe(want);
      expect(l.rungs, status).toEqual([]);
    }
  });
  it('a held measured record keeps its frozen ladder even with a reading handed', () => {
    const l = buildLadder({ context: { kind: 'agent' }, record: measuredEogRecord(), previousClose: 155.6, threshold: 3.6, symbol: 'EOG', nowMs: WED_1PM, atrReading: ready });
    expect(l).toMatchObject({ status: 'ok', kind: 'held', model: 'measured', baseline: { price: 155.6, source: 'fill' } });
    expect(l.atrReading).toBeUndefined();
  });
  it('a held legacy record (legacy stocks, crypto) keeps the held-preview line at its own threshold', () => {
    const record = selectBombRecord(legacyBattle(), 'EOG', WED_1PM);
    const l = buildLadder({ context: { kind: 'agent' }, record, previousClose: 155.6, threshold: 3.6, symbol: 'EOG', nowMs: WED_1PM, atrReading: ready });
    expect(l).toMatchObject({ heldPreview: true, threshold: 3.6 });
    expect(l.atrReading).toBeUndefined();
  });
  it('a bench or V4 context never takes the reading (the BaggerBomb mounts)', () => {
    expect(buildLadder({ context: { kind: 'bench' }, record: null, previousClose: 300, threshold: 6.48, symbol: 'ACN', nowMs: WED_1PM, atrReading: ready }).threshold).toBe(6.48);
    const l = buildLadder({ context: { kind: 'v4', dailyLevels: null }, record: null, previousClose: 300, threshold: 6.48, symbol: 'ACN', nowMs: WED_1PM, atrReading: ready });
    expect([l.threshold, l.atrReading]).toEqual([6.48, undefined]);
  });
});

describe('buildLadder — which ladder a mount gets (BA-1)', () => {
  const record = selectBombRecord(legacyBattle(), 'EOG', WED_1PM);
  it('an agent battle\'s MEASURED record for THIS symbol → the held ladder (the committed context\'s)', () => {
    const l = buildLadder({ context: { kind: 'agent' }, record: measuredEogRecord(), previousClose: 155.6, threshold: 3.6, symbol: 'EOG', nowMs: WED_1PM });
    expect(l).toMatchObject({ status: 'ok', kind: 'held', model: 'measured', baseline: { price: 155.6, source: 'fill' }, bankedPoints: 15 });
  });
  it('ruling 2026-11-07 (§0.4(a) rule (i)): a LEGACY record → the preview from yesterday\'s close, marked held — nothing banked', () => {
    expect(record.model).toBe('legacy');
    expect(record.history.maxMultiplier).toBe(1.12); // +15 is held in the legacy history …
    const l = buildLadder({ context: { kind: 'agent' }, record, previousClose: 155.6, threshold: 3.6, symbol: 'EOG', nowMs: WED_1PM });
    expect(l).toMatchObject({ status: 'ok', kind: 'preview', model: 'preview', heldPreview: true, baseline: { price: 155.6, source: 'previous_close', atMs: null }, bankedPoints: 0 });
    expect(l.rungs.some((r) => r.banked)).toBe(false); // … and is not lit
    expect(l.next.key).toBe('bagger');
    expect(sheetLine({ ladder: l, clockLabel: '1:15', decimals: 2 })).toBe("Held · rungs shown from yesterday's close ($155.60) · this position's live ladder isn't shown here");
  });
  it('…a held crypto too (the selector gives every crypto the legacy record; the stamped-battle crypto is the modal\'s row)', () => {
    const crypto = selectBombRecord(legacyBattle({ portfolio: { ...legacyBattle().portfolio, star: [{ symbol: 'EOG', baseATR: 3.6, positionId: 'pos-eog', isCrypto: true }] } }), 'EOG', WED_1PM);
    expect(crypto).toMatchObject({ model: 'legacy', isCrypto: true });
    expect(buildLadder({ context: { kind: 'agent' }, record: crypto, previousClose: 155.6, threshold: 3.6, symbol: 'EOG', nowMs: WED_1PM })).toMatchObject({ kind: 'preview', heldPreview: true, bankedPoints: 0 });
  });
  it('a held preview with no close or threshold yet → "no ladder yet", never the legacy "entry unavailable"', () => {
    const l = buildLadder({ context: { kind: 'agent' }, record, previousClose: null, threshold: 3.6, symbol: 'EOG', nowMs: WED_1PM });
    expect(l.status).toBe('preview_unavailable');
  });
  it('a short or an unreadable stamp is not legacy-scored: unchanged (no ladder, its own state)', () => {
    const short = selectBombRecord(legacyBattle({ portfolio: { ...legacyBattle().portfolio, star: [{ symbol: 'EOG', baseATR: 3.6, positionId: 'pos-eog', direction: 'short' }] } }), 'EOG', WED_1PM);
    expect(buildLadder({ context: { kind: 'agent' }, record: short, previousClose: 155.6, threshold: 3.6, symbol: 'EOG', nowMs: WED_1PM }).status).toBe('short_unsupported');
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
  // Refinement 2026-11-10 (BD-8): the chip names the CHECK (`at the 1:00 check`), not a bare time.
  it('format: live $160.27 · scored $160.19 at the 1:00 check, from the shared priceFormat', () => {
    expect(scoredChipText({ live: 160.27, scored, decimals: 2, always: true })).toBe('live $160.27 · scored $160.19 at the 1:00 check');
  });
  it('red zone: always, even when the two agree', () => { expect(scoredChipText({ live: 160.19, scored, decimals: 2, always: true })).toBe('live $160.19 · scored $160.19 at the 1:00 check'); });
  it('elsewhere: only when they differ by at least one display unit', () => {
    expect(scoredChipText({ live: 160.194, scored, decimals: 2 })).toBeNull();
    expect(scoredChipText({ live: 160.2, scored, decimals: 2 })).toBe('live $160.20 · scored $160.19 at the 1:00 check');
  });
  it('the closed view says last tick', () => { expect(scoredChipText({ live: 162.86, scored, decimals: 2, always: true, frozen: true })).toBe('last $162.86 · scored $160.19 at the 1:00 check'); });
  it('no scored price (a preview) → no chip', () => { expect(scoredChipText({ live: 160, scored: null, always: true })).toBeNull(); });
  it('a sub-dollar asset prints with its own decimals', () => { expect(scoredChipText({ live: 0.2049, scored: { price: 0.2051, atMs: scored.atMs }, decimals: 4 })).toBe('live $0.2049 · scored $0.2051 at the 1:00 check'); });
});

describe('what has to happen — templates only (spec §4.3)', () => {
  const held = legacyLadder({ record: selectBombRecord(legacyBattle({ thresholdHistory: {} }), 'EOG', WED_1PM), previousClose: 155.6, nowMs: WED_1PM });
  // Refinement 2026-11-10 (BD-4): the held line is lead-aware; with the upside leading it names the points and the bust price too.
  it('held, up leading: Needs $X at a check for +15 · Bust at $Y · next check 3:45', () => { expect(sheetLine({ ladder: held, clockLabel: '3:45', decimals: 2 })).toBe('Needs $161.21 at a check for +15 · Bust at $149.99 · next check 3:45'); });
  it('after a bank the modal SAW: +15 banked at the 1:15 check. Next: …', () => {
    const banked = legacyLadder({ record: selectBombRecord(legacyBattle(), 'EOG', WED_1PM), previousClose: 155.6, nowMs: WED_1PM });
    expect(sheetLine({ ladder: banked, bankedTimes: { bagger: at('2026-10-14T17:15:00.000Z') }, decimals: 2 })).toBe('+15 banked at the 1:15 check. Next: $164.01 at a check');
  });
  it('BA-4: a bank the modal did not see carries no time', () => {
    const banked = legacyLadder({ record: selectBombRecord(legacyBattle(), 'EOG', WED_1PM), previousClose: 155.6, nowMs: WED_1PM });
    expect(sheetLine({ ladder: banked, bankedTimes: {}, decimals: 2 })).toBe('+15 banked. Next: $164.01 at a check');
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
    expect(toGoText(l, toGo(l, 106.2))).toBe('At +15 · live $106.20'); // a preview: no check scores a stock nobody holds
    const held = measuredLadder({ measured: { measured: true, baselinePrice: 100, targets: [['bagger', 106], ['doubleBagger', 109], ['tenBagger', 112], ['bust', 94], ['crash', 91], ['meltdown', 88]].map(([key, price]) => ({ key, price })), crossedTiers: [] } });
    expect(toGoText(held, toGo(held, 106.2))).toBe('At +15 · a check decides · live $106.20');
    expect(toGoText(held, toGo(held, 106.2), { closed: true })).toBe('At +15 · a check decides · last $106.20');
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
