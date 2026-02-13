import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { SECTORS } from '../../constants/sectors';
import { getTopMoversWithNews, getMarketNews } from '../../services/eodhdAPI';

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
  // Mobile dim variants
  cyanDim: 'rgba(0,217,255,0.12)',
  greenDim: 'rgba(0,255,136,0.10)',
  redDim: 'rgba(255,71,87,0.10)',
  amberDim: 'rgba(245,158,11,0.10)',
  purpleDim: 'rgba(167,139,250,0.10)',
  bgSurface: '#1c2128',
  borderActive: 'rgba(0,217,255,0.18)',
};

// ─── Style Helpers ──────────────────────────────────────────
const sectionLabel = (color, letterSpacing = '0.12em', fontSize = '9px') => ({
  fontSize, fontWeight: 700, letterSpacing, color,
});

const SENTIMENT_MAP = {
  bullish:  { color: C.green, label: 'BULLISH' },
  cautious: { color: C.amber, label: 'CAUTIOUS' },
  bearish:  { color: C.red, label: 'BEARISH' },
  neutral:  { color: C.textSecondary, label: 'NEUTRAL' },
};

const DEFAULT_WATCHLIST = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'MSFT', 'AMZN'];
const TRENDING_TICKERS = ['NVDA', 'TSLA', 'AAPL', 'META', 'AMZN', 'GOOGL', 'MSFT', 'AMD', 'NFLX', 'JPM', 'V', 'BRK.B'];

// ─── Mobile Config Constants ─────────────────────────────────
const TAG_CONFIG = {
  momentum: { color: C.amber, label: 'MOMENTUM', icon: '\uD83D\uDD25' },
  early_signal: { color: C.cyan, label: 'EARLY SIGNAL', icon: '\uD83D\uDCE1' },
  breakout: { color: C.green, label: 'BREAKOUT', icon: '\uD83D\uDE80' },
  earnings_play: { color: C.purple, label: 'EARNINGS', icon: '\uD83D\uDCCA' },
};

const INTEL_CACHE_KEY = 'research_intel_cache_v2';
const INTEL_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

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
@keyframes rlp-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes rlp-slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes rlp-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

// ─── ThinkingDots (shared loading indicator) ─────────────────
const ThinkingDots = ({ label = 'Thinking...', dotSize = 6, delayStep = 0.2, padding = '8px 0', labelMarginLeft }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding }}>
    <div style={{ display: 'flex', gap: '3px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: dotSize, height: dotSize, borderRadius: '50%',
          background: C.purple,
          animation: `rlp-pulse 1s ease-in-out ${i * delayStep}s infinite`,
        }} />
      ))}
    </div>
    <span style={{ fontSize: '11px', color: C.textMuted, ...(labelMarginLeft && { marginLeft: labelMarginLeft }) }}>{label}</span>
  </div>
);

// ─── UserBubble (shared chat message component) ─────────────
const UserBubble = ({ text, bgAlpha = '15', borderAlpha = '20', textColor = C.white, maxWidth = '80%', marginBottom }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', ...(marginBottom !== undefined && { marginBottom }) }}>
    <div style={{
      background: `${C.cyan}${bgAlpha}`,
      border: `1px solid ${C.cyan}${borderAlpha}`,
      borderRadius: '12px 12px 4px 12px',
      padding: '8px 12px',
      maxWidth,
      fontSize: '12px',
      color: textColor,
      lineHeight: 1.4,
    }}>
      {text}
    </div>
  </div>
);

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

// ─── SentimentPulse (Desktop) ────────────────────────────────
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
      <span style={{ ...sectionLabel(s.color, '0.15em', '10px') }}>
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
                Open &rarr;
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

// ─── DesktopIntelChat ─────────────────────────────────────────
const INTEL_SUGGESTED_QUESTIONS = [
  'What\'s driving the market today?',
  'Which sectors are strongest right now?',
  'Any risks I should watch for?',
  'What are the top movers doing?',
  'Any interesting setups forming?',
];

const DesktopIntelChat = ({ buildMarketContextString }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const handleSend = useCallback(async (text) => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    const parentContext = messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.insights || [])
      .map(i => i.text)
      .join('\n');
    const marketContext = buildMarketContextString ? buildMarketContextString() : '';

    try {
      const res = await fetch('/api/research-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, parentContext, marketContext }),
      });
      const result = await res.json();
      if (result.success && result.data?.insights) {
        setMessages(prev => [...prev, { role: 'assistant', insights: result.data.insights }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', insights: [{ text: 'Unable to fetch insights right now. Try again.', type: 'signal' }] }]);
      }
    } catch (err) {
      console.warn('[DesktopIntelChat] Send error:', err);
      setMessages(prev => [...prev, { role: 'assistant', insights: [{ text: 'Connection error. Please try again.', type: 'signal' }] }]);
    } finally {
      setLoading(false);
    }
  }, [messages, buildMarketContextString]);

  const handleClear = useCallback(() => { setMessages([]); }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      style={{
        background: C.bgCard,
        border: `1px solid ${C.purpleDim || C.purple + '30'}`,
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '260px',
        maxHeight: '400px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.purple }} />
        <span style={{ ...sectionLabel(C.purple, '0.12em', '10px') }}>INTEL CHAT</span>
        <span style={{
          fontSize: '9px',
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: '4px',
          background: `${C.purple}15`,
          color: C.purple,
          letterSpacing: '0.08em',
          marginLeft: '4px',
        }}>CLAUDE</span>
        <div style={{ flex: 1 }} />
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: C.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 ? (
          <div>
            <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '12px', lineHeight: 1.5 }}>
              Ask about today&apos;s market, sectors, or trading setups.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {INTEL_SUGGESTED_QUESTIONS.map((q, i) => (
                <FollowUpPill key={i} text={q} onClick={handleSend} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  <UserBubble text={msg.text} bgAlpha="12" borderAlpha="25" textColor={C.cyan} maxWidth="85%" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(msg.insights || []).map((insight, j) => (
                      <InsightBullet key={j} text={insight.text} type={insight.type} index={j} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <ThinkingDots label="Thinking..." dotSize={4} delayStep={0.15} padding="4px 0" />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput placeholder="Ask about today's market..." onSend={handleSend} />
    </motion.div>
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
      ...sectionLabel(C.textMuted, '0.15em', '10px'),
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
// MOBILE SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── SentimentBadge (Mobile — separate from desktop SentimentPulse) ──
const SentimentBadge = ({ sentiment }) => {
  const s = SENTIMENT_MAP[sentiment] || SENTIMENT_MAP.neutral;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '20px',
      border: `1px solid ${s.color}40`,
      background: `${s.color}10`,
    }}>
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: s.color,
        boxShadow: `0 0 6px ${s.color}`,
        animation: 'rlp-pulse 2s ease-in-out infinite',
      }} />
      <span style={{ ...sectionLabel(s.color, '0.12em', '10px') }}>
        {s.label}
      </span>
    </div>
  );
};

// ─── InsightBullet ─────────────────────────────────────────────
const InsightBullet = ({ text, type, index }) => {
  const colorMap = { positive: C.green, negative: C.red, signal: C.cyan };
  const accent = colorMap[type] || C.cyan;
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      padding: '10px 12px',
      background: C.bgCard,
      borderRadius: '10px',
      borderLeft: `3px solid ${accent}`,
      animation: `rlp-fadeSlideIn 0.3s ease-out ${0.1 + index * 0.08}s both`,
    }}>
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: accent,
        marginTop: '5px',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: '13px', color: C.textPrimary, lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
};

// ─── FollowUpPill ──────────────────────────────────────────
const FollowUpPill = ({ text, onClick }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(text); }}
    onMouseEnter={e => {
      e.currentTarget.style.background = `${C.cyan}18`;
      e.currentTarget.style.borderColor = `${C.cyan}40`;
      e.currentTarget.style.color = C.cyan;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = C.bgElevated;
      e.currentTarget.style.borderColor = C.border;
      e.currentTarget.style.color = C.textSecondary;
    }}
    style={{
      padding: '6px 12px',
      borderRadius: 8,
      fontSize: '11px',
      fontWeight: 600,
      background: C.bgElevated,
      border: `1px solid ${C.border}`,
      color: C.textSecondary,
      cursor: 'pointer',
      transition: 'all 0.2s',
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </button>
);

// ─── ChatInput ─────────────────────────────────────────────
const ChatInput = ({ placeholder, onSend, compact }) => {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
        onClick={e => e.stopPropagation()}
        placeholder={placeholder || 'Ask a follow-up...'}
        style={{
          flex: 1,
          padding: compact ? '8px 12px' : '10px 14px',
          borderRadius: 10,
          background: C.bgElevated,
          border: `1px solid ${focused ? C.cyan + '66' : C.border}`,
          color: C.textPrimary,
          fontSize: compact ? '12px' : '13px',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
      />
      <button
        onClick={e => { e.stopPropagation(); handleSend(); }}
        style={{
          width: compact ? 32 : 36,
          height: compact ? 32 : 36,
          borderRadius: 10,
          background: value.trim() ? `${C.cyan}20` : C.bgElevated,
          border: `1px solid ${value.trim() ? C.cyan + '30' : C.border}`,
          color: value.trim() ? C.cyan : C.textMuted,
          fontSize: compact ? 14 : 16,
          cursor: value.trim() ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        {'\u2191'}
      </button>
    </div>
  );
};

// ─── ThreadView ──────────────────────────────────────────────
const ThreadView = ({ data, symbol, onOpenResearch }) => {
  if (!data) return null;
  return (
    <div style={{ padding: '12px 0 4px' }}>
      <div style={{
        ...sectionLabel(C.purple, '0.15em'),
        marginBottom: '10px',
      }}>
        DEEP DIVE: {symbol}
      </div>

      {/* Bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {(data.bullets || []).map((bullet, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: C.cyan,
              marginTop: '6px',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '12px', color: C.textPrimary, lineHeight: 1.5 }}>
              {bullet}
            </span>
          </div>
        ))}
      </div>

      {/* Verdict */}
      {data.verdict && (
        <div style={{
          padding: '10px 12px',
          background: C.greenDim,
          borderRadius: '8px',
          borderLeft: `3px solid ${C.green}`,
          marginBottom: '8px',
        }}>
          <div style={{
            ...sectionLabel(C.green, '0.1em'),
            marginBottom: '4px',
          }}>
            VERDICT
          </div>
          <span style={{ fontSize: '12px', color: C.textPrimary, lineHeight: 1.5 }}>
            {data.verdict}
          </span>
        </div>
      )}

      {/* Key Risk */}
      {data.risk && (
        <div style={{
          padding: '10px 12px',
          background: C.redDim,
          borderRadius: '8px',
          borderLeft: `3px solid ${C.red}`,
          marginBottom: '10px',
        }}>
          <div style={{
            ...sectionLabel(C.red, '0.1em'),
            marginBottom: '4px',
          }}>
            KEY RISK
          </div>
          <span style={{ fontSize: '12px', color: C.textPrimary, lineHeight: 1.5 }}>
            {data.risk}
          </span>
        </div>
      )}

      {/* Open Full Research button */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenResearch(symbol); }}
        style={{
          width: '100%',
          padding: '10px',
          background: C.bgElevated,
          border: `1px solid ${C.borderActive}`,
          borderRadius: '8px',
          color: C.cyan,
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        Open Full Research &rarr; {symbol}
      </button>
    </div>
  );
};

// ─── DiscoveryCard ───────────────────────────────────────────
const DiscoveryCard = ({ discovery, expanded, onToggle, threadData, threadLoading, onOpenResearch }) => {
  const tag = TAG_CONFIG[discovery.actionTag] || TAG_CONFIG.momentum;
  const changeVal = safeNumber(discovery.change, 0);
  const isPositive = changeVal >= 0;

  return (
    <div
      onClick={onToggle}
      style={{
        background: C.bgCard,
        border: `1px solid ${expanded ? C.borderActive : C.border}`,
        borderRadius: '12px',
        padding: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Action tag */}
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: tag.color,
            background: `${tag.color}15`,
            border: `1px solid ${tag.color}30`,
            borderRadius: '6px',
            padding: '2px 6px',
          }}>
            {tag.icon} {tag.label}
          </span>
        </div>
        {/* Expand indicator */}
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke={C.textMuted} strokeWidth="2"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Ticker + change */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '16px',
          fontWeight: 700,
          color: C.white,
        }}>
          {discovery.symbol}
        </span>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          fontWeight: 600,
          color: isPositive ? C.green : C.red,
        }}>
          {isPositive ? '+' : ''}{changeVal.toFixed(1)}%
        </span>
        {discovery.name && (
          <span style={{ fontSize: '11px', color: C.textMuted }}>
            {discovery.name}
          </span>
        )}
      </div>

      {/* Reason */}
      <div style={{
        fontSize: '12px',
        color: C.textSecondary,
        lineHeight: 1.5,
      }}>
        {discovery.reason}
      </div>

      {/* Expanded: Thread content */}
      {expanded && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: `1px solid ${C.border}`,
        }}>
          {threadLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: C.purple, animation: 'rlp-pulse 1.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: '11px', color: C.textMuted }}>Analyzing {discovery.symbol}...</span>
              </div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  height: '12px',
                  borderRadius: '4px',
                  background: `linear-gradient(90deg, ${C.bgElevated}, ${C.bgSurface}, ${C.bgElevated})`,
                  backgroundSize: '200% 100%',
                  animation: 'rlp-shimmer 1.5s ease-in-out infinite',
                  width: `${85 - i * 10}%`,
                }} />
              ))}
            </div>
          ) : threadData ? (
            <ThreadView
              data={threadData}
              symbol={discovery.symbol}
              onOpenResearch={onOpenResearch}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

// ─── HotSectorCard ───────────────────────────────────────────
const HotSectorCard = ({ sector }) => {
  if (!sector) return null;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.bgCard}, ${C.cyan}06)`,
      border: `1px solid ${C.cyanDim}`,
      borderRadius: '12px',
      padding: '14px',
    }}>
      <div style={{
        ...sectionLabel(C.textMuted),
        marginBottom: '8px',
      }}>
        HOT SECTOR
      </div>
      <div style={{
        fontSize: '15px',
        fontWeight: 700,
        color: C.white,
        marginBottom: '4px',
      }}>
        {sector.emoji} {sector.name}
      </div>
      <div style={{
        fontSize: '12px',
        color: C.textSecondary,
        lineHeight: 1.5,
        marginBottom: '10px',
      }}>
        {sector.why}
      </div>
      {sector.topPicks?.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {sector.topPicks.map(tick => (
            <span key={tick} style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 600,
              color: C.cyan,
              background: C.cyanDim,
              borderRadius: '6px',
              padding: '3px 8px',
            }}>
              {tick}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── ToolStripButton ─────────────────────────────────────────
const ToolStripButton = ({ icon, label, onClick, accent = C.textSecondary }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      background: 'none',
      border: 'none',
      padding: '8px 4px',
      cursor: 'pointer',
    }}
  >
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '10px',
      background: `${accent}12`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {icon}
    </div>
    <span style={{
      fontSize: '9px',
      fontWeight: 600,
      letterSpacing: '0.04em',
      color: C.textMuted,
    }}>
      {label}
    </span>
  </button>
);

// ─── QuestionCard (V3 — with follow-up chat) ───────────────
const QuestionCard = ({ question, index, buildMarketContextString }) => {
  const [expanded, setExpanded] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [followUpThread, setFollowUpThread] = useState([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const threadEndRef = useRef(null);

  const handleTap = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      setShowAnswer(false);
      setFollowUpThread([]);
      return;
    }
    setExpanded(true);
    setTimeout(() => setShowAnswer(true), 900);
  }, [expanded]);

  const handleFollowUp = useCallback(async (text) => {
    const userCount = followUpThread.filter(m => m.role === 'user').length;
    if (userCount >= 4) return;

    setFollowUpLoading(true);
    setFollowUpThread(prev => [...prev, { role: 'user', text }]);

    try {
      const parentContext = (question.answer?.insights || []).map(i => i.text).join('\n');
      const marketContext = buildMarketContextString ? buildMarketContextString() : '';

      const response = await fetch('/api/research-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, parentContext, marketContext }),
      });
      const result = await response.json();

      if (result.success && result.data?.insights) {
        setFollowUpThread(prev => [...prev, { role: 'assistant', insights: result.data.insights }]);
      } else {
        setFollowUpThread(prev => [...prev, {
          role: 'assistant',
          insights: [{ text: `Based on current data, this area shows dynamics worth monitoring in context of today's market activity.`, type: 'signal' }],
        }]);
      }
    } catch (err) {
      console.warn('[QuestionCard] Follow-up error:', err);
      setFollowUpThread(prev => [...prev, {
        role: 'assistant',
        insights: [{ text: 'Unable to analyze further right now. Try again in a moment.', type: 'signal' }],
      }]);
    } finally {
      setFollowUpLoading(false);
    }
  }, [followUpThread, question.answer, buildMarketContextString]);

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [followUpThread.length]);

  const userMsgCount = followUpThread.filter(m => m.role === 'user').length;

  return (
    <div
      onClick={handleTap}
      style={{
        background: expanded ? `linear-gradient(135deg, ${C.bgCard}, ${C.cyan}04)` : C.bgCard,
        borderRadius: '12px',
        borderLeft: `3px solid ${C.cyan}`,
        border: `1px solid ${expanded ? C.borderActive : C.border}`,
        borderLeftWidth: '3px',
        borderLeftColor: C.cyan,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        animation: `rlp-fadeSlideIn 0.3s ease-out ${0.1 + index * 0.08}s both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>{question.icon}</span>
          <span style={{
            fontSize: '13px',
            color: expanded ? C.cyan : C.textPrimary,
            fontWeight: expanded ? 600 : 500,
            transition: 'color 0.2s',
          }}>
            {question.label}
          </span>
        </div>
        <span style={{
          fontSize: '10px',
          color: C.textMuted,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.3s',
          flexShrink: 0,
        }}>
          {'\u25BC'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${C.border}`, animation: 'rlp-fadeSlideIn 0.3s ease both' }}>
          {!showAnswer ? (
            <ThinkingDots label="Analyzing..." labelMarginLeft="4px" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Original insights */}
              {(question.answer?.insights || []).map((insight, i) => (
                <InsightBullet key={i} text={insight.text} type={insight.type} index={i} />
              ))}

              {/* Follow-up thread */}
              {followUpThread.map((msg, i) => (
                <div key={`fu-${i}`} style={{
                  marginTop: i === 0 ? '8px' : '4px',
                  animation: 'rlp-fadeSlideIn 0.3s ease-out both',
                }}>
                  {msg.role === 'user' ? (
                    <UserBubble text={msg.text} marginBottom={6} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(msg.insights || []).map((insight, j) => (
                        <InsightBullet key={j} text={insight.text} type={insight.type} index={j} />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Follow-up loading */}
              {followUpLoading && (
                <div style={{ padding: '12px 0', marginTop: 6 }}>
                  <span style={{ color: C.textMuted, fontSize: '11px', animation: 'rlp-pulse 1s infinite' }}>{'\u25C9'} Thinking...</span>
                  {[80, 90].map((w, i) => (
                    <div key={i} style={{
                      height: 8, borderRadius: 4, background: C.bgElevated,
                      marginTop: 6, width: `${w}%`,
                      animation: `rlp-shimmer 1.5s infinite ${i * 0.15}s`,
                    }} />
                  ))}
                </div>
              )}

              {/* Suggested follow-up pills */}
              {question.followUps?.length > 0 && userMsgCount < 3 && !followUpLoading && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                  marginTop: 10, paddingTop: 8,
                  borderTop: `1px solid ${C.border}`,
                }}>
                  {question.followUps
                    .filter(f => !followUpThread.some(t => t.role === 'user' && t.text === f))
                    .map(f => (
                      <FollowUpPill key={f} text={f} onClick={handleFollowUp} />
                    ))}
                </div>
              )}

              {/* Free-form chat input */}
              {!followUpLoading && userMsgCount < 4 && (
                <div style={{ marginTop: 8 }}>
                  <ChatInput
                    placeholder={`Ask about ${question.label.toLowerCase().replace('?', '')}...`}
                    onSend={handleFollowUp}
                    compact
                  />
                </div>
              )}

              {/* Max depth reached */}
              {userMsgCount >= 4 && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: C.bgElevated, textAlign: 'center',
                }}>
                  <span style={{ fontSize: '11px', color: C.textMuted }}>
                    Collapse and try another question for more insights
                  </span>
                </div>
              )}

              <div ref={threadEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── TrackerStockCard (V2) ──────────────────────────────────
const TrackerStockCard = ({ stock, expanded, onToggle, trackerData, trackerLoading, onRemove }) => {
  const pct = safeNumber(stock.percentChange, 0);
  const isPositive = pct >= 0;

  // Status derivation from percentChange thresholds
  let statusLabel, statusColor;
  if (pct > 3) { statusLabel = 'SURGING'; statusColor = C.green; }
  else if (pct > 1) { statusLabel = 'RISING'; statusColor = C.green; }
  else if (pct > -1) { statusLabel = 'FLAT'; statusColor = C.textMuted; }
  else if (pct > -3) { statusLabel = 'DIPPING'; statusColor = C.amber; }
  else { statusLabel = 'DROPPING'; statusColor = C.red; }

  const sections = [
    { key: 'priceAction', label: 'PRICE ACTION', color: C.cyan },
    { key: 'technicalLevel', label: 'KEY LEVEL', color: C.amber },
    { key: 'news', label: 'NEWS', color: C.green },
    { key: 'baggerBomb', label: 'BAGGERBOMB', color: C.purple },
  ];

  return (
    <div
      onClick={onToggle}
      style={{
        background: C.bgCard,
        border: `1px solid ${expanded ? C.borderActive : C.border}`,
        borderRadius: '10px',
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Collapsed header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 700,
            color: C.cyan,
            background: C.cyanDim,
            padding: '2px 6px',
            borderRadius: '4px',
          }}>
            {stock.symbol}
          </span>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isPositive ? C.green : C.red,
          }}>
            {isPositive ? '+' : ''}{pct.toFixed(2)}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '8px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: statusColor,
            background: `${statusColor}15`,
            padding: '2px 6px',
            borderRadius: '4px',
          }}>
            {statusLabel}
          </span>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(stock.symbol); }}
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: 'transparent',
                border: '1px solid transparent',
                color: C.textMuted,
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                opacity: 0.4,
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = `${C.red}30`; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = 'transparent'; }}
              title="Remove from watchlist"
            >{'\u2715'}</button>
          )}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={C.textMuted} strokeWidth="2"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
          {trackerLoading === stock.symbol ? (
            <ThinkingDots label={`Analyzing ${stock.symbol}...`} padding="12px 0" labelMarginLeft="4px" />
          ) : trackerData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map(({ key, label, color }) => (
                <div key={key}>
                  <div style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color,
                    marginBottom: '3px',
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.5 }}>
                    {trackerData[key] || 'No data available'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '8px 0', fontSize: '12px', color: C.textMuted }}>
              Tap to load analysis
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── TrackerSection (V2) ────────────────────────────────────
const TrackerSection = ({ watchlistStocks, expandedTracker, onToggleTracker, trackerCache, trackerLoading, onRemoveStock, onAddStock, allAssets }) => {
  const [showAddStock, setShowAddStock] = useState(false);
  const [addStockSearch, setAddStockSearch] = useState('');

  if (!watchlistStocks?.length && !onAddStock) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 4px' }}>
        <div style={{
          ...sectionLabel(C.textMuted),
        }}>
          TRACKER BOT
        </div>
        <span style={{ fontSize: '14px' }}>{'\uD83E\uDD16'}</span>
      </div>
      <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '10px', padding: '0 4px' }}>
        Your watchlist, analyzed
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {watchlistStocks.map(stock => (
          <TrackerStockCard
            key={stock.symbol}
            stock={stock}
            expanded={expandedTracker === stock.symbol}
            onToggle={() => onToggleTracker(stock.symbol)}
            trackerData={trackerCache[stock.symbol]}
            trackerLoading={trackerLoading}
            onRemove={onRemoveStock}
          />
        ))}
      </div>

      {/* Add stock button */}
      {onAddStock && (
        <button
          onClick={() => setShowAddStock(!showAddStock)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 10,
            background: C.bgElevated,
            border: `1px dashed ${C.border}`,
            color: C.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>+</span> Track another stock
        </button>
      )}

      {/* Add stock search */}
      {showAddStock && (
        <div style={{
          marginTop: 6,
          padding: '10px',
          borderRadius: 10,
          background: C.bgElevated,
          border: `1px solid ${C.cyan}20`,
          animation: 'rlp-fadeSlideIn 0.2s ease both',
        }}>
          <input
            autoFocus
            value={addStockSearch}
            onChange={e => setAddStockSearch(e.target.value.toUpperCase())}
            placeholder="Enter stock symbol (e.g. AAPL)"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              color: C.white,
              fontSize: 13,
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              boxSizing: 'border-box',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && addStockSearch.trim()) {
                onAddStock(addStockSearch.trim());
                setAddStockSearch('');
                setShowAddStock(false);
              }
              if (e.key === 'Escape') {
                setShowAddStock(false);
                setAddStockSearch('');
              }
            }}
          />
          {addStockSearch.length >= 1 && (
            <div style={{ marginTop: 6, maxHeight: 150, overflowY: 'auto' }}>
              {(allAssets || [])
                .filter(a => {
                  const sym = (a.symbol || a.ticker || '').toUpperCase();
                  const name = (a.name || '').toUpperCase();
                  const search = addStockSearch.toUpperCase();
                  return (sym.startsWith(search) || name.includes(search)) && !watchlistStocks.some(w => w.symbol === sym);
                })
                .slice(0, 5)
                .map(a => {
                  const sym = (a.symbol || a.ticker || '').toUpperCase();
                  return (
                    <button
                      key={sym}
                      onClick={() => {
                        onAddStock(sym);
                        setAddStockSearch('');
                        setShowAddStock(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: C.textSecondary,
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: C.white, fontFamily: "'JetBrains Mono', monospace", minWidth: 50 }}>{sym}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || ''}</span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── DesktopTrackerSection ───────────────────────────────────
const DesktopTrackerSection = ({
  watchlistStocks,
  expandedTracker,
  onToggleTracker,
  trackerCache,
  trackerLoading,
  onShowWeeklyReport,
  onRemoveStock,
  onAddStock,
  allAssets,
}) => {
  const [showAddStock, setShowAddStock] = useState(false);
  const [addStockSearch, setAddStockSearch] = useState('');

  return (
    <div style={{
      background: C.bgCard,
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.cyan}60, ${C.cyan}20)` }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{'\uD83E\uDD16'}</span>
          <span style={{ ...sectionLabel(C.textMuted, '0.15em', '10px') }}>TRACKER BOT</span>
        </div>
        <span style={{ fontSize: 11, color: C.textMuted }}>Your watchlist, analyzed</span>
      </div>

      {/* Stock cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {watchlistStocks.map(stock => (
          <TrackerStockCard
            key={stock.symbol}
            stock={stock}
            expanded={expandedTracker === stock.symbol}
            onToggle={() => onToggleTracker(stock.symbol)}
            trackerData={trackerCache[stock.symbol]}
            trackerLoading={trackerLoading === stock.symbol}
            onRemove={onRemoveStock}
          />
        ))}
      </div>

      {/* Add stock button */}
      {onAddStock && (
        <button
          onClick={() => setShowAddStock(!showAddStock)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 10,
            background: C.bgElevated,
            border: `1px dashed ${C.border}`,
            color: C.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>+</span> Track another stock
        </button>
      )}

      {/* Add stock search */}
      {showAddStock && (
        <div style={{
          marginTop: 6,
          padding: '10px',
          borderRadius: 10,
          background: C.bgElevated,
          border: `1px solid ${C.cyan}20`,
          animation: 'rlp-fadeSlideIn 0.2s ease both',
        }}>
          <input
            autoFocus
            value={addStockSearch}
            onChange={e => setAddStockSearch(e.target.value.toUpperCase())}
            placeholder="Enter stock symbol (e.g. AAPL)"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              color: C.white,
              fontSize: 13,
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              boxSizing: 'border-box',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && addStockSearch.trim()) {
                onAddStock(addStockSearch.trim());
                setAddStockSearch('');
                setShowAddStock(false);
              }
              if (e.key === 'Escape') {
                setShowAddStock(false);
                setAddStockSearch('');
              }
            }}
          />
          {addStockSearch.length >= 1 && (
            <div style={{ marginTop: 6, maxHeight: 150, overflowY: 'auto' }}>
              {(allAssets || [])
                .filter(a => {
                  const sym = (a.symbol || a.ticker || '').toUpperCase();
                  const name = (a.name || '').toUpperCase();
                  const search = addStockSearch.toUpperCase();
                  return (sym.startsWith(search) || name.includes(search)) && !watchlistStocks.some(w => w.symbol === sym);
                })
                .slice(0, 5)
                .map(a => {
                  const sym = (a.symbol || a.ticker || '').toUpperCase();
                  return (
                    <button
                      key={sym}
                      onClick={() => {
                        onAddStock(sym);
                        setAddStockSearch('');
                        setShowAddStock(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: C.textSecondary,
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: C.white, fontFamily: "'JetBrains Mono', monospace", minWidth: 50 }}>{sym}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || ''}</span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Weekly Intel Report button */}
      <button
        onClick={onShowWeeklyReport}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '10px',
          borderRadius: 10,
          background: `${C.cyan}08`,
          border: `1px solid ${C.cyan}15`,
          color: C.cyan,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {'\uD83D\uDCCB'} View Weekly Intel Report
      </button>
    </div>
  );
};

// ─── EconomicEventsBotCard ───────────────────────────────────
const EconomicEventsBotCard = ({ buildMarketContextString, compact = false }) => {
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef(null);

  const questions = [
    { id: 'upcoming', icon: '📅', label: "What events are coming this week?" },
    { id: 'today', icon: '📊', label: "What economic data came out today?" },
    { id: 'trends', icon: '📈', label: "What are the economic trends right now?" },
  ];

  const handleAsk = useCallback(async (question) => {
    if (activeQuestion === question.id && answer) {
      setActiveQuestion(null);
      setAnswer(null);
      return;
    }

    setActiveQuestion(question.id);
    setAnswer(null);
    setLoading(true);

    try {
      const marketContext = buildMarketContextString ? buildMarketContextString() : '';

      const contextByQuestion = {
        upcoming: 'User is asking about upcoming economic events. Focus ONLY on the UPCOMING ECONOMIC EVENTS section of the market data. List each event with its date, time, tier, and what to expect. Be specific about dates and estimates.',
        today: 'User is asking about economic data released today. Focus ONLY on the RECENT ECONOMIC RELEASES section of the market data. Report actual values, whether they beat or missed estimates, and the immediate market reaction. If nothing was released today, say so clearly.',
        trends: 'User is asking about MACROECONOMIC trends — NOT stock market trends. IGNORE all stock prices, sector performance, and market breadth data. Focus EXCLUSIVELY on the economic indicators: CPI/inflation readings, employment/jobless claims, GDP growth, retail sales, consumer sentiment, manufacturing PMI, PCE, PPI, housing data, and Fed policy. Analyze the PREVIOUS values of these indicators to identify multi-month patterns. Is inflation rising or falling? Is the labor market tightening or loosening? Is consumer spending accelerating or slowing? Is manufacturing expanding or contracting? Use the actual economic data numbers, NOT stock prices.',
      };

      const response = await fetch('/api/research-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.label,
          parentContext: contextByQuestion[question.id] || 'User is asking about economic events and data releases.',
          marketContext,
        }),
      });
      const result = await response.json();

      if (result.success && result.data?.insights) {
        setAnswer(result.data.insights);
      } else {
        setAnswer([{ text: 'Unable to load economic data right now. Try again in a moment.', type: 'signal' }]);
      }
    } catch (error) {
      console.warn('[EconomicEventsBotCard] Error:', error);
      setAnswer([{ text: 'Connection error. Please try again.', type: 'signal' }]);
    } finally {
      setLoading(false);
    }
  }, [activeQuestion, answer, buildMarketContextString]);

  // Close popup when clicking outside
  useEffect(() => {
    if (!activeQuestion) return;
    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setActiveQuestion(null);
        setAnswer(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeQuestion]);

  return (
    <div ref={cardRef} style={{
      background: C.bgCard,
      borderRadius: compact ? 12 : 16,
      border: `1px solid ${C.border}`,
      padding: compact ? '14px 16px' : '20px',
      position: 'relative',
      overflow: 'visible',
    }}>
      {/* Amber accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: compact ? '12px 12px 0 0' : '16px 16px 0 0', background: `linear-gradient(90deg, ${C.amber}60, ${C.amber}20)` }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 10 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: compact ? 13 : 14 }}>{'\uD83D\uDCC5'}</span>
          <span style={{ ...sectionLabel(C.textMuted, '0.12em', compact ? '9px' : '10px') }}>ECONOMIC EVENTS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'rlp-pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: C.green, letterSpacing: '0.08em' }}>LIVE</span>
        </div>
      </div>

      {/* Question pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
        {questions.map(q => (
          <button
            key={q.id}
            onClick={() => handleAsk(q)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: compact ? '8px 10px' : '10px 12px',
              borderRadius: compact ? 8 : 10,
              background: activeQuestion === q.id ? `${C.amber}10` : C.bgElevated,
              border: `1px solid ${activeQuestion === q.id ? `${C.amber}30` : C.border}`,
              color: activeQuestion === q.id ? C.amber : C.textSecondary,
              fontSize: compact ? 11 : 12,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: compact ? 12 : 14, flexShrink: 0 }}>{q.icon}</span>
            <span style={{ flex: 1 }}>{q.label}</span>
            <span style={{ fontSize: 10, color: C.textMuted, transform: activeQuestion === q.id ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>{'\u25BC'}</span>
          </button>
        ))}
      </div>

      {/* Answer popup */}
      {activeQuestion && (loading || answer) && (
        <div style={{
          marginTop: 8,
          padding: '12px 14px',
          borderRadius: 12,
          background: C.bgElevated,
          border: `1px solid ${C.amber}20`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 1px ${C.amber}20`,
          animation: 'rlp-fadeSlideIn 0.25s ease both',
        }}>
          {loading ? (
            <ThinkingDots label="Checking economic calendar..." dotSize={4} delayStep={0.15} padding="4px 0" />
          ) : answer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {answer.map((ins, i) => (
                <InsightBullet key={i} text={ins.text} type={ins.type} index={i} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// ─── WeeklyReport (V2) ─────────────────────────────────────
const WeeklyReport = ({ visible, onClose, reportData, reportLoading }) => {
  if (!visible) return null;

  const signalColors = { bullish: C.green, bearish: C.red, neutral: C.textMuted };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 100,
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        maxHeight: '80vh',
        background: C.bgCard,
        borderRadius: '20px 20px 0 0',
        animation: 'rlp-slideUp 0.3s ease-out',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>{'\uD83D\uDCCB'}</span>
            <span style={{
              ...sectionLabel(C.cyan, '0.12em', '11px'),
            }}>
              WEEKLY INTEL
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px 24px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {reportLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  height: '14px',
                  borderRadius: '4px',
                  background: `linear-gradient(90deg, ${C.bgElevated} 25%, ${C.bgSurface} 50%, ${C.bgElevated} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'rlp-shimmer 1.5s infinite',
                  width: i === 4 ? '60%' : '100%',
                }} />
              ))}
            </div>
          ) : reportData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Period */}
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: C.textMuted,
                letterSpacing: '0.08em',
              }}>
                {reportData.period || 'This Week'}
              </div>

              {/* Summary */}
              <div style={{
                fontSize: '13px',
                color: C.textPrimary,
                lineHeight: 1.6,
              }}>
                {reportData.summary}
              </div>

              {/* Per-stock verdicts */}
              {reportData.stocks?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reportData.stocks.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      background: C.bgElevated,
                      borderRadius: '8px',
                    }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: C.cyan,
                        background: C.cyanDim,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        flexShrink: 0,
                      }}>
                        {s.symbol}
                      </span>
                      <span style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.4, flex: 1 }}>
                        {s.verdict}
                      </span>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: signalColors[s.signal] || C.textMuted,
                        marginTop: '5px',
                        flexShrink: 0,
                      }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Outlook */}
              {reportData.outlook && (
                <div style={{
                  padding: '10px 12px',
                  background: C.bgElevated,
                  borderRadius: '10px',
                  borderLeft: `3px solid ${C.amber}`,
                }}>
                  <div style={{
                    ...sectionLabel(C.amber),
                    marginBottom: '6px',
                  }}>
                    OUTLOOK
                  </div>
                  <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.5 }}>
                    {reportData.outlook}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: C.textMuted, fontSize: '13px' }}>
              Report unavailable. Try again later.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── BriefingTab (V2) ───────────────────────────────────────
const BriefingTab = ({ briefer, loading, watchlistStocks, expandedTracker, onToggleTracker, trackerCache, trackerLoading, onShowWeeklyReport, buildMarketContextString, onRemoveStock, onAddStock, allAssets }) => {
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: '12px',
      }}>
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: C.purple, animation: 'rlp-pulse 1.5s ease-in-out infinite',
        }} />
        <span style={{ fontSize: '12px', color: C.textMuted }}>Loading market intelligence...</span>
      </div>
    );
  }

  if (!briefer) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <span style={{ fontSize: '13px', color: C.textSecondary }}>
          Intelligence unavailable. Pull down to refresh.
        </span>
      </div>
    );
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {/* Headline card */}
      <div style={{
        background: C.bgCard,
        borderRadius: '14px',
        padding: '16px',
        border: `1px solid ${C.border}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}>
          <SentimentBadge sentiment={briefer.sentiment} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: `${C.purple}20`,
              color: C.purple,
              fontSize: '9px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              CLAUDE
            </span>
            <span style={{ fontSize: '10px', color: C.textMuted }}>{dateStr}</span>
          </div>
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: 700,
          color: C.white,
          lineHeight: 1.4,
        }}>
          {briefer.headline}
        </div>
      </div>

      {/* Ask the Briefer — Question Cards */}
      {briefer.questions?.length > 0 && (
        <div>
          <div style={{
            ...sectionLabel(C.textMuted),
            marginBottom: '8px',
            padding: '0 4px',
          }}>
            ASK THE BRIEFER
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {briefer.questions.map((q, i) => (
              <QuestionCard key={q.id || i} question={q} index={i} buildMarketContextString={buildMarketContextString} />
            ))}
          </div>
        </div>
      )}

      {/* Economic Events Bot */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <EconomicEventsBotCard buildMarketContextString={buildMarketContextString} compact />
      </div>

      {/* Tracker Bot */}
      <TrackerSection
        watchlistStocks={watchlistStocks}
        expandedTracker={expandedTracker}
        onToggleTracker={onToggleTracker}
        trackerCache={trackerCache}
        trackerLoading={trackerLoading}
        onRemoveStock={onRemoveStock}
        onAddStock={onAddStock}
        allAssets={allAssets}
      />

      {/* Weekly Report trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); onShowWeeklyReport(); }}
        style={{
          width: '100%',
          padding: '12px',
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: '10px',
          color: C.cyan,
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'border-color 0.2s',
        }}
      >
        <span>{'\uD83D\uDCCB'}</span>
        View Weekly Intel Report
      </button>
    </div>
  );
};

// ─── DiscoverTab ─────────────────────────────────────────────
const DiscoverTab = ({ scout, expandedSymbol, onToggleCard, threadCache, threadLoading, onOpenResearch }) => {
  if (!scout) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <span style={{ fontSize: '13px', color: C.textSecondary }}>
          No discoveries available right now.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {/* Header */}
      <div style={{
        ...sectionLabel(C.textMuted, '0.15em'),
        padding: '0 4px',
      }}>
        STOCKS YOU&apos;RE NOT WATCHING
      </div>

      {/* Discovery Cards */}
      {(scout.discoveries || []).map((disc, i) => (
        <DiscoveryCard
          key={disc.symbol || i}
          discovery={disc}
          expanded={expandedSymbol === disc.symbol}
          onToggle={() => onToggleCard(disc.symbol)}
          threadData={threadCache[disc.symbol]}
          threadLoading={threadLoading === disc.symbol}
          onOpenResearch={onOpenResearch}
        />
      ))}

      {/* Hot Sector */}
      <HotSectorCard sector={scout.hotSector} />
    </div>
  );
};

// ─── MobileIntelligenceHub ───────────────────────────────────
const MobileIntelligenceHub = ({
  intelData,
  intelLoading,
  intelCacheTime,
  onRefresh,
  onBuildThesis,
  onOpenMoneyMap,
  onAnalyzeStock,
  allAssets,
  handleOpenResearch,
  fetchThread,
  threadCache,
  watchlistStocks,
  fetchTracker,
  trackerCache,
  weeklyReportData,
  weeklyReportLoading,
  onFetchWeeklyReport,
  buildMarketContextString,
  expandedTracker,
  trackerLoading,
  handleToggleTracker,
  showWeeklyReport,
  setShowWeeklyReport,
  onRemoveStock,
  onAddStock,
}) => {
  const [activeTab, setActiveTab] = useState('briefing');
  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [threadLoading, setThreadLoading] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const briefer = intelData?.briefer;
  const scout = intelData?.scout;

  const handleToggleCard = useCallback(async (symbol) => {
    if (expandedSymbol === symbol) {
      setExpandedSymbol(null);
      return;
    }
    setExpandedSymbol(symbol);

    // Fetch thread if not cached
    if (!threadCache[symbol]) {
      setThreadLoading(symbol);
      const disc = scout?.discoveries?.find(d => d.symbol === symbol);
      await fetchThread(symbol, disc?.reason || '', { name: disc?.sector });
      setThreadLoading(null);
    }
  }, [expandedSymbol, threadCache, scout, fetchThread]);

  const handleOpenResearchFromThread = useCallback((symbol) => {
    const asset = allAssets.find(a => a.symbol === symbol);
    if (asset) handleOpenResearch(asset);
  }, [allAssets, handleOpenResearch]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allAssets?.length) return [];
    const q = searchQuery.toLowerCase();
    return allAssets
      .filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [searchQuery, allAssets]);

  // Cache age
  const cacheAge = intelCacheTime ? Math.floor((Date.now() - intelCacheTime) / 60000) : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      background: C.bgPrimary,
      position: 'relative',
    }}>
      {/* Tab Bar + Refresh */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: C.bgCard,
      }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0',
          flex: 1,
          position: 'relative',
        }}>
          {['briefing', 'discover'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'none',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: activeTab === tab ? C.cyan : C.textMuted,
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}
            >
              {tab === 'briefing' ? 'BRIEFING' : 'DISCOVER'}
            </button>
          ))}
          {/* Sliding indicator */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: activeTab === 'briefing' ? '0%' : '50%',
            width: '50%',
            height: '2px',
            background: C.cyan,
            borderRadius: '1px',
            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        {/* Refresh + Cache Age */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
          {cacheAge !== null && (
            <span style={{ fontSize: '9px', color: C.textMuted }}>
              {cacheAge}m ago
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={intelLoading}
            style={{
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: intelLoading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: intelLoading ? 0.5 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: '120px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {activeTab === 'briefing' ? (
          <BriefingTab
            briefer={briefer}
            loading={intelLoading}
            watchlistStocks={watchlistStocks}
            expandedTracker={expandedTracker}
            onToggleTracker={handleToggleTracker}
            trackerCache={trackerCache}
            trackerLoading={trackerLoading}
            onShowWeeklyReport={() => { onFetchWeeklyReport(); setShowWeeklyReport(true); }}
            buildMarketContextString={buildMarketContextString}
            onRemoveStock={onRemoveStock}
            onAddStock={onAddStock}
            allAssets={allAssets}
          />
        ) : (
          <DiscoverTab
            scout={scout}
            expandedSymbol={expandedSymbol}
            onToggleCard={handleToggleCard}
            threadCache={threadCache}
            threadLoading={threadLoading}
            onOpenResearch={handleOpenResearchFromThread}
          />
        )}
      </div>

      {/* Search Overlay */}
      {showSearch && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search stocks or crypto..."
              style={{
                flex: 1,
                padding: '12px 14px',
                background: C.bgCard,
                border: `1px solid ${C.borderActive}`,
                borderRadius: '10px',
                color: C.textPrimary,
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: C.textMuted,
                fontSize: '14px',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {searchResults.map(asset => (
              <div
                key={asset.symbol}
                onClick={() => {
                  handleOpenResearch(asset);
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 12px',
                  borderBottom: `1px solid ${C.border}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: C.cyan,
                  }}>
                    {asset.symbol}
                  </span>
                  <span style={{ fontSize: '13px', color: C.textSecondary }}>
                    {asset.name}
                  </span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixed Bottom Tool Strip */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        padding: '6px 8px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        background: C.bgCard,
        borderTop: `1px solid ${C.border}`,
        zIndex: 40,
      }}>
        <ToolStripButton
          accent={C.green}
          label="Thesis"
          onClick={onBuildThesis}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
          }
        />
        <ToolStripButton
          accent={C.cyan}
          label="Map"
          onClick={onOpenMoneyMap}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          }
        />
        <ToolStripButton
          accent={C.purple}
          label="Technical"
          onClick={onAnalyzeStock}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
        <ToolStripButton
          accent={C.amber}
          label="Search"
          onClick={() => setShowSearch(true)}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
        />
      </div>

    </div>
  );
};

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
  const [heroSize, setHeroSize] = useState({ w: 800, h: 320 });
  const heroRef = useRef(null);

  // ─── Mobile State ──────────────────────────────────────
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [intelData, setIntelData] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelCacheTime, setIntelCacheTime] = useState(null);
  const [threadCache, setThreadCache] = useState({});
  const [trackerCache, setTrackerCache] = useState({});
  const [weeklyReportData, setWeeklyReportData] = useState(null);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [expandedTracker, setExpandedTracker] = useState(null);
  const [trackerLoading, setTrackerLoading] = useState(null);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // ─── Asset Research Modal ────────────────────────────────
  const { researchAsset, isOpen, showResearch, hideResearch, getModalProps } = useAssetResearch();

  // ─── All assets for search ───────────────────────────────
  const allAssets = useMemo(() => [...stocksData, ...cryptoData], [stocksData, cryptoData]);

  // ─── Watchlist stocks for Tracker Bot ─────────────────────
  const [watchlistVersion, setWatchlistVersion] = useState(0);

  const watchlistStocks = useMemo(() => {
    let watchlist;
    try { watchlist = JSON.parse(localStorage.getItem('user_watchlist')); } catch (e) { /* ignore */ }
    if (!watchlist?.length) watchlist = DEFAULT_WATCHLIST;
    return watchlist.map(sym => {
      const asset = allAssets.find(a => a.symbol?.toUpperCase() === sym.toUpperCase());
      return {
        symbol: sym,
        price: asset?.price || 0,
        percentChange: safeNumber(asset?.percentChange, 0),
      };
    });
  }, [allAssets, watchlistVersion]);

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

    return { stocksUp, stocksDown, cryptoUp, cryptoDown, sentiment, ratio };
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

  // ─── Economic events (Firebase-cached calendar) ────────────
  const [economicEvents, setEconomicEvents] = useState([]);
  const [economicEventsLoading, setEconomicEventsLoading] = useState(false);

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

  }, []);

  // ─── Economic events fetch (Firebase-cached calendar) ──────
  const fetchEconomicEvents = useCallback(async (force = false) => {
    const CACHE_KEY = 'research_economic_calendar_cache';
    const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setEconomicEvents(data);
            return;
          }
        }
      } catch (e) { /* ignore cache errors */ }
    }

    setEconomicEventsLoading(true);
    try {
      const response = await fetch('/api/economic-calendar');
      const result = await response.json();

      if (result.success && result.data?.events?.length) {
        setEconomicEvents(result.data.events);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: result.data.events,
            timestamp: Date.now(),
          }));
        } catch (e) { /* ignore storage errors */ }
      } else {
        // Fallback to static data if Firebase empty
        const { WEEK_AHEAD_EVENTS } = await import('../../data/weekAheadEvents');
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 7);
        const fmt = d => d.toISOString().split('T')[0];
        setEconomicEvents(WEEK_AHEAD_EVENTS
          .filter(e => e.date >= fmt(today) && e.date <= fmt(endDate))
          .sort((a, b) => a.date.localeCompare(b.date)));
      }
    } catch (err) {
      console.warn('[ResearchLanding] Economic events fetch failed:', err);
      try {
        const { WEEK_AHEAD_EVENTS } = await import('../../data/weekAheadEvents');
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 7);
        const fmt = d => d.toISOString().split('T')[0];
        setEconomicEvents(WEEK_AHEAD_EVENTS
          .filter(e => e.date >= fmt(today) && e.date <= fmt(endDate))
          .sort((a, b) => a.date.localeCompare(b.date)));
      } catch (fallbackErr) {
        console.warn('[ResearchLanding] Fallback also failed:', fallbackErr);
      }
    } finally {
      setEconomicEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEconomicEvents();
  }, [fetchEconomicEvents]);

  // ─── AI Summary (desktop) ─────────────────────────────────
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
      } catch (err) {
        console.warn('[ResearchLanding] AI summary fetch failed:', err);
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

  // ─── Resize listener (mobile detection) ──────────────────
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Mobile Intelligence Fetching ────────────────────────
  const buildIntelContext = useCallback(() => {
    // Watchlist from localStorage
    let watchlist;
    try {
      const saved = localStorage.getItem('user_watchlist');
      if (saved) watchlist = JSON.parse(saved);
    } catch (e) { /* ignore */ }
    if (!watchlist?.length) watchlist = DEFAULT_WATCHLIST;

    // Battle stocks from localStorage
    let battleStocks = [];
    try {
      const battles = JSON.parse(localStorage.getItem('portfolioDuelBattles') || '[]');
      const symbolSet = new Set();
      battles.forEach(battle => {
        const portfolio = battle?.player1?.portfolio;
        if (Array.isArray(portfolio)) {
          // Flat array format
          portfolio.forEach(item => {
            if (typeof item === 'string') symbolSet.add(item);
            else if (item?.symbol) symbolSet.add(item.symbol);
          });
        } else if (portfolio && typeof portfolio === 'object') {
          // V3 tiered format: { star: [...], core: [...], support: [...] }
          ['star', 'core', 'support'].forEach(tier => {
            (portfolio[tier] || []).forEach(item => {
              if (typeof item === 'string') symbolSet.add(item);
              else if (item?.symbol) symbolSet.add(item.symbol);
            });
          });
        }
      });
      battleStocks = [...symbolSet];
    } catch (e) { /* ignore */ }

    return {
      stocksUp: marketBreadth.stocksUp,
      stocksDown: marketBreadth.stocksDown,
      breadthRatio: marketBreadth.ratio,
      gainers: (moversData.gainers || []).slice(0, 5).map(s => ({
        symbol: s.symbol,
        name: s.name,
        change: safeNumber(s.percentChange, 0),
      })),
      losers: (moversData.losers || []).slice(0, 5).map(s => ({
        symbol: s.symbol,
        name: s.name,
        change: safeNumber(s.percentChange, 0),
      })),
      news: (marketNews || []).slice(0, 5).map(n => ({ title: n.title })),
      watchlist,
      battleStocks,
      economicEvents: economicEvents.slice(0, 5).map(e => ({
        date: e.date,
        name: e.shortName || e.name,
        tier: e.tier,
        impact: e.tier === 1 ? 'high' : e.tier === 2 ? 'medium' : 'low',
      })),
    };
  }, [marketBreadth, moversData, marketNews, economicEvents]);

  const buildMarketContextString = useCallback(() => {
    // If no stock data loaded yet, return minimal context with grounding guard
    if (!stocksData?.length && !allAssets?.length) {
      return 'Market data is currently loading. Provide general educational analysis only. Do not cite specific stock prices.';
    }

    const parts = [];
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    parts.push(`Market data as of ${today}:`);

    // 1. Overall breadth
    const { stocksUp, stocksDown, ratio } = marketBreadth;
    parts.push(`\nMARKET BREADTH: ${stocksUp} stocks advancing, ${stocksDown} declining (${((ratio) * 100).toFixed(0)}% positive)`);

    // 2. All stocks grouped by sector with real prices
    const stocks = stocksData?.length ? stocksData : allAssets;
    // Build reverse lookup: symbol → sector name from SECTORS constant
    const sectorLookup = {};
    Object.values(SECTORS).forEach(sec => {
      (sec.topHoldings || []).forEach(sym => { sectorLookup[sym] = sec.name; });
    });

    const sectorMap = {};
    stocks.forEach(stock => {
      const symbol = stock.symbol || stock.ticker;
      if (!symbol) return;
      const change = safeNumber(stock.percentChange || stock.change24h, 0);
      const price = safeNumber(stock.price, 0);
      const sector = sectorLookup[symbol.toUpperCase()] || stock.sector || 'Other';
      if (!sectorMap[sector]) sectorMap[sector] = [];
      sectorMap[sector].push({ symbol, change, price });
    });

    // Sort sectors by average change (best first), format each
    parts.push('\nSTOCKS BY SECTOR (sorted by daily change):');
    Object.entries(sectorMap)
      .sort(([, a], [, b]) => {
        const avgA = a.reduce((sum, s) => sum + s.change, 0) / a.length;
        const avgB = b.reduce((sum, s) => sum + s.change, 0) / b.length;
        return avgB - avgA;
      })
      .forEach(([sector, sectorStocks]) => {
        const sorted = [...sectorStocks].sort((a, b) => b.change - a.change);
        const stockList = sorted
          .map(s => `${s.symbol} ${s.change >= 0 ? '+' : ''}${s.change.toFixed(1)}%${s.price ? ` ($${s.price.toFixed(2)})` : ''}`)
          .join(', ');
        const avgChange = (sorted.reduce((sum, s) => sum + s.change, 0) / sorted.length).toFixed(1);
        parts.push(`\n${sector.toUpperCase()} (avg ${avgChange >= 0 ? '+' : ''}${avgChange}%): ${stockList}`);
      });

    // 3. Top gainers/losers from moversData (may include stocks not in stocksData)
    const gainers = (moversData.gainers || []).slice(0, 5);
    const losers = (moversData.losers || []).slice(0, 5);
    if (gainers.length > 0) {
      parts.push(`\nTOP GAINERS: ${gainers.map(g => `${g.symbol} ${safeNumber(g.percentChange, 0) >= 0 ? '+' : ''}${safeNumber(g.percentChange, 0).toFixed(1)}%`).join(', ')}`);
    }
    if (losers.length > 0) {
      parts.push(`\nTOP DECLINERS: ${losers.map(l => `${l.symbol} ${safeNumber(l.percentChange, 0) >= 0 ? '+' : ''}${safeNumber(l.percentChange, 0).toFixed(1)}%`).join(', ')}`);
    }

    // 4. Hot sector from cached intel
    if (intelData?.scout?.hotSector) {
      parts.push(`\nHOT SECTOR: ${intelData.scout.hotSector.name} — ${intelData.scout.hotSector.why || ''}`);
    }

    // 5. Scout discoveries (unusual movers)
    if (intelData?.scout?.discoveries?.length) {
      const disc = intelData.scout.discoveries.map(d => `${d.symbol} ${safeNumber(d.change, 0) > 0 ? '+' : ''}${safeNumber(d.change, 0)}% (${d.reason})`).join('; ');
      parts.push(`\nUNUSUAL MOVERS: ${disc}`);
    }

    // 6. Upcoming economic events (enriched with tier/volatility/context)
    if (economicEvents?.length) {
      const todayStr = new Date().toISOString().split('T')[0];
      const upcoming = economicEvents
        .filter(e => e.date >= todayStr)
        .sort((a, b) => (a.tier || 3) - (b.tier || 3) || a.date.localeCompare(b.date))
        .slice(0, 10);

      if (upcoming.length) {
        parts.push('\nUPCOMING ECONOMIC EVENTS:');
        upcoming.forEach(e => {
          const dateStr = new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          let detail = `${dateStr}: ${e.shortName || e.name}`;
          if (e.estimate != null) detail += ` (Estimate: ${e.estimate})`;
          if (e.previous != null) detail += ` (Previous: ${e.previous})`;
          if (e.tier === 1) detail += ' [TIER 1 - HIGH IMPACT]';
          else if (e.tier === 2) detail += ' [TIER 2]';
          if (e.volatilityGrade) detail += ` [Vol: ${e.volatilityGrade}]`;
          if (e.context) detail += ` — ${e.context}`;
          parts.push(detail);
        });
      }

      // Recent releases that have actual values
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
      const recent = economicEvents
        .filter(e => e.date >= threeDaysAgoStr && e.date < todayStr && e.actual != null)
        .sort((a, b) => (a.tier || 3) - (b.tier || 3))
        .slice(0, 5);

      if (recent.length) {
        parts.push('\nRECENT ECONOMIC RELEASES:');
        recent.forEach(e => {
          const dateStr = new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          let detail = `${dateStr}: ${e.shortName || e.name} — Actual: ${e.actual}`;
          if (e.estimate != null) detail += `, Estimate was: ${e.estimate}`;
          if (e.previous != null) detail += `, Previous: ${e.previous}`;
          if (e.beatMiss) {
            detail += e.beatMiss === 'beat' ? ' [BEAT]' : e.beatMiss === 'miss' ? ' [MISS]' : ' [IN LINE]';
          }
          if (e.marketReaction) detail += ` — Reaction: ${e.marketReaction}`;
          parts.push(detail);
        });
      }
    }

    return parts.join('\n');
  }, [stocksData, allAssets, marketBreadth, moversData, intelData, economicEvents]);

  const buildFallbackIntel = useCallback(() => {
    const gainers = (moversData.gainers || []).slice(0, 3);
    const { sentiment, stocksUp, stocksDown } = marketBreadth;

    // Watchlist from localStorage for exclusion
    let watchlist;
    try {
      const saved = localStorage.getItem('user_watchlist');
      if (saved) watchlist = JSON.parse(saved);
    } catch (e) { /* ignore */ }
    if (!watchlist?.length) watchlist = DEFAULT_WATCHLIST;
    const watchSet = new Set(watchlist.map(s => s.toUpperCase()));

    // Build discoveries from top movers NOT in watchlist
    const allMovers = [...(moversData.gainers || []), ...(moversData.losers || [])];
    const discoveries = allMovers
      .filter(m => !watchSet.has(m.symbol?.toUpperCase()))
      .slice(0, 3)
      .map(m => ({
        symbol: m.symbol,
        name: m.name || m.symbol,
        change: safeNumber(m.percentChange, 0),
        reason: `Moving ${safeNumber(m.percentChange, 0) > 0 ? 'up' : 'down'} ${Math.abs(safeNumber(m.percentChange, 0)).toFixed(1)}% today with notable volume activity.`,
        actionTag: safeNumber(m.percentChange, 0) > 3 ? 'momentum' : 'early_signal',
        sector: m.sector || 'Unknown',
      }));

    const breadthType = sentiment === 'bullish' ? 'positive' : sentiment === 'bearish' ? 'negative' : 'signal';

    return {
      briefer: {
        headline: sentiment === 'bullish'
          ? `Markets up: ${stocksUp} stocks advancing`
          : sentiment === 'bearish'
            ? `Markets pressured: ${stocksDown} stocks declining`
            : `Mixed session: ${stocksUp} up, ${stocksDown} down`,
        sentiment,
        questions: [
          {
            id: 'market_pulse',
            icon: '\uD83D\uDCCA',
            label: 'What\'s driving the market today?',
            answer: {
              insights: [
                { text: `Market breadth: ${stocksUp} stocks advancing vs ${stocksDown} declining.`, type: breadthType },
                ...(gainers.length > 0 ? [{ text: `${gainers[0]?.symbol} leading gainers at +${safeNumber(gainers[0]?.percentChange, 0).toFixed(1)}%.`, type: 'positive' }] : []),
              ],
            },
            followUps: ['Which sectors are strongest?', 'Any volume anomalies?'],
          },
          {
            id: 'sector_watch',
            icon: '\uD83C\uDFED',
            label: 'Which sectors are leading or lagging?',
            answer: {
              insights: [
                { text: 'Sector data requires live intelligence. Tap refresh for AI analysis.', type: 'signal' },
              ],
            },
            followUps: ['Which sector has most momentum?', 'Any sectors showing weakness?'],
          },
          {
            id: 'risk_radar',
            icon: '\uD83D\uDEE1\uFE0F',
            label: 'Any risks I should watch for?',
            answer: {
              insights: [
                { text: sentiment === 'bearish' ? `Broad weakness with ${stocksDown} stocks declining — monitor positions.` : 'No major risk signals detected in current session.', type: sentiment === 'bearish' ? 'negative' : 'signal' },
              ],
            },
            followUps: ['What are biggest macro risks?', 'How should I think about sizing?'],
          },
          {
            id: 'earnings_events',
            icon: '\uD83D\uDCC5',
            label: 'Key earnings & events this week?',
            answer: {
              insights: [
                { text: economicEvents.length > 0 ? `${economicEvents[0].shortName || economicEvents[0].name} scheduled for ${economicEvents[0].date}${economicEvents[0].tier === 1 ? ' (Tier 1 - high impact)' : economicEvents[0].tier === 2 ? ' (Tier 2)' : ''}.` : 'No major economic events this week.', type: 'signal' },
              ],
            },
            followUps: ['Which earnings could move markets?', 'Any surprises expected?'],
          },
          {
            id: 'trade_setup',
            icon: '\uD83C\uDFAF',
            label: 'Any interesting setups forming?',
            answer: {
              insights: [
                ...(gainers.length > 1 ? [{ text: `${gainers[1]?.symbol} showing strength at +${safeNumber(gainers[1]?.percentChange, 0).toFixed(1)}% — worth monitoring.`, type: 'positive' }] : []),
                { text: 'Full setup analysis requires live intelligence. Tap refresh for AI analysis.', type: 'signal' },
              ],
            },
            followUps: ['What timeframe for these setups?', 'Any contrarian plays?'],
          },
        ],
      },
      scout: {
        discoveries,
        hotSector: null,
      },
    };
  }, [moversData, marketBreadth, economicEvents]);

  const fetchIntelligence = useCallback(async (force = false) => {
    // Check cache first (unless forced)
    if (!force) {
      try {
        const cached = localStorage.getItem(INTEL_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < INTEL_CACHE_DURATION) {
            setIntelData(data);
            setIntelCacheTime(timestamp);
            return;
          }
        }
      } catch (e) { /* ignore */ }
    }

    setIntelLoading(true);
    try {
      const context = buildIntelContext();
      const response = await fetch('/api/research-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const now = Date.now();
        setIntelData(result.data);
        setIntelCacheTime(now);
        try {
          localStorage.setItem(INTEL_CACHE_KEY, JSON.stringify({ data: result.data, timestamp: now }));
        } catch (e) { /* ignore storage errors */ }
      } else {
        // Use fallback
        const fallback = buildFallbackIntel();
        setIntelData(fallback);
        setIntelCacheTime(Date.now());
      }
    } catch (err) {
      console.warn('[ResearchLanding] Intel fetch failed:', err);
      const fallback = buildFallbackIntel();
      setIntelData(fallback);
      setIntelCacheTime(Date.now());
    } finally {
      setIntelLoading(false);
    }
  }, [buildIntelContext, buildFallbackIntel]);

  const fetchThread = useCallback(async (symbol, discoveryContext, sectorContext) => {
    if (threadCache[symbol]) return;

    try {
      const response = await fetch('/api/research-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, discoveryContext, sectorContext }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setThreadCache(prev => ({ ...prev, [symbol]: result.data }));
      }
    } catch (err) {
      console.warn('[ResearchLanding] Thread fetch failed:', err);
      setThreadCache(prev => ({ ...prev, [symbol]: {
        bullets: ['Unable to load analysis. Try again in a moment.'],
        verdict: null, risk: null
      } }));
    }
  }, [threadCache]);

  const fetchTracker = useCallback(async (symbol, price, percentChange) => {
    if (trackerCache[symbol]) return;
    try {
      const response = await fetch('/api/research-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, price, percentChange }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setTrackerCache(prev => ({ ...prev, [symbol]: result.data }));
      }
    } catch (err) {
      console.warn('[ResearchLanding] Tracker fetch failed:', err);
      setTrackerCache(prev => ({ ...prev, [symbol]: {
        priceAction: 'Unable to load analysis. Try again later.',
        technicalLevel: null, news: null, baggerBomb: null
      } }));
    }
  }, [trackerCache]);

  const handleToggleTracker = useCallback(async (symbol) => {
    if (expandedTracker === symbol) {
      setExpandedTracker(null);
      return;
    }
    setExpandedTracker(symbol);
    if (!trackerCache[symbol]) {
      setTrackerLoading(symbol);
      const stock = watchlistStocks.find(s => s.symbol === symbol);
      await fetchTracker(symbol, stock?.price, stock?.percentChange);
      setTrackerLoading(null);
    }
  }, [expandedTracker, trackerCache, watchlistStocks, fetchTracker]);

  // Watchlist management
  const handleAddToWatchlist = useCallback((symbol) => {
    try {
      let currentWatchlist;
      try { currentWatchlist = JSON.parse(localStorage.getItem('user_watchlist')); } catch (e) { /* ignore */ }
      if (!currentWatchlist?.length) currentWatchlist = [...DEFAULT_WATCHLIST];
      if (currentWatchlist.map(s => s.toUpperCase()).includes(symbol.toUpperCase())) return;
      const updated = [...currentWatchlist, symbol];
      localStorage.setItem('user_watchlist', JSON.stringify(updated));
      setWatchlistVersion(prev => prev + 1);
    } catch (e) {
      console.warn('[ResearchLanding] Failed to add to watchlist:', e);
    }
  }, []);

  const handleRemoveFromWatchlist = useCallback((symbol) => {
    try {
      let currentWatchlist;
      try { currentWatchlist = JSON.parse(localStorage.getItem('user_watchlist')); } catch (e) { /* ignore */ }
      if (!currentWatchlist?.length) currentWatchlist = [...DEFAULT_WATCHLIST];
      const updated = currentWatchlist.filter(s => s.toUpperCase() !== symbol.toUpperCase());
      localStorage.setItem('user_watchlist', JSON.stringify(updated));
      if (expandedTracker === symbol) setExpandedTracker(null);
      setWatchlistVersion(prev => prev + 1);
    } catch (e) {
      console.warn('[ResearchLanding] Failed to remove from watchlist:', e);
    }
  }, [expandedTracker]);

  const fetchWeeklyReport = useCallback(async () => {
    // Check 24h cache
    try {
      const cached = localStorage.getItem('research_weekly_report_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setWeeklyReportData(data);
          return;
        }
      }
    } catch (e) { /* ignore */ }

    setWeeklyReportLoading(true);
    try {
      const response = await fetch('/api/research-weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist: watchlistStocks.map(s => s.symbol),
          stockData: watchlistStocks,
        }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setWeeklyReportData(result.data);
        try {
          localStorage.setItem('research_weekly_report_cache', JSON.stringify({
            data: result.data,
            timestamp: Date.now(),
          }));
        } catch (e) { /* ignore storage errors */ }
      }
    } catch (err) {
      console.warn('[ResearchLanding] Weekly report fetch failed:', err);
      setWeeklyReportData({ summary: 'Weekly report unavailable. Try again later.', stocks: [], outlook: null });
    } finally {
      setWeeklyReportLoading(false);
    }
  }, [watchlistStocks]);

  // ─── Trigger mobile intelligence fetch ───────────────────
  useEffect(() => {
    if (isMobile && stocksData.length > 0) {
      fetchIntelligence();
    }
  }, [isMobile, stocksData.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Mobile Layout ─────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <MobileIntelligenceHub
          intelData={intelData}
          intelLoading={intelLoading}
          intelCacheTime={intelCacheTime}
          onRefresh={() => fetchIntelligence(true)}
          onBuildThesis={onBuildThesis}
          onOpenMoneyMap={onOpenMoneyMap}
          onAnalyzeStock={onAnalyzeStock}
          allAssets={allAssets}
          handleOpenResearch={handleOpenResearch}
          fetchThread={fetchThread}
          threadCache={threadCache}
          watchlistStocks={watchlistStocks}
          fetchTracker={fetchTracker}
          trackerCache={trackerCache}
          weeklyReportData={weeklyReportData}
          weeklyReportLoading={weeklyReportLoading}
          onFetchWeeklyReport={fetchWeeklyReport}
          buildMarketContextString={buildMarketContextString}
          expandedTracker={expandedTracker}
          trackerLoading={trackerLoading}
          handleToggleTracker={handleToggleTracker}
          showWeeklyReport={showWeeklyReport}
          setShowWeeklyReport={setShowWeeklyReport}
          onRemoveStock={handleRemoveFromWatchlist}
          onAddStock={handleAddToWatchlist}
        />
        <WeeklyReport
          visible={showWeeklyReport}
          onClose={() => setShowWeeklyReport(false)}
          reportData={weeklyReportData}
          reportLoading={weeklyReportLoading}
        />
        {isOpen && researchAsset && (
          <AssetResearchModal
            {...getModalProps()}
            showActionButton={false}
          />
        )}
      </>
    );
  }

  // ─── Desktop Layout ────────────────────────────────────────
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
              ...sectionLabel(C.textMuted, '0.15em', '10px'),
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
                  animation: 'rlp-spin 1s linear infinite',
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
                ...sectionLabel(C.green, '0.1em', '10px'),
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
                ...sectionLabel(C.red, '0.1em', '10px'),
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

      {/* Row 1: 3 pathway cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
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
      </div>

      {/* Row 2: Quick Research + Intel Chat */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginTop: '12px',
      }}>
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

        {/* Intel Chat */}
        <DesktopIntelChat buildMarketContextString={buildMarketContextString} />
      </div>

      {/* ═══ ZONE 3: Bottom Row ═══ */}
      <SectionDivider label="INTELLIGENCE FEED" />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
      }}>
        <DesktopTrackerSection
          watchlistStocks={watchlistStocks}
          expandedTracker={expandedTracker}
          onToggleTracker={handleToggleTracker}
          trackerCache={trackerCache}
          trackerLoading={trackerLoading}
          onShowWeeklyReport={() => { fetchWeeklyReport(); setShowWeeklyReport(true); }}
          onRemoveStock={handleRemoveFromWatchlist}
          onAddStock={handleAddToWatchlist}
          allAssets={allAssets}
        />
        <EconomicEventsBotCard buildMarketContextString={buildMarketContextString} />
      </div>

      {/* ═══ Weekly Report Modal (Desktop) ═══ */}
      <WeeklyReport
        visible={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
        reportData={weeklyReportData}
        reportLoading={weeklyReportLoading}
      />

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
