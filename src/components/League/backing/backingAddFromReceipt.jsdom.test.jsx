// @vitest-environment jsdom
// src/components/League/backing/backingAddFromReceipt.jsdom.test.jsx
//
// THE BACKING QA ROUNDS 1–3 (docs/audits/20261007_BACKING_QA_FIXES_BUILD_REPORT.md),
// item A — FT-QA-BACK-BUG-001: on DESKTOP, "Add to your N on {team}" pressed on
// the card WHILE THE RECEIPT IS SHOWING opens a fresh top-up form.
//
// THE CAUSE, verified at the lines the report cites: BackingDesk keeps
// StakeControl mounted for the whole `stake` view, the control holds its own
// `result` and renders the receipt from it, and the card's Add only set the
// view to the `stake` it already was — nothing remounted, the receipt stayed.
// Opening the card again first (the pod list, "Back another team") unmounted
// the control, which is why that worked. THE FIX is at the view/remount seam:
// the screen counts every entry into the control (onToStake) and the desktop
// layout keys the control on that count and the seat — never a special case
// for the receipt. Mobile is untouched: its stake view only mounts after the
// card view is left, so Add always mounts a fresh control there.
//
// The REAL BackingScreen (desktop) over the real hooks and a service mock that
// answers from a mutable server state (the backingStripRefresh.test.jsx shape).
//
// ROWS:
//   1. stake → receipt → Add on the card → the top-up form, with the top-up
//      note ("Adds to your 250 BP on Kestrel.") and the reduced cap (500 off);
//   2. receipt for one seat → open a DIFFERENT seat from the pod list → its
//      card and the rail, no receipt → Back → that seat's fresh first form.
// MUTATION CHECKS (recorded in the build report): remove the `key` on
// StakeControl in BackingDesk, or the bump in BackingScreen's onToStake, and
// row 1 reds — the receipt stays and no form renders.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flag = vi.hoisted(() => ({ on: true }));
const server = vi.hoisted(() => ({ stakes: [], calls: [], hold: false, release: null }));

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';   // Sun 27 Sep 23:59 ET
const NOW = new Date('2026-09-23T14:00:00.000Z');   // Wed 10:00 ET

vi.mock('../../../services/backingService', () => {
  const team = (odUserId, label, secondary) => ({ odUserId, isCpu: false, label, secondary, isOwnSeat: false, backable: true });
  return {
    fetchBackingPods: vi.fn(async () => {
      server.calls.push('fetchBackingPods');
      return {
        baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: SUNDAY_CLOSE, viewerUid: 'viewer-1',
        pods: [{
          groupId: 'lobby-w40', formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40', humanTeams: 2,
          teams: [team('od-a', 'Kestrel', 'Mira'), team('od-b', 'Shadow', 'Draco'), { odUserId: 'cpu-1', isCpu: true, label: 'CPU — Trend Follower', secondary: null, isOwnSeat: false, backable: true }],
          pool: { status: 'open', closesAt: SUNDAY_CLOSE, closeReason: 'clock', backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false } },
          // The viewer's own stakes, as the ledger now holds them — what the card's CTA and the control's cap read.
          myStakes: server.stakes.map((s) => ({ stakeId: s.stakeId, teamOdUserId: s.teamOdUserId, teamLabel: s.teamLabel, amount: s.amount, status: 'live' })),
        }],
      };
    }),
    placeStake: vi.fn(async ({ teamOdUserId, amount }) => {
      server.calls.push('placeStake');
      // A held request stays in flight until the row releases it (R2-2).
      if (server.hold) await new Promise((resolve) => { server.release = resolve; });
      const label = teamOdUserId === 'od-a' ? 'Kestrel' : 'Shadow';
      const prior = server.stakes.find((s) => s.teamOdUserId === teamOdUserId);
      const total = (prior?.amount ?? 0) + amount;
      if (prior) prior.amount = total; else server.stakes.push({ stakeId: `s-${teamOdUserId}`, teamOdUserId, teamLabel: label, amount: total });
      return { ok: true, replay: false, topUp: Boolean(prior), added: amount, teamLabel: label, stake: { stakeId: `s-${teamOdUserId}`, teamOdUserId, amount: total, status: 'live', debits: [{ entryId: `stake:${teamOdUserId}-${total}`, amount }] }, allowanceRemaining: 1000 - server.stakes.reduce((n, s) => n + s.amount, 0) };
    }),
    subscribeMyStakes: (_uid, _weekKey, cb) => { cb([]); return () => {}; },
    subscribePool: (_groupId, cb) => { cb(null); return () => {}; },
    fetchTeamLabels: async () => ({ pods: {} }),
    subscribeWallet: () => () => {}, readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null,
    fetchTeamCard: vi.fn(async () => null), fetchBackingResults: async () => ({ weeks: [] }), fetchMyBackingStats: async () => null,
    fetchTrainerStats: async () => null, postBackingEvent: async () => ({ recorded: true }), fetchBackingLit: async () => ({ lit: true }),
    attestEligibility: vi.fn(async () => ({})), savePitch: vi.fn(async () => ({})), newRequestId: () => `req-${server.calls.length}`,
    BackingApiError: class BackingApiError extends Error {},
  };
});
vi.mock('../../../services/tournamentGroupService', () => ({
  subscribeGroup: (_groupId, cb) => { cb(null); return () => {}; }, getGroup: async () => null, fetchDisplayNames: async () => ({}),
  subscribeMyGroup: (_uid, cb) => { cb(null); return () => {}; }, subscribeMyMostRecentVoidedGroup: () => () => {}, subscribeMyTrainingPod: () => () => {},
}));
vi.mock('../../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({ slots: [], battles: {} }) })) }));
vi.mock('../../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));

// The two seats' cards, as the projection returns them.
const CARDS = {
  'od-a': {
    groupId: 'lobby-w40', odUserId: 'od-a', viewerUid: 'viewer-1', seat: { index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false },
    team: { displayName: 'Mira', label: 'Kestrel', secondary: 'Mira', isCpu: false, pitch: null, derived: null,
      agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: 'Goes where the momentum is.', traitCount: 0, ruleCount: 0 } },
    known: null, lastWeek: null,
  },
  'od-b': {
    groupId: 'lobby-w40', odUserId: 'od-b', viewerUid: 'viewer-1', seat: { index: 2, count: 4, isCpu: false, isViewer: false, viewerSeated: false },
    team: { displayName: 'Draco', label: 'Shadow', secondary: 'Draco', isCpu: false, pitch: null, derived: null,
      agent: { name: 'Shadow', archetype: 'analyst', archetypeLabel: 'Fundamental Investor', approach: 'Buys quality.', traitCount: 0, ruleCount: 0 } },
    known: null, lastWeek: null,
  },
};
vi.mock('../../../hooks/useBackingWallet', () => ({ default: () => ({ known: true, left: 1000, total: 1000, wallet: { appliedEntries: {} } }) }));
vi.mock('../../../hooks/useEligibility', async (importOriginal) => {
  const orig = await importOriginal();
  return { ...orig, default: () => ({ status: orig.ELIGIBILITY.ATTESTED, refresh: () => {} }) };
});
vi.mock('../../../hooks/useMyPitch', () => ({ default: () => ({ text: null, loaded: true, saving: false, error: null, save: async () => true }) }));
vi.mock('../../../hooks/useTeamCard', () => ({
  default: (groupId, odUserId, enabled) => ({ card: enabled && groupId === 'lobby-w40' ? CARDS[odUserId] ?? null : null, loading: false, error: null, refresh: () => {} }),
}));
vi.mock('../../../hooks/useBackingResults', () => ({ default: () => ({ data: null, pod: null, weeks: [], nextBefore: null, loadMore: () => {}, loading: false, loadingMore: false, error: null, refresh: () => {} }) }));
vi.mock('../../../hooks/useMyBackingStats', () => ({ default: () => ({ data: null, loading: false, error: null, refresh: () => {} }) }));
vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: {}, loading: false, error: null }) }));

const BackingScreen = (await import('./BackingScreen')).default;
const { STAKE } = await import('./backingCopy');

let roots = [];
async function flush() { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); }
async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  await flush();
  roots.push({ root, container });
  return container;
}
async function press(el) {
  expect(el, 'the control to press is on screen').not.toBeNull();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await flush();
}
const seat = (c, label) => [...c.querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes(label)) ?? null;
const right = (c) => c.querySelector('[data-desk-col="right"]');
const centre = (c) => c.querySelector('[data-desk-col="card"]');

beforeEach(() => {
  flag.on = true;
  server.stakes = [];
  server.calls = [];
  server.hold = false;
  server.release = null;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A seat → its card → Back → a preset → Confirm: the receipt. */
async function stakeOn(c, label, preset) {
  await press(seat(c, label));
  expect(centre(c).querySelector('[data-backing="team-card"]')).not.toBeNull();
  await press(centre(c).querySelector('[data-backing="cta-back"]'));
  expect(right(c).querySelector('[data-backing="stake-control"]')).not.toBeNull();
  await press(right(c).querySelector(`[data-preset="${preset}"]`));
  await press(right(c).querySelector('[data-backing="confirm"]'));
  expect(right(c).querySelector('[data-backing="backed"]'), 'the stake control confirmed the stake').not.toBeNull();
}

describe('BUG-001 — desktop: "Add to your N on {team}" straight from the receipt', () => {
  it('row 1: stake → receipt → Add on the card → a FRESH top-up form (the top-up note, the reduced cap), the receipt gone', async () => {
    const c = await mount(<BackingScreen uid="viewer-1" viewport="desktop" onBack={() => {}} onOpenTape={() => {}} />);
    await stakeOn(c, 'Kestrel', 250);
    expect(right(c).textContent).toContain('Backed · 250 BP on Kestrel');
    // Item C on the real screen: the reply's own balance under the receipt.
    expect(right(c).querySelector('[data-backing="backed-left"]').textContent).toBe(STAKE.remaining(750));
    // The card, still in the centre, now offers the top-up — the pod list re-read the ledger.
    const cta = centre(c).querySelector('[data-backing="cta-back"]');
    expect(cta.textContent).toContain('Add to your 250 on Kestrel');
    await press(cta);
    // THE ROW: a fresh top-up form, not the receipt.
    expect(right(c).querySelector('[data-backing="backed"]'), 'the receipt is gone').toBeNull();
    const form = right(c).querySelector('[data-backing="stake-control"]');
    expect(form, 'a fresh form opened').not.toBeNull();
    expect(form.getAttribute('data-layout')).toBe('desktop');
    expect(form.querySelector('[data-backing="top-up-note"]').textContent).toBe(STAKE.addsTo(250, 'Kestrel'));
    expect(form.querySelector('[data-backing="top-up"]')).not.toBeNull();
    expect(form.textContent).toContain('250 already on Kestrel');
    // The cap left is 250: the largest preset is off, 250 is on, and the smallest is pre-chosen (item B).
    expect(form.querySelector('[data-preset="500"]').disabled).toBe(true);
    expect(form.querySelector('[data-preset="250"]').disabled).toBe(false);
    expect(form.querySelector('[data-backing="confirm"]').textContent).toContain('Confirm 100 BP');
    // …and Confirm from it tops up: the stake's new total on a new receipt.
    await press(form.querySelector('[data-preset="250"]'));
    await press(form.querySelector('[data-backing="confirm"]'));
    expect(right(c).querySelector('[data-backing="backed"]').textContent).toContain('Backed · 500 BP on Kestrel');
    expect(right(c).querySelector('[data-backing="topped-up"]').textContent).toBe(STAKE.toppedUp(250));
    expect(server.calls.filter((x) => x === 'placeStake')).toHaveLength(2);
  });

  it('row 2: a receipt for one seat → open a DIFFERENT seat → its card and the rail, no receipt → Back → that seat\'s fresh first form', async () => {
    const c = await mount(<BackingScreen uid="viewer-1" viewport="desktop" onBack={() => {}} onOpenTape={() => {}} />);
    await stakeOn(c, 'Kestrel', 100);
    await press(seat(c, 'Shadow'));
    expect(centre(c).querySelector('[data-backing="team-card"]').getAttribute('data-seat')).toBe('od-b');
    expect(right(c).querySelector('[data-backing="backed"]')).toBeNull();
    expect(right(c).querySelector('[data-backing="desk-rail"]'), 'the rail is back while the new card is read').not.toBeNull();
    const cta = centre(c).querySelector('[data-backing="cta-back"]');
    expect(cta.textContent).toContain('Back Draco & Shadow');
    await press(cta);
    const fresh = right(c).querySelector('[data-backing="stake-control"]');
    expect(fresh).not.toBeNull();
    expect(fresh.textContent).toContain('Back Draco & Shadow');
    expect(fresh.querySelector('[data-backing="top-up-note"]')).toBeNull();
    expect(fresh.querySelector('[data-backing="top-up"]')).toBeNull();
    expect(right(c).querySelector('[data-backing="backed"]')).toBeNull();
    expect(fresh.querySelector('[data-backing="confirm"]').textContent).toContain('Confirm 100 BP');
  });

  it('R2-2 — a Confirm IN FLIGHT is never abandoned by the seam: Add, another seat, "Back to the card" and a section tab all wait; the reply lands on the control that sent it, ONE request; then Add works (MUTATION: drop the pending guard in BackingScreen → this reds — the busy control is replaced and the receipt never renders)', async () => {
    const c = await mount(<BackingScreen uid="viewer-1" viewport="desktop" onBack={() => {}} onOpenTape={() => {}} />);
    await press(seat(c, 'Kestrel'));
    await press(centre(c).querySelector('[data-backing="cta-back"]'));
    await press(right(c).querySelector('[data-preset="250"]'));
    server.hold = true;
    await press(right(c).querySelector('[data-backing="confirm"]'));
    expect(right(c).querySelector('[data-backing="confirm"]').textContent).toContain(STAKE.confirming);
    expect(server.release, 'the request is in flight').not.toBeNull();
    // Every desktop handler that would unmount the busy control waits.
    await press(centre(c).querySelector('[data-backing="cta-back"]'));
    expect(right(c).querySelector('[data-backing="confirm"]').textContent, 'Add did not replace the busy control').toContain(STAKE.confirming);
    await press(seat(c, 'Shadow'));
    expect(centre(c).querySelector('[data-backing="team-card"]').getAttribute('data-seat'), 'another seat did not open').toBe('od-a');
    await press(right(c).querySelector('[data-backing="stake-cancel"]'));
    expect(right(c).querySelector('[data-backing="confirm"]'), '"Back to the card" waited').not.toBeNull();
    const tab = c.querySelector('[data-desk-section="results"]');
    if (tab) { await press(tab); expect(right(c).querySelector('[data-backing="confirm"]'), 'the section tab waited').not.toBeNull(); }
    // The reply lands on the control that sent it.
    await act(async () => { server.release(); });
    await flush();
    expect(right(c).querySelector('[data-backing="backed"]')).not.toBeNull();
    expect(right(c).textContent).toContain('Backed · 250 BP on Kestrel');
    expect(server.calls.filter((x) => x === 'placeStake')).toHaveLength(1);
    // …and the seam is free again: Add from the receipt opens the fresh top-up form.
    server.hold = false;
    await press(centre(c).querySelector('[data-backing="cta-back"]'));
    expect(right(c).querySelector('[data-backing="backed"]')).toBeNull();
    expect(right(c).querySelector('[data-backing="top-up-note"]').textContent).toBe(STAKE.addsTo(250, 'Kestrel'));
  });

  it('R2-1 — STACKED (a ≤980px desktop window): every entry into the control brings the right column into view, Add from the receipt included; a pods refresh moves nothing (MUTATION: drop the entry count from `moved` in BackingDesk → the third scroll never happens)', async () => {
    const scrolls = [];
    const hadMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (q) => ({ matches: q === '(max-width: 980px)', media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
    const proto = window.HTMLElement.prototype;
    const hadScroll = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
    proto.scrollIntoView = function scrollIntoView() { scrolls.push(this.getAttribute('data-desk-col')); };
    try {
      const c = await mount(<BackingScreen uid="viewer-1" viewport="desktop" onBack={() => {}} onOpenTape={() => {}} />);
      await press(seat(c, 'Kestrel'));
      expect(scrolls).toEqual(['card']);
      await press(centre(c).querySelector('[data-backing="cta-back"]'));
      expect(scrolls).toEqual(['card', 'right']);
      await press(right(c).querySelector('[data-preset="250"]'));
      await press(right(c).querySelector('[data-backing="confirm"]'));
      expect(right(c).querySelector('[data-backing="backed"]')).not.toBeNull();
      expect(scrolls, 'the pods refresh after the stake moves nothing').toEqual(['card', 'right']);
      await press(centre(c).querySelector('[data-backing="cta-back"]'));
      expect(right(c).querySelector('[data-backing="top-up-note"]')).not.toBeNull();
      expect(scrolls, 'Add from the receipt brings the fresh form into view').toEqual(['card', 'right', 'right']);
    } finally {
      if (hadScroll) Object.defineProperty(proto, 'scrollIntoView', hadScroll); else delete proto.scrollIntoView;
      if (hadMatchMedia) Object.defineProperty(window, 'matchMedia', hadMatchMedia); else delete window.matchMedia;
    }
  });

  it('re-entering the SAME seat from the receipt through "Back another team" then Back still opens fresh (the pre-fix workaround keeps working)', async () => {
    const c = await mount(<BackingScreen uid="viewer-1" viewport="desktop" onBack={() => {}} onOpenTape={() => {}} />);
    await stakeOn(c, 'Kestrel', 100);
    await press([...right(c).querySelectorAll('button')].find((b) => b.textContent === STAKE.another));
    expect(right(c).querySelector('[data-backing="desk-rail"]')).not.toBeNull();
    await press(centre(c).querySelector('[data-backing="cta-back"]'));
    const form = right(c).querySelector('[data-backing="stake-control"]');
    expect(form).not.toBeNull();
    expect(form.querySelector('[data-backing="top-up-note"]').textContent).toBe(STAKE.addsTo(100, 'Kestrel'));
    expect(right(c).querySelector('[data-backing="backed"]')).toBeNull();
  });
});
