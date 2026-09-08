// @vitest-environment jsdom
//
// src/components/Tournament/Flat6BattleView.recordRendering.jsdom.test.jsx
//
// THE LEAGUE PANE RENDERS THE RECORD, NOT THE STORED BYTES (D-80 ruling 1,
// D-99, BUILD_RULES §9).
//
// What this file is for. `evaluations[].rationale` is not always the agent's
// sentence: on the guardrail path the cron composes its own, and the
// composition splices in a machinery-provenance code and doubles its own
// prefix — agent-evaluate.js:2124 writes
//
//   `Guardrail override (${sourceNote}): ${overrideNote}`
//
// where `sourceNote` is agentGuardrails.js:558's `guardrail_${forcedType}` and
// `overrideNote` is agentGuardrails.js:557's statusMessage, which ALREADY opens
// `Guardrail override: `. So on 100% of forced exits the stored bytes read
//
//   Guardrail override (guardrail_stopLoss): Guardrail override: stop-loss at
//   8% breached on GILD (-9.24%). Forcing exit → MOS.
//
// and until this change a League owner read that off the screen, code and
// stutter included, on all five of this pane's mount paths. The fix routes both
// fields through the renderer the Battle View and the narrator already share
// (`decisionRecord.js` — `renderMotive`, `renderHypothesis`, `HYPOTHESIS_LABEL`).
//
// WHY A ROW PER MOUNT PATH rather than one row on the component: the claim is
// about what a PLAYER sees, and a player only ever reaches this pane through a
// host. A host that passed a pre-rendered string, stubbed the pane, or grew its
// own copy of the record would leave the component row green and the screen
// wrong. Each row below mounts the real host with the real Flat6BattleView
// under it and reads the resulting DOM.
//
// The arena gate is mocked OFF for the whole file. Two hosts (League
// participant, training pod) reach the classic column that way in production
// too — `if (ARENA_LIVE_ON && myBattle && !classic)` falls through to it when a
// desktop player takes the back-to-classic affordance — and one (the card
// route, leagueBattleViewRender) has no other arm. It is the same mount
// expression either way; mocking the gate is how the rows reach it without
// driving each host's own `classic` state.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HYPOTHESIS_LABEL, renderMotive } from '../../data/decisionRecord';

// React 19 wants this declared before `act` will drive a root without warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── the module graph, cut at the data layer ─────────────────────────────────
// Everything mocked here is a network/firebase seam or a sibling surface. The
// pane itself, its enrichment, and the shared renderer are all REAL — mocking
// any of those would leave the rows unable to fail.
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: () => () => {},
}));
vi.mock('../../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../../contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'league-owner-1' } }),
}));
// The two group reads the hosts route on DELIVER, synchronously: without a
// group neither the ranked tab nor the practice pod reaches its battle body,
// and a row that never rendered the pane would pass on an empty screen.
vi.mock('../../services/tournamentGroupService', () => ({
  subscribeGroup: (_id, cb) => { cb(globalThis.__FLAT6_TEST_GROUP__); return () => {}; },
  subscribeMyGroup: (_uid, cb) => { cb(globalThis.__FLAT6_TEST_GROUP__); return () => {}; },
  subscribeMyMostRecentVoidedGroup: () => () => {},
  subscribeMyMostRecentCompletedGroup: () => () => {},
  subscribeBracket: () => () => {},
  subscribeRank: () => () => {},
  subscribeClaims: () => () => {},
  subscribeAgentBoards: () => () => {},
  subscribeAgentDraftStream: () => () => {},
  subscribeAgentLedger: () => () => {},
}));
vi.mock('../../services/liveDraftActions', () => ({ releaseSlot: () => {} }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: async () => ({ ok: true, json: async () => ({}) }) }));
vi.mock('../../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: async () => ({}),
    getMultipleCryptoPrices: async () => ({}),
  },
  POPULAR_CRYPTO: [],
}));

// Prices stay empty: the record card is price-independent, and an empty book
// keeps the golden below stable.
vi.mock('../../hooks/useWebSocketPrices', () => ({
  useWebSocketPrices: () => ({ prices: {}, status: 'disconnected' }),
}));
// The battle each host resolves. Held on globalThis so the factories — hoisted
// above every declaration in this file — can read it without a TDZ trap.
vi.mock('../../hooks/useMyTournamentBattle', () => ({
  default: () => ({ battle: globalThis.__FLAT6_TEST_BATTLE__, chain: null, loading: false }),
}));
vi.mock('../../hooks/useSpectatedTournamentBattles', () => ({
  default: () => ({ battles: { 'league-owner-1': globalThis.__FLAT6_TEST_BATTLE__ }, loading: false }),
}));
vi.mock('../../hooks/usePreOpenPhase', () => ({ default: () => false }));
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => ({ isMobile: true, isDesktop: false, isTablet: false }),
}));

// The arena — this file's subject is the CLASSIC column (see the header).
vi.mock('../League/battleArena/arenaLiveGate', () => ({ ARENA_LIVE_ON: false }));
vi.mock('../League/battleArena/LeagueBattleArenaLive', () => ({ default: () => null }));

// Sibling surfaces on the hosts. None of them renders a decision record; each
// pulls firebase or a chart library that has no bearing on this claim.
vi.mock('./DraftPlaybackTheater', () => ({ default: () => null }));
vi.mock('./ClaimFlipWindow', () => ({ default: () => null }));
vi.mock('./GroupFeed', () => ({ default: () => null }));
vi.mock('./BoardCommitFlow', () => ({ default: () => null }));
vi.mock('./RoundBoundaryView', () => ({ default: () => null }));
vi.mock('./LeagueLobby', () => ({ default: () => null }));
vi.mock('./BoardEditor', () => ({ default: () => null }));
vi.mock('./LeaderboardCard', () => ({ default: () => null }));
vi.mock('./RankCard', () => ({ default: () => null }));
vi.mock('./awaitingOpen/AwaitingOpenPodView', () => ({ default: () => null }));
vi.mock('../League/draft/DraftBoardRoom', () => ({ default: () => null }));
vi.mock('../League/liveDraft/LiveDraftPicker', () => ({ default: () => null }));
vi.mock('../League/liveDraft/LiveDraftGlimpse', () => ({ default: () => null }));
vi.mock('../League/liveDraft/LiveDraftAwaiting', () => ({ default: () => null }));
vi.mock('../League/LeagueVoidedNotice', () => ({ default: () => null }));
vi.mock('../League/LeagueRecapEntry', () => ({ default: () => null }));

import SpectatorView from './SpectatorView';
import LeagueBattleViewRender from '../../screens/leagueBattleViewRender';
import LeagueTrainingBattleView from '../../screens/LeagueTrainingBattleView';
import LeagueParticipantView from '../../screens/LeagueParticipantView';
import TournamentDevScreen from '../../screens/TournamentDevScreen';

const UID = 'league-owner-1';

// ── the cron's real bytes ───────────────────────────────────────────────────
// Composed exactly as agent-evaluate.js:2124 composes them from
// agentGuardrails.js:557-558. Not a paraphrase: the doubled prefix and the code
// are both properties of that composition, and a fixture that smoothed either
// one would make the rows unfalsifiable.
const GUARDRAIL_STATUS = 'Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.';
const GUARDRAIL_RATIONALE = `Guardrail override (guardrail_stopLoss): ${GUARDRAIL_STATUS}`;
// The cron writes its own hypothesis beside its own rationale on this path.
const GUARDRAIL_HYPOTHESIS = `Hypothesis: deterministic guardrail enforcement — ${GUARDRAIL_STATUS}`;
// The unruled token (agentGuardrails.js:570) — no ruled words, so D-80 ruling 1
// drops the parenthetical whole rather than inventing a translation.
const SECTOR_RATIONALE = 'Guardrail override (guardrail_max_sector_weight): Sector cap reached on energy.';

// The model's OWN sentence. Deliberately carries every character class the
// translator touches on the engine path — a colon, a parenthetical, an arrow,
// bold markers — so "unchanged" is a claim with teeth.
const AGENT_RATIONALE = 'Rotating into semis (momentum): NVDA cleared its 20-day on volume → adding, GILD is exhausted. **Conviction 72.**';
const AGENT_HYPOTHESIS = 'Hypothesis: AVGO closes above its 20-day within two sessions and holds the support slot.';

const battleWith = (evaluations, extra = {}) => ({
  id: 'flat6-battle-1',
  status: 'active',
  gameMode: 'flat6_tournament',
  agentContext: { agentName: 'Aurora', archetype: 'momentum', innerMonologue: null },
  scoreState: { currentScore: 11 },
  portfolio: {
    star: [{ symbol: 'NVDA' }, { symbol: 'AVGO' }],
    core: [{ symbol: 'MOS' }, { symbol: 'GILD' }],
    support: [{ symbol: 'CF' }, { symbol: 'NOW' }],
    startingPrices: { NVDA: 900, AVGO: 180, MOS: 30, GILD: 90, CF: 80, NOW: 950 },
  },
  evaluations,
  statusFeed: [],
  trades: [],
  ...extra,
});

const GUARDRAIL_BATTLE = battleWith([
  { evalId: 'e1', rationale: SECTOR_RATIONALE, hypothesis: null },
  { evalId: 'e2', rationale: GUARDRAIL_RATIONALE, hypothesis: GUARDRAIL_HYPOTHESIS },
]);

const AGENT_BATTLE = battleWith([
  { evalId: 'e9', rationale: AGENT_RATIONALE, hypothesis: AGENT_HYPOTHESIS },
]);

const GROUP = {
  id: 'grp-1',
  status: 'battle',
  players: [{ odUserId: UID, isCpu: false, picks: [] }],
  groupMembers: [UID],
  feed: [],
};

// ── harness ─────────────────────────────────────────────────────────────────
let container = null;
let root = null;

function mount(element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(element); });
  return container;
}

/** Click the first button whose text matches — the spectator's battle-view CTA. */
function clickButton(re) {
  const button = [...container.querySelectorAll('button')].find((b) => re.test(b.textContent || ''));
  expect(button, `no button matching ${re}`).toBeTruthy();
  act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

/** The record card's own text — the innermost node that owns the section title. */
function recordCardText() {
  const nodes = [...container.querySelectorAll('div')]
    .filter((d) => (d.textContent || '').includes("The agent's read"));
  expect(nodes.length, "the record card did not render").toBeGreaterThan(0);
  return nodes[nodes.length - 1].parentElement.textContent;
}

beforeEach(() => {
  globalThis.__FLAT6_TEST_BATTLE__ = GUARDRAIL_BATTLE;
  globalThis.__FLAT6_TEST_GROUP__ = GROUP;
});
afterEach(() => {
  if (root) act(() => { root.unmount(); });
  if (container) container.remove();
  root = null;
  container = null;
  delete globalThis.__FLAT6_TEST_BATTLE__;
  delete globalThis.__FLAT6_TEST_GROUP__;
});

// Every mount path, and the element each host actually constructs.
const MOUNT_PATHS = [
  {
    name: 'SpectatorView — the Film Room / spectate card',
    render: () => {
      mount(<SpectatorView group={GROUP} uid={UID} onBack={() => {}} />);
      // The pane is behind the CTA; the owner selection lands in the effect the
      // click schedules, so the second render is the one that carries a battle.
      clickButton(/Open battle view/);
    },
  },
  {
    name: 'leagueBattleViewRender — the card route, arena gate off',
    render: () => mount(
      <LeagueBattleViewRender
        group={GROUP}
        battle={GUARDRAIL_BATTLE}
        mode="ranked"
        uid={UID}
        compositeContext={{ composite: 12, userPoints: 4 }}
        isDesktop={false}
      />,
    ),
  },
  {
    name: 'LeagueTrainingBattleView — the practice pod',
    render: () => mount(<LeagueTrainingBattleView podId={GROUP.id} user={{ uid: UID }} />),
  },
  {
    name: 'LeagueParticipantView — the ranked League tab',
    render: () => mount(<LeagueParticipantView uid={UID} />),
  },
  {
    name: 'TournamentDevScreen — the dev screen',
    render: () => mount(<TournamentDevScreen />),
  },
];

describe("the guardrail's machinery never reaches a League screen", () => {
  for (const path of MOUNT_PATHS) {
    it(`${path.name}`, () => {
      path.render();
      const text = recordCardText();

      // THE CLAIM. Neither persisted code, in either of its two shapes — the
      // ruled one that becomes plain words, and the unruled one that loses its
      // parenthetical entirely.
      expect(text).not.toContain('guardrail_');
      expect(text).not.toContain('guardrail_stopLoss');
      expect(text).not.toContain('guardrail_max_sector_weight');

      // …and not the cron's doubled prefix, which spent the card on a preamble.
      expect(text).not.toContain('Guardrail override (');
      expect(text).not.toContain('Guardrail override: Guardrail override:');

      // The row cannot pass by rendering nothing: the guardrail's own sentence
      // is on the screen, verbatim after the prefix, and so is the sector one
      // with its parenthetical dropped.
      expect(text).toContain(GUARDRAIL_STATUS);
      expect(text).toContain('Guardrail override: Sector cap reached on energy.');

      // D-99: the cron's hypothesis is the system's sentence beside the
      // system's rationale, so the check made no forecast to show.
      expect(text).not.toContain('deterministic guardrail enforcement');
      expect(text).not.toContain(HYPOTHESIS_LABEL);
    });
  }
});

describe("the agent's own words are the stored bytes — a golden", () => {
  beforeEach(() => { globalThis.__FLAT6_TEST_BATTLE__ = AGENT_BATTLE; });

  it('the record card is a photograph of the model\'s sentence, byte for byte', () => {
    mount(
      <LeagueBattleViewRender
        group={GROUP}
        battle={AGENT_BATTLE}
        mode="ranked"
        uid={UID}
        compositeContext={null}
        isDesktop={false}
      />,
    );

    // Frozen. The rationale appears here exactly as the model wrote it — every
    // marker, the arrow, the parenthetical and the colon — because verbatim is
    // an AGENT-authored property (C1) and only an engine sentence is rewritten.
    // The hypothesis carries D-99's label and drops its own `Hypothesis:` head,
    // which the label already says.
    // The card opens with the TrendingUp icon, so its text starts with the
    // separating space — photographed, not trimmed away.
    expect(recordCardText()).toBe(
      " The agent's read"
      + 'Rotating into semis (momentum): NVDA cleared its 20-day on volume → adding, GILD is exhausted. **Conviction 72.**'
      + 'Hypothesis recorded at this check (graded after the battle)'
      + ': '
      + 'AVGO closes above its 20-day within two sessions and holds the support slot.',
    );
  });

  it('the renderer itself returns the rationale unchanged', () => {
    // The property the golden photographs, asserted where it lives: an
    // agent-authored sentence is not a fixed point by luck, it is untouched.
    expect(renderMotive(AGENT_RATIONALE)).toBe(AGENT_RATIONALE);
  });
});

describe('D-99 — the hypothesis renders once, or not at all', () => {
  it('suppresses the inline duplicate the §3.2a normalizer catches', () => {
    // The known pair: the field, and the same prediction bolded at the tail of
    // the rationale. Rendered raw, the player read it twice.
    const duplicated = `Holding the book. **${AGENT_HYPOTHESIS}**`;
    globalThis.__FLAT6_TEST_BATTLE__ = battleWith([
      { evalId: 'e5', rationale: duplicated, hypothesis: AGENT_HYPOTHESIS },
    ]);
    mount(
      <LeagueBattleViewRender group={GROUP} battle={globalThis.__FLAT6_TEST_BATTLE__} mode="ranked" uid={UID} compositeContext={null} isDesktop={false} />,
    );
    const text = recordCardText();
    expect(text).toContain(duplicated);
    expect(text).not.toContain(HYPOTHESIS_LABEL);
  });

  it('renders a check that carries only a hypothesis under the label', () => {
    globalThis.__FLAT6_TEST_BATTLE__ = battleWith([
      { evalId: 'e6', rationale: null, hypothesis: AGENT_HYPOTHESIS },
    ]);
    mount(
      <LeagueBattleViewRender group={GROUP} battle={globalThis.__FLAT6_TEST_BATTLE__} mode="ranked" uid={UID} compositeContext={null} isDesktop={false} />,
    );
    expect(recordCardText()).toContain(
      `${HYPOTHESIS_LABEL}: AVGO closes above its 20-day within two sessions and holds the support slot.`,
    );
  });

  it('an entry whose bytes all render to nothing leaves no empty row', () => {
    // A whitespace rationale and a hypothesis the rationale already made: the
    // old code filtered on the raw fields and would have drawn a bordered row
    // with nothing in it.
    globalThis.__FLAT6_TEST_BATTLE__ = battleWith([
      { evalId: 'e7', rationale: '   ', hypothesis: null },
    ]);
    mount(
      <LeagueBattleViewRender group={GROUP} battle={globalThis.__FLAT6_TEST_BATTLE__} mode="ranked" uid={UID} compositeContext={null} isDesktop={false} />,
    );
    expect(recordCardText()).toBe(" The agent's read" + 'No reasoning recorded yet.');
  });
});
