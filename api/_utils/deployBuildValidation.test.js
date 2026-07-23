// api/_utils/deployBuildValidation.test.js
//
// Archetype Architecture Phase 2 (P2.4b, §7-signed) — the deploy gate:
//
//   1. DARKNESS: enabled=false → { proceed: true, dark } with ZERO touches
//      of db/agentRef (fakes here have no methods at all — any dereference
//      explodes). This is the flag-false byte-identity lock for the two
//      fenced decide.js call sites, which are pure pass-throughs when the
//      gate proceeds without side effects.
//   2. Fresh vector → pure verify: proceed with the STORED build, no writes.
//   3. Stale (settingsRev / bundle hash / A-2 mode triple) or ABSENT →
//      recompile at the CURRENT revision (A-3: no source mutation ⇒ no
//      minted revision) and proceed.
//   4. Persistent transaction failure → refuse after 2 attempts (§4.4
//      abort/retry exhausted; A-3 undeployable).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): real imports of the compiler
// layer + registry graph run through the Node env. NEVER mock them.

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ensureDeployableCompiledBuild,
  diffSourceRevisionVector,
} from './deployBuildValidation.js';
import { __resetCompileMemos } from './compileOnSettingsChange.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';

const AGENT_ID = 'a1';

// ── Fakes ────────────────────────────────────────────────────────────────
function makeAgentRef(agentDoc, { bundles = {}, compiledBuilds = {} } = {}) {
  const state = { agentDoc, bundles, compiledBuilds };
  const ref = {
    __kind: 'agent',
    __state: state,
    collection(name) {
      return {
        doc(docId) {
          return { __kind: name, __id: docId, __state: state };
        },
      };
    },
  };
  return ref;
}

function makeDb(agentRef, { failTransactions = 0 } = {}) {
  const writes = [];
  let failures = failTransactions;
  return {
    writes,
    async runTransaction(fn) {
      if (failures > 0) {
        failures -= 1;
        throw new Error('simulated_contention');
      }
      const state = agentRef.__state;
      const tx = {
        async get(ref) {
          if (ref === agentRef) return { exists: state.agentDoc != null, data: () => state.agentDoc };
          if (ref.__kind === 'compiledBuilds') {
            const doc = state.compiledBuilds[ref.__id];
            return { exists: doc !== undefined, data: () => doc };
          }
          throw new Error(`unexpected tx.get ${ref.__kind}`);
        },
        async getAll(...refs) {
          return refs.map((r) => ({
            id: r.__id,
            exists: state.bundles[r.__id] !== undefined,
            data: () => state.bundles[r.__id],
          }));
        },
        set(ref, data) {
          writes.push({ kind: ref.__kind, id: ref.__id, data });
          if (ref.__kind === 'compiledBuilds') state.compiledBuilds[ref.__id] = data;
        },
        update() {
          throw new Error('deploy gate must never update the agent doc (no minted revisions)');
        },
      };
      return fn(tx);
    },
  };
}

const agentDoc = () => ({
  archetype: 'momentum_chaser',
  settingsRev: 6,
  equippedBundleIds: ['b1'],
  deployedStrategy: { guardrails: [{ type: 'stopLoss', value: 8 }] },
});

const bundleDoc = () => ({
  ruleIds: ['tech-rsi-oversold'],
  ruleSnapshots: [{
    id: 'tech-rsi-oversold',
    text: 'Prefer stocks with RSI below 30',
    paramValues: { threshold: 30 },
    category: 'technical',
  }],
});

beforeEach(() => __resetCompileMemos());

describe('P2.4b darkness — the fenced call sites stay byte-identical', () => {
  it('enabled=false proceeds immediately without touching db or agentRef', async () => {
    const result = await ensureDeployableCompiledBuild({
      db: {},        // no runTransaction — any touch explodes
      agentRef: {},  // no collection — any touch explodes
      agentId: AGENT_ID,
      gameMode: TIERED_GAME_MODE,
      enabled: false,
    });
    expect(result).toEqual({ proceed: true, dark: true });
  });
});

describe('P2.4b enabled — validate-or-recompile + lock-time re-verify', () => {
  it('ABSENT CompiledBuild → recompiles at the CURRENT revision (A-3: no minted revision) and proceeds', async () => {
    const agentRef = makeAgentRef(agentDoc(), { bundles: { b1: bundleDoc() }, compiledBuilds: {} });
    const db = makeDb(agentRef);
    const result = await ensureDeployableCompiledBuild({
      db, agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    expect(result.proceed).toBe(true);
    expect(result.recompiled).toBe(true);
    // Both live deploy modes rewritten (the sibling stays coherent).
    expect(db.writes.map((w) => w.id).sort()).toEqual([FLAT6_GAME_MODE, TIERED_GAME_MODE].sort());
    for (const w of db.writes) {
      expect(w.data.buildVersion).toBe(6); // CURRENT rev — not 7
      expect(w.data.sourceRevisionVector.settingsRev).toBe(6);
    }
  });

  it('FRESH stored build → pure verify: proceeds with the stored artifact, zero writes', async () => {
    // Seed by letting the gate itself write a fresh artifact...
    const agentRef = makeAgentRef(agentDoc(), { bundles: { b1: bundleDoc() }, compiledBuilds: {} });
    await ensureDeployableCompiledBuild({
      db: makeDb(agentRef), agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    // ...then re-run against the seeded state: nothing changed → verify-only.
    const db2 = makeDb(agentRef);
    const result = await ensureDeployableCompiledBuild({
      db: db2, agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    expect(result.proceed).toBe(true);
    expect(result.recompiled).toBe(false);
    expect(result.compiledBuild.sourceRevisionVector.settingsRev).toBe(6);
    expect(db2.writes).toEqual([]);
  });

  it('settingsRev drift → stale → recompile at the NEW current revision', async () => {
    const agentRef = makeAgentRef(agentDoc(), { bundles: { b1: bundleDoc() }, compiledBuilds: {} });
    await ensureDeployableCompiledBuild({
      db: makeDb(agentRef), agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    agentRef.__state.agentDoc = { ...agentDoc(), settingsRev: 9 }; // equips happened since
    const db2 = makeDb(agentRef);
    const result = await ensureDeployableCompiledBuild({
      db: db2, agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    expect(result.proceed).toBe(true);
    expect(result.recompiled).toBe(true);
    expect(db2.writes.find((w) => w.id === TIERED_GAME_MODE).data.buildVersion).toBe(9);
  });

  it('bundle-content drift (the persist-on-launch class) → stale → recompile', async () => {
    const agentRef = makeAgentRef(agentDoc(), { bundles: { b1: bundleDoc() }, compiledBuilds: {} });
    await ensureDeployableCompiledBuild({
      db: makeDb(agentRef), agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    // A legacy dims backfill lands on the equipped bundle post-compile.
    agentRef.__state.bundles.b1 = { ...bundleDoc(), dimensionValues: { risk: 2 } };
    const db2 = makeDb(agentRef);
    const result = await ensureDeployableCompiledBuild({
      db: db2, agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    expect(result.recompiled).toBe(true);
    expect(db2.writes.length).toBeGreaterThan(0);
  });

  it('A-2 mode scoping: a build stored under one mode never satisfies the other (the mode triple mismatches)', async () => {
    const agentRef = makeAgentRef(agentDoc(), { bundles: { b1: bundleDoc() }, compiledBuilds: {} });
    await ensureDeployableCompiledBuild({
      db: makeDb(agentRef), agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    // Corrupt: copy the tiered build into the flat6 slot (wrong mode triple).
    agentRef.__state.compiledBuilds[FLAT6_GAME_MODE] = agentRef.__state.compiledBuilds[TIERED_GAME_MODE];
    const db2 = makeDb(agentRef);
    const result = await ensureDeployableCompiledBuild({
      db: db2, agentRef, agentId: AGENT_ID, gameMode: FLAT6_GAME_MODE, enabled: true,
    });
    expect(result.recompiled).toBe(true); // mismatch detected → recompiled
  });

  it('persistent transaction failure → refuse after the §4.4 retries (A-3 undeployable)', async () => {
    const agentRef = makeAgentRef(agentDoc(), { bundles: { b1: bundleDoc() } });
    const db = makeDb(agentRef, { failTransactions: 2 });
    const result = await ensureDeployableCompiledBuild({
      db, agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain('compiled_build_unverifiable');
  });

  it('one transient failure then success → proceeds on the retry', async () => {
    const agentRef = makeAgentRef(agentDoc(), { bundles: { b1: bundleDoc() }, compiledBuilds: {} });
    const db = makeDb(agentRef, { failTransactions: 1 });
    const result = await ensureDeployableCompiledBuild({
      db, agentRef, agentId: AGENT_ID, gameMode: TIERED_GAME_MODE, enabled: true,
    });
    expect(result.proceed).toBe(true);
  });
});

describe('diffSourceRevisionVector (§4.4: any component change invalidates)', () => {
  const base = () => ({
    settingsRev: 6,
    ruleLibraryVersion: 1,
    identityHash: 'ih',
    calibrationBundleVersion: 1,
    guardrailSetVersion: 1,
    gameMode: TIERED_GAME_MODE,
    gameModePolicyVersion: 1,
    gameModePolicyHash: 'ph',
    bundleContentHashes: { b1: 'h1' },
  });

  it('reports [] for identity and every mismatched component by name', () => {
    expect(diffSourceRevisionVector(base(), base())).toEqual([]);
    for (const key of ['settingsRev', 'ruleLibraryVersion', 'identityHash', 'calibrationBundleVersion', 'guardrailSetVersion', 'gameMode', 'gameModePolicyVersion', 'gameModePolicyHash']) {
      const expected = { ...base(), [key]: 'DIFFERENT' };
      expect(diffSourceRevisionVector(base(), expected), key).toContain(key);
    }
    expect(diffSourceRevisionVector(base(), { ...base(), bundleContentHashes: { b1: 'OTHER' } }))
      .toContain('bundleContentHashes.b1');
    expect(diffSourceRevisionVector(base(), { ...base(), bundleContentHashes: { b1: 'h1', b2: 'new' } }))
      .toContain('bundleContentHashes.b2');
    expect(diffSourceRevisionVector(null, base())).toEqual(['vector_missing']);
  });
});
