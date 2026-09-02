// @vitest-environment jsdom
//
// src/config/battleViewControllerAccessor.test.jsx
//
// Review finding T4: the founder's only smoke door — `?battleViewController=1`
// on a battle URL — had no test. This pins the override (and its exact
// value), so the smoke pattern the handover documents is executable. The
// pin itself stays in battleViewControllerFlags.test.js (node, one flag).

import { describe, it, expect, afterEach } from 'vitest';
import { isBattleViewControllerOn } from './featureFlags.js';
// The flag's dark PIN lives in battleViewControllerFlags.test.js and nowhere
// else (one pin, one file — the flagPinGuard "Pinned by:" coupling). This
// file tests the accessor's behaviour only.

const setQuery = (q) => window.history.replaceState(null, '', `/${q}`);

afterEach(() => setQuery(''));

describe('isBattleViewControllerOn — the ?battleViewController=1 smoke override', () => {
  it('is off with no query string while the flag is dark', () => {
    setQuery('');
    expect(isBattleViewControllerOn()).toBe(false);
  });

  it('turns on with ?battleViewController=1 — exactly "1"', () => {
    setQuery('?battleViewController=1');
    expect(isBattleViewControllerOn()).toBe(true);
    setQuery('?battleViewController=0');
    expect(isBattleViewControllerOn()).toBe(false);
    setQuery('?battleViewController=true');
    expect(isBattleViewControllerOn()).toBe(false);
    setQuery('?battleViewController=2');
    expect(isBattleViewControllerOn()).toBe(false);
  });

  it('survives other parameters and reads at call time', () => {
    setQuery('?foo=bar&battleViewController=1&baz=1');
    expect(isBattleViewControllerOn()).toBe(true);
    setQuery('?foo=bar');
    expect(isBattleViewControllerOn()).toBe(false);
  });

  it('does not answer to the other accessors\' parameters', () => {
    setQuery('?matchupsBackdrop=1&agentPresence=1');
    expect(isBattleViewControllerOn()).toBe(false);
  });
});
