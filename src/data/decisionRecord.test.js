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
  GROUNDING_VERSION,
  DIRECTIVE_FILED_MESSAGE_TYPE,
  GUARDRAIL_SOURCE_PREFIX,
  GUARDRAIL_FORCED_EXIT,
  GUARDRAIL_FORCED_FAILED_LABEL,
  guardrailForcedExit,
  filesChip,
  filedLabel,
  NO_CHANGE_STATUS_LINE,
  FILING_CONFLICT_LINE,
  FILING_BUDGET_LINE,
  FILING_REJECTED_LINE,
  FILING_FAILED_LINE,
  filingFailureLine,
  deployBriefText,
  planAtDeployLabel,
  HYPOTHESIS_LABEL,
  normalizeForDuplicate,
  rationaleCarriesHypothesis,
  displayHypothesis,
  renderHypothesis,
  renderMotive,
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

  // The D-99 hypothesis rule moved HERE from the server when the League
  // Tournament pane landed it (D-99: "the label moves to
  // src/data/decisionRecord.js"). voiceLayerGrounding.js re-exports the four
  // names under their shipped spellings, so its consumers and its own test are
  // unchanged — this row is the tripwire that keeps it a re-export. Read as
  // SOURCE rather than imported: this is a client test, and pulling the api
  // module into its graph would put the server's whole import surface behind
  // every run here.
  it('voiceLayerGrounding re-exports the hypothesis rule, never re-declares it', () => {
    const grounding = read('api/_utils/voiceLayerGrounding.js');
    expect(grounding).toContain("from '../../src/data/decisionRecord.js'");
    expect(grounding).toContain('export { normalizeForDuplicate, rationaleCarriesHypothesis, HYPOTHESIS_LABEL, displayHypothesis };');
    expect(grounding).not.toContain('export const HYPOTHESIS_LABEL =');
    expect(grounding).not.toContain('export function normalizeForDuplicate');
    expect(grounding).not.toContain('export function rationaleCarriesHypothesis');
    expect(grounding).not.toContain('export function displayHypothesis');
    expect(grounding).not.toContain("'Hypothesis recorded at this check");
  });

  // The pane the move was for. A source row, not a behaviour row — the five
  // mount-path rows in Flat6BattleView.recordRendering.jsdom.test.jsx prove
  // what a player sees; this one proves the pane has no second renderer to
  // drift to.
  it('the League Tournament pane renders through this module, not its own copy', () => {
    const pane = read('src/components/Tournament/Flat6BattleView.jsx');
    expect(pane).toContain("from '../../data/decisionRecord'");
    expect(pane).toContain('renderMotive(e.rationale)');
    expect(pane).toContain('renderHypothesis(e)');
    expect(pane).not.toContain('{e.rationale}');
    expect(pane).not.toContain('{e.hypothesis}');
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

  it('the filing strings — the chip label, the receipt word, the no-change line and the four failure lines — are these bytes (review R-10 / R-31)', () => {
    expect(filesChip('Widen the spread (target more sectors)')).toBe('Files: Widen the spread (target more sectors)');
    expect(filesChip('')).toBeNull();
    expect(filesChip(null)).toBeNull();
    expect(filedLabel('11:20 AM')).toBe('Filed 11:20 AM');
    expect(filedLabel(null)).toBe('Filed');
    expect(NO_CHANGE_STATUS_LINE).toBe('No change made to your strategy this turn.');
    expect(filingFailureLine(409)).toBe(FILING_CONFLICT_LINE);
    expect(filingFailureLine(429)).toBe(FILING_BUDGET_LINE);
    expect(filingFailureLine(422)).toBe(FILING_REJECTED_LINE);
    // 404 — the route does not exist for this caller (file-directive.js check
    // 7). It shares the 422 line rather than the catch-all: a chip minted while
    // the caller resolved 'on' is PERSISTED on the exchange and no client reads
    // the mode, so after a canary abort every tap 404s — and `just now` would
    // promise a retry that can never work. Both causes are pre-write, so the
    // `nothing was filed` clause is attestable for both (D-90).
    expect(filingFailureLine(404)).toBe(FILING_REJECTED_LINE);
    expect(filingFailureLine(404)).toContain('nothing was filed');
    expect(filingFailureLine(500)).toBe(FILING_FAILED_LINE);
    expect(filingFailureLine(undefined)).toBe(FILING_FAILED_LINE);
    expect(FILING_CONFLICT_LINE).toBe('The current directive changed before this could be filed — nothing was filed.');
    expect(FILING_BUDGET_LINE).toBe('No messages left to file with — nothing was filed.');
    expect(FILING_REJECTED_LINE).toBe('That option is no longer on the menu — nothing was filed.');
    // The D-90 rule: a 5xx / network failure never claims nothing was filed.
    expect(FILING_FAILED_LINE).toBe('The directive could not be filed just now.');
    expect(FILING_FAILED_LINE).not.toContain('nothing was filed');
    expect(BATTLE_VIEW_COPY.filesChip('X')).toBe(filesChip('X'));
    expect(BATTLE_VIEW_COPY.filingFailureLine(409)).toBe(FILING_CONFLICT_LINE);
  });

  it('the grounding marker version and the filing type are ONE constant each (review R-22)', () => {
    expect(GROUNDING_VERSION).toBe(1);
    expect(DIRECTIVE_FILED_MESSAGE_TYPE).toBe('directive_filed');
  });

  it('the fifth state (D-70): the three-conjunct gate and its sentence, shared by the pane and the narrator (review R-01)', () => {
    expect(GUARDRAIL_SOURCE_PREFIX).toBe('guardrail_');
    expect(GUARDRAIL_FORCED_EXIT).toBe('forced_exit');
    expect(GUARDRAIL_FORCED_FAILED_LABEL).toBe('A guardrail called for a swap · it did not go through');
    expect(BATTLE_VIEW_COPY.guardrailForcedFailedLabel).toBe(GUARDRAIL_FORCED_FAILED_LABEL);
    const forced = { guardrailSourceNote: 'guardrail_stopLoss', guardrailOverrides: [{ action: 'forced_exit', symbol: 'GILD', replacementSymbol: 'MOS' }] };
    expect(guardrailForcedExit(forced)).toEqual({ action: 'forced_exit', symbol: 'GILD', replacementSymbol: 'MOS' });
    expect(guardrailForcedExit({ ...forced, guardrailSourceNote: 'haiku' })).toBeNull();
    expect(guardrailForcedExit({ ...forced, guardrailOverrides: [{ action: 'reinforced_haiku' }] })).toBeNull();
    expect(guardrailForcedExit({ ...forced, guardrailOverrides: null })).toBeNull();
    expect(guardrailForcedExit(null)).toBeNull();
  });
});

describe('decisionRecord — the hypothesis field (D-99 / §3.2a)', () => {
  it('the label states BOTH halves of the amendment: recorded, and not yet graded', () => {
    // Hazard 29 said never render the hypothesis at all. D-99 amends that on
    // the strength of this label: the prediction is history, and its outcome
    // is not in. A label that dropped either half would put a live forecast in
    // the agent's mouth, which is what hazard 29 was protecting against.
    expect(HYPOTHESIS_LABEL).toBe('Hypothesis recorded at this check (graded after the battle)');
  });

  it('normalizes for DETECTION only — emphasis, whitespace and one label head', () => {
    expect(normalizeForDuplicate('**Hypothesis:   CF will   break out.**')).toBe('CF will break out.');
    expect(normalizeForDuplicate('_hypothesis:_ *CF* will break out.')).toBe('CF will break out.');
    // An underscore inside an identifier is not emphasis (review R-14).
    expect(normalizeForDuplicate('threshold_proximity on NOW_and_TSLA')).toBe('threshold_proximity on NOW_and_TSLA');
    expect(normalizeForDuplicate(null)).toBe('');
  });

  it('catches the known bold-vs-field duplicate, and only a real one', () => {
    const hypothesis = 'Hypothesis: CF will break out.';
    expect(rationaleCarriesHypothesis(`Held. **${hypothesis}**`, hypothesis)).toBe(true);
    expect(rationaleCarriesHypothesis('Held on strength.', hypothesis)).toBe(false);
    expect(rationaleCarriesHypothesis('Held on strength.', '')).toBe(false);
  });

  it('drops the field\'s own label head for display, bytes otherwise verbatim', () => {
    expect(displayHypothesis('Hypothesis: CF breaks out.')).toBe('CF breaks out.');
    expect(displayHypothesis('**Bold** claim')).toBe('**Bold** claim');
  });

  it('renderHypothesis gates on all three conjuncts, and on nothing else', () => {
    const hypothesis = 'Hypothesis: AVGO closes above its 20-day.';

    // Present, the agent's own, not already said → it shows, head dropped.
    expect(renderHypothesis({ rationale: 'Adding on the breakout.', hypothesis }))
      .toBe('AVGO closes above its 20-day.');

    // Absent.
    expect(renderHypothesis({ rationale: 'Adding on the breakout.', hypothesis: null })).toBeNull();
    expect(renderHypothesis({ rationale: 'Adding on the breakout.' })).toBeNull();
    expect(renderHypothesis(null)).toBeNull();

    // Already inside the rationale (§3.2a) — rendered once, not twice.
    expect(renderHypothesis({ rationale: `Held. **${hypothesis}**`, hypothesis })).toBeNull();

    // ENGINE-authored rationale: the cron writes its own hypothesis beside its
    // own sentence, and that is not a forecast the check made (review R-12).
    expect(renderHypothesis({
      rationale: 'Guardrail override (guardrail_stopLoss): Guardrail override: stop-loss at 8% breached on GILD (-9.24%).',
      hypothesis: 'Hypothesis: deterministic guardrail enforcement — stop-loss at 8% breached on GILD (-9.24%).',
    })).toBeNull();
    expect(renderHypothesis({ rationale: 'Risk manager: trimming exposure.', hypothesis })).toBeNull();
  });

  it('renderMotive strips the cron machinery the League pane used to show raw', () => {
    // The two shapes agent-evaluate.js:2124 composes, end to end.
    const status = 'Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.';
    expect(renderMotive(`Guardrail override (guardrail_stopLoss): ${status}`)).toBe(status);
    expect(renderMotive('Guardrail override (guardrail_max_sector_weight): Sector cap reached on energy.'))
      .toBe('Guardrail override: Sector cap reached on energy.');
  });
});
