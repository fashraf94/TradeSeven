// Bomb mode refinement (2026-11-10) — BD-5: THE DANGER ZONE, the red zone's
// mirror below, and how the two zones share the 💣 view. Pure. The red zone's
// own rows (redZone.test.js) keep their meaning unedited.
import { describe, it, expect } from 'vitest';
import {
  stepDangerZone, DANGER_ZONE_INITIAL, stepZones, ZONES_INITIAL, isDangerZoneMode, isZoneMode, isRedZoneMode,
  RED_ZONE_ENTER_PCT, RED_ZONE_EXIT_PCT,
} from './redZone.js';
import * as redZoneModule from './redZone.js';
import { previewLadder, toGo, toGoDown } from './ladder.js';

const held = (over = {}) => ({ held: true, crypto: false, marketOpen: true, positionId: 'p1', bankedUp: [], next: { key: 'bagger', pct: 3 }, hitDown: [], nextDown: { key: 'bust', pct: 1 }, ...over });
const runD = (inputs) => inputs.reduce((s, i) => stepDangerZone(s, i), DANGER_ZONE_INITIAL);
const runZ = (inputs) => inputs.reduce((s, i) => stepZones(s, i), ZONES_INITIAL);
const dz = (pct, key = 'bust', over = {}) => held({ nextDown: { key, pct }, ...over });

describe('the band constants stay in one place (redZone.js)', () => {
  it('the Danger Zone reads the red zone\'s constants — no second pair exists', () => {
    expect(Object.keys(redZoneModule).filter((k) => /PCT$/.test(k)).sort()).toEqual(['RED_ZONE_ENTER_PCT', 'RED_ZONE_EXIT_PCT']);
    expect(runD([dz(RED_ZONE_ENTER_PCT)]).mode).toBe('danger');
    expect(runD([dz(0.3), dz(RED_ZONE_EXIT_PCT)]).mode).toBe('danger');
  });
});

describe('enter · stay · leave', () => {
  it('enters within 0.50 % above the next unhit downside rung', () => { expect(runD([dz(0.5)]).mode).toBe('danger'); });
  it('does not enter at 0.51 %', () => { expect(runD([dz(0.51)]).mode).toBe('fuse'); });
  it('at or below the rung counts as inside (a check has not read it)', () => {
    expect(runD([dz(0)]).mode).toBe('danger');
    expect(runD([dz(-0.4)]).mode).toBe('danger');
  });
  it('stays to 0.75 %, leaves past it', () => {
    expect(runD([dz(0.5), dz(0.74)]).mode).toBe('danger');
    expect(runD([dz(0.5), dz(0.75)]).mode).toBe('danger');
    expect(runD([dz(0.5), dz(0.76)]).mode).toBe('fuse');
  });
  it('0.74 % from the Fuse does not enter (the stay band is only for a zone already entered)', () => {
    expect(runD([dz(0.9), dz(0.74)]).mode).toBe('fuse');
  });
  it('the rung hit: the next rung below is judged afresh at the ENTER band', () => {
    expect(runD([dz(0.2), dz(0.6, 'crash', { hitDown: ['bust'] })]).mode).toBe('fuse');
    expect(runD([dz(0.2), dz(0.4, 'crash', { hitDown: ['bust'] })])).toMatchObject({ mode: 'danger', rungKey: 'crash' });
  });
  it('the close: inside the ENTER band → the frozen view; otherwise the Fuse; reopening goes straight back', () => {
    expect(runD([dz(0.3), dz(0.3, 'bust', { marketOpen: false })]).mode).toBe('dangerClosed');
    expect(runD([dz(0.3), dz(0.6, 'bust', { marketOpen: false })]).mode).toBe('fuse');
    expect(runD([dz(0.3, 'bust', { marketOpen: false }), dz(0.3)]).mode).toBe('danger');
  });
});

describe('never: preview, held-preview, League, crypto', () => {
  it('a preview (and a held-preview: a legacy stock, any crypto; and a League battle — all reach the machine with held false) never enters', () => {
    expect(runD([dz(0.1, 'bust', { held: false })]).mode).toBe('fuse');
  });
  it('crypto never enters', () => { expect(runD([dz(0.1, 'bust', { crypto: true })]).mode).toBe('fuse'); });
  it('nothing left below (every downside rung hit) → the Fuse', () => {
    expect(runD([held({ nextDown: null, hitDown: ['bust', 'crash', 'meltdown'] })]).mode).toBe('fuse');
  });
});

describe('a hit plays no moment', () => {
  it('a hit the modal SEES is reported once (to name its check) and never changes the mode to a takeover', () => {
    const s = runD([dz(0.2), dz(1.6, 'crash', { hitDown: ['bust'] })]);
    expect(s.freshHits).toEqual(['bust']);
    expect(s.mode).toBe('fuse');
    const next = stepDangerZone(s, dz(1.6, 'crash', { hitDown: ['bust'] }));
    expect(next.freshHits).toEqual([]);
  });
  it('a rung already hit at the first look is not a fresh hit', () => {
    expect(runD([dz(1.6, 'crash', { hitDown: ['bust'] })]).freshHits).toEqual([]);
  });
  it('a loading ladder (not yet held) seeds nothing', () => {
    expect(runD([held({ held: false }), dz(1.6, 'crash', { hitDown: ['bust'] })]).freshHits).toEqual([]);
  });
  it('the zone modes are their own: never a red-zone mode', () => {
    expect(['danger', 'dangerClosed'].map(isDangerZoneMode)).toEqual([true, true]);
    expect(['danger', 'dangerClosed'].map(isRedZoneMode)).toEqual([false, false]);
    expect(['fuse', 'approaching', 'banked', 'closed', 'danger', 'dangerClosed'].map(isZoneMode)).toEqual([false, true, true, true, true, true]);
  });
});

describe('both zones on one view', () => {
  it('only the red band → the red zone; only the danger band → the Danger Zone', () => {
    expect(runZ([held({ next: { key: 'bagger', pct: 0.3 } })])).toMatchObject({ shown: 'red', mode: 'approaching' });
    expect(runZ([held({ nextDown: { key: 'bust', pct: 0.3 } })])).toMatchObject({ shown: 'danger', mode: 'danger' });
    expect(runZ([held()])).toMatchObject({ shown: null, mode: 'fuse' });
  });
  it('both bands on a first look: the nearer wins; a tie goes to the red zone', () => {
    expect(runZ([held({ next: { key: 'bagger', pct: 0.4 }, nextDown: { key: 'bust', pct: 0.2 } })]).shown).toBe('danger');
    expect(runZ([held({ next: { key: 'bagger', pct: 0.2 }, nextDown: { key: 'bust', pct: 0.4 } })]).shown).toBe('red');
    expect(runZ([held({ next: { key: 'bagger', pct: 0.3 }, nextDown: { key: 'bust', pct: 0.3 } })]).shown).toBe('red');
  });
  it('both bands: the zone already showing stays, even when the other becomes nearer', () => {
    const s = runZ([held({ next: { key: 'bagger', pct: 0.3 } }), held({ next: { key: 'bagger', pct: 0.45 }, nextDown: { key: 'bust', pct: 0.05 } })]);
    expect(s).toMatchObject({ shown: 'red', mode: 'approaching' });
    const d = runZ([held({ nextDown: { key: 'bust', pct: 0.3 } }), held({ next: { key: 'bagger', pct: 0.01 }, nextDown: { key: 'bust', pct: 0.45 } })]);
    expect(d).toMatchObject({ shown: 'danger', mode: 'danger' });
  });
  it('the red zone\'s banked moment always shows (the one takeover)', () => {
    const s = runZ([held({ next: { key: 'bagger', pct: 0.1 }, nextDown: { key: 'bust', pct: 0.4 } }), held({ bankedUp: ['bagger'], next: { key: 'doubleBagger', pct: 1.4 }, nextDown: { key: 'bust', pct: 0.4 } })]);
    expect(s).toMatchObject({ shown: 'red', mode: 'banked' });
  });
  it('a preview never shows either zone, even inside both bands', () => {
    expect(runZ([held({ held: false, next: { key: 'bagger', pct: 0.1 }, nextDown: { key: 'bust', pct: 0.1 } })]).mode).toBe('fuse');
  });
  it('a real ladder: a stock hugging its bust tier enters the Danger Zone, not the red zone (BA-2 still holds for the red zone)', () => {
    const l = previewLadder({ previousClose: 100, threshold: 2 }); // bust $98, bagger $102
    const up = toGo(l, 98.3);
    const down = toGoDown(l, 98.3);
    const s = runZ([held({ next: { key: up.rung.key, pct: up.pctShown }, nextDown: { key: down.rung.key, pct: down.pctShown } })]);
    expect(s.red.mode).toBe('fuse');
    expect(s).toMatchObject({ shown: 'danger', mode: 'danger' });
  });
});
