// Deterministic stub quant-skill implementations for the Tracer Bullet.
// Each stub maps (EquippedSkill, Stage1PromptContext) → QuantSkillOutput per Pipeline Contract §5.1.
// Hardcoded by ticker for fixture predictability per Tracer plan §4.1.

export function runQuantSkill(skill, stage1Input) {
  switch (skill.templateId) {
    case 'breakout_hunter': return breakoutHunterStub(skill, stage1Input);
    case 'momentum_rider':  return momentumRiderStub(skill, stage1Input);
    case 'mean_reversion':  return meanReversionStub(skill, stage1Input);
    default:
      throw new Error(`Unknown quant skill template: ${skill.templateId}`);
  }
}

function buildOutput(skill, stage1Input, evaluations, rationale) {
  return {
    skillInstanceId: skill.instanceId,
    skillTemplateId: skill.templateId,
    skillName: skill.name,
    evaluationTimestamp: stage1Input.marketState.timestamp,
    tickerEvaluations: evaluations,
    skillRationale: rationale,
    evaluationMode: 'fresh',
    inferenceLatencyMs: 0,
  };
}

// Per-scenario behavioral override applied on top of the stub's default map.
// E.g., Constraint Clamp scenario overrides Breakout Hunter's TICKER_A conviction
// from 75 to 85 to drive the strong-tech-buy fixture (Tracer plan §3.3).
function applyOverrides(stage1Input, templateId, defaultMap) {
  const overrides = stage1Input.stubOverrides?.[templateId] || {};
  const merged = { ...defaultMap };
  for (const [ticker, override] of Object.entries(overrides)) {
    merged[ticker] = { ...defaultMap[ticker], ...override };
  }
  return merged;
}

function breakoutHunterStub(skill, stage1Input) {
  const map = {
    TICKER_A: { conviction: 75, signal: 'buy',  reasonFragment: 'Volume breakout + RSI confirms', triggeredCriteria: ['volume_breakout', 'rsi_confirm'], ignoredCriteria: [] },
    TICKER_B: { conviction: 20, signal: 'skip', reasonFragment: 'No breakout pattern detected',   triggeredCriteria: [],                                  ignoredCriteria: ['volume_breakout'] },
    TICKER_C: { conviction: 15, signal: 'skip', reasonFragment: 'RSI overbought, no setup',       triggeredCriteria: [],                                  ignoredCriteria: ['volume_breakout'] },
    TICKER_D: { conviction: 10, signal: 'skip', reasonFragment: '—',                              triggeredCriteria: [],                                  ignoredCriteria: [] },
    TICKER_E: { conviction: 5,  signal: 'skip', reasonFragment: '—',                              triggeredCriteria: [],                                  ignoredCriteria: [] },
    TICKER_X: { conviction: 0,  signal: 'skip', reasonFragment: '—',                              triggeredCriteria: [],                                  ignoredCriteria: [] },
  };
  const merged = applyOverrides(stage1Input, skill.templateId, map);
  const evaluations = stage1Input.universe
    .filter(t => merged[t] !== undefined)
    .map(t => ({ ticker: t, ...merged[t] }));
  return buildOutput(skill, stage1Input, evaluations, 'Universe scan: 1 strong breakout, others quiet');
}

function momentumRiderStub(skill, stage1Input) {
  const map = {
    TICKER_A: { conviction: 65, signal: 'buy',  reasonFragment: 'Confirms TICKER_A momentum',   triggeredCriteria: ['trend_follow'], ignoredCriteria: [] },
    TICKER_B: { conviction: 25, signal: 'skip', reasonFragment: 'Weak trend',                    triggeredCriteria: [],               ignoredCriteria: ['trend_follow'] },
    TICKER_C: { conviction: 45, signal: 'buy',  reasonFragment: 'Mild buy on TICKER_C trend',    triggeredCriteria: ['trend_follow'], ignoredCriteria: [] },
    TICKER_D: { conviction: 10, signal: 'skip', reasonFragment: '—',                              triggeredCriteria: [],               ignoredCriteria: [] },
    TICKER_E: { conviction: 5,  signal: 'skip', reasonFragment: '—',                              triggeredCriteria: [],               ignoredCriteria: [] },
    TICKER_X: { conviction: 0,  signal: 'skip', reasonFragment: '—',                              triggeredCriteria: [],               ignoredCriteria: [] },
  };
  const merged = applyOverrides(stage1Input, skill.templateId, map);
  const evaluations = stage1Input.universe
    .filter(t => merged[t] !== undefined)
    .map(t => ({ ticker: t, ...merged[t] }));
  return buildOutput(skill, stage1Input, evaluations, 'Trend continuation read: 2 buys, rest neutral');
}

function meanReversionStub(skill, stage1Input) {
  const map = {
    TICKER_A: { conviction: 20, signal: 'skip', reasonFragment: 'Not stretched',                  triggeredCriteria: [],            ignoredCriteria: ['stretch_extreme'] },
    TICKER_B: { conviction: 15, signal: 'skip', reasonFragment: '—',                               triggeredCriteria: [],            ignoredCriteria: [] },
    TICKER_C: { conviction: 10, signal: 'skip', reasonFragment: '—',                               triggeredCriteria: [],            ignoredCriteria: [] },
    TICKER_D: { conviction: 5,  signal: 'skip', reasonFragment: '—',                               triggeredCriteria: [],            ignoredCriteria: [] },
    TICKER_E: { conviction: 5,  signal: 'skip', reasonFragment: '—',                               triggeredCriteria: [],            ignoredCriteria: [] },
    TICKER_X: { conviction: 70, signal: 'sell', reasonFragment: 'Extended position; mean revert', triggeredCriteria: ['rsi_extreme'], ignoredCriteria: [] },
  };
  const merged = applyOverrides(stage1Input, skill.templateId, map);
  const evaluations = stage1Input.universe
    .filter(t => merged[t] !== undefined)
    .map(t => ({ ticker: t, ...merged[t] }));
  return buildOutput(skill, stage1Input, evaluations, 'Mean-reversion scan: 1 stretched name flagged');
}
