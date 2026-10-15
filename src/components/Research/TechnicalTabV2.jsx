import React, { useState, useEffect, useMemo } from 'react';
import { Target, Zap, BarChart3, Globe, TrendingUp, TrendingDown } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { SECTORS, CRYPTO_SECTOR } from '../../constants/sectors';
import { getQuickSectorSummary } from '../../services/sectorDataService';
import QuadrantBadge from './MoneyMap/QuadrantBadge';

/**
 * TechnicalTabV2 — Enhanced 4-section collapsible technical analysis tab.
 * Replaces the mock-data-driven TechnicalAnalysisTab with real computed data.
 *
 * `dailyData` is the symbol's DAILY series (newest-first, as the API returns
 * it) — never the chart's candles, which can be weekly or intraday.
 */
const TechnicalTabV2 = ({ asset, dailyData, indicators, levels, onLevelHighlight }) => {
  const price = asset?.price || 0;

  return (
    <div>
      <PriceLevelsSection levels={levels} price={price} onLevelHighlight={onLevelHighlight} />
      <MomentumSection indicators={indicators} price={price} />
      <VolumeRangeSection dailyData={dailyData} price={price} />
      <SectorContextSection asset={asset} />
    </div>
  );
};

// A level's distance is stored as a bare percentage string ("-2.31"); show
// its sign and unit, formatted from that same number.
const formatDistance = (distance) => {
  const n = Number(distance);
  if (distance == null || distance === '' || !Number.isFinite(n)) return '';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

/**
 * MACD wording from the histogram (MACD minus its signal line). `histogram`
 * is newest-first: index 0 is the latest daily bar, up to 6 bars. "Cross" is
 * said only when the line was on the other side within the last 5 bars; `n`
 * counts bars back to the first bar on the current side.
 */
const describeMacd = (macd, histogram) => {
  if (!macd || !Number.isFinite(macd.histogram)) return { tone: 'unknown', text: '—' };
  const side = Math.sign(macd.histogram);
  if (side === 0) return { tone: 'neutral', text: 'On signal line' };
  const series = Array.isArray(histogram) ? histogram : [];
  for (let j = 1; j < Math.min(series.length, 6); j++) {
    if (Math.sign(series[j]) === -side) {
      return side > 0
        ? { tone: 'bullish', text: `Bullish cross · ${j - 1}d ago` }
        : { tone: 'bearish', text: `Bearish cross · ${j - 1}d ago` };
    }
  }
  return side > 0
    ? { tone: 'bullish', text: 'Above signal line' }
    : { tone: 'bearish', text: 'Below signal line' };
};

// ============================
// Section A: Price Levels
// ============================
const PriceLevelsSection = ({ levels, price, onLevelHighlight }) => {
  const support = levels?.support || [];
  const resistance = levels?.resistance || [];

  const renderLevel = (level, idx) => {
    const isSupport = level.type === 'SUPPORT';
    const color = isSupport ? HOLO_COLORS.green : '#ff4757';
    const strengthColors = {
      STRONG: HOLO_COLORS.green,
      MODERATE: HOLO_COLORS.amber,
      WEAK: HOLO_COLORS.textSecondary,
    };

    return (
      <div
        key={`${level.type}-${idx}`}
        onClick={() => onLevelHighlight?.({ price: level.price, type: level.type })}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderRadius: '8px',
          background: `${color}08`,
          border: `1px solid ${color}20`,
          cursor: onLevelHighlight ? 'pointer' : 'default',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color,
            fontFamily: 'monospace',
          }}>
            ${level.price?.toFixed(2)}
          </span>
          <span style={{
            padding: '1px 5px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: '700',
            textTransform: 'uppercase',
            background: `${strengthColors[level.strength] || HOLO_COLORS.textSecondary}20`,
            color: strengthColors[level.strength] || HOLO_COLORS.textSecondary,
          }}>
            {level.strength}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            {formatDistance(level.distanceFromCurrent)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <CollapsibleSection title="Price Levels" icon={<Target size={14} color="#00d9ff" />} defaultOpen>
      {support.length === 0 && resistance.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px 0' }}>
          Insufficient data for level detection
        </div>
      ) : (
        <>
          {/* Current price marker */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 10px', marginBottom: '8px',
            borderRadius: '6px', background: 'rgba(0, 217, 255, 0.08)',
          }}>
            <span style={{ fontSize: '11px', color: '#00d9ff', fontWeight: '600' }}>Current</span>
            <span style={{ fontSize: '13px', color: '#00d9ff', fontWeight: '700', fontFamily: 'monospace' }}>
              ${price?.toFixed(2)}
            </span>
          </div>

          {/* Resistance levels (above current price) */}
          {resistance.slice(0, 2).reverse().map((l, i) => renderLevel({ ...l, type: 'RESISTANCE' }, i))}

          {/* Support levels (below current price) */}
          {support.slice(0, 2).map((l, i) => renderLevel({ ...l, type: 'SUPPORT' }, i))}
        </>
      )}
    </CollapsibleSection>
  );
};

// ============================
// Section B: Momentum Signals
// ============================
const MomentumSection = ({ indicators, price }) => {
  if (!indicators) {
    return (
      <CollapsibleSection title="Momentum Signals" icon={<Zap size={14} color={HOLO_COLORS.amber} />} defaultOpen>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px 0' }}>
          Loading indicators...
        </div>
      </CollapsibleSection>
    );
  }

  const { rsi, macd, macdHistogram, sma50 } = indicators;

  // RSI gauge — the zone word and the dot read the same one-decimal number
  // that is shown (BUILD_RULES §9). No reading → no number, zone or dot.
  const rsiText = Number.isFinite(rsi) ? rsi.toFixed(1) : null;
  const rsiShown = rsiText === null ? null : Number(rsiText);
  const rsiColor = rsiShown === null ? HOLO_COLORS.textSecondary
    : rsiShown >= 70 ? '#ff4757' : rsiShown <= 30 ? HOLO_COLORS.green : HOLO_COLORS.amber;
  const rsiLabel = rsiShown === null ? null
    : rsiShown >= 70 ? 'Overbought' : rsiShown <= 30 ? 'Oversold' : 'Neutral';

  // MACD signal
  const macdSignal = describeMacd(macd, macdHistogram);
  const macdColor = macdSignal.tone === 'bullish' ? HOLO_COLORS.green : macdSignal.tone === 'bearish' ? '#ff4757' : HOLO_COLORS.textSecondary;

  // vs 50-Day MA
  const ma50Diff = sma50 && price ? ((price - sma50) / sma50 * 100) : null;

  return (
    <CollapsibleSection title="Momentum Signals" icon={<Zap size={14} color={HOLO_COLORS.amber} />} defaultOpen>
      {/* RSI Gauge */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '4px',
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>RSI (14)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: rsiColor, fontFamily: 'monospace' }}>
              {rsiText ?? '—'}
            </span>
            {rsiLabel && (
              <span style={{
                padding: '1px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '600',
                background: `${rsiColor}20`, color: rsiColor,
              }}>
                {rsiLabel}
              </span>
            )}
          </div>
        </div>
        {/* RSI bar */}
        <div style={{
          height: '6px', borderRadius: '3px', position: 'relative',
          background: 'linear-gradient(90deg, #00ff88 0%, #f59e0b 50%, #ff4757 100%)',
          opacity: 0.3,
        }}>
          {rsiShown !== null && (
            <div data-testid="rsi-dot" style={{
              position: 'absolute',
              left: `${Math.min(Math.max(rsiShown, 0), 100)}%`,
              top: '-3px',
              width: '12px', height: '12px', borderRadius: '50%',
              background: rsiColor, border: `2px solid ${HOLO_COLORS.bgCard}`,
              transform: 'translateX(-50%)',
            }} />
          )}
        </div>
      </div>

      {/* MACD Signal */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>MACD Signal</span>
        <span style={{
          padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
          background: `${macdColor}15`, color: macdColor,
        }}>
          {macdSignal.tone === 'bullish'
            ? <><TrendingUp size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> {macdSignal.text}</>
            : macdSignal.tone === 'bearish'
            ? <><TrendingDown size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> {macdSignal.text}</>
            : macdSignal.text}
        </span>
      </div>

      {/* vs 50-Day MA */}
      {ma50Diff !== null && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>vs 50-Day MA</span>
          <span style={{
            fontSize: '12px', fontWeight: '600',
            color: ma50Diff >= 0 ? HOLO_COLORS.green : '#ff4757',
          }}>
            {ma50Diff >= 0 ? 'Above' : 'Below'} ({ma50Diff >= 0 ? '+' : ''}{ma50Diff.toFixed(1)}%)
          </span>
        </div>
      )}
    </CollapsibleSection>
  );
};

// ============================
// Section C: Volume & Range
// ============================
const DAY_MS = 24 * 60 * 60 * 1000;
const barTime = (c) => {
  const t = Date.parse(String(c?.date || c?.datetime || '').substring(0, 10));
  return Number.isFinite(t) ? t : null;
};

const VolumeRangeSection = ({ dailyData, price }) => {
  const stats = useMemo(() => {
    if (!dailyData || dailyData.length < 5) return null;
    const bars = [...dailyData].reverse(); // oldest-first

    // Average over the last 30 daily sessions (latest included); the label
    // says how many sessions when fewer exist.
    const volumes = bars.map(c => Number(c.volume) || 0).filter(v => v > 0);
    const latestVolume = volumes[volumes.length - 1] || 0;
    const avgWindow = volumes.slice(-30);
    const avgVolume = avgWindow.length > 0 ? avgWindow.reduce((a, b) => a + b, 0) / avgWindow.length : 0;
    const volumeRatio = avgVolume > 0 ? latestVolume / avgVolume : 1;
    const avgLabel = `${avgWindow.length}d Avg`;

    // Range over the trailing 52 weeks by date (~252 stock sessions, 364
    // crypto days). Called "52-week" only when the series covers all of it;
    // otherwise the label states the span the bars actually cover.
    const lastT = barTime(bars[bars.length - 1]);
    const firstT = barTime(bars[0]);
    const cutoff = lastT !== null ? lastT - 364 * DAY_MS : null;
    const fullYear = cutoff !== null && firstT !== null && firstT <= cutoff;
    const windowBars = fullYear ? bars.filter(c => barTime(c) > cutoff) : bars;
    let rangeLabel = '52-week range';
    if (!fullYear) {
      const spanDays = lastT !== null && firstT !== null ? (lastT - firstT) / DAY_MS : null;
      const months = spanDays === null ? null : Math.min(11, Math.round(spanDays / 30.44));
      rangeLabel = spanDays === null ? `Range (${bars.length} sessions)`
        : months >= 1 ? `Range (${months} mo)`
        : `Range (${Math.max(1, Math.round(spanDays / 7))} wk)`;
    }
    const highs = windowBars.map(c => Number(c.high)).filter(Number.isFinite);
    const lows = windowBars.map(c => Number(c.low)).filter(Number.isFinite);
    const high52w = Math.max(...highs);
    const low52w = Math.min(...lows);
    const rangePercent = high52w > low52w ? ((price - low52w) / (high52w - low52w)) * 100 : 50;

    return { latestVolume, avgVolume, volumeRatio, avgLabel, high52w, low52w, rangePercent, rangeLabel };
  }, [dailyData, price]);

  const formatVolume = (v) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return v.toFixed(0);
  };

  return (
    <CollapsibleSection title="Volume & Range" icon={<BarChart3 size={14} color={HOLO_COLORS.purple} />} defaultOpen>
      {!stats ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px 0' }}>
          Insufficient data
        </div>
      ) : (
        <>
          {/* Volume comparison bars */}
          <div style={{ marginBottom: '16px' }}>
            <VolumeBar
              label="Today"
              value={stats.latestVolume}
              maxValue={Math.max(stats.latestVolume, stats.avgVolume)}
              formatted={formatVolume(stats.latestVolume)}
              ratio={stats.volumeRatio}
            />
            <VolumeBar
              label={stats.avgLabel}
              value={stats.avgVolume}
              maxValue={Math.max(stats.latestVolume, stats.avgVolume)}
              formatted={formatVolume(stats.avgVolume)}
              ratio={1}
            />
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              {stats.volumeRatio.toFixed(1)}x average volume
            </div>
          </div>

          {/* 52-Week Range (or the span the daily bars cover) */}
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
              {stats.rangeLabel}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px',
            }}>
              <span>${stats.low52w?.toFixed(2)}</span>
              <span>${stats.high52w?.toFixed(2)}</span>
            </div>
            {/* Range bar */}
            <div style={{
              height: '8px', borderRadius: '4px', position: 'relative',
              background: 'linear-gradient(90deg, #ff4757 0%, #f59e0b 50%, #00ff88 100%)',
              opacity: 0.4,
            }}>
              <div style={{
                position: 'absolute',
                left: `${Math.min(Math.max(stats.rangePercent, 0), 100)}%`,
                top: '-2px',
                width: '12px', height: '12px', borderRadius: '50%',
                background: HOLO_COLORS.primary, border: `2px solid ${HOLO_COLORS.bgCard}`,
                transform: 'translateX(-50%)',
              }} />
            </div>
            <div style={{
              fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', textAlign: 'center',
            }}>
              {stats.rangePercent.toFixed(0)}% through range
            </div>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
};

const VolumeBar = ({ label, value, maxValue, formatted, ratio }) => {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const barColor = ratio > 2 ? 'rgba(255, 165, 0, 0.4)'
    : ratio > 1.3 ? 'rgba(0, 217, 255, 0.4)'
    : 'rgba(255, 255, 255, 0.3)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <span style={{
        fontSize: '11px', color: 'rgba(255,255,255,0.5)',
        width: '50px', flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: '14px', borderRadius: '4px',
        background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: '4px',
          background: barColor, transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{
        fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace',
        width: '45px', textAlign: 'right', flexShrink: 0,
      }}>
        {formatted}
      </span>
    </div>
  );
};

// ============================
// Section D: Sector Context
// ============================
const SectorContextSection = ({ asset }) => {
  const [sectorData, setSectorData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Find sector for this stock
  const sectorId = useMemo(() => {
    if (!asset?.symbol) return null;
    const sym = asset.symbol.toUpperCase();

    // Check if crypto
    if (asset.isCrypto || asset.category === 'crypto') return 'CRYPTO';
    if (CRYPTO_SECTOR.topHoldings.includes(sym)) return 'CRYPTO';

    // Search SECTORS for this stock
    for (const [id, sector] of Object.entries(SECTORS)) {
      if (sector.topHoldings.includes(sym)) return id;
    }
    return null;
  }, [asset]);

  // Lazy load sector data when section expands
  useEffect(() => {
    if (!expanded || !sectorId || sectorId === 'CRYPTO' || sectorData) return;

    setLoading(true);
    getQuickSectorSummary(sectorId)
      .then(data => setSectorData(data))
      .catch(() => setSectorData(null))
      .finally(() => setLoading(false));
  }, [expanded, sectorId, sectorData]);

  const isCrypto = sectorId === 'CRYPTO';

  return (
    <CollapsibleSection
      title="Sector Context"
      icon={<Globe size={14} color="#00d9ff" />}
      defaultOpen={false}
    >
      {/* Detect when section opens to trigger lazy fetch */}
      <SectorExpandDetector onExpand={() => setExpanded(true)} />

      {isCrypto ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px 0' }}>
          Sector data not available for crypto assets
        </div>
      ) : !sectorId ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px 0' }}>
          Sector not identified for {asset?.symbol}
        </div>
      ) : loading ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px 0' }}>
          Loading sector data...
        </div>
      ) : sectorData ? (
        <div style={{
          padding: '10px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          {/* Sector name + ETF */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: HOLO_COLORS.textPrimary }}>
              {sectorData.emoji} {sectorData.name} ({sectorId})
            </span>
            {sectorData.trend && (
              <QuadrantBadge quadrant={
                sectorData.trend.label === 'Uptrend' ? 'LEADING'
                  : sectorData.trend.label === 'Downtrend' ? 'LAGGING'
                  : sectorData.trend.label === 'Weakening' ? 'WEAKENING'
                  : 'NEUTRAL'
              } />
            )}
          </div>

          {/* Key metrics */}
          <div style={{
            display: 'flex', gap: '12px',
          }}>
            <div>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>1M Perf</span>
              <div style={{
                fontSize: '13px', fontWeight: '700', fontFamily: 'monospace',
                color: (sectorData.performance1M || 0) >= 0 ? HOLO_COLORS.green : '#ff4757',
              }}>
                {(sectorData.performance1M || 0) >= 0 ? '+' : ''}{(sectorData.performance1M || 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px 0' }}>
          Failed to load sector data
        </div>
      )}
    </CollapsibleSection>
  );
};

// Helper: detects when CollapsibleSection renders this (meaning section expanded)
const SectorExpandDetector = ({ onExpand }) => {
  useEffect(() => {
    onExpand();
  }, [onExpand]);
  return null;
};

export default TechnicalTabV2;
