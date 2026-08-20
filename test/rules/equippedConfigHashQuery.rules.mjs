// test/rules/equippedConfigHashQuery.rules.mjs
//
// E9 — equippedConfigHash query round-trip (founder-authorized 2026-08-20,
// Strategy Foundation audit). Proves against the real Firestore emulator that
// the "battles fought under config X" query — two equality filters,
// agentId + the NESTED-MAP dot path resolvedAgentManifest.equippedConfigHash —
// addresses the field correctly and returns exactly the matching docs.
//
// HONEST SCOPE (stated on purpose): the emulator serves every query WITHOUT
// composite indexes, so this file proves the query SHAPE round-trips — it
// does NOT prove the production index exists. Production needs the
// firestore.indexes.json entry (agentId ASC +
// resolvedAgentManifest.equippedConfigHash ASC) created manually via the
// Firebase Console per the FIRESTORE_INDEX_DRIFT_CLEANUP dual-write note —
// CLI index deploys are unsafe until that cleanup lands.
//
// Writes/reads run under withSecurityRulesDisabled — the Admin-SDK-equivalent
// path, matching the production reader (server-side query, rules bypassed).
// No security-rules change rides this arc, so no allow/deny rows here.
//
// Not part of the default vitest run (filename has no `.test.`/`.spec.`).
// Run via: npm run test:rules

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

let testEnv;

/** Seed a document bypassing rules (Admin-SDK-equivalent path). */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

/** A minimal battle doc carrying the manifest fingerprint. */
function battleDoc(agentId, equippedConfigHash) {
  return {
    agentId,
    ownerId: 'owner-1',
    status: 'active',
    resolvedAgentManifest: {
      manifestId: `${agentId}_m`,
      manifestHash: 'mh',
      equippedConfigHash,
      frozenLayers: { activeRules: [], equippedBundleIds: [] },
    },
  };
}

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: emuHost,
      port: Number(emuPort),
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

describe('agentBattles — query by resolvedAgentManifest.equippedConfigHash', () => {
  it('agentId + equippedConfigHash equality filters return exactly the matching battles', async () => {
    await seed('agentBattles/battle-1', battleDoc('agent-1', HASH_A));
    await seed('agentBattles/battle-2', battleDoc('agent-1', HASH_B));
    await seed('agentBattles/battle-3', battleDoc('agent-2', HASH_A));

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const under = (agentId, hash) => getDocs(query(
        collection(db, 'agentBattles'),
        where('agentId', '==', agentId),
        where('resolvedAgentManifest.equippedConfigHash', '==', hash),
      ));

      // "battles fought under config A" for agent-1: battle-1 only — the
      // same-agent other-config battle and the other-agent same-config
      // battle are both excluded.
      const configA = await under('agent-1', HASH_A);
      expect(configA.docs.map((d) => d.id)).toEqual(['battle-1']);

      // The sibling config selects the sibling battle.
      const configB = await under('agent-1', HASH_B);
      expect(configB.docs.map((d) => d.id)).toEqual(['battle-2']);

      // An unknown fingerprint returns empty, not an error (the dot path
      // resolves against the nested map — no doc matches).
      const none = await under('agent-1', 'c'.repeat(64));
      expect(none.empty).toBe(true);
    });
  });

  it('pre-E9 battles (no equippedConfigHash key) are silently excluded, never matched or thrown on', async () => {
    // A legacy doc: manifest present but no fingerprint key (pre-flip), and
    // an even older doc with no manifest at all.
    await seed('agentBattles/legacy-1', {
      agentId: 'agent-1', ownerId: 'owner-1', status: 'completed',
      resolvedAgentManifest: { manifestId: 'm', manifestHash: 'mh', frozenLayers: {} },
    });
    await seed('agentBattles/legacy-2', { agentId: 'agent-1', ownerId: 'owner-1', status: 'completed' });
    await seed('agentBattles/battle-1', battleDoc('agent-1', HASH_A));

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const res = await getDocs(query(
        collection(db, 'agentBattles'),
        where('agentId', '==', 'agent-1'),
        where('resolvedAgentManifest.equippedConfigHash', '==', HASH_A),
      ));
      expect(res.docs.map((d) => d.id)).toEqual(['battle-1']);
    });
  });
});
