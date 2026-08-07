// api/_utils/compositionWriterCensus.test.js
//
// Composition PR 2 — test A46: an identity-affecting writer absent from the
// epoch census FAILS CI. The census (compositionWriterCensus.json) is the
// human-readable side; this test derives the writer set MECHANICALLY from the
// code (importers of the two server chokepoints + the rules-layer clauses) and
// asserts census coverage — so a new endpoint scaffolded tomorrow cannot ship
// unfenced and uncensused. It also proves each censused writer actually
// carries its declared guard (wiring proof, not just a list).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const CENSUS = JSON.parse(readFileSync(resolve(HERE, 'compositionWriterCensus.json'), 'utf8'));
const read = (p) => readFileSync(resolve(REPO, p), 'utf8');

// Recursive scan over ALL of api/ + scripts/ (review P2: an api/forge or cron
// writer scaffolded tomorrow must not escape the ratchet by directory).
function walkJs(rel) {
  const out = [];
  for (const entry of readdirSync(resolve(REPO, rel), { withFileTypes: true })) {
    const p = `${rel}/${entry.name}`;
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') out.push(...walkJs(p)); }
    else if (entry.name.endsWith('.js') && !entry.name.includes('.test.')) out.push(p);
  }
  return out;
}
const ALL_SERVER_FILES = [...walkJs('api'), ...walkJs('scripts')];

describe('A46 — the writer census is complete and mechanically derived', () => {
  it('every server module that writes agent settings (txUpdateAgentSettings) is censused — any directory', () => {
    const censusedWriters = new Set([
      ...CENSUS.fencedEndpoints,
      ...CENSUS.adminCliScripts.map((s) => s.file),
      'api/_utils/agentSettingsTx.js', // the helper itself
    ]);
    for (const f of ALL_SERVER_FILES) {
      if (read(f).includes('txUpdateAgentSettings(')) {
        expect(censusedWriters.has(f), `${f} writes agent settings but is not in the census`).toBe(true);
      }
    }
    // decide.js is fenced-file-classified, never silently missing:
    expect(CENSUS.derivedClassified.some((d) => d.file === 'api/agent/decide.js')).toBe(true);
  });

  it('every censused fenced endpoint validates the epoch INSIDE its transaction, before its writes (wiring proof, order-checked — review C5)', () => {
    for (const f of CENSUS.fencedEndpoints) {
      const src = read(f);
      expect(src, `${f} missing compositionWriteEpoch import`).toContain("from '../_utils/compositionWriteEpoch.js'");
      const txIdx = src.indexOf('runTransaction(');
      const callIdx = src.indexOf('await validateWriteEpochInTx(tx, db');
      expect(txIdx, `${f} has no transaction`).toBeGreaterThan(-1);
      expect(callIdx, `${f} missing validateWriteEpochInTx call`).toBeGreaterThan(txIdx); // inside the tx callback
      const firstWrite = ['tx.update(', 'tx.set(', 'txUpdateAgentSettings(']
        .map((tok) => src.indexOf(tok))
        .filter((i) => i > -1)
        .reduce((a, b) => Math.min(a, b), Infinity);
      expect(callIdx, `${f} epoch validation must precede the first tx write`).toBeLessThan(firstWrite);
      expect(/epoch_closed:\s*\[409/.test(src), `${f} missing the epoch_closed → 409 sentinel row`).toBe(true);
    }
  });

  it('every writeCompiledBuildsInTx caller — any directory — is a censused endpoint or transactional util', () => {
    const covered = new Set([...CENSUS.fencedEndpoints, ...CENSUS.fencedTransactionalUtils, 'api/_utils/compileOnSettingsChange.js']);
    for (const f of ALL_SERVER_FILES) {
      if (read(f).includes('writeCompiledBuildsInTx(')) {
        expect(covered.has(f), `${f} writes compiled builds outside the censused set`).toBe(true);
      }
    }
  });

  it('the deploy gate and background/CLI writers carry their declared guards', () => {
    expect(read('api/_utils/deployBuildValidation.js')).toContain('validateWriteEpochInTx');
    for (const loop of CENSUS.backgroundLoops) {
      // B2 (PR 4): each row DECLARES its guard mechanism — the PR-2 epoch
      // re-read (assertWriteEpochOpen) or the B2 registered lease
      // (acquireProvisionerLease). The declared token must be present.
      expect(read(loop.file), `${loop.file} missing loop guard (${loop.guardToken})`).toContain(loop.guardToken ?? 'assertWriteEpochOpen');
    }
    for (const cli of CENSUS.adminCliScripts) {
      expect(read(cli.file), `${cli.file} missing CLI guard`).toContain('assertWriteEpochOpen');
    }
  });

  it('every copyAgentSubcollections caller — any directory — is a censused provisioner (the raw-write clone class cannot slip the census)', () => {
    // The txUpdateAgentSettings/writeCompiledBuildsInTx scans above miss
    // provisioners that clone identity state with RAW writes — the exact class
    // casualClone.js (PR #716, merged mid-PR-2) landed in. copyAgentSubcollections
    // copies the rules + bundles subcollections (identity stores), so every
    // caller must be a censused, guarded writer.
    const provisioners = new Set([
      ...CENSUS.backgroundLoops.map((l) => l.file),
      'api/_utils/trainingClone.js', // the defining module
    ]);
    for (const f of ALL_SERVER_FILES) {
      if (read(f).includes('copyAgentSubcollections(')) {
        expect(provisioners.has(f), `${f} clones identity subcollections but is not a censused provisioner`).toBe(true);
      }
    }
  });

  it('the rules layer gates every censused client-SDK clause with epochWriteOpen()', () => {
    const rules = read('firestore.rules');
    expect(rules).toContain('function epochWriteOpen()');
    // 1 definition + 4 gated clauses (agents create; rules create/update; bundles create; bundles update)
    expect((rules.match(/epochWriteOpen\(\)/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(rules).toContain("composition/writeEpoch");
  });
});
