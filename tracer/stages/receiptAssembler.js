// Stage 5: Receipt Assembler.
// Implements Pipeline Contract V1.1 §10.4. Deterministic stitch — no LLM generation.
// primaryDriver constraint: must be the highest |signedContribution| skill whose signal
// sign matches dominantSignal polarity. Opposing skills route to conflictingSignals.

export function assembleReceipt(decision, allStageOutputs) {
  const { ctx, aggregated, modulated, sized, enforced } = allStageOutputs;
  const ticker = decision.ticker;

  const aggregatedCandidate = aggregated.candidates.find(c => c.ticker === ticker);
  const modulatedCandidate = modulated.candidates.find(c => c.ticker === ticker);
  const sizedCandidate = sized.candidates.find(c => c.ticker === ticker);

  const polarity = Math.sign(aggregatedCandidate.netConviction);

  // primaryDriver: filter contributors by polarity match, pick highest |signedContribution|.
  let primaryDriver = 'No primary driver';
  let triggeringSignal = '';
  if (polarity !== 0) {
    const matching = aggregatedCandidate.contributingSkills
      .filter(c => Math.sign(c.signedContribution) === polarity);
    if (matching.length > 0) {
      const sorted = [...matching].sort((a, b) =>
        Math.abs(b.signedContribution) - Math.abs(a.signedContribution),
      );
      primaryDriver = sorted[0].skillName;
      triggeringSignal = sorted[0].reasonFragment;
    }
  }

  const conflictingSignals = polarity !== 0
    ? aggregatedCandidate.contributingSkills
        .filter(c => Math.sign(c.signedContribution) === -polarity)
        .map(c => c.reasonFragment)
    : [];

  const tickerEnforcerActions = enforced.enforcerLog.filter(a => a.appliedTo === ticker);
  const tickerModulatorActions = modulated.modulatorLog.filter(a =>
    Array.isArray(a.appliedTo) && a.appliedTo.includes(ticker),
  );
  const tickerSizerAction = sized.sizerLog.find(s => s.ticker === ticker);

  const enforcementNetEffect =
    tickerEnforcerActions.length === 0 ? 'unconstrained'
    : tickerEnforcerActions.some(a => a.constraintType === 'reject') ? 'rejected'
    : 'clamped';

  const isVetoed = !!modulatedCandidate?.vetoed;
  const isClamped = enforcementNetEffect === 'clamped';
  const isRejected = enforcementNetEffect === 'rejected';

  return {
    receiptId: `receipt_${ticker}_${ctx.evaluationId}`,
    evaluationId: ctx.evaluationId,
    battleId: ctx.battleId,
    agentId: ctx.agentId,
    timestamp: ctx.tickTimestamp,

    outcome: {
      ticker,
      action: decision.finalAction,
      sizePct: decision.finalSizePct,
      sizeUsd: decision.finalSizeUsd,
    },

    reasoning: {
      generators: {
        universeSize: ctx.universe.tickers.length,
        skillsEvaluated: aggregatedCandidate.contributingSkills.map(c => ({
          name: c.skillName,
          conviction: c.conviction,
          rationale: c.reasonFragment,
          signal: c.signal,
          wasMissing: c.wasMissing,
        })),
        aggregatedNetConviction: aggregatedCandidate.netConviction,
        signalAgreement: aggregatedCandidate.signalAgreement,
      },
      modulators: {
        actions: tickerModulatorActions,
        netEffect: deriveModulatorEffect(modulatedCandidate, aggregatedCandidate),
      },
      sizing: {
        inputConviction: Math.abs(modulatedCandidate.finalConviction),
        policyApplied: ctx.loadout.sizingPolicy.method,
        computedSizePct: sizedCandidate.proposedSizePct,
      },
      enforcement: {
        actions: tickerEnforcerActions,
        passedConstraints: decision.passedConstraints,
        netEffect: enforcementNetEffect,
      },
      summary: {
        primaryDriver,
        triggeringSignal,
        conflictingSignals,
        behavioralInfluence: tickerModulatorActions.length > 0
          ? tickerModulatorActions[0].effect.description
          : undefined,
        sizingInfluence: tickerSizerAction?.reason,
        constraintInfluence: tickerEnforcerActions.length > 0
          ? tickerEnforcerActions[0].effect
          : undefined,
      },
    },

    displayPriority: (isVetoed || isClamped || isRejected) ? 'high' : 'normal',
    isUserSurprising: isVetoed || isClamped || isRejected,
  };
}

function deriveModulatorEffect(modulatedCandidate, aggregatedCandidate) {
  if (!modulatedCandidate) return 'neutral';
  if (modulatedCandidate.vetoed) return 'vetoed';
  const baseAbs = Math.abs(aggregatedCandidate.netConviction);
  const finalAbs = Math.abs(modulatedCandidate.finalConviction);
  if (finalAbs > baseAbs) return 'amplified';
  if (finalAbs < baseAbs) return 'dampened';
  return 'neutral';
}
