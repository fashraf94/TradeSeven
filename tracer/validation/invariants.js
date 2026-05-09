// Per-stage invariant checkers for the Tracer Bullet.
// Each checker records violations into the supplied ViolationLog rather than throwing.
// References: Pipeline Contract V1.1 §6/§7/§8/§9/§10/§12; Tracer plan §6.

export function validateStageOutput(stage, output, violations, ctx) {
  switch (stage) {
    case 'stage0':  return validateEvaluationContext(output, violations);
    case 'stage1':  return validateQuantSkillOutput(output, violations, ctx);
    case 'stage2':  return validateAggregatedCandidates(output, violations, ctx);
    case 'stage3':  return validateModulatedCandidates(output, violations, ctx);
    case 'stage35': return validateSizedCandidates(output, violations, ctx);
    case 'stage4':  return validateEnforcedDecisions(output, violations, ctx);
    case 'stage5':  return validateTradeReceipt(output, violations, ctx);
    default:
      violations.recordError('validator', `Unknown stage: ${stage}`);
  }
}

function validateEvaluationContext(ctx, violations) {
  const required = ['evaluationId', 'battleId', 'agentId', 'tickTimestamp', 'universe', 'marketState', 'agentState', 'loadout'];
  for (const k of required) {
    if (ctx[k] === undefined || ctx[k] === null) {
      violations.recordError('stage0', `EvaluationContext missing required field: ${k}`);
    }
  }
  if (!ctx.universe || !Array.isArray(ctx.universe.tickers) || ctx.universe.tickers.length === 0) {
    violations.recordError('stage0', 'universe.tickers must be a non-empty array');
  }
  if (ctx.agentState && !Array.isArray(ctx.agentState.currentPositions)) {
    violations.recordError('stage0', 'agentState.currentPositions must be an array');
  }
  if (ctx.loadout) {
    if (!ctx.loadout.constraints) violations.recordError('stage0', 'loadout.constraints missing');
    if (!ctx.loadout.sizingPolicy) violations.recordError('stage0', 'loadout.sizingPolicy missing');
    if (!Array.isArray(ctx.loadout.quantSkills)) violations.recordError('stage0', 'loadout.quantSkills must be an array');
    if (!Array.isArray(ctx.loadout.behavioralSkills)) violations.recordError('stage0', 'loadout.behavioralSkills must be an array');
    if (Array.isArray(ctx.loadout.behavioralSkills) && ctx.loadout.behavioralSkills.length > 2) {
      violations.recordError('stage0', `loadout.behavioralSkills exceeds V1 cap of 2 (got ${ctx.loadout.behavioralSkills.length})`);
    }
  }
}

function validateQuantSkillOutput(output, violations, ctx) {
  if (!Array.isArray(output.tickerEvaluations)) {
    violations.recordError('stage1', 'tickerEvaluations missing or not array', { skill: output.skillName });
    return;
  }
  const universeSet = new Set(ctx?.universe?.tickers || []);
  if (output.tickerEvaluations.length > universeSet.size) {
    violations.recordError('stage1', 'tickerEvaluations.length exceeds universe size', {
      skill: output.skillName, count: output.tickerEvaluations.length, universe: universeSet.size,
    });
  }
  for (const ev of output.tickerEvaluations) {
    if (!universeSet.has(ev.ticker)) {
      violations.recordError('stage1', 'evaluation ticker not in universe', { skill: output.skillName, ticker: ev.ticker });
    }
    if (!Number.isInteger(ev.conviction) || ev.conviction < 0 || ev.conviction > 100) {
      violations.recordError('stage1', 'conviction out of [0,100] integer range', { skill: output.skillName, ticker: ev.ticker, conviction: ev.conviction });
    }
    if (!['buy', 'sell', 'hold', 'skip'].includes(ev.signal)) {
      violations.recordError('stage1', 'signal not in enum', { skill: output.skillName, ticker: ev.ticker, signal: ev.signal });
    }
  }
}

function validateAggregatedCandidates(output, violations, ctx) {
  if (!Array.isArray(output.candidates)) {
    violations.recordError('stage2', 'candidates missing or not array');
    return;
  }
  const universeTickers = ctx?.universe?.tickers || [];
  if (output.candidates.length !== universeTickers.length) {
    violations.recordError('stage2', 'candidates.length does not equal universe.tickers.length', {
      candidates: output.candidates.length, universe: universeTickers.length,
    });
  }
  const tickerSet = new Set(output.candidates.map(c => c.ticker));
  for (const t of universeTickers) {
    if (!tickerSet.has(t)) {
      violations.recordError('stage2', 'universe ticker missing from candidates', { ticker: t });
    }
  }

  for (const c of output.candidates) {
    if (c.absConviction !== Math.abs(c.netConviction)) {
      violations.recordError('stage2', 'absConviction does not equal |netConviction|', {
        ticker: c.ticker, netConviction: c.netConviction, absConviction: c.absConviction,
      });
    }
    let expected;
    if (c.netConviction > 0) expected = 'buy';
    else if (c.netConviction < 0) expected = 'sell';
    else expected = c.contributingSkills.some(cs => cs.signal !== 'skip') ? 'hold' : 'skip';
    if (c.dominantSignal !== expected) {
      violations.recordError('stage2', 'dominantSignal does not match polarity', {
        ticker: c.ticker, netConviction: c.netConviction, dominantSignal: c.dominantSignal, expected,
      });
    }
    if (c.signalAgreement < 0 || c.signalAgreement > 1) {
      violations.recordError('stage2', 'signalAgreement out of range', {
        ticker: c.ticker, signalAgreement: c.signalAgreement,
      });
    }
  }

  if (output.aggregationMethod !== 'weighted_signed_sum') {
    violations.recordError('stage2', 'aggregationMethod not weighted_signed_sum', { method: output.aggregationMethod });
  }
}

function validateModulatedCandidates(output, violations, ctx) {
  if (!Array.isArray(output.candidates)) {
    violations.recordError('stage3', 'candidates missing or not array');
    return;
  }
  const expectedLen = ctx?.universe?.tickers?.length;
  if (expectedLen !== undefined && output.candidates.length !== expectedLen) {
    violations.recordError('stage3', 'candidates.length changed from universe size', {
      candidates: output.candidates.length, universe: expectedLen,
    });
  }

  const behavioralSlots = ctx?.loadout?.behavioralSkills?.length ?? 0;
  if (!Array.isArray(output.modulatorLog)) {
    violations.recordError('stage3', 'modulatorLog missing or not array');
  } else if (output.modulatorLog.length !== behavioralSlots) {
    violations.recordError('stage3', 'modulatorLog cardinality must equal behavioralSkills slots', {
      logEntries: output.modulatorLog.length, behavioralSkills: behavioralSlots,
    });
  } else {
    const loggedIds = new Set(output.modulatorLog.map(e => e.modulatorInstanceId));
    for (const skill of ctx.loadout.behavioralSkills) {
      if (!loggedIds.has(skill.instanceId)) {
        violations.recordError('stage3', 'behavioralSkill missing from modulatorLog', { instanceId: skill.instanceId });
      }
    }
  }

  for (const c of output.candidates) {
    if (c.vetoed && c.signal !== 'skip') {
      violations.recordError('stage3', 'vetoed candidate must have signal=skip', { ticker: c.ticker, signal: c.signal });
    }
    if (c.vetoed && !c.vetoReason) {
      violations.recordError('stage3', 'vetoed=true but vetoReason missing', { ticker: c.ticker });
    }
    let expectedSignal;
    if (c.vetoed) expectedSignal = 'skip';
    else if (c.finalConviction > 0) expectedSignal = 'buy';
    else if (c.finalConviction < 0) expectedSignal = 'sell';
    else expectedSignal = 'hold';
    if (c.signal !== expectedSignal) {
      violations.recordError('stage3', 'signal does not match sign(finalConviction)', {
        ticker: c.ticker, finalConviction: c.finalConviction, signal: c.signal, expected: expectedSignal,
      });
    }
  }
}

function validateSizedCandidates(output, violations, ctx) {
  if (!Array.isArray(output.candidates)) {
    violations.recordError('stage35', 'candidates missing or not array');
    return;
  }
  for (let i = 1; i < output.candidates.length; i++) {
    const prev = output.candidates[i - 1];
    const curr = output.candidates[i];
    const prevAbs = Math.abs(prev.finalConviction);
    const currAbs = Math.abs(curr.finalConviction);
    if (currAbs > prevAbs) {
      violations.recordError('stage35', 'candidates not sorted desc by absConviction', {
        atIndex: i, prevAbs, currAbs, prevTicker: prev.ticker, currTicker: curr.ticker,
      });
    } else if (currAbs === prevAbs && curr.proposedSizePct > prev.proposedSizePct) {
      violations.recordError('stage35', 'tie not broken by larger proposedSizePct', {
        atIndex: i, absConviction: currAbs, prevSize: prev.proposedSizePct, currSize: curr.proposedSizePct,
      });
    }
  }
  for (const c of output.candidates) {
    if (c.vetoed && (c.proposedSizePct !== 0 || c.signal !== 'skip')) {
      violations.recordError('stage35', 'vetoed candidate has non-zero size or wrong signal', {
        ticker: c.ticker, proposedSizePct: c.proposedSizePct, signal: c.signal,
      });
    }
    if (Number.isNaN(c.proposedSizePct) || c.proposedSizePct < 0 || c.proposedSizePct > 100) {
      violations.recordError('stage35', 'proposedSizePct out of [0,100]', {
        ticker: c.ticker, proposedSizePct: c.proposedSizePct,
      });
    }
  }
  if (!Array.isArray(output.sizerLog)) {
    violations.recordError('stage35', 'sizerLog missing or not array');
  } else if (output.sizerLog.length !== output.candidates.length) {
    violations.recordError('stage35', 'sizerLog must have one entry per candidate', {
      logEntries: output.sizerLog.length, candidates: output.candidates.length,
    });
  }
}

function validateEnforcedDecisions(output, violations) {
  if (!Array.isArray(output.decisions)) {
    violations.recordError('stage4', 'decisions missing or not array');
    return;
  }
  for (const d of output.decisions) {
    if (!Array.isArray(d.passedConstraints)) {
      violations.recordError('stage4', 'passedConstraints missing or not array', { ticker: d.ticker });
    }
    if (d.clamped && d.finalSizePct === d.proposedSizePct) {
      violations.recordError('stage4', 'clamped=true but sizes are equal', {
        ticker: d.ticker, proposedSizePct: d.proposedSizePct, finalSizePct: d.finalSizePct,
      });
    }
    if (d.rejected && d.finalAction !== 'skip') {
      violations.recordError('stage4', 'rejected=true but finalAction is not skip', {
        ticker: d.ticker, finalAction: d.finalAction,
      });
    }
    if (d.rejected && !d.rejectionReason) {
      violations.recordError('stage4', 'rejected=true but rejectionReason missing', { ticker: d.ticker });
    }
  }
  if (!Array.isArray(output.enforcerLog)) {
    violations.recordError('stage4', 'enforcerLog missing or not array');
  } else {
    for (const a of output.enforcerLog) {
      if (!['clamp', 'reject'].includes(a.constraintType)) {
        violations.recordError('stage4', 'enforcerLog entry has non-state-mutating constraintType', {
          constraintType: a.constraintType,
        });
      }
    }
  }
}

function validateTradeReceipt(receipt, violations) {
  if (!receipt.receiptId) violations.recordError('stage5', 'receiptId missing');
  if (!receipt.outcome) violations.recordError('stage5', 'outcome missing', { receiptId: receipt.receiptId });
  if (!receipt.reasoning) {
    violations.recordError('stage5', 'reasoning missing', { receiptId: receipt.receiptId });
    return;
  }

  const polarity = Math.sign(receipt.reasoning.generators.aggregatedNetConviction);
  if (receipt.reasoning.summary.primaryDriver !== 'No primary driver' && polarity !== 0) {
    const driver = receipt.reasoning.generators.skillsEvaluated
      .find(s => s.name === receipt.reasoning.summary.primaryDriver);
    if (!driver) {
      violations.recordError('stage5', 'primaryDriver name not found in skillsEvaluated', {
        receiptId: receipt.receiptId, primaryDriver: receipt.reasoning.summary.primaryDriver,
      });
    } else {
      const driverSign = driver.signal === 'buy' ? 1 : driver.signal === 'sell' ? -1 : 0;
      if (driverSign !== polarity) {
        violations.recordError('stage5', 'primaryDriver signal does not match dominantSignal polarity', {
          receiptId: receipt.receiptId, primaryDriver: receipt.reasoning.summary.primaryDriver,
          driverSign, polarity,
        });
      }
    }
  }

  const sa = receipt.reasoning.generators.signalAgreement;
  if (sa < 0 || sa > 1) {
    violations.recordError('stage5', 'signalAgreement out of range in receipt', {
      receiptId: receipt.receiptId, signalAgreement: sa,
    });
  }

  if (!['unconstrained', 'clamped', 'rejected'].includes(receipt.reasoning.enforcement.netEffect)) {
    violations.recordError('stage5', 'enforcement.netEffect not in enum', {
      receiptId: receipt.receiptId, netEffect: receipt.reasoning.enforcement.netEffect,
    });
  }
  if (!['high', 'normal', 'low'].includes(receipt.displayPriority)) {
    violations.recordError('stage5', 'displayPriority not in enum', {
      receiptId: receipt.receiptId, displayPriority: receipt.displayPriority,
    });
  }
}
