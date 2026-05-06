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
