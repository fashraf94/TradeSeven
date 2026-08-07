// api/_utils/compositionGenerationFence.test.js
//
// Composition PR 4 — the §7-signed fenced work, both splices, both
// directions (ledger: the decide.js REVERSED ruling + FC-1-CLOSE):
//
//   WRITE side  — a projection write derived at generation N−1 attempted
//                 after activation of N is REJECTED at the write, zero
//                 writes; the committed value carries the
//                 projectionGeneration stamp; a closed epoch rejects too.
//   READER side — a stale-stamped persisted projection is rejected by the
//                 battle-creation path; the assembler renders NOTHING for a
//                 mismatched manifest/slice generation-stamp pair (fail
//                 closed, byte-equal to dark); readers tolerate BOTH
//                 compositionCompat shapes (present and legacy-absent).
//   FC-1        — the battle writer pins the FULL descriptor before manifest
//                 resolution and re-validates at commit: an interleaved
//                 activation ABORTS with nothing created (wholly-A or
//                 wholly-B); a clean run stamps manifest + slice with the
//                 same generation + semantic identity.
//   DARK        — flag off: the same single update / add, no stamp keys
//                 (byte-identity; the PR-3 batteries pin the wider surface).

import { describe, it, expect, vi } from 'vitest';

const flagState = { fence: true, compiledIdentity: true };
vi.mock('./compositionConfig.js', () => ({
  get COMPOSITION_ENFORCEMENT_MODE() { return 'off'; },
  get COMPOSITION_EPOCH_FENCE_ENABLED() { return flagState.fence; },
  get COMPOSITION_MIGRATION_FEED_ENABLED() { return false; },
  get COMPOSITION_COMPILED_IDENTITY_ENABLED() { return flagState.compiledIdentity; },
}));

const {
  pinActivationDescriptor, commitActiveRulesProjection, assertProjectionCurrent,
  manifestGenerationStamp, commitBattleDocWithPin, ProjectionStaleError, CutoverInterleavedError,
} = await import('./compositionGenerationFence.js');
const { createAgentBattle } = await import('./agentBattleService.js');
const { buildAgentIdentityBlock } = await import('./agentEvalPromptAssembly.js');
const { makeInMemoryDb } = await import('./__fixtures__/inMemoryFirestore.js');

const DESC_A = Object.freeze({
  activeIdentityVersion: 3, boundaryStateVersion: 1, activeEpochId: 'ep-A',
  candidateStateId: 'run-A', semanticHash: 'sem-A', activationGeneration: 1, overrideRevision: 0,
});
const DESC_B = Object.freeze({ ...DESC_A, activeEpochId: 'ep-B', candidateStateId: 'run-B', semanticHash: 'sem-B', activationGeneration: 2 });

const RULES = [{ ruleId: 'rd-1', text: 'Cap any single sector at 60% of portfolio', category: 'allocation', hardness: 'hard' }];
const ADVISORY = 'the agent is instructed that the cap limits how much a leading sector may hold, not whether leading sectors are preferred.';

function makeAgentData(overrides = {}) {
  return {
    id: 'agent-1', ownerId: 'user-1', name: 'Viper', archetype: 'momentum_chaser', settingsRev: 7,
    activeRules: RULES.map((r) => ({ ...r })),
    lastDecision: {
      portfolio: {
        star: [{ symbol: 'AAPL', name: 'Apple', baseATR: 3 }, { symbol: 'MSFT', name: 'Microsoft', baseATR: 3 }],
        core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
        support: [{ symbol: 'GOOGL' }, { symbol: 'META' }, { symbol: 'BTC', isCrypto: true }],
      },
      bench: { stocks: [{ symbol: 'TSLA' }, { symbol: 'NFLX' }, { symbol: 'CRM' }], crypto: { symbol: 'ETH', isCrypto: true } },
      strategyBrief: 'brief', innerMonologue: {},
      watchlist: { active: [], hotBench: [], monitoring: [], lastRefreshed: null, totalStocks: 0 },
    },
    ...overrides,
  };
}

const candidateBuild = () => ({
  buildVersion: 7, contentHash: 'ch-1', parentIdentityVersion: 2, identityHash: 'ih-1',
  compatVerdicts: [{ ruleId: 'rd-1', verdict: 'tension', advisory: ADVISORY, narrowedParams: { pct: { min: 40, max: 80 } } }],
  renderedTensionCandidates: [], blockedControls: [],
  validation: { pass: true, errors: [] },
});

describe('the decide.js projection splice — WRITE direction', () => {
  it('a write derived at generation N−1 after activation of N REJECTS with zero agent writes (Sol\'s counterexample closed)', async () => {
    flagState.fence = true;
    const { db, store, writeLog } = makeInMemoryDb({
      'composition/activation': { ...DESC_A },
      'composition/writeEpoch': { state: 'open', epochId: 'ep-A' }, // the activated world runs with an OPEN epoch doc (B1)
      'agents/agent-1': { activeRules: [] },
    });
    const pin = await pinActivationDescriptor(db);
    expect(pin.descriptor.activationGeneration).toBe(1);
    store.set('composition/activation', { ...DESC_B }); // the flip lands mid-window
    await expect(commitActiveRulesProjection(db, db.collection('agents').doc('agent-1'), RULES, pin))
      .rejects.toBeInstanceOf(ProjectionStaleError);
    expect(writeLog.filter(([, p]) => p.startsWith('agents/'))).toEqual([]);
  });

  it('a clean lit write carries the projectionGeneration + semanticHash stamp', async () => {
    flagState.fence = true;
    const { db, store } = makeInMemoryDb({
      'composition/activation': { ...DESC_A },
      'composition/writeEpoch': { state: 'open', epochId: 'ep-A' },
      'agents/agent-1': { activeRules: [] },
    });
    const pin = await pinActivationDescriptor(db);
    const out = await commitActiveRulesProjection(db, db.collection('agents').doc('agent-1'), RULES, pin);
    expect(out.stamped).toBe(true);
    expect(store.get('agents/agent-1').activeRulesProjection).toEqual({ projectionGeneration: 1, semanticHash: 'sem-A' });
    expect(store.get('agents/agent-1').activeRules).toEqual(RULES);
  });

  it('lit PRE-ACTIVATION (no record): the write proceeds with NO stamp key — byte-identical to today', async () => {
    flagState.fence = true;
    const { db, store } = makeInMemoryDb({ 'agents/agent-1': { activeRules: [] } });
    const pin = await pinActivationDescriptor(db);
    const out = await commitActiveRulesProjection(db, db.collection('agents').doc('agent-1'), RULES, pin);
    expect(out.stamped).toBe(false);
    expect('activeRulesProjection' in store.get('agents/agent-1')).toBe(false);
  });

  it('DARK: the exact single update, no stamp, no activation/epoch reads', async () => {
    flagState.fence = false;
    const { db, store, writeLog, readLog } = makeInMemoryDb({ 'agents/agent-1': { activeRules: [] } });
    const pin = await pinActivationDescriptor(db);
    expect(pin.dark).toBe(true);
    await commitActiveRulesProjection(db, db.collection('agents').doc('agent-1'), RULES, pin);
    expect(writeLog).toEqual([['update', 'agents/agent-1']]);
    // §2 pass-2 L2-1: the "zero reads" half of A23, now FALSIFIABLE — the
    // fixture logs reads, so a dark path that gains one Firestore read
    // (e.g. the enabled check reordered after the descriptor read) fails
    // HERE, not silently in production.
    expect(readLog).toEqual([]);
    expect('activeRulesProjection' in store.get('agents/agent-1')).toBe(false);
  });

  it('a CLOSED epoch at commit rejects the projection write (the epoch belt rides the same transaction)', async () => {
    flagState.fence = true;
    const { db, writeLog } = makeInMemoryDb({
      'composition/activation': { ...DESC_A },
      'composition/writeEpoch': { state: 'closed', epochId: 'e-x' },
      'agents/agent-1': { activeRules: [] },
    });
    const pin = await pinActivationDescriptor(db);
    await expect(commitActiveRulesProjection(db, db.collection('agents').doc('agent-1'), RULES, pin))
      .rejects.toMatchObject({ code: 'epoch_closed' });
    expect(writeLog.filter(([, p]) => p.startsWith('agents/'))).toEqual([]);
  });
});

describe('the decide.js projection splice — READER direction', () => {
  it('a stale-stamped persisted projection is rejected (error + sentinel forms); unstamped legacy docs and current stamps pass', () => {
    const stale = { activeRulesProjection: { projectionGeneration: 1, semanticHash: 'sem-A' } };
    expect(() => assertProjectionCurrent(stale, DESC_B)).toThrow(ProjectionStaleError);
    expect(() => assertProjectionCurrent(stale, null)).toThrow(ProjectionStaleError);
    expect(() => assertProjectionCurrent(stale, DESC_B, { sentinel: 'S:' })).toThrow('S:projection_stale_generation');
    expect(assertProjectionCurrent({ }, DESC_B)).toBe(null);                 // legacy/dark — tolerated
    expect(assertProjectionCurrent(stale, DESC_A)).toBe(null);               // current — passes
  });

  it('createAgentBattle REJECTS a stale-stamped agent before any write (the reader path wired through FC-1)', async () => {
    flagState.fence = true;
    const { db, writeLog } = makeInMemoryDb({ 'composition/activation': { ...DESC_B } });
    const agent = makeAgentData({ activeRulesProjection: { projectionGeneration: 1, semanticHash: 'sem-A' } });
    await expect(createAgentBattle(db, agent, {}, {}, {})).rejects.toBeInstanceOf(ProjectionStaleError);
    expect(writeLog).toEqual([]);
  });
});

describe('FC-1-CLOSE — cutover atomicity', () => {
  it('an activation interleaved between pin and commit ABORTS the battle write with NOTHING created', async () => {
    flagState.fence = true;
    const { db, store, writeLog } = makeInMemoryDb({ 'composition/activation': { ...DESC_A } });
    const pin = { dark: false, descriptor: { ...DESC_A } }; // pinned before manifest resolution
    store.set('composition/activation', { ...DESC_B });     // the cutover lands
    await expect(commitBattleDocWithPin(db, { agentId: 'agent-1' }, pin))
      .rejects.toBeInstanceOf(CutoverInterleavedError);
    expect(writeLog.filter(([, p]) => p.startsWith('agentBattles/'))).toEqual([]);
    expect([...store.keys()].filter((k) => k.startsWith('agentBattles/'))).toEqual([]);
  });

  it('a clean lit run creates a battle whose manifest AND slice carry the SAME generation + semantic identity (wholly one generation)', async () => {
    flagState.fence = true;
    const { db, store } = makeInMemoryDb({ 'composition/activation': { ...DESC_A } });
    await createAgentBattle(db, makeAgentData(), {}, {}, { compiledBuild: candidateBuild() });
    const battles = [...store.keys()].filter((k) => k.startsWith('agentBattles/') && !k.slice('agentBattles/'.length).includes('/'));
    expect(battles.length).toBe(1);
    const doc = store.get(battles[0]);
    expect(doc.resolvedAgentManifest.compositionSourceGeneration).toBe(1);
    expect(doc.resolvedAgentManifest.compositionSemanticHash).toBe('sem-A');
    expect(doc.resolvedAgentManifest.compositionCompat.sourceGeneration).toBe(1); // the slice half of the pair
    expect(doc.resolvedAgentManifest.compositionCompat.entries[0].advisory).toBe(ADVISORY);
  });

  it('pre-activation lit + dark runs add NO stamp keys (manifest byte-identity holds)', async () => {
    flagState.fence = true;
    const { db, store } = makeInMemoryDb({});
    await createAgentBattle(db, makeAgentData(), {}, {}, { compiledBuild: candidateBuild() });
    const doc = store.get([...store.keys()].find((k) => k.startsWith('agentBattles/')));
    expect('compositionSourceGeneration' in doc.resolvedAgentManifest).toBe(false);
    expect('sourceGeneration' in doc.resolvedAgentManifest.compositionCompat).toBe(false);
    expect(manifestGenerationStamp({ dark: true, descriptor: null })).toBe(null);
    expect(manifestGenerationStamp({ dark: false, descriptor: null })).toBe(null);
  });

  it('DARK createAgentBattle does ZERO activation/epoch reads (A23 falsifiable at the battle seam too)', async () => {
    flagState.fence = false;
    const { db, readLog } = makeInMemoryDb({});
    await createAgentBattle(db, makeAgentData(), {}, {}, { compiledBuild: candidateBuild() });
    expect(readLog.filter(([, p]) => p.startsWith('composition'))).toEqual([]);
  });

  it('the THREADED flow pin (§2 pass-2 L2-3): an activation landing between the caller\'s pin and the battle commit ABORTS the whole createAgentBattle — the compiled-build window is inside the fence', async () => {
    flagState.fence = true;
    const { db, store, writeLog } = makeInMemoryDb({ 'composition/activation': { ...DESC_A } });
    // decide.js takes this pin BEFORE the projection and BEFORE
    // ensureDeployableCompiledBuild, then threads it via options — so a flip
    // that lands during build verification (after the caller derived
    // compiledBuild, before createAgentBattle was even entered) is caught by
    // the commit-time re-validation, unstamped legacy agent or not.
    const flowPin = { dark: false, descriptor: { ...DESC_A } };
    store.set('composition/activation', { ...DESC_B }); // the cutover lands in the caller's window
    await expect(createAgentBattle(db, makeAgentData(), {}, {}, { compiledBuild: candidateBuild(), activationPin: flowPin }))
      .rejects.toBeInstanceOf(CutoverInterleavedError);
    expect(writeLog.filter(([, p]) => p.startsWith('agentBattles/'))).toEqual([]);
    expect([...store.keys()].filter((k) => k.startsWith('agentBattles/'))).toEqual([]);
  });
});

describe('FC-1 — readers tolerate both compositionCompat shapes; mismatched stamps render NOTHING', () => {
  const battleWith = (manifest) => ({
    gameMode: 'clash',
    agentContext: { name: 'Viper', archetype: 'momentum_chaser', activeRules: RULES.map((r) => ({ ...r })) },
    ...(manifest ? { resolvedAgentManifest: manifest } : {}),
  });
  const slice = (sourceGeneration) => ({
    ...(sourceGeneration != null ? { sourceGeneration } : {}),
    entries: [{ ruleId: 'rd-1', verdict: 'tension', advisory: ADVISORY, narrowedParams: null }],
  });

  it('WITH the slice + CONSISTENT stamps → the advisory renders exactly once', () => {
    flagState.compiledIdentity = true;
    const out = buildAgentIdentityBlock(battleWith({ compositionSourceGeneration: 1, compositionCompat: slice(1) }));
    expect(out.split(`— Advisory: ${ADVISORY}`).length - 1).toBe(1);
  });

  it('LEGACY-ABSENT slice (every battle today) → renders fine, zero advisory bytes', () => {
    flagState.compiledIdentity = true;
    const out = buildAgentIdentityBlock(battleWith(null));
    expect(out).toContain('Cap any single sector');
    expect(out.split('Advisory:').length - 1).toBe(0);
  });

  it('MISMATCHED manifest/slice stamps (a stale or tampered mix) → renders NOTHING, byte-equal to dark', () => {
    flagState.compiledIdentity = true;
    const lit = buildAgentIdentityBlock(battleWith({ compositionSourceGeneration: 2, compositionCompat: slice(1) }));
    flagState.compiledIdentity = false;
    const dark = buildAgentIdentityBlock(battleWith({ compositionSourceGeneration: 2, compositionCompat: slice(1) }));
    expect(lit).toBe(dark);
  });

  it('HALF-STAMPED pairs are malformed → render NOTHING (either half alone)', () => {
    flagState.compiledIdentity = true;
    const sliceOnly = buildAgentIdentityBlock(battleWith({ compositionCompat: slice(1) }));
    const manifestOnly = buildAgentIdentityBlock(battleWith({ compositionSourceGeneration: 1, compositionCompat: slice(null) }));
    expect(sliceOnly.split('Advisory:').length - 1).toBe(0);
    expect(manifestOnly.split('Advisory:').length - 1).toBe(0);
  });
});

describe('the decide.js catch fix (§2 review F1) — static source guard (the decide.auth.test.js pattern)', () => {
  // No test drives the decide handler end-to-end (its fixture surface is the
  // whole deploy), so the F1 fix — fence rejections must 409, never ride the
  // projection fail-open — is locked as a source guard: the two fence codes
  // must map to status(409) BEFORE the fail-open console.error. Reverting the
  // catch fix fails here, not in production.
  it('the projection catch maps projection_stale_generation + epoch_closed to a 409 ahead of the fail-open arm', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../agent/decide.js', import.meta.url), 'utf8');
    const catchIdx = src.indexOf("catch (projErr)");
    expect(catchIdx).toBeGreaterThan(-1);
    const fenceGate = src.indexOf("projErr?.code === 'projection_stale_generation' || projErr?.code === 'epoch_closed'", catchIdx);
    const the409 = src.indexOf('status(409).json({ error: projErr.code })', catchIdx);
    const failOpen = src.indexOf('activeRules projection FAILED', catchIdx);
    expect(fenceGate).toBeGreaterThan(-1);
    expect(the409).toBeGreaterThan(-1);
    expect(failOpen).toBeGreaterThan(-1);
    expect(fenceGate).toBeLessThan(failOpen); // the fence gate runs FIRST
    expect(the409).toBeLessThan(failOpen);
  });

  it('the flow pin precedes the compiled-build gate and is threaded into BOTH createAgentBattle call sites (§2 pass-2 L2-3 source guard)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../agent/decide.js', import.meta.url), 'utf8');
    const pinIdx = src.indexOf('const projectionPin = await pinActivationDescriptor(db)');
    const firstGate = src.indexOf('await ensureDeployableCompiledBuild(');
    expect(pinIdx).toBeGreaterThan(-1);
    expect(firstGate).toBeGreaterThan(-1);
    expect(pinIdx, 'the pin must be taken BEFORE compiled-build verification — otherwise an activation landing in the build-gate window stamps N+1 over N-derived content with AGREEING stamp halves').toBeLessThan(firstGate);
    // Both battle call sites (tiered + tournament) thread the pin:
    expect(src.split('activationPin: projectionPin').length - 1).toBe(2);
    // The tournament fork hands the SAME flow pin down:
    expect(src.includes('runPrescribedTournamentDeploy({ db, req, res, agentRef, agent, agentId: agentDoc.id, projectionPin })')).toBe(true);
  });
});
