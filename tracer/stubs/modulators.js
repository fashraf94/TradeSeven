// Deterministic stub modulator implementations for the Tracer Bullet.
// Each stub maps (EquippedSkill, candidateSnapshot, agentState) → ModulatorAction | null.
// Returning null means "this modulator did not fire on this candidate."
// Per Tracer plan §4.2.

const TYPE_REGISTRY = {
  tilt_aware:    'multiplier',
  diamond_hands: 'veto',
};

export function getModulatorType(templateId) {
  const t = TYPE_REGISTRY[templateId];
  if (!t) throw new Error(`Unknown modulator template: ${templateId}`);
  return t;
}

export function runModulator(modulator, candidate, agentState) {
  switch (modulator.templateId) {
    case 'tilt_aware':    return tiltAwareStub(modulator, candidate, agentState);
    case 'diamond_hands': return diamondHandsStub(modulator, candidate, agentState);
    default:
      throw new Error(`Unknown modulator template: ${modulator.templateId}`);
  }
}

function tiltAwareStub(_mod, candidate, agentState) {
  if (agentState.lossStreakCount >= 2 && candidate.netConviction !== 0) {
    return {
      type: 'multiplier',
      effect: {
        description: 'Tilt detected: dampening conviction by 30%',
        numericChange: 0.7,
      },
    };
  }
  return null;
}

function diamondHandsStub(_mod, candidate, agentState) {
  if (candidate.signal !== 'sell') return null;
  const pos = agentState.currentPositions.find(p => p.ticker === candidate.ticker);
  if (!pos) return null;
  if (pos.unrealizedPnLPct >= 0) return null;

  return {
    type: 'veto',
    effect: {
      description: 'Diamond Hands prevented sell of losing position',
      vetoed: true,
    },
    vetoReason: `Position at ${pos.unrealizedPnLPct}% loss; Diamond Hands blocks sell`,
  };
}
