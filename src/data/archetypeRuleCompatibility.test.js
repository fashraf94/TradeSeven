// src/data/archetypeRuleCompatibility.test.js
//
// WS1 Phase 1 test suite. This file's import of ./archetypeRuleCompatibility.js
// IS the BUILD_RULES §4 dependency-surface guard: it runs in the Node (vitest)
// env and would explode if a browser-only dep ever entered the module's graph.
// NEVER mock the module.
//
// Suites (WS1 build spec §4.5):
//   1. Structural integrity (families, overrides, zone1Refs, states)
//   2. Coverage — every one of the 143 template ids resolves for all six
//      archetypes (no undefined fall-throughs)
//   3. Seeded-rule invariant — ARCHETYPE_DEFAULT_TRAITS[X] rules classify
//      native/neutral for X (draft tolerates ONLY the declared seed-review
//      cells; the ship build tolerates none)
//   4. Zero-needs_review ship gate (skipped while DRAFT_MODE)
//   5. Invariant R — the module is imported by NO fenced file, NOT by
//      projectActiveRules.js, and NOT by either prompt assembly; and the
//      module itself is zero-import (source-scan assertions)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DRAFT_MODE,
  COMPAT_STATES,
  DRAFT_ONLY_STATES,
  ARCHETYPE_KEYS,
  ZONE1_REFS,
  PARAM_SWING_NOTES,
  RULE_FAMILIES,
  ARCHETYPE_RULE_COMPATIBILITY,
  EXPECTED_DRAFT_SEED_REVIEWS,
  classifyRule,
  getRuleCompatInfo,
  getConflictsForArchetype,
  getNeedsReviewEntries,
} from './archetypeRuleCompatibility.js';
import { FORGE_RULE_TEMPLATES } from './forgeKnowledgeBase.js';
import { ARCHETYPE_DEFAULT_TRAITS, TRAIT_BY_ID } from './traitLibrary.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_IDS = new Set(FORGE_RULE_TEMPLATES.map((t) => t.id));
const VALID_DRAFT_STATES = new Set([...COMPAT_STATES, ...DRAFT_ONLY_STATES]);
const VALID_SHIP_STATES = new Set(COMPAT_STATES);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Structural integrity
// ─────────────────────────────────────────────────────────────────────────────
describe('structural integrity', () => {
  it('covers exactly the six archetype code-ids', () => {
    expect(Object.keys(ARCHETYPE_RULE_COMPATIBILITY).sort()).toEqual([...ARCHETYPE_KEYS].sort());
    expect(ARCHETYPE_KEYS).toHaveLength(6);
  });

  it('every family ruleId names a real template (no typos, no drift)', () => {
    for (const [familyKey, fam] of Object.entries(RULE_FAMILIES)) {
      for (const rid of fam.ruleIds) {
        expect(TEMPLATE_IDS.has(rid), `${familyKey} member ${rid} not in FORGE_RULE_TEMPLATES`).toBe(true);
      }
    }
  });

  it('no rule belongs to two families (direction is per-family; overlap would make defaults ambiguous)', () => {
    const seen = new Map();
    for (const [familyKey, fam] of Object.entries(RULE_FAMILIES)) {
      for (const rid of fam.ruleIds) {
        expect(seen.has(rid), `${rid} in both ${seen.get(rid)} and ${familyKey}`).toBe(false);
        seen.set(rid, familyKey);
      }
    }
  });

  it('every override ruleId names a real template', () => {
    for (const [archetype, arch] of Object.entries(ARCHETYPE_RULE_COMPATIBILITY)) {
      for (const rid of Object.keys(arch.ruleOverrides || {})) {
        expect(TEMPLATE_IDS.has(rid), `${archetype} override ${rid} not in FORGE_RULE_TEMPLATES`).toBe(true);
      }
    }
  });

  it('familyDefaults reference existing families and carry valid states', () => {
    for (const [archetype, arch] of Object.entries(ARCHETYPE_RULE_COMPATIBILITY)) {
      for (const [familyKey, fd] of Object.entries(arch.familyDefaults || {})) {
        expect(RULE_FAMILIES[familyKey], `${archetype} familyDefault for unknown family ${familyKey}`).toBeDefined();
        // needs_review is override-only, so tensionReason is never orphaned.
        expect(VALID_SHIP_STATES.has(fd.state), `${archetype}.${familyKey} state ${fd.state} (needs_review is override-only)`).toBe(true);
      }
    }
  });

  it('override states are valid (draft vocabulary while DRAFT_MODE)', () => {
    for (const [archetype, arch] of Object.entries(ARCHETYPE_RULE_COMPATIBILITY)) {
      for (const [rid, ov] of Object.entries(arch.ruleOverrides || {})) {
        const pool = DRAFT_MODE ? VALID_DRAFT_STATES : VALID_SHIP_STATES;
        expect(pool.has(ov.state), `${archetype}/${rid} state ${ov.state}`).toBe(true);
      }
    }
  });

  it('every core_conflict — family default or override — carries a valid zone1Ref for that archetype', () => {
    for (const [archetype, arch] of Object.entries(ARCHETYPE_RULE_COMPATIBILITY)) {
      for (const [familyKey, fd] of Object.entries(arch.familyDefaults || {})) {
        if (fd.state === 'core_conflict') {
          expect(ZONE1_REFS[fd.zone1Ref], `${archetype}.${familyKey} conflict without zone1Ref`).toBeDefined();
          expect(ZONE1_REFS[fd.zone1Ref].archetype).toBe(archetype);
        }
      }
      for (const [rid, ov] of Object.entries(arch.ruleOverrides || {})) {
        if (ov.state === 'core_conflict') {
          expect(ZONE1_REFS[ov.zone1Ref], `${archetype}/${rid} conflict without zone1Ref`).toBeDefined();
          expect(ZONE1_REFS[ov.zone1Ref].archetype).toBe(archetype);
        }
      }
    }
  });

  it('every needs_review entry carries a non-empty tensionReason and a draftLeaning (never neutral-by-default)', () => {
    for (const entry of getNeedsReviewEntries()) {
      expect(entry.tensionReason.length, `${entry.archetype}/${entry.ruleId} missing tensionReason`).toBeGreaterThan(20);
      expect(['native', 'neutral', 'core_conflict']).toContain(entry.draftLeaning);
    }
  });

  it('draftLeaning appears only on needs_review entries (deleted at ship)', () => {
    for (const [archetype, arch] of Object.entries(ARCHETYPE_RULE_COMPATIBILITY)) {
      for (const [rid, ov] of Object.entries(arch.ruleOverrides || {})) {
        if (ov.state !== 'needs_review') {
          expect(ov.draftLeaning, `${archetype}/${rid} carries draftLeaning without needs_review`).toBeUndefined();
        }
      }
    }
  });

  it('ZONE1_REFS archetypes are valid code-ids with real statements', () => {
    for (const [ref, def] of Object.entries(ZONE1_REFS)) {
      expect(ARCHETYPE_KEYS).toContain(def.archetype);
      expect(def.statement.length, `${ref} statement too short`).toBeGreaterThan(30);
    }
  });

  it('PARAM_SWING_NOTES entries name real templates, valid archetypes, and their classified cell is core_conflict (P3: default direction)', () => {
    for (const [rid, note] of Object.entries(PARAM_SWING_NOTES)) {
      expect(TEMPLATE_IDS.has(rid), `param-swing note for unknown template ${rid}`).toBe(true);
      expect(ARCHETYPE_KEYS).toContain(note.archetype);
      expect(classifyRule(rid, note.archetype)).toBe('core_conflict');
      expect(note.copyHint.length).toBeGreaterThan(20);
      expect(note.inStyleSetting.length).toBeGreaterThan(2);
    }
  });

  it('getConflictsForArchetype agrees with classifyRule and carries refs', () => {
    for (const archetype of ARCHETYPE_KEYS) {
      const conflicts = getConflictsForArchetype(archetype);
      const ids = conflicts.map((c) => c.ruleId);
      expect(new Set(ids).size).toBe(ids.length); // no dupes
      for (const c of conflicts) {
        expect(classifyRule(c.ruleId, archetype)).toBe('core_conflict');
        expect(ZONE1_REFS[c.zone1Ref]).toBeDefined();
      }
      // Completeness: every template classifying core_conflict is listed.
      for (const t of FORGE_RULE_TEMPLATES) {
        if (classifyRule(t.id, archetype) === 'core_conflict') {
          expect(ids, `${archetype} conflict list missing ${t.id}`).toContain(t.id);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Coverage — 143 × 6, no undefined fall-throughs
// ─────────────────────────────────────────────────────────────────────────────
describe('coverage (143 × 6)', () => {
  it('every template id resolves to a defined state for all six archetypes', () => {
    expect(FORGE_RULE_TEMPLATES).toHaveLength(143);
    for (const t of FORGE_RULE_TEMPLATES) {
      for (const archetype of ARCHETYPE_KEYS) {
        const state = classifyRule(t.id, archetype);
        const pool = DRAFT_MODE ? VALID_DRAFT_STATES : VALID_SHIP_STATES;
        expect(pool.has(state), `${t.id} × ${archetype} → ${state}`).toBe(true);
      }
    }
  });

  it('unknown ruleId / unknown archetype fail open to neutral (manual rules, forward-compat)', () => {
    expect(classifyRule('not-a-template', 'guardian')).toBe('neutral');
    expect(classifyRule('tech-rsi-oversold', 'not-an-archetype')).toBe('neutral');
    expect(getRuleCompatInfo('not-a-template', 'guardian').via).toBe('fallthrough');
    expect(getConflictsForArchetype('not-an-archetype')).toEqual([]);
  });

  it('resolution order is override > familyDefault > neutral', () => {
    // tech-macd-bullish ∈ momentum_breakout (contrarian family default:
    // core_conflict) but is override-neutralized as turn-detection.
    expect(getRuleCompatInfo('tech-macd-bullish', 'contrarian')).toMatchObject({ state: 'neutral', via: 'override' });
    // Family default applies where no override exists.
    expect(getRuleCompatInfo('tv-11', 'contrarian')).toMatchObject({ state: 'core_conflict', via: 'family', zone1Ref: 'CN-Z1-DONT-CHASE' });
    // Non-family, non-override rule falls through.
    expect(getRuleCompatInfo('fund-market-cap', 'degen')).toMatchObject({ state: 'neutral', via: 'fallthrough' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Seeded-rule invariant (spec §4.5)
// ─────────────────────────────────────────────────────────────────────────────
describe('seeded-rule invariant', () => {
  const expectedDraftCells = new Set(
    EXPECTED_DRAFT_SEED_REVIEWS.map((e) => `${e.archetype}:${e.ruleId}`)
  );

  it('every ARCHETYPE_DEFAULT_TRAITS rule classifies native or neutral for its archetype' + (DRAFT_MODE ? ' (draft: declared review cells tolerated)' : ''), () => {
    const offenders = [];
    for (const [archetype, traitIds] of Object.entries(ARCHETYPE_DEFAULT_TRAITS)) {
      for (const traitId of traitIds) {
        const def = TRAIT_BY_ID[traitId];
        expect(def, `seed map names unknown trait ${traitId}`).toBeDefined();
        for (const ruleId of def.ruleIds) {
          const state = classifyRule(ruleId, archetype);
          if (state === 'native' || state === 'neutral') continue;
          const cell = `${archetype}:${ruleId}`;
          if (DRAFT_MODE && state === 'needs_review' && expectedDraftCells.has(cell)) continue;
          offenders.push(`${cell} → ${state} (via ${traitId})`);
        }
      }
    }
    // A seeded core_conflict (or an UNDECLARED seeded needs_review) fails the
    // suite and STOPs the build — a human adjudicates seed map vs classification.
    expect(offenders, `Seeded rules violating the invariant:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('declared draft seed-review cells are real: seeded AND currently needs_review (no stale declarations)', () => {
    for (const { archetype, ruleId } of EXPECTED_DRAFT_SEED_REVIEWS) {
      const seededRuleIds = (ARCHETYPE_DEFAULT_TRAITS[archetype] || [])
        .flatMap((tid) => TRAIT_BY_ID[tid]?.ruleIds || []);
      expect(seededRuleIds, `${archetype}:${ruleId} declared but not actually seeded`).toContain(ruleId);
      if (DRAFT_MODE) {
        expect(classifyRule(ruleId, archetype), `${archetype}:${ruleId} declared but not needs_review`).toBe('needs_review');
      }
    }
    if (!DRAFT_MODE) {
      // Ship builds carry no tolerated cells at all.
      expect(EXPECTED_DRAFT_SEED_REVIEWS).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Zero-needs_review ship gate (spec §4.4/§4.5) — skipped only while DRAFT_MODE
// ─────────────────────────────────────────────────────────────────────────────
describe('ship gate', () => {
  it.skipIf(DRAFT_MODE)('ships with zero needs_review entries', () => {
    expect(getNeedsReviewEntries()).toEqual([]);
  });

  it.skipIf(DRAFT_MODE)('ships with every template resolving to a shipped state only', () => {
    for (const t of FORGE_RULE_TEMPLATES) {
      for (const archetype of ARCHETYPE_KEYS) {
        expect(VALID_SHIP_STATES.has(classifyRule(t.id, archetype))).toBe(true);
      }
    }
  });

  // Visible reminder (not a failure) that the map is still draft.
  it(`DRAFT_MODE status: ${DRAFT_MODE ? 'DRAFT — adjudication pending, ship gate skipped' : 'SHIPPED'}`, () => {
    expect(typeof DRAFT_MODE).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Invariant R — dependency test (design §4.3 / WS1 build rule 2)
//    The compat module must never be imported by the fenced files, the
//    projection, or the prompt assemblies. Source-scan assertions (the
//    agent-evaluate.test.js technique).
// ─────────────────────────────────────────────────────────────────────────────
describe('Invariant R — dependency surface', () => {
  const REPO_ROOT = resolve(__dirname, '../..');
  const FORBIDDEN_IMPORTERS = [
    // The eight fenced files (BUILD_RULES §1).
    'api/agent/decide.js',
    'api/_utils/agentSwapExecution.js',
    'api/_utils/agentScoring.js',
    'api/_utils/agentRiskManager.js',
    'api/_utils/agentArchetypeConfig.js',
    'api/_utils/agentBattleService.js',
    'api/_utils/agentPromptAssembly.js',
    'api/_utils/agentEvalPromptAssembly.js',
    // The projection (non-fenced but runtime-neutrality-protected).
    'api/_utils/projectActiveRules.js',
  ];

  it('is imported by no fenced file, not by projectActiveRules, not by either prompt assembly', () => {
    for (const rel of FORBIDDEN_IMPORTERS) {
      const source = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
      expect(
        /archetypeRuleCompatibility/.test(source),
        `${rel} references archetypeRuleCompatibility — Invariant R violation`
      ).toBe(false);
    }
  });

  it('is a zero-import module (pure data + helpers; zero import cost)', () => {
    const source = readFileSync(resolve(__dirname, 'archetypeRuleCompatibility.js'), 'utf-8');
    expect(/^\s*import\s/m.test(source), 'module must not import anything').toBe(false);
    expect(/\brequire\s*\(/.test(source), 'module must not require anything').toBe(false);
  });
});
