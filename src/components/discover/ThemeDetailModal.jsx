// src/components/discover/ThemeDetailModal.jsx
//
// Rich detail modal for a Discover theme. Opens when a ThemeCard is
// tapped; reads the rich content (coreThesis, full chain layers,
// sub-angle theses, risk + signals, inflection points) from the
// build-time DKB bundle keyed by Firestore doc id.
//
// Edge cases handled:
//   - 3-layer chain (Dollar Strength) — layer section count is data
//     driven, no fixed-slot assumption
//   - 4-ticker primary (Cybersecurity) — ticker rows are data-driven
//   - Empty layer-level tickers (Consumer Bifurcation Layer 3) —
//     renders the layer with description and sub-thesis; ticker row
//     replaced by an italic note instead of an empty chip row
//
// The "Start in Workshop" CTA invokes the onStartWorkshop callback
// supplied by DiscoverPanel, which logs analytics and asks
// ForgeLanding to open Workshop with a theme seedContext.

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeRichEntry } from './themesDkb';

export default function ThemeDetailModal({ isOpen, theme, onClose, onStartWorkshop }) {
  const { tokens } = useTheme();

  // Body scroll lock + Esc handler. Both are gated on isOpen so the
  // listeners are torn down when the modal closes.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const richEntry = theme?.id ? getThemeRichEntry(theme.id) : null;
  const fe = richEntry?.fullEntry || null;

  // Portal to <body> so the overlay reliably covers the whole viewport —
  // including the Forge's segmented nav and the bottom nav — instead of being
  // re-based by the scrollable area it's mounted inside (iOS fixed-in-scroll).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {isOpen && theme && (
        <motion.div
          key="theme-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <motion.div
            key="theme-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="theme-modal-title"
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: '90vh',
              background: tokens.bgApp,
              borderRadius: 20,
              border: `1px solid ${tokens.borderDefault}`,
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ModalHeader theme={theme} tokens={tokens} onClose={onClose} />

            <div
              style={{
                overflowY: 'auto',
                padding: '8px 28px 28px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
              }}
            >
              <Tagline narrative={theme.narrative} tokens={tokens} />

              {fe?.narrative?.coreThesis && (
                <Section label="The Thesis" tokens={tokens}>
                  <p style={bodyParagraph(tokens)}>{fe.narrative.coreThesis}</p>
                </Section>
              )}

              {Array.isArray(fe?.chain?.layers) && fe.chain.layers.length > 0 && (
                <Section label="The Chain" tokens={tokens}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {fe.chain.layers.map((layer, idx) => (
                      <ChainLayer
                        key={`layer-${layer.order ?? idx}`}
                        layer={layer}
                        index={idx}
                        tokens={tokens}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {Array.isArray(fe?.subAngles) && fe.subAngles.length > 0 && (
                <Section label="Three Ways to Play" tokens={tokens}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {fe.subAngles.map((sa, idx) => (
                      <SubAngle key={`sa-${idx}`} subAngle={sa} tokens={tokens} />
                    ))}
                  </div>
                </Section>
              )}

              {Array.isArray(fe?.whatBreaksTheThesis) &&
                fe.whatBreaksTheThesis.length > 0 && (
                  <Section label="What Breaks the Thesis" tokens={tokens}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {fe.whatBreaksTheThesis.map((wb, idx) => (
                        <RiskBlock key={`wb-${idx}`} entry={wb} tokens={tokens} />
                      ))}
                    </div>
                  </Section>
                )}

              {Array.isArray(fe?.inflectionPoints) && fe.inflectionPoints.length > 0 && (
                <Section label="Inflection Points" tokens={tokens}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {fe.inflectionPoints.map((ip, idx) => (
                      <InflectionPoint key={`ip-${idx}`} entry={ip} tokens={tokens} />
                    ))}
                  </div>
                </Section>
              )}

              {!fe && (
                <div
                  style={{
                    color: tokens.textMuted,
                    fontSize: 13,
                    fontStyle: 'italic',
                  }}
                >
                  Detailed content for this theme is loading from the DKB
                  bundle.
                </div>
              )}
            </div>

            <ModalFooter
              tokens={tokens}
              onStartWorkshop={() => onStartWorkshop?.(theme)}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function ModalHeader({ theme, tokens, onClose }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '24px 28px 12px',
        borderBottom: `1px solid ${tokens.borderDefault}`,
      }}
    >
      <h2
        id="theme-modal-title"
        style={{
          margin: 0,
          paddingRight: 40,
          fontSize: 22,
          fontWeight: 700,
          color: tokens.textPrimary,
          lineHeight: 1.25,
        }}
      >
        {theme.title}
      </h2>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tokens.bgIcon,
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          color: tokens.textMuted,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}

function Tagline({ narrative, tokens }) {
  if (!narrative) return null;
  return (
    <p
      style={{
        margin: '12px 0 0',
        fontSize: 14,
        color: tokens.textSecondary,
        lineHeight: 1.6,
      }}
    >
      {narrative}
    </p>
  );
}

function Section({ label, tokens, children }) {
  return (
    <section>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: tokens.teal,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

function ChainLayer({ layer, index, tokens }) {
  const order = layer.order ?? index + 1;
  const tickers = Array.isArray(layer.tickers) ? layer.tickers : [];

  return (
    <div
      style={{
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: tokens.textFaint,
            letterSpacing: '0.5px',
            minWidth: 28,
          }}
        >
          {String(order).padStart(2, '0')}
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.3,
          }}
        >
          {layer.label}
        </h3>
      </div>

      {layer.description && (
        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: 13,
            color: tokens.textSecondary,
            lineHeight: 1.55,
          }}
        >
          {layer.description}
        </p>
      )}

      {tickers.length > 0 ? (
        <TickerRow tickers={tickers} tokens={tokens} />
      ) : (
        <div
          style={{
            fontSize: 12,
            color: tokens.textFaint,
            fontStyle: 'italic',
          }}
        >
          No in-universe pure-plays.
        </div>
      )}

      {layer.subThesis && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 13,
            color: tokens.textMuted,
            lineHeight: 1.55,
          }}
        >
          {layer.subThesis}
        </p>
      )}

      {layer.riskProfile && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: tokens.textFaint,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600 }}>Risk profile: </span>
          {layer.riskProfile}
        </p>
      )}
    </div>
  );
}

function SubAngle({ subAngle, tokens }) {
  const tickers = Array.isArray(subAngle.tickers) ? subAngle.tickers : [];
  return (
    <div
      style={{
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          color: tokens.textPrimary,
          lineHeight: 1.3,
        }}
      >
        {subAngle.angle}
      </h3>
      {subAngle.thesis && (
        <p style={bodyParagraph(tokens, '10px 0 0')}>{subAngle.thesis}</p>
      )}
      {tickers.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <TickerRow tickers={tickers} tokens={tokens} />
        </div>
      )}
      {subAngle.idealFor && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 12,
            color: tokens.textFaint,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600 }}>Ideal for: </span>
          {subAngle.idealFor}
        </p>
      )}
    </div>
  );
}

function RiskBlock({ entry, tokens }) {
  const signals = Array.isArray(entry.signalsToWatch) ? entry.signalsToWatch : [];
  return (
    <div
      style={{
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      {entry.risk && (
        <p style={bodyParagraph(tokens, '0')}>{entry.risk}</p>
      )}
      {signals.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: tokens.textFaint,
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            Signals to watch
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: tokens.textMuted,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {signals.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function InflectionPoint({ entry, tokens }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: '12px 14px',
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          minWidth: 70,
          fontSize: 11,
          fontWeight: 700,
          color: tokens.teal,
          letterSpacing: '0.5px',
        }}
      >
        {entry.date || '—'}
      </div>
      <div style={{ flex: 1 }}>
        {entry.narrativeHandle && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: tokens.textPrimary,
              lineHeight: 1.3,
              marginBottom: 4,
            }}
          >
            {entry.narrativeHandle}
          </div>
        )}
        {entry.event && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: tokens.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {entry.event}
          </p>
        )}
        {entry.significance && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: tokens.textMuted,
              lineHeight: 1.55,
            }}
          >
            {entry.significance}
          </p>
        )}
      </div>
    </div>
  );
}

function TickerRow({ tickers, tokens }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tickers.map((t) => (
        <span
          key={t}
          style={{
            background: tokens.bgAgent,
            border: `1px solid ${tokens.borderDefault}`,
            color: tokens.teal,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            letterSpacing: '0.3px',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ModalFooter({ tokens, onStartWorkshop }) {
  return (
    <div
      style={{
        padding: '16px 28px',
        borderTop: `1px solid ${tokens.borderDefault}`,
        background: tokens.bgApp,
      }}
    >
      <button
        type="button"
        onClick={onStartWorkshop}
        style={{
          width: '100%',
          appearance: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 18px',
          background: tokens.teal,
          border: 'none',
          borderRadius: 10,
          color: tokens.bgApp,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.3px',
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = tokens.glowTealNav;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Sparkles size={16} />
        Build a watchlist
      </button>
    </div>
  );
}

function bodyParagraph(tokens, margin = '0') {
  return {
    margin,
    fontSize: 13,
    color: tokens.textSecondary,
    lineHeight: 1.6,
  };
}
