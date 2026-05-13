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
//   3. The dotted-path / object-literal forms drifting apart
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

describe('agent-evaluate cron — Phase 3 intraday momentum persistence', () => {
  const source = readFileSync(SOURCE_PATH, 'utf-8');

  it('writes cronState.intradayMomentum at every flush site that writes cronState.vwapTicks', () => {
    // Both fields are populated from the same `momentumData.vwap` table on
    // every cron pass. They must flush together — if one is written without
    // the other, the read side (voice-layer-cache) sees stale or asymmetric
    // state. Counts must match exactly.
    const dottedFormVwap = source.match(/scoreUpdate\['cronState\.vwapTicks'\] = vwapTicks;/g) || [];
    const dottedFormIntraday = source.match(/scoreUpdate\['cronState\.intradayMomentum'\] = momentumData\.vwap;/g) || [];

    const literalFormVwap = source.match(/'cronState\.vwapTicks':\s*vwapTicks,/g) || [];
    const literalFormIntraday = source.match(/'cronState\.intradayMomentum':\s*momentumData\.vwap,/g) || [];

    expect(dottedFormVwap.length).toBe(dottedFormIntraday.length);
    expect(literalFormVwap.length).toBe(literalFormIntraday.length);
  });

  it('flushes intradayMomentum at exactly 5 sites (4 dotted-path + 1 object-literal — matches discovery report)', () => {
    const dottedForm = source.match(/scoreUpdate\['cronState\.intradayMomentum'\] = momentumData\.vwap;/g) || [];
    const literalForm = source.match(/'cronState\.intradayMomentum':\s*momentumData\.vwap,/g) || [];

    expect(dottedForm.length).toBe(4);
    expect(literalForm.length).toBe(1);
    expect(dottedForm.length + literalForm.length).toBe(5);
  });

  it('persists momentumData.vwap verbatim — no transformation, no field renaming (passthrough contract)', () => {
    // Phase 3 contract: the persisted shape on cronState.intradayMomentum is
    // identical to the in-memory momentumData.vwap shape. Phase 5 rendering
    // (deferred) will consume the same shape on the read side.
    const transformingForms = [
      /cronState\.intradayMomentum'\] =\s*\{/,            // wrapping in {}
      /cronState\.intradayMomentum'\] =\s*momentumData\.vwap\.\w+/,  // sub-keying
      /cronState\.intradayMomentum'\] =\s*Object\./,       // Object.fromEntries / mapping
      /cronState\.intradayMomentum'\] =\s*JSON\.\w+/,      // JSON serialization
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
