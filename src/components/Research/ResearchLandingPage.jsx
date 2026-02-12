import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { getTopMoversWithNews, getMarketNews, getMultipleStockNews } from '../../services/eodhdAPI';
import { WEEK_AHEAD_EVENTS } from '../../data/weekAheadEvents';
import { useAssetResearch } from '../../hooks/useAssetResearch';
import AssetResearchModal from '../draft/AssetResearchModal';

// ─── Utilities ───────────────────────────────────────────────
const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? fallback : num;
};

// ─── Color Tokens ────────────────────────────────────────────
const C = {
  bgPrimary: HOLO_COLORS.bgDeep,       // #0a0e14
  bgCard: HOLO_COLORS.bgCard,           // #0d1117
  bgElevated: HOLO_COLORS.bgElevated,   // #161b22
  cyan: '#00d9ff',
  green: '#00ff88',
  red: '#ff4757',
  amber: '#f59e0b',
  purple: '#a78bfa',
  white: '#ffffff',
  textPrimary: HOLO_COLORS.textPrimary,  // #e6edf3
  textSecondary: HOLO_COLORS.textSecondary, // #8b949e
  textMuted: '#484f58',
  border: 'rgba(0,217,255,0.08)',
  borderHover: 'rgba(0,217,255,0.2)',
};

const SENTIMENT_MAP = {
  bullish:  { color: C.green, label: 'BULLISH' },
  cautious: { color: C.amber, label: 'CAUTIOUS' },
  bearish:  { color: C.red, label: 'BEARISH' },
  neutral:  { color: C.textSecondary, label: 'NEUTRAL' },
};

const DEFAULT_WATCHLIST = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'MSFT', 'AMZN'];
const TRENDING_TICKERS = ['NVDA', 'TSLA', 'AAPL', 'META', 'AMZN'];

// ─── Keyframe Styles (injected once) ────────────────────────
const KEYFRAMES = `
@keyframes rlp-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}
@keyframes rlp-fadeSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

// ─── ParticleField ───────────────────────────────────────────
const ParticleField = ({ width, height }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const PARTICLE_COUNT = 40;
    const MAX_DIST = 120;

    // Initialize particles
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: 0.5 + Math.random() * 1.5,
      a: 0.1 + Math.random() * 0.4,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,217,255,${p.a})`;
        ctx.fill();

        // Draw connecting lines
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0,217,255,${0.06 * (1 - dist / MAX_DIST)})`;
            ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0.6,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─── SentimentPulse ──────────────────────────────────────────
const SentimentPulse = ({ sentiment }) => {
  const s = SENTIMENT_MAP[sentiment] || SENTIMENT_MAP.neutral;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: s.color,
        boxShadow: `0 0 8px ${s.color}`,
        animation: 'rlp-pulse 2s ease-in-out infinite',
      }} />
      <span style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.15em',
        color: s.color,
      }}>
        {s.label}
      </span>
    </div>
  );
};

// ─── MoverRow ────────────────────────────────────────────────
const MoverRow = ({ symbol, name, change, isGainer }) => {
  const accentColor = isGainer ? C.green : C.red;
  const sign = isGainer ? '+' : '';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 0',
    }}>
      <div style={{
        width: '3px',
        height: '24px',
        borderRadius: '2px',
        background: accentColor,
        opacity: 0.7,
      }} />
      <span style={{
        fontFamily: 'monospace',
        fontSize: '13px',
        fontWeight: 700,
        color: C.white,
        minWidth: '52px',
      }}>
        {symbol}
      </span>
      <span style={{
        fontSize: '11px',
        color: C.textSecondary,
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {name}
      </span>
      <span style={{
        fontFamily: 'monospace',
        fontSize: '13px',
        fontWeight: 600,
        color: accentColor,
      }}>
        {sign}{safeNumber(change, 0).toFixed(1)}%
      </span>
    </div>
  );
};

// ─── PathwayCard ─────────────────────────────────────────────
const PathwayCard = ({ icon, title, subtitle, tags, accent, onClick, index, children }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: 'relative',
        background: hovered
          ? `linear-gradient(135deg, ${C.bgCard}, ${accent}08)`
          : C.bgCard,
        border: `1px solid ${hovered ? accent + '4d' : C.border}`,
        borderRadius: '16px',
        padding: '24px 20px',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 8px 32px ${accent}15, 0 0 0 1px ${accent}15`
          : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '20px',
        right: '20px',
        height: '2px',
        background: accent,
        opacity: hovered ? 0.8 : 0.4,
        borderRadius: '0 0 2px 2px',
        transition: 'opacity 0.3s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          {/* Icon */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: `${accent}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            boxShadow: hovered ? `0 0 20px ${accent}20` : 'none',
            transition: 'box-shadow 0.3s',
          }}>
            {icon}
          </div>

          {/* Title */}
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: C.white,
            marginBottom: '4px',
          }}>
            {title}
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: '12px',
            fontWeight: 400,
            color: C.textSecondary,
            lineHeight: 1.5,
            marginBottom: tags ? '12px' : '0',
          }}>
            {subtitle}
          </div>

          {/* Tags */}
          {tags && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: accent,
                  background: `${accent}12`,
                  border: `1px solid ${accent}25`,
                  borderRadius: '10px',
                  padding: '3px 8px',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Arrow */}
        {onClick && (
          <svg
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke={accent} strokeWidth="2"
            style={{
              marginTop: '4px',
              transform: hovered ? 'translateX(3px)' : 'translateX(0)',
              transition: 'transform 0.3s',
              opacity: 0.6,
            }}
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </div>

      {/* Children (for Quick Search card) */}
      {children && <div style={{ marginTop: '16px' }}>{children}</div>}
    </motion.div>
  );
};

// ─── WatchlistItem ───────────────────────────────────────────
const WatchlistItem = ({ item, onClick }) => {
  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(diffMs / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 0',
        borderBottom: `1px solid ${C.border}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          fontWeight: 700,
          color: C.cyan,
          background: `${C.cyan}15`,
          padding: '2px 6px',
          borderRadius: '4px',
        }}>
          {item.watchlistSymbol || 'NEWS'}
        </span>
        <span style={{ fontSize: '11px', color: C.textMuted }}>
          {getTimeAgo(item.publishedAt)}
        </span>
      </div>
      <div style={{
        fontSize: '12px',
        color: C.textPrimary,
        lineHeight: 1.4,
      }}>
        {item.title}
      </div>
    </div>
  );
};

// ─── QuickSearchInput ────────────────────────────────────────
const QuickSearchInput = ({ allAssets, onSelectAsset }) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim() || !allAssets?.length) return [];
    const q = query.toLowerCase();
    return allAssets
      .filter(a =>
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [query, allAssets]);

  const showDropdown = focused && results.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder="Search any stock or crypto..."
        style={{
          width: '100%',
          padding: '10px 12px',
          background: C.bgElevated,
          border: `1px solid ${focused ? C.amber + '66' : C.border}`,
          borderRadius: '10px',
          color: C.textPrimary,
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: focused ? `0 0 16px ${C.amber}10` : 'none',
          transition: 'all 0.2s',
        }}
      />

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: C.bgElevated,
          border: `1px solid ${C.borderHover}`,
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {results.map(asset => (
            <div
              key={asset.symbol}
              onMouseDown={() => {
                onSelectAsset(asset);
                setQuery('');
              }}
              style={{
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderBottom: `1px solid ${C.border}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${C.amber}08`}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: C.amber,
                }}>
                  {asset.symbol}
                </span>
                <span style={{ fontSize: '12px', color: C.textSecondary }}>
                  {asset.name}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: C.textMuted }}>
                Open →
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Trending pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
        <span style={{ fontSize: '10px', color: C.textMuted, alignSelf: 'center', marginRight: '2px' }}>
          Trending:
        </span>
        {TRENDING_TICKERS.map(ticker => (
          <button
            key={ticker}
            onClick={() => {
              const asset = allAssets?.find(a => a.symbol === ticker);
              if (asset) onSelectAsset(asset);
            }}
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 600,
              color: C.textSecondary,
              background: C.bgElevated,
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              padding: '3px 8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.amber;
              e.currentTarget.style.color = C.amber;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.textSecondary;
            }}
          >
            ${ticker}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Section Divider ─────────────────────────────────────────
const SectionDivider = ({ label }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '28px 0 16px',
  }}>
    <div style={{
      width: '20px',
      height: '1px',
      background: `linear-gradient(90deg, transparent, ${C.cyan}66)`,
    }} />
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.15em',
      color: C.textMuted,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
    <div style={{
      flex: 1,
      height: '1px',
      background: `linear-gradient(90deg, ${C.cyan}66, transparent)`,
    }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const ResearchLandingPage = ({
  stocksData = [],
  cryptoData = [],
  colors,
  onBuildThesis,
  onOpenMoneyMap,
  onAnalyzeStock,
  onMyPatterns,
  onInsights,
  activePatternCount = 0,
}) => {
  // ─── Data State ──────────────────────────────────────────
  const [moversData, setMoversData] = useState({ gainers: [], losers: [] });
  const [marketNews, setMarketNews] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [watchlistNews, setWatchlistNews] = useState([]);
  const [heroSize, setHeroSize] = useState({ w: 800, h: 320 });
  const heroRef = useRef(null);

  // ─── Asset Research Modal ────────────────────────────────
  const { researchAsset, isOpen, showResearch, hideResearch, getModalProps } = useAssetResearch();

  // ─── All assets for search ───────────────────────────────
  const allAssets = useMemo(() => [...stocksData, ...cryptoData], [stocksData, cryptoData]);

  // ─── Market breadth & sentiment ──────────────────────────
  const marketBreadth = useMemo(() => {
    const stocksUp = stocksData.filter(s => safeNumber(s.percentChange, 0) > 0).length;
    const stocksDown = stocksData.filter(s => safeNumber(s.percentChange, 0) < 0).length;
    const cryptoUp = cryptoData.filter(c => safeNumber(c.change24h || c.percentChange, 0) > 0).length;
    const cryptoDown = cryptoData.filter(c => safeNumber(c.change24h || c.percentChange, 0) < 0).length;
    const total = stocksUp + stocksDown;
    const ratio = total > 0 ? stocksUp / total : 0.5;

    let sentiment = 'neutral';
    if (ratio > 0.6) sentiment = 'bullish';
    else if (ratio < 0.4) sentiment = 'bearish';
    else if (ratio < 0.5) sentiment = 'cautious';

    return { stocksUp, stocksDown, cryptoUp, cryptoDown, sentiment };
  }, [stocksData, cryptoData]);

  // ─── Top gainers/decliners from movers or props ──────────
  const topGainers = useMemo(() => {
    if (moversData.gainers?.length) {
      return moversData.gainers.slice(0, 3);
    }
    return [...allAssets]
      .sort((a, b) => safeNumber(b.percentChange || b.change24h, 0) - safeNumber(a.percentChange || a.change24h, 0))
      .slice(0, 3);
  }, [moversData, allAssets]);

  const topDecliners = useMemo(() => {
    if (moversData.losers?.length) {
      return moversData.losers.slice(0, 3);
    }
    return [...allAssets]
      .sort((a, b) => safeNumber(a.percentChange || a.change24h, 0) - safeNumber(b.percentChange || b.change24h, 0))
      .slice(0, 3);
  }, [moversData, allAssets]);

  // ─── Economic events ─────────────────────────────────────
  const economicEvents = useMemo(() => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);
    const fmt = d => d.toISOString().split('T')[0];
    // Show all events or filter by upcoming week
    return WEEK_AHEAD_EVENTS.filter(e => e.date >= fmt(today) && e.date <= fmt(endDate))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  // ─── Data fetching ───────────────────────────────────────
  useEffect(() => {
    // Fetch top movers
    (async () => {
      try {
        const movers = await getTopMoversWithNews();
        setMoversData(movers);
      } catch (err) {
        console.warn('[ResearchLanding] Failed to fetch movers:', err);
      }
    })();

    // Fetch market news
    (async () => {
      try {
        const news = await getMarketNews(6);
        setMarketNews(news);
      } catch (err) {
        console.warn('[ResearchLanding] Failed to fetch news:', err);
      }
    })();

    // Fetch watchlist news
    (async () => {
      try {
        let symbols;
        try {
          const saved = localStorage.getItem('user_watchlist');
          if (saved) symbols = JSON.parse(saved);
        } catch (e) { /* ignore */ }
        if (!symbols?.length) symbols = DEFAULT_WATCHLIST;
        symbols = symbols.slice(0, 8);

        const newsMap = await getMultipleStockNews(symbols, 2);
        const allNews = [];
        const seen = new Set();
        symbols.forEach(sym => {
          (newsMap[sym] || []).forEach(item => {
            if (!seen.has(item.title)) {
              seen.add(item.title);
              allNews.push({ ...item, watchlistSymbol: sym });
            }
          });
        });
        allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        setWatchlistNews(allNews.slice(0, 5));
      } catch (err) {
        console.warn('[ResearchLanding] Failed to fetch watchlist news:', err);
      }
    })();
  }, []);

  // ─── AI Summary ──────────────────────────────────────────
  useEffect(() => {
    if (!stocksData.length && !cryptoData.length) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/ai-advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'market_summary',
            context: {
              stocksUp: marketBreadth.stocksUp,
              stocksDown: marketBreadth.stocksDown,
              cryptoUp: marketBreadth.cryptoUp,
              cryptoDown: marketBreadth.cryptoDown,
              topGainers: moversData?.gainers?.slice(0, 3).map(s => ({ symbol: s.symbol, change: s.percentChange })) || [],
              topLosers: moversData?.losers?.slice(0, 3).map(s => ({ symbol: s.symbol, change: s.percentChange })) || [],
              recentNews: marketNews?.slice(0, 3).map(n => n.title) || [],
            },
          }),
        });
        if (!response.ok) throw new Error('AI summary unavailable');
        const data = await response.json();
        if (data.success && data.advice) {
          setAiSummary(data.advice);
        } else {
          setAiSummary(generateFallback());
        }
      } catch {
        setAiSummary(generateFallback());
      } finally {
        setIsLoadingSummary(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [stocksData, cryptoData, marketBreadth, moversData, marketNews]);

  const generateFallback = useCallback(() => {
    const { stocksUp, stocksDown, sentiment } = marketBreadth;
    if (sentiment === 'bullish') {
      return `Markets are showing strength today with ${stocksUp} stocks advancing. Consider momentum plays but watch for overextended names.`;
    } else if (sentiment === 'bearish') {
      return `Caution advised as ${stocksDown} stocks are declining today. Look for quality names at support levels or consider defensive positions.`;
    }
    return `Markets are trading mixed with ${stocksUp} gainers and ${stocksDown} decliners. A balanced approach may work best in this environment.`;
  }, [marketBreadth]);

  // ─── Hero resize observer ────────────────────────────────
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setHeroSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ─── Handle opening research modal from various sources ──
  const handleOpenResearch = useCallback((asset) => {
    showResearch(asset);
  }, [showResearch]);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Inject keyframes */}
      <style>{KEYFRAMES}</style>

      {/* ═══ ZONE 1: Hero — Market Intelligence Briefing ═══ */}
      <motion.div
        ref={heroRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'relative',
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: '20px',
          padding: '28px 24px',
          overflow: 'hidden',
        }}
      >
        <ParticleField width={heroSize.w} height={heroSize.h} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '4px',
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: C.textMuted,
              textTransform: 'uppercase',
            }}>
              MARKET INTELLIGENCE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <SentimentPulse sentiment={marketBreadth.sentiment} />
              <span style={{
                background: `${C.purple}20`,
                color: C.purple,
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}>
                CLAUDE
              </span>
            </div>
          </div>

          {/* Date */}
          <div style={{
            fontSize: '12px',
            color: C.textSecondary,
            marginBottom: '16px',
          }}>
            {dateStr}
          </div>

          {/* AI Summary */}
          <div style={{
            fontSize: '14px',
            color: C.textPrimary,
            lineHeight: 1.6,
            marginBottom: '20px',
            minHeight: '40px',
          }}>
            {isLoadingSummary ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '12px', height: '12px',
                  border: `2px solid ${C.purple}40`,
                  borderTop: `2px solid ${C.purple}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <span style={{ color: C.textSecondary, fontSize: '13px' }}>
                  Analyzing market conditions...
                </span>
              </div>
            ) : (
              aiSummary
            )}
          </div>

          {/* Movers grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}>
            {/* Gainers */}
            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: C.green,
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}>
                Top Gainers
              </div>
              {topGainers.map((stock, i) => (
                <MoverRow
                  key={stock.symbol || i}
                  symbol={stock.symbol}
                  name={stock.name}
                  change={safeNumber(stock.percentChange || stock.change24h, 0)}
                  isGainer={true}
                />
              ))}
            </div>
            {/* Decliners */}
            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: C.red,
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}>
                Top Decliners
              </div>
              {topDecliners.map((stock, i) => (
                <MoverRow
                  key={stock.symbol || i}
                  symbol={stock.symbol}
                  name={stock.name}
                  change={safeNumber(stock.percentChange || stock.change24h, 0)}
                  isGainer={false}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ ZONE 2: Research Tools ═══ */}
      <SectionDivider label="RESEARCH TOOLS" />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '12px',
      }}>
        {/* Build My Thesis */}
        <PathwayCard
          index={0}
          accent={C.green}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
          }
          title="Build My Thesis"
          subtitle="AI-guided portfolio construction with risk analysis"
          tags={['Guided Flow', 'Smart Picks', 'Risk Analysis']}
          onClick={onBuildThesis}
        />

        {/* Money Map */}
        <PathwayCard
          index={1}
          accent={C.cyan}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          }
          title="Money Map"
          subtitle="See where capital is flowing across sectors"
          tags={['Sector Rotation', 'Breadth', 'Flow']}
          onClick={onOpenMoneyMap}
        />

        {/* Technical Research */}
        <PathwayCard
          index={2}
          accent={C.purple}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
          title="Technical Research"
          subtitle="Chart analysis, patterns, and AI-powered insights"
          tags={['Analyze Stock', 'My Patterns', 'Insights']}
          onClick={onAnalyzeStock}
        />

        {/* Quick Research */}
        <PathwayCard
          index={3}
          accent={C.amber}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
          title="Quick Research"
          subtitle="Instantly dive into any stock or crypto"
          tags={null}
          onClick={null}
        >
          <QuickSearchInput
            allAssets={allAssets}
            onSelectAsset={handleOpenResearch}
          />
        </PathwayCard>
      </div>

      {/* ═══ ZONE 3: Bottom Row ═══ */}
      <SectionDivider label="INTELLIGENCE FEED" />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '12px',
      }}>
        {/* Watchlist */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: C.textMuted,
            marginBottom: '12px',
            textTransform: 'uppercase',
          }}>
            YOUR WATCHLIST
          </div>
          {watchlistNews.length === 0 ? (
            <div style={{ color: C.textSecondary, fontSize: '12px', padding: '12px 0' }}>
              No recent watchlist news available.
            </div>
          ) : (
            watchlistNews.map((item, i) => (
              <WatchlistItem
                key={item.title || i}
                item={item}
                onClick={() => {
                  const asset = allAssets.find(a => a.symbol === item.watchlistSymbol);
                  if (asset) handleOpenResearch(asset);
                }}
              />
            ))
          )}
        </motion.div>

        {/* Economic Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: C.textMuted,
            marginBottom: '12px',
            textTransform: 'uppercase',
          }}>
            ECONOMIC CALENDAR
          </div>
          {economicEvents.length === 0 ? (
            <div style={{
              color: C.textSecondary,
              fontSize: '12px',
              padding: '16px 0',
              textAlign: 'center',
            }}>
              No major economic events this week.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {economicEvents.slice(0, 5).map((evt, i) => (
                <div key={evt.name + i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 0',
                  borderBottom: i < Math.min(economicEvents.length, 5) - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: evt.impact === 'high' ? C.red : evt.impact === 'medium' ? C.amber : C.textMuted,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: C.textPrimary, fontWeight: 500 }}>
                      {evt.name}
                    </div>
                    <div style={{ fontSize: '10px', color: C.textMuted }}>
                      {new Date(evt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {evt.time ? ` · ${evt.time} ET` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: evt.impact === 'high' ? C.red : evt.impact === 'medium' ? C.amber : C.textMuted,
                    textTransform: 'uppercase',
                  }}>
                    {evt.impact}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══ Asset Research Modal ═══ */}
      {isOpen && researchAsset && (
        <AssetResearchModal
          {...getModalProps()}
          showActionButton={false}
        />
      )}
    </div>
  );
};

export default ResearchLandingPage;
