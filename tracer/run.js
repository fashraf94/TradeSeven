#!/usr/bin/env node
// FantasyTrades Tracer Bullet — V1 entry point.
// Orchestrates a full pipeline run for each scenario; prints scenario summaries
// and a final violation report; exits 0 (clean), 1 (violations), or 2 (crash).
// Pipeline Contract V1.1 + Errata 1; Constraint Set V1; Sizing Policy V1.

import * as scenarios from './scenarios.js';
import { runQuantSkill } from './stubs/quantSkills.js';
import { runModulator, getModulatorType } from './stubs/modulators.js';
import { aggregate } from './stages/aggregator.js';
import { size } from './stages/sizer.js';
import { enforce } from './stages/enforcer.js';
import { assembleReceipt } from './stages/receiptAssembler.js';
import { ViolationLog } from './validation/violations.js';
import { validateStageOutput } from './validation/invariants.js';

async function runTracer() {
  console.log('FantasyTrades Tracer Bullet — V1');
  console.log('Pipeline Contract V1.1 + Errata 1');
  console.log('=====================================');

  const violations = new ViolationLog();

  for (const scenario of scenarios.all) {
    console.log(`\n=== Scenario: ${scenario.name} ===`);
    const result = runScenario(scenario, violations);
    printScenarioSummary(result);
  }

  console.log('\n=====================================');
  violations.printReport();
  console.log('=====================================');

  if (!violations.hasErrors()) {
    console.log('\nTracer exited cleanly. Pipeline contracts validated.');
  }

  process.exit(violations.hasErrors() ? 1 : 0);
}

function runScenario(scenario, violations) {
  const ctx = scenario.evaluationContext;
  validateStageOutput('stage0', ctx, violations);

  // === Stage 1: MoE Generators (per quant skill, batched per ticker) ===
  const quantOutputs = ctx.loadout.quantSkills.map(skill => {
    const stage1Input = {
      universe: ctx.universe.tickers,
      marketState: ctx.marketState,
      skillTemplate: { templateId: skill.templateId, parameters: skill.parameters },
      stubOverrides: scenario.stubOverrides,
    };
    const output = runQuantSkill(skill, stage1Input);
    validateStageOutput('stage1', output, violations, ctx);
    return output;
  });

  // === Stage 2: Aggregator ===
  const aggregated = aggregate(quantOutputs, ctx.loadout, ctx.universe);
  validateStageOutput('stage2', aggregated, violations, ctx);

  // === Stage 3: Modulator DAG ===
  const modulated = runModulatorDag(aggregated, ctx.loadout, ctx.agentState);
  validateStageOutput('stage3', modulated, violations, ctx);

  // === Stage 3.5: Sizer ===
  const sized = size(modulated, ctx.agentState, ctx.loadout.sizingPolicy);
  validateStageOutput('stage35', sized, violations, ctx);

  // === Stage 4: Enforcer ===
  const enforced = enforce(sized, ctx.loadout.constraints, ctx.agentState, ctx.marketState);
  validateStageOutput('stage4', enforced, violations, ctx);

  // === Stage 5: Receipt Assembly (one per executed decision) ===
  const receipts = enforced.decisions
    .filter(d => d.finalAction !== 'skip')
    .map(decision => {
      const receipt = assembleReceipt(decision, {
        ctx, quantOutputs, aggregated, modulated, sized, enforced,
      });
      validateStageOutput('stage5', receipt, violations, ctx);
      return receipt;
    });

  return { ctx, quantOutputs, aggregated, modulated, sized, enforced, receipts };
}

// Stage 3 implementation: ordered DAG (multipliers → additives → vetoes),
// one log entry per equipped modulator (cardinality === loadout.behavioralSkills.length),
// with appliedTo: string[] aggregating tickers the modulator fired on.
function runModulatorDag(aggregated, loadout, agentState) {
  const modulators = loadout.behavioralSkills;
  const modulatorLog = [];

  // Mutable per-candidate working state
  const candidateState = aggregated.candidates.map(agg => ({
    ticker: agg.ticker,
    baseConviction: agg.netConviction,
    multipliedConviction: agg.netConviction,
    finalConviction: agg.netConviction,
    vetoed: false,
    vetoReason: undefined,
    contributingSkills: agg.contributingSkills,
    signalAgreement: agg.signalAgreement,
  }));

  let executionOrder = 0;
  const typeOrder = ['multiplier', 'additive', 'veto'];

  for (const targetType of typeOrder) {
    const modsOfType = modulators.filter(m => getModulatorType(m.templateId) === targetType);

    for (const mod of modsOfType) {
      executionOrder += 1;
      const appliedTo = [];
      let lastEffect = { description: 'Evaluated, no action' };

      for (const cs of candidateState) {
        if (cs.vetoed) continue; // first veto wins; no further modulation on that candidate

        const candidateSnapshot = {
          ticker: cs.ticker,
          netConviction: targetType === 'multiplier' ? cs.multipliedConviction : cs.finalConviction,
          signal: deriveSignal(cs.finalConviction, false),
        };
        const action = runModulator(mod, candidateSnapshot, agentState);
        if (action === null) continue;

        appliedTo.push(cs.ticker);
        lastEffect = action.effect;

        if (targetType === 'multiplier') {
          cs.multipliedConviction = cs.multipliedConviction * action.effect.numericChange;
          cs.finalConviction = cs.multipliedConviction;
        } else if (targetType === 'additive') {
          cs.finalConviction = cs.finalConviction + action.effect.numericChange;
        } else if (targetType === 'veto') {
          cs.vetoed = true;
          cs.vetoReason = action.vetoReason;
        }
      }

      modulatorLog.push({
        modulatorInstanceId: mod.instanceId,
        modulatorTemplateId: mod.templateId,
        modulatorName: mod.name,
        modulatorType: targetType,
        executionOrder,
        appliedTo,
        effect: lastEffect,
      });
    }
  }

  const candidates = candidateState.map(cs => ({
    ticker: cs.ticker,
    baseConviction: cs.baseConviction,
    multipliedConviction: cs.multipliedConviction,
    finalConviction: cs.finalConviction,
    vetoed: cs.vetoed,
    vetoReason: cs.vetoReason,
    signal: deriveSignal(cs.finalConviction, cs.vetoed),
    contributingSkills: cs.contributingSkills,
    signalAgreement: cs.signalAgreement,
  }));

  return { candidates, modulatorLog };
}

function deriveSignal(finalConviction, vetoed) {
  if (vetoed) return 'skip';
  if (finalConviction > 0) return 'buy';
  if (finalConviction < 0) return 'sell';
  return 'hold';
}

function printScenarioSummary(result) {
  const { ctx, quantOutputs, aggregated, modulated, sized, enforced, receipts } = result;

  const totalEvaluations = quantOutputs.reduce((sum, o) => sum + o.tickerEvaluations.length, 0);
  const universeSize = ctx.universe.tickers.length;

  console.log(`Stage 1: ${quantOutputs.length} quant skill${quantOutputs.length === 1 ? '' : 's'}, ${totalEvaluations} evaluations across ${universeSize} tickers`);

  const topAgg = pickTop(aggregated.candidates, c => Math.abs(c.netConviction));
  if (topAgg) {
    console.log(`Stage 2: ${aggregated.candidates.length} aggregated candidates, top: ${topAgg.ticker} (netConviction=${topAgg.netConviction}, signalAgreement=${topAgg.signalAgreement.toFixed(2)})`);
  } else {
    console.log(`Stage 2: ${aggregated.candidates.length} aggregated candidates`);
  }

  const evaluatedMods = modulated.modulatorLog.length;
  const firedMods = modulated.modulatorLog.filter(a => a.appliedTo.length > 0);
  const vetoMods = firedMods.filter(a => a.modulatorType === 'veto');
  const fireSummary = vetoMods.length > 0
    ? `${vetoMods.length} vetoed (${vetoMods.map(v => `${v.modulatorName} → ${v.appliedTo.join(',')}`).join('; ')})`
    : `${firedMods.length} fired`;
  console.log(`Stage 3: Modulator DAG: ${evaluatedMods} modulator${evaluatedMods === 1 ? '' : 's'} evaluated, ${fireSummary}`);

  const topSize = sized.candidates.find(c => c.proposedSizePct > 0);
  const allSkippedOrFloor = sized.candidates.every(c => c.signal === 'skip');
  if (topSize) {
    console.log(`Stage 3.5: ${sized.candidates.length} sized candidates, top: ${topSize.ticker} (${topSize.proposedSizePct.toFixed(2)}% portfolio)`);
  } else if (allSkippedOrFloor) {
    console.log(`Stage 3.5: ${sized.candidates.length} sized candidates, all skipped or below floor`);
  } else {
    console.log(`Stage 3.5: ${sized.candidates.length} sized candidates`);
  }

  const clampedCount = enforced.decisions.filter(d => d.clamped).length;
  const rejectedCount = enforced.decisions.filter(d => d.rejected).length;
  const allSkipped = enforced.decisions.every(d => d.finalAction === 'skip');
  let stage4Summary;
  if (allSkipped) {
    stage4Summary = `${enforced.decisions.length} decisions, all signal='skip'`;
  } else {
    const clampDetail = enforced.decisions
      .filter(d => d.clamped)
      .map(d => {
        const action = enforced.enforcerLog.find(a => a.appliedTo === d.ticker && a.constraintType === 'clamp');
        if (action?.numericChange) {
          return `${d.ticker}: ${action.constraintName} ${action.numericChange.from.toFixed(2)}% → ${action.numericChange.to.toFixed(2)}%`;
        }
        return d.ticker;
      });
    const clampStr = clampedCount > 0 ? ` (${clampDetail.join('; ')})` : '';
    stage4Summary = `${enforced.decisions.length} decisions, ${clampedCount} clamped${clampStr}, ${rejectedCount} rejected`;
  }
  console.log(`Stage 4: ${stage4Summary}`);
  for (const d of enforced.decisions) {
    const tag = d.rejected ? 'reject' : d.clamped ? 'clamp' : d.finalAction;
    console.log(`  - ${d.ticker} [${tag}] passedConstraints: [${d.passedConstraints.join(', ')}]`);
  }

  console.log(`Stage 5: ${receipts.length} receipt${receipts.length === 1 ? '' : 's'} assembled${receipts.length === 0 ? ' (no executed trades)' : ''}`);
  for (const r of receipts) {
    const constraintNote = r.reasoning.enforcement.actions.length > 0
      ? `, constraint: ${r.reasoning.enforcement.actions[0].constraintName} ${r.reasoning.enforcement.netEffect}`
      : '';
    console.log(`  - ${r.outcome.ticker} ${r.outcome.action} ${r.outcome.sizePct.toFixed(2)}% (primaryDriver: ${r.reasoning.summary.primaryDriver}${constraintNote})`);
  }
}

function pickTop(arr, keyFn) {
  if (arr.length === 0) return null;
  let best = arr[0];
  let bestKey = keyFn(best);
  for (let i = 1; i < arr.length; i++) {
    const k = keyFn(arr[i]);
    if (k > bestKey) { best = arr[i]; bestKey = k; }
  }
  return bestKey > 0 ? best : arr[0];
}

runTracer().catch(err => {
  console.error('Tracer crashed:', err);
  process.exit(2);
});
