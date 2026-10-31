// api/_utils/setupEvidence/store.test.js
//
// ID-1 Build 1 — the contract's two numbers, in the ordinary suite: every emulator
// row imports these constants, so a changed value would move the rows with it. The
// protocol itself is proven on the emulator (test/rules/setupEvidenceStore.rules.mjs).

import { describe, it, expect } from 'vitest';
import { CONFIRM_AFTER_MS, LEASE_MS } from './store.js';

describe('the store\'s numbers (shape note V1.4 §3)', () => {
  it('the lease is 120 seconds', () => {
    expect(LEASE_MS).toBe(120_000);
  });
  it('a confirmation takes a separate fetch at least 30 minutes after the first', () => {
    expect(CONFIRM_AFTER_MS).toBe(1_800_000);
  });
});
