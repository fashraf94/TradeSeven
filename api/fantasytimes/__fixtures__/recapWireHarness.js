// api/fantasytimes/__fixtures__/recapWireHarness.js
// Shared harness for the Doug earnings-recap + Neta econ-recap handler suites
// now that WIRE_WRITES_ENABLED is LIVE (PR #763).
//
// Before the flip these suites ran against a bespoke fake db that implemented
// only the writes-OFF Firestore surface (`.add()`), so they never exercised the
// real publishStoryWithWire write-through. With writes live in production, the
// handlers take the batch + transaction path (envelope → day-doc entry →
// receipt → chain → finalize). This harness wraps the canonical wire-capable
// fake (wireFirestoreFake) and a PASSED agentFacts payload so these seams cover
// the path production actually runs — they feed the gate corpus, so the wire
// entries they write are the coverage that matters. (Writes-flip triage,
// 2026-08-15; BUILD_RULES §2 flag-flip rule.)

import { createFirestoreFake } from '../../_utils/__fixtures__/wireFirestoreFake.js';

// Wire-flag state for these suites: writes LIVE (production truth), everything
// else off so the suite is isolated from unrelated runway flips. Each suite
// installs this via `vi.mock('../_utils/wireFlags.js', ...)`; wireFlags is read
// by BOTH the handler and wireWriteThrough, so one mock covers both.
export const WIRE_FLAGS_WRITES_ON = {
  metricsEnabled: false,
  writesEnabled: true,
  continuityEnabled: false,
  newslineEnabled: false,
  editorialEnabled: false,
};

// A valid earnings_recap agentFacts payload that validateAgentFacts projects to
// PASSED — the shape a real model emits under the extended tool. tickers track
// the story symbol so the persisted wire entry is honest (right ticker in the
// gate corpus). Mirrors the canonical `goodFacts()` in wireWriteThrough.test.js.
export function validEarningsFacts(symbol) {
  return {
    eventType: 'earnings_recap',
    tickers: [symbol],
    direction: 'up',
    magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
    figures: [{ value: 5.2, unit: 'pct', basis: 'gap_vs_prior_close' }],
    qualifiers: ['guidance_raised'],
  };
}

// Seed prior stories with EXPLICIT ids (`seed-*`) so they never consume the
// auto-id counter the handler's per-story `.doc()` pre-allocation relies on —
// `writtenStories()` can then isolate stories written during the run.
export function makeWireDb(existingStories = []) {
  const db = createFirestoreFake();
  existingStories.forEach((s, i) => {
    db.collection('fantasyTimesStories').doc(`seed-${i}`).set(s);
  });
  return db;
}

// Stories persisted during the run (auto-* ids), in write order — the
// writes-ON replacement for the old `added` array. Each has the full storyDoc
// plus wireValidation + wirePending:false (post-finalize).
export function writtenStories(db) {
  return Object.entries(db._dump())
    .filter(([k]) => k.startsWith('fantasyTimesStories/auto-'))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) // auto-0001 < auto-0002 …
    .map(([, doc]) => doc);
}

// The day doc ({ entries, receipts, bySymbol, … }) or null if none was written.
export function wireDay(db) {
  const hit = Object.entries(db._dump()).find(([k]) => k.startsWith('fantasyTimesWire/'));
  return hit ? hit[1] : null;
}

// Install a wireModelCall mock that returns a valid extended-tool response,
// deriving the symbol from the prompt's `Company: <symbol>` line so multi-story
// firings get per-symbol facts. `symbolFor` overrides extraction when a suite's
// prompt carries a company NAME rather than the ticker.
export function stubRecapModel(wireModelCall, { seam = 'doug_earnings_recap', symbolFor } = {}) {
  wireModelCall.mockImplementation(async (_executionConfig, req) => {
    const content = req?.messages?.[0]?.content || '';
    // The recap prompt opens with `EARNINGS RESULT: <symbol>` (the ticker) —
    // authoritative even when a `Company:` line carries a display name.
    const symbol = (symbolFor && symbolFor(content))
      || (/EARNINGS RESULT:\s*([A-Za-z0-9.-]+)/.exec(content)?.[1])
      || (/Company:\s*([A-Za-z0-9.-]+)/.exec(content)?.[1])
      || 'NVDA';
    return {
      response: {
        content: [{
          type: 'tool_use',
          input: {
            headline: 'H', subheadline: 'S', body: 'B', themes: [],
            sentiment: 'neutral', recommended_action: 'EARNINGSGAME',
            agentFacts: validEarningsFacts(symbol),
          },
        }],
        stop_reason: 'tool_use',
      },
      generationConfig: { seam },
    };
  });
}
