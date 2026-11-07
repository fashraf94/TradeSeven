// api/_utils/activationEvidence/constants.test.js
//
// ID-1 Build 2 — the named limits (build prompt V3 §3), and the two store
// constants restated here (so the census can stay off the store's write-capable
// modules) pinned to the store's own.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as C from './constants.js';
import { ACQUIRE_TIMEOUT_MS } from '../setupEvidence/acquire.js';
import { LEASE_MS } from '../setupEvidence/store.js';
import { ACQUISITION_FAILURES } from '../setupEvidence/classify.js';
import { buildPointer } from './pointer.js';
import { discoverActivations } from './discover.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { legacyBattle } from './__fixtures__/activationBattles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sourceOf = (rel) => readFileSync(resolve(HERE, rel), 'utf8');

describe('the census\'s label lists (review 5) and the pointer field set', () => {
  it('the acquisition failures the store can return are all on the missing.detail list', () => {
    for (const f of Object.values(ACQUISITION_FAILURES)) expect(C.MISSING_DETAILS).toContain(f);
  });
  // Review PFB-6: a new retryable reason must be added to the list, or the census would read it as `other` unnoticed.
  it('every other reason the store can return as retryable is on the list: the classification\'s cases and the adapter\'s split-check reasons', () => {
    const classify = sourceOf('../setupEvidence/classify.js');
    // Every case of classifyEvidence can return a retryable or a confirm (retryable until confirmed), except basis_discontinuity (final only).
    const cases = [...classify.matchAll(/^\s*case '([A-Za-z_]+)':/gm)].map((m) => m[1]).filter((c) => c !== 'basis_discontinuity');
    expect(cases).toContain('missing_bar');
    const split = sourceOf('../setupEvaluator/dailyBarsAdapter.js').split('\n').filter((l) => /splitCheckReason = /.test(l))
      .flatMap((l) => [...l.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    expect(split).toEqual(expect.arrayContaining(['adjustment_metadata_absent', 'adjusted_close_missing', 'adjusted_close_nonpositive']));
    const okLine = [...classify.matchAll(/splitCheckReason \?\? '([a-z_]+)'/g)].map((m) => m[1]);
    expect(okLine).toEqual(['adjustment_metadata_absent']);
    for (const r of [...cases, ...split, ...okLine]) expect([r, C.MISSING_DETAILS.includes(r)]).toEqual([r, true]);
  });
  it('the pointer field set is exactly what buildPointer writes, and the ACTIVATED_AT_SOURCES and kinds are the discoverable ones', () => {
    const b = legacyBattle();
    const a = discoverActivations(b).activations[0];
    const p = buildPointer({ battle: b, battleId: 'b', activation: a, session: '2026-11-04', attribution: { attributionAgentId: 'agent-1', attributionStatus: 'resolved' }, ruleSet: describeRuleSet(), evidence: null, missingDetail: 'missing_bar', observedAt: '2026-11-05T15:00:00.000Z' });
    expect(Object.keys(p)).toEqual([...C.POINTER_FIELD_SET]);
    expect(C.POINTER_KINDS).toContain(a.kind);
    expect(C.ACTIVATED_AT_SOURCES).toContain(a.activatedAtSource);
  });
});

describe('the named limits', () => {
  it('are the prompt\'s values', () => {
    expect({
      OBSERVER_SLICE_MS: C.OBSERVER_SLICE_MS, OBSERVER_ADMISSION_CEILING_MS: C.OBSERVER_ADMISSION_CEILING_MS, MIN_RUN_MS: C.MIN_RUN_MS,
      PREP_BUDGET_MS: C.PREP_BUDGET_MS, ADMISSION_RESERVE_MS: C.ADMISSION_RESERVE_MS, POINTER_WRITE_RESERVE_MS: C.POINTER_WRITE_RESERVE_MS,
      STATE_WRITE_RESERVE_MS: C.STATE_WRITE_RESERVE_MS, ACQUISITION_CONCURRENCY: C.ACQUISITION_CONCURRENCY, MAX_ACQUISITIONS_PER_RUN: C.MAX_ACQUISITIONS_PER_RUN,
      MAX_CANDIDATE_IDS_PER_OWNER: C.MAX_CANDIDATE_IDS_PER_OWNER, MAX_BATTLES_PER_RUN: C.MAX_BATTLES_PER_RUN, MAX_TICK_DOCS_PER_BATTLE: C.MAX_TICK_DOCS_PER_BATTLE,
      MAX_POINTER_WRITES_PER_RUN: C.MAX_POINTER_WRITES_PER_RUN, MAX_CARRIED_KEYS: C.MAX_CARRIED_KEYS, CANDIDATE_LOOKBACK_DAYS: C.CANDIDATE_LOOKBACK_DAYS,
      CATCH_UP_HORIZON_DAYS: C.CATCH_UP_HORIZON_DAYS, TICK_GRACE_MS: C.TICK_GRACE_MS,
    }).toEqual({
      OBSERVER_SLICE_MS: 20_000, OBSERVER_ADMISSION_CEILING_MS: 80_000, MIN_RUN_MS: 15_000, PREP_BUDGET_MS: 6_000, ADMISSION_RESERVE_MS: 7_000,
      POINTER_WRITE_RESERVE_MS: 2_000, STATE_WRITE_RESERVE_MS: 1_000, ACQUISITION_CONCURRENCY: 3, MAX_ACQUISITIONS_PER_RUN: 12,
      MAX_CANDIDATE_IDS_PER_OWNER: 200, MAX_BATTLES_PER_RUN: 25, MAX_TICK_DOCS_PER_BATTLE: 400, MAX_POINTER_WRITES_PER_RUN: 30,
      MAX_CARRIED_KEYS: 50, CANDIDATE_LOOKBACK_DAYS: 14, CATCH_UP_HORIZON_DAYS: 3, TICK_GRACE_MS: 1_800_000,
    });
  });
  it('the admission reserve is the store\'s provider timeout + 2 s, and the restated store constants equal the store\'s own', () => {
    expect(C.STORE_ACQUIRE_TIMEOUT_MS).toBe(ACQUIRE_TIMEOUT_MS);
    expect(C.ADMISSION_RESERVE_MS).toBe(ACQUIRE_TIMEOUT_MS + 2_000);
    expect(C.STORE_LEASE_MS).toBe(LEASE_MS);
  });
  it('with the full slice, preparation ends by 6 s and acquisitions may start until 13 s: at least two waves of three', () => {
    const lastStart = C.OBSERVER_SLICE_MS - C.ADMISSION_RESERVE_MS;
    expect(lastStart).toBe(13_000);
    expect(lastStart - C.PREP_BUDGET_MS).toBeGreaterThanOrEqual(C.STORE_ACQUIRE_TIMEOUT_MS); // a first wave can finish and a second start
    expect(C.MIN_RUN_MS).toBeGreaterThan(C.PREP_BUDGET_MS + C.ADMISSION_RESERVE_MS - 1); // a run that starts at all keeps time to acquire
  });
});
