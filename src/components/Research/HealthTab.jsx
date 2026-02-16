import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { fetchBitcoinOnChainData } from '../../services/onChainService';
import { HOLO_COLORS } from '../../constants/holoTheme';

// ============================================
// SHARED STYLES
// ============================================

const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '6px',
};

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  padding: '10px 12px',
};

const labelStyle = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const valueStyle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#e6edf3',
};

const ZONE_COLORS = {
  green: HOLO_COLORS.green,
  yellow: HOLO_COLORS.amber,
  red: HOLO_COLORS.red || '#ff3366',
};

const SIGNAL_COLORS = {
  bullish: HOLO_COLORS.green,
  neutral: HOLO_COLORS.amber,
  bearish: HOLO_COLORS.red || '#ff3366',
};

// ============================================
// REUSABLE SUB-COMPONENTS
// ============================================

/** Horizontal gauge bar with colored zones and position marker */
const MetricGauge = ({ value, min, max, zones, label }) => {
  if (value == null) return null;

  const clampedValue = Math.max(min, Math.min(max, value));
  const pct = ((clampedValue - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={labelStyle}>{label}</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#e6edf3' }}>
            {typeof value === 'number' ? (Math.abs(value) < 10 ? value.toFixed(2) : value.toFixed(0)) : value}
          </span>
        </div>
      )}
      <div style={{ position: 'relative', height: '12px', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
        {zones.map((zone, i) => {
          const width = ((zone.end - zone.start) / (max - min)) * 100;
          return (
            <div
              key={i}
              style={{
                width: `${width}%`,
                height: '100%',
                background: zone.color,
                opacity: 0.3,
              }}
            />
          );
        })}
        {/* Position marker */}
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: zones.find(z => clampedValue >= z.start && clampedValue < z.end)?.color || '#fff',
            border: '2px solid #fff',
            boxShadow: '0 0 6px rgba(0,0,0,0.5)',
            zIndex: 1,
          }}
        />
      </div>
      {/* Zone labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{zones[0]?.label || ''}</span>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{zones[zones.length - 1]?.label || ''}</span>
      </div>
    </div>
  );
};

/** AI insight display block with cyan left border */
const AIInsightBlock = ({ text, loading }) => {
  if (loading) {
    return (
      <div style={{ marginTop: '8px', padding: '10px 12px', borderLeft: `2px solid ${HOLO_COLORS.primary}`, background: 'rgba(0, 217, 255, 0.03)', borderRadius: '0 6px 6px 0' }}>
        <div style={{ ...shimmerStyle, height: '12px', width: '90%', marginBottom: '6px' }} />
        <div style={{ ...shimmerStyle, height: '12px', width: '70%' }} />
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>
    );
  }
  if (!text) return null;
  return (
    <div style={{
      marginTop: '8px',
      padding: '10px 12px',
      borderLeft: `2px solid ${HOLO_COLORS.primary}`,
      background: 'rgba(0, 217, 255, 0.03)',
      borderRadius: '0 6px 6px 0',
    }}>
      <span style={{ fontSize: '13px', fontStyle: 'italic', color: '#c9d1d9', lineHeight: '1.5' }}>
        {text}
      </span>
    </div>
  );
};

/** Expandable educational "What this means" block */
const LearnMoreBlock = ({ children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '11px',
        }}
      >
        <BookOpen size={12} />
        <span>What this means</span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: '9px', display: 'flex', alignItems: 'center' }}
        >
          {'\u25B6'}
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '10px 12px',
              background: 'rgba(0, 217, 255, 0.03)',
              border: '1px solid rgba(0, 217, 255, 0.1)',
              borderRadius: '6px',
              marginTop: '4px',
            }}>
              <span style={{ fontSize: '12px', color: '#8b949e', lineHeight: '1.6' }}>
                {children}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Metric row with label, value, and optional change indicator */
const MetricRow = ({ label, value, change, unit, invertColor }) => {
  if (value == null) return null;
  const changeColor = change == null ? null
    : (invertColor ? change < 0 : change > 0) ? HOLO_COLORS.green : (change === 0 ? HOLO_COLORS.amber : (HOLO_COLORS.red || '#ff3366'));

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#e6edf3' }}>
          {typeof value === 'number' ? (Math.abs(value) >= 1000 ? formatCompact(value) : value.toFixed(2)) : value}
          {unit && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginLeft: '2px' }}>{unit}</span>}
        </span>
        {change != null && (
          <span style={{ fontSize: '11px', fontWeight: '600', color: changeColor }}>
            {change > 0 ? '+' : ''}{typeof change === 'number' ? (Math.abs(change) >= 1000 ? formatCompact(change) : change.toFixed(2)) : change}
          </span>
        )}
      </div>
    </div>
  );
};

const formatCompact = (n) => {
  if (n == null) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
};

// ============================================
// SECTION COMPONENTS
// ============================================

/** Overall health verdict banner */
const OverallVerdict = ({ data, aiSummary, aiLoading }) => {
  const overall = data?.overall;
  if (!overall) return null;

  const zoneColor = ZONE_COLORS[overall.zone] || HOLO_COLORS.amber;

  return (
    <div style={{
      ...cardStyle,
      borderLeft: `3px solid ${zoneColor}`,
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: zoneColor,
          boxShadow: `0 0 8px ${zoneColor}60`,
        }} />
        <span style={{ fontSize: '14px', fontWeight: '700', color: zoneColor, textTransform: 'uppercase' }}>
          {overall.verdict}
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
          Score: {overall.score > 0 ? '+' : ''}{overall.score}
        </span>
      </div>
      {aiLoading && (
        <div>
          <div style={{ ...shimmerStyle, height: '12px', width: '95%', marginBottom: '6px' }} />
          <div style={{ ...shimmerStyle, height: '12px', width: '75%' }} />
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>
      )}
      {aiSummary?.overallVerdict && !aiLoading && (
        <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#8b949e', lineHeight: '1.5', margin: 0 }}>
          {aiSummary.overallVerdict}
        </p>
      )}
    </div>
  );
};

/** MVRV Z-Score section */
const MVRVSection = ({ data, aiInsight, aiLoading }) => {
  const mvrvZones = [
    { start: -1, end: 0, color: '#3b82f6', label: 'Undervalued' },
    { start: 0, end: 1, color: HOLO_COLORS.green, label: '' },
    { start: 1, end: 3, color: HOLO_COLORS.amber, label: '' },
    { start: 3, end: 7, color: '#f97316', label: '' },
    { start: 7, end: 10, color: HOLO_COLORS.red || '#ff3366', label: 'Overheated' },
  ];

  const getZoneLabel = (v) => {
    if (v == null) return '';
    if (v < 0) return 'Capitulation';
    if (v < 1) return 'Undervalued';
    if (v < 3) return 'Fair Value';
    if (v < 7) return 'Overheated';
    return 'Extreme Greed';
  };

  return (
    <div>
      {data?.latest != null ? (
        <>
          <MetricGauge value={data.latest} min={-1} max={10} zones={mvrvZones} label="MVRV Z-Score" />
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '4px',
              background: `${(mvrvZones.find(z => data.latest >= z.start && data.latest < z.end) || mvrvZones[2]).color}20`,
              color: (mvrvZones.find(z => data.latest >= z.start && data.latest < z.end) || mvrvZones[2]).color,
              textTransform: 'uppercase',
            }}>
              {getZoneLabel(data.latest)}
            </span>
          </div>
        </>
      ) : (
        <div style={{ padding: '8px 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>MVRV data unavailable</div>
      )}
      <AIInsightBlock text={aiInsight} loading={aiLoading} />
      <LearnMoreBlock>
        Think of MVRV like a P/E ratio for Bitcoin. It compares the current market price to what the average holder actually paid.
        When it's high (&gt;3), most holders are sitting on big profits and may start selling — like a stock with a sky-high P/E.
        When it's low (&lt;1), holders are underwater — they tend to hold tight, creating a price floor. Historically, MVRV below 1 has been an excellent buying zone.
      </LearnMoreBlock>
    </div>
  );
};

/** Sentiment section: NUPL + Fear & Greed */
const SentimentSection = ({ nupl, fearGreed, aiInsight, aiLoading }) => {
  const nuplZones = [
    { start: -0.5, end: 0, color: '#3b82f6', label: 'Capitulation' },
    { start: 0, end: 0.25, color: HOLO_COLORS.green, label: '' },
    { start: 0.25, end: 0.5, color: HOLO_COLORS.amber, label: '' },
    { start: 0.5, end: 0.75, color: '#f97316', label: '' },
    { start: 0.75, end: 1, color: HOLO_COLORS.red || '#ff3366', label: 'Euphoria' },
  ];

  const fgZones = [
    { start: 0, end: 25, color: '#3b82f6', label: 'Extreme Fear' },
    { start: 25, end: 45, color: HOLO_COLORS.green, label: '' },
    { start: 45, end: 55, color: HOLO_COLORS.amber, label: '' },
    { start: 55, end: 75, color: '#f97316', label: '' },
    { start: 75, end: 100, color: HOLO_COLORS.red || '#ff3366', label: 'Extreme Greed' },
  ];

  return (
    <div>
      {nupl?.latest != null && (
        <MetricGauge value={nupl.latest} min={-0.5} max={1} zones={nuplZones} label="NUPL (Net Unrealized Profit/Loss)" />
      )}
      {fearGreed?.latest != null && (
        <div style={{ marginTop: '10px' }}>
          <MetricGauge value={fearGreed.latest} min={0} max={100} zones={fgZones} label="Fear & Greed Index" />
        </div>
      )}
      {nupl?.latest == null && fearGreed?.latest == null && (
        <div style={{ padding: '8px 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Sentiment data unavailable</div>
      )}
      <AIInsightBlock text={aiInsight} loading={aiLoading} />
      <LearnMoreBlock>
        NUPL measures what percentage of Bitcoin's total market cap is unrealized profit. Above 0.75 means most holders are in massive profit — historically,
        this triggers euphoric selling. Below 0 means most holders are underwater — like a market in deep capitulation. The Fear & Greed Index
        combines multiple signals (volatility, volume, social media, surveys) into a single 0-100 score. Extreme fear often marks bottoms; extreme greed often marks tops.
      </LearnMoreBlock>
    </div>
  );
};

/** Smart money section: exchange flows, ETF, whale activity */
const SmartMoneySection = ({ exchangeNetflow, etfBalance, whaleCoins, sharkCoins, aiInsight, aiLoading }) => {
  return (
    <div>
      <MetricRow
        label="Exchange Net Flow"
        value={exchangeNetflow?.latest}
        unit="BTC"
        change={exchangeNetflow?.change7d}
        invertColor
      />
      <MetricRow
        label="ETF BTC Balance"
        value={etfBalance?.latest}
        unit="BTC"
        change={etfBalance?.change7d}
      />
      <MetricRow
        label="Whale Holdings (1K-10K BTC)"
        value={whaleCoins?.latest}
        unit="BTC"
        change={whaleCoins?.change30d}
      />
      <MetricRow
        label="Shark Holdings (100-1K BTC)"
        value={sharkCoins?.latest}
        unit="BTC"
        change={sharkCoins?.change30d}
      />
      {exchangeNetflow?.latest == null && etfBalance?.latest == null && whaleCoins?.latest == null && (
        <div style={{ padding: '8px 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Smart money data unavailable</div>
      )}
      <AIInsightBlock text={aiInsight} loading={aiLoading} />
      <LearnMoreBlock>
        When BTC moves OFF exchanges, it means holders are moving coins to cold storage — they're planning to hold long-term.
        This reduces supply on exchanges, which can push prices up. Think of it like insiders buying stock. ETF inflows mean institutional
        money is entering the market. Whale accumulation (1K-10K BTC wallets) is like watching what hedge funds and family offices are doing.
      </LearnMoreBlock>
    </div>
  );
};

/** Leverage risk section: funding rate + open interest */
const LeverageSection = ({ fundingRate, openInterest, aiInsight, aiLoading }) => {
  const isExtreme = fundingRate?.latest != null && (fundingRate.latest > 0.05 || fundingRate.latest < -0.05);

  return (
    <div>
      {fundingRate?.latest != null && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={labelStyle}>Funding Rate</span>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: fundingRate.latest > 0.01 ? (HOLO_COLORS.red || '#ff3366')
                : fundingRate.latest < -0.01 ? HOLO_COLORS.green
                : HOLO_COLORS.amber,
            }}>
              {fundingRate.latest > 0 ? '+' : ''}{fundingRate.latest.toFixed(4)}%
            </span>
          </div>
          {/* Centered gauge */}
          <div style={{ position: 'relative', height: '12px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              height: '100%',
              ...(fundingRate.latest >= 0
                ? { left: '50%', width: `${Math.min(50, Math.abs(fundingRate.latest) * 500)}%`, background: `${HOLO_COLORS.red || '#ff3366'}50` }
                : { right: '50%', width: `${Math.min(50, Math.abs(fundingRate.latest) * 500)}%`, background: `${HOLO_COLORS.green}50` }
              ),
              borderRadius: '6px',
            }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: '1px', height: '100%', background: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>Short bias</span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>Long bias</span>
          </div>
        </div>
      )}
      <MetricRow label="Open Interest" value={openInterest?.latest} change={openInterest?.change7d} />
      {isExtreme && (
        <div style={{
          marginTop: '8px',
          padding: '8px 10px',
          borderRadius: '6px',
          background: `${HOLO_COLORS.amber}15`,
          border: `1px solid ${HOLO_COLORS.amber}30`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{ fontSize: '13px' }}>{'\u26A0\uFE0F'}</span>
          <span style={{ fontSize: '11px', color: HOLO_COLORS.amber }}>
            Extreme {fundingRate.latest > 0 ? 'long' : 'short'} leverage — higher liquidation risk
          </span>
        </div>
      )}
      {fundingRate?.latest == null && openInterest?.latest == null && (
        <div style={{ padding: '8px 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Leverage data unavailable</div>
      )}
      <AIInsightBlock text={aiInsight} loading={aiLoading} />
      <LearnMoreBlock>
        Funding rate is like short interest for crypto. When it's very positive, too many traders are betting long with leverage.
        A small price drop triggers cascading liquidations — forced selling that amplifies the move. When negative, shorts are overleveraged
        and a squeeze becomes likely. For BaggerBomb, high leverage in either direction means higher probability of explosive threshold-crossing moves.
      </LearnMoreBlock>
    </div>
  );
};

/** BaggerBomb outlook with probability pills */
const BaggerBombOutlook = ({ overall, aiOutlook, aiLoading }) => {
  const probColors = { LOW: HOLO_COLORS.green, MEDIUM: HOLO_COLORS.amber, HIGH: HOLO_COLORS.red || '#ff3366' };

  return (
    <div>
      {/* Probability pills */}
      {aiOutlook && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {[
            { label: 'BaggerBomb', icon: '\uD83D\uDCA3', value: aiOutlook.bombProbability },
            { label: 'Bust Risk', icon: '\uD83D\uDCC9', value: aiOutlook.bustRisk },
          ].map(pill => pill.value && (
            <div key={pill.label} style={{
              flex: 1,
              ...cardStyle,
              textAlign: 'center',
              borderColor: `${probColors[pill.value] || HOLO_COLORS.amber}30`,
            }}>
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>{pill.icon}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>{pill.label}</div>
              <div style={{
                fontSize: '12px',
                fontWeight: '700',
                color: probColors[pill.value] || HOLO_COLORS.amber,
              }}>
                {pill.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key factors */}
      {overall?.factors?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ ...labelStyle, marginBottom: '6px' }}>Key Factors</div>
          {overall.factors.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: SIGNAL_COLORS[f.signal] || HOLO_COLORS.amber,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                <strong style={{ color: SIGNAL_COLORS[f.signal] || HOLO_COLORS.amber }}>{f.metric}</strong>
                {' '}&mdash; {f.note}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* AI reasoning */}
      {aiLoading && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ ...shimmerStyle, height: '12px', width: '90%', marginBottom: '6px' }} />
          <div style={{ ...shimmerStyle, height: '12px', width: '80%', marginBottom: '6px' }} />
          <div style={{ ...shimmerStyle, height: '12px', width: '60%' }} />
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>
      )}
      {aiOutlook?.reasoning && !aiLoading && (
        <AIInsightBlock text={aiOutlook.reasoning} />
      )}

      {/* Disclaimer */}
      <div style={{ marginTop: '10px', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
          {'\u26A0\uFE0F'} On-chain data provides context, not predictions. Use for educational game strategy only.
        </span>
      </div>
    </div>
  );
};

// ============================================
// SIMPLIFIED VIEW (non-BTC crypto)
// ============================================

const SimplifiedHealthView = ({ data }) => {
  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{
        ...cardStyle,
        marginBottom: '12px',
        borderLeft: `3px solid ${HOLO_COLORS.primary}`,
      }}>
        <span style={{ fontSize: '12px', color: '#8b949e', lineHeight: '1.5' }}>
          Detailed on-chain analysis is available for Bitcoin. Other crypto assets show market-wide sentiment and leverage indicators.
        </span>
      </div>

      <CollapsibleSection title="Sentiment" defaultOpen>
        <SentimentSection
          nupl={null}
          fearGreed={data?.fearGreed}
          aiInsight={null}
          aiLoading={false}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Leverage" defaultOpen>
        <LeverageSection
          fundingRate={data?.fundingRate}
          openInterest={data?.openInterest}
          aiInsight={null}
          aiLoading={false}
        />
      </CollapsibleSection>

      {data?.updatedAt && (
        <div style={{ padding: '12px 0', fontSize: 11, color: '#8b949e', textAlign: 'center' }}>
          Updated: {new Date(data.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
};

// ============================================
// LOADING SKELETON
// ============================================

const HealthSkeleton = () => (
  <div style={{ padding: '16px 0' }}>
    {/* Verdict card skeleton */}
    <div style={{ ...cardStyle, marginBottom: '12px' }}>
      <div style={{ ...shimmerStyle, height: '16px', width: '40%', marginBottom: '8px' }} />
      <div style={{ ...shimmerStyle, height: '12px', width: '90%', marginBottom: '6px' }} />
      <div style={{ ...shimmerStyle, height: '12px', width: '70%' }} />
    </div>
    {/* Sections skeleton */}
    {[1, 2, 3, 4].map(i => (
      <div key={i} style={{ marginBottom: '16px' }}>
        <div style={{ ...shimmerStyle, height: '14px', width: '30%', marginBottom: '10px' }} />
        <div style={{ ...shimmerStyle, height: '12px', width: '100%', marginBottom: '6px' }} />
        <div style={{ ...shimmerStyle, height: '36px', width: '100%', marginBottom: '6px' }} />
        <div style={{ ...shimmerStyle, height: '12px', width: '60%' }} />
      </div>
    ))}
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const HealthTab = ({ asset, symbol }) => {
  const [data, setData] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const isBTC = symbol === 'BTC' || symbol === 'BTC-USD';

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const onChainData = await fetchBitcoinOnChainData();
        if (cancelled) return;
        setData(onChainData);

        // Fetch AI summary only for BTC and only if we have data
        if (isBTC && onChainData && onChainData.success) {
          setAiLoading(true);
          try {
            const res = await fetch('/api/ai-advisor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'crypto-health', onChainData, symbol }),
            });
            const summary = await res.json();
            if (!cancelled && summary.success) {
              setAiSummary(summary);
            }
          } catch (err) {
            console.error('[HealthTab] AI summary error:', err);
          } finally {
            if (!cancelled) setAiLoading(false);
          }
        }
      } catch (err) {
        console.error('[HealthTab] Data load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [symbol, isBTC]);

  if (loading) return <HealthSkeleton />;
  if (!data) return <div style={{ padding: '20px', color: '#8b949e', textAlign: 'center' }}>Unable to load on-chain data</div>;
  if (!isBTC) return <SimplifiedHealthView data={data} />;

  return (
    <div style={{ padding: '8px 0' }}>
      <OverallVerdict data={data} aiSummary={aiSummary} aiLoading={aiLoading} />

      <CollapsibleSection title="Valuation" defaultOpen>
        <MVRVSection data={data.mvrv} aiInsight={aiSummary?.valuationInsight} aiLoading={aiLoading} />
      </CollapsibleSection>

      <CollapsibleSection title="Sentiment" defaultOpen>
        <SentimentSection
          nupl={data.nupl}
          fearGreed={data.fearGreed}
          aiInsight={aiSummary?.sentimentInsight}
          aiLoading={aiLoading}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Smart Money" defaultOpen={false}>
        <SmartMoneySection
          exchangeNetflow={data.exchangeNetflow}
          etfBalance={data.etfBalance}
          whaleCoins={data.whaleCoins}
          sharkCoins={data.sharkCoins}
          aiInsight={aiSummary?.smartMoneyInsight}
          aiLoading={aiLoading}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Leverage Risk" defaultOpen={false}>
        <LeverageSection
          fundingRate={data.fundingRate}
          openInterest={data.openInterest}
          aiInsight={aiSummary?.leverageInsight}
          aiLoading={aiLoading}
        />
      </CollapsibleSection>

      <CollapsibleSection title="BaggerBomb Outlook" defaultOpen>
        <BaggerBombOutlook
          overall={data.overall}
          aiOutlook={aiSummary?.baggerBombOutlook}
          aiLoading={aiLoading}
        />
      </CollapsibleSection>

      {/* Last Updated */}
      <div style={{ padding: '12px 0', fontSize: 11, color: '#8b949e', textAlign: 'center' }}>
        {data.stale && '\u26A0\uFE0F Using cached data \u00B7 '}
        Updated: {new Date(data.updatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default HealthTab;
