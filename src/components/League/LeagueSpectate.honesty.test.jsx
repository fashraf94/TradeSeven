// src/components/League/LeagueSpectate.honesty.test.jsx
//
// PRE-FLIP HONESTY FIX A (Backing spec V1.3 §11 gate 3) — the film room shows
// a settled seat's OWN recorded words, or an honest empty state. NO fixture
// sentence renders on a real-adapter path, in any Spectate state.
//
// THE BUG IT PINS: LeagueSpectate.jsx shipped a fixture `REASONING` map and
// rendered `REASONING[player.id]` in the unlocked film room — on the real
// adapter too (LEAGUE_NEXT_ARC_ENABLED is live), and on backing's tape link
// (fetchTapePod → groupToPod). A real seat read an empty paragraph, or, on an
// id collision, a demo sentence presented as the player's reasoning.
//
// Rows:
//   · SEPARATION PIN — LeagueSpectate.jsx carries no reasoning text and looks
//     none up by id; the fixture map lives in leagueFixtures.js alone and is
//     imported by no surface; the real adapter never reaches leagueFixtures.
//   · EVERY REAL STATE, EVERY SEAT — pods built by the REAL adapter (groupToPod,
//     the call backing's fetchTapePod and useRealLeagueState make) from a
//     production-shaped group + the WHY-projecting endpoint's replies: live
//     (WHAT-only + _whyConcealed) beside the viewer's own full-WHY active
//     battle, upcoming, final with recorded words, final without, final with
//     no battle at all (the endpoint unavailable — the tape's degrade path), a
//     group settled while a battle doc is still active, and a bracket final.
//     Every seat is focused in turn and every fixture value asserted ABSENT
//     from the VISIBLE text (tags stripped, entities decoded — the positive
//     control proves the decode sees the words).
//   · THE ID-COLLISION TRAP — a real seat whose id equals a fixture key
//     ('atlas'). MUTATION CHECK: restore `REASONING[player.id]` on the real
//     path and this row reds.
//   · THE HONEST EMPTY STATE — "No reasoning recorded for this battle." for a
//     settled seat with nothing recorded; never on a live/locked seat; never
//     beside real words.
//   · THE REAL WORDS — a completed battle's strategy read and swap rationale
//     render, labelled by the swap; an engine-authored motive renders without
//     its guardrail CODE (renderMotive, hazard 29); a live seat's full WHY
//     (the owner's own active battle) never renders, even on a settled group.
//   · battleToReasoning — the adapter's rule, unit-pinned.
//   · POSITIVE CONTROL — the fixture world (leagueState) still renders its own
//     sentence in its settled film room, so the absence rows are not vacuous.
//
// react-dom/server: Spectate is pure over its props (state = the focus only);
// the backing results mount is stood in for (it renders nothing while dark
// and is not this file's subject).

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../firebase/config', () => ({ auth: { currentUser: null }, db: {}, default: {} }));
vi.mock('./backing/SpectateBackingResults', () => ({ default: () => null }));

import Spectate, { NO_REASONING_RECORDED } from './LeagueSpectate';
import { FIXTURE_REASONING, leagueState } from './leagueFixtures';
import { groupToPod, buildSeat, battleToReasoning } from './leagueAdapter';
import { GROUP_STATUS } from '../../constants/leagueTournament';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');

const FIXTURE_VALUES = Object.values(FIXTURE_REASONING);
const SEALED_NOTE = 'private reasoning stays sealed until the group completes.';

// ── visible text: tags stripped, entities decoded (SSR escapes ' " & < >) ─────
function visibleText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}
const render = (pod, focusId) => visibleText(renderToString(
  <Spectate pod={pod} focusId={focusId} accent="#5EEAD4" onBack={() => {}} onEnter={() => {}} />,
));
const seatedIds = (pod) => pod.seats.filter(Boolean).map((s) => s.id);

// ── the real world: a production-shaped group + the endpoint's projections ───
const VIEWER = 'u-viewer-000000000000000000000';   // 28 chars, like a uid
const RIVAL = 'u-rival-0000000000000000000000';
const CPU = 'cpu-1';
const COLLIDER = 'atlas';                          // a real id that equals a fixture key
const NAMES = { [VIEWER]: 'Viewer', [RIVAL]: 'Rival', [COLLIDER]: 'Collider' };

const group = (status) => ({
  id: 'grp-real-1', status, roundNumber: 1, baseLayerWeek: '2026-W39',
  groupMembers: [VIEWER, RIVAL, CPU, COLLIDER],
  players: [
    { odUserId: VIEWER, picks: [{ symbol: 'NVDA', legs: [{ direction: 'long' }] }] },
    { odUserId: RIVAL, picks: [{ symbol: 'XLE', legs: [{ direction: 'long' }] }] },
    { odUserId: CPU, isCpu: true, picks: [] },
    { odUserId: COLLIDER, picks: [{ symbol: 'GLD', legs: [{ direction: 'long' }] }] },
  ],
  dailyScores: { day1: { closeScores: {
    [VIEWER]: { compositePoints: 4 }, [RIVAL]: { compositePoints: 2.5 }, [CPU]: { compositePoints: 1 }, [COLLIDER]: { compositePoints: 0.5 },
  } } },
});

// The strings that must NEVER reach a reader from these fixtures.
const LIVE_STRATEGY = 'LIVE-STRATEGY-MUST-NEVER-RENDER';
const LIVE_RATIONALE = 'LIVE-RATIONALE-MUST-NEVER-RENDER';
const STRATEGY = 'Buy strength on Monday, cut anything that breaks its low.';
const RATIONALE = 'Broke its Monday low. Rule is rule.';
const ENGINE_RATIONALE = 'Guardrail override (guardrail_stopLoss): Guardrail override: stop-loss at 8% breached on COIN (-9.24%).';

const portfolio = { star: [{ symbol: 'NVDA' }], core: [{ symbol: 'AMD' }], support: [{ symbol: 'AVGO' }] };
const concealed = (ownerId) => ({
  id: `b-${ownerId}-live`, ownerId, status: 'active', groupId: 'grp-real-1', isCpu: ownerId === CPU,
  agentContext: { agentName: 'Kestrel', archetype: 'momentum_chaser', initialPortfolio: portfolio },
  portfolio, statusFeed: [], trades: [], _whyConcealed: true,
});
const ownActive = (ownerId) => ({
  id: `b-${ownerId}-own-live`, ownerId, status: 'active', groupId: 'grp-real-1',
  agentContext: { agentName: 'Tarn', archetype: 'analyst', innerMonologue: { strategy: LIVE_STRATEGY }, initialPortfolio: portfolio },
  portfolio, trades: [{ symbolOut: 'AMD', symbolIn: 'SMCI', rationale: LIVE_RATIONALE }],
});
const completedWithWords = (ownerId) => ({
  id: `b-${ownerId}-done`, ownerId, status: 'completed', groupId: 'grp-real-1',
  agentContext: { agentName: 'Kestrel', archetype: 'momentum_chaser', innerMonologue: { strategy: STRATEGY }, initialPortfolio: portfolio },
  portfolio,
  trades: [
    { symbolOut: 'ANET', symbolIn: 'SMCI', rationale: RATIONALE },
    { symbolOut: 'COIN', symbolIn: 'XLE', rationale: ENGINE_RATIONALE },
  ],
});
const completedSilent = (ownerId) => ({
  id: `b-${ownerId}-done-silent`, ownerId, status: 'completed', groupId: 'grp-real-1',
  agentContext: { agentName: 'Tarn', archetype: 'analyst', innerMonologue: {}, initialPortfolio: portfolio },
  portfolio, trades: [],
});

const pod = (status, battlesByOwner, extra = {}) =>
  groupToPod(group(status), { names: NAMES, uid: VIEWER, base: true, battlesByOwner, ...extra });

// Every real Spectate state this file walks. Each is the adapter's output for
// a real group and a real endpoint reply — never a hand-built seat.
const REAL_STATES = [
  ['live — rivals WHAT-only (_whyConcealed) beside the viewer\'s own full-WHY active battle',
    pod(GROUP_STATUS.BATTLE, { [RIVAL]: concealed(RIVAL), [CPU]: concealed(CPU), [COLLIDER]: concealed(COLLIDER), [VIEWER]: ownActive(VIEWER) })],
  ['upcoming — a forming group, no battles yet', pod(GROUP_STATUS.FORMING, {})],
  ['final — recorded words for the rival and the collider, nothing recorded for the viewer, the CPU silent',
    pod(GROUP_STATUS.COMPLETE, { [RIVAL]: completedWithWords(RIVAL), [COLLIDER]: completedSilent(COLLIDER), [VIEWER]: completedSilent(VIEWER), [CPU]: completedWithWords(CPU) })],
  ['final — no battles at all (battle-view unavailable: the tape\'s degrade path)', pod(GROUP_STATUS.COMPLETE, {})],
  ['final — the group settled while a battle doc is still ACTIVE with full WHY (the owner\'s)',
    pod(GROUP_STATUS.COMPLETE, { [VIEWER]: ownActive(VIEWER), [RIVAL]: concealed(RIVAL) })],
  ['final — expired (terminal like complete)', pod(GROUP_STATUS.EXPIRED, { [RIVAL]: completedWithWords(RIVAL) })],
  ['bracket final — the cut line renders, the film room reads the same',
    pod(GROUP_STATUS.COMPLETE, { [RIVAL]: completedWithWords(RIVAL), [COLLIDER]: completedSilent(COLLIDER) }, { base: false })],
  ['bracket live', pod(GROUP_STATUS.BATTLE, { [RIVAL]: concealed(RIVAL), [VIEWER]: ownActive(VIEWER) }, { base: false })],
];

// ── source helpers ───────────────────────────────────────────────────────────
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('SEPARATION PIN — fixture reasoning lives in the fixture module alone', () => {
  it('LeagueSpectate.jsx carries no reasoning text and looks none up by id', () => {
    const src = stripComments(readFileSync(path.join(HERE, 'LeagueSpectate.jsx'), 'utf8'));
    expect(src).not.toMatch(/\bREASONING\b|FIXTURE_REASONING/);
    expect(src).not.toMatch(/reasoning\s*\[\s*player/i);
    for (const v of FIXTURE_VALUES) expect(src).not.toContain(v);
    // the surface reads the SEAT field, in the unlocked branch only
    expect(src).toContain('player.reasoning');
    expect(src).toContain('NO_REASONING_RECORDED');
  });

  it('FIXTURE_REASONING is referenced by leagueFixtures.js and by tests only — no surface, hook, service or adapter imports it', () => {
    const offenders = walk(SRC)
      .filter((f) => !/\.(test|spec)\.[jt]sx?$|\.rules\.mjs$/.test(f))
      .filter((f) => stripComments(readFileSync(f, 'utf8')).includes('FIXTURE_REASONING'))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual(['components/League/leagueFixtures.js']);
  });

  it('the real adapter never reaches the fixture module', () => {
    const src = stripComments(readFileSync(path.join(HERE, 'leagueAdapter.js'), 'utf8'));
    expect(src).not.toMatch(/leagueFixtures/);
    for (const v of FIXTURE_VALUES) expect(src).not.toContain(v);
  });

  it('a fixture seat carries its sentence as the seat field (the ONLY place fixture text is attached)', () => {
    const east = leagueState('open').rounds.r1[0];
    const atlas = east.seats.find((s) => s && s.id === 'atlas');
    expect(atlas.reasoning).toEqual([{ key: 'fixture', label: null, text: FIXTURE_REASONING.atlas }]);
  });
});

describe('EVERY REAL STATE, EVERY SEAT — zero fixture strings on a real-adapter path', () => {
  it.each(REAL_STATES)('%s', (_label, realPod) => {
    expect(seatedIds(realPod)).toContain(COLLIDER); // the trap is armed in every state
    for (const focusId of seatedIds(realPod)) {
      const text = render(realPod, focusId);
      for (const v of FIXTURE_VALUES) expect(text, `seat ${focusId}: fixture text rendered`).not.toContain(v);
      expect(text, `seat ${focusId}: a LIVE strategy rendered`).not.toContain(LIVE_STRATEGY);
      expect(text, `seat ${focusId}: a LIVE rationale rendered`).not.toContain(LIVE_RATIONALE);
    }
  });

  it('THE ID-COLLISION TRAP — a real seat whose id is a fixture key never shows the fixture sentence (restore REASONING[player.id] → this reds)', () => {
    // settled, the collider's battle silent → the honest empty state, not "atlas"'s demo line
    const settled = pod(GROUP_STATUS.COMPLETE, { [COLLIDER]: completedSilent(COLLIDER) });
    const text = render(settled, COLLIDER);
    expect(text).not.toContain(FIXTURE_REASONING.atlas);
    expect(text).toContain(NO_REASONING_RECORDED);
    // settled, no battle for the collider at all → the same
    const bare = render(pod(GROUP_STATUS.COMPLETE, {}), COLLIDER);
    expect(bare).not.toContain(FIXTURE_REASONING.atlas);
    expect(bare).toContain(NO_REASONING_RECORDED);
    // live → locked; neither the fixture line nor the empty state
    const live = render(pod(GROUP_STATUS.BATTLE, { [COLLIDER]: concealed(COLLIDER) }), COLLIDER);
    expect(live).not.toContain(FIXTURE_REASONING.atlas);
    expect(live).not.toContain(NO_REASONING_RECORDED);
    expect(live).toContain(SEALED_NOTE);
  });
});

describe('THE HONEST EMPTY STATE and THE REAL WORDS', () => {
  const settled = pod(GROUP_STATUS.COMPLETE, {
    [RIVAL]: completedWithWords(RIVAL), [VIEWER]: completedSilent(VIEWER), [COLLIDER]: completedSilent(COLLIDER),
  });

  it('a settled seat with recorded words shows them — the strategy read, then each swap in the agent\'s own words, labelled by the swap', () => {
    const text = render(settled, RIVAL);
    expect(text).toContain('Film room · unlocked');
    expect(text).toContain(STRATEGY);
    expect(text).toContain('ANET → SMCI');
    expect(text).toContain(RATIONALE);
    expect(text).not.toContain(NO_REASONING_RECORDED);
    expect(text).not.toContain(SEALED_NOTE);
  });

  it('an engine-authored motive renders without its guardrail CODE (renderMotive — hazard 29), verbatim otherwise', () => {
    const text = render(settled, RIVAL);
    expect(text).toContain('COIN → XLE');
    expect(text).toContain('stop-loss at 8% breached on COIN (-9.24%).');
    expect(text).not.toContain('guardrail_stopLoss');
  });

  it('a settled seat with nothing recorded shows "No reasoning recorded for this battle." — and nothing else in the film room', () => {
    const text = render(settled, VIEWER);
    expect(text).toContain('Film room · unlocked');
    expect(text).toContain(NO_REASONING_RECORDED);
    expect(text).not.toContain(STRATEGY);
    expect(text).not.toContain(RATIONALE);
  });

  it('a settled seat with NO battle on the reply (endpoint unavailable) shows the empty state, never a fixture line', () => {
    const text = render(pod(GROUP_STATUS.COMPLETE, {}), RIVAL);
    expect(text).toContain(NO_REASONING_RECORDED);
    for (const v of FIXTURE_VALUES) expect(text).not.toContain(v);
  });

  it('a live or upcoming seat is LOCKED: the sealed note, no words, no empty state — the viewer\'s own full-WHY active battle included', () => {
    const live = pod(GROUP_STATUS.BATTLE, { [VIEWER]: ownActive(VIEWER), [RIVAL]: concealed(RIVAL) });
    for (const id of [VIEWER, RIVAL]) {
      const text = render(live, id);
      expect(text).toContain('Film room · locked');
      expect(text).toContain(SEALED_NOTE);
      expect(text).not.toContain(NO_REASONING_RECORDED);
      expect(text).not.toContain(LIVE_STRATEGY);
      expect(text).not.toContain(LIVE_RATIONALE);
    }
    const upcoming = render(pod(GROUP_STATUS.FORMING, {}), RIVAL);
    expect(upcoming).toContain('Film room · locked');
    expect(upcoming).not.toContain(NO_REASONING_RECORDED);
  });

  it('a group settled while the owner\'s battle doc is still ACTIVE: the live WHY on the wire never renders — the empty state does', () => {
    const text = render(pod(GROUP_STATUS.COMPLETE, { [VIEWER]: ownActive(VIEWER) }), VIEWER);
    expect(text).toContain(NO_REASONING_RECORDED);
    expect(text).not.toContain(LIVE_STRATEGY);
    expect(text).not.toContain(LIVE_RATIONALE);
  });
});

describe('battleToReasoning — the adapter\'s rule (the ONLY real source of seat.reasoning)', () => {
  it('null without a battle, for an active battle (the owner\'s full WHY included), for a concealed one, and for a completed battle with nothing recorded', () => {
    expect(battleToReasoning(null)).toBeNull();
    expect(battleToReasoning(undefined)).toBeNull();
    expect(battleToReasoning(ownActive(VIEWER))).toBeNull();
    expect(battleToReasoning(concealed(RIVAL))).toBeNull();
    expect(battleToReasoning({ ...completedWithWords(RIVAL), _whyConcealed: true })).toBeNull();
    expect(battleToReasoning(completedSilent(VIEWER))).toBeNull();
    expect(battleToReasoning({ status: 'completed', agentContext: { innerMonologue: { strategy: '   ' } }, trades: [{ symbolOut: 'A', symbolIn: 'B', rationale: '  ' }, null, 'junk'] })).toBeNull();
  });

  it('a completed battle → the strategy read first, then one labelled line per recorded swap (rationale, else hypothesis), through renderMotive', () => {
    expect(battleToReasoning(completedWithWords(RIVAL))).toEqual([
      { key: 'strategy', label: null, text: STRATEGY },
      { key: 'trade-0', label: 'ANET → SMCI', text: RATIONALE },
      { key: 'trade-1', label: 'COIN → XLE', text: 'Guardrail override: stop-loss at 8% breached on COIN (-9.24%).' },
    ]);
    expect(battleToReasoning({
      status: 'completed', agentContext: {},
      trades: [{ symbolOut: 'X', symbolIn: 'Y', rationale: '', hypothesis: 'Should reclaim the 50-day by Friday.' }, { rationale: 'No symbols on this one.' }],
    })).toEqual([
      { key: 'trade-0', label: 'X → Y', text: 'Should reclaim the 50-day by Friday.' },
      { key: 'trade-1', label: null, text: 'No symbols on this one.' },
    ]);
  });

  it('buildSeat attaches it as seat.reasoning — and never anything for a live battle', () => {
    const done = buildSeat({ odUserId: RIVAL, isCpu: false, score: 1, battle: completedWithWords(RIVAL), names: NAMES, uid: VIEWER });
    expect(done.reasoning[0]).toEqual({ key: 'strategy', label: null, text: STRATEGY });
    const live = buildSeat({ odUserId: VIEWER, isCpu: false, score: 1, battle: ownActive(VIEWER), names: NAMES, uid: VIEWER });
    expect(live.reasoning).toBeNull();
    const none = buildSeat({ odUserId: RIVAL, isCpu: false, score: 1, battle: null, names: NAMES, uid: VIEWER });
    expect(none.reasoning).toBeNull();
  });
});

describe('POSITIVE CONTROL — the fixture world still renders its own sentence, so the absence rows are not vacuous', () => {
  it('a settled fixture pod (dev fixtures) shows the fixture line for the focused seat; a live fixture pod is locked', () => {
    const st = leagueState('open');
    const east = st.rounds.r1[0];
    expect(east.status).toBe('final');
    const text = render(east, 'atlas');
    expect(text).toContain(FIXTURE_REASONING.atlas);
    expect(text).not.toContain(NO_REASONING_RECORDED);
    const live = st.rounds.r2[0];
    expect(live.status).toBe('live');
    const liveText = render(live, live.seats[0].id);
    for (const v of FIXTURE_VALUES) expect(liveText).not.toContain(v);
    expect(liveText).toContain(SEALED_NOTE);
  });

  it('visibleText decodes what SSR escapes (an apostrophe and a quote survive the round trip)', () => {
    expect(visibleText(renderToString(<i>{"should've — \"cut\" <it> & go"}</i>))).toContain("should've — \"cut\" <it> & go");
  });
});
