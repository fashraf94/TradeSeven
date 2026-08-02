// api/agent/decide.baselineGate.behavior.test.js
//
// Founder-authorized narrow deploy gate — BEHAVIORAL execution (PR #702 review
// gap). decide.baselineGate.test.js locks the wiring by static source guards;
// this suite EXECUTES the real deploy-gate orchestration and asserts actual
// mocked calls and writes.
//
// SEAM: runPrescribedTournamentDeploy — the smallest exported production deploy
// unit that contains the full runtime wiring around the gate (upstream
// lastDeployedAt stamp, deploy-lock clear, fetchValidatedStartingPrices,
// assessRequiredBaselines, the early abort, cooldown rollback, lock release, the
// createAgentBattle call boundary, and the 503 pricing_unavailable response) —
// and, unlike the tiered handler, it runs with NO Anthropic strategy/portfolio
// pipeline, so the gate is exercised without mocking model machinery. The tiered
// handler's gate block is byte-identical (verified by the static guards in
// decide.baselineGate.test.js and the shared assessRequiredBaselines unit),
// giving it the same runtime guarantees (case 8).
//
// Only side-effecting collaborators are mocked: market-data fetch, the (fenced)
// createAgentBattle (spied — never modified), and the compiled-build gate. The
// prescribed validate/enrich, threshold build, and the gate itself run for real.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  createAgentBattle: vi.fn(),
  ensureDeployableCompiledBuild: vi.fn(),
}));

vi.mock('../_utils/marketDataCache.js', () => ({ getStockAnalysisData: mocks.getStockAnalysisData }));
vi.mock('../_utils/agentBattleService.js', () => ({ createAgentBattle: mocks.createAgentBattle }));
vi.mock('../_utils/deployBuildValidation.js', () => ({ ensureDeployableCompiledBuild: mocks.ensureDeployableCompiledBuild }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { runPrescribedTournamentDeploy } = await import('./decide.js');

const SIX = ['AAPL', 'NVDA', 'MSFT', 'GOOG', 'AMZN', 'META'];
const UNIVERSE = SIX.map((s) => ({ symbol: s, name: s, atrPercentile: 0.5 }));
const VALID_ALL = Object.fromEntries(SIX.map((s) => [s, 'valid']));

// getStockAnalysisData stub: symbol -> 'valid' | 'fallback' | a raw price object
// | undefined (omitted). Unusable raw objects carry NO previousClose/daily so
// Guard-1 has nothing to substitute and omits them (→ missing at the gate).
function priceMap(map) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => {
    const v = map[symbol];
    if (v === undefined) return {}; // no price → omitted
    if (v === 'valid') return { price: { current: 150, high: 152, low: 148, previousClose: 149 }, daily: [{ close: 149 }] };
    if (v === 'fallback') return { price: { current: 149, fallback: true }, daily: [{ close: 149 }] };
    return { price: v, daily: [] };
  });
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function makeDb({ existingEmpty = true } = {}) {
  const col = (name) => {
    const q = {
      doc: (id) => ({
        get: async () => (name === 'indexIntelligence' && id === 'stockRankings')
          ? { exists: true, data: () => ({ stocks: UNIVERSE }) }
          : { exists: false, data: () => ({}) },
        update: async () => {},
      }),
      where: () => q,
      limit: () => q,
      get: async () => ({ empty: existingEmpty, docs: [] }),
    };
    return q;
  };
  return { collection: col };
}

function makeCtx({ lastDeployedAt = null, existingEmpty = true } = {}) {
  const agentRef = { update: vi.fn(async () => {}) };
  const res = makeRes();
  const agent = { id: 'agent-1', ownerId: 'u1', lastDeployedAt };
  const req = { body: { groupId: 'g1', prescribedPortfolio: [...SIX], isCpu: true, userPicksStance: [], doubleDownSymbols: [], userPicks: [] } };
  return { db: makeDb({ existingEmpty }), req, res, agentRef, agent, agentId: 'agent-1' };
}

// The abort write is exactly { deployingAt: null, lastDeployedAt: <prior> } (2 keys).
function findAbortWrite(agentRef) {
  return agentRef.update.mock.calls
    .map((c) => c[0])
    .find((u) => u && u.deployingAt === null && 'lastDeployedAt' in u && Object.keys(u).length === 2);
}
function findDecisionWrite(agentRef) {
  return agentRef.update.mock.calls.map((c) => c[0]).find((u) => u && 'lastDecision' in u);
}

beforeEach(() => {
  mocks.getStockAnalysisData.mockReset();
  mocks.createAgentBattle.mockReset();
  mocks.createAgentBattle.mockResolvedValue({ id: 'battle-1', expiresAt: '2026-08-03T00:00:00.000Z' });
  mocks.ensureDeployableCompiledBuild.mockReset();
  mocks.ensureDeployableCompiledBuild.mockResolvedValue({ proceed: true, compiledBuild: null });
});

describe('deploy gate behavior — 1. complete valid baselines', () => {
  it('creates exactly one battle with the exact startingPrices payload and no rollback', async () => {
    priceMap(VALID_ALL);
    const ctx = makeCtx({ lastDeployedAt: '2026-08-01T00:00:00.000Z' });
    await runPrescribedTournamentDeploy(ctx);

    expect(mocks.createAgentBattle).toHaveBeenCalledTimes(1);
    const [, , , startingPrices] = mocks.createAgentBattle.mock.calls[0];
    expect(startingPrices).toEqual({ AAPL: 150, NVDA: 150, MSFT: 150, GOOG: 150, AMZN: 150, META: 150 });
    expect(ctx.res.statusCode).toBe(200);
    expect(ctx.res.body.battleCreated).toBe(true);
    expect(ctx.res.body.agentBattleId).toBe('battle-1');
    // No abort/rollback write occurred on the success path.
    expect(findAbortWrite(ctx.agentRef)).toBeUndefined();
  });
});

describe('deploy gate behavior — 2. empty validated price result', () => {
  it('creates no battle, releases the lock, restores the cooldown, returns 503 retriable', async () => {
    priceMap({}); // every required symbol omitted
    const ctx = makeCtx({ lastDeployedAt: '2026-08-01T00:00:00.000Z' });
    await runPrescribedTournamentDeploy(ctx);

    expect(mocks.createAgentBattle).not.toHaveBeenCalled();
    const abort = findAbortWrite(ctx.agentRef);
    expect(abort).toBeTruthy();
    expect(abort.deployingAt).toBeNull();               // lock released
    expect(abort.lastDeployedAt).toBe('2026-08-01T00:00:00.000Z'); // cooldown restored exactly
    expect(ctx.res.statusCode).toBe(503);
    expect(ctx.res.body.reason).toBe('pricing_unavailable');
    expect(ctx.res.body.retriable).toBe(true);
  });
});

describe('deploy gate behavior — 3. one required symbol missing', () => {
  it('aborts the whole deploy, names the missing symbol, creates no partial battle', async () => {
    priceMap({ AAPL: 'valid', NVDA: 'valid', MSFT: 'valid', GOOG: 'valid', AMZN: 'valid' }); // META missing
    const ctx = makeCtx({ lastDeployedAt: '2026-08-01T00:00:00.000Z' });
    await runPrescribedTournamentDeploy(ctx);

    expect(mocks.createAgentBattle).not.toHaveBeenCalled();
    expect(ctx.res.statusCode).toBe(503);
    expect(ctx.res.body.missingSymbols).toEqual(['META']);
    const abort = findAbortWrite(ctx.agentRef);
    expect(abort.lastDeployedAt).toBe('2026-08-01T00:00:00.000Z'); // lock + cooldown restored
  });
});

describe('deploy gate behavior — 4. unusable values all abort (no exception, no battle)', () => {
  it.each([
    ['zero', { current: 0 }],
    ['negative', { current: -5 }],
    ['NaN', { current: NaN }],
    ['Infinity', { current: Infinity }],
    ['malformed', { current: '150' }],
    ['fallback-derived', 'fallback'],
  ])('%s baseline on a required symbol blocks the deploy', async (_label, bad) => {
    priceMap({ AAPL: bad, NVDA: 'valid', MSFT: 'valid', GOOG: 'valid', AMZN: 'valid', META: 'valid' });
    const ctx = makeCtx();
    await runPrescribedTournamentDeploy(ctx); // must not throw — a thrown error fails the test
    expect(mocks.createAgentBattle).not.toHaveBeenCalled();
    expect(ctx.res.statusCode).toBe(503);
    expect(ctx.res.body.reason).toBe('pricing_unavailable');
    expect(ctx.res.body.missingSymbols).toContain('AAPL');
  });
});

describe('deploy gate behavior — 5. retry after recovery creates exactly one battle', () => {
  it('first degraded attempt writes no battle + restores cooldown; second valid attempt creates one', async () => {
    // Attempt 1 — degraded.
    priceMap({});
    const ctx1 = makeCtx({ lastDeployedAt: null });
    await runPrescribedTournamentDeploy(ctx1);
    expect(mocks.createAgentBattle).toHaveBeenCalledTimes(0);
    expect(findAbortWrite(ctx1.agentRef).lastDeployedAt).toBeNull(); // cooldown restored (no artificial throttle)
    expect(ctx1.res.statusCode).toBe(503);

    // Attempt 2 — pricing recovered.
    priceMap(VALID_ALL);
    const ctx2 = makeCtx({ lastDeployedAt: null });
    await runPrescribedTournamentDeploy(ctx2);
    expect(mocks.createAgentBattle).toHaveBeenCalledTimes(1); // exactly one battle across both attempts
    expect(ctx2.res.statusCode).toBe(200);
    expect(ctx2.res.body.battleCreated).toBe(true);
  });

  it('an already-active battle is not duplicated (existing idempotency preserved)', async () => {
    priceMap(VALID_ALL);
    const ctx = makeCtx({ existingEmpty: false });
    // Existing active battle present.
    ctx.db = (() => {
      const base = makeDb({ existingEmpty: false });
      const orig = base.collection;
      base.collection = (name) => {
        const q = orig(name);
        if (name === 'agentBattles') {
          q.get = async () => ({ empty: false, docs: [{ id: 'existing-1', data: () => ({ expiresAt: '2999-01-01T00:00:00.000Z' }) }] });
        }
        return q;
      };
      return base;
    })();
    await runPrescribedTournamentDeploy(ctx);
    expect(mocks.createAgentBattle).not.toHaveBeenCalled(); // no new battle
    expect(ctx.res.statusCode).toBe(200);
    expect(ctx.res.body.battleCreated).toBe(false);
    expect(ctx.res.body.existingBattleId).toBe('existing-1');
  });
});

describe('deploy gate behavior — 6/7. cooldown rollback uses the PRIOR value, not the post-stamp', () => {
  it('restores a non-null prior lastDeployedAt exactly (not the fresh nowIso stamp)', async () => {
    priceMap({});
    const prior = '2026-07-30T12:34:56.000Z';
    const ctx = makeCtx({ lastDeployedAt: prior });
    await runPrescribedTournamentDeploy(ctx);

    const decision = findDecisionWrite(ctx.agentRef);
    const abort = findAbortWrite(ctx.agentRef);
    // The decision-persist write stamped a fresh timestamp...
    expect(decision.lastDeployedAt).toBeTruthy();
    expect(decision.lastDeployedAt).not.toBe(prior);
    // ...and the abort rolled it back to the exact prior value.
    expect(abort.lastDeployedAt).toBe(prior);
  });

  it('a null prior lastDeployedAt stays null after abort', async () => {
    priceMap({});
    const ctx = makeCtx({ lastDeployedAt: null });
    await runPrescribedTournamentDeploy(ctx);
    expect(findAbortWrite(ctx.agentRef).lastDeployedAt).toBeNull();
  });
});

describe('deploy gate behavior — 9. sanitization', () => {
  it('the 503 body and warn log carry only ids, counts, and symbol names', async () => {
    const warns = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a) => warns.push(a.join(' ')));
    priceMap({ AAPL: 'fallback', NVDA: 'valid', MSFT: 'valid', GOOG: 'valid', AMZN: 'valid', META: 'valid' });
    const ctx = makeCtx();
    await runPrescribedTournamentDeploy(ctx);
    warnSpy.mockRestore();

    expect(Object.keys(ctx.res.body).sort()).toEqual(
      ['error', 'groupId', 'missingSymbols', 'reason', 'requiredCount', 'retriable', 'usableCount'],
    );
    const serialized = JSON.stringify(ctx.res.body);
    expect(serialized).not.toMatch(/api_token|https?:\/\/|wss:|secret|token/i);

    const line = warns.find((w) => w.includes('[baseline-gate]'));
    expect(line).toBeTruthy();
    expect(line).toContain('AAPL');            // symbol name is fine
    expect(line).not.toMatch(/api_token|https?:\/\/|wss:/i);
    expect(line).not.toContain('{');           // no raw quote/payload object
  });
});

describe('deploy gate behavior — 10. valid-path parity (no payload/doc-shape drift)', () => {
  it('createAgentBattle receives the unchanged payload; the gate leaks nothing into it', async () => {
    priceMap(VALID_ALL);
    const ctx = makeCtx();
    await runPrescribedTournamentDeploy(ctx);

    const [, agentData, thresholds, startingPrices, opts] = mocks.createAgentBattle.mock.calls[0];
    // startingPrices: same symbol→number map, no fallback/baseline annotations.
    expect(startingPrices).toEqual({ AAPL: 150, NVDA: 150, MSFT: 150, GOOG: 150, AMZN: 150, META: 150 });
    // The options object is the origin/main shape — no gate/fallback field leaked in.
    expect(opts).not.toHaveProperty('fallbackSymbols');
    expect(opts).not.toHaveProperty('baseline');
    expect(opts.opponent).toBeNull();               // founder ruling D4 (unchanged)
    expect(opts.gameMode).toBe('baggerbomb_tournament');
    // Agent selection/portfolio unchanged: the six prescribed picks in slot order.
    expect(agentData.lastDecision.portfolio.star.map((a) => a.symbol)).toEqual(['AAPL', 'NVDA']);
    expect(agentData.lastDecision.portfolio.core.map((a) => a.symbol)).toEqual(['MSFT', 'GOOG']);
    expect(agentData.lastDecision.portfolio.support.map((a) => a.symbol)).toEqual(['AMZN', 'META']);
    expect(Array.isArray(thresholds) || typeof thresholds === 'object').toBe(true);
  });
});
