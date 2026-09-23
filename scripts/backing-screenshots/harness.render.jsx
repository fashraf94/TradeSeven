// scripts/backing-screenshots/harness.render.jsx
//
// Backing Beta PR 4 — THE SCREENSHOT HARNESS. Renders the landing strip's four
// states and the team card's first-week and veteran states with
// BACKING_BETA_ENABLED FORCED ON (a getter mock — the shipped value stays
// `false`; src/config/backingBetaFlags.test.js pins it) and writes each as a
// static page under $BACKING_SHOTS_DIR for shoot.mjs to photograph.
//
// The strip renders through BackingLandingStrip — the gated, data-bound
// mount the landing uses — over mocked hook returns shaped like the pod-list
// endpoint's reply and the viewer's in-play stakes; the card renders from
// projections shaped like GET /api/tournament/team-card's reply (the shapes
// TeamCard.test.jsx pins). Nothing here touches the network or Firestore.
//
// Not part of `npm run test:run` (see vitest.config.mjs beside this file).

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = process.env.BACKING_SHOTS_DIR;
if (!OUT) throw new Error('Set BACKING_SHOTS_DIR to the directory the pages should be written to.');

const hooked = vi.hoisted(() => ({ pods: null, inPlay: null }));

vi.mock('../../src/config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return true; },
}));
vi.mock('../../src/hooks/useBackingPods', () => ({ default: () => hooked.pods }));
vi.mock('../../src/hooks/useMyBacking', () => ({ default: () => hooked.inPlay }));

const BackingLandingStrip = (await import('../../src/components/League/backing/BackingLandingStrip')).default;
const TeamCard = (await import('../../src/components/League/backing/TeamCard')).default;
const { LTOKENS, LX } = await import('../../src/components/League/leagueTokens');

// ── the page shell: the League's tokens and stylesheet, the app's fonts ─────
const CSS = ['src/theme/tokens.css', 'src/components/League/league.css'].map((f) => readFileSync(path.join(REPO, f), 'utf8')).join('\n');
const WIDTH = 390;
function page(title, fragment) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="./fonts.css">
<style>${CSS}</style>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; background: ${LTOKENS.bg}; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
  #shot { width: ${WIDTH}px; padding: 16px; background: ${LTOKENS.bg}; color: ${LTOKENS.ink}; }
</style></head>
<body><div id="shot">${fragment}</div></body></html>
`;
}
function write(name, title, element) {
  mkdirSync(OUT, { recursive: true });
  const html = renderToString(element);
  expect(html.length).toBeGreaterThan(0);
  writeFileSync(path.join(OUT, `${name}.html`), page(title, html));
  return html;
}

// ── the strip's inputs, shaped like the endpoint's reply ────────────────────
// Since the pre-flip cleanup (Amendment C §C1, D-af) every team is named by the
// SERVER: each seat carries `label` (its primary agent's name) and `secondary`
// (the player), each of the viewer's stakes its `teamLabel`, and Your Backing's
// names arrive as `labelsById` (label, secondary and the two layers — the
// team-labels route's reply). No reply carries `seatNames` any more.
const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z'; // Sun 27 Sep 23:59 ET
const WED_FIRE = '2026-09-23T23:00:00.000Z';     // a slot pod's fire, Wed 7:00 PM ET
const NAMES = {
  'od-a': { label: 'Kestrel', secondary: 'Mira', player: 'Mira', agent: 'Kestrel' },
  'od-b': { label: 'Tarn', secondary: 'Draco', player: 'Draco', agent: 'Tarn' },
  'od-x': { label: 'Orbit', secondary: 'Rigel', player: 'Rigel', agent: 'Orbit' },
  'cpu-1': { label: 'CPU — Trend Follower', secondary: null, player: 'CPU — Trend Follower', agent: 'CPU — Trend Follower' },
  'cpu-2': { label: 'CPU — Contrarian', secondary: null, player: 'CPU — Contrarian', agent: 'CPU — Contrarian' },
  'cpu-3': { label: 'CPU — Diversifier', secondary: null, player: 'CPU — Diversifier', agent: 'CPU — Diversifier' },
  'cpu-4': { label: 'CPU — Speculator', secondary: null, player: 'CPU — Speculator', agent: 'CPU — Speculator' },
};
const labelOf = (id) => ({ label: NAMES[id].label, secondary: NAMES[id].secondary });
const labelsFor = (...groupIds) => Object.fromEntries(groupIds.map((g) => [g, NAMES]));
const seats = [
  { odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: true, ...labelOf('od-a') },
  { odUserId: 'od-b', isCpu: false, isOwnSeat: false, backable: true, ...labelOf('od-b') },
  { odUserId: 'cpu-1', isCpu: true, isOwnSeat: false, backable: true, ...labelOf('cpu-1') },
  { odUserId: 'cpu-2', isCpu: true, isOwnSeat: false, backable: true, ...labelOf('cpu-2') },
];
const pod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40',
  humanTeams: 2, teams: seats,
  pool: { status: 'open', closesAt: SUNDAY_CLOSE, closeReason: 'clock', backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false } },
  myStakes: [],
  ...over,
});
const podsReply = (pods) => ({
  data: { baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: SUNDAY_CLOSE, viewerUid: 'viewer-1', pods },
  pods, loading: false, error: null, refresh: () => {},
});
const nothingInPlay = { stakes: [], poolsById: {}, groupsById: {}, loading: false };
const battleGroup = (over = {}) => ({
  status: 'battle', baseLayerWeek: '2026-W39', seatNames: { 'od-a': 'Mira', 'od-x': 'Rigel' },
  players: [{ odUserId: 'od-a' }, { odUserId: 'od-x' }, { odUserId: 'cpu-3', isCpu: true }, { odUserId: 'cpu-4', isCpu: true }],
  dailyScores: {
    day1: { closeScores: { 'od-a': { compositePoints: 2.1 }, 'od-x': { compositePoints: 3.0 }, 'cpu-3': { compositePoints: 1.0 }, 'cpu-4': { compositePoints: -0.4 } } },
    day2: { closeScores: { 'od-a': { compositePoints: 4.8 }, 'od-x': { compositePoints: 5.1 }, 'cpu-3': { compositePoints: 1.2 }, 'cpu-4': { compositePoints: -0.5 } } },
  },
  ...over,
});

const STRIP_STATES = {
  open: {
    pods: podsReply([pod('lobby-w40-a'), pod('lobby-w40-b'), pod('lds-wed-1900', { formationPath: 'slot', slotId: 'wed-1900', pool: { status: 'open', closesAt: WED_FIRE, closeReason: 'fire', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false } } })]),
    inPlay: nothingInPlay,
  },
  staked: {
    pods: podsReply([
      pod('lobby-w40-a', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: NAMES['od-a'].label, amount: 250, status: 'live' }] }),
      pod('lobby-w40-b', { myStakes: [{ stakeId: 's2', teamOdUserId: 'cpu-1', teamLabel: NAMES['cpu-1'].label, amount: 100, status: 'live' }] }),
      pod('lobby-w40-c'),
    ]),
    inPlay: nothingInPlay,
  },
  week: {
    pods: podsReply([pod('lobby-w40-a')]),
    inPlay: {
      stakes: [
        { id: 's9', groupId: 'lobby-w39-a', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' },
        { id: 's10', groupId: 'lobby-w39-b', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W39' },
      ],
      poolsById: { 'lobby-w39-a': { status: 'closed', closesAt: '2026-09-21T03:59:59.000Z' }, 'lobby-w39-b': { status: 'closed', closesAt: '2026-09-21T03:59:59.000Z' } },
      groupsById: { 'lobby-w39-a': battleGroup(), 'lobby-w39-b': battleGroup({ seatNames: { 'od-x': 'Rigel', 'od-a': 'Mira' } }) },
      labelsById: labelsFor('lobby-w39-a', 'lobby-w39-b'),
      loading: false,
    },
  },
  between: {
    pods: podsReply([]),
    inPlay: {
      stakes: [{ id: 's7', groupId: 'lobby-w39-a', teamOdUserId: 'od-a', amount: 250, status: 'settled', weekKey: '2026-W39' }],
      poolsById: { 'lobby-w39-a': { status: 'resolved' } },
      groupsById: { 'lobby-w39-a': battleGroup({ status: 'complete' }) },
      labelsById: labelsFor('lobby-w39-a'),
      loading: false,
    },
  },
};

// ── the card's inputs, shaped like the projection ───────────────────────────
const APPROACH = 'Goes where the momentum is — and leaves the moment it fades.';
const seat = (over = {}) => ({ index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false, ...over });
const openPod = (over = {}) => ({ groupId: 'lobby-w40-a', pool: { status: 'open', closesAt: SUNDAY_CLOSE }, myStakes: [], ...over });

const firstWeek = {
  groupId: 'lobby-w40-a', odUserId: 'od-b', viewerUid: 'viewer-1',
  seat: seat({ index: 2 }),
  team: { displayName: 'Draco', ...labelOf('od-b'), isCpu: false, pitch: 'Macro guy. Tarn keeps me from being too early.', derived: null,
    agent: { name: 'Tarn', archetype: 'analyst', archetypeLabel: 'Fundamental Investor', approach: 'Buys quality companies and lets the fundamentals do the work.', traitCount: 3, ruleCount: 5 } },
  known: null,
  lastWeek: null,
};

const veteran = {
  groupId: 'lobby-w40-a', odUserId: 'od-a', viewerUid: 'viewer-1',
  seat: seat(),
  team: { displayName: 'Mira', ...labelOf('od-a'), isCpu: false, pitch: 'I take the leader in whatever sector has breadth on Monday.', derived: 'Held 2 of 3 all week · 2 moves · leaned technology',
    agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: APPROACH, traitCount: 4, ruleCount: 7 } },
  known: { rp: 412, tier: 2, tierName: 'Analyst', weeksPlayed: 2, priorFinishes: [1, 2] },
  lastWeek: {
    groupId: 'lobby-w38-c', baseLayerWeek: '2026-W38', placement: 1, seatCount: 4, composite: 8.7,
    human: { drafted: ['NVDA', 'AMD', 'COIN'], picks: [
      { symbol: 'NVDA', drafted: true, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, swappedOut: null },
      { symbol: 'AMD', drafted: true, heldAtClose: true, flips: 1, direction: 'short', lastFlipDay: 'WED', swappedOut: null },
      { symbol: 'COIN', drafted: true, heldAtClose: false, flips: null, direction: null, lastFlipDay: null, swappedOut: { day: 'TUE', forSymbol: 'XLE' } },
      { symbol: 'XLE', drafted: false, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, claimedIn: { day: 'TUE', forSymbol: 'COIN' } },
    ] },
    agent: { agentName: 'Kestrel', swaps: 1, picks: [
      { symbol: 'NVDA', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'AVGO', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'ANET', sector: 'technology', drafted: true, heldAtClose: false, swappedOut: { day: 'THU', forSymbol: 'SMCI' } },
      { symbol: 'VST', sector: 'energy', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'META', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'LLY', sector: 'healthcare', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'SMCI', sector: 'technology', drafted: false, heldAtClose: true, addedIn: { day: 'THU', forSymbol: 'ANET' } },
    ], trades: [{ day: 'THU', symbolOut: 'ANET', symbolIn: 'SMCI', rationale: 'Broke its Monday low. Rule is rule.' }] },
    tape: { groupId: 'lobby-w38-c', focusId: 'od-a' },
  },
};

describe('the strip — four states, through the gated landing mount with the flag forced on', () => {
  for (const [state, inputs] of Object.entries(STRIP_STATES)) {
    it(state, () => {
      hooked.pods = inputs.pods;
      hooked.inPlay = inputs.inPlay;
      const html = write(`strip-${state}`, `Backing strip · ${state}`, <BackingLandingStrip uid="viewer-1" accent={LX.energy} onOpen={() => {}} />);
      expect(html).toContain(`data-strip-state="${state}"`);
    });
  }
});

describe('the team card — first-week and veteran', () => {
  it('first-week', () => {
    const html = write('card-first-week', 'Team card · first week', <TeamCard card={firstWeek} pod={openPod()} onBack={() => {}} onOpenTape={() => {}} />);
    expect(html).toContain('data-backing="tape-first-week"');
  });
  it('veteran', () => {
    const html = write('card-veteran', 'Team card · veteran', <TeamCard card={veteran} pod={openPod()} onBack={() => {}} onOpenTape={() => {}} />);
    expect(html).toContain('data-backing="tape-last-week"');
  });
});
