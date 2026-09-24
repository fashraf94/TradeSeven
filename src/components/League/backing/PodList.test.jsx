// src/components/League/backing/PodList.test.jsx
//
// Backing Beta PR 4 — SURFACE A, the pod list, against the open-state
// contract (Amendment B §B2/§B6) and the reveal at close.
//
// THE SEAL ROW THIS FILE EXISTS FOR (BUILD_RULES §2 mutation check #1): a pod
// whose pool object has been GIVEN a pot, exact counts, per-team totals and a
// pays × while still `open` — the shape a mutated or leaky reply would carry —
// is rendered, and none of those figures may reach the DOM. An implementation
// that rendered `pool.potTotal` while open reds this row.
//
// react-dom/server: no effects, no listeners — the list is pure over its props.
//
// THE SEAL AT DESKTOP WIDTH (Backing desktop layouts, item F): a wider screen
// shows more at once — the pod list, the open team card, your backing and the
// stake control side by side — and no per-team figure, pot, payout or count
// above three may appear ANYWHERE while a pool is open, including in the
// side-by-side view. The desktop rows render the whole window (BackingDesk)
// and the desktop strip over the leaky pool and require the markup to be
// BYTE-EQUAL to the same render over the same pool with the leaked fields
// removed: a leaked figure, an order or an emphasis derived from one, cannot
// survive that equality. MUTATION CHECK (the build's #1): a per-team share
// rendered on the desktop pod list while open reds these rows.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { POOL_STRIP } from '../../../constants/backing';

// The desktop window mounts the stake control and Your Backing, whose service
// seams pull the env-gated Firebase client — stood in for, as their own
// suites do. Nothing here calls them: the rows are server renders.
vi.mock('../../../services/backingService', () => ({
  placeStake: vi.fn(), attestEligibility: vi.fn(), newRequestId: () => 'seal-req', readEligibility: vi.fn(),
  BackingApiError: class BackingApiError extends Error {},
}));
vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: {}, loading: false, error: null }) }));

const { default: PodList } = await import('./PodList');
const { default: BackingDesk } = await import('./BackingDesk');
const { default: BackingStrip } = await import('./BackingStrip');
const { deriveStripState } = await import('./backingStripState');
const { ELIGIBILITY } = await import('../../../hooks/useEligibility');

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';
const WED_FIRE = '2026-09-23T23:00:00.000Z';

// D-af (Amendment C §C1): each seat arrives NAMED by the server — `label` its
// primary agent's name, `secondary` the player's — exactly as
// backing-pools.js projects it.
const teams = (over = {}) => ([
  { odUserId: 'od-a', isCpu: false, label: 'Shadow', secondary: 'Mira', isOwnSeat: false, backable: true, ...(over['od-a'] || {}) },
  { odUserId: 'od-b', isCpu: false, label: 'Kestrel', secondary: 'Draco', isOwnSeat: false, backable: true, ...(over['od-b'] || {}) },
  { odUserId: 'cpu-1', isCpu: true, label: 'CPU — Trend Follower', secondary: null, isOwnSeat: false, backable: true, ...(over['cpu-1'] || {}) },
  { odUserId: 'cpu-2', isCpu: true, label: 'CPU — Contrarian', secondary: null, isOwnSeat: false, backable: true, ...(over['cpu-2'] || {}) },
]);

const openPod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40',
  humanTeams: 2,
  teams: teams(),
  pool: { status: 'open', backerProgress: { count: 2, floor: 3, met: false }, teamSpread: { met: false }, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
  myStakes: [],
  ...over,
});

const render = (pods) => renderToString(<PodList pods={pods} onOpenSeat={() => {}} />);

describe('the open state — exactly the §B2 contract', () => {
  it('renders the pod name, the seats with honest marks, the close from the pool, the chairs, the spread and the SEALED lockups', () => {
    const html = render([openPod('g1')]);
    expect(html).toContain('data-backing="pod"');
    // Each seat by its PRIMARY AGENT, the player on the line beneath (D-af).
    expect(html).toContain('Shadow');
    expect(html).toContain('Kestrel');
    expect(html).toContain('data-backing="seat-secondary"');
    expect(html).toContain('Mira');
    expect(html).toContain('Draco');
    expect(html).toContain('CPU — Trend Follower');
    expect(html).toContain('CPU — Contrarian');
    expect(html).toContain('2 humans · 2 CPUs');
    expect(html).toContain('Closes Sun 11:59 PM ET');
    expect(html).toContain('data-backing="chairs"');
    expect(html).toContain('data-count="2"');
    // Amendment B §B6, verbatim (POOL_STRIP) — the two lines an open pool may say about itself.
    expect(html).toContain('Pool needs support');
    expect(html).toContain('Backers 2 of 3');
    expect(html).toContain('Team spread: needs another team');
    expect(html).toContain('SEALED');
    expect(html).toContain('data-backing="sealed"');
    expect(html).toContain('Pot');
    expect(html).toContain('Pays ×');
  });

  it('a qualified pool freezes: "Pool qualified", no chairs count, still sealed', () => {
    const html = render([openPod('g1', { pool: { status: 'open', backerProgress: { count: 3, floor: 3, met: true }, teamSpread: { met: true }, closesAt: SUNDAY_CLOSE } })]);
    expect(html).toContain('Pool qualified');
    expect(html).toContain('data-frozen="true"');
    expect(html).toContain('SEALED');
    expect(html).not.toContain('data-count="');
  });

  it('the viewer’s own stakes render through the §B6 line — the one number an open pool may show', () => {
    const html = render([openPod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }, { stakeId: 's2', teamOdUserId: 'od-b', amount: 100, status: 'voided' }] })]);
    expect(html).toContain(POOL_STRIP.yourBacking.replace('{amount}', '250'));
    expect(html).toContain('data-backing="your-backing"');
  });

  it('a slot pod names its slot and reads its own fire-time close, never Sunday', () => {
    const html = render([openPod('lds_wed', { formationPath: 'slot', slotId: 'wed-1900', pool: { status: 'open', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false }, closesAt: WED_FIRE, closeReason: 'fire' } })]);
    expect(html).toContain('Live-draft slot');
    expect(html).toContain('Closes Wed 7:00 PM ET');
    expect(html).not.toContain('Sun 11:59');
    expect(html).toContain('Backers 0 of 3');
  });

  it('SEAL — MUTATION CHECK #1: a pool object carrying a pot, exact counts, per-team totals and a pays × while OPEN leaks none of them', () => {
    const leaky = openPod('g-leak', {
      // Distinctive figures, so a bare String(value) has no innocent twin in the markup (mutation checks 1b/1d).
      pool: { status: 'open', backerProgress: { count: 2, floor: 3, met: false }, teamSpread: { met: true }, closesAt: SUNDAY_CLOSE, potTotal: 1200, uniqueBackers: 47, teamsBacked: 4, paysX: 3.7 },
      teams: teams({ 'od-a': { stakeTotal: 700, backerCount: 3, paysX: 1.71 }, 'od-b': { stakeTotal: 500, backerCount: 2, paysX: 3.7 } }),
    });
    const html = render([leaky]);
    expect(html).toContain('SEALED');
    // The visible text carries none of the bare figures (the markup's style
    // attributes carry `font-weight:700`, so the numbers are checked on the
    // text the reader sees) …
    const text = html.replace(/<[^>]*>/g, ' ');
    for (const figure of ['1,200', '1200', '700', '500', '47', '1.71', '3.7', '3.70', '47 backers']) {
      expect(text, `leaked "${figure}" while open`).not.toContain(figure);
    }
    // … and the whole markup carries none of the revealed view's formatted strings.
    for (const figure of ['1,200 BP', '700 BP', '500 BP', '×1.71', '×3.70', 'pays ×', 'Pot 1', 'data-backing="revealed"']) {
      expect(html, `leaked "${figure}" while open`).not.toContain(figure);
    }
    // The chairs never show above the floor, whatever the reply claims.
    expect(html).not.toContain('data-count="47"');
    expect(html).toContain('data-count="2"');
  });
});

describe('the viewer’s own pod reads as yours, not disabled', () => {
  it('tags the pod "Yours", tags the seat "You", and every seat is still a tappable button', () => {
    const html = render([openPod('g-mine', { teams: teams({ 'od-a': { isOwnSeat: true, backable: false }, 'od-b': { backable: false }, 'cpu-1': { backable: false }, 'cpu-2': { backable: false } }) })]);
    expect(html).toContain('>Yours<');
    expect(html).toContain('>You<');
    expect((html.match(/role="button"/g) || []).length).toBe(4);
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('opacity:0.5');
  });
});

describe('the revealed view at close', () => {
  it('a closed pool shows the pot, the exact backers, and the per-team totals, counts and pays ×', () => {
    const html = render([openPod('g-closed', {
      pool: { status: 'closed', potTotal: 1200, uniqueBackers: 5, validity: { backers: 5, minBackers: 3, teams: 2, minTeams: 2 }, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
      teams: teams({ 'od-a': { stakeTotal: 700, backerCount: 3, paysX: 1.71 }, 'od-b': { stakeTotal: 500, backerCount: 2 }, 'cpu-1': { stakeTotal: 0, backerCount: 0 }, 'cpu-2': { stakeTotal: 0, backerCount: 0 } }),
    })]);
    expect(html).toContain('Closed · revealed');
    expect(html).toContain('Pot 1,200 BP');
    expect(html).toContain('5 backers');
    expect(html).toContain('700 BP · 3 backers');
    expect(html).toContain('500 BP · 2 backers');
    expect(html).toContain('pays ×1.71');
    expect(html).not.toContain('SEALED');
  });

  it('an insufficient pool says so plainly and a refunded one too', () => {
    expect(render([openPod('g-thin', { pool: { status: 'insufficient', potTotal: 200, uniqueBackers: 2 } })])).toContain('Did not qualify · stakes void');
    expect(render([openPod('g-gone', { pool: { status: 'refunded', potTotal: 0, uniqueBackers: 0 } })])).toContain('Refunded · stakes void');
  });

  it('a pod with no pool says so; an empty list says so', () => {
    expect(render([openPod('g-none', { pool: null })])).toContain('No pool for this pod.');
    expect(render([])).toContain('No pods to back yet.');
  });
});

describe('the PR 4 review record — FAB-16 (docs/audits/20260922_BACKING_PR4_MULTILENS_REVIEW.md)', () => {
  it('a refunded pool (its pod gone) shows its status and never a folded "Pot 0 BP · 0 backers"', () => {
    const html = render([openPod('g-gone', { pool: { status: 'refunded', potTotal: 0, uniqueBackers: 0, closesAt: SUNDAY_CLOSE } })]);
    expect(html).toContain('Refunded · stakes void');
    expect(html).not.toContain('Pot 0 BP');
    expect(html).not.toContain('0 backers');
  });

  it('a closed pool whose document carries no figures renders none — a figure is never defaulted to zero', () => {
    const html = render([openPod('g-bare', { pool: { status: 'closed', closesAt: SUNDAY_CLOSE } })]);
    expect(html).toContain('Closed · revealed');
    expect(html).not.toContain('Pot 0 BP');
    expect(html).not.toContain('0 BP · 0 backers');
  });
});

describe('the PR 4 review record — refutation pass (R-A-7)', () => {
  it('the §B6 count is clamped to the floor in the text too — no reply shape prints "Backers 5 of 3"', () => {
    const html = render([openPod('g-odd', { pool: { status: 'open', backerProgress: { count: 5, floor: 3, met: false }, teamSpread: { met: false }, closesAt: SUNDAY_CLOSE } })]);
    expect(html).toContain('Backers 3 of 3');
    expect(html).not.toContain('Backers 5 of 3');
    expect(html).not.toContain('data-count="5"');
  });
});

describe('D-af — the seats are named by the SERVER (Amendment C §C1)', () => {
  it('a seat that arrives with no label reads "Unnamed team" — the row never falls back to the account id', () => {
    const uid = 'AdaLovelace0000000000000001a';
    const html = render([openPod('g1', { teams: [{ odUserId: uid, isCpu: false, isOwnSeat: false, backable: true }] })]);
    expect(html).toContain('Unnamed team');
    expect(html).not.toContain(uid);
    expect(html).not.toContain('data-backing="seat-secondary"');
  });

  it('a pod the old way — a `seatNames` map and no labels — shows none of those names: the client composes nothing', () => {
    const html = render([openPod('g1', { seatNames: { 'od-a': 'Mira' }, teams: [{ odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: true }] })]);
    expect(html).not.toContain('Mira');
    expect(html).not.toContain('od-a<');
    expect(html).toContain('Unnamed team');
  });
});

// ═══ THE SEAL AT DESKTOP WIDTH ═══
describe('SEAL at desktop width — the window side by side leaks nothing (the leaky pool renders byte-equal to the clean one)', () => {
  // Distinctive figures, so none can pass for a legitimate number on these
  // surfaces (the 1,000 allowance, the 500 cap, the viewer's own 250).
  const LEAKED_POOL = { potTotal: 1234, uniqueBackers: 47, teamsBacked: 4, paysX: 6.43, sharePct: 61, backerCount: 47 };
  const LEAKED_TEAMS = {
    'od-a': { stakeTotal: 777, backerCount: 13, paysX: 6.43, sharePct: 61, won: false },
    'od-b': { stakeTotal: 555, backerCount: 11, paysX: 2.19, sharePct: 39, won: false },
  };
  const CARD = {
    groupId: 'g-leak', odUserId: 'od-a', viewerUid: 'viewer-1',
    seat: { index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false },
    team: { displayName: 'Mira', label: 'Shadow', secondary: 'Mira', isCpu: false, pitch: 'Breadth first.', derived: null,
      agent: { name: 'Shadow', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: 'Rides the trend.', traitCount: 4, ruleCount: 7 } },
    known: null, lastWeek: null,
  };
  const pool = (leaky) => ({ status: 'open', backerProgress: { count: 2, floor: 3, met: false }, teamSpread: { met: true }, closesAt: SUNDAY_CLOSE, closeReason: 'clock', ...(leaky ? LEAKED_POOL : {}) });
  const leakyPod = (leaky) => openPod('g-leak', {
    pool: pool(leaky),
    teams: teams(leaky ? LEAKED_TEAMS : {}),
    myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Shadow', amount: 250, status: 'live' }],
  });
  const desk = (leaky, view) => {
    const p = leakyPod(leaky);
    const pods = { data: { backingWeekCloses: SUNDAY_CLOSE }, pods: [p, openPod('g-other')], loading: false, error: null };
    const now = new Date('2026-09-23T14:00:00.000Z');
    return renderToString(
      <BackingDesk
        uid="viewer-1"
        pods={pods}
        state={deriveStripState({ pods: pods.pods, inPlay: null, now, backingWeekCloses: SUNDAY_CLOSE })}
        windowState={deriveStripState({ pods: pods.pods, inPlay: null, now, backingWeekCloses: SUNDAY_CLOSE })}
        inPlay={{ stakes: [], poolsById: {}, groupsById: {}, labelsById: {} }}
        wallet={{ known: true, left: 750, total: 1000 }}
        eligibility={{ status: ELIGIBILITY.ATTESTED, refresh: () => {} }}
        view={view === 'list' ? { kind: 'list', groupId: null, odUserId: null } : { kind: view, groupId: 'g-leak', odUserId: 'od-a' }}
        cardQuery={{ card: CARD, loading: false }}
        pod={p}
        section="window"
        now={now}
      />,
    );
  };
  const text = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ');

  for (const view of ['list', 'card', 'stake']) {
    it(`the whole window — the pod list, ${view === 'list' ? 'no card yet' : `the open card${view === 'stake' ? ' and the stake control' : ' and your backing'}`} — is the clean window, byte for byte`, () => {
      const leaky = desk(true, view);
      const clean = desk(false, view);
      // Not vacuous: the window rendered the pod, the seal, the viewer's own stake.
      expect(clean).toContain('data-backing="pod"');
      expect(clean).toContain('SEALED');
      expect(clean).toContain(POOL_STRIP.yourBacking.replace('{amount}', '250'));
      if (view !== 'list') expect(clean).toContain('data-backing="team-card"');
      if (view === 'stake') expect(clean).toContain('data-layout="desktop"');
      expect(leaky).toBe(clean);
      // …and, as a belt, none of the leaked figures is in the visible text.
      const t = text(leaky);
      for (const figure of ['1,234', '1234', '777', '555', '6.43', '2.19', '61%', '39%', '47', '13 backers', '11 backers']) {
        expect(t, `leaked "${figure}" while open, at desktop width`).not.toContain(figure);
      }
    });
  }

  it('the desktop strip over the leaky pod list is the clean strip, byte for byte — never a pot, a count above three, a payout', () => {
    const now = new Date('2026-09-23T14:00:00.000Z');
    const strip = (leaky) => renderToString(<BackingStrip wide state={deriveStripState({ pods: [leakyPod(leaky)], inPlay: null, now, backingWeekCloses: SUNDAY_CLOSE })} onOpen={() => {}} />);
    expect(strip(false)).toContain('data-strip-layout="desktop"');
    expect(strip(true)).toBe(strip(false));
  });
});
