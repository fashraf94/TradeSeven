// src/config/cockpitFlags.test.js
//
// Cockpit Build 1a — THE FLAG PINS (BUILD_RULES §2; spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §3, §11).
//
//   COCKPIT_ALLOWLIST_UIDS — a string[] (the per-battle activation list), so
//     the flag-pin guard — which scans `*_ENABLED = true|false` only — cannot
//     see it and DARK_BY_DESIGN cannot hold it. Pinned HERE, directly: the
//     CALL_RECORDS_MODE precedent. Ships EMPTY.
//   RESPONSE_FORK_ATTRIBUTION_ENABLED — a boolean, DARK_BY_DESIGN (the guard
//     keeps its loud tripwire). Ships false.
//
// RUNWAY (stated where the pins live): the allowlist is filled by the founder's
// own PR after Build 1a merges, Amendment B is blessed and the two Build 1a
// indexes are deployed — never a build PR; each change moves the first row below
// in the same commit. The attribution flag flips only after the round-3 replay
// qualifies the attribution protocol; its flip moves the second row to true AND
// drops its DARK_BY_DESIGN entry (the fourth row turns around with it).
//
// Dependency-surface guard (BUILD_RULES §4): the import of
// api/_utils/callRecords/mode.js below is the runtime guard that the resolver
// the cron and the endpoint use stays Node-clean; it is never mocked.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { COCKPIT_ALLOWLIST_UIDS, RESPONSE_FORK_ATTRIBUTION_ENABLED, CALL_RECORDS_MODE } from './featureFlags.js';
import { resolveCallRecordsMode, isCockpitOwnerAllowlisted } from '../../api/_utils/callRecords/mode.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('COCKPIT_ALLOWLIST_UIDS — the pin (BUILD_RULES §2)', () => {
  it('ships EMPTY and frozen — the row that moves when the founder admits an owner', () => {
    // THE ROW THAT MOVES. Filling the list is the founder's own PR, never a build PR.
    expect(COCKPIT_ALLOWLIST_UIDS).toEqual([]);
    expect(Object.isFrozen(COCKPIT_ALLOWLIST_UIDS)).toBe(true);
  });

  it('every entry is a non-empty string (a malformed list resolves nobody)', () => {
    expect(Array.isArray(COCKPIT_ALLOWLIST_UIDS)).toBe(true);
    for (const uid of COCKPIT_ALLOWLIST_UIDS) expect(typeof uid === 'string' && uid.length > 0).toBe(true);
  });

  it('the docstring carries the direct-pin pointer and the runway', () => {
    const idx = SRC.indexOf('export const COCKPIT_ALLOWLIST_UIDS = ');
    expect(idx).toBeGreaterThan(0);
    const window = SRC.slice(Math.max(0, idx - 2500), idx);
    expect(window).toContain('Pinned by: cockpitFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain('never a build PR');
    expect(window).toContain('never a DARK_BY_DESIGN key');
  });

  it('is NEVER a DARK_BY_DESIGN key (a string[] fails that registry)', () => {
    expect(GUARD).not.toMatch(/COCKPIT_ALLOWLIST_UIDS\s*:/);
  });

  it('with the live flags nobody is allowlisted and every battle resolves the global value', () => {
    expect(isCockpitOwnerAllowlisted('owner-uid-1')).toBe(false);
    expect(isCockpitOwnerAllowlisted('')).toBe(false);
    expect(resolveCallRecordsMode({ ownerId: 'owner-uid-1' })).toBe(CALL_RECORDS_MODE === 'on' ? 'off' : CALL_RECORDS_MODE);
    expect(resolveCallRecordsMode()).toBe(CALL_RECORDS_MODE);
  });
});

describe('RESPONSE_FORK_ATTRIBUTION_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('ships FALSE — the dormant hook records prompt inclusion only (spec §11)', () => {
    // THE ROW THAT MOVES with the deliberate flip (and the DARK_BY_DESIGN entry with it).
    expect(RESPONSE_FORK_ATTRIBUTION_ENABLED).toBe(false);
  });

  it('is registered DARK_BY_DESIGN with a runway note, and its docstring names this suite', () => {
    expect(GUARD).toMatch(/RESPONSE_FORK_ATTRIBUTION_ENABLED:\s*\n\s*'Cockpit Build 1a/);
    const idx = SRC.indexOf('export const RESPONSE_FORK_ATTRIBUTION_ENABLED = ');
    expect(idx).toBeGreaterThan(0);
    const window = SRC.slice(Math.max(0, idx - 2000), idx);
    expect(window).toContain('Pinned by: cockpitFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain('never "In response to …"');
  });
});
