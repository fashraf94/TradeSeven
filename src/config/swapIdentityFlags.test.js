// src/config/swapIdentityFlags.test.js
//
// Pilot P6, the swap identity check — THE DEDICATED PIN and the allowed-values
// suite (BUILD_RULES §2; pilot spec V1.4 §7; Phase 0
// docs/audits/20261007_PHASE0_PILOT_P6_SWAP_IDENTITY.md §6.1).
//
// SWAP_IDENTITY_MODE is a STRING TRI-STATE ('off' | 'shadow' | 'enforce'), so
// the flag-pin guard — which scans `*_ENABLED = true|false` and
// `expect(FLAG).toBe(true|false)` only — cannot see it, and DARK_BY_DESIGN
// cannot hold it. It is pinned HERE, directly: the CALL_RECORDS_MODE
// (callRecordsFlags.test.js) precedent.
//
// RUNWAY: 'off' ships with the P6 build PR. 'off' → 'shadow' is the founder's
// one-line PR after it merges; 'shadow' → 'enforce' follows after at least
// five full trading sessions and a shadow read (scripts/census-swap-identity
// .mjs). Founder PRs, never build PRs, and EACH moves the first row below in
// the same commit. Nothing else in this file pins a value — the rest are
// contracts that hold in every state.
//
// Dependency-surface guard (BUILD_RULES §4): the import of the fenced executor
// below is the runtime guard that the module reading this flag stays
// Node-clean; it is never mocked.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SWAP_IDENTITY_MODE, SWAP_IDENTITY_MODES } from './featureFlags.js';
import { resolveSwapIdentityMode } from '../../api/_utils/agentSwapExecution.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');
const EXECUTOR = readFileSync(path.join(HERE, '..', '..', 'api', '_utils', 'agentSwapExecution.js'), 'utf8');

describe('SWAP_IDENTITY_MODE — the dedicated pin (BUILD_RULES §2; spec §7)', () => {
  it('the pin: the live value (it moves with the walk, off → shadow → enforce)', () => {
    // THE ROW THAT MOVES WITH THE WALK. 'off' → 'shadow' → 'enforce', each in
    // its own founder PR, each updating this literal in the same commit.
    expect(SWAP_IDENTITY_MODE).toBe('off');
  });

  it('the allowed values are exactly the three walked states, in walk order, frozen — and hold the live value', () => {
    expect(SWAP_IDENTITY_MODES).toEqual(['off', 'shadow', 'enforce']);
    expect(Object.isFrozen(SWAP_IDENTITY_MODES)).toBe(true);
    expect(SWAP_IDENTITY_MODES).toContain(SWAP_IDENTITY_MODE);
    expect(typeof SWAP_IDENTITY_MODE).toBe('string');
  });

  it('is a plain string literal export with the direct-pin pointer and the runway in its docstring', () => {
    expect(SRC).toMatch(/^export const SWAP_IDENTITY_MODE = '(off|shadow|enforce)';$/m);
    const idx = SRC.indexOf('export const SWAP_IDENTITY_MODE = ');
    const window = SRC.slice(Math.max(0, idx - 3500), idx);
    expect(window).toContain('Pinned by: swapIdentityFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain("'off' → 'shadow'");
    expect(window).toContain('never a build PR');
  });

  it('is NEVER a DARK_BY_DESIGN key (a string flag fails that boolean registry)', () => {
    expect(GUARD).not.toMatch(/SWAP_IDENTITY_MODE\s*:/);
  });
});

describe('the resolver — unknown values resolve to off (fail closed)', () => {
  it('each walked state resolves to itself', () => {
    for (const mode of SWAP_IDENTITY_MODES) expect(resolveSwapIdentityMode(mode)).toBe(mode);
  });

  it('the live value resolves to itself', () => {
    expect(resolveSwapIdentityMode(SWAP_IDENTITY_MODE)).toBe(SWAP_IDENTITY_MODE);
  });

  it.each([
    ['undefined', undefined], ['null', null], ['empty', ''], ['a case variant', 'Shadow'],
    ['a padded value', ' enforce'], ['a neighbouring flag value', 'on'], ['a boolean', true],
    ['a number', 1], ['an array holding a state', ['enforce']], ['an object', { mode: 'enforce' }],
  ])("%s → 'off'", (_label, value) => {
    expect(resolveSwapIdentityMode(value)).toBe('off');
  });

  it("the executor's default reads THIS flag (guarded — a hermetic mock that omits it reads 'off', review S3-1) and normalizes it before anything branches on it", () => {
    expect(EXECUTOR).toMatch(/identityMode = flagSwapIdentityMode\(\), \/\/ SWAP_IDENTITY_MODE/);
    expect(EXECUTOR.replace(/\r\n/g, '\n')).toContain("function flagSwapIdentityMode() {\n  try {\n    return SWAP_IDENTITY_MODE;\n  } catch {\n    return 'off';\n  }\n}");
    expect(EXECUTOR).toMatch(/const mode = resolveSwapIdentityMode\(identityMode\);/);
    // Nothing in the executor branches on the raw option.
    expect(EXECUTOR).not.toMatch(/\bidentityMode\s*[!=]==/);
    expect(EXECUTOR).not.toMatch(/[!=]==\s*identityMode\b/);
  });
});
