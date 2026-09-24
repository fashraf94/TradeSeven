// @vitest-environment jsdom
// src/components/League/backing/backingStripRefresh.test.jsx
//
// PRE-1 / N4 (the desktop review record) — THE STRIP RE-READS, on exactly two
// moments and never on a loop:
//   · after a SUCCESSFUL stake — the Backing screen announces the stake
//     route's success reply (the one the stake control renders "Backed"
//     from), and a strip left mounted beside it (the desktop landing behind
//     its full-window Backing host) re-reads its pod list: "not staked" →
//     "staked" without a reload; a refused stake re-reads nothing;
//   · when the earliest `closesAt` among the listed OPEN pools passes — ONE
//     timer, to that close (plus a few seconds' grace), re-armed from each
//     reply for the next close and cleared on unmount: open → closed without
//     a reload; a reply still open after its close arms nothing more.
//
// The strip's hooks are the REAL ones (useBackingPods, useMyBacking) and the
// Backing screen is the real one, over a service mock that answers from a
// mutable server state — so the rows see the wiring, not a stub of it.
// MUTATION CHECKS (the build's C): the strip deaf to the stake signal, and
// the strip with no close timer, each red a named row below.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flag = vi.hoisted(() => ({ on: true }));
const server = vi.hoisted(() => ({ pools: {}, stakes: [], refuse: false, calls: [] }));

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';   // Sun 27 Sep 23:59 ET
const WED_FIRE = '2026-09-23T23:00:00.000Z';        // Wed 23 Sep 19:00 ET — a slot pod's fire
const NOW = new Date('2026-09-23T14:00:00.000Z');   // Wed 10:00 ET

vi.mock('../../../services/backingService', () => {
  const team = (odUserId, label, isCpu = false) => ({ odUserId, isCpu, label, secondary: isCpu ? null : 'Mira', isOwnSeat: false });
  const podOf = (groupId) => {
    const p = server.pools[groupId];
    const open = p.status === 'open';
    return {
      groupId, formationPath: p.slot ? 'slot' : 'lobby', slotId: p.slot ?? null, baseLayerWeek: '2026-W40', humanTeams: 1,
      teams: [team('od-a', 'Kestrel'), team('cpu-1', 'CPU — Trend Follower', true)].map((t) => ({ ...t, backable: open })),
      pool: open
        ? { status: 'open', closesAt: p.closesAt, closeReason: p.slot ? 'fire' : 'clock', backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false } }
        : { status: p.status, closesAt: p.closesAt, closeReason: p.slot ? 'fire' : 'clock', potTotal: 250, uniqueBackers: 3, validity: { backers: 3, minBackers: 3, teams: 2, minTeams: 2 } },
      myStakes: server.stakes.filter((s) => s.groupId === groupId).map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'groupId'))),
    };
  };
  return {
    fetchBackingPods: vi.fn(async () => {
      server.calls.push('fetchBackingPods');
      return {
        baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: SUNDAY_CLOSE, viewerUid: 'viewer-1',
        pods: Object.keys(server.pools).map(podOf),
      };
    }),
    placeStake: vi.fn(async ({ groupId, teamOdUserId, amount }) => {
      server.calls.push('placeStake');
      if (server.refuse) { const err = new Error('pool_closed'); err.code = 'pool_closed'; throw err; }
      const stake = { stakeId: 's1', groupId, teamOdUserId, teamLabel: 'Kestrel', amount, status: 'live' };
      server.stakes.push(stake);
      return { ok: true, replay: false, topUp: false, added: amount, teamLabel: 'Kestrel', stake: { stakeId: 's1', teamOdUserId, amount, status: 'live' }, allowanceRemaining: 1000 - amount };
    }),
    subscribeMyStakes: (_uid, _weekKey, cb) => { cb([]); return () => {}; },
    subscribePool: (_groupId, cb) => { cb(null); return () => {}; },
    fetchTeamLabels: async () => ({ pods: {} }),
    subscribeWallet: () => () => {}, readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null,
    fetchTeamCard: vi.fn(async () => null), fetchBackingResults: async () => ({ weeks: [] }), fetchMyBackingStats: async () => null,
    fetchTrainerStats: async () => null, postBackingEvent: async () => ({ recorded: true }),
    attestEligibility: vi.fn(async () => ({})), savePitch: vi.fn(async () => ({})), newRequestId: () => 'refresh-req',
    BackingApiError: class BackingApiError extends Error {},
  };
});
vi.mock('../../../services/tournamentGroupService', () => ({
  subscribeGroup: (_groupId, cb) => { cb(null); return () => {}; }, getGroup: async () => null, fetchDisplayNames: async () => ({}),
}));
// The Backing screen's other reads — the wallet, the attestation, the pitch, the card, the results — answered directly.
const CARD = {
  groupId: 'lds-wed', odUserId: 'od-a', viewerUid: 'viewer-1', seat: { index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false },
  team: { displayName: 'Mira', label: 'Kestrel', secondary: 'Mira', isCpu: false, pitch: null, derived: null,
    agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: 'Goes where the momentum is.', traitCount: 0, ruleCount: 0 } },
  known: null, lastWeek: null,
};
vi.mock('../../../hooks/useBackingWallet', () => ({ default: () => ({ known: true, left: 1000, total: 1000 }) }));
vi.mock('../../../hooks/useEligibility', async (importOriginal) => {
  const orig = await importOriginal();
  return { ...orig, default: () => ({ status: orig.ELIGIBILITY.ATTESTED, refresh: () => {} }) };
});
vi.mock('../../../hooks/useMyPitch', () => ({ default: () => ({ text: null, loaded: true, saving: false, error: null, save: async () => true }) }));
vi.mock('../../../hooks/useTeamCard', () => ({
  default: (groupId, odUserId, enabled) => ({ card: enabled && groupId === 'lds-wed' && odUserId === 'od-a' ? CARD : null, loading: false, error: null, refresh: () => {} }),
}));
vi.mock('../../../hooks/useBackingResults', () => ({ default: () => ({ data: null, pod: null, weeks: [], nextBefore: null, loadMore: () => {}, loading: false, loadingMore: false, error: null, refresh: () => {} }) }));
vi.mock('../../../hooks/useMyBackingStats', () => ({ default: () => ({ data: null, loading: false, error: null, refresh: () => {} }) }));
vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: {}, loading: false, error: null }) }));

const BackingLandingStrip = (await import('./BackingLandingStrip')).default;
const BackingScreen = (await import('./BackingScreen')).default;
const { CLOSE_REREAD_GRACE_MS } = await import('./backingStripState');

let roots = [];
async function flush() { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); }
async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  await flush();
  const entry = { root, container, mounted: true };
  roots.push(entry);
  return entry;
}
async function unmount(entry) { if (!entry.mounted) return; entry.mounted = false; await act(async () => entry.root.unmount()); }
async function press(el) {
  expect(el, 'the control to press is on screen').not.toBeNull();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await flush();
}
async function advance(ms) { await act(async () => { vi.advanceTimersByTime(ms); }); await flush(); }
const reads = () => server.calls.filter((c) => c === 'fetchBackingPods').length;
const stripOf = (c) => c.querySelector('[data-backing="strip"]');

beforeEach(() => {
  flag.on = true;
  server.pools = { 'lds-wed': { status: 'open', closesAt: WED_FIRE, slot: 'wed-1900' } };
  server.stakes = [];
  server.refuse = false;
  server.calls = [];
  // setInterval too, so a poll could not hide from the rows below on a real clock.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  for (const entry of roots) { await unmount(entry); entry.container.remove(); }
  roots = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** The Backing screen's stake, as the viewer makes it: a seat → its card → Back → Confirm. */
async function stakeThrough(screen) {
  const seat = [...screen.querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes('Kestrel'));
  await press(seat);
  await press(screen.querySelector('[data-backing="cta-back"]'));
  await press(screen.querySelector('[data-backing="confirm"]'));
}

describe('PRE-1 — after a SUCCESSFUL stake the strip re-reads: "not staked" → "staked", without a reload', () => {
  for (const viewport of ['desktop', 'mobile']) {
    it(`${viewport}: the strip beside the Backing screen moves to STAKED on the server's success reply — the same mounted strip, its pod list read again`, async () => {
      const wide = viewport === 'desktop';
      const { container } = await mount(
        <div>
          <div data-testid="landing"><BackingLandingStrip uid="viewer-1" accent="#5EEAD4" onOpen={() => {}} wide={wide} /></div>
          <div data-testid="host"><BackingScreen uid="viewer-1" viewport={viewport} onBack={() => {}} onOpenTape={() => {}} /></div>
        </div>,
      );
      const landing = container.querySelector('[data-testid="landing"]');
      const host = container.querySelector('[data-testid="host"]');
      expect(stripOf(landing).getAttribute('data-strip-state')).toBe('open');
      const slot = landing.querySelector('[data-backing="strip-slot"]');
      const before = reads();
      await stakeThrough(host);
      expect(host.querySelector('[data-backing="backed"]'), 'the stake control confirmed the stake').not.toBeNull();
      // The screen's own pod list AND the strip's re-read — one each.
      expect(reads()).toBe(before + 2);
      const strip = stripOf(landing);
      expect(strip.getAttribute('data-strip-state')).toBe('staked');
      expect(landing.querySelector('[data-backing="strip-slot"]'), 'the same strip, re-read in place — not remounted').toBe(slot);
      // The stake the server recorded — its team and amount — now on the strip.
      expect(server.stakes).toHaveLength(1);
      expect(landing.textContent).toContain('Kestrel');
      expect(landing.textContent).toContain(`${server.stakes[0].amount} BP`);
    });
  }

  it('a REFUSED stake re-reads nothing — the strip stays as the server last said', async () => {
    server.refuse = true;
    const { container } = await mount(
      <div>
        <div data-testid="landing"><BackingLandingStrip uid="viewer-1" accent="#5EEAD4" onOpen={() => {}} wide /></div>
        <div data-testid="host"><BackingScreen uid="viewer-1" viewport="mobile" onBack={() => {}} onOpenTape={() => {}} /></div>
      </div>,
    );
    const before = reads();
    await stakeThrough(container.querySelector('[data-testid="host"]'));
    expect(server.calls).toContain('placeStake');
    expect(container.querySelector('[data-backing="backed"]')).toBeNull();
    expect(reads()).toBe(before);
    expect(stripOf(container.querySelector('[data-testid="landing"]')).getAttribute('data-strip-state')).toBe('open');
  });
});

describe('N4 — when the earliest close among the listed OPEN pools passes, the strip re-reads: open → closed, without a reload; ONE timer, never a poll', () => {
  it('one re-read just after the earliest close — none before it — and the strip moves from "Closes Wed" to "Closed"; the timer re-arms for the next close, and unmounting clears it', async () => {
    server.pools['lobby-w40'] = { status: 'open', closesAt: SUNDAY_CLOSE };
    server.stakes = [{ stakeId: 's1', groupId: 'lds-wed', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 250, status: 'live' }];
    const entry = await mount(<BackingLandingStrip uid="viewer-1" accent="#5EEAD4" onOpen={() => {}} />);
    expect(reads()).toBe(1);
    expect(stripOf(entry.container).getAttribute('data-strip-state')).toBe('staked');
    expect(entry.container.textContent).toContain('Closes Wed 7:00 PM ET');

    // Up to the close and its grace: nothing is read.
    await advance(new Date(WED_FIRE).getTime() + CLOSE_REREAD_GRACE_MS - NOW.getTime() - 1);
    expect(reads(), 'no read before the close has passed').toBe(1);
    // The server closes the pool on the read that follows its close (the lazy close).
    server.pools['lds-wed'].status = 'closed';
    await advance(1);
    expect(reads(), 'one read once the close has passed').toBe(2);
    expect(stripOf(entry.container).getAttribute('data-strip-state')).toBe('staked');
    expect(entry.container.textContent).toContain('Closed · plays Monday');
    expect(entry.container.textContent).not.toContain('Closes Wed');

    // Re-armed for the next close (Sunday's), and only for it.
    await advance(new Date(SUNDAY_CLOSE).getTime() + CLOSE_REREAD_GRACE_MS - Date.now() - 1);
    expect(reads()).toBe(2);
    expect(vi.getTimerCount(), 'one timer armed — Sunday\'s').toBe(1);
    // Unmounted before it fires: the timer is CLEARED (a stray one would fire
    // into an unmounted strip and read nothing — so the count says it).
    await unmount(entry);
    expect(vi.getTimerCount(), 'the timer is cleared on unmount').toBe(0);
    await advance(60 * 60 * 1000);
    expect(reads(), 'no read after unmount').toBe(2);
  });

  it('NO POLLING: a reply that still says open after its close (the server\'s clock behind ours) arms nothing more — exactly one re-read, then quiet', async () => {
    await mount(<BackingLandingStrip uid="viewer-1" accent="#5EEAD4" onOpen={() => {}} />);
    expect(reads()).toBe(1);
    await advance(new Date(WED_FIRE).getTime() + CLOSE_REREAD_GRACE_MS - NOW.getTime());
    expect(reads()).toBe(2);
    // The pool still reads open (never closed by the server here): no second timer, no loop.
    await advance(6 * 60 * 60 * 1000);
    expect(reads(), 'one read at the close, then nothing').toBe(2);
    expect(vi.getTimerCount(), 'no timer left armed').toBe(0);
  });

  it('with no open pool listed, no timer is armed at all', async () => {
    server.pools['lds-wed'].status = 'closed';
    await mount(<BackingLandingStrip uid="viewer-1" accent="#5EEAD4" onOpen={() => {}} />);
    expect(vi.getTimerCount()).toBe(0);
    await advance(7 * 24 * 60 * 60 * 1000);
    expect(reads()).toBe(1);
  });
});
