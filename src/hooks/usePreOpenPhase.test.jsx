// src/hooks/usePreOpenPhase.test.jsx
//
// usePreOpenPhase — the flag gate + the derivation composition, exercised through
// a real render. renderToString (no jsdom/testing-library in this repo; the
// TrainingReportCard.render.test.jsx precedent), with a fake system clock so the
// hook's `new Date()` lands on a chosen ET instant.
//
// The exhaustive comparison table lives with the pure predicate
// (api/_utils/tournamentTime.preOpenPhase.test.js). What THIS suite owns is the
// part the hook adds: the flag short-circuit, and the guarantee that flag-off is
// byte-equivalent to today at every consuming site.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const { flagState } = vi.hoisted(() => ({ flagState: { on: false } }));

// Only the gate is mocked; every other export (including the pinned constant
// asserted below) passes through as the real value.
vi.mock('../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isPreOpenPhaseRoutingOn: () => flagState.on };
});

const { default: usePreOpenPhase, PREOPEN_TICK_MS } = await import('./usePreOpenPhase.js');
const { PREOPEN_PHASE_ROUTING_ENABLED } = await import('../config/featureFlags');
const { GROUP_STATUS } = await import('../constants/leagueTournament.js');

const ANCHOR = '2026-08-27';                              // Thu, EDT
const PRE_OPEN_0800 = '2026-08-27T12:00:00.000Z';         // ET 08:00
const OPEN_0930 = '2026-08-27T13:30:00.000Z';             // ET 09:30
const battlePod = { status: GROUP_STATUS.BATTLE, startAnchor: { anchorEtDate: ANCHOR } };

function Probe({ group }) {
  return <i>{usePreOpenPhase(group) ? 'awaiting' : 'live'}</i>;
}

function surfaceAt(group, iso) {
  vi.setSystemTime(new Date(iso));
  return renderToString(<Probe group={group} />).includes('awaiting') ? 'awaiting' : 'live';
}

beforeEach(() => { vi.useFakeTimers(); flagState.on = false; });
afterEach(() => { vi.useRealTimers(); });

describe('usePreOpenPhase — flag gate', () => {
  it('ships DARK: the flag is false (flagPinGuard: this pin and the value move together)', () => {
    expect(PREOPEN_PHASE_ROUTING_ENABLED).toBe(false);
  });

  it('flag OFF → live surface even for a pre-open BATTLE pod (byte-equivalent to today)', () => {
    flagState.on = false;
    expect(surfaceAt(battlePod, PRE_OPEN_0800)).toBe('live');
  });

  it('flag ON → awaiting surface for the same pod at the same instant', () => {
    flagState.on = true;
    expect(surfaceAt(battlePod, PRE_OPEN_0800)).toBe('awaiting');
  });

  it('flag ON → live surface once the bell passes', () => {
    flagState.on = true;
    expect(surfaceAt(battlePod, OPEN_0930)).toBe('live');
  });

  it('flag ON → a genuine AWAITING_OPEN pod is untouched by this hook (routes on its own status)', () => {
    flagState.on = true;
    const awaiting = { status: GROUP_STATUS.AWAITING_OPEN, startAnchor: { anchorEtDate: '2026-08-28' } };
    expect(surfaceAt(awaiting, PRE_OPEN_0800)).toBe('live'); // hook false → caller falls back to its status branch
  });

  it('flag ON → null/absent group is safe', () => {
    flagState.on = true;
    expect(surfaceAt(null, PRE_OPEN_0800)).toBe('live');
    expect(surfaceAt(undefined, PRE_OPEN_0800)).toBe('live');
  });
});

describe('usePreOpenPhase — anti-vacuous (BUILD_RULES §2)', () => {
  it('the gate is what changes the answer: same pod, same instant, both arms differ', () => {
    // If the hook stopped consulting the flag, both rows would agree and this fails.
    flagState.on = false;
    const off = surfaceAt(battlePod, PRE_OPEN_0800);
    flagState.on = true;
    const on = surfaceAt(battlePod, PRE_OPEN_0800);
    expect(off).toBe('live');
    expect(on).toBe('awaiting');
    expect(off).not.toBe(on);
  });

  it('the clock is what changes the answer: same pod, flag on, two instants differ', () => {
    flagState.on = true;
    expect(surfaceAt(battlePod, PRE_OPEN_0800)).toBe('awaiting');
    expect(surfaceAt(battlePod, OPEN_0930)).toBe('live');
  });
});

describe('usePreOpenPhase — tick cadence contract (spec V2.1 R-5)', () => {
  it('ticks at most every 30s so the 09:30 transition is never visibly late', () => {
    expect(PREOPEN_TICK_MS).toBeLessThanOrEqual(30_000);
    expect(PREOPEN_TICK_MS).toBeGreaterThan(0);
  });
});
