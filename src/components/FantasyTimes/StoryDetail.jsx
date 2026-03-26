// src/components/FantasyTimes/StoryDetail.jsx
// Full-page story detail view — navigated via screen === 'storyDetail'.

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { ArrowLeft, BarChart3, ArrowRight } from 'lucide-react';
import { REPORTER_COLORS, SENTIMENT_COLORS, FEED_TOKENS, getReporterGlow } from '../../constants/reporterTheme';
import ReporterAvatar from './ReporterAvatar';
import StoryVisualSafe from './StoryVisualSafe';
import { findStock } from '../../data/assets';
import { isIndex, INDEX_REGISTRY } from '../../constants/indexRegistry';

const AssetResearchModal = lazy(() => import('../draft/AssetResearchModal'));

// ── Tier color from composite score ──────────────────────────────
function tierColor(score) {
  if (score >= 80) return '#ffd700';
  if (score >= 60) return '#00d9ff';
  if (score >= 40) return '#8b949e';
  if (score >= 20) return '#f59e0b';
  return '#ef4444';
}

function tierLabel(score) {
  if (score >= 80) return 'Sector Leader';
  if (score >= 60) return 'Above Average';
  if (score >= 40) return 'In-Line';
  if (score >= 20) return 'Below Average';
  return 'Lags Sector';
}

// ── Simple rank data cache (5-min TTL) ───────────────────────────
const rankCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const entry = rankCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  rankCache.set(key, { data, ts: Date.now() });
}

// ── Pillar bar component ─────────────────────────────────────────
const PILLAR_LABELS = {
  growth: 'Growth',
  profitability: 'Profit',
  efficiency: 'Efficiency',
  valuation: 'Value',
  capitalEff: 'Cap Eff',
  momentum: 'Momentum',
  sentiment: 'Sentiment',
};

function PillarBar({ name, percentile }) {
  const color = tierColor(percentile);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <div style={{ width: '70px', fontSize: '11px', color: '#8b949e', flexShrink: 0 }}>
        {PILLAR_LABELS[name] || name}
      </div>
      <div style={{
        flex: 1,
        height: '6px',
        backgroundColor: '#21262d',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentile}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '3px',
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ width: '28px', fontSize: '11px', color, fontWeight: 600, textAlign: 'right' }}>
        {percentile}
      </div>
    </div>
  );
}

// ── Stock Rank Card (Alex/Doug) ──────────────────────────────────
function StockRankCard({ ticker }) {
  const [data, setData] = useState(getCached(`stock-${ticker}`));
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch(`/api/stocks/peer-rankings?symbol=${ticker}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.success) return;
        setCache(`stock-${ticker}`, res.data);
        setData(res.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div style={{
        background: FEED_TOKENS.bgCard,
        borderRadius: '10px',
        padding: '16px',
        marginTop: '16px',
        textAlign: 'center',
        color: '#6e7681',
        fontSize: '12px',
      }}>
        Loading rankings...
      </div>
    );
  }
  if (!data) return null;

  const score = data.compositeScore;
  const color = tierColor(score);
  const pillars = data.pillars || {};

  return (
    <div style={{
      background: FEED_TOKENS.bgCard,
      border: `1px solid ${FEED_TOKENS.bgCardBorder}`,
      borderRadius: '10px',
      padding: '16px',
      marginTop: '16px',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: '#6e7681',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '12px',
      }}>
        FantasyTrades Ranking
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ color: '#e6edf3', fontSize: '18px', fontWeight: 700 }}>{data.ticker}</span>
          <span style={{ color: '#8b949e', fontSize: '13px' }}>
            #{data.compositeRank} of {data.totalPeers}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#8b949e', fontSize: '12px' }}>Overall:</span>
          <span style={{ color, fontSize: '16px', fontWeight: 700 }}>{score}/100</span>
        </div>
      </div>

      <div style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: `${color}18`,
        color,
        fontSize: '11px',
        fontWeight: 600,
        marginBottom: '12px',
      }}>
        {tierLabel(score)}
      </div>

      {Object.entries(pillars).map(([key, pillar]) => (
        <PillarBar key={key} name={key} percentile={pillar.percentile} />
      ))}
    </div>
  );
}

// ── Sector Rank Card (Kim) ───────────────────────────────────────
function SectorRankCard({ topSectors }) {
  const [data, setData] = useState(getCached('sector-all'));
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch('/api/stocks/sector-rankings?symbol=SPY')
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.success) return;
        setCache('sector-all', res.data);
        setData(res.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{
        background: FEED_TOKENS.bgCard,
        borderRadius: '10px',
        padding: '16px',
        marginTop: '16px',
        textAlign: 'center',
        color: '#6e7681',
        fontSize: '12px',
      }}>
        Loading sector rankings...
      </div>
    );
  }
  if (!data?.sectors) return null;

  const topSet = new Set((topSectors || []).map((s) => s.toUpperCase()));
  const sorted = [...data.sectors].sort((a, b) => {
    const aMatch = topSet.has(a.name?.toUpperCase()) || topSet.has(a.etf?.toUpperCase()) ? 1 : 0;
    const bMatch = topSet.has(b.name?.toUpperCase()) || topSet.has(b.etf?.toUpperCase()) ? 1 : 0;
    if (bMatch !== aMatch) return bMatch - aMatch;
    return a.rank - b.rank;
  });
  const displayed = sorted.slice(0, 3);

  return (
    <div style={{
      background: FEED_TOKENS.bgCard,
      border: `1px solid ${FEED_TOKENS.bgCardBorder}`,
      borderRadius: '10px',
      padding: '16px',
      marginTop: '16px',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: '#6e7681',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '12px',
      }}>
        Sector Ranking
      </div>

      {displayed.map((sector) => {
        const color = tierColor(sector.compositeScore);
        const breadthVal = sector.breadth?.value;
        const breadthLabel = breadthVal >= 60 ? 'Healthy' : breadthVal >= 40 ? 'Mixed' : 'Weak';
        const breadthColor = breadthVal >= 60 ? '#00ff88' : breadthVal >= 40 ? '#f59e0b' : '#ff3366';
        const isHighlight = topSet.has(sector.name?.toUpperCase()) || topSet.has(sector.etf?.toUpperCase());

        return (
          <div
            key={sector.sectorId || sector.etf}
            style={{
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: isHighlight ? `${sector.color || color}0D` : 'transparent',
              border: isHighlight ? `1px solid ${sector.color || color}33` : '1px solid transparent',
              marginBottom: '8px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <div>
                <span style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600 }}>
                  {sector.name}
                </span>
                <span style={{ color: '#6e7681', fontSize: '12px', marginLeft: '6px' }}>
                  ({sector.etf})
                </span>
              </div>
              <span style={{ color, fontSize: '14px', fontWeight: 700 }}>
                {sector.compositeScore}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
              {sector.tier && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: `${color}18`,
                  color,
                  fontWeight: 600,
                }}>
                  {sector.tier.label}
                </span>
              )}
              {breadthVal != null && (
                <span style={{ color: breadthColor }}>
                  Breadth: {breadthVal}% ({breadthLabel})
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Format timestamp ─────────────────────────────────────────────
function formatTimestamp(publishedAt) {
  if (!publishedAt) return '';
  const ms = publishedAt._seconds
    ? publishedAt._seconds * 1000
    : new Date(publishedAt).getTime();
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Estimate read time ───────────────────────────────────────────
function estimateReadTime(body) {
  if (!body) return '';
  const words = body.split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

// ── Markdown renderer with pull-quote support ────────────────────
function renderMarkdownWithPullQuote(text, reporterName, reporterBeat, reporterColor, explicitPullquote) {
  if (!text) return '';

  let pullQuoteHtml = '';
  let processedText = text;
  processedText = processedText.replace(/EARNINGSGAME/g, 'EARNINGS ANALYSIS');
  processedText = processedText.replace(/WATCHLIST/g, 'watchlist');

  // Priority 1: explicit pullquote from Firestore (structured field)
  const usePullquote = typeof explicitPullquote === 'string' && explicitPullquote.length > 5
    ? explicitPullquote
    : null;

  if (usePullquote) {
    pullQuoteHtml = `<div style="border-left:3px solid ${reporterColor};background:${reporterColor}0D;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0"><div style="font-size:16px;font-style:italic;color:#e2e8f0;line-height:1.6">&ldquo;${usePullquote.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}&rdquo;</div><div style="font-size:12px;color:#6e7681;margin-top:8px">&mdash; ${reporterName}, ${reporterBeat}</div></div>`;
    // Insert pullquote after the first paragraph break
    const firstBreak = processedText.indexOf('\n\n');
    if (firstBreak > -1) {
      processedText = processedText.slice(0, firstBreak) + '\n\n__PULLQUOTE__\n\n' + processedText.slice(firstBreak + 2);
    } else {
      processedText += '\n\n__PULLQUOTE__';
    }
  } else {
    // Priority 2: fallback to regex extraction from first **bold** in body (>5 chars guards against tickers)
    const boldMatch = processedText.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch[1].length > 5) {
      const quoteText = boldMatch[1];
      pullQuoteHtml = `<div style="border-left:3px solid ${reporterColor};background:${reporterColor}0D;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0"><div style="font-size:16px;font-style:italic;color:#e2e8f0;line-height:1.6">&ldquo;${quoteText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}&rdquo;</div><div style="font-size:12px;color:#6e7681;margin-top:8px">&mdash; ${reporterName}, ${reporterBeat}</div></div>`;
      processedText = text.replace(boldMatch[0], `__PULLQUOTE__`);
    }
  }

  let html = processedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^&gt;\s?(.+)$/gm, '<blockquote style="border-left:3px solid #30363d;padding-left:12px;color:#94a3b8;margin:12px 0;font-style:italic">$1</blockquote>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#e2e8f0;font-size:16px;margin:20px 0 10px;font-weight:700">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="color:#94a3b8;margin:4px 0;margin-left:16px">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 16px;line-height:1.65">')
    .replace(/\n/g, '<br/>');

  if (pullQuoteHtml) {
    html = html.replace('__PULLQUOTE__', pullQuoteHtml);
  }

  return html;
}

// ── Main Component ───────────────────────────────────────────────
export default function StoryDetail({ story, onClose, isMobile, isDesktop }) {
  const [researchSymbol, setResearchSymbol] = useState(null);

  if (!story) return null;

  const reporter = REPORTER_COLORS[story.reporter] || REPORTER_COLORS.kai;
  const reporterColor = reporter.hex;
  const primaryTicker = story.primaryTicker || (story.tickers && story.tickers[0]);
  const showStockRank = (story.reporter === 'alex' || story.reporter === 'doug') && primaryTicker;
  const showSectorRank = story.reporter === 'kim';
  const hasVisual = story.visualType && story.visualType !== 'none';

  const sentimentColor = SENTIMENT_COLORS[story.sentiment] || SENTIMENT_COLORS.neutral;
  const sentimentLabel = story.sentiment
    ? story.sentiment.charAt(0).toUpperCase() + story.sentiment.slice(1)
    : 'Neutral';

  const bodyHtml = renderMarkdownWithPullQuote(story.body, reporter.name, reporter.beat, reporterColor, story.pullquote);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0e14',
      color: '#e6edf3',
      maxWidth: isDesktop ? '1080px' : '100%',
      margin: isDesktop ? '0 auto' : 0,
    }}>
      {/* ── Top bar with back arrow ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${FEED_TOKENS.bgCardBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        backgroundColor: '#0a0e14',
        zIndex: 10,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <span style={{ color: '#00d9ff', fontSize: '14px', fontWeight: 600 }}>
          FantasyTimes
        </span>
      </div>

      {/* ── Expanded visual (280px) — or ranking card for price_chart ── */}
      {hasVisual && story.visualType !== 'price_chart' && (
        <div style={{
          borderRadius: 0,
          overflow: 'hidden',
          backgroundImage: getReporterGlow(story.reporter),
        }}>
          <StoryVisualSafe
            visualType={story.visualType}
            visualConfig={story.visualConfig}
            size="expanded"
          />
        </div>
      )}
      {story.visualType === 'price_chart' && primaryTicker && (
        <div style={{ padding: isDesktop ? '16px 32px' : '12px 20px' }}>
          <StockRankCard ticker={primaryTicker} />
        </div>
      )}

      {/* ── Content area ── */}
      <div style={{ padding: isDesktop ? '24px 32px' : '16px 20px 100px' }}>
        {/* Headline */}
        <h1 style={{
          color: '#e2e8f0',
          fontSize: isDesktop ? '24px' : '20px',
          fontWeight: 700,
          lineHeight: 1.3,
          margin: '0 0 12px',
        }}>
          {story.headline}
        </h1>

        {/* Subheadline */}
        {story.subheadline && (
          <p style={{
            color: '#94a3b8',
            fontSize: '15px',
            margin: '0 0 16px',
            lineHeight: 1.5,
          }}>
            {story.subheadline}
          </p>
        )}

        {/* ── Reporter row + sentiment badge ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ReporterAvatar reporter={story.reporter} size={28} />
            <div>
              <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>
                {reporter.name}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '6px' }}>
                {reporter.beat}
              </span>
            </div>
          </div>

          {/* Sentiment badge */}
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: `${sentimentColor}26`,
            color: sentimentColor,
            letterSpacing: '0.3px',
          }}>
            {sentimentLabel}
          </span>
        </div>

        {/* Timestamp + read time */}
        <div style={{
          color: '#64748b',
          fontSize: '12px',
          marginBottom: '16px',
          paddingLeft: '36px',
        }}>
          {formatTimestamp(story.publishedAt)}
          {story.body && (
            <span style={{ marginLeft: '8px' }}>
              · {estimateReadTime(story.body)}
            </span>
          )}
        </div>

        {/* ── Divider ── */}
        <div style={{
          height: '1px',
          backgroundColor: FEED_TOKENS.bgCardBorder,
          margin: '0 0 20px',
        }} />

        {/* ── Body text ── */}
        <div
          style={{
            color: '#e2e8f0',
            fontSize: '15px',
            fontWeight: 400,
            lineHeight: 1.65,
          }}
          dangerouslySetInnerHTML={{
            __html: `<p style="margin:0 0 16px;line-height:1.65">${bodyHtml}</p>`,
          }}
        />

        {/* ── Rank cards ── */}
        {showStockRank && story.visualType !== 'price_chart' && <StockRankCard ticker={primaryTicker} />}
        {showSectorRank && <SectorRankCard topSectors={story.topSectors} />}

        {/* ── Related tickers ── */}
        {story.tickers && story.tickers.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginTop: '20px',
          }}>
            {story.tickers.map((ticker) => {
              const idxInfo = INDEX_REGISTRY[ticker];
              return (
                <button
                  key={ticker}
                  onClick={() => setResearchSymbol(ticker)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: idxInfo ? `${idxInfo.color}15` : FEED_TOKENS.bgCard,
                    border: `1px solid ${idxInfo ? `${idxInfo.color}40` : FEED_TOKENS.bgCardBorder}`,
                    color: idxInfo ? idxInfo.color : '#e6edf3',
                    cursor: 'pointer',
                  }}
                >
                  {idxInfo ? idxInfo.name : ticker}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Related Game Actions card ── */}
        {primaryTicker && story.recommended_action !== 'EARNINGSGAME' && (story.recommended_action !== 'WATCHLIST' || isIndex(primaryTicker)) && (
          <div style={{
            marginTop: '24px',
            backgroundColor: FEED_TOKENS.bgCard,
            border: `1px solid ${FEED_TOKENS.bgCardBorder}`,
            borderRadius: FEED_TOKENS.cardRadius,
            boxShadow: FEED_TOKENS.obsidianShadow,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px 8px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#6e7681',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Related Game Actions
            </div>

            {/* Research button */}
            <button
              onClick={() => setResearchSymbol(primaryTicker)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderTop: `1px solid ${FEED_TOKENS.bgCardBorder}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${reporterColor}0A`; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <BarChart3 size={18} color={reporterColor} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600 }}>
                  Research {INDEX_REGISTRY[primaryTicker]?.name || primaryTicker}
                </div>
                <div style={{ color: '#6e7681', fontSize: '12px', marginTop: '1px' }}>
                  Full chart, technicals, rankings
                </div>
              </div>
              <ArrowRight size={16} color="#6e7681" style={{ flexShrink: 0 }} />
            </button>
          </div>
        )}

        {/* ── Disclaimer ── */}
        <p style={{
          color: '#6e7681',
          fontSize: '11px',
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: `1px solid ${FEED_TOKENS.bgCardBorder}`,
          lineHeight: 1.4,
        }}>
          FantasyTimes — AI-generated for educational and entertainment purposes. Not financial advice.
        </p>
      </div>

      {/* ── Research modal (local) ── */}
      {researchSymbol && (
        <Suspense fallback={null}>
          <AssetResearchModal
            asset={{
              symbol: researchSymbol,
              name: INDEX_REGISTRY[researchSymbol]?.name || findStock(researchSymbol)?.name || researchSymbol,
            }}
            sector={findStock(researchSymbol)?.sector || ''}
            onClose={() => setResearchSymbol(null)}
            showActionButton={false}
            version={2}
          />
        </Suspense>
      )}
    </div>
  );
}
