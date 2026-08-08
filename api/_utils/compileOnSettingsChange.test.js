// api/_utils/compileOnSettingsChange.test.js
//
// Archetype Architecture Phase 2 (P2.4a) — the dark equip-time compile
// helper. Locks:
//
//   1. DARKNESS: with enabled=false both entry points return null WITHOUT
//      touching the transaction — zero reads, zero writes (the endpoints'
//      own flag-off suites then prove response byte-identity end-to-end).
//   2. The flag default itself: COMPILER_ENABLED === false at merge
//      (Phase 2 exit criterion 1; flips are separate founder PRs).
//   3. Enabled behavior: one CompiledBuild doc per live deploy mode written
//      via overwrite-in-place tx.set to agents/{id}/compiledBuilds/{mode},
//      vector.settingsRev = the post-increment revision (A-3), previews
//      returned per mode, and every written build passes the §4.4 validator.
//   4. LIVE-CORPUS HONESTY: compiles against today's metadata-less corpus
//      record validation.pass=false with metadata_missing — never invented
//      defaults (§5.6).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the helper's REAL import graph
// (registry → ten data homes, corpus, compat map, featureFlags) loads
// through the Node test env — a browser dep entering it explodes here.
// NEVER mock those imports.

import { describe, it, expect, beforeEach } from 'vitest';

import {
  prepareCompileInputs,
  writeCompiledBuildsInTx,
  resolveEquippedCompatCells,
  __resetCompileMemos,
} from './compileOnSettingsChange.js';
import { validateCompiledBuild } from './archetypeBuildSchemas.js';
import { getRuleCompatInfo } from '../../src/data/archetypeRuleCompatibility.js';
import { COMPILER_ENABLED } from '../../src/config/featureFlags.js';
import { LIVE_DEPLOY_MODES } from './gameModePolicy.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';

const NOW = '2026-07-23T12:00:00.000Z';

function makeFakeTx() {
  const calls = { getAll: [], set: [] };
  return {
    calls,
    async getAll(...refs) {
      calls.getAll.push(refs.map((r) => r.id));
      return refs.map((ref) => ({
        id: ref.id,
        exists: ref.__doc !== undefined,
        data: () => ref.__doc,
      }));
    },
    set(ref, data) {
      calls.set.push({ path: ref.__path, data });
    },
  };
}

function makeAgentRef(agentId, bundleDocsById = {}) {
  return {
    id: agentId,
    collection(name) {
      return {
        doc(docId) {
          return {
            id: docId,
            __path: `agents/${agentId}/${name}/${docId}`,
            ...(name === 'bundles' ? { __doc: bundleDocsById[docId] } : {}),
          };
        },
      };
    },
  };
}

// The dark-path fake deliberately has NO .collection — mirroring the
// endpoint-suite fakes. If either helper touches agentRef while disabled,
// this suite explodes exactly like the endpoint tests did.
function makeDarkAgentRef(agentId) {
  return { id: agentId };
}

// A bundle carrying one real corpus rule id (metadata-less at HEAD) in the
// frozen-snapshot shape the equip path stores.
const liveishBundle = {
  ruleIds: ['tech-rsi-oversold'],
  ruleSnapshots: [{
    id: 'tech-rsi-oversold',
    text: 'Prefer stocks with RSI below 30',
    textTemplate: 'Prefer stocks with RSI below {threshold}',
    params: null,
    paramValues: { threshold: 30 },
    category: 'technical',
  }],
};

beforeEach(() => __resetCompileMemos());

describe('P2.4a darkness (exit criterion 1)', () => {
  it('COMPILER_ENABLED defaults false at merge', () => {
    expect(COMPILER_ENABLED).toBe(false);
  });

  it('disabled prepare/write return null without touching the transaction OR the agentRef', async () => {
    const tx = makeFakeTx();
    const prep = await prepareCompileInputs(tx, {
      agentRef: makeDarkAgentRef('a1'), // no .collection — must never be touched
      nextEquippedBundleIds: ['b1'],
      enabled: false,
    });
    expect(prep).toBeNull();
    const previews = writeCompiledBuildsInTx(tx, {
      agentRef: makeDarkAgentRef('a1'),
      agentId: 'a1',
      agent: { archetype: 'momentum_chaser', settingsRev: 4 },
      nextState: {},
      bundles: undefined,
      enabled: false,
      nowIso: NOW,
    });
    expect(previews).toBeNull();
    expect(tx.calls.getAll).toEqual([]);
    expect(tx.calls.set).toEqual([]);
  });
});

describe('P2.4a enabled behavior (preview-smoke path)', () => {
  it('reads exactly the next equipped bundle docs; empty set skips the read entirely', async () => {
    const tx = makeFakeTx();
    const agentRef = makeAgentRef('a1', { b1: liveishBundle });
    const prep = await prepareCompileInputs(tx, {
      agentRef,
      nextEquippedBundleIds: ['b1', 'b-dangling'],
      enabled: true,
    });
    expect(tx.calls.getAll).toEqual([['b1', 'b-dangling']]);
    expect(prep.bundles).toHaveLength(1); // dangling id compiles as absent
    expect(prep.bundles[0].bundleId).toBe('b1');

    const tx2 = makeFakeTx();
    const empty = await prepareCompileInputs(tx2, {
      agentRef, nextEquippedBundleIds: [], enabled: true,
    });
    expect(empty).toEqual({ bundles: [], candidateMode: false }); // #11: the resolved selection rides the prepared inputs
    expect(tx2.calls.getAll).toEqual([]);
  });

  it('writes one CompiledBuild per live deploy mode via overwrite-in-place set, minting the post-increment settingsRev (A-3)', () => {
    const tx = makeFakeTx();
    const previews = writeCompiledBuildsInTx(tx, {
      agentRef: makeAgentRef('a1'),
      agentId: 'a1',
      agent: { archetype: 'momentum_chaser', settingsRev: 4, deployedStrategy: { guardrails: [{ type: 'stopLoss', value: 8 }] } },
      nextState: {},
      bundles: [{ bundleId: 'b1', ...liveishBundle }],
      enabled: true,
      nowIso: NOW,
    });

    expect(tx.calls.set.map((s) => s.path)).toEqual(
      LIVE_DEPLOY_MODES.map((m) => `agents/a1/compiledBuilds/${m}`)
    );
    expect(Object.keys(previews).sort()).toEqual([...LIVE_DEPLOY_MODES].sort());

    for (const { data: build } of tx.calls.set) {
      // A-3: the compile mints revision 5 (agent at 4 + the structural bump).
      expect(build.buildVersion).toBe(5);
      expect(build.sourceRevisionVector.settingsRev).toBe(5);
      expect(build.sourceRevisionVector.bundleContentHashes.b1).toBeTruthy();
      const res = validateCompiledBuild(build);
      expect(res.errors).toEqual([]);
      expect(res.valid).toBe(true);
    }
    expect(previews[TIERED_GAME_MODE].compiledBuildId).toBe(`a1_${TIERED_GAME_MODE}_rev5`);
    expect(previews[FLAT6_GAME_MODE].compiledBuildId).toBe(`a1_${FLAT6_GAME_MODE}_rev5`);
    // The user guardrail reaches the mandatory preview even with zero
    // compiled rules (user-only type row).
    expect(previews[TIERED_GAME_MODE].effectiveGuardrailsPreview.perType.stopLoss.effective).toBe(8);
  });

  it('records the honest §5.6 state against the live corpus: validation fails with metadata_missing, nothing defaulted', () => {
    const tx = makeFakeTx();
    const previews = writeCompiledBuildsInTx(tx, {
      agentRef: makeAgentRef('a1'),
      agentId: 'a1',
      agent: { archetype: 'momentum_chaser', settingsRev: 1 },
      nextState: {},
      bundles: [{ bundleId: 'b1', ...liveishBundle }],
      enabled: true,
      nowIso: NOW,
    });
    expect(previews[TIERED_GAME_MODE].validationPass).toBe(false);
    expect(previews[TIERED_GAME_MODE].validationErrorCount).toBeGreaterThan(0);
    const build = tx.calls.set[0].data;
    expect(build.validation.errors.map((e) => e.code)).toContain('metadata_missing');
  });

  it('nextState.archetype rekeys identity + compat (change-archetype path)', () => {
    const tx = makeFakeTx();
    writeCompiledBuildsInTx(tx, {
      agentRef: makeAgentRef('a1'),
      agentId: 'a1',
      agent: { archetype: 'momentum_chaser', settingsRev: 1 },
      nextState: { archetype: 'guardian' },
      bundles: [],
      enabled: true,
      nowIso: NOW,
    });
    expect(tx.calls.set[0].data.parentArchetypeId).toBe('guardian');
  });

  it('nextState.deployedStrategy (including the null clear) governs the merge preview, not the stale agent value', () => {
    const tx = makeFakeTx();
    const previews = writeCompiledBuildsInTx(tx, {
      agentRef: makeAgentRef('a1'),
      agentId: 'a1',
      agent: { archetype: 'momentum_chaser', settingsRev: 1, deployedStrategy: { guardrails: [{ type: 'stopLoss', value: 8 }] } },
      nextState: { deployedStrategy: null },
      bundles: [],
      enabled: true,
      nowIso: NOW,
    });
    expect(previews[TIERED_GAME_MODE].effectiveGuardrailsPreview.perType).toEqual({});
  });
});

// Regression for the settings-writer key-space defect (audit §10.4 item 3):
// the writer resolved compat cells with getRuleCompatInfo(snap.id, ...), but
// snap.id is the Firestore rule DOC id (forgeService.js:481-492) while the
// compat map is keyed by TEMPLATE id (snap.sourceRef, ruleCompatClassify.js:45-46),
// so EVERY live cell silently resolved via:'fallthrough'. These lock the
// pairing: lookup by sourceRef, key by doc id. Each fails under the doc-id form.
describe('resolveEquippedCompatCells — compat keys on the TEMPLATE id, not the doc id', () => {
  const ARCHETYPE = 'contrarian';
  const TEMPLATE_ID = 'sr-04';       // a contrarian core_conflict override (add-to-winners)
  const DOC_ID = 'rule_9f3a17c2';    // a Firestore doc-id shape, deliberately ≠ the template id

  it('anchor: the template id carries a real (non-fallthrough) verdict; the doc id does not', () => {
    // If THIS fails, the sr-04/contrarian override was removed — repick a
    // non-fallthrough anchor cell; it is not a writer regression.
    expect(getRuleCompatInfo(TEMPLATE_ID, ARCHETYPE).via).not.toBe('fallthrough');
    // A doc id is not a template id → fallthrough: exactly what the pre-fix
    // getRuleCompatInfo(snap.id, ...) produced for every equipped rule.
    expect(getRuleCompatInfo(DOC_ID, ARCHETYPE).via).toBe('fallthrough');
  });

  it('resolves by snap.sourceRef and keys by snap.id — the doc-id form would fall through', () => {
    const cells = resolveEquippedCompatCells(
      [{ bundleId: 'b1', ruleSnapshots: [{ id: DOC_ID, sourceRef: TEMPLATE_ID }] }],
      ARCHETYPE,
    );
    // Keyed by the DOC id — the id compileBuild.js:160 rehydrates rules under.
    expect(Object.keys(cells)).toEqual([DOC_ID]);
    // Resolved by the TEMPLATE id: byte-for-byte the real verdict. Under the
    // reverted doc-id form the cell would be getRuleCompatInfo(DOC_ID, ...)'s
    // fallthrough neutral and BOTH assertions below flip.
    expect(cells[DOC_ID]).toEqual(getRuleCompatInfo(TEMPLATE_ID, ARCHETYPE));
    expect(cells[DOC_ID].via).not.toBe('fallthrough');
    expect(cells[DOC_ID]).not.toEqual(getRuleCompatInfo(DOC_ID, ARCHETYPE));
  });

  it('manual rules (sourceRef null, outside the map) land on fallthrough absence, keyed by doc id', () => {
    const cells = resolveEquippedCompatCells(
      [{ ruleSnapshots: [{ id: 'manual_1', sourceRef: null }] }],
      ARCHETYPE,
    );
    expect(cells.manual_1.via).toBe('fallthrough');
  });

  it('dedupes a snapshot repeated across bundles by doc id', () => {
    const snap = { id: DOC_ID, sourceRef: TEMPLATE_ID };
    const cells = resolveEquippedCompatCells(
      [{ ruleSnapshots: [snap] }, { ruleSnapshots: [snap] }],
      ARCHETYPE,
    );
    expect(Object.keys(cells)).toEqual([DOC_ID]);
  });
});
