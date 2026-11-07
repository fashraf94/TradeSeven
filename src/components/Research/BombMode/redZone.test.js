// Research Modal Build A — the red zone machine (BA-2, BA-3; spec §6 "Red zone").
import { describe, it, expect } from 'vitest';
import { stepRedZone, RED_ZONE_INITIAL, RED_ZONE_ENTER_PCT, RED_ZONE_EXIT_PCT, isRedZoneMode } from './redZone.js';
import { previewLadder, toGo } from './ladder.js';

const held = (over = {}) => ({ held: true, crypto: false, marketOpen: true, positionId: 'p1', bankedUp: [], next: { key: 'bagger', pct: 1 }, ...over });
const run = (inputs) => inputs.reduce((s, i) => stepRedZone(s, i), RED_ZONE_INITIAL);

describe('the band constants (FQ-2, BA-3) live in one module', () => {
  it('enter 0.5 %, leave past 0.75 %', () => { expect(RED_ZONE_ENTER_PCT).toBe(0.5); expect(RED_ZONE_EXIT_PCT).toBe(0.75); });
});

describe('enter · stay · leave (hysteresis)', () => {
  it('enters at 0.50 %', () => { expect(run([held({ next: { key: 'bagger', pct: 0.5 } })]).mode).toBe('approaching'); });
  it('does not enter at 0.51 %', () => { expect(run([held({ next: { key: 'bagger', pct: 0.51 } })]).mode).toBe('fuse'); });
  it('stays at 0.74 %', () => { expect(run([held({ next: { key: 'bagger', pct: 0.5 } }), held({ next: { key: 'bagger', pct: 0.74 } })]).mode).toBe('approaching'); });
  it('stays at exactly 0.75 %', () => { expect(run([held({ next: { key: 'bagger', pct: 0.4 } }), held({ next: { key: 'bagger', pct: 0.75 } })]).mode).toBe('approaching'); });
  it('leaves at 0.76 %', () => { expect(run([held({ next: { key: 'bagger', pct: 0.5 } }), held({ next: { key: 'bagger', pct: 0.76 } })]).mode).toBe('fuse'); });
  it('0.74 % from the Fuse does not enter (the stay band is only for a zone already entered)', () => { expect(run([held({ next: { key: 'bagger', pct: 0.9 } }), held({ next: { key: 'bagger', pct: 0.74 } })]).mode).toBe('fuse'); });
  it('a price above an unbanked rung (distance < 0) is in the zone — the check has not read it', () => { expect(run([held({ next: { key: 'bagger', pct: -0.2 } })]).mode).toBe('approaching'); });
});

describe('never: preview, crypto, downside (BA-2)', () => {
  it('a preview never enters', () => { expect(run([held({ held: false, next: { key: 'bagger', pct: 0.1 } })]).mode).toBe('fuse'); });
  it('crypto never enters', () => { expect(run([held({ crypto: true, next: { key: 'bagger', pct: 0.1 } })]).mode).toBe('fuse'); });
  it('downside never: next is always the next UNBANKED UPSIDE rung — a price hugging the bust tier is far from it', () => {
    const l = previewLadder({ previousClose: 100, threshold: 2 }); // bust $98, bagger $102
    const go = toGo(l, 98.05);
    expect(go.rung.key).toBe('bagger');
    expect(run([held({ next: { key: go.rung.key, pct: go.pct } })]).mode).toBe('fuse');
  });
  it('no next rung (every rung banked) → the Fuse', () => { expect(run([held({ next: null })]).mode).toBe('fuse'); });
});

describe('the market close', () => {
  it('a live zone leaves at the close: inside the ENTER band it is the frozen view (c), else the Fuse', () => {
    expect(run([held({ next: { key: 'bagger', pct: 0.3 } }), held({ marketOpen: false, next: { key: 'bagger', pct: 0.3 } })]).mode).toBe('closed');
    expect(run([held({ next: { key: 'bagger', pct: 0.3 } }), held({ marketOpen: false, next: { key: 'bagger', pct: 0.6 } })]).mode).toBe('fuse');
  });
  it('the closed view never uses the stay band', () => { expect(run([held({ marketOpen: false, next: { key: 'bagger', pct: 0.7 } })]).mode).toBe('fuse'); });
  it('reopening goes straight back to the live zone', () => {
    expect(run([held({ marketOpen: false, next: { key: 'bagger', pct: 0.3 } }), held({ next: { key: 'bagger', pct: 0.3 } })]).mode).toBe('approaching');
  });
});

describe('the banked moment', () => {
  const approaching = held({ next: { key: 'bagger', pct: 0.1 } });
  const bankedNear = held({ bankedUp: ['bagger'], next: { key: 'doubleBagger', pct: 0.4 } });
  const bankedFar = held({ bankedUp: ['bagger'], next: { key: 'doubleBagger', pct: 1.4 } });
  it('a rung the modal SEES bank plays the moment', () => {
    const s = run([approaching, bankedFar]);
    expect(s.mode).toBe('banked');
    expect(s.moment).toEqual({ key: 'bagger' });
  });
  it('holds until its beat is done, then exits when no rung is within the band', () => {
    const s = run([approaching, bankedFar, bankedFar, { ...bankedFar, momentDone: true }]);
    expect(s.mode).toBe('fuse');
  });
  it('then re-bases to the next rung when it is within the ENTER band', () => {
    const s = run([approaching, bankedNear, { ...bankedNear, momentDone: true }]);
    expect(s.mode).toBe('approaching');
    expect(s.rungKey).toBe('doubleBagger');
  });
  it('plays ONCE per position and tier per modal session', () => {
    let s = run([approaching, bankedFar, { ...bankedFar, momentDone: true }]);
    // the record briefly drops the tier and brings it back: no second moment
    s = stepRedZone(s, held({ next: { key: 'bagger', pct: 0.1 } }));
    s = stepRedZone(s, bankedFar);
    expect(s.mode).not.toBe('banked');
    expect(s.played).toEqual(['p1:bagger']);
  });
  it('a rung already banked at the first look never plays (no invented moment)', () => {
    expect(run([bankedFar]).mode).toBe('fuse');
    expect(run([bankedNear]).mode).toBe('approaching');
  });
  it('a loading ladder (not yet held) seeds nothing, so its banked rungs never read as fresh', () => {
    expect(run([held({ held: false, bankedUp: [] }), bankedFar]).mode).toBe('fuse');
  });
  it('isRedZoneMode names the three red-zone views', () => {
    expect(['fuse', 'approaching', 'banked', 'closed'].map(isRedZoneMode)).toEqual([false, true, true, true]);
  });
});
