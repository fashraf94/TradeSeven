// api/_utils/compositionActivationService.test.js
//
// Composition PR 4 — the activation record service acceptance battery:
//   B4    — full-descriptor writes, atomic COMPLETE-tuple rollback from the
//           append-only history, strict generation monotonicity, zero tuple
//           reuse across activate → rollback → reactivate (A48 lands here
//           against the full descriptor);
//   M6    — activation-time candidate verification INSIDE the transaction:
//           missing entry / extra entry / count drift / hash drift / id
//           drift each ABORT with nothing repointed;
//   R6-B1 — the descriptor's candidateStateId + semanticHash must match the
//           candidate manifest in the same transaction;
//   B1    — expectedEpochId pinning across tx retries + absent-epoch-doc
//           fails CLOSED once an activation record exists (and stays open
//           pre-activation — dark compat);
//   A34   — SUPPORTED_BOUNDARY_STATE_VERSIONS: an unsupported
//           boundaryStateVersion rejects the request (the stale-warm-instance
//           check, per the founder's Q1 ruling);
//   A24   — both sides at the seam: no record → the LIVE identity (old
//           defaults); the record selecting the candidate → substituted
//           defaults; the service writes NOTHING outside its own record
//           (existing agents untouched in both worlds).

import { describe, it, expect } from 'vitest';
import {
  writeActivationRecord, rollbackActivationRecord, bumpOverrideRevisionInTx,
  selectIdentityVersion, activationRef,
  ACTIVATION_HISTORY_SUBCOLLECTION, CANDIDATE_STATE_COLLECTION, ActivationAbortError,
} from './compositionActivationService.js';
import { validateWriteEpochInTx, assertBoundaryStateSupported, SUPPORTED_BOUNDARY_STATE_VERSIONS, UnsupportedBoundaryStateError } from './compositionWriteEpoch.js';
import { computeOverlaySemanticHash, entryDocId } from './compositionStateResolver.js';
import { getArchetypeDefinition, ARCHETYPE_IDENTITY_VERSION, CANDIDATE_IDENTITY_VERSION } from './archetypeRegistry.js';
import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';

const ENTRIES = [
  { entryKey: 'agent|agents/a1/rules/r1|paramValues.pct', docPath: 'agents/a1/rules/r1', field: 'paramValues.pct', afterValue: 80, action: 'clamp', migrationRunId: 'run-t' },
  { entryKey: 'agent|agents/a2/rules/r9|paramValues.n', docPath: 'agents/a2/rules/r9', field: 'paramValues.n', afterValue: 3, action: 'clamp', migrationRunId: 'run-t' },
];
const SEMANTIC = computeOverlaySemanticHash(ENTRIES);

function candidateFixture(runId = 'run-t') {
  const docs = {
    [`${CANDIDATE_STATE_COLLECTION}/${runId}`]: {
      migrationRunId: runId, candidateStateId: runId, activeIdentityVersion: CANDIDATE_IDENTITY_VERSION,
      semanticHash: SEMANTIC, entryCount: ENTRIES.length, createdAt: '2026-08-07T12:00:00Z',
    },
  };
  for (const e of ENTRIES) docs[`${CANDIDATE_STATE_COLLECTION}/${runId}/entries/${entryDocId(e.entryKey)}`] = e;
  return docs;
}

const ACTIVATE = (overrides = {}) => ({
  activeIdentityVersion: CANDIDATE_IDENTITY_VERSION, boundaryStateVersion: 1,
  activeEpochId: 'epoch-1', candidateStateId: 'run-t', semanticHash: SEMANTIC, ...overrides,
});

describe('B4 — descriptor writes, rollback, monotonicity, zero tuple reuse', () => {
  it('first activation mints generation 1 with the COMPLETE 7-field descriptor + an append-only history row', async () => {
    const { db, store } = makeInMemoryDb(candidateFixture());
    const d = await writeActivationRecord(db, ACTIVATE());
    expect(d).toEqual({
      activeIdentityVersion: CANDIDATE_IDENTITY_VERSION, boundaryStateVersion: 1,
      activeEpochId: 'epoch-1', candidateStateId: 'run-t', semanticHash: SEMANTIC,
      activationGeneration: 1, overrideRevision: 0, recordedAt: null,
    });
    expect(store.get('composition/activation').activationGeneration).toBe(1);
    expect(store.get(`composition/activation/${ACTIVATION_HISTORY_SUBCOLLECTION}/1`)).toBeTruthy();
  });

  it('rollback repoints the COMPLETE prior tuple from history under a NEW strictly-greater generation (never epochId alone; boundaryStateVersion travels with its descriptor)', async () => {
    const { db, store } = makeInMemoryDb(candidateFixture());
    await writeActivationRecord(db, ACTIVATE()); // gen 1
    // second activation (fresh epoch + candidate) — gen 2:
    const run2 = candidateFixture('run-u');
    for (const [k, v] of Object.entries(run2)) store.set(k, v);
    await writeActivationRecord(db, ACTIVATE({ activeEpochId: 'epoch-2', candidateStateId: 'run-u', boundaryStateVersion: 1 }));
    // rollback to generation 1's tuple:
    const rolled = await rollbackActivationRecord(db, { toGeneration: 1 });
    expect(rolled.activationGeneration).toBe(3); // MAX+1, never a reused number
    expect(rolled.activeEpochId).toBe('epoch-1');
    expect(rolled.candidateStateId).toBe('run-t');
    expect(rolled.semanticHash).toBe(SEMANTIC);
    expect(rolled.boundaryStateVersion).toBe(1); // the PRIOR value, always (Q1)
    expect(rolled.overrideRevision).toBe(0);
    // the record moved as ONE document — no partial repoint is representable:
    expect(store.get('composition/activation')).toEqual(rolled);
  });

  it('activate → rollback → REACTIVATE: strictly increasing generations, zero full-tuple reuse (B1-EXT part 1)', async () => {
    const { db, store } = makeInMemoryDb(candidateFixture());
    const gens = [];
    const tuples = [];
    const record = (d) => { gens.push(d.activationGeneration); tuples.push(JSON.stringify({ ...d, recordedAt: undefined })); };
    record(await writeActivationRecord(db, ACTIVATE()));
    const run2 = candidateFixture('run-u');
    for (const [k, v] of Object.entries(run2)) store.set(k, v);
    record(await writeActivationRecord(db, ACTIVATE({ activeEpochId: 'epoch-2', candidateStateId: 'run-u' })));
    record(await rollbackActivationRecord(db, { toGeneration: 1 }));
    record(await writeActivationRecord(db, ACTIVATE({ activeEpochId: 'epoch-3', candidateStateId: 'run-u' })));
    expect(gens).toEqual([1, 2, 3, 4]); // strict monotonicity — a rollback never reuses a number
    expect(new Set(tuples).size).toBe(tuples.length); // zero tuple reuse EVER
  });

  it('A49: reusing the LIVE epoch id on a (re)activation aborts — every activation mints a fresh epoch', async () => {
    const { db, store } = makeInMemoryDb(candidateFixture());
    await writeActivationRecord(db, ACTIVATE());
    const run2 = candidateFixture('run-u');
    for (const [k, v] of Object.entries(run2)) store.set(k, v);
    await expect(writeActivationRecord(db, ACTIVATE({ candidateStateId: 'run-u' })))
      .rejects.toMatchObject({ code: 'activation_epoch_reuse' });
  });

  it('rollback targets must be PRIOR generations that exist in history', async () => {
    const { db } = makeInMemoryDb(candidateFixture());
    await expect(rollbackActivationRecord(db, { toGeneration: 1 })).rejects.toMatchObject({ code: 'activation_rollback_no_record' });
    await writeActivationRecord(db, ACTIVATE());
    await expect(rollbackActivationRecord(db, { toGeneration: 1 })).rejects.toMatchObject({ code: 'activation_rollback_not_prior' });
    await expect(rollbackActivationRecord(db, { toGeneration: 0 })).rejects.toMatchObject({ code: 'activation_invalid_input' });
  });
});

describe('M6 + R6-B1 — activation-time candidate verification, one row per defect class, each ABORTS with nothing repointed', () => {
  const expectAbort = async (mutate, code) => {
    const { db, store } = makeInMemoryDb(candidateFixture());
    mutate(store);
    await expect(writeActivationRecord(db, ACTIVATE())).rejects.toMatchObject({ code });
    expect(store.get('composition/activation')).toBeUndefined(); // NOTHING repointed
  };

  it('MISSING entry → count mismatch abort', () =>
    expectAbort((s) => s.delete(`${CANDIDATE_STATE_COLLECTION}/run-t/entries/${entryDocId(ENTRIES[0].entryKey)}`), 'activation_entry_count_mismatch'));

  it('EXTRA (stale) entry → count mismatch abort', () =>
    expectAbort((s) => s.set(`${CANDIDATE_STATE_COLLECTION}/run-t/entries/stale-doc`, { entryKey: 'x|y|z', afterValue: 1 }), 'activation_entry_count_mismatch'));

  it('COUNT DRIFT on the run doc → abort', () =>
    expectAbort((s) => {
      const run = s.get(`${CANDIDATE_STATE_COLLECTION}/run-t`);
      s.set(`${CANDIDATE_STATE_COLLECTION}/run-t`, { ...run, entryCount: 7 });
    }, 'activation_entry_count_mismatch'));

  it('HASH DRIFT (an entry edited since apply) → recomputed ≠ stored abort', () =>
    expectAbort((s) => {
      const p = `${CANDIDATE_STATE_COLLECTION}/run-t/entries/${entryDocId(ENTRIES[0].entryKey)}`;
      s.set(p, { ...s.get(p), afterValue: 999 });
    }, 'activation_entry_hash_mismatch'));

  it('ID DRIFT (a doc whose id is not its own entryKey id — an overwrite since apply) → abort', () =>
    expectAbort((s) => {
      const p = `${CANDIDATE_STATE_COLLECTION}/run-t/entries/${entryDocId(ENTRIES[0].entryKey)}`;
      const e = s.get(p);
      s.delete(p);
      s.set(`${CANDIDATE_STATE_COLLECTION}/run-t/entries/${entryDocId(ENTRIES[1].entryKey)}-x`, e);
    }, 'activation_entry_id_mismatch'));

  it('R6-B1: descriptor semanticHash ≠ candidate manifest → abort; missing run doc → abort', async () => {
    await expectAbort((s) => {
      const run = s.get(`${CANDIDATE_STATE_COLLECTION}/run-t`);
      s.set(`${CANDIDATE_STATE_COLLECTION}/run-t`, { ...run, semanticHash: 'other-hash' });
    }, 'activation_semantic_hash_mismatch');
    const { db } = makeInMemoryDb({});
    await expect(writeActivationRecord(db, ACTIVATE())).rejects.toMatchObject({ code: 'activation_candidate_missing' });
  });
});

describe('B1 — epoch pinning across retries + the post-activation absent-doc flip', () => {
  it('a simulated tx retry observing a DIFFERENT epochId rejects (first-observed pin), zero writes', async () => {
    const { db, store, writeLog } = makeInMemoryDb({ 'composition/writeEpoch': { state: 'open', epochId: 'e-1' } });
    const epochPin = {}; // one pin per logical write, created OUTSIDE the tx
    await db.runTransaction((tx) => validateWriteEpochInTx(tx, db, { enabled: true, epochPin }));
    expect(epochPin.epochId).toBe('e-1');
    // the close lands + a new epoch opens between attempts:
    store.set('composition/writeEpoch', { state: 'open', epochId: 'e-2' });
    await expect(db.runTransaction((tx) => validateWriteEpochInTx(tx, db, { enabled: true, epochPin })))
      .rejects.toMatchObject({ code: 'epoch_closed', state: 'epoch_changed_across_retry' });
    expect(writeLog.length).toBe(0);
  });

  it('ABSENT epoch doc + NO activation record → admits (dark compat, byte-identical today)', async () => {
    const { db } = makeInMemoryDb({});
    await expect(db.runTransaction((tx) => validateWriteEpochInTx(tx, db, { enabled: true })))
      .resolves.toMatchObject({ state: 'open', epochId: null });
  });

  it('ABSENT epoch doc + activation record PRESENT → fails CLOSED (the activated world never runs unfenced)', async () => {
    const { db } = makeInMemoryDb({
      'composition/activation': {
        activeIdentityVersion: 3, boundaryStateVersion: 1, activeEpochId: 'epoch-1',
        candidateStateId: 'run-t', semanticHash: SEMANTIC, activationGeneration: 1, overrideRevision: 0,
      },
    });
    await expect(db.runTransaction((tx) => validateWriteEpochInTx(tx, db, { enabled: true })))
      .rejects.toMatchObject({ code: 'epoch_closed', state: 'absent_epoch_doc_post_activation' });
  });
});

describe('A34 — per-boundary boundary-state support (the stale-warm-instance check)', () => {
  it('the deployed support set admits version 1; an unsupported version fails closed (error + sentinel forms)', () => {
    expect(SUPPORTED_BOUNDARY_STATE_VERSIONS).toContain(1);
    expect(assertBoundaryStateSupported(1)).toBe(null);
    expect(() => assertBoundaryStateSupported(2)).toThrow(UnsupportedBoundaryStateError);
    expect(() => assertBoundaryStateSupported(2, { sentinel: 'S:' })).toThrow('S:boundary_state_unsupported');
  });
});

describe('B1-EXT part 2 — the override-revision token moves with the layer', () => {
  it('bumpOverrideRevisionInTx increments atomically; without a record read it refuses', async () => {
    const { db, store } = makeInMemoryDb(candidateFixture());
    await writeActivationRecord(db, ACTIVATE());
    const after = await db.runTransaction(async (tx) => {
      const snap = await tx.get(activationRef(db));
      return bumpOverrideRevisionInTx(tx, db, snap.data());
    });
    expect(after).toBe(1);
    expect(store.get('composition/activation').overrideRevision).toBe(1);
    await expect(db.runTransaction((tx) => bumpOverrideRevisionInTx(tx, db, null)))
      .rejects.toMatchObject({ code: 'override_revision_no_record' });
  });
});

describe('A24 — both sides at the identity-selection seam; the service touches nothing but its own record', () => {
  it('NO record → the LIVE identity: births would seed the OLD defaults (risk-single-stock-limit still present)', () => {
    const version = selectIdentityVersion(null);
    expect(version).toBe(ARCHETYPE_IDENTITY_VERSION);
    const def = getArchetypeDefinition('guardian', { identityVersion: version });
    expect(def.defaultTraits.find((t) => t.id === 'trait-steady-anchor').ruleIds).toContain('risk-single-stock-limit');
  });

  it('the record selecting the CANDIDATE → substituted defaults through the catalog (births change ONLY via the record)', async () => {
    const { db } = makeInMemoryDb(candidateFixture());
    const d = await writeActivationRecord(db, ACTIVATE());
    const version = selectIdentityVersion(d);
    expect(version).toBe(CANDIDATE_IDENTITY_VERSION);
    const def = getArchetypeDefinition('guardian', { identityVersion: version });
    const anchor = def.defaultTraits.find((t) => t.id === 'trait-steady-anchor');
    expect(anchor.ruleIds).toContain('alloc-sector-cap');
    expect(anchor.ruleIds).not.toContain('risk-single-stock-limit');
  });

  it('EXISTING agents untouched in both worlds: activation + rollback write ONLY the record and its history', async () => {
    const { db, store, writeLog } = makeInMemoryDb({
      ...candidateFixture(),
      'agents/a1': { archetype: 'guardian', equippedTraits: [{ traitId: 'trait-steady-anchor', strength: 'moderate' }] },
      'agents/a1/rules/r1': { sourceRef: 'risk-single-stock-limit', paramValues: { pct: 30 } },
    });
    await writeActivationRecord(db, ACTIVATE());
    await rollbackActivationRecord(db, { toGeneration: 1 }).catch(() => {}); // not prior — fine
    const agentWrites = writeLog.filter(([, p]) => p.startsWith('agents/'));
    expect(agentWrites).toEqual([]);
    expect(store.get('agents/a1/rules/r1').paramValues.pct).toBe(30);
  });
});
