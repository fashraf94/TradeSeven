// api/_utils/release2ControlsMatrix.test.js
//
// Release 2 PR-f — the COMBINATION + TRANSITION MATRIX (spec §7, founder GO
// 2026-07-10). One file, test-only: the archetype-pairing set + the
// cross-path dial set + the mandatory transition sequences (changelog #16),
// driven through the REAL fenced assemblies wherever a prompt is asserted
// (called, never edited — BUILD_RULES §1) with the flags getter-walked
// per-tick (the agentPromptAssembly.controls.enforce convention; D6 per-tick
// fresh resolution is what the walk exercises).
//
// Sections:
//   A. Archetype-pairing set — all six archetypes, real menu data: legal lean
//      pair + directive render through both assemblies; the real directed
//      directive→lean edge per adjudicated group (momentum_chaser: none).
//   B. One directive opposing BOTH equipped leans — SYNTHETIC fixture per the
//      §4.2 ruling (at-most-one-opposition-in-production / machinery-general;
//      the production invariant is proven by exhaustion alongside): single
//      confirmation covers both, both suppress, structural expiry resumes.
//   C. Transition sequences — mode round-trips BOTH directions via the real
//      epoch orchestrator + real assembly: directives dead across re-enforce,
//      leans resumed, epoch events correct (one per epoch, kill sets exact).
//   D. Guard-retained-through-code-rollback — the compatibility floor: full
//      later-PR data at rest + prefix-c flags → nothing renders, nothing
//      crashes, the dial is identity.
//   E. PR prefixes (c; c+a; c+a+b) — each permitted deploy state coherent.
//   F. Release-1 promotion AND reversion band states + missing/unknown/future
//      dial versions — version-bound fail-closed proven each way.
//   G. Receipts truthful in every state (the §14 provenance sibling).
//   H. Safety fields untouched at every tempo (B4 §D).
//   I. Archetype change with stale leans — revalidation omits + records, all
//      six menus.

import { describe, it, expect, beforeEach, vi } from 'vitest';
// Zero-import modules — safe to import statically before the mocks.
import {
  ARCHETYPE_KEYS,
  getCanonicalText,
  getCanonicalTextVersion,
  getAllowlist,
  getConflictGroups,
  findEquipConflicts,
} from '../../src/data/archetypeAdjustments.js';
import { DIRECTIVE_AT_REST, makeEvalBattle as makeSharedEvalBattle, buildEvalWith } from './__fixtures__/controlsPromptFixtures.js';

const { flagState } = vi.hoisted(() => ({
  flagState: { integrity: 'enforce', leans: true, dial: false },
}));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return flagState.integrity; },
  get STANDING_LEANS_ENABLED() { return flagState.leans; },
  get TEMPO_DIAL_ENABLED() { return flagState.dial; },
  RULE_COMPAT_MODE: 'off',
}));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { buildStrategyUserPrompt } = await import('./agentPromptAssembly.js');
const { buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');
const { resolveControls, SUPPRESSION_REASONS } = await import('./controlPromptRenderer.js');
const { recordControlEpochIfNeeded } = await import('./controlSuppressionTelemetry.js');
const { revalidateStandingLeans, buildCustomizationSnapshot, STANDING_LEANS_CAP } = await import('./leanRevalidation.js');
const { computeOpposedLeans, buildLeanOverrideRecords } = await import('./leanOverrides.js');
const { clampHftConfig, resolveTempoDial, desiredTempoOf, TEMPO_SUPPRESSION_REASONS } = await import('./tempoDialClamp.js');
const { TEMPO_DIAL_BANDS, VALID_TEMPO_VALUES } = await import('./tempoDialBands.js');
const { buildSwapProvenance } = await import('./swapProvenance.js');
// Fenced module — READ/CALL ONLY (BUILD_RULES §1).
const { KNOB_CONFIG_VERSION } = await import('./agentArchetypeConfig.js');

const buildEval = buildEvalWith(buildLiveContextBlock);
const T0 = '2026-07-10T00:00:00.000Z';

// ==================== SHARED BUILDERS ====================

const leanSnap = (arch, id) => ({
  adjustmentId: id,
  version: getCanonicalTextVersion(arch, id),
  text: getCanonicalText(arch, id),
});
const mkDirective = (arch, id, thread) => ({
  text: getCanonicalText(arch, id),
  expiry: 'end_of_battle',
  directiveThreadId: thread,
  createdAt: T0,
  adjustmentId: id,
  canonicalTextVersion: getCanonicalTextVersion(arch, id),
});
const mkBattle = ({ archetype, directive, standingLeans, leanOverrides, controlEpochLog } = {}) => ({
  ...makeSharedEvalBattle({ archetype, directive, standingLeans, controlEpochLog }),
  ...(leanOverrides !== undefined ? { leanOverrides } : {}),
});

const setFlags = ({ integrity = 'enforce', leans = true, dial = false } = {}) => {
  flagState.integrity = integrity;
  flagState.leans = leans;
  flagState.dial = dial;
};

beforeEach(() => setFlags({}));

// ==================== A. THE ARCHETYPE-PAIRING SET (all six, real menus) ====================
//
// Per archetype: a LEGAL two-lean pair + a directive from ITS OWN menu (ids
// distinct, so same-id dedup stays out of the way), and — for the five
// archetypes with an adjudicated conflict group — the real directed edge (the
// group's OTHER member as the incoming directive). momentum_chaser's empty
// set is asserted as empty, not skipped.
const PAIRINGS = {
  momentum_chaser: { leans: ['TF-01', 'TF-04'], directive: 'TF-02', edge: null },
  contrarian:      { leans: ['CN-01', 'CN-05'], directive: 'CN-03', edge: { directive: 'CN-08', opposed: 'CN-05' } },
  degen:           { leans: ['SP-01', 'SP-04'], directive: 'SP-02', edge: { directive: 'SP-05', opposed: 'SP-04' } },
  guardian:        { leans: ['CP-01', 'CP-04'], directive: 'CP-02', edge: { directive: 'CP-05', opposed: 'CP-04' } },
  diversifier:     { leans: ['DV-01', 'DV-03'], directive: 'DV-02', edge: { directive: 'DV-05', opposed: 'DV-03' } },
  analyst:         { leans: ['FI-01', 'FI-03'], directive: 'FI-02', edge: { directive: 'FI-04', opposed: 'FI-03' } },
};

describe('A. archetype-pairing set — all six archetypes through the REAL assemblies', () => {
  it('the pairing table covers exactly the six archetypes', () => {
    expect(Object.keys(PAIRINGS).sort()).toEqual([...ARCHETYPE_KEYS].sort());
  });

  for (const [arch, p] of Object.entries(PAIRINGS)) {
    it(`${arch}: legal pair + directive — snapshot valid, both blocks render, dedup untriggered`, async () => {
      const [a, b] = p.leans;
      // Equip legality (undirected group rejection): the pair shares no group.
      expect(findEquipConflicts(arch, b, [a])).toEqual([]);
      // Snapshot revalidation accepts both at current versions.
      const { valid, invalidated } = revalidateStandingLeans({
        standingLeans: [
          { adjustmentId: a, version: getCanonicalTextVersion(arch, a), equippedAt: 't1' },
          { adjustmentId: b, version: getCanonicalTextVersion(arch, b), equippedAt: 't2' },
        ],
        archetypeCodeId: arch,
      });
      expect(invalidated).toEqual([]);
      expect(valid.map((l) => l.adjustmentId)).toEqual([a, b]);

      // EVAL assembly (enforce + leans on): directive block + both lean lines.
      const directive = mkDirective(arch, p.directive, `thread-${arch}`);
      const out = await buildEval(mkBattle({ archetype: arch, directive, standingLeans: valid }));
      expect(out).toContain('ACTIVE DIRECTIVE (from your Coach):');
      expect(out).toContain(`"${getCanonicalText(arch, p.directive)}"`);
      expect(out).toContain('STANDING LEANS');
      expect(out).toContain(`- "${getCanonicalText(arch, a)}"`);
      expect(out).toContain(`- "${getCanonicalText(arch, b)}"`);

      // STRATEGY assembly renders the same pair post-revalidation (at-rest pins in).
      const strat = buildStrategyUserPrompt({
        name: 'Atlas',
        archetype: arch,
        activeRules: [],
        standingLeans: [
          { adjustmentId: a, version: getCanonicalTextVersion(arch, a), equippedAt: 't1' },
          { adjustmentId: b, version: getCanonicalTextVersion(arch, b), equippedAt: 't2' },
        ],
      });
      expect(strat).toContain(`- "${getCanonicalText(arch, a)}"`);
      expect(strat).toContain(`- "${getCanonicalText(arch, b)}"`);
    });

    it(`${arch}: the real directive→lean edge ${p.edge ? `(${p.edge.directive} opposes ${p.edge.opposed})` : '(empty set — no groups)'}`, () => {
      const equipped = p.leans.map((id) => ({ adjustmentId: id }));
      if (!p.edge) {
        expect(getConflictGroups(arch)).toEqual([]);
        // No directive in the whole menu opposes anything equippable.
        for (const id of getAllowlist(arch).map((a) => a.id)) {
          expect(computeOpposedLeans(arch, id, equipped)).toEqual([]);
        }
        return;
      }
      const opposed = computeOpposedLeans(arch, p.edge.directive, equipped);
      expect(opposed.map((l) => l.adjustmentId)).toEqual([p.edge.opposed]);
      // …and with the confirmation recorded, the REAL renderer suppresses the
      // lean while the directive renders (directive wins; lean suppresses).
      const directive = mkDirective(arch, p.edge.directive, `thread-${arch}-edge`);
      const records = buildLeanOverrideRecords({ directive, opposedLeans: opposed, confirmedAt: T0 });
      const resolution = resolveControls({
        modes: { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true },
        directive,
        standingLeans: p.leans.map((id) => leanSnap(arch, id)),
        leanOverrides: records,
      });
      expect(resolution.directive.effective).toBe(directive);
      expect(resolution.suppressionDescriptors).toContainEqual({
        target: 'lean',
        id: p.edge.opposed,
        version: getCanonicalTextVersion(arch, p.edge.opposed),
        reason: SUPPRESSION_REASONS.OVERRIDDEN_BY_DIRECTIVE,
      });
      // The UNOPPOSED lean of the pair still renders.
      const other = p.leans.find((id) => id !== p.edge.opposed);
      expect(resolution.leans.effective.map((l) => l.adjustmentId)).toEqual([other]);
    });
  }

  it('§4.2 production invariant, by exhaustion: no directive opposes more than ONE lean of any legal pair', () => {
    for (const arch of ARCHETYPE_KEYS) {
      const menu = getAllowlist(arch).map((a) => a.id); // ids, not adjustment objects
      for (let i = 0; i < menu.length; i++) {
        for (let j = i + 1; j < menu.length; j++) {
          if (findEquipConflicts(arch, menu[j], [menu[i]]).length > 0) continue; // not a legal pair
          const equipped = [{ adjustmentId: menu[i] }, { adjustmentId: menu[j] }];
          for (const directiveId of menu) {
            expect(
              computeOpposedLeans(arch, directiveId, equipped).length,
              `${arch}: ${directiveId} vs [${menu[i]}, ${menu[j]}]`,
            ).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

// ==================== B. ONE DIRECTIVE OPPOSING BOTH LEANS (synthetic, §4.2) ====================
//
// No production menu can produce this state (proven by exhaustion above) —
// the machinery must still be general (founder ruling §4.2), so the fixture
// is synthetic: a directive whose confirmation covers TWO equipped leans.
describe('B. one directive opposing both equipped leans — single confirmation, both suppressed', () => {
  const SYN_L1 = Object.freeze({ adjustmentId: 'SYN-01', version: 1, text: 'Synthetic lean one' });
  const SYN_L2 = Object.freeze({ adjustmentId: 'SYN-02', version: 1, text: 'Synthetic lean two' });
  const SYN_DIRECTIVE = Object.freeze({
    text: 'Synthetic opposing directive',
    expiry: 'end_of_battle',
    directiveThreadId: 'thread-syn',
    createdAt: T0,
    adjustmentId: 'SYN-99',
    canonicalTextVersion: 1,
  });
  const records = buildLeanOverrideRecords({
    directive: SYN_DIRECTIVE,
    opposedLeans: [SYN_L1, SYN_L2],
    confirmedAt: T0,
  });

  it('ONE confirmation covers both: two records, one directive instance, one confirmedAt', () => {
    expect(records).toHaveLength(2);
    expect(new Set(records.map((r) => r.directiveInstanceId))).toEqual(new Set(['thread-syn']));
    expect(new Set(records.map((r) => r.confirmedAt))).toEqual(new Set([T0]));
    expect(records.map((r) => r.leanId).sort()).toEqual(['SYN-01', 'SYN-02']);
  });

  it('resolution: the directive renders, BOTH leans suppress with overridden_by_directive', () => {
    const resolution = resolveControls({
      modes: { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true },
      directive: SYN_DIRECTIVE,
      standingLeans: [SYN_L1, SYN_L2],
      leanOverrides: records,
    });
    expect(resolution.directive.effective).toBe(SYN_DIRECTIVE);
    expect(resolution.leans.effective).toEqual([]);
    const reasons = resolution.suppressionDescriptors.filter((d) => d.target === 'lean').map((d) => d.reason);
    expect(reasons).toEqual([
      SUPPRESSION_REASONS.OVERRIDDEN_BY_DIRECTIVE,
      SUPPRESSION_REASONS.OVERRIDDEN_BY_DIRECTIVE,
    ]);
  });

  it('through the REAL eval assembly: directive in, neither lean text, no leans block at all', async () => {
    const out = await buildEval(mkBattle({
      archetype: 'guardian',
      directive: SYN_DIRECTIVE,
      standingLeans: [SYN_L1, SYN_L2],
      leanOverrides: records,
    }));
    expect(out).toContain('"Synthetic opposing directive"');
    expect(out).not.toContain('Synthetic lean one');
    expect(out).not.toContain('Synthetic lean two');
    expect(out).not.toContain('STANDING LEANS');
  });

  it('structural expiry: a superseding directive instance leaves the old records inert — BOTH leans resume', async () => {
    const successor = { ...SYN_DIRECTIVE, directiveThreadId: 'thread-syn-2', adjustmentId: 'SYN-98', text: 'Successor directive' };
    const out = await buildEval(mkBattle({
      archetype: 'guardian',
      directive: successor,
      standingLeans: [SYN_L1, SYN_L2],
      leanOverrides: records, // stale — bound to thread-syn
    }));
    expect(out).toContain('"Successor directive"');
    expect(out).toContain('- "Synthetic lean one"');
    expect(out).toContain('- "Synthetic lean two"');
  });

  it('a SUPPRESSED overriding directive cannot keep the leans down (overrides bind to the RENDERING instance)', async () => {
    setFlags({ integrity: 'observe', leans: true });
    const out = await buildEval(mkBattle({
      archetype: 'guardian',
      directive: SYN_DIRECTIVE,
      standingLeans: [SYN_L1, SYN_L2],
      leanOverrides: records,
    }));
    expect(out).not.toContain('Synthetic opposing directive'); // mode_not_enforce
    expect(out).toContain('- "Synthetic lean one"');            // leans resume immediately
    expect(out).toContain('- "Synthetic lean two"');
  });
});

// ==================== C. TRANSITION SEQUENCES (changelog #16) ====================
//
// battle.controlEpochLog is driven via the SAME extracted orchestrator the
// cron calls (durable write stubbed; the in-memory sync is the half the
// prompts read) — the cron's own glue wiring into it is source-locked in
// agent-evaluate.test.js. The REAL eval assembly renders each tick. Epochs
// are tick-observed; a "tick" here = one orchestrator call + one assembly
// build. Epoch keys are asserted as LITERAL strings, never re-derived
// through computeEpochKey (a self-referential comparison would stay green
// if the key ever stopped encoding a flag).
describe('C. mode round-trips both directions — no resurrection, leans resume, epoch events exact', () => {
  const stubRef = { update: async () => {} };
  const arrayUnion = (e) => e;

  const tick = async (battle, { dialProvenance = null } = {}) => {
    const event = await recordControlEpochIfNeeded({
      battleRef: stubRef,
      battle,
      arrayUnion,
      modes: {
        archetypeIntegrityMode: flagState.integrity,
        standingLeansEnabled: flagState.leans,
        tempoDialEnabled: flagState.dial,
      },
      resolveControls,
      directive: battle.directive ?? null,
      dialProvenance,
      deploySha: 'sha-matrix',
      knobConfigVersion: KNOB_CONFIG_VERSION,
      dialBandVersion: TEMPO_DIAL_BANDS.forKnobConfigVersion,
    });
    const out = await buildEval(battle);
    return { out, event };
  };

  const freshBattle = () => mkBattle({
    archetype: 'guardian',
    directive: mkDirective('guardian', 'CP-02', 'thread-rt'),
    standingLeans: [leanSnap('guardian', 'CP-01'), leanSnap('guardian', 'CP-04')],
  });
  const DIRECTIVE_TEXT = `"${getCanonicalText('guardian', 'CP-02')}"`;
  const LEAN_LINE = `- "${getCanonicalText('guardian', 'CP-01')}"`;

  it('enforce → observe → enforce: three epochs, directive dies in the middle and STAYS dead, leans resume', async () => {
    const battle = freshBattle();

    setFlags({ integrity: 'enforce' });
    // The first epoch's event carries the tempo provenance + deploy metadata
    // it was handed (the desired-vs-effective record rides the SAME event).
    const suppressedDial = resolveTempoDial({ desiredTempo: 'aggressive', dialEnabled: false }).provenance;
    const { out: t1, event: e1 } = await tick(battle, { dialProvenance: suppressedDial });
    expect(t1).toContain(DIRECTIVE_TEXT);
    expect(t1).toContain(LEAN_LINE);
    expect(e1.tempo).toMatchObject({
      tempoDesired: 'aggressive',
      tempoEffective: 'standard',
      suppressionReason: TEMPO_SUPPRESSION_REASONS.DIAL_DISABLED,
    });
    expect(e1.deploySha).toBe('sha-matrix');
    expect(e1.knobConfigVersion).toBe(KNOB_CONFIG_VERSION);

    const { out: t2, event: e2 } = await tick(battle); // same epoch — silent
    expect(e2).toBeNull();
    expect(battle.controlEpochLog).toHaveLength(1);
    expect(t2).toContain(DIRECTIVE_TEXT);

    setFlags({ integrity: 'observe' });
    const { out: t3 } = await tick(battle);
    expect(battle.controlEpochLog).toHaveLength(2);
    expect(t3).not.toContain('ACTIVE DIRECTIVE');
    expect(t3).toContain(LEAN_LINE); // leans are NOT epoch-bound

    setFlags({ integrity: 'enforce' });
    const { out: t4 } = await tick(battle);
    expect(battle.controlEpochLog).toHaveLength(3);
    expect(t4).not.toContain('ACTIVE DIRECTIVE'); // epoch-killed — no resurrection
    expect(t4).toContain(LEAN_LINE);              // leans resumed untouched

    // Epoch events exact: LITERAL key sequence + the middle entry carries the kill.
    expect(battle.controlEpochLog.map((e) => e.epochKey)).toEqual([
      'integrity=enforce|leans=on|dial=off',
      'integrity=observe|leans=on|dial=off',
      'integrity=enforce|leans=on|dial=off',
    ]);
    expect(battle.controlEpochLog[0].suppressedDirectiveIds).toEqual([]);
    expect(battle.controlEpochLog[1].suppressedDirectiveIds).toEqual(['thread-rt']);
    expect(battle.controlEpochLog[2].suppressedDirectiveIds).toEqual(['thread-rt']); // killed, still suppressed
    for (const entry of battle.controlEpochLog) {
      expect(entry.suppressedLeanIds).toEqual([]); // leans never enter a kill set
    }
  });

  it('observe → enforce → observe: a directive first seen under observe is killed by its FIRST epoch and never renders', async () => {
    const battle = freshBattle();

    setFlags({ integrity: 'observe' });
    const { out: t1 } = await tick(battle);
    expect(t1).not.toContain('ACTIVE DIRECTIVE');
    expect(t1).toContain(LEAN_LINE);
    expect(battle.controlEpochLog[0].suppressedDirectiveIds).toEqual(['thread-rt']);

    setFlags({ integrity: 'enforce' });
    const { out: t2 } = await tick(battle);
    expect(battle.controlEpochLog).toHaveLength(2);
    expect(t2).not.toContain('ACTIVE DIRECTIVE'); // dead on arrival — the observe epoch is its kill record
    expect(t2).toContain(LEAN_LINE);

    setFlags({ integrity: 'observe' });
    const { out: t3 } = await tick(battle);
    expect(battle.controlEpochLog).toHaveLength(3);
    expect(t3).not.toContain('ACTIVE DIRECTIVE');
    expect(t3).toContain(LEAN_LINE);
  });

  it('a leans flag round-trip is its own epoch pair and leans RESUME across it (no lean kill set exists)', async () => {
    const battle = mkBattle({
      archetype: 'guardian',
      standingLeans: [leanSnap('guardian', 'CP-01')],
    });
    setFlags({ integrity: 'observe', leans: true });
    expect((await tick(battle)).out).toContain(LEAN_LINE);
    setFlags({ integrity: 'observe', leans: false });
    expect((await tick(battle)).out).not.toContain('STANDING LEANS');
    setFlags({ integrity: 'observe', leans: true });
    expect((await tick(battle)).out).toContain(LEAN_LINE); // resumed — durable desired state
    expect(battle.controlEpochLog).toHaveLength(3);
  });

  it('a DIAL flag round-trip opens its own epochs — the c+a → c+a+b enablement flip is observable (literal key pins)', async () => {
    const battle = mkBattle({
      archetype: 'guardian',
      standingLeans: [leanSnap('guardian', 'CP-01')],
    });
    setFlags({ integrity: 'observe', leans: true, dial: false });
    await tick(battle);
    setFlags({ integrity: 'observe', leans: true, dial: true });
    await tick(battle);
    setFlags({ integrity: 'observe', leans: true, dial: false });
    await tick(battle);
    // Literal pins: computeEpochKey MUST encode the dial flag — a key that
    // silently dropped it would make the PR-b enablement flip epoch-invisible
    // (no event, no tempo provenance logged for the transition).
    expect(battle.controlEpochLog.map((e) => e.epochKey)).toEqual([
      'integrity=observe|leans=on|dial=off',
      'integrity=observe|leans=on|dial=on',
      'integrity=observe|leans=on|dial=off',
    ]);
  });
});

// ==================== D. GUARD RETAINED THROUGH CODE ROLLBACK (compatibility floor) ====================
//
// The rollback scenario the floor exists for: battle docs carry the FULL
// later-PR data set (snapshot leans, dial, overrides, epoch log, invalidation
// records) while only prefix-c behavior is active (leans/dial flags off).
// The guard must suppress everything, byte-clean, crash-free.
describe('D. guard-retained-through-code-rollback — full later-PR data at rest, prefix-c flags', () => {
  const maximalBattle = () => ({
    ...mkBattle({
      archetype: 'guardian',
      directive: mkDirective('guardian', 'CP-02', 'thread-floor'),
      standingLeans: [leanSnap('guardian', 'CP-01'), leanSnap('guardian', 'CP-04')],
      leanOverrides: buildLeanOverrideRecords({
        directive: mkDirective('guardian', 'CP-05', 'thread-floor'),
        opposedLeans: [{ adjustmentId: 'CP-04', version: 1 }],
        confirmedAt: T0,
      }),
      controlEpochLog: [{
        epochKey: 'integrity=enforce|leans=on|dial=off',
        modes: { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true, tempoDialEnabled: false },
        suppressedDirectiveIds: [],
        suppressedLeanIds: [],
        at: T0,
      }],
    }),
  });

  it('eval assembly under observe + leans off: NOTHING control-shaped renders, no crash', async () => {
    setFlags({ integrity: 'observe', leans: false, dial: false });
    const battle = maximalBattle();
    battle.agentContext.standingLeansInvalidated = [{ adjustmentId: 'TF-01', version: 1, reason: 'not_in_menu' }];
    battle.agentContext.dials = { tempo: 'aggressive' };
    battle.agentContext.settingsRev = 7;
    const out = await buildEval(battle);
    expect(out).not.toContain('ACTIVE DIRECTIVE');
    expect(out).not.toContain('STANDING LEANS');
    expect(out).not.toContain(getCanonicalText('guardian', 'CP-01'));
    expect(out).not.toContain(getCanonicalText('guardian', 'CP-02'));
  });

  it('strategy assembly ignores the at-rest pins byte-identically while leans are off', () => {
    setFlags({ integrity: 'observe', leans: false, dial: false });
    const withData = buildStrategyUserPrompt({
      name: 'Atlas', archetype: 'guardian', activeRules: [],
      standingLeans: [{ adjustmentId: 'CP-01', version: 1, equippedAt: 't1' }],
    });
    const without = buildStrategyUserPrompt({ name: 'Atlas', archetype: 'guardian', activeRules: [] });
    expect(withData).toBe(without);
  });

  it('the dial at rest is IDENTITY (same reference) with the flag off — and its suppression is visible, never silent', () => {
    setFlags({ integrity: 'observe', leans: false, dial: false });
    const hftConfig = { swapWindow: { capPerWindow: 4, windowMinutes: 60, countEmergencies: false } };
    const clamp = clampHftConfig({ hftConfig, desiredTempo: 'aggressive', dialEnabled: flagState.dial });
    expect(clamp.hftConfig).toBe(hftConfig);
    expect(clamp.provenance).toMatchObject({
      tempoDesired: 'aggressive',
      tempoEffective: 'standard',
      suppressionReason: TEMPO_SUPPRESSION_REASONS.DIAL_DISABLED,
    });
  });
});

// ==================== E. THE PERMITTED PR PREFIXES (c; c+a; c+a+b) ====================
describe('E. deploy prefixes — each permitted stack state is coherent', () => {
  const PREFIXES = {
    'c':     { leans: false, dial: false },
    'c+a':   { leans: true,  dial: false },
    'c+a+b': { leans: true,  dial: true },
  };
  const battleFor = () => mkBattle({
    archetype: 'guardian',
    directive: mkDirective('guardian', 'CP-02', 'thread-prefix'),
    standingLeans: [leanSnap('guardian', 'CP-01')],
  });
  const HFT = { swapWindow: { capPerWindow: 4, windowMinutes: 60 } };

  for (const [prefix, flags] of Object.entries(PREFIXES)) {
    it(`prefix ${prefix}: directive renders under enforce; leans ${flags.leans ? 'render' : 'suppressed'}; dial ${flags.dial ? 'applies' : 'identity'}`, async () => {
      setFlags({ integrity: 'enforce', ...flags });
      const out = await buildEval(battleFor());
      expect(out).toContain('ACTIVE DIRECTIVE'); // PR-c behavior in every prefix
      if (flags.leans) {
        expect(out).toContain(`- "${getCanonicalText('guardian', 'CP-01')}"`);
      } else {
        expect(out).not.toContain('STANDING LEANS');
      }
      const clamp = clampHftConfig({ hftConfig: HFT, desiredTempo: 'aggressive', dialEnabled: flagState.dial });
      if (flags.dial) {
        expect(clamp.hftConfig).not.toBe(HFT);
        expect(clamp.hftConfig.swapWindow.capPerWindow).toBe(Math.round(4 * 1.3));
        expect(clamp.provenance.suppressionReason).toBeUndefined();
      } else {
        expect(clamp.hftConfig).toBe(HFT); // identity by construction
        expect(clamp.provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.DIAL_DISABLED);
      }
    });
  }
});

// ==================== F. RELEASE-1 PROMOTION / REVERSION + VERSION STATES ====================
describe('F. version-bound fail-closed — promotion, reversion, missing/unknown/future versions', () => {
  it('the LIVE binding is intact: the band table pins the deployed knob generation', () => {
    expect(TEMPO_DIAL_BANDS.forKnobConfigVersion).toBe(KNOB_CONFIG_VERSION);
    expect(VALID_TEMPO_VALUES).toEqual(['measured', 'standard', 'aggressive']);
  });

  const resolveAt = (deployedKnobConfigVersion, bandTable = TEMPO_DIAL_BANDS) =>
    resolveTempoDial({ desiredTempo: 'aggressive', dialEnabled: true, deployedKnobConfigVersion, bandTable });

  it('PROMOTION: matching generations → the dial applies, no suppression', () => {
    const r = resolveAt(TEMPO_DIAL_BANDS.forKnobConfigVersion);
    expect(r.effectiveTempo).toBe('aggressive');
    expect(r.multiplier).toBe(1.3);
    expect(r.provenance.suppressionReason).toBeUndefined();
  });

  it('REVERSION: a Release-1 rollback deploys the NEXT version (monotonic) → bands self-disable', () => {
    const r = resolveAt(KNOB_CONFIG_VERSION + 1);
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.BAND_VERSION_MISMATCH);
    expect(r.provenance.tempoDesired).toBe('aggressive'); // desired never silently rewritten
  });

  it('PAST generation (pre-B4 knobs) → fail closed', () => {
    expect(resolveAt(1).provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.BAND_VERSION_MISMATCH);
  });

  it('MISSING band-table pin → fail closed (an unpinned table can never modulate)', () => {
    const r = resolveAt(KNOB_CONFIG_VERSION, { multipliers: { measured: 0.7, standard: 1.0, aggressive: 1.3 } });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.BAND_VERSION_MISMATCH);
  });

  it('FUTURE band table against an older deploy → fail closed (bands never modulate backward)', () => {
    const r = resolveAt(KNOB_CONFIG_VERSION, { forKnobConfigVersion: 99, multipliers: { aggressive: 9 } });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.BAND_VERSION_MISMATCH);
  });

  it('UNKNOWN desired value → fail closed with its own reason (garbage in the snapshot is visible)', () => {
    const r = resolveTempoDial({ desiredTempo: 'warp', dialEnabled: true });
    expect(r.effectiveTempo).toBe('standard');
    expect(r.provenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.UNKNOWN_TEMPO_VALUE);
  });
});

// ==================== G. RECEIPTS TRUTHFUL IN EVERY STATE (§14 sibling) ====================
describe('G. swap provenance — truthful in every dial state, one nested key, exact shape', () => {
  const receiptFor = (args) => buildSwapProvenance(resolveTempoDial(args).provenance);

  // Version VALUES asserted per case (not just key presence): the receipt's
  // two version fields are the audit trail for WHICH generation clamped.
  const BAND_V = TEMPO_DIAL_BANDS.forKnobConfigVersion;
  const CASES = [
    ['default standard (no user value)', { dialEnabled: true }, { tempoDesired: 'standard', tempoEffective: 'standard', selectionSource: 'default', dialBandVersion: BAND_V, knobConfigVersion: KNOB_CONFIG_VERSION }, false],
    ['EXPLICIT standard (distinguishable from default)', { desiredTempo: 'standard', dialEnabled: true }, { tempoDesired: 'standard', tempoEffective: 'standard', selectionSource: 'user_dial', dialBandVersion: BAND_V, knobConfigVersion: KNOB_CONFIG_VERSION }, false],
    ['applied aggressive', { desiredTempo: 'aggressive', dialEnabled: true }, { tempoDesired: 'aggressive', tempoEffective: 'aggressive', selectionSource: 'user_dial', dialBandVersion: BAND_V, knobConfigVersion: KNOB_CONFIG_VERSION }, false],
    // A user-supplied desired value stamps selectionSource 'user_dial' even
    // when suppressed — the receipt records WHO asked, separately from what
    // was applied.
    ['dial off', { desiredTempo: 'measured', dialEnabled: false }, { tempoDesired: 'measured', tempoEffective: 'standard', selectionSource: 'user_dial', suppressionReason: 'dial_disabled', dialBandVersion: BAND_V, knobConfigVersion: KNOB_CONFIG_VERSION }, true],
    ['version mismatch', { desiredTempo: 'measured', dialEnabled: true, deployedKnobConfigVersion: 99 }, { tempoDesired: 'measured', tempoEffective: 'standard', selectionSource: 'user_dial', suppressionReason: 'band_version_mismatch', dialBandVersion: BAND_V, knobConfigVersion: 99 }, true],
    ['unknown value', { desiredTempo: 'warp', dialEnabled: true }, { tempoDesired: 'warp', tempoEffective: 'standard', selectionSource: 'user_dial', suppressionReason: 'unknown_tempo_value', dialBandVersion: BAND_V, knobConfigVersion: KNOB_CONFIG_VERSION }, true],
  ];

  for (const [label, args, expected, suppressed] of CASES) {
    it(`${label}: the receipt says exactly what happened`, () => {
      const receipt = receiptFor(args);
      expect(Object.keys(receipt)).toEqual(['swapProvenance']); // one nested key — receipt fields can never collide
      const keys = Object.keys(receipt.swapProvenance).sort();
      expect(keys).toEqual(
        suppressed
          ? ['dialBandVersion', 'knobConfigVersion', 'selectionSource', 'suppressionReason', 'tempoDesired', 'tempoEffective']
          : ['dialBandVersion', 'knobConfigVersion', 'selectionSource', 'tempoDesired', 'tempoEffective'],
      );
      // Exact-equal over the FULL value set (the key check above makes this
      // total): every field value, versions included, is the truth.
      expect(receipt.swapProvenance).toEqual(expected);
    });
  }

  it('the BATTLE seam: both cron read paths resolve the desired tempo via desiredTempoOf from the snapshot', () => {
    // The production wiring is desiredTempoOf(battle) at BOTH call sites
    // (the eval clamp seam and handleGameplanMeeting's provenance) — this is
    // the only behavioral coverage of the accessor, so a path regression
    // (e.g. reading battle.dials instead of agentContext.dials) fails HERE.
    const battle = mkBattle({ archetype: 'guardian' });
    battle.agentContext.dials = { tempo: 'aggressive' };

    // Eval seam shape:
    const clamp = clampHftConfig({
      hftConfig: { swapWindow: { capPerWindow: 4 } },
      desiredTempo: desiredTempoOf(battle),
      dialEnabled: true,
    });
    expect(clamp.effectiveTempo).toBe('aggressive');
    expect(clamp.hftConfig.swapWindow.capPerWindow).toBe(Math.round(4 * 1.3));

    // Gameplan seam shape:
    const receipt = buildSwapProvenance(resolveTempoDial({ desiredTempo: desiredTempoOf(battle), dialEnabled: true }).provenance);
    expect(receipt.swapProvenance).toMatchObject({
      tempoDesired: 'aggressive',
      tempoEffective: 'aggressive',
      selectionSource: 'user_dial',
    });

    // The accessor reads agentContext.dials.tempo and NOTHING else.
    expect(desiredTempoOf({ dials: { tempo: 'aggressive' } })).toBeUndefined();      // wrong altitude
    expect(desiredTempoOf({ agentContext: { tempo: 'aggressive' } })).toBeUndefined(); // wrong nesting
    expect(desiredTempoOf({ agentContext: { dials: {} } })).toBeUndefined();
    expect(desiredTempoOf(null)).toBeUndefined();
  });

  it('pre-PR-b paths (no provenance) spread to NOTHING — always safe', () => {
    expect(buildSwapProvenance(null)).toEqual({});
    expect(buildSwapProvenance(undefined)).toEqual({});
  });
});

// ==================== H. SAFETY FIELDS UNTOUCHED AT EVERY TEMPO (B4 §D) ====================
describe('H. safety/structural fields are verbatim at every band; only the five leaves move', () => {
  const FULL_HFT = () => ({
    swapWindow: { capPerWindow: 4, windowMinutes: 60, countEmergencies: false, enabled: true },
    forcedRotation: { enabled: true, ticksThreshold: 6, pctThreshold: 0.001, winnerThreshold: 1.5, maxTickAgeMinutes: 20 },
    hurdleFloor: {
      enabled: true,
      requireBenchPositive: true,
      byReason: { haiku_decision: { atrMultiplier: 0.4 }, stagnation: { atrMultiplier: 0.3 } },
      default: { atrMultiplier: 0.5 },
    },
    futureUnknownKnob: { rides: 'through' },
  });
  const round2 = (n) => Math.round(n * 100) / 100;

  it('standard is the SAME OBJECT — identity by construction', () => {
    const input = FULL_HFT();
    expect(clampHftConfig({ hftConfig: input, desiredTempo: 'standard', dialEnabled: true }).hftConfig).toBe(input);
  });

  for (const tempo of ['measured', 'aggressive']) {
    it(`${tempo}: capacity×, resistance÷, safety verbatim, unknown keys ride through`, () => {
      const input = FULL_HFT();
      const mult = TEMPO_DIAL_BANDS.multipliers[tempo];
      const { hftConfig: out } = clampHftConfig({ hftConfig: input, desiredTempo: tempo, dialEnabled: true });

      // The five band leaves, direction-aware.
      expect(out.swapWindow.capPerWindow).toBe(Math.max(1, Math.round(4 * mult)));
      expect(out.forcedRotation.ticksThreshold).toBe(Math.max(1, Math.round(6 / mult)));
      expect(out.hurdleFloor.byReason.haiku_decision.atrMultiplier).toBe(round2(0.4 / mult));
      expect(out.hurdleFloor.byReason.stagnation.atrMultiplier).toBe(round2(0.3 / mult));
      expect(out.hurdleFloor.default.atrMultiplier).toBe(round2(0.5 / mult));

      // Safety/structural fields byte-verbatim (B4 §D untouched list).
      expect(out.swapWindow.windowMinutes).toBe(60);
      expect(out.swapWindow.countEmergencies).toBe(false);
      expect(out.swapWindow.enabled).toBe(true);
      expect(out.forcedRotation.enabled).toBe(true);
      expect(out.forcedRotation.pctThreshold).toBe(0.001);
      expect(out.forcedRotation.winnerThreshold).toBe(1.5);
      expect(out.forcedRotation.maxTickAgeMinutes).toBe(20);
      expect(out.hurdleFloor.enabled).toBe(true);
      expect(out.hurdleFloor.requireBenchPositive).toBe(true);
      // Unknown/future keys ride through untouched (merge-not-replace).
      expect(out.futureUnknownKnob).toBe(input.futureUnknownKnob);
      // The INPUT object was never mutated — asserted for ALL FIVE band
      // leaves: resolveHftConfig hands back the module-level object from the
      // fenced archetype table, so an in-place write here would compound the
      // shared config across every battle and tick (the exact bug class an
      // aliased-output-only check cannot see).
      expect(input.swapWindow.capPerWindow).toBe(4);
      expect(input.forcedRotation.ticksThreshold).toBe(6);
      expect(input.hurdleFloor.byReason.haiku_decision.atrMultiplier).toBe(0.4);
      expect(input.hurdleFloor.byReason.stagnation.atrMultiplier).toBe(0.3);
      expect(input.hurdleFloor.default.atrMultiplier).toBe(0.5);
    });
  }
});

// ==================== I. ARCHETYPE CHANGE WITH STALE LEANS ====================
describe('I. revalidation omits + records — stale archetype (all six menus) and deprecated version', () => {
  it('a lean from every OTHER archetype is omitted (not_in_menu) under each of the six menus', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (let i = 0; i < ARCHETYPE_KEYS.length; i++) {
      const arch = ARCHETYPE_KEYS[i];
      const foreignArch = ARCHETYPE_KEYS[(i + 1) % ARCHETYPE_KEYS.length];
      const foreignId = getAllowlist(foreignArch)[0].id;
      const snapshot = buildCustomizationSnapshot({
        id: `agent-${arch}`,
        archetype: arch,
        standingLeans: [{ adjustmentId: foreignId, version: 1, equippedAt: 't1' }],
        settingsRev: 3,
      }, T0);
      expect(snapshot.standingLeans, arch).toEqual([]);
      expect(snapshot.standingLeansInvalidated, arch).toEqual([
        { adjustmentId: foreignId, version: 1, reason: 'not_in_menu' },
      ]);
      expect(snapshot.settingsRev).toBe(3);
    }
    logSpy.mockRestore();
  });

  it('a deprecated pinned version is omitted (deprecated_version) while a current sibling survives', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const snapshot = buildCustomizationSnapshot({
      id: 'agent-1',
      archetype: 'guardian',
      standingLeans: [
        { adjustmentId: 'CP-01', version: 99, equippedAt: 't1' }, // stale pin
        { adjustmentId: 'CP-04', version: getCanonicalTextVersion('guardian', 'CP-04'), equippedAt: 't2' },
      ],
    }, T0);
    logSpy.mockRestore();
    expect(snapshot.standingLeans.map((l) => l.adjustmentId)).toEqual(['CP-04']);
    expect(snapshot.standingLeansInvalidated).toEqual([
      { adjustmentId: 'CP-01', version: 99, reason: 'deprecated_version' },
    ]);
  });

  it('an at-rest conflict pair (adjudicated after equip) loses its LATER member; the cap holds at the kernel value', () => {
    // CN-05 + CN-08 share CN-G1 — legal only if equipped before adjudication.
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [
        { adjustmentId: 'CN-05', version: 1, equippedAt: 't1' },
        { adjustmentId: 'CN-08', version: 1, equippedAt: 't2' }, // later — loses
      ],
      archetypeCodeId: 'contrarian',
    });
    expect(valid.map((l) => l.adjustmentId)).toEqual(['CN-05']);
    expect(invalidated).toEqual([{ adjustmentId: 'CN-08', version: 1, reason: 'conflicting_lean' }]);
    expect(STANDING_LEANS_CAP).toBe(2);
  });
});

// ==================== SANITY: the shared fixture directive is menu-real ====================
describe('fixture currency', () => {
  it('DIRECTIVE_AT_REST pins a real momentum_chaser adjustment at its current version', () => {
    expect(getCanonicalText('momentum_chaser', DIRECTIVE_AT_REST.adjustmentId)).toBe(DIRECTIVE_AT_REST.text);
    expect(getCanonicalTextVersion('momentum_chaser', DIRECTIVE_AT_REST.adjustmentId)).toBe(DIRECTIVE_AT_REST.canonicalTextVersion);
  });
});
