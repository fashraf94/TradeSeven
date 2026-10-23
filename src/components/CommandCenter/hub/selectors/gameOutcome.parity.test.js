// @vitest-environment node
//
// src/components/CommandCenter/hub/selectors/gameOutcome.parity.test.js
//
// Command Center hub, slice S3 (ruling R-S3-7; spec V1.2 §7) — the client
// outcome selector against the server's completion resolver,
// resolveCompletionDisposition (api/cron/agent-evaluate.js, not fenced; its
// own suite api/_utils/p4Flips.test.js imports it in Node the same way, with
// no mock and no side effect). This file is a Node test: the cron never enters
// the browser bundle (nothing under src/ imports it; the hub chunk's import
// graph is pinned in commandCenterHub.mount.guard.test.js).
//
// Parity holds ONLY for non-tournament completed records with the
// battle_complete evidence, genuine scoring evidence and two finite stored
// operands — every row below is one. The one intentional disagreement is
// pinned as such: a never-scored completion the server calls a draw is
// "No result" here (F4).

import { describe, expect, it } from 'vitest';
import { resolveCompletionDisposition } from '../../../../../api/cron/agent-evaluate.js';
import { OUTCOME_KINDS as K, deriveGameOutcome } from './gameOutcome';
import { outcomeInputOf } from '../gamesDisplay';

const SERVER = { win: K.WON, loss: K.LOST, draw: K.DRAW };

/** A completed BaggerBomb record with the evidence both sides need. */
const completed = (currentScore, opponentScore) => ({
  id: `b_${currentScore}_${opponentScore}`,
  ownerId: 'uid-A',
  status: 'completed',
  gameMode: 'baggerbomb_agent',
  scoreState: { currentScore, opponentScore, lastScoredAt: '2026-10-20T19:58:00.000Z', evaluationCount: 41 },
  statusFeed: [{ timestamp: '2026-10-20T20:05:00.000Z', message: 'Battle complete.', action: 'battle_complete', source: 'system' }],
});

const PAIRS = [
  [12.5, 3.25], [3.25, 12.5], [-8, -8], [0, 0], [0, -0.01], [-0.01, 0], [40.1, 52], [-3.5, -12],
  [10.04, 10.03], [10.03, 10.04], [304, 120.5], [-101, 4], [0.01, 0.01], [1e-6, 0], [-1e3, -1e3 + 0.01],
];

describe('parity with resolveCompletionDisposition — valid evidence only', () => {
  it.each(PAIRS)('current %s vs opponent %s: the same verdict on both sides', (mine, theirs) => {
    const battle = completed(mine, theirs);
    const server = resolveCompletionDisposition(battle);
    const client = deriveGameOutcome(outcomeInputOf(battle));
    expect(server.result).not.toBeNull();
    expect(client.kind).toBe(SERVER[server.result]);
    expect([client.mine, client.theirs]).toEqual([mine, theirs]);
  });

  it('every row really is a valid-evidence row: the client finds final evidence, scoring and a finite pair', () => {
    for (const [mine, theirs] of PAIRS) {
      const input = outcomeInputOf(completed(mine, theirs));
      expect(input.finalEvidence).toBe(true);
      expect(input.scoreState.lastScoredAt).toBeTruthy();
      expect([mine, theirs].every(Number.isFinite)).toBe(true);
    }
  });
});

describe('the pinned disagreement (spec §7, F4)', () => {
  it('a never-scored completion: the server records a draw, the hub says No result', () => {
    const battle = {
      id: 'b_never',
      ownerId: 'uid-A',
      status: 'completed',
      gameMode: 'baggerbomb_agent',
      scoreState: { currentScore: 0, evaluationCount: 0, lastScoredAt: null },
      statusFeed: [{ action: 'battle_complete', source: 'system', message: 'Battle complete.' }],
    };
    expect(resolveCompletionDisposition(battle).result).toBe('draw');
    expect(deriveGameOutcome(outcomeInputOf(battle)).kind).toBe(K.NO_SCORE);
  });
});

describe('the evidence the server does not compare is not a parity row', () => {
  it('tournament: the server gives no W/L; neither does the hub', () => {
    const battle = { ...completed(7.5, 99), gameMode: 'baggerbomb_tournament', completionContext: 'tournament_group_scored' };
    expect(resolveCompletionDisposition(battle).result).toBeNull();
    expect(deriveGameOutcome(outcomeInputOf(battle)).kind).toBe(K.BANKED);
  });
});
