// api/agent/masteryEnforcement.behavior.test.js
//
// Archetype Mastery P2 — endpoint truth-table rows (spec §7), driven through
// the REAL handlers with getter-mocked flags (the equip-lean.behavior
// precedent: code constants in prod, mutable only here) and the shared
// mastery mock db. The archetypeAdjustments menu/version/conflict kernel and
// the leanRevalidation kernel run UN-mocKED (BUILD_RULES §4 — never mock the
// kernel).
//
// Explicit rows (founder-directed):
//   0·1·0  — ENFORCEMENT without XP: entitlements frozen at the last
//            profile; caps/gates read identically to 1·1·0.
//   1·1·0  — ENFORCEMENT with XP, no surface: same enforcement behavior
//            (server enforcement is flag-view-independent by construction).
// Plus: dark byte-behavior (ENF off → baseline caps, no profile reads, no
// stamps, aggressive un-gated), missing-profile baselines, grandfathering +
// the one-way L1 aggressive rule, and the A8-exempt dark Forge hardening.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { flagState, authReturnValue } = vi.hoisted(() => ({
  flagState: { enf: true, xp: false, leansEnabled: true, tempoEnabled: true },
  authReturnValue: { current: { uid: 'test-user' } },
}));

let activeDb = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => activeDb,
}));
vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => authReturnValue.current,
}));
vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async () => {},
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('../../src/config/featureFlags.js', () => ({
  get STANDING_LEANS_ENABLED() { return flagState.leansEnabled; },
  get TEMPO_DIAL_ENABLED() { return flagState.tempoEnabled; },
  get RULE_COMPAT_MODE() { return 'off'; },
  get CONFLICT_RECONCILER_DETECT_ENABLED() { return false; },
}));
vi.mock('../_utils/masteryConfig.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get MASTERY_ENFORCEMENT_ENABLED() { return flagState.enf; },
    get MASTERY_XP_ENABLED() { return flagState.xp; },
  };
});

const { default: equipLeanHandler } = await import('./equip-lean.js');
const { default: setTempoDialHandler } = await import('./set-tempo-dial.js');
const { default: equipBundleHandler } = await import('./equip-bundle.js');
const { default: reforgeBundleHandler } = await import('./reforge-bundle.js');
const { makeMockDb } = await import('../_utils/__fixtures__/masteryMockDb.js');
const { buildCustomizationSnapshot } = await import('../_utils/leanRevalidation.js');
const { LEVEL_XP_THRESHOLDS } = await import('../_utils/masteryFormula.js');

const xpFor = (level) => LEVEL_XP_THRESHOLDS[level - 1];
const GUARDIAN_PROFILE = (level) => ({ archetypes: { guardian: { xp: xpFor(level) } } });

const AGENT = (over = {}) => ({
  ownerId: 'test-user',
  archetype: 'guardian',
  standingLeans: [],
  stats: { gamesPlayed: 0 },
  equippedBundleIds: [],
  ...over,
});

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function call(handler, body) {
  const res = makeRes();
  await handler({ method: 'POST', body, headers: {} }, res);
  return res;
}

const equipLean = (adjustmentId) => call(equipLeanHandler, { agentId: 'agent-1', adjustmentId, version: 1 });
const setTempo = (tempo) => call(setTempoDialHandler, { agentId: 'agent-1', tempo });

beforeEach(() => {
  flagState.enf = true;
  flagState.xp = false;
  activeDb = null;
});

describe('lean caps — the chokepoint half of the D1 dual anchor', () => {
  it('0·1·0 (ENF on, XP off): a frozen L3 profile grants the third slot; the resolved cap is stamped', async () => {
    activeDb = makeMockDb({
      'agents/agent-1': AGENT(),
      'masteryProfiles/test-user': GUARDIAN_PROFILE(3),
    });
    for (const id of ['CP-01', 'CP-02', 'CP-03']) {
      const res = await equipLean(id);
      expect(res.statusCode).toBe(200);
    }
    const agent = activeDb.__dump('agents/agent-1');
    expect(agent.standingLeans).toHaveLength(3);
    expect(agent.masteryLeanCap).toBeUndefined(); // review redesign: no stamp — nothing doc-trusted
  });

  it('1·1·0 (ENF on, XP on): identical enforcement — the caps are flag-view-independent', async () => {
    flagState.xp = true;
    activeDb = makeMockDb({
      'agents/agent-1': AGENT(),
      'masteryProfiles/test-user': GUARDIAN_PROFILE(3),
    });
    for (const id of ['CP-01', 'CP-02', 'CP-03']) {
      expect((await equipLean(id)).statusCode).toBe(200);
    }
    expect(activeDb.__dump('agents/agent-1').standingLeans).toHaveLength(3);
  });

  it('ENF on + missing profile: baseline 2 (spec §7) — the third pin is lean_limit, with the RESOLVED cap in the payload (§9)', async () => {
    activeDb = makeMockDb({ 'agents/agent-1': AGENT() });
    expect((await equipLean('CP-01')).statusCode).toBe(200);
    expect((await equipLean('CP-02')).statusCode).toBe(200);
    const third = await equipLean('CP-03');
    expect(third.statusCode).toBe(409);
    expect(third.body.error).toBe('lean_limit');
    expect(third.body.leanCap).toBe(2); // the number the decision used
    expect(third.body.message).not.toMatch(/at most 2/); // copy never bakes a number
  });

  it('M5: other-archetype pins at rest are PRESERVED but never consume slots (dark row — the counting rule is flag-independent)', async () => {
    flagState.enf = false;
    // Two degen pins survive from a switched-away archetype (durable desired
    // state). Pre-M5 they filled the whole baseline cap; now the guardian
    // count starts at zero.
    const degenPins = [
      { adjustmentId: 'SP-01', version: 1, equippedAt: '2026-07-01T00:00:00.000Z' },
      { adjustmentId: 'SP-06', version: 1, equippedAt: '2026-07-02T00:00:00.000Z' },
    ];
    activeDb = makeMockDb({ 'agents/agent-1': AGENT({ standingLeans: degenPins }) });
    expect((await equipLean('CP-01')).statusCode).toBe(200);
    expect((await equipLean('CP-02')).statusCode).toBe(200);
    const third = await equipLean('CP-03');
    expect(third.statusCode).toBe(409);
    expect(third.body.error).toBe('lean_limit');
    // equippedCount is the KERNEL-ACCEPTED current-archetype count — 2, not 4.
    expect(third.body.equippedCount).toBe(2);
    const pins = activeDb.__dump('agents/agent-1').standingLeans.map((l) => l.adjustmentId);
    expect(pins).toEqual(['SP-01', 'SP-06', 'CP-01', 'CP-02']); // degen desired state intact
  });

  it('M5: a kernel-OMITTED (deprecated-version) pin never vetoes its conflict-group opposite — both set checks read the ACCEPTED set', async () => {
    flagState.enf = false;
    // CP-04 rests at a stale version: it consumes no slot, projects nowhere,
    // and the client marks its opposite CP-05 available (validIds-based) —
    // the server must agree, not 409 off invisible state.
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({
        standingLeans: [{ adjustmentId: 'CP-04', version: 0, equippedAt: '2026-07-01T00:00:00.000Z' }],
      }),
    });
    const res = await equipLean('CP-05');
    expect(res.statusCode).toBe(200);
    // The stale pin is preserved (durable desired state) beside the new one.
    expect(activeDb.__dump('agents/agent-1').standingLeans.map((l) => l.adjustmentId)).toEqual(['CP-04', 'CP-05']);
    // And once CP-05 is ACCEPTED, re-confirming CP-04 at the current version
    // hits the conflict gate — coherent in both directions.
    const reconfirm = await equipLean('CP-04');
    expect(reconfirm.statusCode).toBe(409);
    expect(reconfirm.body.error).toBe('conflicting_lean');
    expect(reconfirm.body.conflictsWith).toEqual(['CP-05']);
  });

  it('M5 edge: re-confirming a DEPRECATED-version pin at full cap consumes a slot (the accepted set may never outgrow the entitlement)', async () => {
    flagState.enf = false;
    // CP-04 pinned at a stale version (kernel omits it — not counted), the
    // two baseline slots filled by accepted pins.
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({
        standingLeans: [
          { adjustmentId: 'CP-04', version: 0, equippedAt: '2026-07-01T00:00:00.000Z' },
          { adjustmentId: 'CP-01', version: 1, equippedAt: '2026-07-02T00:00:00.000Z' },
          { adjustmentId: 'CP-02', version: 1, equippedAt: '2026-07-03T00:00:00.000Z' },
        ],
      }),
    });
    // The re-confirm gesture (same id at the CURRENT version) is a refresh
    // write-wise, but slot-wise it would ADD an accepted pin — denied at cap.
    const reconfirm = await equipLean('CP-04');
    expect(reconfirm.statusCode).toBe(409);
    expect(reconfirm.body.error).toBe('lean_limit');
    expect(reconfirm.body.equippedCount).toBe(2);
    // Unequip one accepted pin, and the re-confirm goes through.
    await activeDb.collection('agents').doc('agent-1').update({
      standingLeans: activeDb.__dump('agents/agent-1').standingLeans.filter((l) => l.adjustmentId !== 'CP-02'),
    });
    expect((await equipLean('CP-04')).statusCode).toBe(200);
  });

  it('M5 × ENF: an L3 grant applies to the current-archetype count (cross-archetype pins riding along)', async () => {
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({
        standingLeans: [{ adjustmentId: 'SP-01', version: 1, equippedAt: '2026-07-01T00:00:00.000Z' }],
      }),
      'masteryProfiles/test-user': GUARDIAN_PROFILE(3),
    });
    for (const id of ['CP-01', 'CP-02', 'CP-03']) {
      expect((await equipLean(id)).statusCode).toBe(200); // 3 guardian slots at L3
    }
    const fourth = await equipLean('CP-06');
    expect(fourth.statusCode).toBe(409);
    expect(fourth.body.leanCap).toBe(3);
    expect(fourth.body.equippedCount).toBe(3);
    expect(activeDb.__dump('agents/agent-1').standingLeans).toHaveLength(4); // 1 degen + 3 guardian
  });

  it('DARK (ENF off): baseline cap even with an L3 profile; ZERO profile reads; no stamp', async () => {
    flagState.enf = false;
    activeDb = makeMockDb({
      'agents/agent-1': AGENT(),
      'masteryProfiles/test-user': GUARDIAN_PROFILE(3),
    });
    activeDb.__resetReads();
    expect((await equipLean('CP-01')).statusCode).toBe(200);
    expect((await equipLean('CP-02')).statusCode).toBe(200);
    expect((await equipLean('CP-03')).statusCode).toBe(409);
    const reads = activeDb.__readCounts();
    expect(reads['masteryProfiles/test-user']).toBeUndefined(); // dark = no mastery I/O
    expect(activeDb.__dump('agents/agent-1').masteryLeanCap).toBeUndefined();
  });
});

describe('dial gate — SETTING aggressive only; equipped state grandfathers', () => {
  it('ENF on + missing profile (level 1): aggressive is dial_locked; measured/standard stay open', async () => {
    activeDb = makeMockDb({ 'agents/agent-1': AGENT() });
    const blocked = await setTempo('aggressive');
    expect(blocked.statusCode).toBe(403);
    expect(blocked.body.error).toBe('dial_locked');
    expect((await setTempo('measured')).statusCode).toBe(200);
  });

  it('ENF on + L2 profile: aggressive allowed (0·1·0 and 1·1·0 identically)', async () => {
    for (const xpFlag of [false, true]) {
      flagState.xp = xpFlag;
      activeDb = makeMockDb({
        'agents/agent-1': AGENT(),
        'masteryProfiles/test-user': GUARDIAN_PROFILE(2),
      });
      expect((await setTempo('aggressive')).statusCode).toBe(200);
      expect(activeDb.__dump('agents/agent-1').dials.tempo).toBe('aggressive');
    }
  });

  it('grandfathering: an equipped aggressive dial re-asserts as an idempotent no-op below L2 — and leaving is ONE-WAY until L2', async () => {
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({ dials: { tempo: 'aggressive' } }), // grandfathered from pre-mastery
    });
    // Re-asserting the equipped value: no-op 200, never gated.
    expect((await setTempo('aggressive')).statusCode).toBe(200);
    expect(activeDb.__dump('agents/agent-1').dials.tempo).toBe('aggressive');
    // Leaving is allowed…
    expect((await setTempo('standard')).statusCode).toBe(200);
    // …and returning at L1 is blocked: the documented one-way door.
    const back = await setTempo('aggressive');
    expect(back.statusCode).toBe(403);
    expect(back.body.error).toBe('dial_locked');
  });

  it('DARK (ENF off): aggressive un-gated (today’s behavior), no profile read', async () => {
    flagState.enf = false;
    activeDb = makeMockDb({ 'agents/agent-1': AGENT() });
    activeDb.__resetReads();
    expect((await setTempo('aggressive')).statusCode).toBe(200);
    expect(activeDb.__readCounts()['masteryProfiles/test-user']).toBeUndefined();
  });

  it('Q7 SEQUENCE: a §8 correct-down clamps the dial through the SHARED rule, and the set-tempo-dial idempotent branch cannot resurrect it', async () => {
    const { revalidateTempoDial, archetypeLevelFromProfile } = await import('../_utils/masteryEnforcement.js');
    // Legally aggressive at L2.
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({ dials: { tempo: 'aggressive' } }),
      'masteryProfiles/test-user': GUARDIAN_PROFILE(2),
    });
    // CONTRAST (grandfathering, pre-correction): the idempotent branch keeps
    // an equipped aggressive alive without consulting the gate.
    expect((await setTempo('aggressive')).statusCode).toBe(200);

    // The correction lands: guardian drops below L2…
    await activeDb.collection('masteryProfiles').doc('test-user').set(GUARDIAN_PROFILE(1));
    // …and the §8 clamp pass re-validates the dial with the SAME kernel the
    // switch rider uses (ruling Q7: dials and leans re-validate together —
    // this is the pass the corrections applier must run, dial half).
    const corrected = activeDb.__dump('masteryProfiles/test-user');
    const verdict = revalidateTempoDial({
      tempo: activeDb.__dump('agents/agent-1').dials.tempo,
      level: archetypeLevelFromProfile(corrected, 'guardian'),
    });
    expect(verdict).toEqual({ tempo: 'standard', invalidated: true }); // → notice rider fires in P3
    await activeDb.collection('agents').doc('agent-1').update({ 'dials.tempo': verdict.tempo });

    // Resurrection attempt: no longer idempotent, so the L2 gate fires —
    // the corrected-down user cannot ride the grandfather branch back in.
    const back = await setTempo('aggressive');
    expect(back.statusCode).toBe(403);
    expect(back.body.error).toBe('dial_locked');
    expect(activeDb.__dump('agents/agent-1').dials.tempo).toBe('standard');
  });
});

describe('kernel half of the dual anchor — the shared per-call cap default (review redesign: structural max, ONE source for every caller)', () => {
  const THREE_LEANS = [
    { adjustmentId: 'CP-01', version: 1, equippedAt: '2026-07-20T13:00:00.000Z' },
    { adjustmentId: 'CP-02', version: 1, equippedAt: '2026-07-20T13:01:00.000Z' },
    { adjustmentId: 'CP-03', version: 1, equippedAt: '2026-07-20T13:02:00.000Z' },
  ];
  const AGENT_DATA = { id: 'agent-1', archetype: 'guardian', standingLeans: THREE_LEANS };

  it('ENF on: a chokepoint-granted 3-lean set survives EVERY kernel path — snapshot AND legacy two-field callers (the fenced prompt / client display shape)', async () => {
    const { revalidateStandingLeans } = await import('../_utils/leanRevalidation.js');
    const snap = buildCustomizationSnapshot(AGENT_DATA, '2026-07-21T00:00:00.000Z');
    expect(snap.standingLeans).toHaveLength(3);
    expect(snap.standingLeansInvalidated).toHaveLength(0);
    // The legacy call shape (no cap channel) resolves the SAME cap — the §9
    // one-source property that the stamped-field design broke.
    const legacy = revalidateStandingLeans({ standingLeans: THREE_LEANS, archetypeCodeId: 'guardian' });
    expect(legacy.valid).toHaveLength(3);
  });

  it('ENF on: the structural max still clamps degenerate sets (5 pins → 4)', async () => {
    const { revalidateStandingLeans } = await import('../_utils/leanRevalidation.js');
    const five = ['CP-01', 'CP-02', 'CP-03', 'CP-06', 'CP-07'].map((id, i) => ({
      adjustmentId: id, version: 1, equippedAt: `2026-07-20T13:0${i}:00.000Z`,
    }));
    const r = revalidateStandingLeans({ standingLeans: five, archetypeCodeId: 'guardian' });
    expect(r.valid).toHaveLength(4);
    expect(r.invalidated).toEqual([expect.objectContaining({ reason: 'over_cap' })]);
  });

  it('ENF off: baseline clamps the third (OVER_CAP) — byte-identical to today', () => {
    flagState.enf = false;
    const snap = buildCustomizationSnapshot(AGENT_DATA, '2026-07-21T00:00:00.000Z');
    expect(snap.standingLeans).toHaveLength(2);
    expect(snap.standingLeansInvalidated).toEqual([
      expect.objectContaining({ adjustmentId: 'CP-03', reason: 'over_cap' }),
    ]);
  });

  it('an explicit leanCap param (the §8 corrections channel) overrides the default', async () => {
    const { revalidateStandingLeans } = await import('../_utils/leanRevalidation.js');
    const r = revalidateStandingLeans({ standingLeans: THREE_LEANS, archetypeCodeId: 'guardian', leanCap: 2 });
    expect(r.valid).toHaveLength(2); // a correction-injected reduced entitlement clamps
  });
});

describe('dial invalidation on archetype switch (V2.1 STOP-B: customization switches/invalidates)', () => {
  it('ENF on: an aggressive dial re-validates against the NEW archetype level — below L2 it resets to standard in the same commit', async () => {
    const { default: changeArchetypeHandler } = await import('./change-archetype.js');
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({ dials: { tempo: 'aggressive' } }), // earned on guardian
      // No degen stream on the profile → level 1 on the target archetype.
      'masteryProfiles/test-user': GUARDIAN_PROFILE(3),
    });
    const res = await call(changeArchetypeHandler, { agentId: 'agent-1', archetype: 'degen' });
    expect(res.statusCode).toBe(200);
    const agent = activeDb.__dump('agents/agent-1');
    expect(agent.archetype).toBe('degen');
    expect(agent.dials.tempo).toBe('standard'); // invalidated with the switch
  });

  it('ENF off: the dial carries untouched (byte-identical)', async () => {
    flagState.enf = false;
    const { default: changeArchetypeHandler } = await import('./change-archetype.js');
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({ dials: { tempo: 'aggressive' } }),
    });
    const res = await call(changeArchetypeHandler, { agentId: 'agent-1', archetype: 'degen' });
    expect(res.statusCode).toBe(200);
    expect(activeDb.__dump('agents/agent-1').dials.tempo).toBe('aggressive');
  });
});

describe('Forge — §6.1 lazy legacy floor + the A8-exempt dark hardening', () => {
  const BIG_BUNDLE = {
    status: 'forged',
    name: 'big',
    ruleIds: Array.from({ length: 11 }, (_, i) => `r${i}`),
    ruleSnapshots: Array.from({ length: 11 }, (_, i) => ({ ruleId: `r${i}`, text: `rule ${i}` })),
  };

  it('reforge carries NO capacity check (review decision): the over-cap bundle reforges into a draft — the trim path stays open', async () => {
    flagState.enf = false;
    activeDb = makeMockDb({
      'agents/agent-1': AGENT(),
      'agents/agent-1/bundles/b-big': BIG_BUNDLE,
    });
    const res = await call(reforgeBundleHandler, { agentId: 'agent-1', bundleId: 'b-big' });
    expect(res.body?.error).not.toBe('rule_limit');
    expect(res.statusCode).toBe(200);
  });

  it('DARK: equip-bundle likewise rejects an over-capacity bundle server-side', async () => {
    flagState.enf = false;
    activeDb = makeMockDb({
      'agents/agent-1': AGENT(),
      'agents/agent-1/bundles/b-big': BIG_BUNDLE,
    });
    const res = await call(equipBundleHandler, { agentId: 'agent-1', bundleId: 'b-big' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('rule_limit');
  });

  it('ENF on + highest-archetype L7 (band 20): the same 11-rule bundle clears the capacity check on a rookie legacy agent', async () => {
    activeDb = makeMockDb({
      'agents/agent-1': AGENT(),
      'agents/agent-1/bundles/b-big': BIG_BUNDLE,
      'masteryProfiles/test-user': GUARDIAN_PROFILE(7),
    });
    const res = await call(equipBundleHandler, { agentId: 'agent-1', bundleId: 'b-big' });
    // Clears rule_limit; the equip completes on the un-mocked path.
    expect(res.body?.error).not.toBe('rule_limit');
    expect(res.statusCode).toBe(200);
    expect(activeDb.__dump('agents/agent-1').equippedBundleIds).toContain('b-big');
  });

  it('lazy floor direction 2: a partner-legacy agent (20) keeps 20 even at mastery L1', async () => {
    activeDb = makeMockDb({
      'agents/agent-1': AGENT({ stats: { gamesPlayed: 20 } }), // legacy partner
      'agents/agent-1/bundles/b-big': BIG_BUNDLE,
      'masteryProfiles/test-user': GUARDIAN_PROFILE(1),
    });
    const res = await call(equipBundleHandler, { agentId: 'agent-1', bundleId: 'b-big' });
    expect(res.body?.error).not.toBe('rule_limit');
    expect(res.statusCode).toBe(200);
  });
});
