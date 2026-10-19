// Artificial ranking inputs. No market observations or copied scoring math.
export function makeCandidateUniverse({ sectorSizes } = {}) {
  const sectors = ['Technology', 'Healthcare', 'Energy', 'Financials', 'Industrials', 'Utilities', 'Consumer Staples', 'Real Estate'];
  const population = sectorSizes?.flatMap((size, i) => Array(size).fill(sectors[i]));
  return Array.from({ length: population?.length ?? 96 }, (_, i) => {
    const fundamentalScore = 20 + (i * 37) % 81;
    const technicalScore = 10 + (i * 29) % 91;
    const baggerBombFit = (i * 43) % 97;
    return {
      symbol: `S${String(i).padStart(3, '0')}`, sectorName: population?.[i] ?? sectors[i % sectors.length],
      fundamentalScore, technicalScore, baggerBombFit,
      atrPercentile: Number((((i * 53) % 96) / 95).toFixed(2)),
      compositeScore: Math.round((fundamentalScore + technicalScore + baggerBombFit) / 3),
      baseATR: 2.5,
    };
  });
}
