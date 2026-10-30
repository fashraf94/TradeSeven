// src/components/League/battleArena/leagueCpuArchetype.test.js
//
// Agent form build S2, ruling R13: a League CPU wears its archetype only if that is the one it plays with. So this holds
// the seat the client draws to the agent document the server writes, one id at a time, and trips if the board stops being
// ranked by that document's archetype. A CPU's battle is passive (agent-evaluate.js P4 contract #5): the archetype picks
// the six it holds and never trades intraday. The S2 report says so.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCpuAgentDoc } from '../../../../api/_utils/tournamentCpu.js';
import { cpuAgentDocId, cpuNFromUserId, cpuUserId } from '../../../constants/leagueTournament';
import { buildArenaModel } from './buildArenaModel';

const seatOf = (n) => buildArenaModel({ group: { status: 'battle', players: [{ odUserId: cpuUserId(n), isCpu: true, picks: [] }] }, uid: 'me', mode: 'ranked' }).seats[0];

describe('a League CPU\'s seat is its agent document\'s archetype (R13)', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 12, 97])('cpu-%i', (n) => {
    expect(seatOf(n).archId).toBe(buildCpuAgentDoc(n, '2026-10-30T00:00:00.000Z').archetype);
    expect(cpuAgentDocId(cpuNFromUserId(cpuUserId(n)))).toBe(`cpu-agent-${n}`);
  });

  it('the archetype is what ranks the board the CPU\'s six are drafted from, not a label', () => {
    const boards = readFileSync('api/_utils/tournamentAgentBoards.js', 'utf8').replace(/\r\n/g, '\n');
    expect(boards).toContain("const archetype = agent?.archetype || 'analyst';");
    expect(boards).toContain("computeArchetypeRankings(stocks, archetype, { gameMode: 'tournament'");
    expect(boards).toContain("fallbackBoardResult(rankedStocks.map(s => s.symbol), 'cpu_agent')");
  });
});
