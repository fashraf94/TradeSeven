// api/_utils/activationGate.js
//
// Archetype Architecture Phase 2 (P2.3) — the §5.6 production activation
// gate, amended by A-4. The compiler ships dark and CANNOT activate in
// production until this check passes against the live corpus:
//
//   (a) §5.6 base tier — intendedMode + copyClass + receiptTag authored on
//       every rule template (all-or-nothing across the corpus);
//   (b) §5.6 deterministic tier — detectorSource + guardrailBinding +
//       missingDataFallback on every rule whose authored metadata declares a
//       guardrailBinding (the deterministic candidates);
//   (c) A-4 compat completeness — an EXPLICIT verdict cell for every
//       equippable rule × every launch archetype. The live map's
//       fallthrough-to-neutral (archetypeRuleCompatibility.getRuleCompatInfo
//       via:'fallthrough') is ABSENCE, not a verdict. Season-only rules are
//       in scope iff equippable in a launch mode per GameModePolicy
//       (ruleModeGate) — at HEAD the launch gates admit modes 'both'/'clash'.
//
// STATUS BY DESIGN: this check FAILS at HEAD (the corpus carries none of the
// §5.6 fields — census Map 3A; Phases 3–4 author them). It is not consulted
// per-compile: with COMPILER_ENABLED on in preview, compiles run and write
// their (validation-failing) CompiledBuilds — §4.4 validation is a recorded
// field, not a write gate. This gate is the FLAG-FLIP precondition: the
// production activation PR (not part of Phase 2) must show it green, and
// activationGate.test.js asserts today's red so the corpus state is always
// visible in CI.

import { FORGE_RULE_TEMPLATES } from '../../src/data/forgeKnowledgeBase.js';
import { getRuleCompatInfo } from '../../src/data/archetypeRuleCompatibility.js';
import { VALID_ARCHETYPES } from './agentArchetypeConfig.js';
import { GAME_MODE_POLICIES, LIVE_DEPLOY_MODES } from './gameModePolicy.js';

const BASE_FIELDS = ['intendedMode', 'copyClass', 'receiptTag'];
const DETERMINISTIC_FIELDS = ['detectorSource', 'guardrailBinding', 'missingDataFallback'];

/**
 * Pure check over injectable inputs (defaults = the live corpus/map), so the
 * paired test can also prove the gate CAN pass against a complete fixture
 * corpus.
 */
export function checkActivationGate({
  templates = FORGE_RULE_TEMPLATES,
  archetypes = VALID_ARCHETYPES,
  getCompat = getRuleCompatInfo,
  launchModeGates = LIVE_DEPLOY_MODES.map((m) => GAME_MODE_POLICIES[m].ruleModeGate),
} = {}) {
  const launchAdmissible = new Set(launchModeGates.flat());
  const equippable = templates.filter((t) => launchAdmissible.has(t.modes));

  const missingBaseMetadata = [];
  const missingDeterministicMetadata = [];
  for (const t of templates) {
    const missing = BASE_FIELDS.filter((f) => t[f] === undefined || t[f] === null);
    if (missing.length > 0) missingBaseMetadata.push({ ruleId: t.id, missing });
    if (t.guardrailBinding) {
      const dMissing = DETERMINISTIC_FIELDS.filter((f) => t[f] === undefined || t[f] === null);
      if (dMissing.length > 0) missingDeterministicMetadata.push({ ruleId: t.id, missing: dMissing });
    }
  }

  const missingCompatCells = [];
  for (const t of equippable) {
    for (const archetype of archetypes) {
      const info = getCompat(t.id, archetype);
      // A-4: an intentionally universal rule requires an explicit
      // 'compatible' entry per archetype; fallthrough is absence.
      if (!info || info.via === 'fallthrough') {
        missingCompatCells.push({ ruleId: t.id, archetype });
      }
    }
  }

  const passes =
    missingBaseMetadata.length === 0 &&
    missingDeterministicMetadata.length === 0 &&
    missingCompatCells.length === 0;

  return {
    passes,
    counts: {
      templatesTotal: templates.length,
      equippableTemplates: equippable.length,
      archetypes: archetypes.length,
      compatCellsRequired: equippable.length * archetypes.length,
      missingBaseMetadata: missingBaseMetadata.length,
      missingDeterministicMetadata: missingDeterministicMetadata.length,
      missingCompatCells: missingCompatCells.length,
    },
    // Bounded detail — enough to drive the Phase 3–4 authoring worklist
    // without a mega-report.
    sample: {
      missingBaseMetadata: missingBaseMetadata.slice(0, 5),
      missingDeterministicMetadata: missingDeterministicMetadata.slice(0, 5),
      missingCompatCells: missingCompatCells.slice(0, 5),
    },
  };
}
