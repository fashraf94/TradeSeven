import React from 'react';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { INDEX_REGISTRY } from '../../constants/indexRegistry';
import useMarketContext from './useMarketContext';

const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '6px',
};

const cardStyle = {
  background: '#0d1117',
  border: '1px solid rgba(0, 217, 255, 0.08)',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
};

const REGIME_MAP = {
  bull: { emoji: '\u2600\uFE0F', label: 'Clear Skies', color: '#10b981' },
  correction: { emoji: '\uD83C\uDF24\uFE0F', label: 'Passing Clouds', color: '#F59E0B' },
  bear: { emoji: '\u26C8\uFE0F', label: 'Storm Warning', color: '#ef4444' },
  recovery: { emoji: '\uD83C\uDF0A', label: 'Clearing Up', color: '#00D9FF' },
};

const LEADERSHIP_MAP = {
  tech_leads: { label: 'Tech Leading', color: '#a78bfa' },
  small_cap_leads: { label: 'Small Caps Leading', color: '#10b981' },
  defensive_leads: { label: 'Defensive Leading', color: '#FFD700' },
  broad_rally: { label: 'Broad Rally', color: '#10b981' },
  broad_selloff: { label: 'Broad Selloff', color: '#ef4444' },
  mixed: { label: 'Mixed Signals', color: '#8b949e' },
};

const BREADTH_SIGNAL_MAP = {
  broad_participation: { label: 'Broad Participation', color: '#10b981' },
  narrow_leadership: { label: 'Narrow Leadership', color: '#F59E0B' },
  broad_weakness: { label: 'Broad Weakness', color: '#F59E0B' },
  divergent: { label: 'Divergent', color: '#ef4444' },
};

const YIELD_REGIME_MAP = {
  accommodative: { label: 'Accommodative', color: '#10b981' },
  neutral: { label: 'Neutral', color: '#00D9FF' },
  restrictive: { label: 'Restrictive', color: '#F59E0B' },
  crisis: { label: 'Crisis', color: '#ef4444' },
};

const INDEX_KEYS = ['SPY', 'QQQ', 'DIA', 'IWM'];

function getBreadthBarColor(value) {
  if (value <= 20) return '#ef4444';
  if (value <= 40) return '#f97316';
  if (value <= 60) return '#F59E0B';
  if (value <= 80) return '#10b981';
  return '#22c55e';
}

// ── Loading Skeleton ──
function MarketContextSkeleton() {
  return (
    <div style={{ padding: '4px 0' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {[100, 48, 120, 120, 48, 80].map((h, i) => (
        <div key={i} style={{ height: `${h}px`, marginBottom: '12px', ...shimmerStyle }} />
      ))}
    </div>
  );
}

// ── Section A: Market Weather ──
function WeatherCard({ regime, regimeDetail }) {
  const config = REGIME_MAP[regime] || REGIME_MAP.bull;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        ...cardStyle,
        borderLeft: `4px solid ${config.color}`,
        boxShadow: `inset 0 0 20px ${config.color}10`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '28px' }}>{config.emoji}</span>
        <span style={{ fontSize: '18px', fontWeight: '700', color: config.color }}>{config.label}</span>
      </div>
      {regimeDetail && (
        <p style={{ margin: 0, fontSize: '12px', color: HOLO_COLORS.textMuted, lineHeight: '1.5' }}>
          {regimeDetail}
        </p>
      )}
    </motion.div>
  );
}

// ── Section B: Index Comparison Strip ──
function IndexStrip({ marketContext, currentSymbol }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
      {INDEX_KEYS.map(key => {
        const data = marketContext?.[key.toLowerCase()];
        const change = data?.changePercent ?? 0;
        const isPositive = change >= 0;
        const isCurrent = key === currentSymbol;
        const regColor = INDEX_REGISTRY[key]?.color || '#00D9FF';
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: INDEX_KEYS.indexOf(key) * 0.05 }}
            style={{
              flex: '1 0 auto',
              minWidth: '72px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: isCurrent ? `${regColor}15` : 'rgba(255,255,255,0.04)',
              border: isCurrent ? `1px solid ${regColor}` : '1px solid rgba(255,255,255,0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '700', color: HOLO_COLORS.textPrimary, marginBottom: '2px' }}>
              {key}
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: isPositive ? '#10b981' : '#ef4444',
            }}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Section C: Leadership & Divergence ──
function LeadershipDivergenceCard({ leadership, divergence }) {
  const leaderConfig = LEADERSHIP_MAP[leadership] || LEADERSHIP_MAP.mixed;
  const divActive = divergence?.active;
  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Market Leadership
        </span>
        <div style={{
          display: 'inline-block',
          marginLeft: '8px',
          padding: '3px 10px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
          background: `${leaderConfig.color}20`,
          color: leaderConfig.color,
        }}>
          {leaderConfig.label}
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
        <span style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Divergence
        </span>
        {divActive ? (
          <div style={{
            marginTop: '6px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.08)',
            borderLeft: '3px solid #F59E0B',
            fontSize: '12px',
            color: '#F59E0B',
            lineHeight: '1.4',
          }}>
            {divergence.detail || 'Divergence detected between indexes'}
          </div>
        ) : (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: HOLO_COLORS.textMuted }}>
            No divergences detected
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section D: Breadth & Rates ──
function BreadthRatesCard({ breadthQuality, breadthComposite, yields }) {
  const breadthConfig = BREADTH_SIGNAL_MAP[breadthQuality?.signal] || { label: breadthQuality?.signal || 'Unknown', color: '#8b949e' };
  const yieldConfig = YIELD_REGIME_MAP[yields?.regime] || { label: yields?.regime || 'Unknown', color: '#8b949e' };
  const compositeValue = typeof breadthComposite === 'number' ? Math.max(0, Math.min(100, breadthComposite)) : null;

  return (
    <div style={cardStyle}>
      {/* Breadth */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Breadth
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            background: `${breadthConfig.color}20`,
            color: breadthConfig.color,
          }}>
            {breadthConfig.label}
          </span>
        </div>
        {breadthQuality?.detail && (
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: HOLO_COLORS.textMuted, lineHeight: '1.4' }}>
            {breadthQuality.detail}
          </p>
        )}
        {compositeValue !== null && (
          <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${compositeValue}%`,
              borderRadius: '4px',
              background: getBreadthBarColor(compositeValue),
              transition: 'width 0.5s ease',
            }} />
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Yields
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            background: `${yieldConfig.color}20`,
            color: yieldConfig.color,
          }}>
            {yieldConfig.label}
          </span>
          {typeof yields?.tnx === 'number' && (
            <span style={{ fontSize: '12px', fontWeight: '700', color: HOLO_COLORS.textPrimary, fontFamily: 'monospace' }}>
              {yields.tnx.toFixed(2)}%
            </span>
          )}
        </div>
        {yields?.detail && (
          <p style={{ margin: 0, fontSize: '11px', color: HOLO_COLORS.textMuted, lineHeight: '1.4' }}>
            {yields.detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section E: Sector Snapshot ──
function fmtChange(val) {
  if (val == null) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function changeColor(val) {
  if (val == null) return HOLO_COLORS.textMuted;
  return val >= 0 ? '#10b981' : '#ef4444';
}

function SectorSnapshot({ sectorSnapshot, topSector, worstSector }) {
  const hasData = sectorSnapshot && sectorSnapshot.length > 0;
  return (
    <div style={cardStyle}>
      <span style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Sector Snapshot
      </span>
      {hasData ? (
        <div style={{ marginTop: '8px' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ flex: 1, fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted }}>Sector</span>
            <span style={{ width: '52px', textAlign: 'right', fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted }}>1D</span>
            <span style={{ width: '52px', textAlign: 'right', fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted }}>1W</span>
            <span style={{ width: '52px', textAlign: 'right', fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted }}>1M</span>
          </div>
          {sectorSnapshot.map((s) => {
            const isTop = s.sector === topSector;
            const isWorst = s.sector === worstSector;
            return (
              <div
                key={s.etf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderLeft: isTop ? '2px solid #10b981' : isWorst ? '2px solid #ef4444' : '2px solid transparent',
                  paddingLeft: '6px',
                }}
              >
                <span style={{
                  flex: 1,
                  fontSize: '11px',
                  fontWeight: isTop || isWorst ? '600' : '400',
                  color: isTop ? '#10b981' : isWorst ? '#ef4444' : HOLO_COLORS.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {s.etf}
                </span>
                <span style={{ width: '52px', textAlign: 'right', fontSize: '11px', fontWeight: '600', fontFamily: 'monospace', color: changeColor(s.changePercent) }}>
                  {fmtChange(s.changePercent)}
                </span>
                <span style={{ width: '52px', textAlign: 'right', fontSize: '11px', fontWeight: '600', fontFamily: 'monospace', color: changeColor(s.weekChange) }}>
                  {fmtChange(s.weekChange)}
                </span>
                <span style={{ width: '52px', textAlign: 'right', fontSize: '11px', fontWeight: '600', fontFamily: 'monospace', color: changeColor(s.monthChange) }}>
                  {fmtChange(s.monthChange)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: HOLO_COLORS.textMuted }}>
          Sector data coming soon
        </p>
      )}
    </div>
  );
}

// ── Section F: Technical Leaders Strip ──
function TechnicalLeadersStrip({ leaders = [], laggards = [], onNavigateToStock }) {
  if (!leaders.length && !laggards.length) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      {leaders.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
            Technical Leaders
          </span>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {leaders.slice(0, 5).map(ticker => (
              <button
                key={ticker}
                onClick={() => onNavigateToStock?.(ticker, ticker)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>
      )}
      {laggards.length > 0 && (
        <div>
          <span style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
            Technical Laggards
          </span>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {laggards.slice(0, 5).map(ticker => (
              <button
                key={ticker}
                onClick={() => onNavigateToStock?.(ticker, ticker)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function MarketContextTab({ symbol, onNavigateToStock }) {
  const { marketContext, loading, error, refetch } = useMarketContext(symbol);

  if (loading) return <MarketContextSkeleton />;

  if (error || !marketContext) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <p style={{ color: HOLO_COLORS.textMuted, fontSize: '14px', marginBottom: '12px' }}>
          Market intelligence unavailable
        </p>
        <button
          onClick={refetch}
          style={{
            padding: '8px 20px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 217, 255, 0.3)',
            background: 'rgba(0, 217, 255, 0.1)',
            color: '#00D9FF',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0 100px' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      <WeatherCard regime={marketContext.regime} regimeDetail={marketContext.regimeDetail} />

      <IndexStrip marketContext={marketContext} currentSymbol={symbol} />

      <LeadershipDivergenceCard
        leadership={marketContext.leadership}
        divergence={marketContext.divergence}
      />

      <BreadthRatesCard
        breadthQuality={marketContext.breadthQuality}
        breadthComposite={marketContext.breadthComposite}
        yields={marketContext.yields}
      />

      <SectorSnapshot
        sectorSnapshot={marketContext.sectorSnapshot}
        topSector={marketContext.topSectorToday}
        worstSector={marketContext.worstSectorToday}
      />

      <TechnicalLeadersStrip
        leaders={marketContext.technicalLeaders}
        laggards={marketContext.technicalLaggards}
        onNavigateToStock={onNavigateToStock}
      />
    </div>
  );
}
