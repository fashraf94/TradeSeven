// @vitest-environment jsdom
//
// DISPLAY AGREEMENT — the fuse hero's YOUR-SEAT number and the DecompositionStrip
// state the same quantity, in the same render, always (BUILD_RULES §9).
//
// The founder read these two side by side on a phone and they disagreed: at a
// fresh mount the hero showed 0.0 while the strip showed +157.5, and a minute
// later the hero showed 157.5 while the strip had moved on to +154.0 — the hero
// trailing the strip by exactly one poll. §9's whole point is that a displayed
// number must be derived from what the user is looking at, never from a
// second, independently-timed source that can drift.
//
// HARNESS: the REAL buildArenaModel drives BOTH components from ONE model, the
// REAL useSessionCompositeTrail accumulates on a controlled clock, and the
// assertions read RENDERED TEXT out of the DOM — not props, not intermediate
// values. If the two nodes can ever print different quantities, that is what
// these rows catch, whatever layer causes it.
//
// jsdom + createRoot + React 19 `act`, no RTL — the useSessionCompositeTrail.test.jsx
// harness in this directory.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { buildArenaModel } from './buildArenaModel';
import { useSessionCompositeTrail, trailHead, TRAIL_SAMPLE_MS } from './useSessionCompositeTrail';
import { FuseHero } from './FuseHero';
import { DecompositionStrip } from './DecompositionStrip';
import { toAxisValue } from './fuseGeometry';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Tue 2026-06-16, 16:30Z = 12:30 ET — mid-session, market open.
const NOW = Date.parse('2026-06-16T16:30:00.000Z');
const YOU = 'u-you';

const BASELINE = { NVDA: 100, AMD: 50, TSLA: 200, AAPL: 150, MSFT: 300, GOOG: 120, GE: 40, AMZN: 185, VLO: 130 };

function flat6Battle() {
  const asset = (symbol) => ({ symbol, name: symbol, tierMultiplier: 1 });
  return {
    id: 'b1', status: 'active', gameMode: 'baggerbomb_tournament', opponent: null,
    activatedAt: '2026-06-16T13:30:00.000Z', createdAt: '2026-06-16T13:30:00.000Z',
    portfolio: {
      star: [asset('NVDA'), asset('AMD')], core: [asset('TSLA'), asset('AAPL')], support: [asset('MSFT'), asset('GOOG')],
      startingPrices: { NVDA: 100, AMD: 50, TSLA: 200, AAPL: 150, MSFT: 300, GOOG: 120 },
    },
    scoring: { thresholds: Object.fromEntries(['NVDA', 'AMD', 'TSLA', 'AAPL', 'MSFT', 'GOOG'].map((s) => [s, { threshold: 2.5 }])) },
    scoreState: { currentScore: 0 }, thresholdHistory: {}, trades: [],
    agentContext: { archetype: 'degen' },
    statusFeed: [],
  };
}

function makeGroup() {
  const pick = (symbol, direction) => ({ symbol, legs: [{ direction, baselinePrice: BASELINE[symbol] }] });
  return {
    id: 'g1', status: 'battle', watchers: 47,
    userPool: ['NVDA', 'TSLA', 'GE', 'AMZN', 'VLO', 'COIN'],
    players: [
      { odUserId: YOU, picks: [pick('GE', 'long'), pick('AMZN', 'long'), pick('VLO', 'long')] },
      { odUserId: 'cpu-1', isCpu: true },
      { odUserId: 'u-riv', picks: [pick('XOM', 'long')] },
      { odUserId: 'cpu-2', isCpu: true },
    ],
    dailyScores: {
      day1: { closeScores: { [YOU]: { compositePoints: 0 }, 'cpu-1': { compositePoints: 0 }, 'u-riv': { compositePoints: 0 }, 'cpu-2': { compositePoints: 0 } } },
    },
    feed: [],
  };
}

// Two price ticks: the second is a real move, so the model's live composite
// changes between polls exactly the way it does on glass.
const priceCtx = (bump) => ({
  now: NOW, isActivationDay: false,
  effectivePrices: { ...BASELINE, NVDA: 100 + bump, GE: 40 + bump / 10, AMZN: 185 + bump },
  previousClosePrices: { ...BASELINE },
});

function model(bump) {
  return buildArenaModel({
    group: makeGroup(), battle: flat6Battle(), priceCtx: priceCtx(bump),
    claims: [], displayNames: { 'u-riv': 'Riva' }, uid: YOU, mode: 'ranked',
  });
}

// The host: ONE model feeds the trail, the hero and the strip — the production
// wiring in useArenaModel.js, minus the effectful sources.
function Board({ bump, scope }) {
  const M = model(bump);
  const ids = M.seats.map((s) => s.id);
  const trail = useSessionCompositeTrail({
    ids, scoresAtLast: M.scoresAtLast, seatLive: M.seatLive, seatBanked: M.seatBanked,
    enabled: true, nowFn: () => NOW,
  });
  return (
    <div>
      <FuseHero state="live" mode="ranked" seats={M.seats} climb={M.climb} youId={M.youId} dayIdx={0}
        w={1316} h={420} trail={trail} scope={scope} onScope={() => {}} nowFn={() => NOW} />
      <DecompositionStrip decomposition={M.decomposition} />
    </div>
  );
}

let container; let root;
const mount = (props) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Board {...props} />); });
};
const update = (props) => { act(() => { root.render(<Board {...props} />); }); };
const advance = (ms) => { act(() => { vi.advanceTimersByTime(ms); }); };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  vi.useRealTimers();
});

// ── what the USER sees, read out of the DOM ────────────────────────────────
const num = (s) => {
  const m = String(s).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};
/** The strip's YOU figure — the last number it prints, its "= orb" term. */
function stripYou() {
  const el = container.querySelector('[aria-label="How your live score is built"]');
  const m = el.textContent.trim().match(/([+-]?\d+\.\d)\s*$/);
  return Number(m[1]);
}
/** The hero's YOUR-SEAT tip value (Today: the change since the open). */
function heroTip() {
  // The crowned seat also prints "N total" underneath; strip it so the two runs
  // of digits can't be read as one number.
  const tip = container.querySelector('[data-fh-tip="u-you"]').cloneNode(true);
  tip.querySelectorAll('[data-fh-subvalue]').forEach((n) => n.remove());
  return num(tip.textContent);
}
/** The crowned seat's "N total" line — an ABSOLUTE composite, as the strip prints. */
function heroTotal() {
  const el = container.querySelector('[data-fh-tip="u-you"] [data-fh-subvalue]');
  return el ? num(el.textContent) : null;
}
/** Your seat's seed — the banked close the Today axis is measured from. */
const youSeed = (bump) => model(bump).seatBanked[YOU];

describe('§9 — the hero tip and the decomposition strip never disagree', () => {
  it('the fixture is genuinely live on BOTH layers, or none of this proves anything', () => {
    const M0 = model(10);
    const D = M0.decomposition;
    expect(D).not.toBeNull();
    expect(D.six).not.toBe(0);                    // the agent half moves
    expect(D.userLayer).not.toBe(0);              // the user half moves
    expect(D.agentSide + D.userLayer).toBeCloseTo(D.orb, 6);
    expect(M0.seatLive[YOU]).toBe(true);
  });

  it('AT A FRESH MOUNT, before the trail has ever ticked', () => {
    mount({ bump: 10, scope: 'day' });
    const orb = stripYou();
    expect(orb).not.toBe(0); // the fixture must actually be live, or this proves nothing
    // Today scope shows the change since the open — the SAME quantity through
    // the one axis transform. Anything else is two sources.
    expect(heroTip()).toBeCloseTo(toAxisValue(orb, youSeed(10), true), 1);
    // And the crowned seat's "N total" — the line the founder actually read as
    // "the hero says 0.0, the strip says +157.5" — is the strip's number itself.
    expect(heroTotal()).toBeCloseTo(orb, 1);
  });

  it('AFTER THE MODEL MOVES but before the trail samples the new value', () => {
    mount({ bump: 10, scope: 'day' });
    advance(TRAIL_SAMPLE_MS);            // one real sample in the trail
    update({ bump: 40, scope: 'day' });  // the price poll lands; the trail has NOT ticked
    const orb = stripYou();
    expect(orb).not.toBeCloseTo(model(10).decomposition.orb, 1); // the move is real
    expect(heroTip()).toBeCloseTo(toAxisValue(orb, youSeed(40), true), 1);
    expect(heroTotal()).toBeCloseTo(orb, 1);
  });

  it('ACROSS A RUN of interleaved polls and trail ticks', () => {
    mount({ bump: 5, scope: 'day' });
    for (const bump of [12, 25, 25, 3, 60]) {
      update({ bump, scope: 'day' });
      expect(heroTip()).toBeCloseTo(toAxisValue(stripYou(), youSeed(bump), true), 1);
      advance(TRAIL_SAMPLE_MS);
      expect(heroTip()).toBeCloseTo(toAxisValue(stripYou(), youSeed(bump), true), 1);
    }
  });

  it('IN THE WEEK scope, where the tip IS the running total', () => {
    mount({ bump: 10, scope: 'week' });
    expect(heroTip()).toBeCloseTo(stripYou(), 1);
    update({ bump: 45, scope: 'week' });
    expect(heroTip()).toBeCloseTo(stripYou(), 1);
  });
});

describe('the mechanism — the head, not the newest sample', () => {
  it('the trail carries a HEAD only while enabled, and it holds the CURRENT values', () => {
    let seen = null;
    function Probe({ bump, enabled }) {
      const M = model(bump);
      seen = useSessionCompositeTrail({
        ids: M.seats.map((s) => s.id), scoresAtLast: M.scoresAtLast,
        seatLive: M.seatLive, seatBanked: M.seatBanked, enabled, nowFn: () => NOW,
      });
      return null;
    }
    container = document.createElement('div');
    root = createRoot(container);
    act(() => { root.render(<Probe bump={10} enabled />); });
    expect(seen.head).not.toBeNull();
    expect(seen.head.values[YOU]).toBeCloseTo(model(10).decomposition.orb, 6);
    expect(seen.samples[YOU] ?? []).toHaveLength(0); // no sample yet — the head is not one

    act(() => { root.render(<Probe bump={70} enabled />); });
    expect(seen.head.values[YOU]).toBeCloseTo(model(70).decomposition.orb, 6);

    // DARK CONTRACT: fuse off ⇒ `enabled` false ⇒ no timer AND no head. Nothing
    // is resolved, nothing accumulates, ClimbArena is untouched.
    act(() => { root.render(<Probe bump={70} enabled={false} />); });
    expect(seen.head).toBeUndefined();
  });

  it('a seat that goes dark CARRIES FORWARD in the head — it never floors to banked (B2)', () => {
    // The regression this fix must not re-introduce: reading `scoresAtLast`
    // directly for the present would show a rival whose poll failed diving back
    // to its close. The head runs the trail's own carry-forward policy instead.
    const M = model(10);
    const rival = M.seats.map((s) => s.id).find((id) => id !== YOU);
    const ids = M.seats.map((s) => s.id);
    const trail = { seeds: { ...M.seatBanked, [rival]: 4 }, samples: { [rival]: [{ t: NOW, v: 88 }] } };
    const head = trailHead(trail, {
      ids,
      scoresAtLast: { ...M.scoresAtLast, [rival]: 4 },   // seatAltitude's banked FLOOR
      seatLive: { ...M.seatLive, [rival]: false },       // …because the poll failed
      t: NOW,
    });
    expect(head.values[rival]).toBe(88);                 // the last OBSERVED value
    expect(head.values[rival]).not.toBe(4);              // not the floor
  });
});
