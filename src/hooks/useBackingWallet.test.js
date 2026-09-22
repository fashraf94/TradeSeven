// src/hooks/useBackingWallet.test.js
//
// Backing Beta PR 4 — the allowance the wallet hook derives (the server's rule,
// backingWallet.js ensureAllowance, mirrored): the doc's remainder when it is
// granted for THIS week; the full allowance when the doc sits on another week
// or does not exist yet (the next stake grants it); and UNKNOWN — null — when
// there is no week to bind to yet (R-A-3 in the PR 4 review record: a known
// wallet with a remainder must never read 1,000 while the pod list resolves).

import { describe, it, expect, vi } from 'vitest';

// The hook's service import reaches the env-gated Firebase client; the pure
// helper under test needs none of it.
vi.mock('../services/backingService', () => ({ subscribeWallet: () => () => {} }));
import { ALLOWANCE_BP } from '../constants/backing';
import { allowanceLeft } from './useBackingWallet';

describe('allowanceLeft', () => {
  const doc = { lastAllowanceWeek: '2026-W40', allowanceRemaining: 200 };

  it('the doc’s remainder when it is granted for this week', () => {
    expect(allowanceLeft(doc, '2026-W40')).toBe(200);
    expect(allowanceLeft({ ...doc, allowanceRemaining: 0 }, '2026-W40')).toBe(0);
  });

  it('the full allowance when the doc sits on another week, or does not exist yet', () => {
    expect(allowanceLeft(doc, '2026-W41')).toBe(ALLOWANCE_BP);
    expect(allowanceLeft(null, '2026-W41')).toBe(ALLOWANCE_BP);
  });

  it('UNKNOWN (null) when there is no week to bind to — never the full allowance (R-A-3)', () => {
    expect(allowanceLeft(doc, null)).toBeNull();
    expect(allowanceLeft(doc, '')).toBeNull();
    expect(allowanceLeft(null, undefined)).toBeNull();
  });
});
