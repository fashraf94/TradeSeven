// DEPRECATED: Replaced by FantasyTimes newsroom
// CurtainScreen — Full-screen daily market briefing overlay
// Shown on cold launch (new tab). Typewriter animation over particle canvas.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { isMarketOpen } from '../../utils/marketSchedule';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPEWRITER_SPEED_MS = 20;
const PARTICLE_COLORS = {
  cyan: { r: 0, g: 217, b: 255 },
  purple: { r: 147, g: 51, b: 234 },
};
const CONNECTION_DISTANCE = 150;
const CONNECTION_MAX_OPACITY = 0.2;
const CONNECTION_LINE_WIDTH = 0.75;
const MAX_DPR = 2;

const INDEX_ORDER = ['SPY', 'DIA', 'IWM', 'RSP'];

// ---------------------------------------------------------------------------
// Particle Canvas
// ---------------------------------------------------------------------------

function createParticles(width, height, isMobile) {
  const count = isMobile ? 30 : 50;
  const particles = [];
  for (let i = 0; i < count; i++) {
    const isCyan = Math.random() < 0.6;
    const color = isCyan ? PARTICLE_COLORS.cyan : PARTICLE_COLORS.purple;
    const opacity = 0.35 + Math.random() * 0.30;
    const radius = 1.5 + Math.random() * 2.5;
    const speed = 0.15 + Math.random() * 0.20;
    const angle = Math.random() * Math.PI * 2;

    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      color,
      opacity,
    });
  }
  return particles;
}

function ParticleCanvas({ isMobile }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = createParticles(w, h, isMobile);
    };

    resize();

    const animate = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * CONNECTION_MAX_OPACITY;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 217, 255, ${alpha})`;
            ctx.lineWidth = CONNECTION_LINE_WIDTH;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isMobile]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Index Snapshot Bar
// ---------------------------------------------------------------------------

function IndexBar({ indexes }) {
  if (!indexes) return null;

  const items = INDEX_ORDER
    .filter(ticker => indexes[ticker])
    .map(ticker => ({
      ticker,
      pct: indexes[ticker].percentChange,
    }));

  if (items.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      padding: '8px 0 4px',
      fontSize: '11px',
      fontFamily: 'Inter, system-ui, monospace',
      letterSpacing: '0.02em',
    }}>
      {items.map((item, i) => (
        <React.Fragment key={item.ticker}>
          {i > 0 && (
            <span style={{ color: HOLO_COLORS.textMuted, margin: '0 2px' }}>·</span>
          )}
          <span style={{ color: HOLO_COLORS.textSecondary, fontWeight: 500 }}>
            {item.ticker}
          </span>
          <span style={{
            color: item.pct >= 0 ? HOLO_COLORS.greenMuted : HOLO_COLORS.redMuted,
            fontWeight: 600,
          }}>
            {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(1)}%
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ticker Pill
// ---------------------------------------------------------------------------

function TickerPill({ ticker }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      margin: '0 3px',
      borderRadius: '4px',
      border: `1px solid ${HOLO_COLORS.borderGlow}`,
      color: HOLO_COLORS.primary,
      fontSize: '11px',
      fontFamily: 'monospace',
      fontWeight: 500,
      lineHeight: '18px',
      verticalAlign: 'middle',
    }}>
      {ticker}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CurtainScreen
// ---------------------------------------------------------------------------

export default function CurtainScreen({ briefing, onDismiss, isMobile }) {
  const [revealedParagraph, setRevealedParagraph] = useState(0);
  const [revealedChar, setRevealedChar] = useState(0);
  const [fullyRevealed, setFullyRevealed] = useState(false);
  const [showDismissHint, setShowDismissHint] = useState(false);
  const intervalRef = useRef(null);
  const dismissHintTimerRef = useRef(null);

  const latest = briefing?.latest;
  const marketOpen = useMemo(() => isMarketOpen(), []);

  // Build paragraphs array from data
  const paragraphs = useMemo(() => {
    if (latest?.paragraphs && Array.isArray(latest.paragraphs) && latest.paragraphs.length > 0) {
      return latest.paragraphs;
    }
    // Fallback: split brief by double newline
    if (latest?.brief) {
      return latest.brief.split('\n\n').filter(Boolean).map(text => ({ text, tickers: [] }));
    }
    return [];
  }, [latest]);

  // Typewriter effect
  useEffect(() => {
    if (paragraphs.length === 0 || fullyRevealed) return;

    intervalRef.current = setInterval(() => {
      setRevealedChar(prev => {
        const currentText = paragraphs[revealedParagraph]?.text || '';
        if (prev >= currentText.length) {
          // Move to next paragraph
          setRevealedParagraph(pIdx => {
            const next = pIdx + 1;
            if (next >= paragraphs.length) {
              clearInterval(intervalRef.current);
              setFullyRevealed(true);
              return pIdx;
            }
            return next;
          });
          return 0;
        }
        return prev + 1;
      });
    }, TYPEWRITER_SPEED_MS);

    return () => clearInterval(intervalRef.current);
  }, [paragraphs, revealedParagraph, fullyRevealed]);

  // Show dismiss hint after full reveal
  useEffect(() => {
    if (fullyRevealed) {
      dismissHintTimerRef.current = setTimeout(() => setShowDismissHint(true), 500);
    }
    return () => clearTimeout(dismissHintTimerRef.current);
  }, [fullyRevealed]);

  // Handle tap/click
  const handleTap = useCallback(() => {
    if (!fullyRevealed) {
      // Skip to full reveal
      clearInterval(intervalRef.current);
      setRevealedParagraph(paragraphs.length - 1);
      setRevealedChar(paragraphs[paragraphs.length - 1]?.text?.length || 0);
      setFullyRevealed(true);
    } else {
      onDismiss();
    }
  }, [fullyRevealed, paragraphs, onDismiss]);

  if (!latest || paragraphs.length === 0) return null;

  return (
    <div
      onClick={handleTap}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10002,
        background: HOLO_COLORS.bgDeep,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Particle background */}
      <ParticleCanvas isMobile={isMobile} />

      {/* Content overlay */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '600px',
        padding: isMobile ? '60px 20px 40px' : '80px 32px 40px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}>
        {/* Bot identity bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
        }}>
          {/* ClashBot avatar */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${HOLO_COLORS.primary}, ${HOLO_COLORS.purple})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}>
            C
          </div>

          {/* Name */}
          <span style={{
            color: HOLO_COLORS.textPrimary,
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            ClashBot
          </span>

          {/* Market status pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            marginLeft: 'auto',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: marketOpen ? HOLO_COLORS.greenMuted : HOLO_COLORS.redMuted,
              boxShadow: marketOpen
                ? `0 0 6px ${HOLO_COLORS.greenMuted}`
                : `0 0 6px ${HOLO_COLORS.redMuted}`,
            }} />
            <span style={{
              color: HOLO_COLORS.textSecondary,
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>
        </div>

        {/* Index snapshot bar */}
        <IndexBar indexes={latest.indexes} />

        {/* Chapter label */}
        <div style={{
          color: HOLO_COLORS.textSecondary,
          fontSize: '12px',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '20px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {latest.label || 'Market Update'}
        </div>

        {/* Narrative text with typewriter */}
        <div style={{ flex: 1 }}>
          {paragraphs.map((para, pIdx) => {
            if (pIdx > revealedParagraph && !fullyRevealed) return null;

            const text = para.text || '';
            const isCurrentParagraph = pIdx === revealedParagraph && !fullyRevealed;
            const visibleText = isCurrentParagraph
              ? text.slice(0, revealedChar)
              : (pIdx <= revealedParagraph || fullyRevealed) ? text : '';

            if (!visibleText) return null;

            const tickers = para.tickers || [];
            const showTickers = fullyRevealed || pIdx < revealedParagraph;

            return (
              <div key={pIdx} style={{ marginBottom: '16px' }}>
                <p style={{
                  color: HOLO_COLORS.textPrimary,
                  fontSize: isMobile ? '15px' : '16px',
                  lineHeight: 1.7,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  margin: 0,
                }}>
                  {visibleText}
                  {isCurrentParagraph && (
                    <span style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '1em',
                      background: HOLO_COLORS.primary,
                      marginLeft: '1px',
                      verticalAlign: 'text-bottom',
                      animation: 'curtainBlink 1s step-end infinite',
                    }} />
                  )}
                </p>
                {showTickers && tickers.length > 0 && (
                  <div style={{ marginTop: '6px' }}>
                    {tickers.map(t => <TickerPill key={t} ticker={t} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dismiss hint */}
        {showDismissHint && (
          <div style={{
            textAlign: 'center',
            paddingTop: '24px',
            paddingBottom: '20px',
            opacity: showDismissHint ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}>
            <span style={{
              color: HOLO_COLORS.textMuted,
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              Tap anywhere to continue
            </span>
          </div>
        )}
      </div>

      {/* Blink animation for cursor */}
      <style>{`
        @keyframes curtainBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
