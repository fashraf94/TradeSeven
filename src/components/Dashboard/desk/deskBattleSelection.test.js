// src/components/Dashboard/desk/deskBattleSelection.test.js
//
// F-1 acceptance (PASS1_MERGE_RULING_AND_PREFLIP_LIST.md §2).
//
// THE DEFECT. Framework §3.1 scopes the Command Center to BaggerBomb: a ranked
// battle never drives the Desk in Pass 1. But the shells picked the Desk's
// battle by INDEX — `orderedLiveBattles[0]` — and `sortLiveBattles` orders
// ranked FIRST (BATTLE_TYPE_ORDER, commandCenterLiveBattles.js). So with a
// ranked battle and a casual clone live together, which is possible today under
// CASUAL_CLONE_CONCURRENCY_ENABLED, the Desk described the ranked battle: the
// wrong game, on a surface that owns a different one.
//
// The two cases the ruling names are the two describe blocks below.
//
// A note on WHY the selector is built on classifyBattleType rather than on the
// battle's `gameMode`: the Manage card labels itself from classifyBattleType
// (ManageStation.jsx). A second discriminator would let the Desk's eyebrow and
// the card beneath it disagree about which game is on screen — the
// display-agreement failure BUILD_RULES §9 exists to prevent. The two agree by
// construction anyway (agentBattleService stamps groupId only when
// isTournament, under the B3 joint-stamp contract), but "agree today" is not
// the same guarantee as "cannot disagree".

import { describe, it, expect } from 'vitest';
import {
  findLiveBaggerBomb,
  hasLiveBaggerBomb,
  sortLiveBattles,
  battleTypeLabel,
} from '../../../utils/commandCenterLiveBattles';
import { buildBaggerbombAdapter } from '../../../adapters/baggerbombAdapter';

const RANKED = {
  id: 'battle-ranked',
  status: 'active',
  groupId: 'grp-1',                       // the discriminator: tournament battles carry it
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: 'Aurora' },
  scoreState: { currentScore: 10, evaluationCount: 4, lastScoredAt: '2026-09-01T16:45:00.000Z' },
};

const BAGGERBOMB = {
  id: 'battle-casual',
  status: 'active',
  // no groupId — a casual deploy
  activatedAt: '2026-09-01T14:00:00.000Z',
  agentContext: { agentName: 'Aurora' },
  scoreState: { currentScore: 42, evaluationCount: 7, lastScoredAt: '2026-09-01T16:47:00.000Z' },
};

const MS_OPEN = {
  isOpen: true,
  state: 'OPEN',
  nextOpenTime: new Date(2026, 8, 2, 9, 30),
  nextCloseTime: new Date(2026, 8, 1, 16, 0),
  isEarlyClose: false,
};

/** Exactly what both shells now do to choose the Desk's battle. */
const selectDeskBattle = (liveBattles) =>
  (hasLiveBaggerBomb(liveBattles) ? findLiveBaggerBomb(liveBattles) : null);

describe('ranked ordered first → the Desk still describes BaggerBomb', () => {
  const live = [RANKED, BAGGERBOMB];

  it('sortLiveBattles really does put ranked first — the premise of the defect', () => {
    // If this ever stops being true the defect changes shape, so it is asserted
    // rather than assumed.
    expect(sortLiveBattles(live)[0].id).toBe('battle-ranked');
  });

  it('the Desk selects the BaggerBomb battle regardless of that order', () => {
    expect(selectDeskBattle(live).id).toBe('battle-casual');
  });

  it('...and in the reverse input order too — selection is by type, not position', () => {
    expect(selectDeskBattle([BAGGERBOMB, RANKED]).id).toBe('battle-casual');
  });

  it('the adapter it builds reports BaggerBomb, matching the Manage card label', () => {
    const sync = buildBaggerbombAdapter(
      selectDeskBattle(live), null, null, '2026-09-01T17:00:00Z', MS_OPEN,
    );
    expect(sync.game.type).toBe('baggerbomb');
    expect(sync.game.label).toBe('BaggerBomb');
    expect(sync.game.label).toBe(battleTypeLabel(BAGGERBOMB));
    expect(sync.game.id).toBe('battle-casual');
  });
});

describe('ranked only → no Desk', () => {
  it('the gate is closed when no BaggerBomb battle is live', () => {
    expect(hasLiveBaggerBomb([RANKED])).toBe(false);
    expect(selectDeskBattle([RANKED])).toBeNull();
  });

  it('a null battle yields a null adapter, which is what "no Desk" means', () => {
    const sync = buildBaggerbombAdapter(
      selectDeskBattle([RANKED]), null, null, '2026-09-01T17:00:00Z', MS_OPEN,
    );
    expect(sync).toBeNull();
  });

  it('no live battles at all → also no Desk', () => {
    expect(selectDeskBattle([])).toBeNull();
    expect(selectDeskBattle(null)).toBeNull();
  });
});

describe('the selector is defensive about liveness', () => {
  it('a COMPLETED casual battle does not open the Desk', () => {
    // "live" is in the name. A stale completed battle must never latch a
    // surface on if an upstream status filter ever regresses.
    expect(selectDeskBattle([{ ...BAGGERBOMB, status: 'completed' }])).toBeNull();
  });

  it('a battle with no status at all is not treated as live', () => {
    const { status, ...noStatus } = BAGGERBOMB;
    expect(selectDeskBattle([noStatus])).toBeNull();
  });

  it('two casual battles resolve deterministically, not by arrival order', () => {
    // Not reachable today (decide.js caps one active battle per agentId), but
    // an unordered pick would be a latent flake.
    const second = { ...BAGGERBOMB, id: 'battle-casual-2', activatedAt: '2026-09-01T15:00:00.000Z' };
    const a = selectDeskBattle([BAGGERBOMB, second]).id;
    const b = selectDeskBattle([second, BAGGERBOMB]).id;
    expect(a).toBe(b);
  });
});
