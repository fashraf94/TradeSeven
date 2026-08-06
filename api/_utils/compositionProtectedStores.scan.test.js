// api/_utils/compositionProtectedStores.scan.test.js
//
// Composition PR 3 — ledger item B3 (test form): deny-by-default protected-
// store writes. See compositionProtectedStoresScan.js for the resolution
// model. Acceptance (ledger): an unlisted `.set()` on an agents path anywhere
// in api//scripts/ fails; removing a site without pruning its key fails
// stale — the ratchet tightens in both directions.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { scanProtectedStoreWrites, siteKey, PROTECTED_COLLECTIONS } from './compositionProtectedStoresScan.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const ALLOWLIST = JSON.parse(readFileSync(resolve(HERE, 'compositionProtectedStoresAllowlist.json'), 'utf8'));

describe('B3 — deny-by-default protected-store write scan (AST, api/ + scripts/)', () => {
  const { all, needsListing } = scanProtectedStoreWrites(REPO);
  const allowed = new Set(ALLOWLIST.allowedWriteSites);
  const foundKeys = new Set(needsListing.map(siteKey));

  it('the scan is alive: it sees the known writer surface', () => {
    // Guards against a silent scanner regression scanning nothing — the
    // canonical writers must be visible or the deny-by-default claim is hollow.
    expect(all.length).toBeGreaterThan(100);
    expect(foundKeys.has('api/_utils/agentSettingsTx.js::txUpdateAgentSettings::update::unresolved')).toBe(true);
    expect(foundKeys.has('api/_utils/tournamentCpu.js::ensureCpuAgents::set::agents')).toBe(true);
    expect([...PROTECTED_COLLECTIONS]).toContain('agents');
  });

  it('DENY-BY-DEFAULT: every protected-or-unresolved write site is on the explicit allowlist', () => {
    const unlisted = [...foundKeys].filter((k) => !allowed.has(k)).sort();
    expect(unlisted, 'new protected-store write site(s) — a human must review the writer and add its key to compositionProtectedStoresAllowlist.json in the same PR').toEqual([]);
  });

  it('no parse failures anywhere in the scanned tree (a file the scan cannot read is a hole, not a pass)', () => {
    const parseErrors = needsListing.filter((s) => String(s.collection).startsWith('parse_error:'));
    expect(parseErrors).toEqual([]);
  });

  it('the allowlist is not stale: every key still matches a live site (the ratchet only tracks reality)', () => {
    const stale = [...allowed].filter((k) => !foundKeys.has(k)).sort();
    expect(stale, 'allowlisted write site(s) no longer exist — prune the key(s) in the same PR that removed the write').toEqual([]);
  });
});
