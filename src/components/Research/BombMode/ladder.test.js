// Research Modal Build A — the ladder (spec §3.1, §3.6, §3.7, §6 "Ladder").
import { describe, it, expect } from 'vitest';
import { measuredLadder, legacyLadder, previewLadder, v4Ladder, v4LevelsFor, brickPlan, bricksSupported, toGo, kOf, BRICKS_PER_THRESHOLD } from './ladder.js';
import { selectBombRecord } from './selectBombRecord.js';
import { legacyBattle } from './__fixtures__/bombBattles.js';
import { BAGGER_TIERS, BUST_TIERS, THRESHOLD_MULTIPLIERS } from '../../../constants/baggerBombScoring.js';

const WED_1PM = Date.parse('2026-10-14T17:00:00.000Z');
const TUE_11AM = Date.parse('2026-10-13T15:00:00.000Z');
const PREV_CLOSE = 155.6;
const rungPrice = (l, key) => l.rungs.find((r) => r.key === key).price;

// The server's inline rule, restated (agent-evaluate.js :1301–1302) — the pin.
const serverBaseline = ({ swapPrice, startingPrice, isActivationDay }, previousClose) =>
  swapPrice || (isActivationDay ? (startingPrice || previousClose) : previousClose);

describe('legacy held ladder — the precedence, branch by branch, against the server rule', () => {
  const cases = [
    ['swapPrice wins on any day', (b) => { b.portfolio.star[0].swapPrice = 155.1; }, WED_1PM, 155.1, 'swap_price'],
    ['activation day, starting price', () => {}, TUE_11AM, 154.76, 'starting_price'],
    ['activation day, no starting price → previous close', (b) => { delete b.portfolio.startingPrices.EOG; }, TUE_11AM, PREV_CLOSE, 'previous_close'],
    ['day 2+: previous close, the starting price is NOT used', () => {}, WED_1PM, PREV_CLOSE, 'previous_close'],
  ];
  it.each(cases)('%s', (_, tweak, now, want, source) => {
    const b = legacyBattle(); tweak(b);
    const record = selectBombRecord(b, 'EOG', now);
    const l = legacyLadder({ record, previousClose: PREV_CLOSE, nowMs: now });
    expect(l.status).toBe('ok');
    expect(l.baseline).toMatchObject({ price: want, source });
    expect(l.baseline.price).toBe(serverBaseline(record.baselineInputs, PREV_CLOSE));
  });
  it('entry unavailable when the precedence yields nothing — never drawn from 0', () => {
    const record = selectBombRecord(legacyBattle(), 'EOG', WED_1PM);
    const l = legacyLadder({ record, previousClose: null, nowMs: WED_1PM });
    expect(l.status).toBe('entry_unavailable');
    expect(l.rungs).toEqual([]);
    expect(l.next).toBeNull();
  });
  it('rungs = baseline × (1 + m × threshold/100) with the canonical multipliers; points from the constants module', () => {
    const record = selectBombRecord(legacyBattle(), 'EOG', WED_1PM);
    const l = legacyLadder({ record, previousClose: PREV_CLOSE, nowMs: WED_1PM });
    for (const t of [...BAGGER_TIERS, ...BUST_TIERS]) {
      expect(rungPrice(l, t.key)).toBeCloseTo(PREV_CLOSE * (1 + (THRESHOLD_MULTIPLIERS[t.key] * 3.6) / 100), 10);
      expect(l.rungs.find((r) => r.key === t.key).points).toBe(t.points);
    }
  });
  it('banked = today\'s maxMultiplier mapped by the same multipliers (1.12 → BaggerBomb only); downside by minMultiplier', () => {
    const record = selectBombRecord(legacyBattle(), 'EOG', WED_1PM);
    const l = legacyLadder({ record, previousClose: PREV_CLOSE, nowMs: WED_1PM });
    expect(l.up.map((r) => [r.key, r.banked])).toEqual([['bagger', true], ['doubleBagger', false], ['tenBagger', false]]);
    expect(l.down.every((r) => !r.banked)).toBe(true);
    expect(l.next.key).toBe('doubleBagger');
    expect(l.bankedPoints).toBe(15);
    const b = legacyBattle({ thresholdHistory: { EOG: { maxMultiplier: 0.2, minMultiplier: -1.5 } } });
    const d = legacyLadder({ record: selectBombRecord(b, 'EOG', WED_1PM), previousClose: PREV_CLOSE, nowMs: WED_1PM });
    expect(d.down.map((r) => [r.key, r.banked])).toEqual([['bust', true], ['crash', true], ['meltdown', false]]);
    expect(d.next.key).toBe('bagger');
  });
});

describe('measured held ladder — the modal\'s bombData.measured, never re-derived', () => {
  const measured = { measured: true, baselinePrice: 100.75, targets: [['bagger', 102.765], ['doubleBagger', 103.7725], ['tenBagger', 104.78], ['bust', 98.735], ['crash', 97.7275], ['meltdown', 96.72]].map(([key, price]) => ({ key, price })), crossedTiers: ['bagger'] };
  it('takes each target and crossed tier exactly as handed', () => {
    const l = measuredLadder({ measured, entryAtMs: 5 });
    expect(l).toMatchObject({ status: 'ok', kind: 'held', model: 'measured', baseline: { price: 100.75, source: 'fill', atMs: 5 } });
    for (const t of measured.targets) expect(rungPrice(l, t.key)).toBe(t.price);
    expect(l.up.map((r) => r.banked)).toEqual([true, false, false]);
    expect(l.next.key).toBe('doubleBagger');
  });
  it('null or incomplete bombData → measured unavailable', () => {
    expect(measuredLadder({ measured: null }).status).toBe('measured_unavailable');
    expect(measuredLadder({ measured: { ...measured, targets: measured.targets.slice(0, 5) } }).status).toBe('measured_unavailable');
    expect(measuredLadder({ measured: { threshold: 2.5, baselinePrice: 99 } }).status).toBe('measured_unavailable');
  });
});

describe('preview and V4 (BA-1, §3.7)', () => {
  it('preview: yesterday\'s close × the threshold, nothing banked', () => {
    const l = previewLadder({ previousClose: 99, threshold: 2 });
    expect(l).toMatchObject({ status: 'ok', kind: 'preview', model: 'preview', baseline: { price: 99, source: 'previous_close' } });
    expect(rungPrice(l, 'bagger')).toBeCloseTo(100.98, 10);
    expect(rungPrice(l, 'meltdown')).toBeCloseTo(95.04, 10);
    expect(l.rungs.some((r) => r.banked)).toBe(false);
  });
  it('preview without a close or threshold → no ladder', () => {
    expect(previewLadder({ previousClose: null, threshold: 2 }).status).toBe('preview_unavailable');
    expect(previewLadder({ previousClose: 99, threshold: 0 }).status).toBe('preview_unavailable');
  });
  it('V4: today\'s dailyLevels and their baseline; levels from another day are not used', () => {
    const dailyLevels = { date: '2026-10-14', assets: { EOG: { baseline: 150, baggerBomb: 154.5, doubleBagger: 156.75, tenBagger: 159, bust: 145.5, crash: 143.25, meltdown: 141, threshold: 3 } } };
    const levels = v4LevelsFor(dailyLevels, 'EOG', WED_1PM);
    const l = v4Ladder({ levels });
    expect(l).toMatchObject({ status: 'ok', kind: 'preview', model: 'v4', baseline: { price: 150, source: 'daily_levels' } });
    expect(rungPrice(l, 'doubleBagger')).toBe(156.75);
    expect(v4LevelsFor({ ...dailyLevels, date: '2026-10-13' }, 'EOG', WED_1PM)).toBeNull();
    expect(v4LevelsFor(dailyLevels, 'XOM', WED_1PM)).toBeNull();
  });
});

describe('bricks (R-11′(a), §3.6)', () => {
  const l = previewLadder({ previousClose: 154.76, threshold: 3.6 });
  it('the canonical multipliers are 1 · 1.5 · 2, so brick = threshold/6 and the rungs sit on bricks 6 · 9 · 12', () => {
    expect(bricksSupported()).toBe(true);
    const plan = brickPlan(l);
    expect(BRICKS_PER_THRESHOLD).toBe(6);
    expect(plan.rungBricks).toEqual({ bagger: 6, doubleBagger: 9, tenBagger: 12 });
    expect(plan.unit).toBeCloseTo((154.76 * 3.6) / 100 / 6, 12);
    for (const r of l.up) expect((r.price - 154.76) / plan.unit).toBeCloseTo(plan.rungBricks[r.key], 9);
  });
  it('any other multiplier set omits the bricks (and the to-go label drops the brick count)', () => {
    const odd = [{ multiplier: 1 }, { multiplier: 1.6 }, { multiplier: 2 }];
    expect(bricksSupported(odd)).toBe(false);
    expect(brickPlan(l, odd)).toBeNull();
    expect(toGo(l, 158, { tiers: odd }).bricks).toBeNull();
  });
  it('the to-go bricks round UP: 1.01 bricks to go reads 2', () => {
    const plan = brickPlan(l);
    const next = l.next.price;
    const live = Number((next - plan.unit * 1.01).toFixed(2));
    const go = toGo(l, live);
    expect(go.distance / plan.unit).toBeGreaterThan(1);
    expect(go.distance / plan.unit).toBeLessThan(2);
    expect(go.bricks).toBe(2);
  });
  it('exactly 2 bricks away reads 2, not 3', () => {
    const p = previewLadder({ previousClose: 100, threshold: 6 }); // brick = $1.00, bagger at $106
    expect(toGo(p, 104).bricks).toBe(2);
  });
});

describe('toGo — the distance from DISPLAYED values (BUILD_RULES §9)', () => {
  it('rung and live are rounded to the display decimals first; % is of the displayed live price', () => {
    const l = previewLadder({ previousClose: 154.76, threshold: 3.6 }); // bagger 160.33136
    const go = toGo(l, 160.2649);
    expect(go.rungShown).toBe(160.33);
    expect(go.liveShown).toBe(160.26);
    expect(go.distance).toBe(0.07);
    expect(go.pct).toBeCloseTo((0.07 / 160.26) * 100, 12);
  });
  it('a price above an unbanked rung has distance ≤ 0 and zero bricks', () => {
    const l = previewLadder({ previousClose: 100, threshold: 2 });
    const go = toGo(l, 102.5);
    expect(go.distance).toBeLessThan(0);
    expect(go.bricks).toBe(0);
  });
  it('no next rung (all banked) → null', () => {
    const measured = { measured: true, baselinePrice: 100, targets: [['bagger', 102], ['doubleBagger', 103], ['tenBagger', 104], ['bust', 98], ['crash', 97], ['meltdown', 96]].map(([key, price]) => ({ key, price })), crossedTiers: ['bagger', 'doubleBagger', 'tenBagger'] };
    expect(toGo(measuredLadder({ measured }), 105)).toBeNull();
  });
  it('kOf measures the live price in thresholds from the baseline', () => {
    const l = previewLadder({ previousClose: 100, threshold: 2 });
    expect(kOf(l, 103)).toBeCloseTo(1.5, 12);
    expect(kOf(l, 98)).toBeCloseTo(-1, 12);
  });
});
