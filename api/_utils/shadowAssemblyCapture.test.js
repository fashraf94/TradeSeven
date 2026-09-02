// api/_utils/shadowAssemblyCapture.test.js
//
// Archetype Architecture Phase 2 (P2.6) — shadow assembly + envelope
// plumbing. Locks:
//
//   1. SHADOW_ASSEMBLY_ENABLED is ON (the deliberate Phase 2 flag-flip,
//      second in the flip sequence after manifest-write `335e38de`; the
//      P2.6 merge-dark exit criterion held until that flip)
//   2. A-1 envelope: manifest-anchored (null without a manifest — no
//      envelope-less record can exist), validator-green with one, tickId =
//      cronStart + battleId
//   3. DR-10 stage 1 via the REAL exported fenced builders: identical
//      agentContext/manifest → identical:true + hashes only (payload
//      discipline); a manifest divergence → full texts + hunks
//   4. shadowDiffs writes are create-only (duplicate → loud refusal) and
//      never throw into the tick
//   5. §6.3 aggregates ride the finalUpdate object with capped append +
//      droppedBefore counter; terminal-gate matrix (transport / downgrade /
//      deliberate HOLD / action tick)
//   6. §6.4 settlement record: skipped pre-manifest; create + receiptCoverage
//      'complete' stamp on success; create-race still stamps
//
// The firebaseAdmin vi.mock is the established infra seam from
// agentPromptAssembly.controls.test.js (fetchInstitutionalContext must not
// boot Firebase). DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the fenced
// builders + fixture are imported REAL — never mock them.

import { describe, it, expect, vi } from 'vitest';
import { makeEvalBattle } from './__fixtures__/controlsPromptFixtures.js';

vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const {
  buildBehaviorRecordEnvelope,
  diffPromptTexts,
  manifestDerivedBattleView,
  buildShadowDiffRecord,
  writeShadowDiff,
  countBlockedGates,
  resolveTerminalGate,
  runShadowTickCapture,
  writeBattleSettlementRecord,
} = await import('./shadowAssemblyCapture.js');
const { validateBehaviorRecordEnvelope } = await import('./archetypeBuildSchemas.js');
const { SHADOW_ASSEMBLY_ENABLED } = await import('../../src/config/featureFlags.js');

const NOW = '2026-07-23T16:00:00.000Z';
const CRON_START = '2026-07-23T15:45:00.000Z';
const MODEL = 'claude-haiku-4-5-20251001';

// A manifest whose values MIRROR the fixture battle's agentContext — the
// identical-prompt steady state.
function mirrorManifest(battle) {
  return {
    manifestId: `m_${battle.id}`,
    manifestHash: 'mh_1',
    freezePolicyVersion: 1,
    createdAt: battle.createdAt,
    frozenLayers: {
      activeRules: battle.agentContext.activeRules,
      equippedBundleIds: [],
      standingLeans: battle.agentContext.standingLeans ?? [],
      standingLeansInvalidated: [],
      dials: null,
      deployedGuardrails: [],
      equippedWatchlist: null,
    },
    valuesAtLock: {
      archetype: battle.agentContext.archetype,
      agentName: battle.agentContext.agentName,
      strategyPreset: 'balanced',
      riskTolerance: 50,
      settingsRev: 3,
    },
    versionStamps: { settingsRevAtLock: 3, gameModeAtLock: battle.gameMode },
    guardrails: { userGuardrails: [], compiledRuleGuardrails: [], effectiveGuardrails: [] },
    renderedTensionPairs: [],
  };
}

function manifestBattle(overrides = {}) {
  const battle = makeEvalBattle();
  battle.resolvedAgentManifest = mirrorManifest(battle);
  return Object.assign(battle, overrides);
}

const emptyMarket = {
  prices: {}, macroPrices: {}, assetScores: [], triggers: [], news: [],
  momentumData: { vwap: {} }, presetConfig: { label: 'Balanced', promptGuidance: '', regime: {}, risk: {}, scoring: { minConviction: 75 } },
};

function makeFakeDb({ failCreateWith = null } = {}) {
  const created = [];
  const updated = [];
  const ref = (path) => ({
    async create(data) {
      if (failCreateWith) { const e = new Error(failCreateWith); e.code = failCreateWith === 'ALREADY_EXISTS' ? 6 : undefined; throw e; }
      created.push({ path, data });
    },
    async update(data) { updated.push({ path, data }); },
    collection(name) { return { doc: (id) => ref(`${path}/${name}/${id}`) }; },
  });
  return { created, updated, collection(name) { return { doc: (id) => ref(`${name}/${id}`) }; } };
}

describe('P2.6 activation', () => {
  it('SHADOW_ASSEMBLY_ENABLED is ON — the deliberate flag-flip this suite guards', () => {
    // Flipped false→true in the founder flag-flip PR (Phase 2 flip sequence:
    // manifest-write first `335e38de`, shadow-assembly second — capture is
    // manifest-anchored and skips pre-manifest battles). Reverting the flag
    // is likewise a deliberate act: it must edit this assertion in the same
    // commit, exactly as the flip did.
    expect(SHADOW_ASSEMBLY_ENABLED).toBe(true);
  });
});

describe('A-1 envelope (manifest-anchored)', () => {
  it('returns null without a manifest — no envelope-less record can ever exist', () => {
    expect(buildBehaviorRecordEnvelope({ battle: makeEvalBattle(), cronStartIso: CRON_START, nowIso: NOW, modelId: MODEL })).toBeNull();
  });

  it('builds a validator-green envelope from the manifest, tickId = cronStart + battleId', () => {
    const envelope = buildBehaviorRecordEnvelope({ battle: manifestBattle(), cronStartIso: CRON_START, nowIso: NOW, modelId: MODEL });
    const res = validateBehaviorRecordEnvelope(envelope);
    expect(res.errors).toEqual([]);
    expect(envelope.tickId).toBe(`${CRON_START}_battle-1`);
    expect(envelope.manifestId).toBe('m_battle-1');
    expect(envelope.effectiveRuntimeResolution.modelId).toBe(MODEL);
  });
});

describe('DR-10 stage 1 — assembly shadow through the REAL fenced builders', () => {
  it('mirror manifest → identical prompts: hashes only, no texts (payload discipline)', async () => {
    const battle = manifestBattle();
    const envelope = buildBehaviorRecordEnvelope({ battle, cronStartIso: CRON_START, nowIso: NOW, modelId: MODEL });
    const record = await buildShadowDiffRecord({ battle, envelope, market: emptyMarket });
    expect(record.identical).toBe(true);
    expect(record.texts).toBeUndefined();
    expect(record.systemHunks).toBeUndefined();
    expect(record.hashes.liveSystem).toBe(record.hashes.shadowSystem);
    expect(record.hashes.liveContext).toBe(record.hashes.shadowContext);
    // Per-side rendered rule ids ride every diff doc (the DR-10 stage-2
    // citation measure's ground truth).
    expect(record.renderedRuleIds).toEqual({ live: [], shadow: [] });
  });

  it('a manifest divergence (different frozen rules) → full texts + hunks', async () => {
    const battle = manifestBattle();
    battle.resolvedAgentManifest.frozenLayers.activeRules = [
      { ruleId: 'r1', text: 'Prefer stocks with RSI below 30', category: 'technical' },
    ];
    const envelope = buildBehaviorRecordEnvelope({ battle, cronStartIso: CRON_START, nowIso: NOW, modelId: MODEL });
    const record = await buildShadowDiffRecord({ battle, envelope, market: emptyMarket });
    expect(record.identical).toBe(false);
    // FORGE RULES render in the IDENTITY block (agentEvalPromptAssembly
    // :526-568) — the divergence surfaces there, not in the context block.
    expect(record.texts.liveIdentity).toBeTypeOf('string');
    expect(record.texts.shadowIdentity).toContain('RSI below 30');
    expect(record.identityHunks.length).toBeGreaterThan(0);
    // The live battle object was never mutated by the overlay.
    expect(battle.agentContext.activeRules).toEqual([]);
  });

  it('manifestDerivedBattleView overlays without mutating the source', () => {
    const battle = manifestBattle();
    battle.resolvedAgentManifest.valuesAtLock.agentName = 'ManifestName';
    const view = manifestDerivedBattleView(battle);
    expect(view.agentContext.agentName).toBe('ManifestName');
    expect(battle.agentContext.agentName).toBe('Atlas');
  });

  it('diffPromptTexts: identical and per-line hunks', () => {
    expect(diffPromptTexts('a\nb', 'a\nb')).toEqual({ identical: true, hunks: [] });
    const d = diffPromptTexts('a\nb\nc', 'a\nX\nc\nd');
    expect(d.identical).toBe(false);
    expect(d.hunks).toEqual([
      { line: 2, live: 'b', shadow: 'X' },
      { line: 4, live: null, shadow: 'd' },
    ]);
  });
});

describe('shadowDiffs writer — create-only, loud, never throws', () => {
  it('writes the record and reports duplicates as refusals', async () => {
    const db = makeFakeDb();
    expect(await writeShadowDiff(db, 'b1', 't1', { x: 1 })).toEqual({ written: true });
    expect(db.created[0].path).toBe('agentBattles/b1/shadowDiffs/t1');

    const dupDb = makeFakeDb({ failCreateWith: 'ALREADY_EXISTS' });
    expect(await writeShadowDiff(dupDb, 'b1', 't1', {})).toEqual({ written: false, reason: 'duplicate' });

    const errDb = makeFakeDb({ failCreateWith: 'boom' });
    expect(await writeShadowDiff(errDb, 'b1', 't1', {})).toEqual({ written: false, reason: 'write_error' });
  });
});

describe('§6.3 records', () => {
  it('countBlockedGates tallies ONLY deterministic gate tags — LLM self-reported citations never count (R1-18)', () => {
    expect(countBlockedGates([
      { citedRules: ['swap_window_cap'] },
      { citedRules: ['swap_window_cap', 'vwap_cascade_guard'] },
      // A successful-SWAP entry stuffing Haiku's cited_rules into citedRules
      // (the review-found conflation source) — must be filtered out.
      { citedRules: ['momentum_surge', 'tech-rsi-oversold'] },
      { citedRules: ['guardrail_stopLoss'] }, // EMERGENCY_BYPASS member — counts
      { citedRules: null },
    ])).toEqual({ swap_window_cap: 2, vwap_cascade_guard: 1, guardrail_stopLoss: 1 });
  });

  it('terminal-gate matrix: transport, downgrade, deliberate HOLD, action tick', () => {
    expect(resolveTerminalGate({ decision: 'SWAP' })).toBeNull();
    expect(resolveTerminalGate({ decision: 'HOLD', haikuFailure: { failureClass: 'budget_skipped', message: 'm' } }))
      .toEqual({ terminalGate: 'transport_budget_skipped', reason: 'm' });
    // PRODUCTION SHAPE: on a downgraded tick the evaluation record has ALREADY
    // nulled both symbols (agent-evaluate.js:2630, :2634-2635) — decision is
    // 'HOLD' by then, so isSwapOrProposal is false. The proposal survives only
    // on haikuResult. This row is the regression guard: reading `evaluation`
    // here recorded null/null for every downgrade since SHADOW_ASSEMBLY_ENABLED
    // went true.
    expect(resolveTerminalGate({
      decision: 'HOLD',
      downgraded: true,
      evaluation: { decision: 'HOLD', symbolOut: null, symbolIn: null },
      haikuResult: { decision: 'SWAP', symbolOut: 'A', symbolIn: 'B' },
    })).toMatchObject({ terminalGate: 'post_decision_downgrade', proposedAction: { symbolOut: 'A', symbolIn: 'B' } });
    // Fallback for a caller with no haikuResult — never the production path.
    expect(resolveTerminalGate({ decision: 'HOLD', downgraded: true, evaluation: { symbolOut: 'A', symbolIn: 'B' } }))
      .toMatchObject({ terminalGate: 'post_decision_downgrade', proposedAction: { symbolOut: 'A', symbolIn: 'B' } });
    expect(resolveTerminalGate({ decision: 'HOLD' })).toMatchObject({ terminalGate: 'haiku_hold_decision' });
  });

  it('post_decision_downgrade records WHAT WAS PROPOSED while decision records what was persisted', async () => {
    const battle = manifestBattle();
    const db = makeFakeDb();
    const finalUpdate = {};
    // The tick a downgrade site produces: haikuResult still carries the model's
    // SWAP, `decision`/`evaluation` carry the persisted HOLD with null symbols.
    await runShadowTickCapture({
      db, battle, finalUpdate,
      tick: {
        cronStartIso: CRON_START, nowIso: NOW, modelId: MODEL, market: emptyMarket,
        candidatesTested: 3,
        statusFeedEntries: [],
        decision: 'HOLD',
        evaluation: { decision: 'HOLD', symbolOut: null, symbolIn: null, downgraded: true },
        haikuFailure: null,
        downgraded: true,
        haikuResult: { decision: 'SWAP', symbolOut: 'OLD', symbolIn: 'NVDA' },
      },
    });
    const gate = finalUpdate.shadowTerminalGates.at(-1);
    expect(gate.terminalGate).toBe('post_decision_downgrade');
    expect(gate.proposedAction).toEqual({ symbolOut: 'OLD', symbolIn: 'NVDA' });
    expect(gate.reason).toBe('proposed swap downgraded to HOLD by a deterministic gate');
  });

  it('runShadowTickCapture: envelope once, awaited diff write, aggregates ride finalUpdate, capped append counts drops', async () => {
    const battle = manifestBattle({
      shadowGateAggregates: Array.from({ length: 64 }, (_, i) => ({ i })),
    });
    const db = makeFakeDb();
    const finalUpdate = {};
    const outcome = await runShadowTickCapture({
      db, battle, finalUpdate,
      tick: {
        cronStartIso: CRON_START, nowIso: NOW, modelId: MODEL, market: emptyMarket,
        candidatesTested: 5,
        statusFeedEntries: [{ citedRules: ['swap_window_cap'] }],
        decision: 'HOLD', evaluation: {}, haikuFailure: null, downgraded: false,
      },
    });
    expect(outcome.captured).toBe(true);
    expect(outcome.diffWritten).toBe(true);
    expect(db.created[0].path).toBe(`agentBattles/battle-1/shadowDiffs/${CRON_START}_battle-1`);
    expect(finalUpdate.shadowGateAggregates).toHaveLength(64); // capped
    expect(finalUpdate.shadowGateAggregates[0].droppedBefore).toBe(1); // no silent truncation
    const latest = finalUpdate.shadowGateAggregates.at(-1);
    expect(latest.candidatesTested).toBe(5);
    expect(latest.blockedCountsByGate).toEqual({ swap_window_cap: 1 });
    expect(latest.samplingMeta).toBe('none');
    expect(finalUpdate.shadowTerminalGates.at(-1).terminalGate).toBe('haiku_hold_decision');
  });

  it('pre-manifest battles are skipped entirely (no records, no writes)', async () => {
    const db = makeFakeDb();
    const finalUpdate = {};
    const outcome = await runShadowTickCapture({
      db, battle: makeEvalBattle(), finalUpdate,
      tick: { cronStartIso: CRON_START, nowIso: NOW, modelId: MODEL, market: emptyMarket, statusFeedEntries: [], decision: 'HOLD' },
    });
    expect(outcome).toEqual({ captured: false, reason: 'no_manifest' });
    expect(db.created).toEqual([]);
    expect(finalUpdate).toEqual({});
  });
});

describe('§6.4 settlement record', () => {
  const freshBattle = () => ({
    ...manifestBattle(),
    agentId: 'ag1', ownerId: 'u1', completionReason: 'expired',
    scoreState: { currentScore: 12 },
    trades: [{ exitReason: 'guardrail_stopLoss' }, { exitReason: 'guardrail_stopLoss' }, {}],
    statusFeed: [],
  });

  it('skips pre-manifest battles', async () => {
    const db = makeFakeDb();
    const res = await writeBattleSettlementRecord(db, { freshBattle: makeEvalBattle(), completedAtIso: NOW, modelId: MODEL });
    expect(res).toEqual({ written: false, reason: 'no_manifest' });
    expect(db.created).toEqual([]);
  });

  it('creates battleSettlements/{battleId} with envelope + totals and stamps receiptCoverage complete', async () => {
    const db = makeFakeDb();
    const res = await writeBattleSettlementRecord(db, { freshBattle: freshBattle(), completedAtIso: NOW, modelId: MODEL });
    expect(res).toEqual({ written: true });
    expect(db.created[0].path).toBe('battleSettlements/battle-1');
    const record = db.created[0].data;
    expect(validateBehaviorRecordEnvelope(record.envelope).valid).toBe(true);
    expect(record.deterministicEventTotals).toMatchObject({
      tradeCount: 3,
      exitReasonCounts: { guardrail_stopLoss: 2, unknown: 1 },
    });
    expect(record.retryMarker.attempt).toBe(1);
    // Agent battles cap statusFeed at 100 (review finding: a flat 50 falsely
    // reported truncation) — the assumed cap is recorded with the claim.
    expect(record.coverageStats.statusFeedCapAssumed).toBe(100);
    expect(record.coverageStats.statusFeedCapped).toBe(false);
    expect(db.updated[0]).toEqual({ path: 'agentBattles/battle-1', data: { receiptCoverage: 'complete' } });
  });

  it('a create race (record already exists) still stamps coverage complete', async () => {
    const db = makeFakeDb({ failCreateWith: 'ALREADY_EXISTS' });
    const res = await writeBattleSettlementRecord(db, { freshBattle: freshBattle(), completedAtIso: NOW, modelId: MODEL });
    expect(res).toEqual({ written: true });
    expect(db.updated[0].data).toEqual({ receiptCoverage: 'complete' });
  });
});
