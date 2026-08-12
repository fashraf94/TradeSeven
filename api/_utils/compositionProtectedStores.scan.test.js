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
  // review F3a: the allowlist pins a SITE COUNT per key — a second write
  // added inside an already-listed (file, fn, method, collection) tuple
  // changes the count and fails CI, not just brand-new tuples.
  const foundCounts = {};
  for (const s of needsListing) foundCounts[siteKey(s)] = (foundCounts[siteKey(s)] ?? 0) + 1;
  const allowedCounts = ALLOWLIST.allowedWriteSites;
  const allowed = new Set(Object.keys(allowedCounts));
  const foundKeys = new Set(Object.keys(foundCounts));

  it('the scan is alive: it sees the known writer surface', () => {
    // Guards against a silent scanner regression scanning nothing — the
    // canonical writers must be visible or the deny-by-default claim is hollow.
    expect(all.length).toBeGreaterThan(100);
    expect(foundKeys.has('api/_utils/agentSettingsTx.js::txUpdateAgentSettings::update::unresolved')).toBe(true);
    expect(foundKeys.has('api/_utils/tournamentCpu.js::ensureCpuAgents::set::agents')).toBe(true);
    expect([...PROTECTED_COLLECTIONS]).toContain('agents');
  });

  it('DENY-BY-DEFAULT: every protected-or-unresolved write site is on the explicit allowlist AT ITS PINNED COUNT', () => {
    const unlisted = [...foundKeys].filter((k) => !allowed.has(k)).sort();
    expect(unlisted, 'new protected-store write site(s) — a human must review the writer and add its key to compositionProtectedStoresAllowlist.json in the same PR').toEqual([]);
    const drifted = [...foundKeys].filter((k) => allowed.has(k) && foundCounts[k] !== allowedCounts[k])
      .map((k) => `${k}: found ${foundCounts[k]}, pinned ${allowedCounts[k]}`).sort();
    expect(drifted, 'write-site COUNT drifted inside an allowlisted tuple — a human must re-review the function and update the pinned count').toEqual([]);
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

describe('B3-EXT — one-level helper-parameter data-flow (PR 4 ledger row)', () => {
  const { needsListing } = scanProtectedStoreWrites(REPO);
  const keys = new Set(needsListing.map(siteKey));

  it('a helper taking a ref param that writes IS detected (definition site + census-chokepoint call sites)', () => {
    // Callee-base form: applyConsolidation(agentRef){ agentRef.update(…) }.
    expect(keys.has('api/_utils/agentConsolidationApply.js::applyConsolidation::update::param:agentRef')).toBe(true);
    // Handle ref-argument form: txUpdateAgentSettings(tx, ref){ tx.update(ref,…) } —
    // the endpoint call sites now resolve the CALLER's agents ref, per-callsite.
    expect(keys.has('api/agent/equip-bundle.js::handler::call:txUpdateAgentSettings#1::agents')).toBe(true);
    expect(keys.has('api/agent/update-agent-settings.js::handler::call:txUpdateAgentSettings#1::agents')).toBe(true);
  });

  it('a NEW call site passing a protected ref into a registered helper fails deny-by-default (synthetic repo)', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'b3ext-'));
    try {
      mkdirSync(join(root, 'api'), { recursive: true });
      mkdirSync(join(root, 'scripts'), { recursive: true });
      writeFileSync(join(root, 'api', 'helper.js'),
        'export function writeThrough(ref, data) { return ref.set(data); }\n');
      writeFileSync(join(root, 'api', 'caller.js'),
        "import { writeThrough } from './helper.js';\n"
        + "export async function save(db, d) { await writeThrough(db.collection('agents').doc('x'), d); }\n"
        + "export async function savePlain(db, d) { await writeThrough(db.collection('shadowLogs').doc('x'), d); }\n");
      const res = scanProtectedStoreWrites(root);
      const found = new Set(res.needsListing.map(siteKey));
      // The helper definition is a listed site (invisible to the direct pass).
      expect(found.has('api/helper.js::writeThrough::set::param:ref')).toBe(true);
      // The call site passing an AGENTS ref needs listing at its count…
      expect(found.has('api/caller.js::save::call:writeThrough#0::agents')).toBe(true);
      // …while the call passing a NON-protected literal ref passes unlisted.
      expect(found.has('api/caller.js::savePlain::call:writeThrough#0::shadowLogs')).toBe(false);
      expect(res.all.some((s) => siteKey(s) === 'api/caller.js::savePlain::call:writeThrough#0::shadowLogs')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('documented limit, kept executable: a TWO-HOP chain is visible only at the first hop (unresolved), never followed', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'b3ext2-'));
    try {
      mkdirSync(join(root, 'api'), { recursive: true });
      mkdirSync(join(root, 'scripts'), { recursive: true });
      writeFileSync(join(root, 'api', 'twohop.js'),
        'export function inner(ref, d) { return ref.set(d); }\n'
        + 'export function outer(agentRef, d) { return inner(agentRef, d); }\n'
        + "export function top(db, d) { return outer(db.collection('agents').doc('x'), d); }\n");
      const res = scanProtectedStoreWrites(root);
      const found = new Set(res.needsListing.map(siteKey));
      // First hop: outer's call into inner resolves outer's PARAM — unresolved, listed.
      expect(found.has('api/twohop.js::outer::call:inner#0::unresolved')).toBe(true);
      // The outer helper itself is NOT registered (its param never reaches a
      // write method directly) — so top's agents ref is invisible: the two-hop
      // limit of record. If this expectation ever flips, the limit prose in
      // compositionProtectedStoresScan.js must be rewritten in the same PR.
      expect(found.has('api/twohop.js::top::call:outer#0::agents')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('#10 (Sol pre-activation review) — destructured/extracted write methods fail loud', () => {
  // Explicit timeout: this test re-parses every non-test .js under api/ +
  // scripts/ (a full-repo AST scan by design), which sits right at the 5s
  // default under full-suite worker load as the scanned surface grows — the
  // SPEC1 P3 additions pushed it over intermittently. Long-running on purpose;
  // 20s is headroom, not slack.
  it('the repo carries ZERO write-method extractions (the conservative rule: any occurrence must resolve through the allowlist or fail unresolved)', () => {
    const { all } = scanProtectedStoreWrites(REPO);
    const extractions = all.filter((s) => s.method.startsWith('extract:'));
    expect(extractions).toEqual([]);
  }, 20000);

  it('the detector catches destructuring, aliases, method-value extraction, and bind — and ignores non-Firestore shapes and ordinary calls', async () => {
    const { detectExtractionsInSource } = await import('./compositionProtectedStoresScan.js');
    const flagged = (src) => detectExtractionsInSource('unit.js', src).map((s) => s.method);
    // Destructured off a tx handle:
    expect(flagged('export function f(tx) { const { set } = tx; set(a, b); }')).toEqual(['extract:set']);
    // Aliased destructure off a ref:
    expect(flagged('export function f(agentRef) { const { update: u } = agentRef; u({}); }')).toEqual(['extract:update']);
    // Destructure off a const-hopped handle:
    expect(flagged('export function f(tx) { const t = tx; const { create } = t; }')).toEqual(['extract:create']);
    // Method-value extraction from a chain:
    expect(flagged("export function f(db) { const del = db.collection('agents').doc('a').delete; del(); }")).toEqual(['extract:delete']);
    // Passed as a value / bound:
    expect(flagged('export function f(docRef, run) { run(docRef.set); }')).toEqual(['extract:set']);
    expect(flagged('export function f(docRef) { return docRef.delete.bind(docRef); }')).toEqual(['extract:delete']);
    // NOT flagged: a Map/store delete (non-Firestore shape), an ordinary called write:
    expect(flagged('export function f(store, k) { store.delete(k); const { add } = someSet; }')).toEqual([]);
    expect(flagged("export function f(tx, ref) { tx.set(ref, {}); ref.update({}); }")).toEqual([]);
    // NOT flagged: a typeof feature-detect — the member value is consumed by
    // typeof and can never write (the moverCandidates precedent); the
    // adjacent actual call stays visible to the direct pass:
    expect(flagged("export function f(ref) { if (typeof ref.delete === 'function') ref.delete(); }")).toEqual([]);
  });
});
