// Stage 3.5: Sizer. Pure deterministic.
// Implements Sizing Policy Schema V1 §8.1 (per-tick execution),
// §3.1 (linear), §4.1 (fixed_buckets), §5.1 (agreement modulation),
// §6 (sell sizing as fraction of existing position).

export function size(modulated, agentState, sizingPolicy) {
  const sizedCandidates = [];
  const sizerLog = [];

  for (const candidate of modulated.candidates) {
    if (candidate.vetoed) {
      sizedCandidates.push(buildSized(candidate, 0, 0, 'skip'));
      sizerLog.push({
        ticker: candidate.ticker,
        inputConviction: Math.abs(candidate.finalConviction),
        policyApplied: sizingPolicy.method,
        computedSizePct: 0,
        reason: `Vetoed by behavioral modulator: ${candidate.vetoReason}`,
      });
      continue;
    }

    const absConviction = Math.abs(candidate.finalConviction);

    if (absConviction < sizingPolicy.convictionFloor) {
      sizedCandidates.push(buildSized(candidate, 0, 0, 'skip'));
      sizerLog.push({
        ticker: candidate.ticker,
        inputConviction: absConviction,
        policyApplied: sizingPolicy.method,
        computedSizePct: 0,
        reason: `Below conviction floor (${absConviction} < ${sizingPolicy.convictionFloor} archetype minimum)`,
      });
      continue;
    }

    const modulationFactor = 1 - sizingPolicy.agreementWeight * (1 - candidate.signalAgreement);

    let proposedSizePct;
    let proposedSizeUsd;
    let signal = candidate.signal;

    if (candidate.signal === 'sell') {
      const existingPosition = agentState.currentPositions.find(p => p.ticker === candidate.ticker);
      if (!existingPosition || existingPosition.sharesHeld === 0) {
        sizedCandidates.push(buildSized(candidate, 0, 0, 'skip'));
        sizerLog.push({
          ticker: candidate.ticker,
          inputConviction: absConviction,
          policyApplied: sizingPolicy.method,
          computedSizePct: 0,
          reason: 'Sell signal but no existing position',
        });
        continue;
      }
      const preAgreementFraction = computeFraction(absConviction, sizingPolicy);
      const finalFraction = preAgreementFraction * modulationFactor;
      proposedSizePct = finalFraction * existingPosition.sizePct;
      proposedSizeUsd = finalFraction * existingPosition.marketValue;
    } else {
      const preAgreementSizePct = computeSize(absConviction, sizingPolicy);
      proposedSizePct = preAgreementSizePct * modulationFactor;
      proposedSizeUsd = (proposedSizePct / 100) * agentState.portfolioValue;
    }

    if (Number.isNaN(proposedSizePct) || proposedSizePct < 0 || proposedSizePct > 100) {
      console.error(`[sizer] invalid size for ${candidate.ticker}: ${proposedSizePct}`);
      proposedSizePct = 0;
      proposedSizeUsd = 0;
      signal = 'skip';
    }

    sizedCandidates.push(buildSized(candidate, proposedSizePct, proposedSizeUsd, signal));
    sizerLog.push({
      ticker: candidate.ticker,
      inputConviction: absConviction,
      policyApplied: sizingPolicy.method,
      computedSizePct: proposedSizePct,
      reason: buildReason(absConviction, candidate.signalAgreement, sizingPolicy, proposedSizePct),
    });
  }

  // Sort descending by absConviction; tie-break by larger proposedSizePct.
  sizedCandidates.sort((a, b) => {
    const absA = Math.abs(a.finalConviction);
    const absB = Math.abs(b.finalConviction);
    if (absB !== absA) return absB - absA;
    return b.proposedSizePct - a.proposedSizePct;
  });

  return { candidates: sizedCandidates, sizerLog };
}

function buildSized(candidate, proposedSizePct, proposedSizeUsd, signal) {
  return {
    ticker: candidate.ticker,
    finalConviction: candidate.finalConviction,
    signal,
    vetoed: candidate.vetoed,
    proposedSizePct,
    proposedSizeUsd,
    baseConviction: candidate.baseConviction,
    contributingSkills: candidate.contributingSkills,
    signalAgreement: candidate.signalAgreement,
  };
}

// Pre-agreement-modulation size for buy/hold candidates (% of portfolio).
function computeSize(absConviction, policy) {
  if (policy.method === 'linear') return computeLinear(absConviction, policy);
  if (policy.method === 'fixed_buckets') return computeFixedBuckets(absConviction, policy);
  throw new Error(`Unknown sizing method: ${policy.method}`);
}

// Pre-agreement-modulation fraction for sell candidates (fraction of existing position).
function computeFraction(absConviction, policy) {
  if (policy.method === 'linear') {
    if (absConviction < policy.convictionFloor) return 0;
    const range = 100 - policy.convictionFloor;
    let ratio = (absConviction - policy.convictionFloor) / range;
    ratio = Math.max(0, Math.min(1, ratio));
    const baseFrac = policy.baseSizePct / policy.maxSizePct;
    return baseFrac + ratio * (1 - baseFrac);
  }
  if (policy.method === 'fixed_buckets') {
    if (absConviction < policy.convictionFloor) return 0;
    if (absConviction <= 50) return policy.baseSizePct / policy.maxSizePct;
    if (absConviction <= 75) return Math.min(1, (1.5 * policy.baseSizePct) / policy.maxSizePct);
    return 1;
  }
  throw new Error(`Unknown sizing method: ${policy.method}`);
}

function computeLinear(absConviction, policy) {
  if (absConviction < policy.convictionFloor) return 0;
  const range = 100 - policy.convictionFloor;
  let ratio = (absConviction - policy.convictionFloor) / range;
  ratio = Math.max(0, Math.min(1, ratio));
  const size = policy.baseSizePct + ratio * (policy.maxSizePct - policy.baseSizePct);
  return Math.min(size, policy.maxSizePct);
}

function computeFixedBuckets(absConviction, policy) {
  if (absConviction < policy.convictionFloor) return 0;
  if (absConviction <= 50) return Math.min(policy.baseSizePct, policy.maxSizePct);
  if (absConviction <= 75) return Math.min(1.5 * policy.baseSizePct, policy.maxSizePct);
  return policy.maxSizePct;
}

function buildReason(absConviction, signalAgreement, policy, proposedSizePct) {
  const sizeStr = proposedSizePct.toFixed(2);
  if (policy.method === 'linear') {
    if (signalAgreement < 1) {
      const reduction = (1 - signalAgreement) * policy.agreementWeight * 100;
      return `Linear sizing: conviction ${absConviction} → ${sizeStr}% of portfolio (reduced ${reduction.toFixed(0)}% by skill split, signalAgreement ${signalAgreement.toFixed(2)})`;
    }
    return `Linear sizing: conviction ${absConviction} → ${sizeStr}% of portfolio`;
  }
  if (policy.method === 'fixed_buckets') {
    let tier;
    if (absConviction <= 50) tier = 'Low';
    else if (absConviction <= 75) tier = 'Mid';
    else tier = 'High';
    return `${tier}-conviction tier (${absConviction}) → ${sizeStr}% of portfolio`;
  }
  return `Sizing: ${sizeStr}%`;
}
