// Bomb mode refinement — both directions (2026-11-10): BD-1 (one ladder, both
// directions; toGoDown; the downside bricks) and BD-2 (the lead side, with a
// one-brick band). Pure. The AMZN fixture is the founder's Nov 10 position in
// production shape (build report §1.1).
import { describe, it, expect } from 'vitest';
import { measuredLadder, previewLadder, toGo, toGoDown, brickPlan, brickUnit, bricksSupported, rungPct, stepLead, LEAD_BAND_BRICKS } from './ladder.js';
import { amznRecord } from './__fixtures__/bombBattles.js';
import { BAGGER_TIERS, BUST_TIERS } from '../../../constants/baggerBombScoring.js';

const amzn = (over = {}) => measuredLadder({ measured: amznRecord(over).measured, entryAtMs: amznRecord(over).entry.atMs });
const at = (l, key) => l.rungs.find((r) => r.key === key);

describe('BD-1 — one ladder, both directions', () => {
  it('finish names the next unhit downside rung in the scorer\'s order (bust → crash → meltdown) and the hit points', () => {
    const l = amzn();
    expect(l.nextDown.key).toBe('bust');
    expect(l.hitPoints).toBe(0);
    const hit = amzn({ crossedTiers: ['bust'] });
    expect(hit.nextDown.key).toBe('crash');
    expect(hit.hitPoints).toBe(-10);
    const two = amzn({ crossedTiers: ['bust', 'crash'] });
    expect(two.nextDown.key).toBe('meltdown');
    expect(two.hitPoints).toBe(-30);
    expect(amzn({ crossedTiers: ['bust', 'crash', 'meltdown'] }).nextDown).toBeNull();
  });
  it('a crossed DOWNSIDE rung is "hit"; an upside rung never is', () => {
    const l = amzn({ crossedTiers: ['bust', 'bagger'] });
    expect(at(l, 'bust').hit).toBe(true);
    expect(at(l, 'bagger').hit).toBe(false);
    expect(at(l, 'crash').hit).toBe(false);
  });
  it('the downside prices and hit states are the committed context\'s — nothing re-derived', () => {
    const rec = amznRecord({ crossedTiers: ['bust'] });
    const l = measuredLadder({ measured: rec.measured });
    for (const t of rec.measured.targets) expect(at(l, t.key).price).toBe(t.price);
    expect(l.down.map((r) => [r.key, r.hit])).toEqual([['bust', true], ['crash', false], ['meltdown', false]]);
  });
  it('the founder\'s AMZN: Bust $259.53, +15 $280.91; at $268.09 → ↓ 3.19 % · 5 bricks, ↑ 4.78 % · 8 bricks', () => {
    const l = amzn();
    const down = toGoDown(l, 268.09, { decimals: 2 });
    const up = toGo(l, 268.09, { decimals: 2 });
    expect(down).toMatchObject({ side: 'down', rungShown: 259.53, liveShown: 268.09, distance: 8.56, pctShown: 3.19, bricks: 5 });
    expect(up).toMatchObject({ side: 'up', rungShown: 280.91, liveShown: 268.09, distance: 12.82, pctShown: 4.78, bricks: 8 });
    expect(down.bricksExact).toBeLessThan(up.bricksExact);
  });
  it('toGoDown is the mirror in DISPLAYED values: distance = liveShown − rungShown, % of the displayed live price, bricks rounded up', () => {
    const l = previewLadder({ previousClose: 100, threshold: 6 }); // bust $94, brick $1
    const go = toGoDown(l, 95.2649);
    expect(go.rungShown).toBe(94);
    expect(go.liveShown).toBe(95.26);
    expect(go.distance).toBe(1.26);
    expect(go.pct).toBeCloseTo((1.26 / 95.26) * 100, 12);
    expect(go.bricks).toBe(2); // 1.26 bricks → 2
    expect(toGoDown(l, 96).bricks).toBe(2); // exactly 2 → 2, not 3
  });
  it('at or below the rung: distance ≤ 0 and zero bricks (a check has not read it yet)', () => {
    const l = previewLadder({ previousClose: 100, threshold: 6 });
    expect(toGoDown(l, 94).distance).toBe(0);
    expect(toGoDown(l, 93.5)).toMatchObject({ bricks: 0 });
    expect(toGoDown(l, 93.5).distance).toBeLessThan(0);
  });
  it('the brick unit serves both sides; the bust multipliers sit on whole bricks (6 · 9 · 12)', () => {
    expect(bricksSupported(BUST_TIERS)).toBe(true);
    const l = previewLadder({ previousClose: 100, threshold: 6 });
    expect(brickPlan(l, BUST_TIERS)).toEqual({ unit: brickUnit(l), rungBricks: { bust: 6, crash: 9, meltdown: 12 }, total: 12 });
    expect(brickPlan(l, BAGGER_TIERS).unit).toBe(brickPlan(l, BUST_TIERS).unit);
  });
  it('if the bust multipliers stopped sitting on bricks, only the downside counts go — the upside keeps its bricks', () => {
    const odd = [{ multiplier: 1 }, { multiplier: 1.6 }, { multiplier: 2 }];
    const l = previewLadder({ previousClose: 100, threshold: 6 });
    expect(toGoDown(l, 96, { tiers: odd }).bricks).toBeNull();
    expect(toGoDown(l, 96, { tiers: odd }).bricksExact).toBeCloseTo(2, 12); // the lead rule still measures it
    expect(toGo(l, 104).bricks).toBe(2);
  });
  it('rungPct: the move from the DISPLAYED baseline to the displayed rung (AMZN +15: $270.22 → $280.91 = +3.956 %)', () => {
    const l = amzn();
    expect(rungPct(l, at(l, 'bagger'), 2)).toBeCloseTo(((280.91 - 270.22) / 270.22) * 100, 12);
    expect(rungPct(l, at(l, 'bust'), 2)).toBeCloseTo(((259.53 - 270.22) / 270.22) * 100, 12);
  });
});

describe('BD-2 — the lead side, with a one-brick band', () => {
  it('the band is one brick', () => { expect(LEAD_BAND_BRICKS).toBe(1); });
  it('first look: the nearer side leads; a tie goes up; at entry (6 bricks each way) the lead is up', () => {
    expect(stepLead(null, { up: 6, down: 6 })).toBe('up');
    expect(stepLead(null, { up: 5.9, down: 6 })).toBe('up');
    expect(stepLead(null, { up: 6, down: 5.9 })).toBe('down');
    const l = amzn();
    const go = toGo(l, 270.22, { decimals: 2 });
    const goDown = toGoDown(l, 270.22, { decimals: 2 });
    expect(go.bricksExact).toBeCloseTo(6, 2);
    expect(goDown.bricksExact).toBeCloseTo(6, 2);
    expect(stepLead(null, { up: go.bricksExact, down: goDown.bricksExact })).toBe('up');
  });
  it('the founder\'s AMZN at $268.09 leads DOWN (Bust is 4.8 bricks away, +15 is 7.2)', () => {
    const l = amzn();
    expect(stepLead(null, { up: toGo(l, 268.09).bricksExact, down: toGoDown(l, 268.09).bricksExact })).toBe('down');
  });
  it('a price wandering ±0.45 brick around the midpoint for 200 steps never switches', () => {
    const l = previewLadder({ previousClose: 100, threshold: 6 }); // brick $1, ±6 bricks from $100
    let lead = null;
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      const live = Number((100 + 0.45 * Math.sin(i * 0.7) * (i % 2 ? 1 : -1)).toFixed(2));
      lead = stepLead(lead, { up: toGo(l, live).bricksExact, down: toGoDown(l, live).bricksExact });
      seen.add(lead);
    }
    expect([...seen]).toEqual(['up']);
  });
  it('…and from a down lead it never switches back either', () => {
    const l = previewLadder({ previousClose: 100, threshold: 6 });
    let lead = 'down';
    for (let i = 0; i < 200; i += 1) {
      const live = Number((100 + 0.45 * Math.cos(i * 1.3)).toFixed(2));
      lead = stepLead(lead, { up: toGo(l, live).bricksExact, down: toGoDown(l, live).bricksExact });
      expect(lead).toBe('down');
    }
  });
  it('a steady one-brick move switches exactly once', () => {
    const l = previewLadder({ previousClose: 100, threshold: 6 });
    let lead = null;
    const leads = [];
    for (let c = 0; c <= 100; c += 1) {
      const live = Number((100 - c / 100).toFixed(2)); // $100 → $99, one brick down, a cent at a time
      lead = stepLead(lead, { up: toGo(l, live).bricksExact, down: toGoDown(l, live).bricksExact });
      if (leads[leads.length - 1] !== lead) leads.push(lead);
    }
    expect(leads).toEqual(['up', 'down']);
  });
  it('a side with no next rung never leads; both null → no lead', () => {
    expect(stepLead('down', { up: 3, down: null })).toBe('up');
    expect(stepLead('up', { up: null, down: 9 })).toBe('down');
    expect(stepLead('up', { up: null, down: null })).toBeNull();
  });
  it('inside a red zone the upside leads; inside a Danger Zone the downside leads', () => {
    expect(stepLead('down', { up: 3, down: 1, zone: 'red' })).toBe('up');
    expect(stepLead('up', { up: 1, down: 3, zone: 'danger' })).toBe('down');
  });
  it('at or past a rung (a negative distance) that side is nearest', () => {
    expect(stepLead('up', { up: 4, down: -0.2 })).toBe('down');
  });
});
