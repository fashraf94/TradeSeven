// Research Modal Build C — founder rulings FQ-9 and FQ-6 (2026-11-08), the pure halves.
//
// FQ-9: with the sheet AND Bomb mode on, a measured held stock inside the
// red-zone band when the modal opens (market open; Build A's red-zone machine;
// ≤ 0.5 % to the next unbanked rung, as Bomb mode prints it) opens on 💣; every
// other case opens on the sheet. FQ-6: the phone modal's height in sheet mode.

import { describe, it, expect, beforeAll } from 'vitest';
import { opensInRedZone } from './sheetOpen.js';
import { visibleViewportHeight } from './sheetViewport.js';
import { measuredSheetBattle, SHEET_NOW } from './__fixtures__/sheetBattles.js';
import { agentBombContext } from '../BombMode/selectBombRecord.js';
import { RED_ZONE_ENTER_PCT } from '../BombMode/redZone.js';
import { measuredLadder } from '../BombMode/ladder.js';

let BATTLE;
let HELD;
beforeAll(async () => {
  BATTLE = await measuredSheetBattle({ archetype: 'momentum_chaser' });
  HELD = agentBombContext(BATTLE, 'AAPL', SHEET_NOW, { battleId: 'stock-battle', positionId: 'position-agent' });
});
const open = (over = {}) => opensInRedZone({ bombContext: HELD, symbol: 'AAPL', live: 103.4, nowMs: SHEET_NOW, ...over });

describe('FQ-9 — the red zone at open (the next rung is +30, exact $103.7725, shown $103.78 since Bomb mode BP-1; Wed 1:07 PM ET, the market open)', () => {
  it('the fixture is what the rows assume: a measured held record, the band is 0.5 %', () => {
    expect([HELD.kind, HELD.held, HELD.record?.model]).toEqual(['agent', true, 'measured']);
    expect(RED_ZONE_ENTER_PCT).toBe(0.5);
  });
  it('inside the band (live $103.40: $0.38 to go, 0.37 %) → opens on 💣', () => {
    expect(open()).toBe(true);
  });
  it('the band edge as Bomb mode prints it: $103.26 is 0.50 % → in; $103.25 is 0.51 % → out', () => {
    expect(open({ live: 103.26 })).toBe(true);
    expect(open({ live: 103.25 })).toBe(false);
  });
  it('outside the band (live $103.20: 0.56 %) → the sheet', () => {
    expect(open({ live: 103.2 })).toBe(false);
  });
  it('a price past an unbanked rung is in the zone (the check has not read it yet) → 💣', () => {
    expect(open({ live: 104.0 })).toBe(true);
  });
  it('the market closed (Wed 8:00 PM ET, Sat noon) → the sheet, even inside the band', () => {
    expect(open({ nowMs: Date.parse('2026-10-15T00:00:00.000Z') })).toBe(false);
    expect(open({ nowMs: Date.parse('2026-10-17T16:00:00.000Z') })).toBe(false);
  });
  it('no price yet → the sheet', () => {
    for (const live of [null, undefined, 0, Number.NaN]) expect(open({ live })).toBe(false);
  });
  it('BD-5 (refinement 2026-11-10): inside the Danger Zone band at open (0.5 % above the next unhit downside rung) → also 💣', () => {
    const below = measuredLadder({ measured: HELD.record.measured }).nextDown;
    expect(below).not.toBeNull();
    expect(open({ live: Number((below.price * 1.003).toFixed(2)) })).toBe(true);
    expect(open({ live: Number((below.price * 1.008).toFixed(2)) })).toBe(false);
    expect(open({ live: Number((below.price * 1.003).toFixed(2)), nowMs: Date.parse('2026-10-17T16:00:00.000Z') })).toBe(false); // closed: the sheet
  });
  it('never for crypto, a legacy-scored holding, a name not held, or a mount without Bomb mode', () => {
    expect(open({ isCrypto: true })).toBe(false);
    expect(open({ bombContext: { ...HELD, record: { ...HELD.record, model: 'legacy' } } })).toBe(false);
    expect(open({ bombContext: { ...HELD, held: false } })).toBe(false);
    expect(open({ bombContext: { kind: 'bench' } })).toBe(false);
    expect(open({ bombContext: null })).toBe(false);
  });
});

describe('FQ-6 — the phone modal in sheet mode takes the visible viewport', () => {
  it('100dvh where the browser has it, else 100vh; a throwing support test reads 100vh', () => {
    expect(visibleViewportHeight((p, v) => p === 'height' && v === '100dvh')).toBe('100dvh');
    expect(visibleViewportHeight(() => false)).toBe('100vh');
    expect(visibleViewportHeight(() => { throw new Error('no CSS'); })).toBe('100vh');
    expect(visibleViewportHeight()).toBe('100vh'); // Node: no CSS global
  });
});
