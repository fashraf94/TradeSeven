// src/components/Forge/ForgeLanding.jsx
//
// ForgeLanding — the Strategy Laboratory front door for the Forge tab.
//
// This replaces ForgeScreen as the default view when the user taps the Forge
// tab. The rule browser + Mech Bay (ForgeScreen) is still reachable via the
// "Advanced" tab.
//
// Sections (top to bottom, mobile-first):
//   1. Header + Laboratory/Advanced pill tabs
//   2. Active Experiment card (if activeSeasonEntry exists)
//   3. Daily Briefing card (if active experiment has dailyLog)
//   4. Start New Experiment hero CTA
//   5. Talk to Agent placeholder (Phase 5)
//   6. Deployed Strategy card
//   7. Past Experiments (collapsible)
//
// When the Advanced tab is active, renders ForgeScreen full-bleed and shows
// a floating "← Back to Laboratory" button (the one already injected inside
// ForgeScreen via the laboratoryOnBack prop).

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer,
  FlaskConical,
  MessageSquare,
  ChevronDown,
  Rocket,
  Beaker,
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Shield,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import ForgeScreen from './ForgeScreen';
import DailyBriefingCard from '../Season/DailyBriefingCard';

// ── Design tokens ──────────────────────────────────────────────
const TROPHY_GOLD = '#F0C75E';
const TEAL = '#5EEAD4';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const PAGE_BG = '#0D0E12';
const CARD_BG = '#15171E';
const SURFACE_BG = '#1C1A27';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#8B949E';
const TEXT_MUTED = '#6E7681';
const BORDER_SUBTLE = '#21262D';

// ── Helpers ────────────────────────────────────────────────────

function formatPct(value, withSign = true) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function isPitStopOpen(season, entry) {
  if (!entry) return false;
  return Boolean(entry.isPitStopOpen || season?.isPitStopWeekend);
}

// ── Sub-components ─────────────────────────────────────────────

function SectionLabel({ children, style }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: TEXT_MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        margin: '20px 0 10px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function TabPill({ tabs, activeTab, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: SURFACE_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 10,
        position: 'relative',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              position: 'relative',
              background: 'transparent',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: active ? '#0D0E12' : TEXT_SECONDARY,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              zIndex: 1,
              transition: 'color 0.2s ease',
            }}
          >
            {active && (
              <motion.div
                layoutId="forge-tab-pill"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: TROPHY_GOLD,
                  borderRadius: 8,
                  zIndex: -1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {tab.Icon ? <tab.Icon size={14} /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ActiveExperimentCard({ season, entry, onViewDashboard }) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const week = entry?.seasonState?.currentWeek || 1;
  const totalWeeks = Array.isArray(season?.weeks) ? season.weeks.length : 4;
  const rank = entry?.seasonState?.rank;
  const totalEntries = season?.entryCount;
  const pitStop = isPitStopOpen(season, entry);
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
      onClick={() => onViewDashboard && onViewDashboard(season, entry)}
      style={{
        background: CARD_BG,
        borderRadius: 14,
        borderTop: `3px solid ${TROPHY_GOLD}`,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderTopWidth: 3,
        borderTopColor: TROPHY_GOLD,
        padding: 16,
        cursor: 'pointer',
      }}
    >
      {pitStop && (
        <motion.div
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            background: TROPHY_GOLD,
            color: '#0D0E12',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 10,
          }}
        >
          Weekly Review Open
        </motion.div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              lineHeight: 1.3,
            }}
          >
            {season?.name || 'Current Experiment'}
          </h3>
          <div
            style={{
              fontSize: 12,
              color: TEXT_SECONDARY,
              marginTop: 4,
            }}
          >
            Week {week} of {totalWeeks}
            {rank ? ` • Rank #${rank}${totalEntries ? `/${totalEntries}` : ''}` : ''}
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: TROPHY_GOLD,
            padding: '3px 8px',
            border: `1px solid ${TROPHY_GOLD}`,
            borderRadius: 4,
            whiteSpace: 'nowrap',
          }}
        >
          Active
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 0',
          borderTop: `1px solid ${BORDER_SUBTLE}`,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            color: alphaColor,
          }}
        >
          {alpha >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {formatPct(alpha)}
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: TEXT_MUTED,
              marginLeft: 2,
            }}
          >
            vs S&amp;P
          </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onViewDashboard) onViewDashboard(season, entry);
        }}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: pitStop ? TROPHY_GOLD : TEAL,
          color: '#0D0E12',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {pitStop ? 'Open Weekly Review' : 'View Dashboard'}
        <ArrowRight size={14} />
      </button>
    </motion.div>
  );
}

function NoActiveExperimentCard() {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px dashed ${BORDER_SUBTLE}`,
        borderRadius: 14,
        padding: 20,
        textAlign: 'center',
      }}
    >
      <Activity size={24} color={TEXT_MUTED} style={{ marginBottom: 8 }} />
      <div style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 4 }}>
        No active experiment
      </div>
      <div style={{ fontSize: 12, color: TEXT_MUTED }}>
        Launch one below to test your strategy against 4 weeks of live market data.
      </div>
    </div>
  );
}

function StartExperimentHero({ onClick, disabled, disabledReason }) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.99 }}
      onClick={disabled ? undefined : onClick}
      style={{
        width: '100%',
        background: CARD_BG,
        border: `1px solid ${disabled ? BORDER_SUBTLE : TROPHY_GOLD}`,
        borderRadius: 14,
        padding: 18,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {!disabled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${TROPHY_GOLD}14 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: disabled ? SURFACE_BG : `${TROPHY_GOLD}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <FlaskConical size={22} color={disabled ? TEXT_MUTED : TROPHY_GOLD} />
      </div>
      <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            marginBottom: 3,
          }}
        >
          {disabled ? 'Experiment in Progress' : 'Start New Experiment'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: TEXT_SECONDARY,
            lineHeight: 1.4,
          }}
        >
          {disabled
            ? disabledReason || 'Complete your current run before launching another.'
            : 'Build and test your trading strategy against 4 weeks of live market data.'}
        </div>
      </div>
      {!disabled && (
        <ArrowRight size={18} color={TROPHY_GOLD} style={{ flexShrink: 0, zIndex: 1 }} />
      )}
    </motion.button>
  );
}

function TalkToAgentCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 12,
        padding: 14,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: SURFACE_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <MessageSquare size={18} color={TEXT_SECONDARY} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>
            Talk to Agent
          </div>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: TEXT_MUTED,
              padding: '2px 6px',
              background: SURFACE_BG,
              border: `1px solid ${BORDER_SUBTLE}`,
              borderRadius: 4,
            }}
          >
            Coming Soon
          </span>
        </div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.4 }}>
          Develop your strategy through conversation.
        </div>
      </div>
    </button>
  );
}

function DeployedStrategyCard({ agent, equippedBundles }) {
  const deployed = agent?.deployedStrategy || null;

  // Phase 4A primary path: show metadata from a completed Proving Ground deploy.
  if (deployed && deployed.bundleId) {
    const alpha = typeof deployed.alpha === 'number' ? deployed.alpha : null;
    const rank = deployed.rank || null;
    const directiveCount = Array.isArray(deployed.directives)
      ? deployed.directives.length
      : 0;
    const guardrails = Array.isArray(deployed.guardrails)
      ? deployed.guardrails
      : [];
    const stopLoss = guardrails.find((g) => g.type === 'stopLoss')?.value;
    const maxPosition = guardrails.find((g) => g.type === 'maxPosition')?.value;

    const sourceLabel = (() => {
      const src = deployed.sourceCollection;
      if (!src) return 'Custom strategy';
      return src
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    })();

    return (
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${TEAL}33`,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <Rocket size={16} color={TEAL} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: TEAL,
            }}
          >
            Deployed to BaggerBomb
          </div>
        </div>

        <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 4 }}>
          {sourceLabel}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 10, lineHeight: 1.5 }}>
          {alpha !== null ? `Alpha ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%` : null}
          {rank ? `${alpha !== null ? ' · ' : ''}Rank #${rank}` : null}
          {directiveCount > 0
            ? `${alpha !== null || rank ? ' · ' : ''}${directiveCount} directive${directiveCount === 1 ? '' : 's'}`
            : null}
        </div>

        {(typeof stopLoss === 'number' || typeof maxPosition === 'number') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
              background: PAGE_BG,
              border: `1px solid ${TROPHY_GOLD}33`,
              borderRadius: 8,
              fontSize: 11,
              color: TEXT_PRIMARY,
              fontWeight: 600,
            }}
          >
            <Shield size={12} color={TROPHY_GOLD} />
            <span>
              {typeof stopLoss === 'number' ? `Stop ${stopLoss}%` : ''}
              {typeof stopLoss === 'number' && typeof maxPosition === 'number'
                ? ' · '
                : ''}
              {typeof maxPosition === 'number' ? `Max position ${maxPosition}%` : ''}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Legacy fallback: show raw equipped-bundle summary when no Proving Ground
  // deployment exists yet.
  const bundleCount = Array.isArray(equippedBundles) ? equippedBundles.length : 0;
  const ruleCount = Array.isArray(equippedBundles)
    ? equippedBundles.reduce((n, b) => n + (b?.ruleIds?.length || 0), 0)
    : 0;
  const hasDeployed = bundleCount > 0 && ruleCount > 0;

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: hasDeployed ? 10 : 6,
        }}
      >
        <Rocket size={16} color={hasDeployed ? TEAL : TEXT_MUTED} />
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: hasDeployed ? TEAL : TEXT_MUTED,
          }}
        >
          Deployed to BaggerBomb
        </div>
      </div>
      {hasDeployed ? (
        <>
          <div style={{ fontSize: 13, color: TEXT_PRIMARY, marginBottom: 6 }}>
            {bundleCount} {bundleCount === 1 ? 'bundle' : 'bundles'} equipped • {ruleCount}{' '}
            {ruleCount === 1 ? 'rule' : 'rules'} active
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.5 }}>
            {equippedBundles.slice(0, 3).map((b) => b?.name).filter(Boolean).join(' • ') ||
              'Custom configuration'}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>
          No strategy deployed to BaggerBomb yet. Equip a bundle from the Advanced tab
          or complete an experiment to deploy a proven strategy.
        </div>
      )}
    </div>
  );
}

function PastExperimentRow({ season, entry, onReview, delay }) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const rank = entry?.seasonState?.finalRank || entry?.seasonState?.rank;
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;

  return (
    <motion.button
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, delay }}
      onClick={() => onReview && onReview(season, entry)}
      style={{
        width: '100%',
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {season?.name || 'Past Experiment'}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
          Alpha{' '}
          <span style={{ color: alphaColor, fontWeight: 600 }}>{formatPct(alpha)}</span>
          {rank ? ` • Rank #${rank}` : ''}
        </div>
      </div>
      <ArrowRight size={14} color={TEXT_MUTED} />
    </motion.button>
  );
}

// ── Past-experiments collapsible section ───────────────────────
function PastExperimentsSection({ past, onReviewSeason }) {
  const [expanded, setExpanded] = useState(past.length <= 3);
  if (past.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '20px 0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex' }}
        >
          <ChevronDown size={14} color={TEXT_MUTED} />
        </motion.span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          Past Experiments ({past.length})
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="past-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'grid', gap: 8 }}>
              {past.map((s, i) => (
                <PastExperimentRow
                  key={s.id}
                  season={s}
                  entry={s.entry}
                  onReview={onReviewSeason}
                  delay={0.03 * i}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function ForgeLanding({
  // ForgeScreen pass-through props
  isMobile,
  onClose,
  user,
  onNavigateToSeasonHub,
  // Active experiment state (from App.jsx)
  activeSeason,
  activeSeasonEntry,
  // Agent
  agent,
  // Season navigation callbacks
  onViewDashboard,
  onJoinSeason,
  onReviewSeason,
}) {
  const [view, setView] = useState('laboratory');
  const [seasons, setSeasons] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyLog, setDailyLog] = useState(null);
  const [dailyLogLoading, setDailyLogLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Fetch all seasons + user's entries (same pattern as SeasonHub:420-451)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const seasonsSnap = await getDocs(collection(db, 'seasons'));
        const entriesSnap = await getDocs(
          query(collection(db, 'seasonEntries'), where('userId', '==', user.uid))
        );
        if (cancelled) return;
        setSeasons(seasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEntries(entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        if (!cancelled) console.error('[ForgeLanding] Failed to load seasons:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Fetch the most recent dailyLog for the active experiment
  useEffect(() => {
    let cancelled = false;
    async function loadDailyLog() {
      if (!activeSeasonEntry?.id) {
        setDailyLog(null);
        return;
      }
      setDailyLogLoading(true);
      try {
        // currentDay may be 1-indexed; fall back to 0 if missing
        const currentDay =
          activeSeasonEntry?.seasonState?.currentDay ??
          activeSeason?.currentDay ??
          0;
        // Probe currentDay, then currentDay-1 as a fallback (evaluation may
        // lag the state update by a tick).
        const candidates = [currentDay, currentDay - 1].filter((d) => d >= 0);
        let found = null;
        for (const dayNum of candidates) {
          const ref = doc(
            db,
            'seasonEntries',
            activeSeasonEntry.id,
            'dailyLogs',
            String(dayNum)
          );
          const snap = await getDoc(ref);
          if (cancelled) return;
          if (snap.exists()) {
            found = { id: snap.id, ...snap.data() };
            break;
          }
        }
        if (!cancelled) setDailyLog(found);
      } catch (err) {
        if (!cancelled) {
          console.error('[ForgeLanding] Failed to load dailyLog:', err);
          setDailyLog(null);
        }
      } finally {
        if (!cancelled) setDailyLogLoading(false);
      }
    }
    loadDailyLog();
    return () => {
      cancelled = true;
    };
  }, [activeSeasonEntry?.id, activeSeasonEntry?.seasonState?.currentDay, activeSeason?.currentDay]);

  // Categorize past experiments from loaded seasons + entries
  const { past, nextUpcoming } = useMemo(() => {
    const entryMap = new Map(entries.map((e) => [e.seasonId, e]));
    const pastList = seasons
      .filter((s) => s.status === 'completed' && entryMap.has(s.id))
      .map((s) => ({ ...s, entry: entryMap.get(s.id) }));
    // Next available to join: upcoming season OR active season not yet joined
    const upcomingList = seasons.filter(
      (s) =>
        s.status === 'upcoming' ||
        (s.status === 'active' && !entryMap.has(s.id))
    );
    upcomingList.sort((a, b) => {
      const aT = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bT = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return aT - bT;
    });
    return { past: pastList, nextUpcoming: upcomingList[0] || null };
  }, [seasons, entries]);

  const hasActive = Boolean(activeSeason && activeSeasonEntry);
  const tradingDay =
    activeSeasonEntry?.seasonState?.currentDay ??
    activeSeason?.currentDay ??
    dailyLog?.day ??
    0;

  // Bundles for deployed-strategy summary. We don't fetch bundle docs here —
  // we just use whatever is on the agent object. Phase 4 will build out
  // DeployToAgent proper.
  const equippedBundles = useMemo(() => {
    const ids = Array.isArray(agent?.equippedBundleIds) ? agent.equippedBundleIds : [];
    return ids.map((id) => ({ id, ruleIds: [], name: null }));
  }, [agent?.equippedBundleIds]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 2500);
  };

  const handleTalkToAgent = () => {
    showToast('Workshop Mode coming soon');
  };

  const handleStartExperiment = () => {
    if (nextUpcoming && onJoinSeason) {
      onJoinSeason(nextUpcoming);
    } else {
      showToast('No upcoming experiments available');
    }
  };

  // ── Advanced view: render ForgeScreen full-bleed ──────────────
  if (view === 'advanced') {
    return (
      <ForgeScreen
        isMobile={isMobile}
        onClose={onClose}
        user={user}
        onNavigateToSeasonHub={onNavigateToSeasonHub}
        laboratoryOnBack={() => setView('laboratory')}
      />
    );
  }

  // ── Laboratory view ───────────────────────────────────────────
  const TABS = [
    { id: 'laboratory', label: 'Laboratory', Icon: Beaker },
    { id: 'advanced', label: 'Advanced', Icon: Hammer },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PAGE_BG,
        color: TEXT_PRIMARY,
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: TEXT_MUTED,
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <Hammer size={20} color={TROPHY_GOLD} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                lineHeight: 1.2,
              }}
            >
              The Forge
            </h1>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: TROPHY_GOLD,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginTop: 2,
              }}
            >
              Strategy Laboratory
            </div>
          </div>
        </div>
      </div>

      {/* Pill tab bar */}
      <div style={{ padding: '0 16px 16px' }}>
        <TabPill tabs={TABS} activeTab={view} onChange={setView} />
      </div>

      <div style={{ padding: '0 16px', maxWidth: 600, margin: '0 auto' }}>
        {/* Section 1: Active experiment */}
        {hasActive ? (
          <ActiveExperimentCard
            season={activeSeason}
            entry={activeSeasonEntry}
            onViewDashboard={onViewDashboard}
          />
        ) : (
          <NoActiveExperimentCard />
        )}

        {/* Section 2: Daily briefing (only when an experiment is live) */}
        {hasActive && (
          <div style={{ marginTop: 12 }}>
            <DailyBriefingCard
              entry={activeSeasonEntry}
              dailyLog={dailyLog}
              tradingDay={tradingDay}
              loading={dailyLogLoading}
            />
          </div>
        )}

        {/* Section 3: Start New Experiment */}
        <SectionLabel>Launch</SectionLabel>
        <StartExperimentHero
          onClick={handleStartExperiment}
          disabled={hasActive}
          disabledReason={
            hasActive
              ? 'Complete or review your current experiment before launching another.'
              : null
          }
        />

        {/* Section 4: Talk to Agent (Workshop Mode placeholder) */}
        <div style={{ marginTop: 12 }}>
          <TalkToAgentCard onClick={handleTalkToAgent} />
        </div>

        {/* Section 5: Deployed strategy */}
        <SectionLabel>Live Deployment</SectionLabel>
        <DeployedStrategyCard agent={agent} equippedBundles={equippedBundles} />

        {/* Section 6: Past experiments */}
        {!loading && (
          <PastExperimentsSection past={past} onReviewSeason={onReviewSeason} />
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              bottom: 96,
              left: '50%',
              transform: 'translateX(-50%)',
              background: SURFACE_BG,
              border: `1px solid ${TROPHY_GOLD}`,
              color: TEXT_PRIMARY,
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

