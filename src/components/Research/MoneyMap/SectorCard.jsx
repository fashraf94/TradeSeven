// /src/components/Research/MoneyMap/SectorCard.jsx

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuadrantBadge from './QuadrantBadge';
import BreadthBar from './BreadthBar';
import LeadershipDisplay from './LeadershipDisplay';

// ===========================================
// HELPERS
// ===========================================

/** Format a number as a signed percentage string: "+18.0%" or "-3.7%" */
function formatPercent(val) {
  if (typeof val !== 'number' || !isFinite(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

/** Format distance from MA: "+8.2%" or "-2.3%" */
function formatDistance(val) {
  if (typeof val !== 'number' || !isFinite(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

/** Color for a performance value */
function perfColor(val) {
  if (typeof val !== 'number') return '#8b949e';
  return val >= 0 ? '#10b981' : '#ef4444';
}

// ===========================================
// EXTRACTED STYLE CONSTANTS
// ===========================================

const MUTED_LABEL = {
  fontSize: '10px',
  color: '#8b949e',
};

const INNER_CARD_BG = {
  padding: '12px',
  background: '#161b22',
  borderRadius: '8px',
};

const STAT_CELL = {
  textAlign: 'center',
  padding: '10px',
  background: '#161b22',
  borderRadius: '8px',
};

function alertCardStyle(colorRgb) {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
    borderRadius: '8px',
    background: `rgba(${colorRgb},0.08)`,
    border: `1px solid rgba(${colorRgb},0.2)`,
  };
}

// ===========================================
// SECTION HEADER
// ===========================================

const SectionHeader = ({ children }) => (
  <div style={{
    fontSize: '11px',
    color: '#8b949e',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
  }}>
    {children}
  </div>
);

// ===========================================
// SECTOR CARD
// ===========================================

/**
 * SectorCard — Collapsed/expanded card showing sector diagnostics
 *
 * @param {Object}   props
 * @param {Object}   props.sector     - Enriched sector object (engine output + display fields)
 * @param {boolean}  props.isExpanded  - Whether this card is expanded
 * @param {function} props.onToggle    - Toggle expand/collapse
 */
/** Inline tappable label: dashed underline + triggers tooltip on tap */
const TappableLabel = ({ metricKey, onTooltip, children, style }) => (
  <span
    onClick={(e) => { e.stopPropagation(); onTooltip?.(metricKey); }}
    style={{
      ...style,
      borderBottom: onTooltip ? '1px dashed #484f58' : 'none',
      cursor: onTooltip ? 'pointer' : 'default',
      paddingBottom: '1px',
    }}
  >
    {children}
  </span>
);

const SectorCard = ({ sector, isExpanded, onToggle, onTooltip }) => {
  const perf = sector.performance || {};
  const techs = sector.etfTechnicals || {};
  const bb = sector.baggerBombStats || {};

  return (
    <div
      onClick={onToggle}
      style={{
        background: isExpanded ? '#1c2128' : '#161b22',
        border: '1px solid #21262d',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* ============================================ */}
      {/* COLLAPSED ROW (always visible)               */}
      {/* ============================================ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        gap: '16px',
        minHeight: '56px',
      }}>
        {/* COL 1: Identity */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: '140px',
          flex: '0 0 auto',
        }}>
          {/* Sector color dot */}
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: sector.sectorColor || '#8b949e',
            flexShrink: 0,
          }} />
          <div>
            <div style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              lineHeight: '1.2',
            }}>
              {sector.sectorEmoji} {sector.name}
            </div>
            <div style={{
              color: '#8b949e',
              fontSize: '11px',
              marginTop: '2px',
            }}>
              {sector.sectorId}
            </div>
          </div>
        </div>

        {/* COL 2: 1M performance + QuadrantBadge */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px',
          minWidth: '100px',
          flex: '0 0 auto',
        }}>
          <span style={{
            color: perfColor(perf.month1),
            fontSize: '15px',
            fontWeight: '700',
          }}>
            {formatPercent(perf.month1)}
          </span>
          <QuadrantBadge quadrant={sector.quadrant?.quadrant || 'NEUTRAL'} />
        </div>

        {/* COL 3: BreadthBar compact + momentum */}
        <div style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '120px',
        }}>
          <BreadthBar
            breadth={sector.breadthTier?.percent ?? 50}
            direction={sector.breadthDirection || 'stable'}
            tier={sector.breadthTier}
            compact
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <TappableLabel metricKey="momentumScore" onTooltip={onTooltip} style={{ color: '#8b949e', fontSize: '11px' }}>Mom</TappableLabel>
            <span style={{
              color: perfColor(sector.momentumScore),
              fontSize: '12px',
              fontWeight: '600',
            }}>
              {sector.momentumScore > 0 ? '+' : ''}{sector.momentumScore}
            </span>
            <span style={{ color: '#8b949e', fontSize: '10px' }}>
              {sector.momentumDirection?.direction === 'Accelerating' ? '\u25B2'
                : sector.momentumDirection?.direction === 'Decelerating' ? '\u25BC'
                : '\u2014'}
            </span>
          </div>
        </div>

        {/* COL 4: Alert badges + chevron */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          {sector.gildedCage?.detected && (
            <span
              onClick={(e) => { e.stopPropagation(); onTooltip?.('gildedCage'); }}
              style={{
                padding: '2px 6px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: '600',
                background: sector.gildedCage.severity === 'CRITICAL'
                  ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                color: sector.gildedCage.severity === 'CRITICAL'
                  ? '#ef4444' : '#f59e0b',
                cursor: 'pointer',
              }}
            >
              {sector.gildedCage.severity === 'CRITICAL' ? '\uD83C\uDFDA\uFE0F' : '\u26A0\uFE0F'} Cage
            </span>
          )}
          {sector.priceBreadthDivergence?.divergence !== 'none' && sector.priceBreadthDivergence?.divergence && (
            <span
              onClick={(e) => { e.stopPropagation(); onTooltip?.('breadth'); }}
              style={{
                padding: '2px 6px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: '600',
                background: sector.priceBreadthDivergence.divergence === 'bearish'
                  ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                color: sector.priceBreadthDivergence.divergence === 'bearish'
                  ? '#ef4444' : '#3b82f6',
                cursor: 'pointer',
              }}
            >
              {sector.priceBreadthDivergence.divergence === 'bearish' ? '\uD83D\uDCC9' : '\uD83D\uDCC8'} Div
            </span>
          )}
          {/* Chevron */}
          <span style={{
            color: '#8b949e',
            fontSize: '12px',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            marginLeft: '4px',
          }}>
            {'\u25BC'}
          </span>
        </div>
      </div>

      {/* ============================================ */}
      {/* EXPANDED SECTION (animated)                   */}
      {/* ============================================ */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '0 20px 20px',
                borderTop: '1px solid #21262d',
              }}
            >
              {/* SECTION 1: Health Diagnostic */}
              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <SectionHeader>Health Diagnostic</SectionHeader>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                }}>
                  {/* Trend Position */}
                  <div style={INNER_CARD_BG}>
                    <div style={{ ...MUTED_LABEL, marginBottom: '4px' }}>
                      Trend Position
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: sector.maPosition?.color || '#8b949e',
                    }}>
                      {sector.maPosition?.label || 'Unknown'}
                    </div>
                  </div>
                  {/* Breadth */}
                  <div style={INNER_CARD_BG}>
                    <div style={{ ...MUTED_LABEL, marginBottom: '4px' }}>
                      <TappableLabel metricKey="breadth" onTooltip={onTooltip}>Breadth</TappableLabel>
                    </div>
                    <BreadthBar
                      breadth={sector.breadthTier?.percent ?? 50}
                      direction={sector.breadthDirection || 'stable'}
                      tier={sector.breadthTier}
                    />
                  </div>
                  {/* Leadership */}
                  <div style={INNER_CARD_BG}>
                    <div style={{ ...MUTED_LABEL, marginBottom: '4px' }}>
                      <TappableLabel metricKey="leadership" onTooltip={onTooltip}>Leadership</TappableLabel>
                    </div>
                    <LeadershipDisplay
                      leadershipScore={sector.leadershipScore}
                      leaders={sector.leaders || []}
                      hasGildedCage={sector.gildedCage?.detected}
                      isExpanded={false}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Performance */}
              <div style={{ marginBottom: '16px' }}>
                <SectionHeader>Performance</SectionHeader>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                }}>
                  {[
                    { label: '1 Week', value: perf.week1 },
                    { label: '1 Month', value: perf.month1 },
                    { label: '3 Months', value: perf.month3 },
                  ].map(({ label, value }) => (
                    <div key={label} style={STAT_CELL}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: perfColor(value),
                      }}>
                        {formatPercent(value)}
                      </div>
                      <div style={{ ...MUTED_LABEL, marginTop: '2px' }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: ETF Technicals */}
              <div style={{ marginBottom: '16px' }}>
                <SectionHeader>{sector.sectorId} Technicals</SectionHeader>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                }}>
                  {[
                    { label: '50-day MA', tooltipKey: 'ma50', above: techs.above50SMA, distance: techs.distanceFrom50SMA },
                    { label: '200-day MA', tooltipKey: 'ma200', above: techs.above200SMA, distance: techs.distanceFrom200SMA },
                  ].map(({ label, tooltipKey, above, distance }) => (
                    <div key={label} style={{
                      ...INNER_CARD_BG,
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: above ? '#10b981' : '#ef4444',
                        flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontSize: '12px', color: '#ffffff' }}>
                          {above ? 'Above' : 'Below'} <TappableLabel metricKey={tooltipKey} onTooltip={onTooltip}>{label}</TappableLabel>
                        </div>
                        <div style={MUTED_LABEL}>
                          {formatDistance(distance)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: BaggerBomb Stats */}
              <div style={{ marginBottom: '16px' }}>
                <SectionHeader><TappableLabel metricKey="baggerbomb" onTooltip={onTooltip}>BaggerBomb Stats</TappableLabel> (7 Days)</SectionHeader>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                }}>
                  <div style={STAT_CELL}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>
                      {bb.breakouts7d ?? 0}
                    </div>
                    <div style={MUTED_LABEL}>Breakouts</div>
                  </div>
                  <div style={STAT_CELL}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>
                      {bb.busts7d ?? 0}
                    </div>
                    <div style={MUTED_LABEL}>Busts</div>
                  </div>
                  <div style={STAT_CELL}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
                      {bb.hitRate ?? 0}%
                    </div>
                    <div style={MUTED_LABEL}>Hit Rate</div>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Top Leaders (expanded pills) */}
              {sector.leaders && sector.leaders.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <SectionHeader>Top Leaders</SectionHeader>
                  <LeadershipDisplay
                    leadershipScore={sector.leadershipScore}
                    leaders={sector.leaders}
                    hasGildedCage={sector.gildedCage?.detected}
                    isExpanded={true}
                  />
                </div>
              )}

              {/* SECTION 6: AI Insight */}
              {sector.insight && (
                <div style={{
                  padding: '12px',
                  background: `${sector.sectorColor || '#8b949e'}10`,
                  borderRadius: '8px',
                  borderLeft: `3px solid ${sector.sectorColor || '#8b949e'}`,
                  marginBottom: '16px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}>
                    <span style={{ fontSize: '14px' }}>{'\uD83D\uDCA1'}</span>
                    <p style={{
                      margin: 0,
                      color: '#e6edf3',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      fontStyle: 'italic',
                    }}>
                      {sector.insight}
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 7: Alert Callouts */}
              {(sector.gildedCage?.detected || (sector.priceBreadthDivergence?.divergence && sector.priceBreadthDivergence.divergence !== 'none')) && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  {/* Gilded Cage Alert */}
                  {sector.gildedCage?.detected && (
                    <div style={alertCardStyle(
                      sector.gildedCage.severity === 'CRITICAL' ? '239,68,68' : '245,158,11'
                    )}>
                      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
                        {sector.gildedCage.severity === 'CRITICAL' ? '\uD83C\uDFDA\uFE0F' : '\u26A0\uFE0F'}
                      </span>
                      <div>
                        <div style={{
                          color: sector.gildedCage.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                          fontSize: '12px',
                          fontWeight: '700',
                          marginBottom: '4px',
                        }}>
                          <TappableLabel metricKey="gildedCage" onTooltip={onTooltip}>GILDED CAGE</TappableLabel> {sector.gildedCage.severity === 'CRITICAL' ? '— CRITICAL' : '— WARNING'}
                        </div>
                        <div style={{
                          color: '#e6edf3',
                          fontSize: '12px',
                          lineHeight: '1.4',
                        }}>
                          {sector.gildedCage.description}
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '16px',
                          marginTop: '8px',
                        }}>
                          <span style={MUTED_LABEL}>
                            Leadership: {sector.gildedCage.leadershipScore}/5
                          </span>
                          <span style={MUTED_LABEL}>
                            Breadth: {sector.gildedCage.breadthPercent}%
                          </span>
                          <span style={MUTED_LABEL}>
                            <TappableLabel metricKey="weightedLeadership" onTooltip={onTooltip}>Weighted</TappableLabel>: {Math.round((sector.gildedCage.weightedLeadership || 0) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Price-Breadth Divergence Alert */}
                  {sector.priceBreadthDivergence?.divergence && sector.priceBreadthDivergence.divergence !== 'none' && (
                    <div style={alertCardStyle(
                      sector.priceBreadthDivergence.divergence === 'bearish' ? '239,68,68' : '59,130,246'
                    )}>
                      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
                        {sector.priceBreadthDivergence.divergence === 'bearish' ? '\uD83D\uDCC9' : '\uD83D\uDCC8'}
                      </span>
                      <div>
                        <div style={{
                          color: sector.priceBreadthDivergence.divergence === 'bearish' ? '#ef4444' : '#3b82f6',
                          fontSize: '12px',
                          fontWeight: '700',
                          marginBottom: '4px',
                        }}>
                          {sector.priceBreadthDivergence.divergence === 'bearish'
                            ? 'BEARISH DIVERGENCE' : 'BULLISH DIVERGENCE'}
                        </div>
                        <div style={{
                          color: '#e6edf3',
                          fontSize: '12px',
                          lineHeight: '1.4',
                        }}>
                          {sector.priceBreadthDivergence.description}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SectorCard;
