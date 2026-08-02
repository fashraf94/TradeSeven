// api/agent/decide.baselineGate.test.js
//
// Founder-authorized narrow baseline gate — WIRING proof (the house pattern from
// decide.auth.test.js: the deploy handler cannot be unit-run, so its wiring is
// locked by static source guards; the pure DECISION is behaviorally covered in
// api/_utils/agentBaselineCompleteness.test.js).
//
// The gate must, in BOTH deploy paths (tiered handler + prescribed tournament),
// sit AFTER fetchValidatedStartingPrices and BEFORE createAgentBattle, block on
// an incomplete/degraded required-held baseline set, release the deploy lock,
// and return a sanitized retriable `pricing_unavailable` — without a second
// market-data fetch and without altering the createAgentBattle payload.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('./decide.js', import.meta.url), 'utf8');
const HELPER = readFileSync(new URL('../_utils/agentBaselineCompleteness.js', import.meta.url), 'utf8');

// Path 1 (tiered handler) lives before the fetchValidatedStartingPrices helper
// definition; Path 2 (tournament) lives from its function onward.
const HELPER_DEF = 'async function fetchValidatedStartingPrices';
const TOURNEY_FN = 'async function runPrescribedTournamentDeploy';
const handlerBody = SOURCE.slice(0, SOURCE.indexOf(HELPER_DEF));
const tournamentBody = SOURCE.slice(SOURCE.indexOf(TOURNEY_FN));

function orderingProof(region) {
  const idxFetch = region.indexOf('const { startingPrices, fallbackSymbols } = await fetchValidatedStartingPrices');
  const idxGate = region.indexOf('assessRequiredBaselines(requiredHeldSymbols, startingPrices, fallbackSymbols)');
  const idxBlock = region.indexOf("reason: 'pricing_unavailable'");
  const idxCreate = region.indexOf('await createAgentBattle');
  return { idxFetch, idxGate, idxBlock, idxCreate };
}

describe('baseline gate — helper import + fetch return channel', () => {
  it('imports the pure decision helper from the non-fenced utility', () => {
    expect(SOURCE).toContain("import { assessRequiredBaselines } from '../_utils/agentBaselineCompleteness.js';");
  });

  it('fetchValidatedStartingPrices returns { startingPrices, fallbackSymbols }', () => {
    expect(SOURCE).toContain('const fallbackSymbols = new Set();');
    expect(SOURCE).toContain('return { startingPrices, fallbackSymbols };');
  });

  it('records real-time-fallback baselines (fallback:true) as a separate channel', () => {
    expect(SOURCE).toContain('if (p.fallback === true) fallbackSymbols.add(symbol);');
  });

  it('BOTH call sites destructure the new return shape', () => {
    const matches = SOURCE.match(/const \{ startingPrices, fallbackSymbols \} = await fetchValidatedStartingPrices/g);
    expect(matches).toHaveLength(2);
  });
});

describe('baseline gate — tiered (main handler) deploy path', () => {
  it('gates AFTER the price fetch and BEFORE createAgentBattle', () => {
    const { idxFetch, idxGate, idxBlock, idxCreate } = orderingProof(handlerBody);
    expect(idxFetch).toBeGreaterThan(-1);
    expect(idxGate).toBeGreaterThan(idxFetch);
    expect(idxBlock).toBeGreaterThan(idxGate);
    expect(idxCreate).toBeGreaterThan(idxBlock);
  });

  it('the required held set is star/core/support on BOTH sides — bench excluded', () => {
    const start = handlerBody.indexOf('const requiredHeldSymbols = [');
    const end = handlerBody.indexOf('assessRequiredBaselines', start);
    const block = handlerBody.slice(start, end);
    for (const t of [
      'enrichedPortfolio.portfolio.star',
      'enrichedPortfolio.portfolio.core',
      'enrichedPortfolio.portfolio.support',
      'cpuOpponent.portfolio.star',
      'cpuOpponent.portfolio.core',
      'cpuOpponent.portfolio.support',
    ]) {
      expect(block, `required set should include ${t}`).toContain(t);
    }
    expect(block, 'bench must not be in the required held set').not.toContain('bench');
  });

  it('on an incomplete set it releases the lock, rolls back the cooldown, then returns 503 retriable', () => {
    const { idxGate, idxBlock } = orderingProof(handlerBody);
    const gateBlock = handlerBody.slice(idxGate, idxBlock + 40);
    expect(gateBlock).toContain('deployingAt: null'); // lock released before the return
    // cooldown rolled back so the battle-less abort consumes no single-use state
    expect(gateBlock).toContain('lastDeployedAt: agent.lastDeployedAt');
    expect(handlerBody).toContain('return res.status(503).json({');
    const outcome = handlerBody.slice(idxBlock - 80, idxBlock + 240);
    expect(outcome).toContain('retriable: true');
    expect(outcome).toContain('missingSymbols: baseline.missing');
  });

  it('performs NO second market-data fetch between the gate and createAgentBattle', () => {
    const { idxGate, idxCreate } = orderingProof(handlerBody);
    const between = handlerBody.slice(idxGate, idxCreate);
    expect(between).not.toContain('getStockAnalysisData');
    expect(between).not.toContain('fetchValidatedStartingPrices');
  });
});

describe('baseline gate — prescribed tournament deploy path', () => {
  it('gates AFTER the price fetch and BEFORE createAgentBattle', () => {
    const { idxFetch, idxGate, idxBlock, idxCreate } = orderingProof(tournamentBody);
    expect(idxFetch).toBeGreaterThan(-1);
    expect(idxGate).toBeGreaterThan(idxFetch);
    expect(idxBlock).toBeGreaterThan(idxGate);
    expect(idxCreate).toBeGreaterThan(idxBlock);
  });

  it('the required held set is the six flat picks (no CPU opponent, no bench)', () => {
    const start = tournamentBody.indexOf('const requiredHeldSymbols =');
    const end = tournamentBody.indexOf('assessRequiredBaselines', start);
    const block = tournamentBody.slice(start, end);
    expect(block).toContain('allAssets.map(a => a.symbol)');
    expect(block).not.toContain('cpuOpponent');
    expect(block).not.toContain('bench');
  });

  it('on an incomplete set it releases the lock, rolls back the cooldown, then returns 503 retriable', () => {
    const { idxGate, idxBlock } = orderingProof(tournamentBody);
    const gateBlock = tournamentBody.slice(idxGate, idxBlock + 40);
    expect(gateBlock).toContain('deployingAt: null'); // lock released before the return
    expect(gateBlock).toContain('lastDeployedAt: agent.lastDeployedAt'); // cooldown rolled back
    const outcome = tournamentBody.slice(idxBlock - 80, idxBlock + 240);
    expect(outcome).toContain('retriable: true');
    expect(outcome).toContain('missingSymbols: baseline.missing');
  });

  it('performs NO second market-data fetch between the gate and createAgentBattle', () => {
    const { idxGate, idxCreate } = orderingProof(tournamentBody);
    const between = tournamentBody.slice(idxGate, idxCreate);
    expect(between).not.toContain('getStockAnalysisData');
    expect(between).not.toContain('fetchValidatedStartingPrices');
  });
});

describe('baseline gate — parity + sanitization invariants', () => {
  it('the gate only blocks on !complete — valid pricing falls through unchanged', () => {
    const matches = SOURCE.match(/if \(!baseline\.complete\) \{/g);
    expect(matches).toHaveLength(2);
  });

  it('both abort paths roll back the deploy cooldown so a battle-less abort consumes no single-use state', () => {
    // D1 (adversarial review): lastDeployedAt is stamped upstream of the gate; a
    // battle-less abort must restore the prior value so the advertised retriable
    // outcome is not throttled behind the 2-minute cooldown.
    const matches = SOURCE.match(/lastDeployedAt: agent\.lastDeployedAt \?\? null/g);
    expect(matches).toHaveLength(2);
  });

  it('createAgentBattle is still called with the same (db, agentData, thresholds, startingPrices) payload in both paths', () => {
    const matches = SOURCE.match(/db, agentData, thresholds, startingPrices,/g);
    expect(matches).toHaveLength(2);
  });

  it('neither gate block leaks a URL, token, or raw payload', () => {
    for (const region of [handlerBody, tournamentBody]) {
      const idxGate = region.indexOf('assessRequiredBaselines(requiredHeldSymbols');
      const idxBlockEnd = region.indexOf('});', region.indexOf("reason: 'pricing_unavailable'"));
      const gateBlock = region.slice(idxGate, idxBlockEnd);
      expect(gateBlock).not.toMatch(/api_token/i);
      expect(gateBlock).not.toMatch(/https?:\/\//i);
      expect(gateBlock).not.toMatch(/wss:\/\//i);
      expect(gateBlock).not.toContain('startingPrices['); // never echoes a price value
    }
  });

  it('the decision helper is pure — no market-data fetch, no network', () => {
    expect(HELPER).not.toContain('getStockAnalysisData');
    expect(HELPER).not.toMatch(/\bfetch\(/);
    expect(HELPER).not.toMatch(/https?:\/\//i);
  });
});
