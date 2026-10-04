// src/config/cockpitFlags.test.js
//
// Cockpit Build 1a — THE FLAG PINS (BUILD_RULES §2; spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §3, §11).
//
//   COCKPIT_ALLOWLIST_UIDS — MOVED SERVER-SIDE by Cockpit Build 2a (spec
//     docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-5, ruling R2A-7): it is now the
//     environment variable read at call time by api/_utils/callRecords/
//     allowlist.js (pinned by allowlist.test.js), and this module's pins say
//     only that featureFlags.js no longer carries it — so no uid can ship in
//     the client bundle.
//   RESPONSE_FORK_ATTRIBUTION_ENABLED — a boolean, DARK_BY_DESIGN (the guard
//     keeps its loud tripwire). Ships false.
//
// RUNWAY (stated where the pins live): the allowlist is set by the founder in
// the Vercel production environment (spec §10.3) — never in the repo. The
// attribution flag flips only after the round-3 replay
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
import * as flags from './featureFlags.js';
import { RESPONSE_FORK_ATTRIBUTION_ENABLED, CALL_RECORDS_MODE } from './featureFlags.js';
import { resolveCallRecordsMode, isCockpitOwnerAllowlisted } from '../../api/_utils/callRecords/mode.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('COCKPIT_ALLOWLIST_UIDS — server-side only (Build 2a S-5, ruling R2A-7)', () => {
  it('featureFlags.js no longer exports it — the client bundle carries no allowlist', () => {
    expect('COCKPIT_ALLOWLIST_UIDS' in flags).toBe(false);
    expect(SRC).not.toMatch(/export const COCKPIT_ALLOWLIST_UIDS\b/);
  });

  it('the module says where it went: the environment variable and its server-only reader', () => {
    expect(SRC).toContain('THE PER-BATTLE ALLOWLIST IS NOT HERE ANY MORE');
    expect(SRC).toContain('api/_utils/callRecords/allowlist.js');
    expect(SRC).toContain('GET /api/agent/cockpit-status');
  });

  it('is NEVER a DARK_BY_DESIGN key', () => {
    expect(GUARD).not.toMatch(/COCKPIT_ALLOWLIST_UIDS\s*:/);
  });

  it('with the variable unset (the shipped state) nobody is allowlisted and every battle resolves the global value', () => {
    const before = process.env.COCKPIT_ALLOWLIST_UIDS;
    delete process.env.COCKPIT_ALLOWLIST_UIDS;
    try {
      expect(isCockpitOwnerAllowlisted('owner-uid-1')).toBe(false);
      expect(isCockpitOwnerAllowlisted('')).toBe(false);
      expect(resolveCallRecordsMode({ ownerId: 'owner-uid-1' })).toBe(CALL_RECORDS_MODE === 'on' ? 'off' : CALL_RECORDS_MODE);
      expect(resolveCallRecordsMode()).toBe(CALL_RECORDS_MODE);
    } finally {
      if (before === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = before;
    }
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
