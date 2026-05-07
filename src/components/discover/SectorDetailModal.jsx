// src/components/discover/SectorDetailModal.jsx
//
// Rich detail modal for a Discover sector. Opens when a SectorCard is
// tapped. Displays four sections: header (ticker + name + regime tag +
// 1d/5d + optional medal), regime-context body, top holdings (tappable
// for tap_top_holding analytics + future stock detail), and related
// themes (tappable for cross-modal handoff to ThemeDetailModal).
//
// Modal shell (overlay, scale-in card, Esc + click-outside +
// body-scroll-lock) mirrors the pattern in ThemeDetailModal.jsx but
// is built fresh here — extracting a shared shell would touch Sprint 1
// code and is out of scope for this sprint.
//
// Cross-modal handoff:
//   Tap a theme chip → write tap_linked_theme_from_sector analytics
//   with sourceSectorTicker → call onLinkedThemeTap(themeId) which
//   asks DiscoverPanel to close this sector modal and open the theme
//   modal. Closing the theme modal afterwards returns the user to the
//   bare Discover surface, NOT back to the sector modal — by design.
//
// Defensive guards:
//   - getSectorContent(ticker) returns null → close modal with toast
//     "Content for this sector is not available." (data drift; should
//     not happen in practice).
//   - linkedThemes entry that doesn't resolve to an active theme in
//     DiscoverPanel's themes array → silently skip with console.warn.
//     Don't render a broken chip.
//
// Analytics writes are fire-and-forget (try/catch around addDoc); a
// logging failure must never surface to the user.

import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Medal, LineChart, Sparkles, ArrowRight } from 'lucide-react';
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTheme } from '../../contexts/ThemeContext';
import { SECTORS as SECTOR_HOLDINGS_MAP } from '../../constants/sectors';
import { getSectorContent } from './sectorContent';

// Schema legacy: themeId is the field name preserved from Sprint 1
// (DiscoverPanel.jsx logInteraction). For Sprint 2 sector writes it
// functions as a generic primary entity ID — sector ticker for
// tap_sector_card and tap_top_holding, theme docId for
// tap_linked_theme_from_sector. Don't rename.
async function logSectorInteraction({ themeId, action, extra }) {
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid || !themeId || !action) return;
    await addDoc(collection(db, 'discoverInteractions'), {
      userId: uid,
      themeId,
      action,
      timestamp: serverTimestamp(),
      source: 'discoverSectors',
      ...(extra || {}),
    });
  } catch (err) {
    console.error('[SectorDetailModal] Failed to log interaction:', err);
  }
}

function formatPct(val) {
  if (val == null || Number.isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function formatMedalLabel(fiveDayPct) {
  if (fiveDayPct == null || Number.isNaN(fiveDayPct)) return '5d —';
  const sign = fiveDayPct >= 0 ? '+' : '';
  return `5d ${sign}${fiveDayPct.toFixed(1)}%`;
}

function pctColor(val, tokens) {
  if (val == null || Number.isNaN(val)) return tokens.textFaint;
  if (val > 0) return tokens.emerald;
  if (val < 0) return tokens.red;
  return tokens.textMuted;
}

function medalColor(rank, tokens) {
  if (rank === 1) return tokens.medalGold;
  if (rank === 2) return tokens.medalSilver;
  if (rank === 3) return tokens.medalBronze;
  return null;
}

export default function SectorDetailModal({
  ticker,
  isOpen,
  oneDayPct,
  fiveDayPct,
  medalRank,
  themes,
  onClose,
  onLinkedThemeTap,
  onViewChartTap,
  onHoldingChipTap,
  onStartWorkshop,
  showToast,
}) {
  const { tokens } = useTheme();

  const content = ticker ? getSectorContent(ticker) : null;
  const holdings = ticker
    ? SECTOR_HOLDINGS_MAP[ticker]?.topHoldings?.slice(0, 5) || []
    : [];

  // Resolve linkedThemes against the themes array DiscoverPanel passes
  // down. "Active in Firestore" is the source of truth for what users
  // see — themesDkb intentionally not used here (would render chips
  // for paused themes, contrary to spec).
  const linkedThemeObjects = useMemo(() => {
    if (!content?.linkedThemes || !Array.isArray(themes)) return [];
    return content.linkedThemes
      .map((themeId) => {
        const theme = themes.find((t) => t.id === themeId);
        if (!theme) {
          console.warn(
            `[SectorDetailModal] linkedTheme "${themeId}" not in active themes — skipping chip.`
          );
          return null;
        }
        return theme;
      })
      .filter(Boolean);
  }, [content, themes]);

  // Body-scroll-lock + Esc handler. Both gated on isOpen so listeners
  // tear down when the modal closes. Mirrors ThemeDetailModal.jsx.
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

  // Defensive: if the modal opens for a ticker that has no content
  // entry (data drift between Firestore registry and constants), close
  // with a toast. Should not happen in practice — the SectorRail
  // already filters out tickers missing a SECTOR_CONTENT entry.
  useEffect(() => {
    if (!isOpen || !ticker) return;
    if (content) return;
    if (typeof showToast === 'function') {
      showToast('Content for this sector is not available.');
    }
    onClose?.();
  }, [isOpen, ticker, content, showToast, onClose]);

  const handleHoldingTap = (holdingTicker) => {
    if (!holdingTicker) return;
    logSectorInteraction({
      themeId: holdingTicker,
      action: 'tap_holding_chip_from_sector',
      extra: { sourceSectorTicker: ticker },
    });
    onHoldingChipTap?.(holdingTicker);
  };

  const handleLinkedThemeTap = (theme) => {
    if (!theme?.id) return;
    logSectorInteraction({
      themeId: theme.id,
      action: 'tap_linked_theme_from_sector',
      extra: { sourceSectorTicker: ticker },
    });
    onLinkedThemeTap?.(theme.id);
  };

  // Sprint 2.6 cross-modal handoff: SectorDetailModal → AssetResearchModal.
  // SectorRail closes its own modal first, then DiscoverPanel opens the
  // research modal. Mirrors the sector → theme handoff pattern.
  const handleViewChartTap = () => {
    if (!ticker) return;
    logSectorInteraction({
      themeId: ticker,
      action: 'tap_view_chart_from_sector',
      extra: { sourceSectorTicker: ticker },
    });
    onViewChartTap?.(ticker);
  };

  // Sprint 5 Phase 1: discover-to-workshop bridge for the sector path.
  // Mirrors ThemeDetailModal's footer CTA. SectorRail closes its own
  // modal before invoking the callback; DiscoverPanel logs the
  // analytics row with source 'discoverSectors' and asks ForgeLanding
  // to open Workshop with a sector seedContext. Pre-flight gates
  // (agent?.id, atLaunchCap, nextUpcoming) are owned by ForgeLanding.
  const handleStartWorkshopTap = () => {
    if (!ticker) return;
    onStartWorkshop?.(ticker);
  };

  const badgeColor = medalColor(medalRank, tokens);

  return (
    <AnimatePresence>
      {isOpen && ticker && content && (
        <motion.div
          key="sector-modal-overlay"
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
            key="sector-modal-card"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sector-modal-title"
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
            <ModalHeader
              ticker={ticker}
              content={content}
              oneDayPct={oneDayPct}
              fiveDayPct={fiveDayPct}
              medalRank={medalRank}
              badgeColor={badgeColor}
              tokens={tokens}
              onClose={onClose}
            />

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
              <Section label="What this sector reflects" tokens={tokens}>
                <p style={bodyParagraph(tokens)}>{content.body}</p>
              </Section>

              <ViewChartCTA
                tokens={tokens}
                onClick={handleViewChartTap}
              />

              <Section
                label="Top Holdings"
                subhead="By ETF weight"
                tokens={tokens}
              >
                {holdings.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    {holdings.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleHoldingTap(h)}
                        style={tickerChipStyle(tokens)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = tokens.teal;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor =
                            tokens.borderDefault;
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.textFaint,
                      fontStyle: 'italic',
                    }}
                  >
                    Holdings data unavailable.
                  </div>
                )}
              </Section>

              <Section
                label="Related Themes"
                subhead="This sector touches these active themes"
                tokens={tokens}
              >
                {linkedThemeObjects.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {linkedThemeObjects.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleLinkedThemeTap(theme)}
                        style={themeChipStyle(tokens)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = tokens.teal;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor =
                            tokens.borderDefault;
                        }}
                      >
                        {theme.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.textFaint,
                      fontStyle: 'italic',
                    }}
                  >
                    No related themes are currently active.
                  </div>
                )}
              </Section>
            </div>

            <ModalFooter
              tokens={tokens}
              onStartWorkshop={handleStartWorkshopTap}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function ModalHeader({
  ticker,
  content,
  oneDayPct,
  fiveDayPct,
  medalRank,
  badgeColor,
  tokens,
  onClose,
}) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '24px 28px 16px',
        borderBottom: `1px solid ${tokens.borderDefault}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingRight: 44,
          flexWrap: 'wrap',
        }}
      >
        <h2
          id="sector-modal-title"
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.2,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            letterSpacing: '0.5px',
          }}
        >
          {ticker}
        </h2>
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: tokens.textSecondary,
            lineHeight: 1.2,
          }}
        >
          {content.name}
        </span>
        {badgeColor && (
          <span
            aria-label={`Hot this week: rank ${medalRank}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px 4px 8px',
              background: tokens.bgIcon,
              border: `1px solid ${badgeColor}`,
              borderRadius: 999,
              color: badgeColor,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.3px',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            }}
          >
            <Medal size={12} strokeWidth={2.5} />
            <span style={{ color: pctColor(fiveDayPct, tokens) }}>
              {formatMedalLabel(fiveDayPct)}
            </span>
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <span
          style={{
            background: tokens.bgIcon,
            border: `1px solid ${tokens.borderDefault}`,
            color: tokens.teal,
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.3px',
          }}
        >
          {content.regimeTag}
        </span>
        <span
          style={{
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.5,
            flex: '1 1 220px',
          }}
        >
          {content.leadLag}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <PctReadout label="1d" value={oneDayPct} tokens={tokens} />
        <PctReadout label="5d" value={fiveDayPct} tokens={tokens} />
      </div>
    </div>
  );
}

function PctReadout({ label, value, tokens }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: tokens.textFaint,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: pctColor(value, tokens),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatPct(value)}
      </span>
    </div>
  );
}

function Section({ label, subhead, tokens, children }) {
  return (
    <section>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color: tokens.teal,
          }}
        >
          {label}
        </div>
        {subhead && (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: tokens.textFaint,
              lineHeight: 1.4,
            }}
          >
            {subhead}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function bodyParagraph(tokens) {
  return {
    margin: 0,
    fontSize: 13,
    color: tokens.textSecondary,
    lineHeight: 1.6,
  };
}

function tickerChipStyle(tokens) {
  return {
    appearance: 'none',
    background: tokens.bgAgent,
    border: `1px solid ${tokens.borderDefault}`,
    color: tokens.teal,
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    letterSpacing: '0.3px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  };
}

function ViewChartCTA({ tokens, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={viewChartButtonStyle(tokens)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.teal;
        e.currentTarget.style.background = tokens.bgCard;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.borderDefault;
        e.currentTarget.style.background = tokens.bgIcon;
      }}
    >
      <LineChart size={16} strokeWidth={2.25} />
      <span>Open Chart View</span>
    </button>
  );
}

function viewChartButtonStyle(tokens) {
  return {
    appearance: 'none',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: tokens.bgIcon,
    border: `1px solid ${tokens.borderDefault}`,
    color: tokens.teal,
    padding: '12px 16px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.3px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background 0.15s ease',
  };
}

function themeChipStyle(tokens) {
  return {
    appearance: 'none',
    background: tokens.bgCard,
    border: `1px solid ${tokens.borderDefault}`,
    color: tokens.textPrimary,
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.3,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s ease',
  };
}

// Sprint 5 Phase 1: Workshop handoff footer. Same visual treatment as
// ThemeDetailModal's footer so the affordance reads consistently across
// both Discover entry points.
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
        Start in Workshop
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
