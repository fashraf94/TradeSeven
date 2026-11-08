// api/_utils/setupMenuLabels/constants.test.js
//
// Slice 2 — the restated numbers and the mirrored lists, pinned to their sources: the store's own
// constants (setupEvidence/acquire.js, store.js), the capture's closed lists (captureConfig.js) and the
// serializer's registry (captureSerializer.js ENUM_LISTS), and the observer's list of every reason the
// store can return with `retryable`.

import { describe, it, expect } from 'vitest';
import { ACQUIRE_TIMEOUT_MS, SNAPSHOT_SCHEMA_VERSION as STORE_SNAPSHOT_SCHEMA_VERSION } from '../setupEvidence/acquire.js';
import { CONFIRM_AFTER_MS, LEASE_MS } from '../setupEvidence/store.js';
import { ACQUISITION_FAILURES } from '../setupEvidence/classify.js';
import * as capture from '../tickCapture/captureConfig.js';
import { ENUM_LISTS } from '../tickCapture/captureSerializer.js';
import { MISSING_DETAILS } from '../activationEvidence/constants.js';
import * as C from './constants.js';

describe('the store\'s numbers, restated and pinned', () => {
  it('provider timeout, lease and confirmation interval equal the store\'s own', () => {
    expect(C.STORE_ACQUIRE_TIMEOUT_MS).toBe(ACQUIRE_TIMEOUT_MS);
    expect(C.STORE_LEASE_MS).toBe(LEASE_MS);
    expect(C.STORE_CONFIRM_AFTER_MS).toBe(CONFIRM_AFTER_MS);
    expect(C.SNAPSHOT_SCHEMA_VERSION).toBe(STORE_SNAPSHOT_SCHEMA_VERSION);
  });
  it('the in-flight period is the store\'s lease, the admission reserve covers one provider read plus 2 s, and recovery waits out the confirmation interval plus its margin', () => {
    expect(C.IN_FLIGHT_MS).toBe(LEASE_MS);
    expect(C.ADMISSION_RESERVE_MS).toBe(ACQUIRE_TIMEOUT_MS + 2_000);
    expect(C.RECOVERY_DUE_MS).toBe(CONFIRM_AFTER_MS + C.CONFIRM_MARGIN_MS);
    expect(C.RECOVERY_DUE_MS).toBe(31 * 60_000);
  });
});

describe('the spec\'s limits (V2 §4–§6, amended)', () => {
  it('48 candidates, 24 KiB, a 3 s read deadline, 5 reads in flight, 240 reads a run', () => {
    expect([C.SETUP_MENU_MAX_CANDIDATES, C.SETUP_MENU_MAX_BYTES, C.LABEL_READ_DEADLINE_MS, C.LABEL_READ_CONCURRENCY, C.LABEL_READS_PER_RUN_MAX])
      .toEqual([48, 24 * 1024, 3_000, 5, 240]);
  });
  it('the tenant: 20 s slice, 100 s ceiling, 15 s minimum, 6 s preparation, 12 calls, 3 at once, 10/25 battles, 3 reservations, 400 keys', () => {
    expect([C.TENANT_SLICE_MS, C.TENANT_ADMISSION_CEILING_MS, C.MIN_RUN_MS, C.PREP_BUDGET_MS, C.MAX_ACQUISITIONS_PER_RUN, C.ACQUISITION_CONCURRENCY,
      C.MAX_BATTLES_PER_OWNER_PER_RUN, C.MAX_BATTLES_PER_RUN, C.MAX_RESERVATIONS_PER_KEY_PER_SESSION, C.STATE_MAX_KEYS])
      .toEqual([20_000, 100_000, 15_000, 6_000, 12, 3, 10, 25, 3, 400]);
  });
});

describe('the record\'s closed lists: one vocabulary, mirrored in captureConfig.js and registered with the serializer', () => {
  const NAMES = ['SETUP_MENU_BLOCK_STATUSES', 'SETUP_MENU_SELECTORS', 'SETUP_MENU_SOURCES', 'SETUP_LABEL_STATUSES', 'SETUP_VERDICTS',
    'SETUP_PATTERNS', 'SETUP_REGIMES', 'SETUP_BARS_CLASSES', 'SETUP_SNAPSHOT_STATUSES', 'SETUP_S2_OUTCOMES'];
  it.each(NAMES.map((n) => [n]))('%s is equal in both modules and registered in ENUM_LISTS', (name) => {
    expect(capture[name]).toEqual(C[name]);
    expect(ENUM_LISTS[name]).toBe(capture[name]);
  });
  it('the state\'s outcomes are the record\'s s2 outcomes', () => {
    expect(C.SETUP_S2_OUTCOMES).toEqual(C.STATE_OUTCOMES);
  });
});

describe('the typed reasons (Correction D.3)', () => {
  it('the state may store every reason the store can return with `retryable` (the observer\'s list), plus `other`', () => {
    expect(C.STATE_REASONS).toEqual([...MISSING_DETAILS, 'other']);
    for (const f of Object.values(ACQUISITION_FAILURES)) expect(C.STATE_REASONS).toContain(f);
  });
  it('every transient reason is a storable reason', () => {
    for (const r of C.TRANSIENT_REASONS) expect(C.STATE_REASONS).toContain(r);
  });
});
