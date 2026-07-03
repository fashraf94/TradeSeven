// src/services/ruleCompatGuard.test.js
//
// WS1 Phase 2 — guard behavior matrix + per-path wiring coverage.
//
// The real imports of ruleCompatGuard.js / archetypeRuleCompatibility.js /
// compatSurfaceCopy.js ARE the BUILD_RULES §4 dependency-surface guard for the
// pure graph (never mock them). fetchWithAuth is mocked at the transport seam
// ONLY because it transitively pulls the browser Firebase SDK — every test
// that exercises emission injects its own stub transport anyway.
//
// Per-path block coverage (the Phase 2 STOP deliverable): the mode matrix runs
// against every guarded write path, and the wiring suite source-scans
// forgeService to prove the guard is called at all four approved sites (A1
// createRule, B1 setRuleHardness, B2 updateRule, B3 reforgeBundle) plus the
// B6 equip surface. The full fixture-driven service matrix is Phase 3.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));

import {
  isRuleCompatActive,
  evaluateRuleCompatWrite,
  guardRuleCompatWrite,
  emitRuleCompatEvents,
  classifyBundleSnapshots,
  RuleCompatBlockError,
  COMPAT_WRITE_PATHS,
} from './ruleCompatGuard.js';
import { classifyRule } from '../data/archetypeRuleCompatibility.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Known cells (shipped map): a-05×guardian is core_conflict + hard-category;
// tech-rsi-oversold×momentum_chaser is core_conflict + soft-category;
// tech-rsi-oversold×contrarian is native.
const HARD_CONFLICT = { archetype: 'guardian', templateId: 'a-05' };
const SOFT_CONFLICT = { archetype: 'momentum_chaser', templateId: 'tech-rsi-oversold' };
const NATIVE = { archetype: 'contrarian', templateId: 'tech-rsi-oversold' };

const okTransport = () => Promise.resolve({ ok: true });

describe('sanity — the cells this suite is built on', () => {
  it('fixture cells classify as expected', () => {
    expect(classifyRule(HARD_CONFLICT.templateId, HARD_CONFLICT.archetype)).toBe('core_conflict');
    expect(classifyRule(SOFT_CONFLICT.templateId, SOFT_CONFLICT.archetype)).toBe('core_conflict');
    expect(classifyRule(NATIVE.templateId, NATIVE.archetype)).toBe('native');
  });
});

describe('evaluateRuleCompatWrite — mode matrix (§5.1)', () => {
  it("mode 'off': allow with NO classification computed (state null), zero events", () => {
    const r = evaluateRuleCompatWrite({
      ...HARD_CONFLICT, resolvedHardness: 'hard', path: 'create_rule', agentId: 'a1', mode: 'off',
    });
    expect(r).toMatchObject({ decision: 'allow', state: null, blockMessage: null });
    expect(r.events).toEqual([]);
  });

  it("mode 'observe': conflict-hard is ALLOWED but logged as compat_promote_blocked with blocked:false", () => {
    const r = evaluateRuleCompatWrite({
      ...HARD_CONFLICT, resolvedHardness: 'hard', path: 'set_rule_hardness', agentId: 'a1', mode: 'observe',
    });
    expect(r.decision).toBe('allow');
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      type: 'compat_promote_blocked', blocked: false, mode: 'observe',
      hardnessRequested: 'hard', path: 'set_rule_hardness', ruleId: HARD_CONFLICT.templateId,
    });
  });

  it("mode 'observe': conflict-soft logs compat_conflict_equip, never warns/blocks", () => {
    const r = evaluateRuleCompatWrite({
      ...SOFT_CONFLICT, resolvedHardness: 'soft', path: 'create_rule', agentId: 'a1', mode: 'observe',
    });
    expect(r.decision).toBe('allow');
    expect(r.events[0]).toMatchObject({ type: 'compat_conflict_equip', blocked: false });
  });

  it("mode 'enforce': conflict-hard BLOCKS with a user-facing message + blocked:true event", () => {
    const r = evaluateRuleCompatWrite({
      ...HARD_CONFLICT, resolvedHardness: 'hard', path: 'create_rule', agentId: 'a1', mode: 'enforce',
    });
    expect(r.decision).toBe('block');
    expect(r.blockMessage).toMatch(/Capital Preserver/);
    expect(r.events[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: true, mode: 'enforce' });
  });

  it("mode 'enforce': conflict-soft WARNS (allowed) and logs conflict-equip", () => {
    const r = evaluateRuleCompatWrite({
      ...SOFT_CONFLICT, resolvedHardness: 'soft', path: 'create_rule', agentId: 'a1', mode: 'enforce',
    });
    expect(r.decision).toBe('warn');
    expect(r.blockMessage).toBeNull();
    expect(r.events[0]).toMatchObject({ type: 'compat_conflict_equip', blocked: false });
  });

  it('native / neutral / unknown-template / unknown-archetype rules always allow with zero events (fail-open)', () => {
    for (const p of [
      { ...NATIVE, resolvedHardness: 'hard' },
      { archetype: 'degen', templateId: 'fund-market-cap', resolvedHardness: 'hard' }, // neutral fallthrough
      { archetype: 'guardian', templateId: null, resolvedHardness: 'hard' },           // manual rule
      { archetype: 'not-an-archetype', templateId: 'a-05', resolvedHardness: 'hard' }, // unknown archetype
    ]) {
      const r = evaluateRuleCompatWrite({ ...p, path: 'create_rule', agentId: 'a1', mode: 'enforce' });
      expect(r.decision, `${p.archetype}/${p.templateId}`).toBe('allow');
      expect(r.events).toEqual([]);
    }
  });

  it('every guarded write path produces the same block decision for the same cell (path-uniform enforcement)', () => {
    for (const path of ['create_rule', 'set_rule_hardness', 'update_rule_category', 'reforge_carry', 'equip_bundle']) {
      const r = evaluateRuleCompatWrite({
        ...HARD_CONFLICT, resolvedHardness: 'hard', path, agentId: 'a1', mode: 'enforce',
      });
      expect(r.decision, path).toBe('block');
      expect(r.events[0].path).toBe(path);
    }
    expect(COMPAT_WRITE_PATHS).toContain('archetype_change_rescan');
  });
});

describe('guardRuleCompatWrite — throw semantics + emission', () => {
  it('throws RuleCompatBlockError on enforce-blocked writes (after emitting)', async () => {
    const transport = vi.fn(okTransport);
    await expect(
      guardRuleCompatWrite({
        ...HARD_CONFLICT, resolvedHardness: 'hard', path: 'set_rule_hardness',
        agentId: 'a1', mode: 'enforce', transport,
      })
    ).rejects.toMatchObject({ name: 'RuleCompatBlockError', code: 'rule_compat_blocked' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('resolves (no throw) under observe, emitting the attempt', async () => {
    const transport = vi.fn(okTransport);
    const r = await guardRuleCompatWrite({
      ...HARD_CONFLICT, resolvedHardness: 'hard', path: 'set_rule_hardness',
      agentId: 'a1', mode: 'observe', transport,
    });
    expect(r.decision).toBe('allow');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("emits nothing and never touches the transport under 'off'", async () => {
    const transport = vi.fn(okTransport);
    const r = await guardRuleCompatWrite({
      ...HARD_CONFLICT, resolvedHardness: 'hard', path: 'set_rule_hardness',
      agentId: 'a1', mode: 'off', transport,
    });
    expect(r.decision).toBe('allow');
    expect(transport).not.toHaveBeenCalled();
  });

  it('a telemetry failure never blocks the write (emit returns false, guard still resolves)', async () => {
    const transport = vi.fn(() => Promise.reject(new Error('network down')));
    const r = await guardRuleCompatWrite({
      ...SOFT_CONFLICT, resolvedHardness: 'soft', path: 'create_rule',
      agentId: 'a1', mode: 'observe', transport,
    });
    expect(r.decision).toBe('allow');
  });
});

describe('emitRuleCompatEvents — loud, never throwing', () => {
  it('returns true on 2xx, false on non-2xx, false on throw — never rejects', async () => {
    expect(await emitRuleCompatEvents({ agentId: 'a', mode: 'observe', events: [{}], transport: okTransport })).toBe(true);
    expect(await emitRuleCompatEvents({ agentId: 'a', mode: 'observe', events: [{}], transport: () => Promise.resolve({ ok: false, status: 500 }) })).toBe(false);
    expect(await emitRuleCompatEvents({ agentId: 'a', mode: 'observe', events: [{}], transport: () => Promise.reject(new Error('x')) })).toBe(false);
  });

  it('no-ops (true) on an empty event list', async () => {
    const transport = vi.fn(okTransport);
    expect(await emitRuleCompatEvents({ agentId: 'a', mode: 'observe', events: [], transport })).toBe(true);
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('classifyBundleSnapshots — the B6 equip surface', () => {
  const snapshots = [
    { id: 'doc1', sourceRef: 'a-05', category: 'allocation' },          // guardian conflict, hard by category
    { id: 'doc2', sourceRef: 'tech-bollinger-squeeze', category: 'technical' }, // guardian conflict, soft
    { id: 'doc3', sourceRef: 'ts-01', category: 'tier_strategy' },      // guardian NATIVE
    { id: 'doc4', sourceRef: null, category: 'risk' },                  // manual — outside the map
  ];

  it('returns only conflicts, with per-rule resolved hardness (category ?? override)', () => {
    const out = classifyBundleSnapshots({
      archetype: 'guardian', ruleSnapshots: snapshots, ruleHardness: { doc2: 'hard' }, mode: 'enforce',
    });
    expect(out).toHaveLength(2);
    expect(out.find((c) => c.ruleDocId === 'doc1')).toMatchObject({ templateId: 'a-05', resolvedHardness: 'hard' });
    // doc2's authored override promotes the soft-category conflict to hard.
    expect(out.find((c) => c.ruleDocId === 'doc2')).toMatchObject({ templateId: 'tech-bollinger-squeeze', resolvedHardness: 'hard' });
  });

  it("returns [] under 'off' without classifying", () => {
    expect(classifyBundleSnapshots({ archetype: 'guardian', ruleSnapshots: snapshots, mode: 'off' })).toEqual([]);
  });

  it('isRuleCompatActive reflects the tri-state contract', () => {
    expect(isRuleCompatActive('off')).toBe(false);
    expect(isRuleCompatActive('observe')).toBe(true);
    expect(isRuleCompatActive('enforce')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wiring — the fence-lite-approved call sites exist in forgeService (source
// scan, the agent-evaluate.test.js technique). Behavior through the real
// service lands as the Phase 3 fixture matrix.
// ─────────────────────────────────────────────────────────────────────────────
describe('wiring — forgeService guard call sites (fence-lite table)', () => {
  const source = readFileSync(resolve(__dirname, 'forgeService.js'), 'utf-8');

  it('imports the guard and the tri-state flag', () => {
    expect(source).toMatch(/from '\.\/ruleCompatGuard'/);
    expect(source).toMatch(/RULE_COMPAT_MODE/);
  });

  it('A1 createRule guards create-as-hard on the create_rule path', () => {
    expect(source).toMatch(/path: 'create_rule'/);
  });

  it('B1 setRuleHardness guards the explicit promote on the set_rule_hardness path', () => {
    expect(source).toMatch(/path: 'set_rule_hardness'/);
  });

  it('B2 updateRule guards the category flip on the update_rule_category path', () => {
    expect(source).toMatch(/path: 'update_rule_category'/);
  });

  it('B3 reforgeBundle evaluates the carry on the reforge_carry path and reports strips', () => {
    expect(source).toMatch(/path: 'reforge_carry'/);
    expect(source).toMatch(/strippedConflicts/);
  });

  it('B6 equipBundle classifies snapshots and emits equip_bundle events', () => {
    expect(source).toMatch(/classifyBundleSnapshots\(/);
    expect(source).toMatch(/path: 'equip_bundle'/);
  });

  it('every guard body is gated on isRuleCompatActive() so off adds zero reads', () => {
    const gates = source.match(/isRuleCompatActive\(\)/g) || [];
    expect(gates.length).toBeGreaterThanOrEqual(5);
  });

  it('archetype threading: seedDefaultTraits, useTraits.equipTrait, and StarterKit pass archetype (rider 2)', () => {
    const seeder = readFileSync(resolve(__dirname, 'seedDefaultTraits.js'), 'utf-8');
    expect(seeder).toMatch(/createRule\(agentId, spec, \{ archetype \}\)/);
    const traits = readFileSync(resolve(__dirname, '../hooks/useTraits.js'), 'utf-8');
    expect(traits).toMatch(/archetype: compatArchetype/);
    const starter = readFileSync(resolve(__dirname, '../components/Forge/StarterKit.jsx'), 'utf-8');
    expect(starter).toMatch(/\{ archetype: agent\?\.archetype \}/);
  });
});

describe('Invariant R — the guard graph stays off the runtime path', () => {
  const REPO_ROOT = resolve(__dirname, '../..');
  const FORBIDDEN_IMPORTERS = [
    'api/agent/decide.js',
    'api/_utils/agentSwapExecution.js',
    'api/_utils/agentScoring.js',
    'api/_utils/agentRiskManager.js',
    'api/_utils/agentArchetypeConfig.js',
    'api/_utils/agentBattleService.js',
    'api/_utils/agentPromptAssembly.js',
    'api/_utils/agentEvalPromptAssembly.js',
    'api/_utils/projectActiveRules.js',
  ];

  it('ruleCompatGuard / compatSurfaceCopy are imported by no fenced file, not the projection, not the prompt assemblies', () => {
    for (const rel of FORBIDDEN_IMPORTERS) {
      const src = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
      expect(/ruleCompatGuard|compatSurfaceCopy/.test(src), `${rel} touches the guard graph`).toBe(false);
    }
  });
});
