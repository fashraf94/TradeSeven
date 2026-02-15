// BaggerBombTab — BaggerBomb scoring stats for an asset.
// Extracted from AssetResearchModal for modularity.

import React from 'react';
import { BAGGER_TIERS, BUST_TIERS } from '../../../constants/baggerBombScoring';
import { DEFAULT_THRESHOLD } from '../../../utils/researchAssetBuilder';

const BaggerBombTab = ({ asset }) => {
  const baseThreshold = asset?.threshold || DEFAULT_THRESHOLD;

  const baselinePrice =
    asset?.lockedPrice ||
    asset?.baselinePrice ||
    asset?.startPrice ||
    asset?.startingPrice ||
    asset?.basePrice ||
    null;

  const formatTargetPrice = (price) => {
    if (!price || price <= 0) return null;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getHistoricalStats = (symbol) => {
    const mockData = {
      'AAPL': { hitRate: 35, avgMove: 1.8, daysAboveThreshold: 10 },
      'TSLA': { hitRate: 55, avgMove: 3.2, daysAboveThreshold: 17 },
      'NVDA': { hitRate: 48, avgMove: 2.8, daysAboveThreshold: 14 },
      'MSFT': { hitRate: 32, avgMove: 1.6, daysAboveThreshold: 9 },
      'GOOGL': { hitRate: 38, avgMove: 2.1, daysAboveThreshold: 11 },
      'AMZN': { hitRate: 42, avgMove: 2.3, daysAboveThreshold: 12 },
      'META': { hitRate: 45, avgMove: 2.5, daysAboveThreshold: 13 },
    };
    return mockData[symbol] || { hitRate: 40, avgMove: 2.0, daysAboveThreshold: 12 };
  };

  const historical = getHistoricalStats(asset?.symbol);

  const currentBaggerBombs = asset?.baggerBombs || 0;
  const currentBusts = asset?.busts || 0;
  const currentBaggerBombPoints = asset?.baggerBombPoints || 0;
  const currentBustPoints = asset?.bustPoints || 0;

  // Show informational message when threshold/baseline data unavailable
  if (!baselinePrice) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e6edf3' }}>
          BaggerBomb thresholds update during market hours
        </div>
        <div style={{ fontSize: '12px', marginTop: '6px', color: '#6e7681' }}>
          Check back when markets are open.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <span style={{ fontSize: '24px' }}>{'\u{1F4A3}'}</span>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 700,
            color: '#00ff88',
          }}>
            BAGGERBOMB STATS
          </h3>
          <p style={{
            margin: '2px 0 0',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            Volatility scoring for {asset?.symbol}
          </p>
        </div>
      </div>

      {/* Starting Price */}
      {baselinePrice && baselinePrice > 0 && (
        <div style={{
          color: '#a0a0a0',
          fontSize: '13px',
          marginTop: '-12px',
          marginBottom: '12px',
        }}>
          Starting Price: <span style={{ color: '#e0e0e0', fontWeight: 600 }}>
            ${baselinePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ color: '#6e7681', marginLeft: '8px' }}>
            (resets daily at market open)
          </span>
        </div>
      )}

      {/* THRESHOLDS Section */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'rgba(255, 255, 255, 0.5)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '10px',
        }}>
          THRESHOLDS
        </div>

        {/* Positive Thresholds */}
        <div style={{
          background: 'rgba(0, 255, 136, 0.05)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '8px',
        }}>
          {BAGGER_TIERS.map((tier, i) => {
            const pct = baseThreshold * tier.multiplier;
            const targetPrice = baselinePrice ? baselinePrice * (1 + pct / 100) : null;
            return (
              <div key={tier.key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < BAGGER_TIERS.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
              }}>
                <span style={{ color: '#00ff88', fontSize: '13px' }}>{tier.emoji} {tier.label}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'monospace', fontSize: '12px' }}>
                    +{pct.toFixed(1)}%
                  </span>
                  {targetPrice && (
                    <>
                      <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '10px' }}>{'\u2192'}</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'monospace', fontSize: '11px', minWidth: '60px', textAlign: 'right' }}>
                        {formatTargetPrice(targetPrice)}
                      </span>
                    </>
                  )}
                  <span style={{ color: '#00ff88', fontWeight: 700, fontFamily: 'monospace', fontSize: '12px', minWidth: '48px', textAlign: 'right' }}>
                    +{tier.points} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Negative Thresholds */}
        <div style={{
          background: 'rgba(255, 51, 102, 0.05)',
          borderRadius: '10px',
          padding: '12px',
        }}>
          {BUST_TIERS.map((tier, i) => {
            const pct = baseThreshold * tier.multiplier;
            const targetPrice = baselinePrice ? baselinePrice * (1 - pct / 100) : null;
            return (
              <div key={tier.key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < BUST_TIERS.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
              }}>
                <span style={{ color: '#ff3366', fontSize: '13px' }}>{tier.emoji} {tier.label}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'monospace', fontSize: '12px' }}>
                    -{pct.toFixed(1)}%
                  </span>
                  {targetPrice && (
                    <>
                      <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '10px' }}>{'\u2192'}</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'monospace', fontSize: '11px', minWidth: '60px', textAlign: 'right' }}>
                        {formatTargetPrice(targetPrice)}
                      </span>
                    </>
                  )}
                  <span style={{ color: '#ff3366', fontWeight: 700, fontFamily: 'monospace', fontSize: '12px', minWidth: '48px', textAlign: 'right' }}>
                    {tier.points} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* THIS BATTLE Section */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'rgba(255, 255, 255, 0.5)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '10px',
        }}>
          THIS BATTLE
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          {/* BaggerBombs */}
          <div style={{
            background: currentBaggerBombs > 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '14px',
            textAlign: 'center',
            border: currentBaggerBombs > 0 ? '1px solid rgba(0, 255, 136, 0.3)' : 'none',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>
              {currentBaggerBombs > 0 ? '\u{1F4A3}'.repeat(Math.min(currentBaggerBombs, 3)) : '\u{1F4A3}'}
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: currentBaggerBombs > 0 ? '#00ff88' : 'rgba(255, 255, 255, 0.3)',
            }}>
              {currentBaggerBombs}x
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.5)',
              marginTop: '4px',
            }}>
              {currentBaggerBombPoints > 0 ? `+${currentBaggerBombPoints} pts` : 'No hits yet'}
            </div>
          </div>

          {/* Busts */}
          <div style={{
            background: currentBusts > 0 ? 'rgba(255, 51, 102, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '14px',
            textAlign: 'center',
            border: currentBusts > 0 ? '1px solid rgba(255, 51, 102, 0.3)' : 'none',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>
              {currentBusts > 0 ? '\u{1F4C9}'.repeat(Math.min(currentBusts, 3)) : '\u{1F4C9}'}
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: currentBusts > 0 ? '#ff3366' : 'rgba(255, 255, 255, 0.3)',
            }}>
              {currentBusts}x
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.5)',
              marginTop: '4px',
            }}>
              {currentBustPoints < 0 ? `${currentBustPoints} pts` : 'No busts'}
            </div>
          </div>
        </div>
      </div>

      {/* HISTORICAL Section */}
      <div>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'rgba(255, 255, 255, 0.5)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '10px',
        }}>
          HISTORICAL (30 DAYS)
        </div>

        <div style={{
          background: 'rgba(0, 217, 255, 0.05)',
          borderRadius: '10px',
          padding: '14px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            textAlign: 'center',
          }}>
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: historical.hitRate >= 50 ? '#00ff88' : historical.hitRate >= 30 ? '#f59e0b' : '#ff3366',
              }}>
                {historical.hitRate}%
              </div>
              <div style={{
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '4px',
                textTransform: 'uppercase',
              }}>
                Hit Rate
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#00d9ff',
              }}>
                {historical.avgMove.toFixed(1)}%
              </div>
              <div style={{
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '4px',
                textTransform: 'uppercase',
              }}>
                Avg Daily Move
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#fff',
              }}>
                {historical.daysAboveThreshold}/30
              </div>
              <div style={{
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '4px',
                textTransform: 'uppercase',
              }}>
                Days Hit
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: 'rgba(245, 158, 11, 0.08)',
          borderLeft: '3px solid #f59e0b',
          borderRadius: '0 8px 8px 0',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.7)',
        }}>
          <strong style={{ color: '#f59e0b' }}>Note:</strong> Threshold tiers are 1.0x, 1.5x, and 2.0x of the base threshold ({baseThreshold.toFixed(1)}%).
          {baselinePrice > 0 && (
            <span> Baseline: {formatTargetPrice(baselinePrice)}.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BaggerBombTab;
