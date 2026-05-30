// api/cron/agent-evaluate.test.js
// Phase 3 (intraday momentum overlay) — write-side persistence guard.
//
// FINDING: agent-evaluate.js's default handler is a single 1700-line function
// that is not decomposed for behavioural unit testing — virtually every
// dependency (Firestore admin SDK, EODHD intraday fetch, Anthropic SDK, vision
// runtime, swap execution) is constructed inline against the runtime
// environment. Mocking it end-to-end to assert a single field assignment would
// be far more code than the assertion itself.
//
// Pragmatic alternative: a static-source regression guard that asserts the
// 5 known flush sites each persist `cronState.intradayMomentum`. This catches
// the regressions Phase 3 actually cares about:
//   1. A future flush site added without the intradayMomentum write
//   2. A refactor that drops the existing writes
//   3. vwapTicks and intradayMomentum drifting apart
//
// Forge Enforcement Keystone Phase 2 (§4.5) centralized those five inline
// writes into finalizeCronState (agentCronState.js); the guard below now asserts
// the 5 sites route through that helper and the helper persists fields verbatim.
//
// It will NOT catch logic bugs in `momentumData.vwap` construction — those
// are covered upstream (calculateVWAP / calculate5minSMA20 unit tests in
// technicalCalculations / agentRiskManager) and via live verification.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(__dirname, 'agent-evaluate.js');

describe('agent-evaluate cron — intraday momentum persistence (Phase 2: via finalizeCronState §4.5)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');
  const helperSource = readFileSync(resolve(__dirname, '../_utils/agentCronState.js'), 'utf-8');

  it('imports finalizeCronState from the shared helper', () => {
    expect(source).toMatch(/import\s*\{\s*finalizeCronState\s*\}\s*from\s*'\.\.\/_utils\/agentCronState\.js'/);
  });

  it('routes cron-state persistence through finalizeCronState at exactly the 5 flush sites', () => {
    // Phase 2 (§4.5) consolidated the five inline cron-state writes into one
    // helper so a new persisted field is a one-line add in agentCronState.js.
    // The 5 mutually-exclusive return paths (proposal-skip, gameplan-skip,
    // gameplan-trigger, no-trigger-held, full-Haiku finalUpdate) each call it.
    const calls = source.match(/finalizeCronState\(/g) || [];
    expect(calls.length).toBe(5);
  });

  it('passes vwapTicks AND intradayMomentum together at every flush site (they must never drift apart)', () => {
    // Both come from the same momentumData.vwap table and must flush together —
    // if a site is added/changed without the other, the read side
    // (voice-layer-cache) sees asymmetric state. Each call carries both.
    const both = source.match(/finalizeCronState\([^;]*?\bvwapTicks\b[^;]*?intradayMomentum:\s*momentumData\.vwap/g) || [];
    expect(both.length).toBe(5);
  });

  it('the helper persists cronState fields verbatim and always releases the lock (passthrough contract)', () => {
    // The actual writes now live in finalizeCronState. intradayMomentum must be
    // persisted as the raw momentumData.vwap passthrough (no wrapping / subkeying
    // / serialization) so the read side sees the same shape; evaluatingAt must
    // always be nulled so no return path leaks the evaluating lock.
    expect(helperSource).toMatch(/update\['cronState\.intradayMomentum'\]\s*=\s*intradayMomentum;/);
    expect(helperSource).toMatch(/update\['cronState\.vwapTicks'\]\s*=\s*vwapTicks;/);
    expect(helperSource).toMatch(/update\['cronState\.evaluatingAt'\]\s*=\s*null;/);
  });

  it('no flush site transforms momentumData.vwap before persisting (verbatim contract)', () => {
    // Guard against a call site sub-keying / wrapping / serializing the momentum
    // table instead of passing it through finalizeCronState verbatim.
    const transformingForms = [
      /intradayMomentum:\s*\{/,                       // wrapping in {}
      /intradayMomentum:\s*momentumData\.vwap\.\w+/,  // sub-keying
      /intradayMomentum:\s*Object\./,                 // Object.fromEntries / mapping
      /intradayMomentum:\s*JSON\.\w+/,                // JSON serialization
    ];
    for (const pattern of transformingForms) {
      expect(source).not.toMatch(pattern);
    }
  });
});

// Phase 4 — technical snapshot writes at trade decision time.
//
// The snapshot helper is exhaustively unit-tested in
// buildTechnicalSnapshot.test.js. These guards ensure the cron actually
// invokes it at the right sites and threads the result through the swap
// pipeline. Same static-source rationale as Phase 3 above: the surrounding
// handler is too entangled to behaviourally test, but the surface where
// snapshots attach is small and regex-checkable.
describe('agent-evaluate cron — Phase 4 technical snapshot writes', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports buildTechnicalSnapshot from the shared helper', () => {
    expect(source).toMatch(/import\s*\{\s*buildTechnicalSnapshot\s*\}\s*from\s*'\.\.\/_utils\/buildTechnicalSnapshot\.js'/);
  });

  it('builds a {symbolOut, symbolIn} snapshot at exactly 3 decision sites (proposal-create, autopilot, risk-triggered)', () => {
    // Each site builds a snapshot via two buildTechnicalSnapshot calls inside
    // an object literal containing both symbolOut and symbolIn keys. We count
    // the symbolOut: buildTechnicalSnapshot(...) opener as a stable marker.
    const builderOpenings = source.match(/symbolOut:\s*buildTechnicalSnapshot\(/g) || [];
    const builderClosings = source.match(/symbolIn:\s*buildTechnicalSnapshot\(/g) || [];

    expect(builderOpenings.length).toBe(3);
    expect(builderClosings.length).toBe(3);
  });

  it('attaches snapshot onto pendingProposalUpdate at the proposal-creation site', () => {
    // The proposal lives inside pendingProposalUpdate which already has fields
    // like proposalId, evalId, evaluationMetadata. Snapshot must be in there.
    expect(source).toMatch(/pendingProposalUpdate\s*=\s*\{[^}]*?snapshot:\s*proposalSnapshot/s);
  });

  it('passes the snapshot as the 10th positional arg through every executeSwapServer call site that the cron creates', () => {
    // 5 call sites total in agent-evaluate.js:
    //   - autopilot direct                (in scope: snapshot built inline, passed)
    //   - risk-triggered swap             (in scope: snapshot built inline, passed)
    //   - copilot-approved-execute        (in scope: forwards proposal.snapshot)
    //   - copilot-expired-auto-execute    (in scope: forwards proposal.snapshot)
    //   - gameplan-rotation               (out of scope per Phase 4 plan)
    const inScopeSites = source.match(/executeSwapServer\([\s\S]+?(snapshot|proposal\.snapshot \|\| null)\s*\)/g) || [];
    expect(inScopeSites.length).toBe(4);
  });

  it('forwards proposal.snapshot through the copilot-approved and expired-auto-execute paths', () => {
    const forwardingPattern = /proposal\.snapshot \|\| null/g;
    const matches = source.match(forwardingPattern) || [];
    expect(matches.length).toBe(2);
  });

  it('threads currentScore into handlePendingProposal and captures scoreAtVeto / scoreAtResolution', () => {
    // Function signature receives currentScore
    expect(source).toMatch(/async function handlePendingProposal\([^)]*currentScore[^)]*\)/);
    // Call site passes it
    expect(source).toMatch(/handlePendingProposal\([^)]*currentScore\)/);

    // Veto site captures scoreAtVeto
    expect(source).toMatch(/scoreAtVeto:\s*typeof currentScore === 'number'/);
    // Auto-execute / lapse site captures scoreAtResolution
    expect(source).toMatch(/scoreAtResolution:\s*typeof currentScore === 'number'/);
  });

  it('skips HOLD decisions and the gameplan-rotation execution (out of Phase 4 scope)', () => {
    // HOLD branch must not contain a snapshot build. The HOLD increment is at
    // `summary.held++;` — search the surrounding 200 chars for accidental snapshot work.
    const holdMatches = source.match(/if \(decision === 'HOLD'\) \{[\s\S]{0,200}\}/g) || [];
    for (const block of holdMatches) {
      expect(block).not.toContain('buildTechnicalSnapshot');
    }

    // Gameplan-rotation is identified by handleGameplanMeeting; the snapshot
    // builder must not be invoked inside that helper either.
    const gameplanFn = source.match(/async function handleGameplanMeeting\([\s\S]+?\n\}/);
    if (gameplanFn) {
      expect(gameplanFn[0]).not.toContain('buildTechnicalSnapshot');
    }
  });
});

// VWAP session-boundary fix — pre-merge guard.
//
// Discovery (discovery/vwap-semantics-investigation.md) found that since
// commit 330b5fa removed the default from/to window from
// fetchIntradayCandles, EODHD returns weeks-to-months of candles per call.
// calculateVWAP has no session reset, so the persisted "VWAP" became a
// multi-day window VWAP mislabeled as session VWAP for 5 downstream
// consumers (risk manager SWAP_OUT, Haiku prompt, Phase 4 snapshots,
// Phase 5B-main brief line, voiceLayerCache).
//
// Fix v1 introduced filterToCurrentSession which anchored on today's ET
// date — broken under EODHD's ~1-trading-day lag on /intraday. Fix v2
// renames to filterToLatestSession and anchors on the latest ET date in
// the candle array (handles the lag). The function returns
// `{candles, sessionDate}` so downstream can render today/prior prefixes.
//
// SMA20 intentionally keeps the full candle array (it's a 20-bar-by-index
// calculation — already within-session by construction).
//
// These are static-source guards in the same style as Phase 3/4 above:
// the handler is monolithic and the assertions belong on the wire shape.
describe('agent-evaluate cron — VWAP session-boundary filter (post-fix v2)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports filterToLatestSession from marketDataCache.js', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bfilterToLatestSession\b[^}]*\}\s*from\s*'\.\.\/_utils\/marketDataCache\.js'/,
    );
    // Fix v1 name is gone.
    expect(source).not.toMatch(/\bfilterToCurrentSession\b/);
  });

  it('destructures {candles, sessionDate} from filterToLatestSession and passes filtered candles to calculateVWAP', () => {
    // Wire shape: `const { candles: sessionCandles, sessionDate } = filterToLatestSession(candles);`
    // followed by `calculateVWAP(sessionCandles)`. The destructure is the
    // contract that lets sessionDate flow into momentumData.vwap[symbol].
    expect(source).toMatch(
      /const\s*\{\s*candles\s*:\s*sessionCandles\s*,\s*sessionDate\s*\}\s*=\s*filterToLatestSession\s*\(\s*candles\s*\)/,
    );
    expect(source).toMatch(/calculateVWAP\s*\(\s*sessionCandles\s*\)/);
    // And the bug-state (raw passthrough) is gone.
    expect(source).not.toMatch(/calculateVWAP\s*\(\s*candles\s*\)/);
  });

  it('persists sessionDate into momentumData.vwap[symbol] alongside vwapResult and sma20_5m', () => {
    // sessionDate must travel with the rest of the intraday payload so that
    // brief.intraday (voice-layer-cache.js:279 passthrough) carries it to
    // buildIntradayLine for today/prior prefix selection.
    expect(source).toMatch(
      /momentumData\.vwap\[symbol\]\s*=\s*\{\s*\.\.\.\s*vwapResult\s*,\s*sma20_5m\s*,\s*sessionDate\s*\}/,
    );
  });

  it('continues to pass the full candle array to calculate5minSMA20 (asymmetry by design)', () => {
    // SMA20 reads the last 20 candles by index. 20×5min = 100 minutes is
    // within-session by construction; filtering would unnecessarily produce
    // null near market open when fewer than 20 session bars have closed.
    // This guard locks the asymmetric handling so a future refactor doesn't
    // accidentally apply the session filter to the SMA20 input too.
    expect(source).toMatch(/calculate5minSMA20\s*\(\s*candles\s*\)/);
    expect(source).not.toMatch(/calculate5minSMA20\s*\(\s*sessionCandles\s*\)/);
  });
});

// Phase 5B1 — watchlist equip: daily-refresh hotBench union.
//
// The union logic itself is behaviourally unit-tested in
// api/_utils/watchlistEquip.test.js (unionEquippedIntoHotBench). Same
// static-source rationale as Phase 3/4 above: the cron handler is monolithic,
// so these guards only verify the cron wires the helper into the daily
// watchlist refresh and reads from the frozen battle snapshot.
describe('agent-evaluate cron — Phase 5B1 equipped-watchlist hotBench union', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports unionEquippedIntoHotBench from the shared helper', () => {
    expect(source).toMatch(
      /import\s*\{\s*unionEquippedIntoHotBench\s*\}\s*from\s*'\.\.\/_utils\/watchlistEquip\.js'/,
    );
  });

  it('reads equipped tickers from the frozen battle snapshot (agentContext.equippedWatchlist)', () => {
    expect(source).toMatch(/battle\.agentContext\?\.equippedWatchlist\?\.tickers/);
  });

  it('reassigns newHotBench from unionEquippedIntoHotBench inside the daily refresh', () => {
    expect(source).toMatch(/newHotBench\s*=\s*unionEquippedIntoHotBench\(/);
  });

  it('passes a soft cap of 20 to the union call (Q-A2)', () => {
    expect(source).toMatch(/unionEquippedIntoHotBench\(\{[\s\S]*?cap:\s*20[\s\S]*?\}\)/);
  });
});

// Phase 3 (Knob A — forced rotation, §4.2) — write-side wiring guards. Same
// static-source rationale as the Phase 3/4 blocks above: the cron handler is
// monolithic, so the pure functions (updateStagnationCounter / the detection
// branch via evaluateRisk / pickSwapReplacementCandidate) carry the behavioral
// tests in agentRiskManager.test.js; these guard the cron wiring.
describe('agent-evaluate cron — Knob A forced rotation wiring (§4.2)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports updateStagnationCounter and pickSwapReplacementCandidate', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bupdateStagnationCounter\b[^}]*\}\s*from\s*'\.\.\/_utils\/agentRiskManager\.js'/s);
    expect(source).toMatch(/import\s*\{[^}]*\bpickSwapReplacementCandidate\b[^}]*\}\s*from\s*'\.\.\/_utils\/agentRiskManager\.js'/s);
  });

  it('seeds the three stagnation maps from cronState (mirrors vwapTicks)', () => {
    expect(source).toMatch(/const stagnationTicks = \{ \.\.\.\(battle\.cronState\?\.stagnationTicks \|\| \{\}\) \}/);
    expect(source).toMatch(/const lastTickPrice = \{ \.\.\.\(battle\.cronState\?\.lastTickPrice \|\| \{\}\) \}/);
    expect(source).toMatch(/const lastTickTimestamp = \{ \.\.\.\(battle\.cronState\?\.lastTickTimestamp \|\| \{\}\) \}/);
  });

  it('updates the stagnation counter in-loop and threads stagnationTicks + withinAge via cronMemory', () => {
    expect(source).toMatch(/const stag = updateStagnationCounter\(/);
    expect(source).toMatch(/stagnationTicks: stagnationTicks\[score\.symbol\], withinAge: stag\.withinAge/);
  });

  it('normalizes dailyPct to a FRACTION (changePercent / 100) on the position (winner-suppression units)', () => {
    expect(source).toMatch(/dailyPct: \(prices\[score\.symbol\]\?\.changePercent \|\| 0\) \/ 100/);
  });

  it('branches the candidate source on REASON (Invariant 1): stagnation → wrapper, else → emergency', () => {
    expect(source).toMatch(/if \(riskResult\.reason === 'stagnation'\) \{[\s\S]*?pickSwapReplacementCandidate\(/);
    expect(source).toMatch(/\} else \{[\s\S]*?pickEmergencyReplacement\(allBench/);
  });

  it('sets statusFeed source to "archetype" for stagnation swaps (reason-aware)', () => {
    expect(source).toMatch(/source: riskResult\.reason === 'stagnation' \? 'archetype' : 'risk_manager'/);
  });

  it('all 5 finalizeCronState calls carry the three stagnation maps', () => {
    const withStag = source.match(/finalizeCronState\([^;]*?stagnationTicks, lastTickPrice, lastTickTimestamp/g) || [];
    expect(withStag.length).toBe(5);
  });
});

// Phase 4 (Knob B — hurdle floor, §4.3) — write-side wiring guards. Same
// static-source rationale as the Phase 3 block: the behavioral load is carried by
// the pure clearsHurdleFloor / computeBenchVsActiveMargin tests in
// agentRiskManager.test.js; these guard the two cron hook sites + A2 wiring.
describe('agent-evaluate cron — Knob B hurdle floor wiring (§4.3)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports clearsHurdleFloor from agentRiskManager', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bclearsHurdleFloor\b[^}]*\}\s*from\s*'\.\.\/_utils\/agentRiskManager\.js'/s);
  });

  it('hook 1 (stagnation seam): clearsQuality calls clearsHurdleFloor with reason stagnation', () => {
    expect(source).toMatch(/clearsQuality:\s*\(candidate\)\s*=>\s*clearsHurdleFloor\(\{/);
    expect(source).toMatch(/reason:\s*'stagnation',\s*\n\s*archetypeConfig,\s*\n\s*userATR:\s*score\.baseATR/);
  });

  it('hook 2 (Haiku): gates execution on clearsHurdleFloor before executeSwapServer', () => {
    expect(source).toMatch(/const hurdle = clearsHurdleFloor\(\{/);
    // the block downgrades to HOLD on a non-clearing hurdle (mirrors LOCK/distressed)
    expect(source).toMatch(/if \(!hurdle\.clears\) \{[\s\S]*?decision = 'HOLD';[\s\S]*?\} else if \(mode === 'autopilot'\) \{/);
  });

  it('A2: maps guardrail_stopLoss / guardrail_trailingStop sourceNote to the bypass reason', () => {
    expect(source).toMatch(/guardrailSourceNote === 'guardrail_stopLoss' \|\| guardrailSourceNote === 'guardrail_trailingStop'/);
    expect(source).toMatch(/const haikuSwapReason\s*=/);
  });

  it('A2 stamp: autopilot exitReason uses the computed reason (not a hardcoded haiku_decision)', () => {
    expect(source).toMatch(/exitReason:\s*haikuSwapReason/);
  });
});

// Phase 5 (Knob C — circuit breaker / swapWindow, §4.4) — write-side wiring
// guards. Behavioral load is carried by the pure getRecentSwapCount tests in
// agentRiskManager.test.js; these guard the two cron hook sites + the A2 bypass.
describe('agent-evaluate cron — Knob C circuit breaker wiring (§4.4)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports getRecentSwapCount and EMERGENCY_BYPASS_REASONS from agentRiskManager', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bgetRecentSwapCount\b[^}]*\}\s*from\s*'\.\.\/_utils\/agentRiskManager\.js'/s);
    expect(source).toMatch(/import\s*\{[^}]*\bEMERGENCY_BYPASS_REASONS\b[^}]*\}\s*from\s*'\.\.\/_utils\/agentRiskManager\.js'/s);
  });

  it('hook 1 (risk loop): caps ONLY stagnation, reads getRecentSwapCount live, and continues when at cap', () => {
    expect(source).toMatch(/if \(riskResult\.reason === 'stagnation' && swCfg\?\.enabled\) \{/);
    expect(source).toMatch(/const used = getRecentSwapCount\(battle\.trades \|\| \[\]/);
    expect(source).toMatch(/if \(used >= swCfg\.capPerWindow\) \{[\s\S]*?continue;/);
  });

  // B1 within-tick binding (Phase-5 carry-over): the cap MUST read the live
  // in-loop battle.trades, and the loop MUST re-read battle after each swap, so the
  // Nth forced rotation in a burst sees the prior N-1 — NOT a frozen pre-tick count.
  it('B1: the stagnation cap reads live battle.trades INSIDE the riskSwaps loop, which re-reads battle after each swap', () => {
    // getRecentSwapCount(battle.trades …) appears between the loop head and the post-swap re-read.
    expect(source).toMatch(/for \(const \{ score, asset, riskResult \} of riskSwaps\) \{[\s\S]*?getRecentSwapCount\(battle\.trades[\s\S]*?const updatedDoc = await battleRef\.get\(\);\s*\n\s*Object\.assign\(battle, updatedDoc\.data\(\)\);/);
  });

  it('hook 2 (Haiku): cap check bypasses emergencies via EMERGENCY_BYPASS_REASONS and slots into the hurdle chain', () => {
    expect(source).toMatch(/const capBlocked = swCfg\?\.enabled\s*\n\s*&& !EMERGENCY_BYPASS_REASONS\.has\(haikuSwapReason\)/);
    expect(source).toMatch(/if \(!hurdle\.clears\) \{[\s\S]*?\} else if \(capBlocked\) \{[\s\S]*?decision = 'HOLD';[\s\S]*?\} else if \(mode === 'autopilot'\) \{/);
  });

  it('Knob C adds NO new persisted state (finalizeCronState calls unchanged — no swapWindow field)', () => {
    expect(source).not.toMatch(/finalizeCronState\([^;]*swapWindow/);
    expect(source).not.toMatch(/cronState\.(swapCount|swapWindow|recentSwaps)/);
  });
});

// Phase 6 (§4.6 receipt source discriminator) — Gate 7: every swap origin path
// stamps the right source onto its evaluationMetadata (rides onto trades[] via the
// ...evaluationMetadata spread). Behavioral load is on buildSwapReceiptSource's
// unit tests; these guard per-site coverage (a missing/wrong source silently
// poisons training data + Voice Layer labeling).
describe('agent-evaluate cron — Knob §4.6 receipt source wiring (Gate 7)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports buildSwapReceiptSource from agentRiskManager', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bbuildSwapReceiptSource\b[^}]*\}\s*from\s*'\.\.\/_utils\/agentRiskManager\.js'/s);
  });

  it('stamps the receipt source at all 4 swap origin paths (spread into evaluationMetadata)', () => {
    const spreads = source.match(/\.\.\.buildSwapReceiptSource\(\{/g) || [];
    expect(spreads.length).toBe(4);
  });

  it('Path A (risk loop): source = archetype for stagnation, else risk_manager (mirrors statusFeed)', () => {
    expect(source).toMatch(/const swapSource = riskResult\.reason === 'stagnation' \? 'archetype' : 'risk_manager';/);
    expect(source).toMatch(/\.\.\.buildSwapReceiptSource\(\{ source: swapSource, archetype: ctx\.archetype \}\)/);
  });

  it('Path B (Haiku): source = haiku for discretionary, guardrail for guardrail-forced', () => {
    expect(source).toMatch(/const swapSource = haikuSwapReason === 'haiku_decision' \? 'haiku' : 'guardrail';/);
  });

  it('Path C (proposal, dormant): source = haiku', () => {
    expect(source).toMatch(/\.\.\.buildSwapReceiptSource\(\{ source: 'haiku', archetype: ctx\.archetype \}\)/);
  });

  it('Path D (gameplan, dormant): source = gameplan_meeting', () => {
    expect(source).toMatch(/\.\.\.buildSwapReceiptSource\(\{ source: 'gameplan_meeting', archetype: ctx\.archetype \}\)/);
  });
});
