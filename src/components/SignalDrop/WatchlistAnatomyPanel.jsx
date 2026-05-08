// src/components/SignalDrop/WatchlistAnatomyPanel.jsx
//
// Sprint 6 Phase 3C — sidebar that visualizes the full 6-slot anatomy
// of a watchlist mid-dialogue. Replaces 3B's temporary slot-grouped
// ticker list. Renders six sections in fixed order:
//
//   1. Thesis                  — paragraph from anatomy.thesis
//   2. Activation Conditions   — numbered list (anatomy.activationConditions)
//   3. Invalidation Conditions — numbered list (anatomy.invalidationConditions)
//   4. Core Plays              — tickers where slot === 'core'
//   5. Discovery Plays         — tickers where slot === 'discovery'  ← Asymmetric Edge
//   6. Cross-Currents          — tickers where slot === 'cross_current'
//
// Tickers without a slot (or slot === null) are intentionally not shown
// — the dialogue layer is responsible for placing them. They surface in
// the chat thread, not the structural panel.
//
// Discovery Plays is visually distinguished as the user-contributed
// asymmetric edge: 3px teal accent border, "Asymmetric Edge" label
// chip, info tooltip, and ✦ marker on each ticker. This is the load-
// bearing product position decision — these picks read as a different
// class of ticker, not just another category.
//
// Live updates: each section receives a `pulseKey` that increments when
// its underlying state changes (anatomy.thesis hash, condition list
// length, ticker list signature). On change, AnatomySection runs a
// one-shot ~300ms `signaldrop-pulse` keyframe on the section background.
//
// Mobile: the panel slides in from the right when WatchlistChat's
// sidebar toggle is tapped. The slide is a subtle `x: 24 → 0` entrance
// — WatchlistChat owns the show/hide via `display`, so this just
// softens the transition into view.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ListTree } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import AnatomySection from './AnatomySection';

const TICKER_SLOTS = ['core', 'discovery', 'cross_current'];

const DISCOVERY_TOOLTIP =
  'These are tickers you contribute that the agent wouldn’t surface on its own — your asymmetric edge in battle.';

function groupTickersBySlot(tickers) {
  const groups = { core: [], discovery: [], cross_current: [] };
  if (!Array.isArray(tickers)) return groups;
  for (const t of tickers) {
    if (!t?.symbol) continue;
    if (TICKER_SLOTS.includes(t.slot)) {
      groups[t.slot].push(t);
    }
  }
  return groups;
}

// Lightweight content-signature for pulse triggering. We don't need
// cryptographic uniqueness — any change to the rendered content should
// flip the signature. JSON.stringify is fine here because the inputs
// are small (≤3 conditions, ≤12 tickers in practice).
function tickersSignature(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list
    .map((t) => `${t.symbol}:${t.status || ''}:${(t.reasoning || '').slice(0, 40)}`)
    .join('|');
}

export default function WatchlistAnatomyPanel({
  anatomy,
  candidateTickers,
  agentName,
}) {
  const { tokens } = useTheme();

  const safeAnatomy =
    anatomy && typeof anatomy === 'object' && !Array.isArray(anatomy)
      ? anatomy
      : { thesis: null, activationConditions: [], invalidationConditions: [] };

  const thesis = typeof safeAnatomy.thesis === 'string' ? safeAnatomy.thesis : '';
  const activationConditions = Array.isArray(safeAnatomy.activationConditions)
    ? safeAnatomy.activationConditions
    : [];
  const invalidationConditions = Array.isArray(safeAnatomy.invalidationConditions)
    ? safeAnatomy.invalidationConditions
    : [];

  const grouped = useMemo(() => groupTickersBySlot(candidateTickers), [candidateTickers]);

  // Pulse keys — change when content changes so AnatomySection can
  // trigger its one-shot highlight animation.
  const thesisPulseKey = thesis ? thesis.length : 0;
  const activationPulseKey = activationConditions.join('§').length + activationConditions.length;
  const invalidationPulseKey =
    invalidationConditions.join('§').length + invalidationConditions.length;
  const corePulseKey = tickersSignature(grouped.core).length + grouped.core.length;
  const discoveryPulseKey =
    tickersSignature(grouped.discovery).length + grouped.discovery.length;
  const crossCurrentPulseKey =
    tickersSignature(grouped.cross_current).length + grouped.cross_current.length;

  const totalTickers =
    grouped.core.length + grouped.discovery.length + grouped.cross_current.length;
  const hasAnyContent =
    Boolean(thesis) ||
    activationConditions.length > 0 ||
    invalidationConditions.length > 0 ||
    totalTickers > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${tokens.borderDefault}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: tokens.textPrimary,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          <ListTree size={14} color={tokens.teal} />
          Watchlist Anatomy
        </div>
        {totalTickers > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              background: tokens.bgIcon,
              color: tokens.teal,
            }}
          >
            {totalTickers}
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 10px 14px',
        }}
      >
        {/* 1. Thesis */}
        <AnatomySection
          title="Thesis"
          defaultExpanded={Boolean(thesis)}
          pulseKey={thesisPulseKey}
          hasContent={Boolean(thesis)}
          emptyMessage="Not yet established. The thesis emerges in the explore phase."
        >
          <ThesisBody text={thesis} tokens={tokens} />
        </AnatomySection>

        {/* 2. Activation Conditions */}
        <AnatomySection
          title="Activation Conditions"
          count={activationConditions.length}
          defaultExpanded={activationConditions.length > 0}
          pulseKey={activationPulseKey}
          hasContent={activationConditions.length > 0}
          emptyMessage="No activation conditions discussed yet."
        >
          <ConditionList items={activationConditions} tokens={tokens} />
        </AnatomySection>

        {/* 3. Invalidation Conditions */}
        <AnatomySection
          title="Invalidation Conditions"
          count={invalidationConditions.length}
          defaultExpanded={invalidationConditions.length > 0}
          pulseKey={invalidationPulseKey}
          hasContent={invalidationConditions.length > 0}
          emptyMessage="No invalidation conditions discussed yet."
        >
          <ConditionList items={invalidationConditions} tokens={tokens} />
        </AnatomySection>

        {/* 4. Core Plays */}
        <AnatomySection
          title="Core Plays"
          count={grouped.core.length}
          defaultExpanded={grouped.core.length > 0}
          pulseKey={corePulseKey}
          hasContent={grouped.core.length > 0}
          emptyMessage="Not yet discussed."
        >
          <TickerList tickers={grouped.core} tokens={tokens} variant="core" />
        </AnatomySection>

        {/* 5. Discovery Plays — Asymmetric Edge */}
        <AnatomySection
          title="Discovery Plays"
          count={grouped.discovery.length}
          accent="discovery"
          accentLabel="Asymmetric Edge"
          tooltipText={DISCOVERY_TOOLTIP}
          defaultExpanded={true}
          pulseKey={discoveryPulseKey}
          hasContent={grouped.discovery.length > 0}
          emptyMessage="Watch this space — your contributed picks land here."
        >
          <TickerList tickers={grouped.discovery} tokens={tokens} variant="discovery" />
        </AnatomySection>

        {/* 6. Cross-Currents */}
        <AnatomySection
          title="Cross-Currents"
          count={grouped.cross_current.length}
          defaultExpanded={grouped.cross_current.length > 0}
          pulseKey={crossCurrentPulseKey}
          hasContent={grouped.cross_current.length > 0}
          emptyMessage="Not yet discussed."
        >
          <TickerList
            tickers={grouped.cross_current}
            tokens={tokens}
            variant="cross_current"
          />
        </AnatomySection>

        {/* Finalize-phase nudge — only surfaces once we've got real content
            so it doesn't compete with the empty-state copy on first paint. */}
        {hasAnyContent && agentName && (
          <div
            style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 8,
              background: `${tokens.medalGold}0d`,
              border: `1px solid ${tokens.medalGold}33`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 11,
              lineHeight: 1.5,
              color: tokens.textSecondary,
            }}
          >
            <Sparkles size={12} color={tokens.medalGold} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              When this is locked, you’ll equip <strong>{agentName}</strong> with
              it for an upcoming battle.
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Body subviews ───────────────────────────────────────────────────────

function ThesisBody({ text, tokens }) {
  return (
    <motion.div
      key={text || 'empty-thesis'}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        fontSize: 12,
        color: tokens.textPrimary,
        lineHeight: 1.55,
      }}
    >
      {text}
    </motion.div>
  );
}

function ConditionList({ items, tokens }) {
  return (
    <ol
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        counterReset: 'anatomy-cond',
      }}
    >
      {items.map((text, idx) => (
        <motion.li
          key={`${idx}-${(text || '').slice(0, 16)}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: idx * 0.03 }}
          style={{
            display: 'flex',
            gap: 8,
            fontSize: 12,
            color: tokens.textSecondary,
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              color: tokens.teal,
              fontWeight: 700,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              flexShrink: 0,
              minWidth: 16,
            }}
          >
            {idx + 1}.
          </span>
          <span style={{ flex: 1, wordBreak: 'break-word' }}>{text}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function TickerList({ tickers, tokens, variant }) {
  const isDiscovery = variant === 'discovery';
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {tickers.map((t) => {
        const isRemoved = t.status === 'removed';
        return (
          <motion.li
            key={t.symbol}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: isRemoved ? 0.45 : 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              padding: '8px 10px',
              background: isDiscovery ? `${tokens.teal}0f` : tokens.bgApp,
              border: `1px solid ${
                isDiscovery ? `${tokens.teal}33` : tokens.borderDefault
              }`,
              borderRadius: 6,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: tokens.teal,
                fontSize: 13,
                fontWeight: 700,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                letterSpacing: '0.4px',
                textDecoration: isRemoved ? 'line-through' : 'none',
              }}
            >
              {isDiscovery && (
                <span
                  aria-hidden="true"
                  style={{
                    color: tokens.teal,
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  ✦
                </span>
              )}
              {t.symbol}
              {isRemoved && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    color: tokens.textFaint,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: tokens.bgIcon,
                    fontFamily: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  Removed
                </span>
              )}
            </span>
            {(t.reasoning || t.category) && (
              <span
                style={{
                  fontSize: 11,
                  color: tokens.textSecondary,
                  lineHeight: 1.45,
                  textDecoration: isRemoved ? 'line-through' : 'none',
                }}
              >
                {t.reasoning || t.category}
              </span>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
