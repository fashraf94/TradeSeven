// src/components/Research/WhyMovingPopup.jsx
//
// Bottom-sheet overlay showing Perplexity Sonar's explanation
// for why a stock is moving. Reusable across AssetResearchModal,
// MoverRow, and TrackerStockCard.
//
// v2: Structured catalyst-first layout with type badges, signals, peer context.
// Backward-compatible with v1 response format (explanation/factors/keyDataPoint/outlook).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// =============================================================================
// INLINE THINKING DOTS
// =============================================================================

const ThinkingDots = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 0' }}>
    <div style={{ display: 'flex', gap: '3px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: HOLO_COLORS.primary,
          animation: `whyMovingPulse 1s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
    <span style={{ fontSize: '12px', color: HOLO_COLORS.textSecondary }}>
      Searching for latest news...
    </span>
  </div>
);

// =============================================================================
// CATALYST TYPE BADGE CONFIG
// =============================================================================

const CATALYST_TYPES = {
  earnings:  { color: '#00C853', label: 'EARNINGS' },
  analyst:   { color: '#2979FF', label: 'ANALYST' },
  guidance:  { color: '#FFD600', label: 'GUIDANCE' },
  macro:     { color: '#AA00FF', label: 'MACRO' },
  sector:    { color: '#00E5FF', label: 'SECTOR' },
  news:      { color: '#E0E0E0', label: 'NEWS' },
  technical: { color: '#757575', label: 'TECHNICAL' },
  unknown:   { color: '#424242', label: 'NO CLEAR CATALYST' },
};

// =============================================================================
// SIGNAL / FACTOR ROW (shared between v1 and v2)
// =============================================================================

const DIRECTION_CONFIG = {
  up:      { arrow: '\u25B2', color: HOLO_COLORS.green },
  down:    { arrow: '\u25BC', color: '#ff4757' },
  neutral: { arrow: '\u25CF', color: HOLO_COLORS.textSecondary },
};

// v1 factor row
const FactorRow = ({ direction, text }) => {
  const config = DIRECTION_CONFIG[direction] || DIRECTION_CONFIG.neutral;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0' }}>
      <span style={{ color: config.color, fontSize: '12px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>
        {config.arrow}
      </span>
      <span style={{ color: HOLO_COLORS.textPrimary, fontSize: '13px', lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
};

// v2 signal row — label bold, detail as secondary line
const SignalRow = ({ signal }) => {
  const dirMap = { bullish: 'up', bearish: 'down', neutral: 'neutral' };
  const dir = dirMap[signal.type] || 'neutral';
  const config = DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.neutral;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0' }}>
      <span style={{ color: config.color, fontSize: '12px', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>
        {config.arrow}
      </span>
      <div style={{ flex: 1 }}>
        <span style={{ color: HOLO_COLORS.textPrimary, fontSize: '13px', fontWeight: '600' }}>
          {signal.label}
        </span>
        {signal.detail && (
          <span style={{ color: HOLO_COLORS.textPrimary, fontSize: '13px', lineHeight: 1.5 }}>
            {' — '}{signal.detail}
          </span>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// CATALYST BADGE
// =============================================================================

const CatalystBadge = ({ catalystType }) => {
  const config = CATALYST_TYPES[catalystType] || CATALYST_TYPES.unknown;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      color: config.color,
      background: `${config.color}18`,
      border: `1px solid ${config.color}30`,
    }}>
      {config.label}
    </span>
  );
};

// =============================================================================
// CITATIONS (shared)
// =============================================================================

const Citations = ({ citations }) => {
  if (!citations || citations.length === 0) return null;
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px',
      paddingTop: '4px', borderTop: '1px solid #21262d',
    }}>
      <span style={{ fontSize: '10px', color: HOLO_COLORS.textMuted, alignSelf: 'center' }}>
        Sources:
      </span>
      {citations.map((url, i) => {
        let hostname = url;
        try { hostname = new URL(url).hostname.replace('www.', ''); } catch { /* use raw */ }
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '11px', color: HOLO_COLORS.primary, textDecoration: 'none',
              padding: '2px 6px', background: 'rgba(0, 217, 255, 0.08)', borderRadius: '4px',
            }}
          >
            {hostname}
          </a>
        );
      })}
    </div>
  );
};

// =============================================================================
// V2 SUCCESS CONTENT
// =============================================================================

const V2Content = ({ data }) => {
  const timestampStr = data.timestamp
    ? new Date(data.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Catalyst headline */}
      <p style={{ color: HOLO_COLORS.textPrimary, fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
        {data.catalyst}
      </p>

      {/* Catalyst type badge */}
      {data.catalystType && <CatalystBadge catalystType={data.catalystType} />}

      {/* Signals */}
      {data.signals && data.signals.length > 0 && (
        <div style={{ padding: '12px', background: HOLO_COLORS.bgElevated, borderRadius: '8px' }}>
          {data.signals.map((s, i) => (
            <SignalRow key={i} signal={s} />
          ))}
        </div>
      )}

      {/* Peer Context */}
      {data.peerContext && (
        <div style={{
          padding: '10px 12px', borderRadius: '8px',
          background: 'rgba(0, 229, 255, 0.05)',
          border: '1px solid rgba(0, 229, 255, 0.12)',
        }}>
          <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>
            {data.peerContext}
          </span>
        </div>
      )}

      {/* Outlook / Watch Next */}
      {data.outlook && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <span style={{ fontSize: '13px', flexShrink: 0 }}>{'\uD83D\uDCC5'}</span>
          <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px', fontStyle: 'italic', lineHeight: 1.5 }}>
            {data.outlook}
          </span>
        </div>
      )}

      {/* Source quality note */}
      {data.sourceQuality === 'low' && (
        <span style={{ fontSize: '10px', color: HOLO_COLORS.textMuted, fontStyle: 'italic' }}>
          Limited sources available
        </span>
      )}

      {/* Citations */}
      <Citations citations={data.citations} />

      {/* Timestamp */}
      {timestampStr && (
        <span style={{ fontSize: '10px', color: HOLO_COLORS.textMuted, textAlign: 'right' }}>
          Updated {timestampStr}
        </span>
      )}
    </div>
  );
};

// =============================================================================
// V1 SUCCESS CONTENT (backward compat)
// =============================================================================

const V1Content = ({ data }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Explanation */}
    <p style={{ color: HOLO_COLORS.textPrimary, fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
      {data.explanation}
    </p>

    {/* Factors */}
    {data.factors && data.factors.length > 0 && (
      <div style={{ padding: '12px', background: HOLO_COLORS.bgElevated, borderRadius: '8px' }}>
        {data.factors.map((f, i) => (
          <FactorRow key={i} direction={f.direction} text={f.text} />
        ))}
      </div>
    )}

    {/* Key Data Point */}
    {data.keyDataPoint && (
      <div style={{
        padding: '10px 12px',
        background: 'rgba(0, 217, 255, 0.06)',
        border: '1px solid rgba(0, 217, 255, 0.15)',
        borderRadius: '8px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '14px' }}>{'\uD83D\uDCCA'}</span>
        <span style={{ color: HOLO_COLORS.textPrimary, fontSize: '13px', fontWeight: '600' }}>
          {data.keyDataPoint}
        </span>
      </div>
    )}

    {/* Outlook */}
    {data.outlook && (
      <p style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
        {data.outlook}
      </p>
    )}

    {/* Citations */}
    <Citations citations={data.citations} />
  </div>
);

// =============================================================================
// COMPONENT
// =============================================================================

const WhyMovingPopup = ({ symbol, name, change, price, isOpen, onClose, open, high, low, close, peerMoves }) => {
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [data, setData] = useState(null);
  const cacheRef = useRef({});
  const abortRef = useRef(null);

  const fetchExplanation = useCallback(async (sym) => {
    // Check in-component session cache
    if (cacheRef.current[sym]) {
      setData(cacheRef.current[sym]);
      setState('success');
      return;
    }

    setState('loading');
    setData(null);

    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body = { symbol: sym, name, change, price };
      // Include OHLC data if available
      if (typeof open === 'number') body.open = open;
      if (typeof high === 'number') body.high = high;
      if (typeof low === 'number') body.low = low;
      if (typeof close === 'number') body.close = close;
      // Include peer moves if available
      if (peerMoves && peerMoves.length > 0) body.peerMoves = peerMoves;

      const res = await fetch('/api/why-moving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const result = await res.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Unknown error');
      }

      cacheRef.current[sym] = result.data;
      setData(result.data);
      setState('success');
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[WhyMoving] Fetch error:', err.message);
      setState('error');
    }
  }, [name, change, price, open, high, low, close, peerMoves]);

  // Fetch when popup opens with a valid symbol
  useEffect(() => {
    if (isOpen && symbol) {
      fetchExplanation(symbol);
    }
    if (!isOpen) {
      setState('idle');
    }
  }, [isOpen, symbol, fetchExplanation]);

  // Escape key dismisses
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const changeStr = typeof change === 'number'
    ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
    : '';
  const displayName = name || symbol;

  // Detect v2 response (has catalyst field)
  const isV2 = data?.catalyst !== undefined;

  return (
    <>
      {/* Keyframe for thinking dots */}
      <style>{`
        @keyframes whyMovingPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>

      <AnimatePresence>
        {isOpen && symbol && (
          <>
            {/* Backdrop */}
            <motion.div
              key="why-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 9998,
              }}
            />

            {/* Bottom Sheet */}
            <motion.div
              key="why-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Why is ${displayName} moving?`}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: '#1c2128',
                borderRadius: '16px 16px 0 0',
                padding: '20px',
                zIndex: 9999,
                maxHeight: '70vh',
                overflowY: 'auto',
              }}
            >
              {/* Drag Handle */}
              <div style={{
                width: '40px', height: '4px', borderRadius: '2px',
                background: '#30363d', margin: '0 auto 16px',
              }} />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <h3 style={{
                  color: HOLO_COLORS.textPrimary, fontSize: '16px', fontWeight: '700', margin: 0,
                }}>
                  Why is {displayName} {changeStr ? changeStr : 'moving'}?
                </h3>
                {changeStr && (
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                    background: change >= 0 ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                    color: change >= 0 ? HOLO_COLORS.green : '#ff4757',
                  }}>
                    {changeStr}
                  </span>
                )}
              </div>

              {/* Loading State */}
              {state === 'loading' && <ThinkingDots />}

              {/* Error State */}
              {state === 'error' && (
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <p style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px', margin: '0 0 12px' }}>
                    Couldn't fetch explanation right now.
                  </p>
                  <button
                    onClick={() => fetchExplanation(symbol)}
                    style={{
                      background: 'rgba(0, 217, 255, 0.1)',
                      border: '1px solid rgba(0, 217, 255, 0.3)',
                      borderRadius: '8px',
                      color: HOLO_COLORS.primary,
                      fontSize: '13px', fontWeight: '600',
                      padding: '8px 16px', cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Success State */}
              {state === 'success' && data && (
                isV2 ? <V2Content data={data} /> : <V1Content data={data} />
              )}

              {/* Dismiss Button */}
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', border: 'none',
                  color: HOLO_COLORS.primary, fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer', padding: '12px 0 4px',
                  width: '100%', textAlign: 'center', marginTop: '8px',
                }}
              >
                Got it
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default WhyMovingPopup;
