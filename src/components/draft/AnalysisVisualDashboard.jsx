import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import { STOCK_DATA, TICKERS } from '../../data/stockIntelligenceData';
import { formatLargeNumber } from '../../utils/formatters';
import {
  parseQuarterlyData,
  parseRevenueSegments,
  parseRisks,
  parseFinancialHealth,
} from '../../utils/knowledgePackageParser';
import LatestEarningsReport from '../Research/LatestEarningsReport';
import FundamentalNews from '../Research/FundamentalNews';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUB_TABS = [
  { key: 'growth', label: 'Growth', color: '#00d9ff' },
  { key: 'risks', label: 'Risks', color: '#f85149' },
  { key: 'health', label: 'Health', color: '#10b981' },
  { key: 'earnings', label: 'Earnings', color: '#8b5cf6' },
  { key: 'news', label: 'News', color: '#3b82f6' },
];

const CHART_COLORS = ['#00d9ff', '#10b981', '#a78bfa', '#f59e0b', '#f85149'];

const TOOLTIP_STYLE = {
  background: '#161b22',
  border: '1px solid #21262d',
  borderRadius: 8,
  fontSize: 11,
  color: '#e6edf3',
};

const AXIS_TICK = { fontSize: 9, fill: '#6e7681' };

const RISK_CAT_COLORS = {
  business: '#f59e0b',
  market: '#00d9ff',
  regulatory: '#f85149',
  technical: '#a78bfa',
  geopolitical: '#10b981',
};

// ---------------------------------------------------------------------------
// Sub-tab pill selector
// ---------------------------------------------------------------------------

function SubTabSelector({ activeTab, onTabChange }) {
  return (
    <div style={{
      display: 'flex', gap: '6px', marginBottom: '12px',
      overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none', msOverflowStyle: 'none',
      paddingBottom: '2px',
    }}>
      {SUB_TABS.map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: '5px 14px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: isActive ? '700' : '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: isActive ? `1.5px solid ${tab.color}` : '1.5px solid transparent',
              background: isActive ? `${tab.color}20` : 'rgba(255, 255, 255, 0.04)',
              color: isActive ? tab.color : 'rgba(255, 255, 255, 0.5)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Card (reusable)
// ---------------------------------------------------------------------------

function MetricCard({ label, value, accentColor, isMobile }) {
  return (
    <div style={{
      padding: isMobile ? '8px' : '10px', borderRadius: '8px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderLeft: `3px solid ${accentColor || '#00d9ff'}`,
    }}>
      <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '3px' }}>{label}</div>
      <div style={{
        fontSize: '14px', fontWeight: '600', color: '#e6edf3',
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insight line
// ---------------------------------------------------------------------------

function InsightLine({ label, text, color }) {
  if (!text) return null;
  return (
    <div style={{
      background: '#1c2333', borderRadius: '6px', padding: '6px 10px',
      marginTop: '8px', fontSize: '11px', lineHeight: '1.4',
    }}>
      <span style={{ color: color || '#00d9ff', fontWeight: '600', marginRight: '6px' }}>
        {label}
      </span>
      <span style={{ color: '#8b949e' }}>{text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Analysis Components
// ---------------------------------------------------------------------------

const SHIMMER_KEYFRAMES = `@keyframes avd-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;

const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
  backgroundSize: '200% 100%',
  animation: 'avd-shimmer 1.5s infinite',
  borderRadius: '6px',
};

function AnalysisSkeleton() {
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ height: '10px', width: '30%', marginBottom: '10px', ...shimmerStyle }} />
      <div style={{ height: '12px', width: '95%', marginBottom: '6px', ...shimmerStyle }} />
      <div style={{ height: '12px', width: '80%', marginBottom: '6px', ...shimmerStyle }} />
      <div style={{ height: '12px', width: '88%', marginBottom: '6px', ...shimmerStyle }} />
      <div style={{ height: '12px', width: '70%', marginBottom: '6px', ...shimmerStyle }} />
      <style>{SHIMMER_KEYFRAMES}</style>
    </div>
  );
}

function parseBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} style={{ fontWeight: 600, color: '#ffffff' }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      const content = line.replace(/^[-•]\s*/, '');
      return (
        <div key={i} style={{ paddingLeft: '12px', marginBottom: '8px' }}>
          <span style={{ color: '#00d9ff', marginRight: '8px' }}>•</span>
          {parseBold(content)}
        </div>
      );
    }
    if (line.trim()) {
      return <div key={i} style={{ marginBottom: '8px' }}>{parseBold(line)}</div>;
    }
    return null;
  });
}

function AIAnalysisSection({ analysis, collapsed, onToggle }) {
  if (collapsed != null) {
    // Collapsible mode (for Tier 1 supported tabs)
    return (
      <div style={{ marginTop: '12px' }}>
        <button
          onClick={onToggle}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '11px', color: '#00d9ff', fontWeight: 600,
            padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          {collapsed ? 'Show AI Summary \u25BE' : 'Hide AI Summary \u25B4'}
        </button>
        {!collapsed && (
          <div style={{
            padding: '12px', backgroundColor: 'rgba(0, 217, 255, 0.03)',
            borderRadius: '10px', border: '1px solid rgba(0, 217, 255, 0.1)',
            marginTop: '4px',
          }}>
            <div style={{
              fontSize: '10px', color: '#00d9ff', fontWeight: 600,
              marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              AI Analysis
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#e0e0e0' }}>
              {renderMarkdown(analysis)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded mode (for Tier 2 unsupported tabs)
  return (
    <div style={{
      padding: '12px', backgroundColor: 'rgba(0, 217, 255, 0.03)',
      borderRadius: '10px', border: '1px solid rgba(0, 217, 255, 0.1)',
      marginTop: '12px',
    }}>
      <div style={{
        fontSize: '10px', color: '#00d9ff', fontWeight: 600,
        marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        AI Analysis
      </div>
      <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#e0e0e0' }}>
        {renderMarkdown(analysis)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GROWTH TAB
// ---------------------------------------------------------------------------

function GrowthTabSupported({ parsedData, isMobile, aiAnalysis, analysisLoading }) {
  const [aiCollapsed, setAiCollapsed] = useState(true);
  const { quarterly, revenue } = parsedData;

  // Build revenue chart data from quarterly table
  const revenueChartData = useMemo(() => {
    if (!quarterly?.quarters?.length) return [];
    const totalRev = quarterly.metrics['Total Revenue ($M)'];
    if (!totalRev) return [];
    return quarterly.quarters.map((q, i) => ({
      quarter: q,
      revenue: totalRev[i],
    })).filter(d => d.revenue != null);
  }, [quarterly]);

  // Find segment revenue keys (rows with "Revenue" in name, excluding Total/YoY)
  const segmentKeys = useMemo(() => {
    if (!quarterly?.metrics) return [];
    return Object.keys(quarterly.metrics).filter(k =>
      k.includes('Revenue') &&
      !k.startsWith('Total') &&
      !k.includes('YoY') &&
      k.includes('($')
    ).slice(0, 3); // Max 3 segments
  }, [quarterly]);

  // Build segment bar chart data
  const segmentChartData = useMemo(() => {
    if (!segmentKeys.length || !quarterly?.quarters) return [];
    return quarterly.quarters.map((q, i) => {
      const entry = { quarter: q };
      for (const key of segmentKeys) {
        // Use short key name for display
        const shortName = key.replace(/\s*\(\$[MB]\)\s*/g, '').trim();
        entry[shortName] = quarterly.metrics[key]?.[i] ?? null;
      }
      return entry;
    });
  }, [quarterly, segmentKeys]);

  const segmentDisplayNames = segmentKeys.map(k =>
    k.replace(/\s*\(\$[MB]\)\s*/g, '').trim()
  );

  // YoY growth data
  const growthChartData = useMemo(() => {
    if (!quarterly?.metrics) return [];
    const growthKey = Object.keys(quarterly.metrics).find(k =>
      k.toLowerCase().includes('yoy') && k.toLowerCase().includes('revenue') && !k.includes('AWS')
    );
    if (!growthKey) return [];
    return quarterly.quarters.map((q, i) => ({
      quarter: q,
      growth: quarterly.metrics[growthKey]?.[i],
    })).filter(d => d.growth != null);
  }, [quarterly]);

  // Summary metrics
  const latestRevenue = revenueChartData.length > 0
    ? revenueChartData[revenueChartData.length - 1].revenue
    : null;
  const latestGrowth = growthChartData.length > 0
    ? growthChartData[growthChartData.length - 1].growth
    : null;

  const chartHeight = isMobile ? 160 : 200;

  return (
    <div>
      {/* Segment revenue bar chart */}
      {segmentChartData.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Segment Revenue Trend
          </div>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={segmentChartData} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="quarter" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={AXIS_TICK} axisLine={false} tickLine={false} width={40}
                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}B` : `$${v}M`}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [value != null ? `$${value.toLocaleString()}M` : '—', name]}
              />
              {segmentDisplayNames.map((name, idx) => (
                <Bar key={name} dataKey={name} fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* YoY Growth rate bars */}
      {growthChartData.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            YoY Revenue Growth
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 100 : 120}>
            <BarChart data={growthChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="quarter" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={30}
                tickFormatter={v => `${v}%`} />
              <ReferenceLine y={0} stroke="#21262d" />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [`${value}%`, 'YoY Growth']} />
              <Bar dataKey="growth" radius={[3, 3, 0, 0]}>
                {growthChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.growth >= 0 ? '#10b981' : '#f85149'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '8px' }}>
        {latestRevenue != null && (
          <MetricCard label="Latest Quarter Revenue"
            value={latestRevenue >= 1000 ? `$${(latestRevenue / 1000).toFixed(1)}B` : `$${latestRevenue}M`}
            accentColor="#00d9ff" isMobile={isMobile} />
        )}
        {latestGrowth != null && (
          <MetricCard label="YoY Growth"
            value={`${latestGrowth >= 0 ? '+' : ''}${latestGrowth}%`}
            accentColor={latestGrowth >= 0 ? '#10b981' : '#f85149'} isMobile={isMobile} />
        )}
        {revenue?.segments?.[0] && (
          <MetricCard label={`${revenue.segments[0].name} Growth`}
            value={revenue.segments[0].growth != null ? `${revenue.segments[0].growth >= 0 ? '+' : ''}${revenue.segments[0].growth}%` : '—'}
            accentColor="#a78bfa" isMobile={isMobile} />
        )}
      </div>
      {analysisLoading ? <AnalysisSkeleton /> : aiAnalysis ? (
        <AIAnalysisSection analysis={aiAnalysis} collapsed={aiCollapsed} onToggle={() => setAiCollapsed(c => !c)} />
      ) : null}
    </div>
  );
}

function GrowthTabUnsupported({ stockData, isMobile, aiAnalysis, analysisLoading }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <MetricCard label="Market Cap"
          value={stockData?.marketCap ? formatLargeNumber(stockData.marketCap, 1) : null}
          accentColor="#3b82f6" isMobile={isMobile} />
        <MetricCard label="P/E Ratio"
          value={stockData?.peRatio != null ? `${Number(stockData.peRatio).toFixed(1)}x` : null}
          accentColor="#8b5cf6" isMobile={isMobile} />
        <MetricCard label="Rev Growth"
          value={stockData?.revenueGrowthYOY != null
            ? `${(stockData.revenueGrowthYOY * 100) >= 0 ? '+' : ''}${(stockData.revenueGrowthYOY * 100).toFixed(0)}%`
            : null}
          accentColor="#10b981" isMobile={isMobile} />
        <MetricCard label="Profit Margin"
          value={stockData?.profitMargin != null
            ? `${(stockData.profitMargin * 100).toFixed(0)}%`
            : null}
          accentColor="#f59e0b" isMobile={isMobile} />
      </div>
      {analysisLoading ? <AnalysisSkeleton /> : aiAnalysis ? (
        <AIAnalysisSection analysis={aiAnalysis} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RISKS TAB
// ---------------------------------------------------------------------------

function RiskBubbleCanvas({ risks, isMobile }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !risks?.length) return;

    const width = container.clientWidth;
    const height = isMobile ? 180 : 220;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const pad = { top: 15, right: 15, bottom: 25, left: 30 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const x = pad.left + (i / 4) * plotW;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
      const y = pad.top + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#6e7681';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Low', pad.left + 15, height - 4);
    ctx.fillText('PROBABILITY →', pad.left + plotW / 2, height - 4);
    ctx.fillText('High', pad.left + plotW - 15, height - 4);

    ctx.save();
    ctx.translate(8, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('IMPACT →', 0, 0);
    ctx.restore();

    // Draw bubbles
    risks.forEach((risk, i) => {
      const x = pad.left + risk.probability * plotW;
      const y = pad.top + plotH - risk.impact * plotH;
      const severity = (risk.impact + risk.probability) / 2;
      const radius = 10 + severity * 16;
      const color = RISK_CAT_COLORS[risk.category] || '#f59e0b';

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + severity * 10;

      // Fill
      ctx.globalAlpha = 0.2 + severity * 0.3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.globalAlpha = 0.6 + severity * 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Reset
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = '#e6edf3';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y);
    });
  }, [risks, isMobile]);

  useEffect(() => {
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}

function RisksTabSupported({ parsedData, isMobile, aiAnalysis, analysisLoading }) {
  const [aiCollapsed, setAiCollapsed] = useState(true);
  const { risks: riskData } = parsedData;
  const risks = riskData?.risks || [];

  if (risks.length === 0) {
    return <div style={{ color: '#6e7681', fontSize: '12px', padding: '16px 0' }}>No risk data available.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Risk Matrix (Probability x Impact)
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.06)', padding: '8px', marginBottom: '12px',
      }}>
        <RiskBubbleCanvas risks={risks} isMobile={isMobile} />
      </div>

      {/* Risk legend */}
      <div>
        {risks.slice(0, 5).map((risk, i) => {
          const color = RISK_CAT_COLORS[risk.category] || '#f59e0b';
          return (
            <div key={i} style={{
              display: 'flex', gap: '8px', padding: '6px 0',
              borderBottom: i < Math.min(risks.length, 5) - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: `${color}25`, border: `1px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: '700', color, flexShrink: 0,
              }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#e6edf3' }}>
                  {risk.name}
                </div>
                <div style={{
                  fontSize: '10px', color: '#8b949e', marginTop: '2px',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {risk.description}
                </div>
                <span style={{
                  display: 'inline-block', marginTop: '3px',
                  fontSize: '9px', fontWeight: '600', color,
                  background: `${color}15`, padding: '1px 6px', borderRadius: '4px',
                  textTransform: 'uppercase',
                }}>
                  {risk.category}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {analysisLoading ? <AnalysisSkeleton /> : aiAnalysis ? (
        <AIAnalysisSection analysis={aiAnalysis} collapsed={aiCollapsed} onToggle={() => setAiCollapsed(c => !c)} />
      ) : null}
    </div>
  );
}

function RisksTabUnsupported({ stockData, isMobile, aiAnalysis, analysisLoading }) {
  const risks = [];
  if (stockData?.peRatio != null && stockData.peRatio > 40) {
    risks.push({ name: 'Valuation Risk', desc: 'P/E ratio above 40x indicates premium valuation', color: '#f59e0b' });
  }
  if (stockData?.profitMargin != null && stockData.profitMargin < 0) {
    risks.push({ name: 'Profitability Risk', desc: 'Negative profit margin indicates unprofitable operations', color: '#f85149' });
  }
  if (stockData?.marketCap != null && stockData.marketCap < 10e9) {
    risks.push({ name: 'Volatility Risk', desc: 'Smaller market cap stocks tend to have higher volatility', color: '#a78bfa' });
  }
  if (risks.length === 0) {
    risks.push({ name: 'Standard Market Risk', desc: 'All equities carry market and sector risk', color: '#8b949e' });
  }

  return (
    <div>
      {risks.map((r, i) => (
        <div key={i} style={{
          padding: '10px', borderRadius: '8px', marginBottom: '8px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderLeft: `3px solid ${r.color}`,
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#e6edf3' }}>{r.name}</div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>{r.desc}</div>
        </div>
      ))}
      {analysisLoading ? <AnalysisSkeleton /> : aiAnalysis ? (
        <AIAnalysisSection analysis={aiAnalysis} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HEALTH TAB
// ---------------------------------------------------------------------------

function GaugeBar({ label, value, maxValue, unit, color, isMobile }) {
  if (value == null) return null;
  const pct = maxValue > 0 ? Math.min((Math.abs(value) / maxValue) * 100, 100) : 0;
  const displayVal = unit === '%' ? `${value.toFixed(1)}%`
    : value >= 1000 ? `$${(value / 1000).toFixed(1)}B`
    : `$${value.toFixed(0)}M`;

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '10px', color: '#8b949e' }}>{label}</span>
        <span style={{
          fontSize: '11px', fontWeight: '600', color: '#e6edf3',
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        }}>{displayVal}</span>
      </div>
      <div style={{
        height: '6px', borderRadius: '3px',
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '3px',
          background: color || '#00d9ff', transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

function HealthTabSupported({ parsedData, isMobile, aiAnalysis, analysisLoading }) {
  const [aiCollapsed, setAiCollapsed] = useState(true);
  const { quarterly, health } = parsedData;

  // Build margin trend chart from quarterly data
  const marginKeys = useMemo(() => {
    if (!quarterly?.metrics) return [];
    return Object.keys(quarterly.metrics).filter(k =>
      k.toLowerCase().includes('margin')
    ).slice(0, 3);
  }, [quarterly]);

  const marginChartData = useMemo(() => {
    if (!marginKeys.length || !quarterly?.quarters) return [];
    return quarterly.quarters.map((q, i) => {
      const entry = { quarter: q };
      for (const key of marginKeys) {
        const shortName = key.replace(/\s*\(%\)\s*/g, '').trim();
        entry[shortName] = quarterly.metrics[key]?.[i] ?? null;
      }
      return entry;
    });
  }, [quarterly, marginKeys]);

  const marginDisplayNames = marginKeys.map(k =>
    k.replace(/\s*\(%\)\s*/g, '').trim()
  );

  const chartHeight = isMobile ? 160 : 200;

  return (
    <div>
      {/* Margin trend area chart */}
      {marginChartData.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Margin Trends (8 Quarters)
          </div>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={marginChartData}>
              <defs>
                {marginDisplayNames.map((name, idx) => (
                  <linearGradient key={name} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="quarter" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={35}
                tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [value != null ? `${value}%` : '—', name]} />
              {marginDisplayNames.map((name, idx) => (
                <Area key={name} type="monotone" dataKey={name}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  fill={`url(#grad-${idx})`}
                  strokeWidth={2} dot={false} connectNulls />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cash flow and margin gauges */}
      <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Financial Health Gauges
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.06)', padding: '10px',
      }}>
        {health?.grossMargin != null && (
          <GaugeBar label="Gross Margin" value={health.grossMargin} maxValue={100}
            unit="%" color="#10b981" isMobile={isMobile} />
        )}
        {health?.opMargin != null && (
          <GaugeBar label="Operating Margin" value={health.opMargin} maxValue={100}
            unit="%" color="#00d9ff" isMobile={isMobile} />
        )}
        {health?.ocf != null && (
          <GaugeBar label="Operating Cash Flow" value={health.ocf}
            maxValue={Math.max(health.ocf, health.fcf || 0, health.capex || 0) * 1.2}
            unit="$" color="#10b981" isMobile={isMobile} />
        )}
        {health?.fcf != null && (
          <GaugeBar label="Free Cash Flow" value={health.fcf}
            maxValue={Math.max(health.ocf || health.fcf, health.fcf) * 1.2}
            unit="$" color="#00d9ff" isMobile={isMobile} />
        )}
        {health?.capex != null && (
          <GaugeBar label="Capital Expenditure" value={health.capex}
            maxValue={Math.max(health.ocf || health.capex, health.capex) * 1.2}
            unit="$" color="#f59e0b" isMobile={isMobile} />
        )}
        {health?.rdSpending != null && (
          <GaugeBar label={`R&D Spending${health.rdPctRevenue ? ` (${health.rdPctRevenue}% of Rev)` : ''}`}
            value={health.rdSpending}
            maxValue={Math.max(health.ocf || health.rdSpending * 5, health.rdSpending * 5)}
            unit="$" color="#a78bfa" isMobile={isMobile} />
        )}
      </div>
      {analysisLoading ? <AnalysisSkeleton /> : aiAnalysis ? (
        <AIAnalysisSection analysis={aiAnalysis} collapsed={aiCollapsed} onToggle={() => setAiCollapsed(c => !c)} />
      ) : null}
    </div>
  );
}

function HealthTabUnsupported({ stockData, isMobile, aiAnalysis, analysisLoading }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <MetricCard label="Profit Margin"
          value={stockData?.profitMargin != null ? `${(stockData.profitMargin * 100).toFixed(1)}%` : null}
          accentColor="#10b981" isMobile={isMobile} />
        <MetricCard label="Market Cap"
          value={stockData?.marketCap ? formatLargeNumber(stockData.marketCap, 1) : null}
          accentColor="#00d9ff" isMobile={isMobile} />
      </div>
      {analysisLoading ? <AnalysisSkeleton /> : aiAnalysis ? (
        <AIAnalysisSection analysis={aiAnalysis} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const AnalysisVisualDashboard = ({ symbol, stockData, isMobile }) => {
  const [activeSubTab, setActiveSubTab] = useState('growth');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const cacheRef = useRef(new Map());
  const isSupported = TICKERS.includes(symbol);

  // Fetch AI analysis when symbol changes
  useEffect(() => {
    if (!symbol) return;

    const cached = cacheRef.current.get(symbol);
    if (cached) {
      setAiAnalysis(cached);
      setAnalysisLoading(false);
      return;
    }

    setAiAnalysis(null);
    setAnalysisLoading(true);

    fetch(`/api/stocks/analysis?symbol=${encodeURIComponent(symbol)}&mode=quick`)
      .then(r => r.json())
      .then(data => {
        if (data.analysis) {
          cacheRef.current.set(symbol, data.analysis);
          setAiAnalysis(data.analysis);
        }
      })
      .catch(() => {})
      .finally(() => setAnalysisLoading(false));
  }, [symbol]);

  const parsedData = useMemo(() => {
    if (!isSupported) return null;
    const kp = STOCK_DATA[symbol]?.knowledgePackage;
    if (!kp) return null;

    return {
      quarterly: parseQuarterlyData(kp),
      revenue: parseRevenueSegments(kp),
      risks: parseRisks(kp),
      health: parseFinancialHealth(kp),
    };
  }, [symbol, isSupported]);

  const aiProps = { aiAnalysis, analysisLoading };

  return (
    <div>
      <SubTabSelector activeTab={activeSubTab} onTabChange={setActiveSubTab} />

      {activeSubTab === 'growth' && (
        isSupported && parsedData
          ? <GrowthTabSupported parsedData={parsedData} isMobile={isMobile} {...aiProps} />
          : <GrowthTabUnsupported stockData={stockData} isMobile={isMobile} {...aiProps} />
      )}

      {activeSubTab === 'risks' && (
        isSupported && parsedData
          ? <RisksTabSupported parsedData={parsedData} isMobile={isMobile} {...aiProps} />
          : <RisksTabUnsupported stockData={stockData} isMobile={isMobile} {...aiProps} />
      )}

      {activeSubTab === 'health' && (
        isSupported && parsedData
          ? <HealthTabSupported parsedData={parsedData} isMobile={isMobile} {...aiProps} />
          : <HealthTabUnsupported stockData={stockData} isMobile={isMobile} {...aiProps} />
      )}

      {activeSubTab === 'earnings' && (
        <LatestEarningsReport symbol={symbol} />
      )}

      {activeSubTab === 'news' && (
        <FundamentalNews symbol={symbol} />
      )}
    </div>
  );
};

export default AnalysisVisualDashboard;
