// src/components/League/backing/TeamCard.test.jsx
//
// Backing Beta PR 4 — SURFACE B, the team card, rendered from the projection
// GET /api/tournament/team-card returns (the shapes team-card.test.js pins).
//
// THE ROWS THIS FILE EXISTS FOR:
//   · THE FIRST-WEEK CARD IS THE PRIMARY CASE (rev2 §4): it renders a real
//     decision from the pitch, the approach, the counts and "no weeks yet" —
//     and never a fabricated finish, standing or tape.
//   · COMPLETED HISTORY ONLY (rev3 §2): no live standing anywhere on the card.
//   · THE VETERAN'S TAPE is the projection's recorded facts, worded by the
//     copy module; the why is the agent's own recorded words.
//   · PROJECTION ONLY — MUTATION CHECK #5: the card and the whole backing
//     client read NO `agents` document. Asserted on the source tree by key
//     names and import lines, so a client `collection(db, 'agents')` reds it.
//   · NO FIXTURE DATA ON A REAL PATH: the backing surfaces import neither the
//     fixture REASONING map nor leagueFixtures.
//
// react-dom/server: the card is pure over its props (no data hook inside).

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TeamCard from './TeamCard';
import { agentPickDid, humanPickDid } from './backingCopy';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');

const APPROACH = 'Goes where the momentum is — and leaves the moment it fades.';

const seat = (over = {}) => ({ index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false, ...over });

const firstWeek = () => ({
  groupId: 'g-now', odUserId: 'od-b', viewerUid: 'viewer-1',
  seat: seat({ index: 2 }),
  team: { displayName: 'Draco', isCpu: false, pitch: 'Macro guy. Tarn keeps me from being too early.', derived: null,
    agent: { name: 'Tarn', archetype: 'analyst', archetypeLabel: 'Fundamental Investor', approach: 'Buys quality companies and lets the fundamentals do the work.', traitCount: 3, ruleCount: 5 } },
  known: null,
  lastWeek: null,
});

const cpu = () => ({
  groupId: 'g-now', odUserId: 'cpu-1', viewerUid: 'viewer-1',
  seat: seat({ index: 3, isCpu: true }),
  team: { displayName: 'CPU — Trend Follower', isCpu: true, pitch: null, derived: null,
    agent: { name: 'CPU — Trend Follower', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: APPROACH, traitCount: 0, ruleCount: 0 } },
  known: null,
  lastWeek: null,
});

const veteran = () => ({
  groupId: 'g-now', odUserId: 'od-a', viewerUid: 'viewer-1',
  seat: seat(),
  team: { displayName: 'Mira', isCpu: false, pitch: 'I take the leader in whatever sector has breadth on Monday.', derived: 'Held 2 of 3 all week · 2 moves · leaned technology',
    agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: APPROACH, traitCount: 4, ruleCount: 7 } },
  known: { rp: 412, tier: 2, tierName: 'Analyst', weeksPlayed: 2, priorFinishes: [1, 2] },
  lastWeek: {
    groupId: 'g-w2', baseLayerWeek: '2026-W38', placement: 1, seatCount: 4, composite: 8.7,
    human: { drafted: ['NVDA', 'AMD', 'COIN'], picks: [
      { symbol: 'NVDA', drafted: true, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, swappedOut: null },
      { symbol: 'AMD', drafted: true, heldAtClose: true, flips: 1, direction: 'short', lastFlipDay: 'WED', swappedOut: null },
      { symbol: 'COIN', drafted: true, heldAtClose: false, flips: null, direction: null, lastFlipDay: null, swappedOut: { day: 'TUE', forSymbol: 'XLE' } },
      { symbol: 'XLE', drafted: false, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, claimedIn: { day: 'TUE', forSymbol: 'COIN' } },
    ] },
    agent: { agentName: 'Kestrel', swaps: 1, picks: [
      { symbol: 'NVDA', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'ANET', sector: 'technology', drafted: true, heldAtClose: false, swappedOut: { day: 'THU', forSymbol: 'SMCI' } },
      { symbol: 'SMCI', sector: null, drafted: false, heldAtClose: true, addedIn: { day: 'THU', forSymbol: 'ANET' } },
    ], trades: [{ day: 'THU', symbolOut: 'ANET', symbolIn: 'SMCI', rationale: 'Broke its Monday low. Rule is rule.' }] },
    tape: { groupId: 'g-w2', focusId: 'od-a' },
  },
});

const openPod = (over = {}) => ({ groupId: 'g-now', pool: { status: 'open', closesAt: '2026-09-28T03:59:59.000Z' }, myStakes: [], ...over });
const render = (card, pod = openPod(), props = {}) => renderToString(<TeamCard card={card} pod={pod} onBack={() => {}} onOpenTape={() => {}} {...props} />);

describe('the FIRST-WEEK card — the primary case', () => {
  const html = render(firstWeek());

  it('leads with the team: the human and their agent as one unit, the archetype as a tag', () => {
    expect(html).toContain('data-backing="team-unit"');
    expect(html).toContain('Draco');
    expect(html).toContain('Tarn');
    expect(html).toContain('Fundamental Investor');
    expect(html).toContain('picks 3');
    expect(html).toContain('agent · runs 6');
    expect(html).toContain('seat 2 of 4');
  });

  it('shows the pitch in the player’s words, the agent’s stated approach, and LOADOUT COUNTS ONLY', () => {
    expect(html).toContain('Macro guy. Tarn keeps me from being too early.');
    expect(html).toContain('Buys quality companies and lets the fundamentals do the work.');
    expect(html).toContain('3 traits · 5 rules · contents private · may change nightly');
  });

  it('says what is true: FIRST WEEK · no tape yet, no weeks yet, 0 weeks played — and invents no finish', () => {
    expect(html).toContain('FIRST WEEK · no tape yet');
    expect(html).toContain('First week · no tape yet');
    expect(html).toContain('Nothing to replay. Judge the team as stated.');
    expect(html).toContain('no weeks yet');
    expect(html).toContain('data-backing="tape-first-week"');
    expect(html).not.toContain('Finished');
    expect(html).not.toContain('1st');
    expect(html).not.toContain('data-backing="tape-last-week"');
  });

  it('the first-week body names what the reader has — their pitch, the approach, the counts — and when the draft lands', () => {
    expect(html).toContain('their pitch');
    expect(html).toContain('a 3-trait, 5-rule loadout');
    expect(html).toContain('The three-stock draft lands Monday — after this pool closes.');
    // rev3 §2: no live standing, no "how they stand right now".
    expect(html).not.toMatch(/right now/i);
    expect(html).not.toMatch(/Round 1 now/);
  });

  it('a first-week team with no pitch says so plainly', () => {
    const card = firstWeek();
    card.team.pitch = null;
    const h = render(card);
    expect(h).toContain('Hasn’t written a pitch yet.');
    expect(h).toContain('no pitch yet');
  });

  it('the CTA backs the team while the pool is open', () => {
    expect(html).toContain('Back Draco &amp; Tarn');
    expect(html).toContain('data-backing="cta-back"');
  });
});

describe('the CPU seat — archetype and no history', () => {
  const html = render(cpu());

  it('reads as the house on both layers, with the archetype template named', () => {
    expect(html).toContain('CPU — Trend Follower · house');
    expect(html).toContain('CPU seat · no history');
    expect(html).toContain('The Trend Follower archetype runs the six');
    expect(html).toContain('No owner behind the seat.');
    expect(html).toContain('>CPU<');
    expect(html).toContain('>none<');
  });

  it('claims nothing the house does not do — no "holds them all week", no finish, no tape', () => {
    expect(html).not.toMatch(/holds them all week/i);
    expect(html).not.toContain('Finished');
    expect(html).not.toContain('FIRST WEEK');
  });
});

describe('the VETERAN card — last week, both layers, from recorded facts', () => {
  const html = render(veteran());

  it('carries the derived line, the completed-history strip, and no live standing', () => {
    expect(html).toContain('Held 2 of 3 all week · 2 moves · leaned technology');
    expect(html).toContain('412 RP');
    expect(html).toContain('Analyst');
    expect(html).toContain('1st 2nd');
    expect(html).toContain('>2<');
    expect(html).not.toMatch(/right now|live standing|current standing/i);
  });

  it('the human layer: drafted picks and what became of them, worded from the facts', () => {
    expect(html).toContain('Finished 1st of 4 · +8.7');
    expect(html).toContain('Held all week');
    expect(html).toContain('Flipped short Wed');
    expect(html).toContain('Swapped out Tue for XLE');
    expect(html).toContain('Claimed Tue for COIN');
    expect(html).toContain('Mira · 3');
  });

  it('the agent layer: the six, the swap, and the why in the agent’s recorded words', () => {
    expect(html).toContain('Kestrel · 6');
    expect(html).toContain('>Held<');
    expect(html).toContain('Out Thu for SMCI');
    expect(html).toContain('In Thu for ANET');
    expect(html).toContain('Broke its Monday low. Rule is rule.');
    expect(html).toContain('in for ANET');
    expect(html).toContain('Full film room · every close, both layers');
    expect(html).toContain('data-backing="film-room"');
  });

  it('a week with no recorded swap says so rather than showing an empty tape', () => {
    const card = veteran();
    card.lastWeek.agent.trades = [];
    expect(render(card)).toContain('No swaps recorded — the agent held its six.');
  });
});

describe('the CTA follows the pool and the viewer', () => {
  it('with a live stake on the team it offers to add to it', () => {
    const html = render(veteran(), openPod({ myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }] }));
    expect(html).toContain('Add to your 250 on Mira');
  });

  it('once the pool has closed it says so, and names the viewer’s stake', () => {
    const html = render(veteran(), { groupId: 'g-now', pool: { status: 'closed' }, myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }] });
    expect(html).toContain('BACKED · 250 BP · BACKING CLOSED FOR THE WEEK');
    expect(html).not.toContain('data-backing="cta-back"');
  });

  it('the viewer’s own pod reads as yours — never disabled, never a stake button', () => {
    const card = veteran();
    card.seat = seat({ viewerSeated: true });
    expect(render(card)).toContain('Your pod. Backing is for the pods you watch.');
    card.seat = seat({ viewerSeated: true, isViewer: true });
    const own = render(card, openPod(), { myPitch: { text: 'Mine.', save: async () => true, saving: false, error: null } });
    expect(own).toContain('This is your team. Backing is for the pods you watch.');
    expect(own).toContain('Same line as your profile');
    expect(own).toContain('>EDIT<');
    expect(own).not.toContain('disabled');
  });
});

describe('PROJECTION ONLY — MUTATION CHECK #5, on the source tree', () => {
  const backingDir = readdirSync(HERE).filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(HERE, f));
  const clientFiles = [
    ...backingDir,
    ...['src/services/backingService.js', 'src/hooks/useBackingPods.js', 'src/hooks/useMyBacking.js', 'src/hooks/useBackingWallet.js',
      'src/hooks/useEligibility.js', 'src/hooks/useTeamCard.js', 'src/hooks/useMyPitch.js',
      // PR 5: the results and stats hooks and the telemetry emitter.
      'src/hooks/useBackingResults.js', 'src/hooks/useMyBackingStats.js', 'src/hooks/useTrainerStats.js', 'src/services/backingTelemetry.js'].map((r) => path.join(REPO, r)),
  ];
  const stripped = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('no backing client file reads the `agents` collection, by any spelling', () => {
    for (const f of clientFiles) {
      const src = stripped(f);
      expect(src, `${path.relative(REPO, f)} names the agents collection`).not.toMatch(/['"`]agents['"`]/);
      expect(src, `${path.relative(REPO, f)} reads an agent doc`).not.toMatch(/subscribeToUserAgent|useAgent\b|agentService/);
    }
  });

  it('TeamCard.jsx renders from its props alone — it imports no service, hook or Firebase module', () => {
    const imports = stripped(path.join(HERE, 'TeamCard.jsx')).split('\n').filter((l) => /^\s*import\s/.test(l));
    for (const line of imports) {
      expect(line).not.toMatch(/services\/|hooks\/|firebase/);
    }
    expect(imports.length).toBeGreaterThan(3);
  });

  it('every agent-derived field on the card is read off the projection’s `team.agent`, never derived here', () => {
    const src = stripped(path.join(HERE, 'TeamCard.jsx'));
    expect(src).toContain('team.agent');
    expect(src).not.toMatch(/getArchetypeIdentity|ARCHETYPE_IDENTITY|agentArchetypeConfig|equippedTraits|activeRules/);
  });

  it('no backing surface imports the fixture REASONING map or leagueFixtures — no fixture data on a real path', () => {
    for (const f of backingDir) {
      const src = stripped(f);
      expect(src, `${path.basename(f)} reaches fixtures`).not.toMatch(/leagueFixtures|REASONING|RIVALRY|backing-data|ARCH_PROFILE/);
    }
  });
});

describe('the PR 4 review record — FAB-4, FAB-8, FAB-13, FAB-14, FAB-5 (docs/audits/20260922_BACKING_PR4_MULTILENS_REVIEW.md)', () => {
  it('FAB-4: on a live-draft (slot) pod the first-week body says the draft lands at the fire, never Monday', () => {
    const html = render(firstWeek(), openPod({ formationPath: 'slot', slotId: 'wed-1900' }));
    expect(html).toContain('The three-stock draft lands at the slot’s fire — the moment this pool closes.');
    expect(html).not.toContain('lands Monday');
    expect(render(firstWeek(), openPod({ formationPath: 'lobby' }))).toContain('The three-stock draft lands Monday — after this pool closes.');
  });

  it('FAB-8: the house’s seat carries no loadout marker — no "contents private", no "may change nightly"', () => {
    const html = render(cpu());
    expect(html).not.toContain('data-backing="loadout"');
    expect(html).not.toContain('contents private');
    expect(html).not.toContain('may change nightly');
    // On the visible text (the markup's CSS carries 'grid-template-columns').
    const text = html.replace(/<[^>]*>/g, ' ');
    expect(text).not.toMatch(/\btemplate\b/);
    expect(text).not.toMatch(/\bbets?\b/);
  });

  it('FAB-13: completed weeks on the record but no readable tape is "No tape on file" — never FIRST WEEK', () => {
    const card = veteran();
    card.lastWeek = null;
    card.team.derived = null;
    const html = render(card);
    expect(html).toContain('data-backing="tape-none"');
    expect(html).toContain('No tape on file');
    expect(html).not.toContain('FIRST WEEK');
    expect(html).not.toContain('data-backing="tape-first-week"');
    expect(html).toContain('412 RP');
  });

  it('FAB-14: a rank doc without an RP figure shows a dash, never "0 RP"', () => {
    const card = veteran();
    card.known = { ...card.known, rp: null };
    const html = render(card);
    expect(html).not.toContain('0 RP');
    expect(html).toContain('>—<');
  });

  it('FAB-5: the why is headed as the trade’s recorded note, not as the agent’s own words', () => {
    const html = render(veteran());
    expect(html).toContain('The why · as recorded on the trade');
    expect(html).not.toContain('in their agent’s words');
  });

  it('FAB-6: a roster name with no draft record reads as on the roster at close — never "Held all week", never "Claimed"', () => {
    expect(humanPickDid({ symbol: 'NVDA', drafted: null, heldAtClose: true, flips: 0, claimedIn: null })).toBe('On the roster at close');
    expect(humanPickDid({ symbol: 'XLE', drafted: null, heldAtClose: true, flips: 0, claimedIn: { day: 'TUE', forSymbol: 'COIN' } })).toBe('Claimed Tue for COIN');
    expect(humanPickDid({ symbol: 'AMD', drafted: true, heldAtClose: true, flips: 0, dropped: { day: 'TUE', forSymbol: 'XLE' }, reclaimed: { day: 'THU', forSymbol: 'XLE' } })).toBe('Dropped Tue · back Thu');
    expect(agentPickDid({ symbol: 'SMCI', drafted: null, heldAtClose: true, addedIn: null })).toBe('In the book at close');
  });
});

describe('the PR 4 review record — refutation pass (R-A-6)', () => {
  it('on a pool that has already closed the first-week body no longer speaks of the draft as ahead of the close', () => {
    const html = render(firstWeek(), openPod({ pool: { status: 'closed', closesAt: '2026-09-28T03:59:59.000Z' } }));
    expect(html).toContain('This pool has closed; the three-stock draft follows.');
    expect(html).not.toContain('after this pool closes');
    expect(html).not.toContain('the moment this pool closes');
    expect(html).toContain('BACKING CLOSED FOR THE WEEK');
  });
});
