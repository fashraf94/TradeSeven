// Stage 4: Deterministic Enforcer.
// Implements Constraint Set Schema V1 §6.1 in hard-coded priority order:
//   maxDrawdownTrigger → liquidityFloor → maxOpenPositions → minCashReserve →
//   maxSectorExposure → maxPositionSize.
// Maintains running counters for global resources across the candidate loop.
// Logs only state-mutating actions in enforcerLog; non-mutating checks → passedConstraints.

export function enforce(sized, constraints, agentState, marketState) {
  const decisions = [];
  const enforcerLog = [];

  // === Kill-switch phase (evaluated once per tick) ===
  const drawdownTripped =
    constraints.maxDrawdownTrigger.enabled &&
    agentState.sessionPnLPct <= -constraints.maxDrawdownTrigger.maxDrawdownPct;

  // === Running global-resource counters ===
  let runningPositionCount = agentState.currentPositions.length;
  let runningCash = agentState.cashAvailable;

  for (const candidate of sized.candidates) {
    const decision = {
      ticker: candidate.ticker,
      finalAction: candidate.signal,
      finalSizePct: candidate.proposedSizePct,
      finalSizeUsd: candidate.proposedSizeUsd,
      proposedSizePct: candidate.proposedSizePct,
      clamped: false,
      rejected: false,
      rejectionReason: undefined,
      passedConstraints: [],
      finalConviction: candidate.finalConviction,
      contributingSkills: candidate.contributingSkills,
    };

    // Skip-signal candidates skip most constraints, but per Constraint Set §6.4
    // (Errata 2 Implementation Followup) still evaluate liquidityFloor when
    // appliesTo === 'all' — liquidity is a property of the ticker, not the action.
    if (candidate.signal === 'skip') {
      if (
        constraints.liquidityFloor.enabled &&
        constraints.liquidityFloor.appliesTo === 'all'
      ) {
        const snapshot = marketState.tickerSnapshots[candidate.ticker];
        const dollarVolume = (snapshot?.price ?? 0) * (snapshot?.averageVolume30d ?? 0);
        if (dollarVolume < constraints.liquidityFloor.minDollarVolume30d) {
          rejectDecision(decision, `ticker below liquidity floor: $${dollarVolume.toLocaleString()} 30d avg volume vs $${constraints.liquidityFloor.minDollarVolume30d.toLocaleString()} archetype minimum`);
          enforcerLog.push({
            constraintName: 'liquidityFloor',
            constraintType: 'reject',
            appliedTo: candidate.ticker,
            effect: decision.rejectionReason,
          });
        } else {
          decision.passedConstraints.push('liquidityFloor');
        }
      }
      decisions.push(decision);
      continue;
    }

    // === Step 1: maxDrawdownTrigger (sells unaffected) ===
    if (constraints.maxDrawdownTrigger.enabled) {
      if (drawdownTripped && candidate.signal === 'buy') {
        rejectDecision(decision, `session drawdown of ${Math.abs(agentState.sessionPnLPct)}% exceeded archetype limit of ${constraints.maxDrawdownTrigger.maxDrawdownPct}%`);
        enforcerLog.push({
          constraintName: 'maxDrawdownTrigger',
          constraintType: 'reject',
          appliedTo: candidate.ticker,
          effect: decision.rejectionReason,
        });
        decisions.push(decision);
        continue;
      }
      decision.passedConstraints.push('maxDrawdownTrigger');
    }

    // === Step 2: liquidityFloor ===
    if (constraints.liquidityFloor.enabled) {
      const appliesTo = constraints.liquidityFloor.appliesTo;
      const checkLiquidity =
        appliesTo === 'all' ||
        (appliesTo === 'new_buys_only' && candidate.signal === 'buy');
      if (checkLiquidity) {
        const snapshot = marketState.tickerSnapshots[candidate.ticker];
        const dollarVolume = (snapshot?.price ?? 0) * (snapshot?.averageVolume30d ?? 0);
        if (dollarVolume < constraints.liquidityFloor.minDollarVolume30d) {
          rejectDecision(decision, `ticker below liquidity floor: $${dollarVolume.toLocaleString()} 30d avg volume vs $${constraints.liquidityFloor.minDollarVolume30d.toLocaleString()} archetype minimum`);
          enforcerLog.push({
            constraintName: 'liquidityFloor',
            constraintType: 'reject',
            appliedTo: candidate.ticker,
            effect: decision.rejectionReason,
          });
          decisions.push(decision);
          continue;
        }
      }
      decision.passedConstraints.push('liquidityFloor');
    }

    // === Step 3: maxOpenPositions (buys only, global resource) ===
    if (constraints.maxOpenPositions.enabled && candidate.signal === 'buy') {
      const alreadyHolds = agentState.currentPositions.some(p => p.ticker === candidate.ticker);
      if (!alreadyHolds && runningPositionCount >= constraints.maxOpenPositions.maxCount) {
        rejectDecision(decision, 'max_open_positions exhausted by higher-priority candidate');
        enforcerLog.push({
          constraintName: 'maxOpenPositions',
          constraintType: 'reject',
          appliedTo: candidate.ticker,
          effect: decision.rejectionReason,
        });
        decisions.push(decision);
        continue;
      }
    }
    if (constraints.maxOpenPositions.enabled) decision.passedConstraints.push('maxOpenPositions');

    // === Step 4: minCashReserve (buys only, global resource) ===
    if (constraints.minCashReserve.enabled && candidate.signal === 'buy') {
      const projectedCash = runningCash - decision.finalSizeUsd;
      const projectedCashPct = (projectedCash / agentState.portfolioValue) * 100;
      if (projectedCashPct < constraints.minCashReserve.minCashReservePct) {
        rejectDecision(decision, `would breach min cash reserve: ${projectedCashPct.toFixed(1)}% vs ${constraints.minCashReserve.minCashReservePct}% archetype minimum`);
        enforcerLog.push({
          constraintName: 'minCashReserve',
          constraintType: 'reject',
          appliedTo: candidate.ticker,
          effect: decision.rejectionReason,
        });
        decisions.push(decision);
        continue;
      }
    }
    if (constraints.minCashReserve.enabled) decision.passedConstraints.push('minCashReserve');

    // === Step 5: maxSectorExposure (clamp, buys only) ===
    if (constraints.maxSectorExposure.enabled && candidate.signal === 'buy') {
      const sector = marketState.tickerSnapshots[candidate.ticker]?.sector;
      const currentSectorPct = (sector && agentState.sectorExposures[sector]) || 0;
      const projectedSectorPct = currentSectorPct + decision.finalSizePct;
      if (projectedSectorPct > constraints.maxSectorExposure.maxSectorPct) {
        const clampedSizePct = constraints.maxSectorExposure.maxSectorPct - currentSectorPct;
        if (clampedSizePct <= 0) {
          rejectDecision(decision, `sector ${sector} already at ${currentSectorPct}% vs ${constraints.maxSectorExposure.maxSectorPct}% cap`);
          enforcerLog.push({
            constraintName: 'maxSectorExposure',
            constraintType: 'reject',
            appliedTo: candidate.ticker,
            effect: decision.rejectionReason,
          });
          decisions.push(decision);
          continue;
        }
        const fromSize = decision.finalSizePct;
        decision.finalSizePct = clampedSizePct;
        decision.finalSizeUsd = (clampedSizePct / 100) * agentState.portfolioValue;
        decision.clamped = true;
        enforcerLog.push({
          constraintName: 'maxSectorExposure',
          constraintType: 'clamp',
          appliedTo: candidate.ticker,
          effect: `sector ${sector} clamped from ${fromSize.toFixed(2)}% to ${clampedSizePct.toFixed(2)}% (cap ${constraints.maxSectorExposure.maxSectorPct}%, current ${currentSectorPct}%)`,
          numericChange: { from: fromSize, to: clampedSizePct },
        });
        // Don't push 'maxSectorExposure' into passedConstraints when it mutated.
      } else {
        decision.passedConstraints.push('maxSectorExposure');
      }
    } else if (constraints.maxSectorExposure.enabled) {
      decision.passedConstraints.push('maxSectorExposure');
    }

    // === Step 6: maxPositionSize (clamp, buys only) ===
    if (constraints.maxPositionSize.enabled && candidate.signal === 'buy') {
      const existingPos = agentState.currentPositions.find(p => p.ticker === candidate.ticker);
      const existingPositionPct = existingPos?.sizePct ?? 0;
      const isAddOn = existingPositionPct > 0;
      if (constraints.maxPositionSize.appliesTo === 'new_positions' && isAddOn) {
        decision.passedConstraints.push('maxPositionSize');
      } else {
        const projectedSizePct = existingPositionPct + decision.finalSizePct;
        if (projectedSizePct > constraints.maxPositionSize.maxSizePct) {
          const clampedSizePct = constraints.maxPositionSize.maxSizePct - existingPositionPct;
          if (clampedSizePct <= 0) {
            rejectDecision(decision, `position already at ${existingPositionPct}% vs ${constraints.maxPositionSize.maxSizePct}% cap`);
            enforcerLog.push({
              constraintName: 'maxPositionSize',
              constraintType: 'reject',
              appliedTo: candidate.ticker,
              effect: decision.rejectionReason,
            });
            decisions.push(decision);
            continue;
          }
          const fromSize = decision.finalSizePct;
          decision.finalSizePct = clampedSizePct;
          decision.finalSizeUsd = (clampedSizePct / 100) * agentState.portfolioValue;
          decision.clamped = true;
          enforcerLog.push({
            constraintName: 'maxPositionSize',
            constraintType: 'clamp',
            appliedTo: candidate.ticker,
            effect: `position clamped from ${fromSize.toFixed(2)}% to ${clampedSizePct.toFixed(2)}% (cap ${constraints.maxPositionSize.maxSizePct}%)`,
            numericChange: { from: fromSize, to: clampedSizePct },
          });
        } else {
          decision.passedConstraints.push('maxPositionSize');
        }
      }
    } else if (constraints.maxPositionSize.enabled) {
      decision.passedConstraints.push('maxPositionSize');
    }

    // === Update running counters ===
    if (decision.finalAction === 'buy' && !decision.rejected) {
      const alreadyHolds = agentState.currentPositions.some(p => p.ticker === candidate.ticker);
      if (!alreadyHolds) runningPositionCount += 1;
      runningCash -= decision.finalSizeUsd;
    }

    decisions.push(decision);
  }

  return { decisions, enforcerLog };
}

function rejectDecision(decision, reason) {
  decision.rejected = true;
  decision.rejectionReason = reason;
  decision.finalAction = 'skip';
  decision.finalSizePct = 0;
  decision.finalSizeUsd = 0;
}
