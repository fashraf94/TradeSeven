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
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative, sep } from 'node:path';
// Corpus Capture Patch — §4 dependency-surface guard: this import of the REAL
// flags module is the runtime guard for agent-evaluate.js's own featureFlags
// import (it explodes in the Node test env if a browser dep ever enters that
// graph) — it must NEVER be mocked. It also pins the merge-dark contract in
// the W1/W2 suite below.
import {
  LEARNING_L1_CAPTURE_ENABLED,
  LEARNING_L1_CAPTURE_EXPANSION_ENABLED,
  REGIME_STAMP_ENABLED,
} from '../../src/config/featureFlags.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(__dirname, 'agent-evaluate.js');

describe('agent-evaluate cron — intraday momentum persistence (Phase 2: via finalizeCronState §4.5)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');
  const helperSource = readFileSync(resolve(__dirname, '../_utils/agentCronState.js'), 'utf-8');

  it('imports finalizeCronState from the shared helper', () => {
    expect(source).toMatch(/import\s*\{\s*finalizeCronState\s*\}\s*from\s*'\.\.\/_utils\/agentCronState\.js'/);
  });

  it('routes cron-state persistence through finalizeCronState at exactly the 6 flush sites', () => {
    // Phase 2 (§4.5) consolidated the five inline cron-state writes into one
    // helper so a new persisted field is a one-line add in agentCronState.js.
    // The 5 mutually-exclusive return paths (proposal-skip, gameplan-skip,
    // gameplan-trigger, no-trigger-held, full-Haiku finalUpdate) each call it;
    // P4 added a 6th: the CPU passive-battle skip (contract #5 consumer).
    const calls = source.match(/finalizeCronState\(/g) || [];
    expect(calls.length).toBe(6);
  });

  it('passes vwapTicks AND intradayMomentum together at every flush site (they must never drift apart)', () => {
    // Both come from the same momentumData.vwap table and must flush together —
    // if a site is added/changed without the other, the read side
    // (voice-layer-cache) sees asymmetric state. Each call carries both. The
    // P4 CPU-skip site flushes BEFORE momentumData exists, so it preserves
    // the battle's persisted counters instead (asserted separately below).
    const both = source.match(/finalizeCronState\([^;]*?\bvwapTicks\b[^;]*?intradayMomentum:\s*momentumData\.vwap/g) || [];
    expect(both.length).toBe(5);
    const preserved = source.match(/finalizeCronState\([^;]*?vwapTicks: battle\.cronState\?\.vwapTicks \|\| \{\},[^;]*?intradayMomentum: battle\.cronState\?\.intradayMomentum \|\| \{\}/g) || [];
    expect(preserved.length).toBe(1);
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
    // Call site passes it (P2 appended tournamentCtx after it — lock both)
    expect(source).toMatch(/handlePendingProposal\([^)]*currentScore, tournamentCtx\)/);

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

  it('branches the candidate source on REASON (Invariant 1): stagnation → quality-gated, else → quality-free', () => {
    // [VWAP Floor B2] Both branches now route through the held/self-excluding
    // wrapper; the REASON branch carries the quality split — stagnation
    // injects clearsQuality (Knob B hurdle floor), emergency reasons omit it
    // (protective exits are never quality-gated; bypass verified equivalent).
    expect(source).toMatch(/if \(riskResult\.reason === 'stagnation'\) \{[\s\S]*?pickSwapReplacementCandidate\(\{[\s\S]*?clearsQuality:/);
    const elseBranch = source.match(/Emergency reasons \(bust\/vwap\/trail\) bypass quality[\s\S]*?pickSwapReplacementCandidate\(\{([\s\S]*?)\}\);/);
    expect(elseBranch).not.toBeNull();
    expect(elseBranch[1]).toMatch(/heldSymbols/);
    expect(elseBranch[1]).not.toMatch(/clearsQuality/);
    // The quality-blind single-pick helper is fully retired from the cron.
    expect(source).not.toMatch(/pickEmergencyReplacement/);
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
    // Task A narrow freshening: the hurdle now divides by the fresh rankings-derived
    // ATR (resolveHurdleAtr), frozen score.baseATR verbatim when unavailable.
    expect(source).toMatch(/reason:\s*'stagnation',\s*\n\s*archetypeConfig,[\s\S]*?userATR:\s*resolveHurdleAtr\(score\.symbol, freshHurdleAtrMap, score\.baseATR\)\.atr/);
  });

  it('Task A: both hurdle sites divide by the FRESH rankings ATR (resolveHurdleAtr), not the frozen baseATR', () => {
    // Shared pure helper imported — single source of truth with the B2 harness (drift rider a).
    expect(source).toMatch(/import\s*\{[^}]*\bresolveHurdleAtr\b[^}]*\}\s*from\s*'\.\.\/_utils\/hurdleAtr\.js'/s);
    expect(source).toMatch(/import\s*\{[^}]*\bbuildFreshAtrPercentileMap\b[^}]*\}\s*from\s*'\.\.\/_utils\/hurdleAtr\.js'/s);
    // Map built once per tick from the fresh rankings array.
    expect(source).toMatch(/const freshHurdleAtrMap = buildFreshAtrPercentileMap\(stockRankingsArray\)/);
    // Both hurdle call sites resolve the active position's ATR through the helper.
    expect(source).toMatch(/userATR:\s*resolveHurdleAtr\(score\.symbol, freshHurdleAtrMap, score\.baseATR\)\.atr/);
    expect(source).toMatch(/userATR:\s*resolveHurdleAtr\(haikuResult\.symbolOut, freshHurdleAtrMap, activeBaseATR\)\.atr/);
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
    // getRecentSwapCount(battle.trades …) appears between the loop head and
    // the post-swap re-read (P2 routed the re-read through
    // refreshBattleFromDoc, which re-assigns battle from the live doc).
    expect(source).toMatch(/for \(const \{ score, asset, riskResult \} of riskSwaps\) \{[\s\S]*?getRecentSwapCount\(battle\.trades[\s\S]*?await refreshBattleFromDoc\(battleRef, battle, tournamentCtx\);/);
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

  it('stamps the receipt source at all 4 swap origin paths (spread into evaluationMetadata) + the 2 flag-#4 fallback syntheses', () => {
    // Corpus Capture Patch W2 raised the total from 4 → 6: the 4 origin-path
    // metadata spreads are unchanged, and the two proposal-execution fallbacks
    // (approved + expired) now synthesize minimal provenance via the SAME
    // fenced helper instead of passing a bare {} (founder-approved flag-#4
    // hardening — a metadata-less proposal must never persist a sourceless
    // swap). The synthesis spelling is pinned by the W1/W2 suite below.
    const spreads = source.match(/\.\.\.buildSwapReceiptSource\(\{/g) || [];
    expect(spreads.length).toBe(6);
    const fallbackSyntheses = source.match(/\.\.\.buildSwapReceiptSource\(\{ source: 'haiku', archetype: null \}\)/g) || [];
    expect(fallbackSyntheses.length).toBe(2); // 6 − 2 = the 4 origin paths, untouched
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

  it('Path D (gameplan, dormant): source = gameplan_meeting (archetype off battle.agentContext — ctx not in scope in handleGameplanMeeting)', () => {
    expect(source).toMatch(/\.\.\.buildSwapReceiptSource\(\{ source: 'gameplan_meeting', archetype: battle\.agentContext\?\.archetype \}\)/);
  });
});

// Corpus Capture Patch (W1 + W2) — L1 capture coverage guards. Same
// static-source posture as the suites above (the handler is not decomposed for
// behavioral testing; behavioral load lives on captureSwapReceipt's own unit
// tests). These guard the wiring the patch exists for: every swap-execution
// class captures, every capture carries archetype, the expansion stays dark
// until its flip PR, and no proposal path can persist a sourceless swap.
describe('agent-evaluate cron — Corpus Capture Patch W1/W2 L1 capture wiring', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');
  // The capture-call spans: text from each `captureSwapReceipt({` to its
  // closing `});` — enough to assert per-site fields without executing.
  const captureBlocks = source.split('await captureSwapReceipt({').slice(1).map(s => s.slice(0, s.indexOf('});')));

  it('all FIVE swap-execution sites invoke captureSwapReceipt (4 executeSwapServer classes; the proposal class has two execution points)', () => {
    expect(captureBlocks.length).toBe(5);
    // One capture per executeSwapServer call — no swap class is left out.
    const swaps = source.match(/await executeSwapServer\(/g) || [];
    expect(swaps.length).toBe(5);
  });

  it('every capture call threads archetype from the battle-creation-frozen agentContext (never the mutable agent scalar)', () => {
    for (const [i, block] of captureBlocks.entries()) {
      expect(
        /archetype: (ctx\.archetype|battle\.agentContext\?\.archetype) \?\? null/.test(block),
        `capture site #${i + 1} missing archetype thread`
      ).toBe(true);
    }
    expect(source).not.toMatch(/archetype: agent\.archetype/);
  });

  it('the 4 NEW sites are triple-gated (master && expansion && live_agent); the original autopilot site keeps its master-only gate', () => {
    const tripleGates = source.match(/LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED\s*\n\s*&& classifyEvidence\(/g) || [];
    expect(tripleGates.length).toBe(4);
    const masterOnlyGates = source.match(/LEARNING_L1_CAPTURE_ENABLED && classifyEvidence\(/g) || [];
    expect(masterOnlyGates.length).toBe(1);
  });

  it('each new class stamps its own source/exitReason pair (enum members — the fail-closed validator would drop anything else)', () => {
    const joined = captureBlocks.join('\n');
    // risk-manager class: swapSource ('archetype'|'risk_manager') + riskResult.reason
    expect(joined).toMatch(/source: swapSource,\s*\n\s*exitReason: riskResult\.reason,/);
    // gameplan class
    expect(joined).toMatch(/source: 'gameplan_meeting',\s*\n\s*exitReason: 'gameplan_rotation',/);
    // proposal class ×2 (approved + expired): source haiku, exitReason from metadata
    const proposalPairs = joined.match(/source: 'haiku',\s*\n\s*exitReason: proposal\.evaluationMetadata\?\.exitReason \?\? 'haiku_decision',/g) || [];
    expect(proposalPairs.length).toBe(2);
  });

  it('every capture is post-commit and isolated: inside a try/catch that logs and swallows (trade unaffected)', () => {
    const isolations = source.match(/L1 capture threw \(ignored, trade unaffected\)/g) || [];
    expect(isolations.length).toBe(5);
  });

  it('flag #4 hardening: no proposal path passes a bare {} metadata — both synthesize provenance via the FENCED helper (called, never edited)', () => {
    expect(source).not.toMatch(/proposal\.evaluationMetadata \|\| \{\},/);
    const synthesized = source.match(/proposal\.evaluationMetadata \|\| \{\s*\n\s*\.\.\.buildSwapReceiptSource\(\{ source: 'haiku', archetype: null \}\)/g) || [];
    expect(synthesized.length).toBe(2);
    // /code-review tripwire restore: the fallback syntheses must NOT absorb a
    // §14 dial-provenance spread — the tempo-dial suite's 4-count would still
    // pass if one migrated off an origin path into a fallback object, so pin
    // the pairing here: every buildSwapProvenance stays on an origin path.
    const fallbackSpans = source.split('proposal.evaluationMetadata || {').slice(1)
      .map(s => s.slice(0, s.indexOf('},')));
    expect(fallbackSpans.length).toBe(2);
    for (const span of fallbackSpans) {
      expect(span).not.toContain('buildSwapProvenance');
    }
  });

  it('merge-dark contract: the expansion flag defaults FALSE; the master kill-switch stays a live founder-owned value', () => {
    // Founder ruling (Phase 1 greenlight memo, July 21 2026): expansion ships
    // dark and flips in its own PR; the master flag is NOT reset in this patch.
    expect(LEARNING_L1_CAPTURE_EXPANSION_ENABLED).toBe(false);
    expect(typeof LEARNING_L1_CAPTURE_ENABLED).toBe('boolean');
  });
});

// Corpus Capture Patch W3 — regimeAtStart stamp wiring guards. Behavioral load
// (write-once / flag-off / shape / staleness semantics) lives on the pure
// helpers' own unit tests (api/_utils/regimeStamp.test.js); these pin the cron
// wiring: gated call, write-once field, zero added reads, in-memory mirror.
describe('agent-evaluate cron — Corpus Capture Patch W3 regimeAtStart wiring', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('imports the pure helpers and the flag', () => {
    expect(source).toMatch(/import\s*\{\s*shouldStampRegime,\s*buildRegimeAtStart\s*\}\s*from\s*'\.\.\/_utils\/regimeStamp\.js'/);
    expect(source).toMatch(/\bREGIME_STAMP_ENABLED\b[^]*?from '\.\.\/\.\.\/src\/config\/featureFlags\.js'/);
  });

  it('stamps via the gated helper exactly once, writing the regimeAtStart field with an in-memory mirror', () => {
    const gates = source.match(/shouldStampRegime\(\{ battle, marketContext, enabled: REGIME_STAMP_ENABLED \}\)/g) || [];
    expect(gates.length).toBe(1);
    expect(source).toMatch(/await battleRef\.update\(\{ regimeAtStart \}\);\s*\n\s*battle\.regimeAtStart = regimeAtStart;/);
  });

  it('the evaluatingAt lock transaction refreshes regimeAtStart from its own doc read (stale-snapshot re-stamp race fix)', () => {
    // Without this, a concurrent invocation holding a pre-stamp query
    // snapshot passes the write-once guard and overwrites the stamp — the
    // controlEpochLog PR-c refresh precedent, extended to the stamp field.
    expect(source).toMatch(/battle\.regimeAtStart = data\.regimeAtStart;/);
  });

  it('ZERO added reads: the stamp sits after the existing marketContext assignment and adds no new indexIntelligence read', () => {
    // The stamp must consume the doc loaded by the existing parallel batch —
    // exactly two indexIntelligence doc refs existed before this patch
    // (marketContext + SPY in the getAll) plus the stockRankings get; the
    // stamp adds none.
    const mcReads = source.match(/collection\('indexIntelligence'\)/g) || [];
    expect(mcReads.length).toBe(3); // stockRankings + marketContext + SPY — unchanged
    // Ordering: assignment from the fetched doc precedes the stamp block.
    const assignIdx = source.indexOf('if (mcDoc.exists) marketContext = mcDoc.data();');
    const stampIdx = source.indexOf('shouldStampRegime({ battle, marketContext, enabled: REGIME_STAMP_ENABLED })');
    expect(assignIdx).toBeGreaterThan(-1);
    expect(stampIdx).toBeGreaterThan(assignIdx);
  });

  it('a stamp failure is isolated — logged and swallowed, never breaking the evaluation pass', () => {
    expect(source).toMatch(/regimeAtStart stamp failed \(ignored, evaluation unaffected\)/);
  });

  it('merge-dark contract: REGIME_STAMP_ENABLED defaults FALSE (flips later with the expansion flag, per founder ruling)', () => {
    expect(REGIME_STAMP_ENABLED).toBe(false);
  });
});

// P2 (League Tournament §1.2) — agent-market exclusivity wiring guards.
//
// REGULAR-BATTLE INVARIANCE is the phase's governing rule: every ledger and
// filter touch in this cron must be tournament-conditional, and the resolver
// must answer "not a tournament battle" from in-memory fields before any
// Firestore access. The behavioral half of that proof lives in
// tournamentAgentLedger.test.js (identity filters, the throwing-db zero-I/O
// test); these static guards lock the CRON's side: the five
// executeSwapServer call sites are each wrapped reserve → execute → confirm
// with a compensating release in their catch, and every insertion is gated
// on tournamentCtx. Same static-source rationale as every block above.
describe('agent-evaluate cron — P2 tournament ledger wiring (agent-market exclusivity)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');
  const ledgerSource = readFileSync(resolve(__dirname, '../_utils/tournamentAgentLedger.js'), 'utf-8');

  it('imports the ledger surface from tournamentAgentLedger.js', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bresolveTournamentContext\b[^}]*\}\s*from\s*'\.\.\/_utils\/tournamentAgentLedger\.js'/s);
    for (const name of ['excludeHeldByOthers', 'excludeHeldSymbols', 'reserveSymbol', 'confirmSwap', 'releaseReservation']) {
      expect(source).toMatch(new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'\\.\\./_utils/tournamentAgentLedger\\.js'`, 's'));
    }
  });

  it('resolves the tournament context exactly once per battle, with the per-invocation group cache', () => {
    const calls = source.match(/await resolveTournamentContext\(db, battle, tournamentGroupCache\)/g) || [];
    expect(calls.length).toBe(1);
    // The cache is created in the handler loop scope and threaded through.
    expect(source).toMatch(/const tournamentGroupCache = new Map\(\);/);
    expect(source).toMatch(/processAgentBattle\(db, battle, summary, startTime, tournamentGroupCache\)/);
  });

  it('THE RESOLVER DISCRIMINATES BEFORE ANY AWAIT — a regular battle costs zero Firestore I/O (P4 contract: gameMode AND groupId stamped together)', () => {
    const fnMatch = ledgerSource.match(/export async function resolveTournamentContext\([\s\S]+?\n\}/);
    expect(fnMatch).not.toBeNull();
    const body = fnMatch[0];
    const firstAwait = body.indexOf('await');
    const gameModeCheck = body.indexOf('battle.gameMode !== TOURNAMENT_GAME_MODE');
    const groupIdCheck = body.indexOf("typeof battle.groupId !== 'string'");
    expect(gameModeCheck).toBeGreaterThan(-1);
    expect(groupIdCheck).toBeGreaterThan(-1);
    expect(gameModeCheck).toBeLessThan(firstAwait);
    expect(groupIdCheck).toBeLessThan(firstAwait);
  });

  it('every one of the 5 executeSwapServer call sites is preceded by the shared phase-1 reserve helper', () => {
    // Find each call site (the import line has no opening paren on the name).
    const sites = [...source.matchAll(/executeSwapServer\(\s*\n?\s*db,/g)].map(m => m.index);
    expect(sites.length).toBe(5);
    for (const idx of sites) {
      const windowBefore = source.slice(Math.max(0, idx - 3000), idx);
      expect(windowBefore).toContain('await reserveTournamentSymbolIn(db, tournamentCtx, battle,');
    }
    // The helper count pins the protocol to exactly the five sites.
    const helperCalls = source.match(/await reserveTournamentSymbolIn\(/g) || [];
    expect(helperCalls.length).toBe(5);
    // Regular-battle contract: the helper performs ZERO ledger I/O and
    // reports success when tournamentCtx is null (sites sail through).
    expect(source).toMatch(/async function reserveTournamentSymbolIn\([\s\S]*?if \(!tournamentCtx\) return \{ reserved: true \};/);
  });

  it('every one of the 5 call sites confirms on success (two-phase, phase 2) and releases in its catch (compensating action)', () => {
    const sites = [...source.matchAll(/executeSwapServer\(\s*\n?\s*db,/g)].map(m => m.index);
    for (const idx of sites) {
      const windowAfter = source.slice(idx, idx + 3000);
      expect(windowAfter).toContain('await confirmTournamentSwap(db, tournamentCtx, battle,');
    }
    const releases = source.match(/await releaseTournamentReservation\(db, tournamentCtx, reservedSymbolIn\);/g) || [];
    expect(releases.length).toBe(5);
    const reserveMarkers = source.match(/let reservedSymbolIn = null;/g) || [];
    expect(reserveMarkers.length).toBe(5);
  });

  it('the confirm helper never rethrows (the swap already executed; reconciliation repairs) and the release helper never masks the original error', () => {
    const confirmFn = source.match(/async function confirmTournamentSwap\([\s\S]+?\n\}/)?.[0] || '';
    expect(confirmFn).toContain('catch (confirmErr)');
    expect(confirmFn).not.toMatch(/throw/);
    const releaseFn = source.match(/async function releaseTournamentReservation\([\s\S]+?\n\}/)?.[0] || '';
    expect(releaseFn).toContain('catch (releaseErr)');
    expect(releaseFn).not.toMatch(/throw/);
  });

  it('candidate pre-filtering is wired at every composition point, all gated on tournamentCtx', () => {
    // The shared in-memory filter covers bench (benchAssets, the gameplan
    // trigger, allBench, findBenchAsset lookups, prompt assembly) AND
    // watchlist.hotBench (Haiku candidate surface + fenced
    // validateTradeDecision's hotBench match).
    const filterFn = source.match(/function applyTournamentCandidateFilter\([\s\S]+?\n\}/)?.[0] || '';
    expect(filterFn).toContain('if (!tournamentCtx) return;');
    expect(filterFn).toContain('excludeHeldByOthers(battle.portfolio.bench.stocks, tournamentCtx.heldByOthers)');
    expect(filterFn).toContain('excludeHeldSymbols(hotBench, tournamentCtx.heldByOthers)');
    // Applied once at the top of every battle…
    expect(source).toMatch(/const tournamentCtx = await resolveTournamentContext\(db, battle, tournamentGroupCache\);\s*\n\s*applyTournamentCandidateFilter\(battle, tournamentCtx\);/);
    // …and re-applied after EVERY battle re-read: the persisted doc is
    // unfiltered, so a raw Object.assign refresh would re-admit rival-held
    // names mid-tick (review finding). refreshBattleFromDoc is the single
    // re-read chokepoint — exactly 9 call sites, zero raw re-assigns left.
    const refreshCalls = source.match(/await refreshBattleFromDoc\(battleRef, battle, tournamentCtx\);/g) || [];
    expect(refreshCalls.length).toBe(9);
    const rawReassigns = source.match(/Object\.assign\(battle, \w+Doc\.data\(\)\)/g) || [];
    expect(rawReassigns.length).toBe(1); // only inside refreshBattleFromDoc itself
    expect(source).toMatch(/async function refreshBattleFromDoc\([\s\S]*?applyTournamentCandidateFilter\(battle, tournamentCtx\);/);
    // hotBench refresh candidates.
    expect(source).toMatch(/candidates = excludeHeldByOthers\(candidates, tournamentCtx\.heldByOthers\);/);
    // Equip-union exclusion set.
    expect(source).toMatch(/\.\.\.\(tournamentCtx \? tournamentCtx\.heldByOthers : \[\]\)/);
    // Synthetic hotBench gate (stale persisted hotBench on non-rebuild ticks).
    expect(source).toMatch(/&& \(!tournamentCtx \|\| !tournamentCtx\.heldByOthers\.has\(stock\.symbol\)\)/);
    // Catalyst additions gate.
    expect(source).toMatch(/&& \(!tournamentCtx \|\| !tournamentCtx\.heldByOthers\.has\(ticker\)\)/);
    // Cross-agent held set into pickSwapReplacementCandidate's heldSymbols.
    expect(source).toMatch(/for \(const heldSymbol of tournamentCtx\.heldByOthers\) heldSymbols\.add\(heldSymbol\);/);
  });

  it('the emptied-pool emergency skip emits the designed feed event (never a silent log), on BOTH battle kinds', () => {
    const skipBlock = source.match(/if \(!replacement\) \{[\s\S]+?\n {6}\}/)?.[0] || '';
    expect(skipBlock).toContain('buildPoolEmptyFeedEntry({');
    expect(skipBlock).toContain('if (tournamentCtx)');
    expect(skipBlock).toMatch(/Wanted out of/);
    // [VWAP Floor B7] Regular battles get their own beat in the else branch.
    expect(skipBlock).toMatch(/\} else \{[\s\S]*?action: 'pool_empty'/);
    expect(skipBlock).toMatch(/\} else \{[\s\S]*?source: 'risk_manager'/);
    // The tournament event shape lives in ONE builder (it cannot drift
    // between its two risk-loop sites).
    const builder = source.match(/function buildPoolEmptyFeedEntry\([\s\S]+?\n\}/)?.[0] || '';
    expect(builder).toContain("action: 'tournament_pool_empty'");
    expect(builder).toContain("source: 'tournament_ledger'");
    const builderCalls = source.match(/buildPoolEmptyFeedEntry\(\{/g) || [];
    expect(builderCalls.length).toBe(3); // definition + the two sites
  });

  it('double-down feed entries carry the spec fields and both event kinds', () => {
    const builder = source.match(/function buildDoubleDownFeedEntry\([\s\S]+?\n\}/)?.[0] || '';
    expect(builder).toContain("'double_down_formed'");
    expect(builder).toContain("'double_down_broken'");
    expect(builder).toContain("source: 'tournament_ledger'");
  });

  it('every confirm sources symbols from the ACTUAL closedTrade (executeSwapServer swaps the slot occupant, not the intent)', () => {
    const confirms = source.match(/closedTrade\?\.symbolOut \|\|/g) || [];
    expect(confirms.length).toBe(5);
  });

  it('REPO-LEVEL: executeSwapServer has no consumers outside the fenced module and this wrapped cron', () => {
    // A new call site anywhere in api/ (a P3 orchestrator, an admin
    // endpoint) would bypass reserve/confirm entirely and reintroduce the
    // duplicate-holder bug class the ledger exists to prevent. Allowed:
    // the fenced definition module, this cron, and their tests (which
    // reference the name in regexes/mocks).
    const allowed = new Set([
      'api/_utils/agentSwapExecution.js',
      'api/_utils/agentSwapExecution.test.js',
      'api/cron/agent-evaluate.js',
      'api/cron/agent-evaluate.test.js',
    ]);
    const apiRoot = resolve(__dirname, '..');
    const offenders = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.js')) continue;
        // Call/definition sites only — comment mentions (risk-manager JSDoc,
        // shadow-logger notes, the ledger module's own header) don't count.
        const hasCallSite = readFileSync(full, 'utf-8')
          .split('\n')
          .some(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
            return trimmed.includes('executeSwapServer(');
          });
        if (!hasCallSite) continue;
        const relPath = 'api/' + relative(apiRoot, full).split(sep).join('/');
        if (!allowed.has(relPath)) offenders.push(relPath);
      }
    };
    walk(apiRoot);
    expect(offenders).toEqual([]);
  });
});

// VWAP Floor Semantics V1 — write-side wiring guards. Same static-source
// rationale as the Knob A/B blocks above: the behavioral load is carried by
// the pure-helper tests in agentVwapFloor.test.js (+ the fenced-change tests
// in agentRiskManager/agentSwapExecution.test.js and the June-11 replay in
// agentVwapFloor.replay.test.js); these guard the cron wiring.
describe('agent-evaluate cron — VWAP floor wiring (A1/B1/B6)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('A1: the freshness gate wraps the momentumData.vwap assignment (stale/thin sessions publish nothing)', () => {
    expect(source).toMatch(/if \(vwapResult && isVwapSessionUsable\(\{ sessionDate, todayET, sessionCandleCount: sessionCandles\.length \}\)\) \{\s*\n\s*const sma20_5m = calculate5minSMA20\(candles\);\s*\n\s*momentumData\.vwap\[symbol\] = \{ \.\.\.vwapResult, sma20_5m, sessionDate \};/);
  });

  it('A2: the tick counter strikes via the dead-band predicate, preset-driven', () => {
    expect(source).toMatch(/if \(vwapInfo && isVwapStrike\(vwapInfo\.vwapDeviation, presetConfig\.risk\.vwapDeadBandPct \?\? 0\.5\)\)/);
  });

  it('B1: all four counter maps are pruned to held symbols after seeding, before the risk loop', () => {
    const seedIdx = source.indexOf('const lastTickTimestamp = { ...(battle.cronState?.lastTickTimestamp || {}) }');
    const pruneIdx = source.indexOf('pruneCounterMaps([vwapTicks, stagnationTicks, lastTickPrice, lastTickTimestamp], new Set(portfolioSymbols))');
    // the counter-update site inside the risk evaluation loop (the earlier
    // thresholdHistory loop also iterates assetScores — anchor past it)
    const riskLoopIdx = source.indexOf('const vwapInfo = momentumData.vwap[score.symbol]');
    expect(seedIdx).toBeGreaterThan(-1);
    expect(pruneIdx).toBeGreaterThan(seedIdx);
    expect(riskLoopIdx).toBeGreaterThan(pruneIdx);
  });

  it('B1b: both LIVE swap sites reset the incoming symbol in-memory counters', () => {
    expect(source).toMatch(/vwapTicks\[replacement\.symbol\] = 0;\s*\n\s*stagnationTicks\[replacement\.symbol\] = 0;/);
    expect(source).toMatch(/vwapTicks\[haikuInSymbol\] = 0;\s*\n\s*stagnationTicks\[haikuInSymbol\] = 0;/);
  });

  it('B3: synthetic hotBench entries exclude actively-held symbols', () => {
    expect(source).toMatch(/&& !activePortfolioSet\.has\(stock\.symbol\)/);
  });

  it('B6: the guard is seeded from cronState with ET rollover and carried by all 5 finalize sites', () => {
    expect(source).toMatch(/const vwapFireGuard = seedVwapFireGuard\(battle\.cronState\?\.vwapFireGuard, todayET\)/);
    const withGuard = source.match(/finalizeCronState\([^;]*?vwapFireGuard \}\)/g) || [];
    expect(withGuard.length).toBe(5);
  });

  it('B6: only vwap_failure fires are counted, live within the tick', () => {
    expect(source).toMatch(/if \(riskResult\.reason === 'vwap_failure'\) vwapFireGuard\.count\+\+;/);
  });

  it('B6: the gating block sits between candidate/slot resolution and the reserve, fail-closed via the memoized qualifier', () => {
    const gateIdx = source.indexOf("riskResult.reason === 'vwap_failure' && vwapFireGuard.count >= VWAP_CASCADE_GUARD_N");
    const reserveIdx = source.indexOf('const reservation = await reserveTournamentSymbolIn(db, tournamentCtx, battle, replacement.symbol)');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(reserveIdx).toBeGreaterThan(gateIdx);
    const gateBlock = source.slice(gateIdx, reserveIdx);
    expect(gateBlock).toContain('await qualifyCascadeReplacement(replacement.symbol');
    expect(gateBlock).toContain("action: 'cascade_guard_hold'");
    expect(gateBlock).toContain('continue;');
    // the qualifier itself fails closed and is memoized + time-bounded
    const qualifier = source.match(/async function qualifyCascadeReplacement\([\s\S]+?\n\}/)?.[0] || '';
    expect(qualifier).toContain('memo.has(symbol)');
    expect(qualifier).toContain('CASCADE_QUALIFY_TIMEOUT_MS');
    expect(qualifier).toContain('qualified = false');
  });

  it('B7: the risk-loop catch pushes a feed beat (throwing candidates are never silent)', () => {
    expect(source).toMatch(/Risk swap failed for[\s\S]{0,800}?action: 'risk_swap_failed'/);
  });
});

// Release 2 PR-b — Gate 7-style structural locks for the tempo-dial wiring.
// The receipt locks above stay byte-untouched (site-4 NO-EDIT amendment);
// these pin the SIBLING pattern so provenance can never migrate INTO the
// receipt call or lose a swap origin path.
describe('agent-evaluate cron — Release 2 tempo-dial wiring (structural)', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('the clamp wraps the mode-resolution seam (desired via the ONE snapshot accessor, flag at the call site)', () => {
    expect(source).toMatch(/clampHftConfig\(\{\s*hftConfig: resolveHftConfig\(baseArchetypeConfig, battle\.gameMode\),\s*desiredTempo: desiredTempoOf\(battle\),\s*dialEnabled: TEMPO_DIAL_ENABLED,/);
    expect(source).toMatch(/hftConfig: dialClamp\.hftConfig,/);
    // Both cron read sites resolve the desired tempo through desiredTempoOf —
    // never a raw path that could drift from the snapshot shape. The negative
    // lock bans EVERY spelling of a direct dials read (`.dials` anywhere),
    // not just the optional-chained one (/code-review Phase-5: a non-chained
    // or destructured read evaded the old regex).
    expect((source.match(/desiredTempoOf\(battle\)/g) || []).length).toBe(2);
    expect(source).not.toMatch(/\.dials\b/);
  });

  it('stamps the §14 provenance SIBLING at all 4 swap origin paths — origin-path receipt spreads untouched', () => {
    const provenanceSpreads = source.match(/\.\.\.buildSwapProvenance\(/g) || [];
    expect(provenanceSpreads.length).toBe(4);
    // Corpus Capture Patch W2: total receiptSource spreads are now 6 (4 origin
    // paths + 2 flag-#4 fallback syntheses — see the Gate-7 test). The dial
    // provenance sibling deliberately does NOT ride the fallback syntheses
    // (they are metadata-absent emergency shims, not dial-resolved decisions),
    // so its count stays 4.
    const receiptSpreads = source.match(/\.\.\.buildSwapReceiptSource\(\{/g) || [];
    expect(receiptSpreads.length).toBe(6);
  });

  it('the epoch telemetry event carries the clamp provenance (desired-vs-effective rides the same record)', () => {
    expect(source).toMatch(/dialProvenance: dialClamp\.provenance,/);
  });

  it('the epoch GLUE threads the full mode tuple + pre-gated directive + deploy metadata into the orchestrator (PR-f lock)', () => {
    // The orchestrator itself is unit-tested; this pins the cron's WIRING to
    // it — a dropped mode flag, an un-gated directive, or lost deploy
    // metadata here would be invisible to every behavioral test.
    expect(source).toMatch(
      /recordControlEpochIfNeeded\(\{\s*battleRef,\s*battle,\s*arrayUnion: FieldValue\.arrayUnion,\s*modes: \{\s*archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,\s*standingLeansEnabled: STANDING_LEANS_ENABLED,\s*tempoDialEnabled: TEMPO_DIAL_ENABLED,\s*\},\s*resolveControls,\s*directive: isDirectiveActive\(battle\?\.directive, battle\) \? battle\.directive : null,\s*dialProvenance: dialClamp\.provenance,\s*deploySha: globalThis\.process\?\.env\?\.VERCEL_GIT_COMMIT_SHA \|\| null,\s*knobConfigVersion: KNOB_CONFIG_VERSION,\s*dialBandVersion: TEMPO_DIAL_BANDS\.forKnobConfigVersion,\s*\}\);/,
    );
  });
});
