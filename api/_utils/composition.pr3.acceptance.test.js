// api/_utils/composition.pr3.acceptance.test.js
//
// Composition PR 3 — the pure acceptance rows for the ledger's PR-3 items
// (docs/composition/ACTIVATION_PRECONDITIONS.md, PR-3 table). Each describe
// names its ledger row; every row fails under the defect it guards
// (mutation-checked — see the PR-3 audit record).

import { describe, it, expect } from 'vitest';
import {
  computeOverlayRunHash, computeOverlaySemanticHash, computeOverlayContentHash, entryDocId,
} from './compositionStateResolver.js';
import { planAgentMigration } from './compositionMigration.js';

// A realistic planner fixture (the PR-2 mc shape): one out-of-domain param on
// an equipped bundle → a ruleDoc clamp + snapshot lockstep + agent-side plan.
function mcFixture() {
  return {
    agent: { id: 'agent-mc', docPath: 'agents/agent-mc', archetype: 'momentum_chaser', equippedBundleIds: ['b1'] },
    ruleDocs: [
      { id: 'rd1', docPath: 'agents/agent-mc/rules/rd1', sourceRef: 'alloc-sector-cap', paramValues: { pct: 90 }, params: { pct: {} } },
    ],
    bundles: [
      { id: 'b1', docPath: 'agents/agent-mc/bundles/b1', status: 'equipped', ruleIds: ['rd1'], ruleSnapshots: [
        { id: 'rd1', sourceRef: 'alloc-sector-cap', paramValues: { pct: 90 }, params: { pct: {} } },
      ] },
    ],
  };
}

describe('M12 — the semantic-vs-run hash split', () => {
  it('two planner runs over IDENTICAL data with different runIds: equal semanticHash, different runHash', () => {
    const a = planAgentMigration({ ...mcFixture(), migrationRunId: 'run-A' });
    const b = planAgentMigration({ ...mcFixture(), migrationRunId: 'run-B' });
    expect(a.entries.length).toBeGreaterThan(0); // the fixture genuinely plans
    expect(computeOverlaySemanticHash(a.entries)).toBe(computeOverlaySemanticHash(b.entries));
    expect(computeOverlayRunHash(a.entries)).not.toBe(computeOverlayRunHash(b.entries));
  });

  it('semanticHash is order-independent but CONTENT-sensitive (a changed afterValue changes it)', () => {
    const { entries } = planAgentMigration({ ...mcFixture(), migrationRunId: 'run-A' });
    expect(computeOverlaySemanticHash([...entries].reverse())).toBe(computeOverlaySemanticHash(entries));
    const tampered = entries.map((e, i) => (i === 0 ? { ...e, afterValue: 'TAMPERED' } : e));
    expect(computeOverlaySemanticHash(tampered)).not.toBe(computeOverlaySemanticHash(entries));
  });

  it('runHash is the §2 overlayContentHash of record (alias, byte-equal)', () => {
    const { entries } = planAgentMigration({ ...mcFixture(), migrationRunId: 'run-A' });
    expect(computeOverlayRunHash(entries)).toBe(computeOverlayContentHash(entries));
  });
});

describe('M12 — injective base64url entry doc ids', () => {
  it("keys that COLLIDE under the legacy '/'→'~' substitution get distinct doc ids", () => {
    // Legacy: both of these map to 'a~b|f' — a real overwrite hazard (review P2).
    const k1 = 'a/b|f';
    const k2 = 'a~b|f';
    expect(k1.replace(/\//g, '~')).toBe(k2.replace(/\//g, '~')); // the defect, demonstrated
    expect(entryDocId(k1)).not.toBe(entryDocId(k2));             // the fix
  });

  it('doc ids are legal Firestore ids for real entry keys (no slash, never . or ..)', () => {
    const { entries } = planAgentMigration({ ...mcFixture(), migrationRunId: 'run-A' });
    for (const e of entries) {
      const id = entryDocId(e.entryKey);
      expect(id).not.toMatch(/\//);
      expect(id).not.toBe('.');
      expect(id).not.toBe('..');
      expect(Buffer.from(id, 'base64url').toString('utf8')).toBe(e.entryKey); // decodable — ops can invert
    }
  });
});
