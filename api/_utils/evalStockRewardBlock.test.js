// BaggerBomb stock thresholds v2, Ruling 10: the tiered eval system prompt's
// reward prose per game. The real fenced assembler and the real render module
// are imported (never mocked — the import is the dependency-surface guard).
import { describe, it, expect } from 'vitest';
import { buildEvalSystemPrompt } from './agentEvalPromptAssembly.js';
import {
  LEGACY_STOCK_REWARD_RULES, MEASURED_STOCK_REWARD_RULES, LEGACY_STOCK_THRESHOLD_PROXIMITY, MEASURED_STOCK_THRESHOLD_PROXIMITY,
  LEGACY_SURVIVAL_MACHINERY, MEASURED_SURVIVAL_MACHINERY, LEGACY_STOCK_MONOLOGUE_EXAMPLES, MEASURED_STOCK_MONOLOGUE_EXAMPLES,
  renderStockRewardRules, renderStockThresholdProximity, renderSurvivalMachinery, renderStockMonologueExamples,
} from './evalStockRewardBlock.js';
import { PROMPT_CONTRIBUTING_MODULES } from './__fixtures__/promptHonestyRegistry.js';
import { stockSummary } from '../../src/utils/stockThresholdModel.js';
import { BAGGER_TIERS, BUST_TIERS } from '../../src/constants/baggerBombScoring.js';

const PAIRS = [
  [LEGACY_STOCK_REWARD_RULES, MEASURED_STOCK_REWARD_RULES],
  [LEGACY_STOCK_THRESHOLD_PROXIMITY, MEASURED_STOCK_THRESHOLD_PROXIMITY],
  [LEGACY_SURVIVAL_MACHINERY, MEASURED_SURVIVAL_MACHINERY],
  [LEGACY_STOCK_MONOLOGUE_EXAMPLES, MEASURED_STOCK_MONOLOGUE_EXAMPLES],
];
const ARCHETYPES = [undefined, 'momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

describe('Ruling 10: measured-model reward prose; legacy byte-identical', () => {
  it.each(ARCHETYPES)('legacy (archetype %s): the default and the explicit legacy prompt are identical and carry every legacy block once', archetype => {
    const base = buildEvalSystemPrompt('Cipher', 'Diversifier', 'baggerbomb_agent', archetype);
    expect(buildEvalSystemPrompt('Cipher', 'Diversifier', 'baggerbomb_agent', archetype, { measuredStockReward: false })).toBe(base);
    for (const [legacy, measured] of PAIRS) { expect(base.split(legacy).length - 1).toBe(1); expect(base).not.toContain(measured); }
  });
  it.each(ARCHETYPES)('measured (archetype %s): exactly the four blocks differ', archetype => {
    const legacy = buildEvalSystemPrompt('Cipher', 'Diversifier', 'baggerbomb_agent', archetype);
    const measured = buildEvalSystemPrompt('Cipher', 'Diversifier', 'baggerbomb_agent', archetype, { measuredStockReward: true });
    let restored = measured;
    for (const [legacyBlock, measuredBlock] of PAIRS) { expect(measured.split(measuredBlock).length - 1).toBe(1); expect(measured).not.toContain(legacyBlock); restored = restored.replace(measuredBlock, () => legacyBlock); }
    expect(restored).toBe(legacy);
  });
  it('the measured rules name the frozen measured % as the divisor and keep crypto on baseATR', () => {
    expect(MEASURED_STOCK_REWARD_RULES).toContain('Reward multiple = priceChange% from the position\'s fill / its frozen measured %');
    expect(MEASURED_STOCK_REWARD_RULES).toContain('the divisor is never baseATR');
    expect(MEASURED_STOCK_REWARD_RULES).toContain('Crypto positions keep ATR multiplier = priceChange% / baseATR');
    for (const t of [...BAGGER_TIERS, ...BUST_TIERS]) expect(MEASURED_STOCK_REWARD_RULES).toContain(`${BUST_TIERS.includes(t) ? '-' : '+'}${t.multiplier.toFixed(1)}x → ${t.label === 'Double Bagger' ? 'DoubleBagger' : t.label}: ${t.points > 0 ? '+' : ''}${t.points} pts`);
    expect(MEASURED_STOCK_THRESHOLD_PROXIMITY).toContain('0.2 × its frozen measured %');
    expect(MEASURED_SURVIVAL_MACHINERY).toContain('one frozen measured % below its fill for a stock');
  });
  it('the worked example matches the model\'s own target arithmetic and half-even cents', () => {
    const fill = 100, pct = 2;
    const targets = [...BAGGER_TIERS.map(t => [t.label, t.multiplier]), ...BUST_TIERS.map(t => [t.label, -t.multiplier])].map(([label, k]) => [label === 'Double Bagger' ? 'DoubleBagger' : label, stockSummary(fill * (1 + k * pct / 100))]);
    for (const [label, cents] of targets) expect(MEASURED_STOCK_REWARD_RULES).toContain(`${label} at $${cents}`);
    expect(MEASURED_STOCK_REWARD_RULES).toContain(`A quote of $101.00 is a +${stockSummary(((101 - fill) / fill * 100) / pct)}x reward multiple`);
  });
  it('the worked monologues are internally consistent in the measured unit', () => {
    const multiple = (move, pct) => stockSummary(move / pct, 2);
    expect(MEASURED_STOCK_MONOLOGUE_EXAMPLES).toContain(`down 1.85% from my fill, which is ${multiple(1.85, 2.5)}x its frozen measured 2.5%`);
    expect(MEASURED_STOCK_MONOLOGUE_EXAMPLES).toContain(`-1.42% from my fill, which is ${multiple(1.42, 2.0)}x its frozen measured 2.0%`);
    expect(MEASURED_STOCK_MONOLOGUE_EXAMPLES).toContain(`-3.5% from my fill, which is ${multiple(3.5, 3.21)}x its frozen measured 3.21%`);
    expect(MEASURED_STOCK_MONOLOGUE_EXAMPLES).toContain(`locking in ${stockSummary(-1.42 * 10 * 1.0, 1)} pts`);
    expect(MEASURED_STOCK_MONOLOGUE_EXAMPLES).toContain(`bleeding ${-3.5 * 10 * 2.0} base points`);
    expect(MEASURED_STOCK_MONOLOGUE_EXAMPLES).not.toMatch(/x ATR|its ATR/);
  });
  it('renderers fall back to legacy for anything but true; flat6 never carries the measured prose', () => {
    for (const v of [false, undefined, null, 'true', 1]) {
      expect(renderStockRewardRules(v)).toBe(LEGACY_STOCK_REWARD_RULES); expect(renderStockThresholdProximity(v)).toBe(LEGACY_STOCK_THRESHOLD_PROXIMITY);
      expect(renderSurvivalMachinery(v)).toBe(LEGACY_SURVIVAL_MACHINERY); expect(renderStockMonologueExamples(v)).toBe(LEGACY_STOCK_MONOLOGUE_EXAMPLES);
    }
    const flat6 = buildEvalSystemPrompt('Cipher', 'Diversifier', 'baggerbomb_tournament', 'diversifier', { measuredStockReward: true });
    expect(flat6).toBe(buildEvalSystemPrompt('Cipher', 'Diversifier', 'baggerbomb_tournament', 'diversifier'));
    for (const [, measured] of PAIRS) expect(flat6).not.toContain(measured);
  });
  it('the render module is registered for the prose-honesty sweep in the same change as the splice', () => {
    expect(PROMPT_CONTRIBUTING_MODULES).toContain('evalStockRewardBlock.js');
  });
});
