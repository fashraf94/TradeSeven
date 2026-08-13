// api/_utils/mandateMoneyRounding.scan.test.js
//
// Spec 1 P5 — the MONEY-PATH ROUNDING SCAN (the P4 pattern-killer). MONEY-7
// (P3) and MONEY-P4-3 were the SAME defect twice: a private half-up rounding
// helper (`Math.round(x*100)/100`) on the mandate ledger, a second rounding
// regime beside the canonical banker's `roundUsd`/`roundShares`
// (mandateRounding.js). This scan ends the class STRUCTURALLY: over the
// transitive import closure of every mandate money entrypoint (eval/close,
// rollover, escape, drain — the same closure walker as the sole-importer
// scans), any raw `Math.round`/`.toFixed(`/`Math.floor`/`Math.ceil` occurrence
// must either come from mandateRounding.js itself or be pinned in the
// per-file baseline below with a reviewed classification. A NEW raw-rounding
// site fails with an actionable message pointing at mandateRounding.
//
// The baseline is COUNT-pinned per file (the motion-guard idiom, BUILD_RULES
// §11): adding a site to an already-listed file fails too — the ratchet
// tightens in both directions (removing a site without pruning fails stale).
//
// CLASSIFICATIONS in the baseline: display (alert/prompt text formatting,
// never stored money), calendar (minute geometry), estimate (token budget),
// clamp (integer conviction score), counter (quota thresholds), and the two
// DELIBERATE money-adjacent sites — floorShares (§4.1: shares FLOOR so a BUY
// can never overspend; directional by design, not banker's) and
// mandateRounding.js itself (the canonical home, excluded from the scan).
//
// SCOPE BOUNDARY (stated, reviewed): the scan covers MANDATE-OWNED modules on
// the closure (api/_utils/mandate*, api/cron/mandate*, api/mandate/*, plus the
// mandate-family modelPriceTable.js). Shared platform modules the closure also
// reaches (technicalCalculations, marketDataCache, marketSchedule, rateLimit,
// serverCache, fenced archetype config read-only) round THEIR OWN domain
// values — indicators, cache TTLs, HTTP limits — which the mandate ledger
// never stores; pinning their counts here would cross-couple unrelated suites
// (the P2 prompt-registry ruling's exact rejection). The defect class this
// kills lived in mandate modules both times; every mandate money FIELD write
// flows through the scanned §3.5/§3.6/§5.3/§5.4 boundaries. Residual: a shared
// module writing book money directly would evade this scan — and be caught by
// the protected-store scan's write-site review instead.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evalPathClosure, REPO_ROOT } from './__fixtures__/mandateEvalPathClosure.js';

// Every mandate money entrypoint (routes whose closure can move book money).
const ENTRYPOINTS = [
  'api/cron/mandate-evaluate.js',   // eval + close sweeps (+ P5 batch transport)
  'api/cron/mandate-rollover.js',   // P4 rollover
  'api/mandate/escape.js',          // P4 escape
  'api/mandate/drain.js',           // P5 drain
  'api/mandate/create.js',          // creation (seeds capital)
  'api/mandate/accelerate.js',      // founder harness (drives the real cores)
];
// The canonical rounding home — the ONE module allowed to roll its own.
const ROUNDING_HOME = 'api/_utils/mandateRounding.js';

// file → { count, note }. A raw-rounding occurrence is one regex match; every
// listed site was READ and classified in the P5 review. New/changed counts fail.
const BASELINE = {
  'api/_utils/mandateClosePass.js': {
    count: 4,
    note: 'display: toFixed in MANDATE_SUSPECTED_CA / MANDATE_LIVENESS_LOW / MANDATE_RUNRATE_EXCEEDED alert strings (the run-rate line formats both sides of the comparison) — formatting of already-computed values, never stored money',
  },
  'api/_utils/mandateContextBlock.js': {
    count: 1,
    note: 'display: pct() prompt-text formatter (context block) — the book context renders percentages; stored values untouched',
  },
  'api/_utils/mandatePromptAssembly.js': {
    count: 4,
    note: 'display + estimate + calendar: fmtUsd/pct prompt formatters (2× toFixed), estimateTokens Math.ceil (§6.3 pre-send budget), daysIntoQuarter Math.floor (calendar arithmetic)',
  },
  'api/_utils/mandateDecisionTool.js': {
    count: 1,
    note: 'clamp: conviction Math.round to an integer 0–100 score — not money',
  },
  'api/_utils/mandateExecution.js': {
    count: 1,
    note: 'DELIBERATE money rounding (§4.1): floorShares — shares are FLOORED to 6dp so a BUY can never overspend its sized dollars; directional by design, documented at the site; banker\'s rounding would defeat the guarantee',
  },
  'api/_utils/mandateSessionSlots.js': {
    count: 1,
    note: 'calendar: midday slot minute Math.round — slot geometry, not money',
  },
  'api/_utils/mandateUniverseSnapshot.js': {
    count: 2,
    note: 'counter: upstream-quota threshold Math.floor + alert-percentage Math.round — quota accounting, not book money',
  },
  'api/_utils/mandateBatchTransport.js': {
    count: 2,
    note: 'display: Math.round on turnaround/harvest-lag SECONDS in the I9 log line — latency telemetry formatting, not money',
  },
};

const RAW_ROUNDING = /Math\.round\s*\(|Math\.floor\s*\(|Math\.ceil\s*\(|\.toFixed\s*\(/g;

describe('P5 — money-path rounding scan (the MONEY-7 / MONEY-P4-3 class killer)', () => {
  // One closure over all entrypoints; the rounding home is excluded (canonical).
  const closure = new Set();
  for (const entry of ENTRYPOINTS) {
    for (const rel of evalPathClosure(entry)) closure.add(rel);
  }

  it('the closure is real (self-check): it reaches the execution boundary and the batch transport', () => {
    expect(closure.has('api/_utils/mandateExecution.js')).toBe(true);
    expect(closure.has('api/_utils/mandateBatchTransport.js')).toBe(true);
    expect(closure.has(ROUNDING_HOME)).toBe(true);
    expect(closure.size).toBeGreaterThan(15);
  });

  const MANDATE_OWNED = /^api\/(_utils\/(mandate|modelPriceTable)|cron\/mandate|mandate\/)/;

  it('every raw-rounding occurrence on the money path is either mandateRounding.js or baseline-pinned at its reviewed count', () => {
    const found = {};
    for (const rel of closure) {
      if (!MANDATE_OWNED.test(rel)) continue;         // scope boundary (header)
      if (rel === ROUNDING_HOME) continue;            // the canonical home
      if (rel.endsWith('.test.js')) continue;
      const src = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
      const n = (src.match(RAW_ROUNDING) || []).length;
      if (n > 0) found[rel] = n;
    }

    const unlisted = Object.keys(found).filter((f) => !BASELINE[f]).sort();
    expect(
      unlisted.map((f) => `${f} (${found[f]} raw-rounding site${found[f] === 1 ? '' : 's'})`),
      'NEW raw rounding on the mandate money path — use roundUsd/roundShares/bankersRound from mandateRounding.js '
      + '(one ledger, one rounding regime, §4.1); a genuinely non-money site (display/calendar/clamp) is added to '
      + 'the BASELINE in this file with a reviewed note, in the same PR',
    ).toEqual([]);

    const drifted = Object.keys(found)
      .filter((f) => BASELINE[f] && found[f] !== BASELINE[f].count)
      .map((f) => `${f}: found ${found[f]}, pinned ${BASELINE[f].count}`)
      .sort();
    expect(
      drifted,
      'raw-rounding COUNT drifted inside a baselined file — re-review the file and re-pin (or route the new site through mandateRounding.js)',
    ).toEqual([]);

    const stale = Object.keys(BASELINE).filter((f) => !found[f]).sort();
    expect(
      stale,
      'stale baseline entries (file no longer on the path or sites removed) — prune them so the ratchet stays tight',
    ).toEqual([]);
  });

  it('the canonical home itself uses raw rounding (the invariant is not vacuous)', () => {
    const src = readFileSync(resolve(REPO_ROOT, ROUNDING_HOME), 'utf-8');
    expect((src.match(RAW_ROUNDING) || []).length).toBeGreaterThan(0);
  });
});
