// src/screens/battleView/selectDeployPlan.test.js
//
// A2.1b (D-76) — the plan at deploy. The gates are the point of this file:
// two SYSTEM strings share the keys a model's plan is written to, and either
// one rendered under the agent's name is a C1 violation. Each gate has a
// mutation row that fails if the gate is removed, and each gate's source fact
// has a tripwire that reds if the writer in api/ changes underneath it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  selectDeployPlan,
  selectDeployPlanForSymbol,
  FALLBACK_STRATEGY_PREFIX,
  TIER_RATIONALE_KEY,
} from './selectDeployPlan';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { FLAT6_GAME_MODE, TIERED_GAME_MODE } from '../../constants/agentGameModes';

const BRIEF = 'Energy is the only sector with a bid this week; semis are extended and the tape is thin into the print. Sizing stays defensive.';
const MONOLOGUE = {
  strategy: 'Lean energy, fade the extended semis, keep one hedge.',
  starRationale: 'SLB and DVN are the two cleanest energy breakouts on the board.',
  coreRationale: 'CF gives fertilizer exposure with a different driver. MOS is the hedge against a gas spike.',
  supportRationale: 'MU is the only semi I will hold here, and it is sized small.',
  benchRationale: 'Next best names as swap reserves.',
};

const battle = (over = {}) => ({
  id: 'battle-1',
  gameMode: TIERED_GAME_MODE,
  activatedAt: '2026-09-01T13:30:00.000Z', // Sep 1 ET
  agentContext: { strategyBrief: BRIEF, innerMonologue: MONOLOGUE },
  ...over,
});

describe('the plan is read from the doc the client already has', () => {
  it('carries the brief, the three tier rationales and the deploy instant', () => {
    const plan = selectDeployPlan(battle());
    expect(plan.brief).toBe(BRIEF);
    expect(plan.rationales.star).toBe(MONOLOGUE.starRationale);
    expect(plan.rationales.core).toBe(MONOLOGUE.coreRationale);
    expect(plan.rationales.support).toBe(MONOLOGUE.supportRationale);
    expect(plan.activatedAt).toBe('2026-09-01T13:30:00.000Z');
  });

  it('the bench rationale is NOT carried — there is no bench on the board until A3', () => {
    expect(selectDeployPlan(battle()).rationales.bench).toBeUndefined();
    expect(Object.keys(TIER_RATIONALE_KEY)).toEqual(['star', 'core', 'support']);
  });

  it('falls back to createdAt when a doc carries no activatedAt', () => {
    const plan = selectDeployPlan(battle({ activatedAt: null, createdAt: '2026-08-31T20:00:00.000Z' }));
    expect(plan.activatedAt).toBe('2026-08-31T20:00:00.000Z');
  });

  it('null when there is nothing to show — no context, no words, an empty shape', () => {
    expect(selectDeployPlan(null)).toBeNull();
    expect(selectDeployPlan({})).toBeNull();
    expect(selectDeployPlan(battle({ agentContext: {} }))).toBeNull();
    expect(selectDeployPlan(battle({ agentContext: { strategyBrief: '   ', innerMonologue: {} } }))).toBeNull();
  });

  it('a brief alone, or rationales alone, is still a plan', () => {
    expect(selectDeployPlan(battle({ agentContext: { strategyBrief: BRIEF } })).brief).toBe(BRIEF);
    expect(selectDeployPlan(battle({ agentContext: { innerMonologue: MONOLOGUE } })).brief).toBeNull();
  });
});

describe('GATE (a) — a tournament battle never renders its plan (C1)', () => {
  it('MUTATION ROW — the prescribed deploy writes a SYSTEM string into both keys', () => {
    // decide.js:1335-1336 — this is what a tournament doc actually carries.
    const prescribed = battle({
      gameMode: FLAT6_GAME_MODE,
      agentContext: {
        strategyBrief: 'Prescribed tournament deployment',
        innerMonologue: { strategy: 'Prescribed tournament deployment — the drafted six.' },
      },
    });
    expect(selectDeployPlan(prescribed)).toBeNull();
    // …and the gate is the MODE, not the string: a tournament battle whose
    // plan happened to be model-authored is still gated off.
    expect(selectDeployPlan(battle({ gameMode: FLAT6_GAME_MODE }))).toBeNull();
  });

  it('the tiered mode, and a legacy doc with no gameMode at all, are not gated', () => {
    expect(selectDeployPlan(battle({ gameMode: TIERED_GAME_MODE }))).not.toBeNull();
    expect(selectDeployPlan(battle({ gameMode: undefined }))).not.toBeNull();
  });

  it('TRIPWIRE — the mode string is the one the tournament intake writes', () => {
    expect(FLAT6_GAME_MODE).toBe('baggerbomb_tournament');
    const decide = readFileSync(new URL('../../../api/agent/decide.js', import.meta.url), 'utf8');
    expect(decide).toContain("strategyBrief: 'Prescribed tournament deployment'");
  });
});

describe('GATE (b) — the algorithmic fallback template never renders (C1)', () => {
  it('MUTATION ROW — a fallback deploy carries template rationales under the agent\'s name', () => {
    // decide.js:1181-1187 — no model authored this portfolio.
    const fallback = battle({
      agentContext: {
        strategyBrief: BRIEF,
        innerMonologue: {
          strategy: 'Algorithmic selection based on BaggerBomb fitness scores. High-conviction plays in Star, diversified sectors in Core.',
          starRationale: 'Top 2 stocks by BaggerBomb fit score for maximum upside potential.',
          coreRationale: 'Selected from different sectors than Star picks for diversification.',
          supportRationale: 'Lowest volatility stocks from the shortlist for stability.',
        },
      },
    });
    expect(selectDeployPlan(fallback)).toBeNull();
  });

  it('the gate is the PREFIX, so the whole template moves with it', () => {
    const ctx = (strategy) => battle({ agentContext: { strategyBrief: BRIEF, innerMonologue: { ...MONOLOGUE, strategy } } });
    expect(selectDeployPlan(ctx('Algorithmic selection based on anything at all.'))).toBeNull();
    expect(selectDeployPlan(ctx('Algorithmic selection'))).toBeNull();
    // A model's own strategy that merely MENTIONS the words mid-sentence is
    // not the template: the prefix is anchored at the start.
    expect(selectDeployPlan(ctx('I rejected the algorithmic selection and went with energy.'))).not.toBeNull();
    // No strategy string at all is not the fallback either.
    expect(selectDeployPlan(battle({ agentContext: { strategyBrief: BRIEF, innerMonologue: { coreRationale: 'x' } } }))).not.toBeNull();
  });

  it('TRIPWIRE — the fallback template is still worded this way in decide.js', () => {
    // The gate is a string match because the doc carries no `models` stamp to
    // distinguish the fallback. If decide.js rewords it, this reds — rather
    // than the gate silently failing open and shipping the template as the
    // agent's plan.
    const decide = readFileSync(new URL('../../../api/agent/decide.js', import.meta.url), 'utf8');
    expect(decide).toContain(`strategy: '${FALLBACK_STRATEGY_PREFIX}`);
    expect(FALLBACK_STRATEGY_PREFIX).toBe('Algorithmic selection');
  });
});

describe('a row shows only the sentences of its tier that name it', () => {
  const plan = selectDeployPlan(battle());

  it('MUTATION ROW — a tier rationale is never presented as a position\'s', () => {
    // coreRationale is two sentences about two different pieces.
    expect(selectDeployPlanForSymbol(plan, 'CF', 'core')).toEqual({
      tier: 'core',
      sentences: ['CF gives fertilizer exposure with a different driver.'],
    });
    expect(selectDeployPlanForSymbol(plan, 'MOS', 'core')).toEqual({
      tier: 'core',
      sentences: ['MOS is the hedge against a gas spike.'],
    });
  });

  it('null — render nothing — when the tier\'s rationale never names the piece', () => {
    expect(selectDeployPlanForSymbol(plan, 'NVDA', 'core')).toBeNull();
    // …including a piece named in a DIFFERENT tier's rationale: a row reads
    // its own tier only.
    expect(selectDeployPlanForSymbol(plan, 'SLB', 'core')).toBeNull();
    expect(selectDeployPlanForSymbol(plan, 'SLB', 'star')).not.toBeNull();
  });

  it('null on every missing input, and for a tier with no rationale', () => {
    expect(selectDeployPlanForSymbol(null, 'SLB', 'star')).toBeNull();
    expect(selectDeployPlanForSymbol(plan, null, 'star')).toBeNull();
    expect(selectDeployPlanForSymbol(plan, 'SLB', null)).toBeNull();
    expect(selectDeployPlanForSymbol(plan, 'SLB', 'bench')).toBeNull();
    const noStar = selectDeployPlan(battle({ agentContext: { innerMonologue: { coreRationale: MONOLOGUE.coreRationale } } }));
    expect(selectDeployPlanForSymbol(noStar, 'SLB', 'star')).toBeNull();
  });

  it('uses THE ONE symbol rule — the same one the check extract uses', () => {
    const p = selectDeployPlan(battle({
      agentContext: { innerMonologue: { starRationale: '$SLB is the cleanest breakout. SLBX is not. slb is noise.' } },
    }));
    expect(selectDeployPlanForSymbol(p, 'SLB', 'star').sentences).toEqual(['$SLB is the cleanest breakout.']);
  });
});

describe('the labels say deploy, and say it with a date (gate c)', () => {
  it('the plan is labelled with the deploy date, never as a current decision', () => {
    expect(COPY.planAtDeploy('2026-09-01T13:30:00.000Z')).toBe('The plan at deploy · Sep 1');
    expect(COPY.planAtDeploy(null)).toBe('The plan at deploy');
    expect(COPY.planAtDeploy('not a date')).toBe('The plan at deploy');
  });

  it('a row\'s label names the TIER out loud — the sentence was written about the tier', () => {
    expect(COPY.atDeployTier('star')).toBe('At deploy · Star tier');
    expect(COPY.atDeployTier('core')).toBe('At deploy · Core tier');
    expect(COPY.atDeployTier('support')).toBe('At deploy · Support tier');
    expect(COPY.atDeployTier('bench')).toBeNull();
    expect(COPY.atDeployTier(null)).toBeNull();
  });

  it('the date is ET, so a viewer in another zone reads the deploy DAY the game ran on', () => {
    // 2026-09-01T02:00Z is Aug 31 at 10 PM ET — the day the battle deployed.
    expect(COPY.planAtDeploy('2026-09-01T02:00:00.000Z')).toBe('The plan at deploy · Aug 31');
  });
});
