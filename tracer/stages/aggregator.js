// Stage 2: Aggregator. Pure deterministic.
// Implements Pipeline Contract V1.1 §6.2 — signed-conviction sum, polarity-derived
// dominantSignal, weighted-alignment signalAgreement, partial-return reconciliation.

export function aggregate(quantOutputs, loadout, universe) {
  const candidates = universe.tickers.map(ticker => {
    const contributingSkills = loadout.quantSkills.map(skill => {
      const skillOutput = quantOutputs.find(o => o.skillInstanceId === skill.instanceId);
      const evaluation = skillOutput?.tickerEvaluations.find(e => e.ticker === ticker);

      if (!evaluation) {
        return {
          skillInstanceId: skill.instanceId,
          skillName: skill.name,
          conviction: 0,
          userWeight: skill.userWeight,
          signal: 'skip',
          signedContribution: 0,
          reasonFragment: `${skill.name} dropped this ticker from its evaluation`,
          wasMissing: true,
        };
      }

      const sign = evaluation.signal === 'buy' ? 1
                 : evaluation.signal === 'sell' ? -1
                 : 0;
      return {
        skillInstanceId: skill.instanceId,
        skillName: skill.name,
        conviction: evaluation.conviction,
        userWeight: skill.userWeight,
        signal: evaluation.signal,
        signedContribution: evaluation.conviction * skill.userWeight * sign,
        reasonFragment: evaluation.reasonFragment,
        wasMissing: false,
      };
    });

    const netConviction = contributingSkills.reduce((sum, c) => sum + c.signedContribution, 0);
    const absConviction = Math.abs(netConviction);

    let dominantSignal;
    if (netConviction > 0) dominantSignal = 'buy';
    else if (netConviction < 0) dominantSignal = 'sell';
    else if (contributingSkills.some(c => c.signal !== 'skip')) dominantSignal = 'hold';
    else dominantSignal = 'skip';

    const polarity = Math.sign(netConviction);
    let signalAgreement = 1.0;
    if (polarity !== 0) {
      const total = contributingSkills.reduce((s, c) => s + Math.abs(c.signedContribution), 0);
      const agreeing = contributingSkills
        .filter(c => Math.sign(c.signedContribution) === polarity)
        .reduce((s, c) => s + Math.abs(c.signedContribution), 0);
      signalAgreement = total > 0 ? agreeing / total : 1.0;
    }

    return { ticker, netConviction, absConviction, contributingSkills, dominantSignal, signalAgreement };
  });

  return {
    candidates,
    aggregationMethod: 'weighted_signed_sum',
    totalSkillsEvaluated: loadout.quantSkills.length,
  };
}
