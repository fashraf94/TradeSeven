// ScoringPreviewNew - Scoring analysis and strategy tips for TD Portfolio Builder
import React, { useMemo } from 'react';

const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.1)',
  primary: '#00d9ff',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)'
};

/**
 * Analyze portfolio for scoring estimates
 */
const analyzePortfolio = (portfolio, crypto, thresholds) => {
  const allAssets = [...portfolio, crypto].filter(Boolean);

  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;

  allAssets.forEach(asset => {
    const threshold = thresholds[asset.symbol]?.threshold;
    if (threshold) {
      if (threshold <= 2) easyCount++;
      else if (threshold <= 4) mediumCount++;
      else hardCount++;
    }
  });

  // Estimate scoring based on difficulty mix
  // Easy: ~60% chance of breakout (15 pts)
  // Medium: ~40% chance of breakout (15 pts)
  // Hard: ~25% chance but higher upside (Rally/Moonshot more likely)

  const sessions = 4; // 4 sessions per battle

  // Conservative: Only easy assets hit breakout
  const conservativeBreakouts = easyCount * 0.4 * sessions;
  const conservative = Math.round(conservativeBreakouts * 15);

  // Average: Easy + some medium hit
  const avgBreakouts = (easyCount * 0.5 + mediumCount * 0.3) * sessions;
  const avgRallies = (easyCount * 0.1 + mediumCount * 0.15 + hardCount * 0.1) * sessions;
  const average = Math.round(avgBreakouts * 15 + avgRallies * 30);

  // Hot day: Many breakouts, some rallies, occasional moonshots
  const hotBreakouts = (easyCount * 0.7 + mediumCount * 0.5 + hardCount * 0.3) * sessions;
  const hotRallies = (easyCount * 0.2 + mediumCount * 0.25 + hardCount * 0.2) * sessions;
  const hotMoonshots = hardCount * 0.1 * sessions;
  const hotDay = Math.round(hotBreakouts * 15 + hotRallies * 30 + hotMoonshots * 50);

  // Expected breakout opportunities per battle
  const breakoutChances = Math.round((easyCount * 0.5 + mediumCount * 0.35 + hardCount * 0.2) * sessions);

  return {
    conservative,
    average,
    hotDay,
    easyCount,
    mediumCount,
    hardCount,
    breakoutChances,
    totalAssets: allAssets.length
  };
};

/**
 * ScoringPreviewNew - Score estimates and strategy tips
 *
 * @param {Array} portfolio - Selected roster stocks
 * @param {Object} crypto - Selected crypto
 * @param {Array} bench - Bench stocks
 * @param {Object} benchCrypto - Bench crypto
 * @param {Object} thresholds - Volatility thresholds by symbol
 */
export default function ScoringPreviewNew({
  portfolio = [],
  crypto,
  bench = [],
  benchCrypto,
  thresholds = {}
}) {
  const analysis = useMemo(() =>
    analyzePortfolio(portfolio, crypto, thresholds),
    [portfolio, crypto, thresholds]
  );

  const tips = useMemo(() => {
    const tipsList = [];

    if (analysis.easyCount === 0) {
      tipsList.push('Consider adding some Easy threshold stocks for consistent points');
    }
    if (analysis.hardCount === 0) {
      tipsList.push('Hard threshold stocks offer Rally/Moonshot upside on volatile days');
    }
    if (analysis.easyCount > 5 && analysis.hardCount < 2) {
      tipsList.push('Your portfolio is defensive - add Hard stocks for TD bonus potential');
    }
    if (analysis.hardCount > 4 && analysis.easyCount < 2) {
      tipsList.push('High risk portfolio - consider Easy stocks for baseline points');
    }
    if (bench.length < 4) {
      tipsList.push(`Bench needs ${4 - bench.length} more stocks for substitution flexibility`);
    }
    if (!benchCrypto) {
      tipsList.push('Add a bench crypto for substitution options');
    }

    if (tipsList.length === 0) {
      tipsList.push('Well-balanced portfolio! Mix of Easy and Hard stocks for consistent + upside scoring');
    }

    return tipsList;
  }, [analysis, bench, benchCrypto]);

  return (
    <div style={{ paddingTop: '12px' }}>
      {/* Score Estimates */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '16px 12px',
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px'
        }}>
          <div style={{
            fontSize: '11px',
            color: colors.textMuted,
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Conservative
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: colors.red
          }}>
            ~{analysis.conservative}
          </div>
          <div style={{
            fontSize: '11px',
            color: colors.textMuted
          }}>
            pts
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '16px 12px',
          backgroundColor: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '10px'
        }}>
          <div style={{
            fontSize: '11px',
            color: colors.textMuted,
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Average
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: colors.yellow
          }}>
            ~{analysis.average}
          </div>
          <div style={{
            fontSize: '11px',
            color: colors.textMuted
          }}>
            pts
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '16px 12px',
          backgroundColor: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: '10px'
        }}>
          <div style={{
            fontSize: '11px',
            color: colors.textMuted,
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Hot Day
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: colors.green
          }}>
            ~{analysis.hotDay}
          </div>
          <div style={{
            fontSize: '11px',
            color: colors.textMuted
          }}>
            pts
          </div>
        </div>
      </div>

      {/* Portfolio Analysis */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: colors.cardBg,
        borderRadius: '10px',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🎯</span>
            <span style={{ fontSize: '13px', color: colors.textSecondary }}>
              Breakout Chances:
            </span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: colors.primary }}>
              {analysis.breakoutChances} per battle
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px'
        }}>
          <span style={{ fontSize: '14px' }}>📊</span>
          <span style={{ color: colors.textSecondary }}>Volatility Mix:</span>
          <span style={{ color: colors.green, fontWeight: '500' }}>
            {analysis.easyCount} Easy
          </span>
          <span style={{ color: colors.textMuted }}>·</span>
          <span style={{ color: colors.yellow, fontWeight: '500' }}>
            {analysis.mediumCount} Medium
          </span>
          <span style={{ color: colors.textMuted }}>·</span>
          <span style={{ color: colors.red, fontWeight: '500' }}>
            {analysis.hardCount} Hard
          </span>
        </div>
      </div>

      {/* Strategy Tips */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(0,217,255,0.05)',
        border: '1px solid rgba(0,217,255,0.1)',
        borderRadius: '10px'
      }}>
        {tips.map((tip, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: index < tips.length - 1 ? '8px' : 0
            }}
          >
            <span style={{ fontSize: '14px' }}>💡</span>
            <span style={{
              fontSize: '13px',
              color: colors.textSecondary,
              lineHeight: 1.4
            }}>
              {tip}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
