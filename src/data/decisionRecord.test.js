// src/data/decisionRecord.test.js
//
// The decision record's shared vocabulary — one source for the pane and the
// narrator (voice-grounding hazard 26). Three things are guarded here:
//
//   1. THE MODULE IS ZERO-IMPORT AND LOADS UNDER PLAIN NODE — the property
//      that lets api/ import it. The finding that put it here (battleViewCopy
//      cannot be loaded by plain Node: an extension-less relative import) is
//      re-proven on every run, so the extraction stays justified rather than
//      remembered.
//   2. THE CLIENT MODULES RE-EXPORT, NEVER RE-DECLARE — battleViewCopy,
//      selectWhyState and selectDeployPlan read these values from here (a
//      source row on each), so the two surfaces cannot drift.
//   3. THE RULES THEMSELVES — the nine trigger sentences, the absence lines,
//      the author rule, the deploy gates — behaviourally.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WOKEN_BY_TYPE,
  wokenBy,
  NO_DECISION,
  NO_DECISION_OUTAGE,
  NO_DECISION_INCOMPLETE,
  noDecisionLine,
  HELD_LABEL,
  swappedLabel,
  DOWNGRADED_LABEL,
  FAILED_LABEL,
  SWAP_FAILED_PREFIX,
  swapDidNotGoThrough,
  tierLabel,
  MOTIVE_AGENT,
  MOTIVE_SYSTEM,
  ENGINE_MOTIVE_PREFIXES,
  TEXT_DECIDES_SOURCES,
  isEngineAuthoredMotive,
  motiveAuthorLabel,
  FALLBACK_STRATEGY_PREFIX,
  FALLBACK_BRIEF_PREFIX,
  deployPlanSuppressed,
  deployBriefText,
  planAtDeployLabel,
} from './decisionRecord.js';
import { BATTLE_VIEW_COPY } from '../screens/battleView/battleViewCopy';
import * as whyState from '../screens/battleView/selectWhyState';
import * as deployPlan from '../screens/battleView/selectDeployPlan';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

/** Load a module under PLAIN Node (no vite resolver); returns the error code or 'LOADED'. */
function plainNodeLoad(rel) {
  const script = `import('${path.join(REPO, rel)}').then(() => console.log('LOADED')).catch((e) => console.log(e.code || 'FAILED'))`;
  return execFileSync(globalThis.process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: REPO }).trim();
}

describe('decisionRecord — zero-import and Node-loadable (the property api/ relies on)', () => {
  it('declares no imports', () => {
    expect(read('src/data/decisionRecord.js')).not.toMatch(/^\s*import\s/m);
  });

  it('loads under plain Node', () => {
    expect(plainNodeLoad('src/data/decisionRecord.js')).toBe('LOADED');
  });

  it('battleViewCopy.js does NOT load under plain Node — the finding that justifies the extraction (hazard 26)', () => {
    // If this ever loads, the extraction is no longer forced; revisit whether
    // api/ should import battleViewCopy directly instead.
    expect(plainNodeLoad('src/screens/battleView/battleViewCopy.js')).toBe('ERR_MODULE_NOT_FOUND');
  });
});

describe('decisionRecord — the client modules re-export, never re-declare (one source)', () => {
  it('BATTLE_VIEW_COPY reads the trigger sentences, the absence lines, the state and author labels from here', () => {
    expect(BATTLE_VIEW_COPY.wokenByType).toBe(WOKEN_BY_TYPE);
    expect(BATTLE_VIEW_COPY.wokenBy(['news_catalyst'])).toBe(wokenBy(['news_catalyst']));
    expect(BATTLE_VIEW_COPY.noDecision).toBe(NO_DECISION);
    expect(BATTLE_VIEW_COPY.noDecisionOutage).toBe(NO_DECISION_OUTAGE);
    expect(BATTLE_VIEW_COPY.noDecisionIncomplete).toBe(NO_DECISION_INCOMPLETE);
    expect(BATTLE_VIEW_COPY.heldLabel).toBe(HELD_LABEL);
    expect(BATTLE_VIEW_COPY.swappedLabel('A', 'B')).toBe(swappedLabel('A', 'B'));
    expect(BATTLE_VIEW_COPY.downgradedLabel).toBe(DOWNGRADED_LABEL);
    expect(BATTLE_VIEW_COPY.failedLabel).toBe(FAILED_LABEL);
    expect(BATTLE_VIEW_COPY.motiveAgent).toBe(MOTIVE_AGENT);
    expect(BATTLE_VIEW_COPY.motiveSystem).toBe(MOTIVE_SYSTEM);
    expect(BATTLE_VIEW_COPY.planAtDeploy('2026-09-08T13:31:00.000Z')).toBe(planAtDeployLabel('Sep 8'));
  });

  it('selectWhyState re-exports the author rule and the thrown-swap prefix from here', () => {
    expect(whyState.ENGINE_MOTIVE_PREFIXES).toBe(ENGINE_MOTIVE_PREFIXES);
    expect(whyState.TEXT_DECIDES_SOURCES).toBe(TEXT_DECIDES_SOURCES);
    expect(whyState.isEngineAuthoredMotive).toBe(isEngineAuthoredMotive);
    expect(whyState.SWAP_FAILED_PREFIX).toBe(SWAP_FAILED_PREFIX);
  });

  it('selectDeployPlan re-exports the two fallback prefixes from here', () => {
    expect(deployPlan.FALLBACK_STRATEGY_PREFIX).toBe(FALLBACK_STRATEGY_PREFIX);
    expect(deployPlan.FALLBACK_BRIEF_PREFIX).toBe(FALLBACK_BRIEF_PREFIX);
  });

  it('no client module re-declares a moved string (source rows)', () => {
    const copy = read('src/screens/battleView/battleViewCopy.js');
    const why = read('src/screens/battleView/selectWhyState.js');
    const plan = read('src/screens/battleView/selectDeployPlan.js');
    expect(copy).not.toContain("'Woken by a price drop'");
    expect(copy).not.toContain("'No decision recorded at this check'");
    expect(copy).not.toContain("'The system\\'s reason'");
    expect(why).not.toContain("export const ENGINE_MOTIVE_PREFIXES");
    expect(why).not.toContain("export function isEngineAuthoredMotive");
    expect(plan).not.toContain("export const FALLBACK_STRATEGY_PREFIX =");
    expect(plan).not.toContain("export const FALLBACK_BRIEF_PREFIX =");
  });
});

describe('decisionRecord — the rules', () => {
  it('names all nine persisted trigger types and nothing else (D-81)', () => {
    expect(Object.keys(WOKEN_BY_TYPE)).toEqual([
      'price_drop', 'forced_open', 'forced_close', 'threshold_proximity', 'bench_outperformance',
      'vwap_deviation', 'bandwidth_squeeze', 'nr7_contraction', 'news_catalyst',
    ]);
    for (const line of Object.values(WOKEN_BY_TYPE)) expect(line).toMatch(/^Woken by /);
  });

  it('wokenBy takes the first RULED type and renders nothing for an unknown one', () => {
    expect(wokenBy(['mystery', 'price_drop'])).toBe('Woken by a price drop');
    expect(wokenBy(['mystery'])).toBeNull();
    expect(wokenBy(null)).toBeNull();
    expect(wokenBy([])).toBeNull();
  });

  it('the absence lines: a timeout earns the timeout words, every other class the neutral line (D-65 / D-69)', () => {
    expect(noDecisionLine({ failureClass: 'timeout' })).toBe(NO_DECISION_OUTAGE);
    for (const cls of ['budget_skipped', 'truncated_response', '502', 'TypeError', 'unknown', undefined]) {
      expect(noDecisionLine({ failureClass: cls })).toBe(NO_DECISION_INCOMPLETE);
    }
    expect(NO_DECISION_OUTAGE.startsWith(NO_DECISION)).toBe(true);
    expect(NO_DECISION_INCOMPLETE.startsWith(NO_DECISION)).toBe(true);
  });

  it('the thrown-swap prefix decides the fourth state (D-66)', () => {
    expect(swapDidNotGoThrough({ validationErrors: ['Swap execution failed: boom'] })).toBe(true);
    expect(swapDidNotGoThrough({ validationErrors: ['Guardrail blocked swap'] })).toBe(false);
    expect(swapDidNotGoThrough({})).toBe(false);
    expect(swapDidNotGoThrough(null)).toBe(false);
  });

  it('tierLabel maps the three tiers and nothing else', () => {
    expect(tierLabel('star')).toBe('Star');
    expect(tierLabel('core')).toBe('Core');
    expect(tierLabel('support')).toBe('Support');
    expect(tierLabel('bench')).toBeNull();
    expect(tierLabel(undefined)).toBeNull();
  });

  it('the author rule: the text decides on an evaluation entry (no source)', () => {
    for (const prefix of ENGINE_MOTIVE_PREFIXES) {
      expect(isEngineAuthoredMotive(`${prefix} something`)).toBe(true);
      expect(motiveAuthorLabel(`  ${prefix} something`)).toBe(MOTIVE_SYSTEM);
    }
    expect(isEngineAuthoredMotive('The guardrail override would have fired, so I cut it myself.')).toBe(false);
    expect(motiveAuthorLabel('KO has gone dead money.')).toBe(MOTIVE_AGENT);
    expect(isEngineAuthoredMotive(null)).toBe(false);
  });

  it('the author rule: a non-exception source is engine-authored whatever the text (C1 default)', () => {
    expect(isEngineAuthoredMotive('A first-person sentence.', 'risk_manager')).toBe(true);
    expect(isEngineAuthoredMotive('A first-person sentence.', 'gameplan_meeting')).toBe(true);
    expect(isEngineAuthoredMotive('A first-person sentence.', 'haiku')).toBe(false);
    expect(isEngineAuthoredMotive('A first-person sentence.', 'guardrail')).toBe(false);
    expect(TEXT_DECIDES_SOURCES).toEqual(['haiku', 'guardrail']);
  });

  it('the deploy gates: tournament and the algorithmic fallback suppress the plan; the strategy fallback withholds only the brief', () => {
    const TOURNAMENT = 'baggerbomb_tournament';
    const honest = { gameMode: 'baggerbomb_agent', agentContext: { strategyBrief: 'Semis lead; ride the leaders.', innerMonologue: { strategy: 'Lean into strength.' } } };
    expect(deployPlanSuppressed(honest, TOURNAMENT)).toBe(false);
    expect(deployBriefText(honest.agentContext)).toBe('Semis lead; ride the leaders.');
    expect(deployPlanSuppressed({ ...honest, gameMode: TOURNAMENT }, TOURNAMENT)).toBe(true);
    expect(deployPlanSuppressed({ ...honest, agentContext: { ...honest.agentContext, innerMonologue: { strategy: 'Algorithmic selection based on BaggerBomb fitness scores' } } }, TOURNAMENT)).toBe(true);
    expect(deployPlanSuppressed({ gameMode: 'baggerbomb_agent' }, TOURNAMENT)).toBe(true);
    expect(deployBriefText({ strategyBrief: 'Automated selection based on archetype fitness scores.' })).toBeNull();
    expect(deployBriefText({ strategyBrief: '   ' })).toBeNull();
    expect(deployBriefText(null)).toBeNull();
  });

  it('the plan-at-deploy label always carries a date, or is nothing (D-76)', () => {
    expect(planAtDeployLabel('Sep 8')).toBe('The plan at deploy · Sep 8');
    expect(planAtDeployLabel(null)).toBeNull();
    expect(planAtDeployLabel('')).toBeNull();
  });
});
