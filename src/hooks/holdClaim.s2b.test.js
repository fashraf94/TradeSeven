// src/hooks/holdClaim.s2b.test.js
//
// Command Center slice S2b, ruling R-S2b-3 (spec §5.5) — the hub's claim names
// its input and the provider's hold epoch: claimHold(controlId, inputId,
// holdEpoch). The same one slot and the same denial; a malformed input or epoch
// grants nothing; the copy currentHold() returns carries both. claimHold(controlId)
// — today's shells — is unchanged (holdClaim.test.js, unmodified).

import { describe, it, expect, beforeEach } from 'vitest';
import { claimHold, commitHold, currentHold, releaseHold, __resetHoldClaim } from './holdClaim';

beforeEach(() => { __resetHoldClaim(); });

describe('claimHold(controlId, inputId, holdEpoch)', () => {
  it('an empty slot grants a token; the copy names the input and the epoch, through commit', () => {
    const token = claimHold('hub-deploy-card', 'pointer:7', 3);
    expect(currentHold()).toEqual({ controlId: 'hub-deploy-card', holdToken: token, phase: 'charging', inputId: 'pointer:7', holdEpoch: 3 });
    expect(commitHold(token)).toBe(true);
    expect(currentHold()).toEqual({ controlId: 'hub-deploy-card', holdToken: token, phase: 'locked', inputId: 'pointer:7', holdEpoch: 3 });
    expect(Object.isFrozen(currentHold())).toBe(true);
  });

  it('only an empty slot grants — a second input on the same control is denied like any other', () => {
    const token = claimHold('hub-deploy-card', 'pointer:1', 1);
    expect(claimHold('hub-deploy-card', 'pointer:2', 2)).toBeNull();
    expect(claimHold('hub-deploy-card', 'key', 2)).toBeNull();
    expect(claimHold('hub-deploy-strip', 'pointer:1', 2)).toBeNull();
    expect(claimHold('legacy')).toBeNull();
    expect(currentHold().holdToken).toBe(token);
  });

  it('a malformed input or epoch grants nothing and leaves the slot empty (fails closed)', () => {
    for (const [input, epoch] of [[undefined, 1], ['', 1], [7, 1], ['key', -1], ['key', 1.5], ['key', '1'], ['key', undefined], ['key', null]]) {
      expect(claimHold('hub-deploy-card', input, epoch), `${input}/${epoch}`).toBeNull();
      expect(currentHold()).toBeNull();
    }
  });

  it('the legacy one-argument claim is unchanged: no input, no epoch on its copy', () => {
    const token = claimHold('legacy');
    expect(currentHold()).toEqual({ controlId: 'legacy', holdToken: token, phase: 'charging' });
    expect(Object.hasOwn(currentHold(), 'inputId')).toBe(false);
    releaseHold(token);
    expect(currentHold()).toBeNull();
  });

  it('tokens stay unique across both forms', () => {
    const a = claimHold('legacy');
    releaseHold(a);
    const b = claimHold('hub-deploy-card', 'key', 1);
    expect(b).not.toBe(a);
  });
});
