// api/_utils/archetypeScoringV2.callers.test.js
//
// Archetype Rank Interface V2 — spec §5 test 10: all nine production caller
// paths of the scoring engine (the V-5 census + path 7b, spec §4) carry a
// pinned expected game mode. Source-text contract, like the ratchet: a caller
// that loses its mode, a new caller without one, or a 'mandate' mode anywhere
// fails here. decide.js:343 is pinned in its FENCED, pre-flip form (no mode —
// the flip PR adds { gameMode: 'baggerBomb' }, V-16).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

// caller → the exact call-site text that pins its mode (spec §4 census).
const CENSUS = [
  { id: 1, file: 'api/agent/decide.js', mode: 'baggerBomb (flip PR — fenced, untouched)', pattern: /computeArchetypeRankings\(stockUniverse, archetype\);/, fenced: true },
  { id: 2, file: 'api/cron/compute-index-intelligence.js', mode: 'standard', pattern: /computeArchetypeRankings\(rankingStocks, archetype, \{ gameMode: 'standard' \}\)/ },
  { id: '2 (arch_scores_v2)', file: 'api/cron/compute-index-intelligence.js', mode: 'standard', pattern: /computeArchetypeRankingsV2\(rankingStocks, archetype, \{\s*gameMode: 'standard',/ },
  { id: 3, file: 'api/agent/scouting-board.js', mode: 'scouting', pattern: /computeArchetypeRankings\(stocks, archetype, \{ gameMode: 'scouting', minCandidates: BOARD_SIZE \}\)/ },
  { id: 4, file: 'api/_utils/tournamentAgentBoards.js', mode: 'tournament', pattern: /computeArchetypeRankings\(stocks, archetype, \{ gameMode: 'tournament', minCandidates: TOURNAMENT_TUNING\.BOARD_DEPTH_MIN \}\)/ },
  { id: 5, file: 'api/_utils/tournamentAgentDraft.js', mode: 'tournament', pattern: /computeArchetypeRankings\(stocks, archetype, \{ gameMode: 'tournament', minCandidates: AGENT_MARKET_SIZE \+ USER_HELD_NAMES_PER_GROUP \}\)/ },
  { id: 6, file: 'api/_utils/tournamentBoardAutoCommit.js', mode: 'tournament', pattern: /computeArchetypeRankings\(universe, archetype, \{ gameMode: 'tournament', minCandidates: TOURNAMENT_TUNING\.BOARD_DEPTH_MIN \}\)/ },
  { id: 7, file: 'api/_utils/trainingLifecycle.js', mode: 'training', pattern: /gameMode: 'training', universeSize, universeMedianReturn1W,/ },
  { id: '7 (core)', file: 'api/_utils/trainingLifecycle.js', mode: 'threaded', pattern: /computeArchetypeRankings\(available, archetype, \{ gameMode, universeSize, universeMedianReturn1W, minCandidates: 1 \}\)/ },
  { id: '7b (drive)', file: 'api/_utils/liveDraftLifecycle.js', mode: 'tournament', pattern: /gameMode: 'tournament', universeSize: universeCtx\.universeSize, universeMedianReturn1W: universeCtx\.universeMedianReturn1W,/ },
  { id: '7b (pick)', file: 'api/_utils/liveDraftLifecycle.js', mode: 'tournament', pattern: /gameMode: 'tournament', universeSize, universeMedianReturn1W,/ },
  { id: 8, file: 'src/hooks/useTrainingDraft.js', mode: 'training', pattern: /computeArchetypeRankings\(available, archetype, \{\s*gameMode: 'training',\s*universeSize: universeContext\?\.universeSize,\s*universeMedianReturn1W: universeContext\?\.universeMedianReturn1W,\s*minCandidates: OVERLAY_SIZE,\s*onEvent: silentScorerSink,\s*\}\)/ },
];

function walk(dir, out = []) {
  for (const e of readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel, out); continue; }
    if (/\.(js|jsx)$/.test(e.name) && !/\.test\.(js|jsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}

describe('every production caller carries a pinned game mode (test 10 — the V-5 census incl. 7b)', () => {
  for (const c of CENSUS) {
    it(`#${c.id} ${c.file} → ${c.mode}`, () => {
      expect(read(c.file)).toMatch(c.pattern);
    });
  }

  it('the direct-call census is complete: exactly the eight files that call the engine, and every non-fenced call passes gameMode', () => {
    const callers = {};
    for (const rel of [...walk('api'), ...walk('src')]) {
      if (rel === 'api/_utils/archetypeScoring.js' || rel === 'api/_utils/archetypeScoringV2.js') continue;
      const src = read(rel);
      const calls = [...src.matchAll(/computeArchetypeRankings\((?!V2)[^;]*?\)/gs)].map((m) => m[0]);
      if (calls.length) callers[rel] = calls;
    }
    expect(Object.keys(callers).sort()).toEqual([
      'api/_utils/tournamentAgentBoards.js',
      'api/_utils/tournamentAgentDraft.js',
      'api/_utils/tournamentBoardAutoCommit.js',
      'api/_utils/trainingLifecycle.js',
      'api/agent/decide.js',
      'api/agent/scouting-board.js',
      'api/cron/compute-index-intelligence.js',
      'src/hooks/useTrainingDraft.js',
    ]);
    for (const [rel, calls] of Object.entries(callers)) {
      for (const call of calls) {
        if (rel === 'api/agent/decide.js') expect(call).toBe('computeArchetypeRankings(stockUniverse, archetype)'); // fenced; flip PR
        else expect(call, `${rel}: ${call}`).toMatch(/gameMode/);
      }
    }
  });

  it("no caller anywhere passes the removed 'mandate' mode (P-5)", () => {
    for (const rel of [...walk('api'), ...walk('src')]) {
      expect(read(rel)).not.toMatch(/gameMode:\s*['"]mandate['"]/);
    }
  });

  it('the shared draft core threads the mode from each entry (P-4): training pods → training, live draft → tournament, client overlay → training', () => {
    const training = read('api/_utils/trainingLifecycle.js');
    expect(training).toMatch(/export function chooseHumanPick\(\{ symbol, autopick, pool, taken, universe, archetype, gameMode, universeSize, universeMedianReturn1W \}\)/);
    expect(training.match(/gameMode: 'training'/g)).toHaveLength(1);
    expect(training).not.toMatch(/gameMode: 'tournament'/);
    const live = read('api/_utils/liveDraftLifecycle.js');
    expect(live.match(/gameMode: 'tournament'/g)).toHaveLength(2);
    expect(live).not.toMatch(/gameMode: 'training'/);
    expect(live).toMatch(/readStockUniverseContext/);
    expect(read('src/hooks/useTrainingDraft.js').match(/gameMode: 'training'/g)).toHaveLength(1);
  });
});
