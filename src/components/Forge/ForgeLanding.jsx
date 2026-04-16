// src/components/Forge/ForgeLanding.jsx
//
// ForgeLanding — the Strategy Laboratory front door for the Forge tab.
//
// The page tells a story in four chapters keyed off the user's progression:
//
//   State 1 — `new`:       no experiments, no deployed strategy
//   State 2 — `testing`:   an experiment is running in the Proving Ground
//   State 3 — `results`:   latest experiment is completed, nothing deployed
//   State 4 — `deployed`:  agent.deployedStrategy is live in the arena
//
// Three design threads connect the four states:
//   1. Mini radar chart in states 2–4 gives the strategy a visual identity
//   2. Agent card below each view adapts its tone to the current chapter
//   3. Exactly one primary CTA per state (teal/trophy-gold button); secondary
//      actions are always text links, never competing buttons
//
// The "Advanced" tab still renders ForgeScreen full-bleed; that path is
// unchanged — only the Laboratory view has been redesigned.

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer,
  Beaker,
  ArrowRight,
  Pencil,
  Activity,
  Settings2,
  Zap,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import ForgeScreen from './ForgeScreen';
import WorkshopChat from './WorkshopChat';
import DailyBriefingCard from '../Season/DailyBriefingCard';
import {
  DIMENSION_KEYS,
  computeAllRadarScores,
} from '../../utils/dimensionRadarScore';

// ── Design tokens (kept in sync with the rest of the Forge palette) ─────
const TROPHY_GOLD = '#F0C75E';
const TEAL = '#5EEAD4';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const WARNING = '#F59E0B';
const PAGE_BG = '#0D0E12';
const CARD_BG = '#15171E';
const SURFACE_BG = '#1C1A27';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#8B949E';
const TEXT_MUTED = '#6E7681';
const BORDER_SUBTLE = '#21262D';

// ── Helpers ─────────────────────────────────────────────────────────────

function formatPct(value, withSign = true) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function isPitStopOpen(season, entry) {
  if (!entry) return false;
  return Boolean(entry.isPitStopOpen || season?.isPitStopWeekend);
}

// v1 grade formula — pending Forge Score integration. Mapped from alpha:
//   A ≥ +5%, B ≥ +2%, C ≥ 0%, D ≥ -3%, F < -3%
function computeGrade(alpha) {
  if (typeof alpha !== 'number' || Number.isNaN(alpha)) return null;
  if (alpha >= 5) return 'A';
  if (alpha >= 2) return 'B';
  if (alpha >= 0) return 'C';
  if (alpha >= -3) return 'D';
  return 'F';
}

function gradeColor(grade) {
  if (grade === 'A' || grade === 'B') return POSITIVE;
  if (grade === 'C') return WARNING;
  return NEGATIVE;
}

// Human-readable relative time used by the deployed-strategy "LIVE" badge.
// Deliberately coarse — the card doesn't need minute-level resolution.
function daysAgoLabel(isoString) {
  if (!isoString) return null;
  const then = new Date(isoString).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'Deployed today';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Deployed today';
  if (days === 1) return 'Deployed 1 day ago';
  if (days < 7) return `Deployed ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'Deployed 1 week ago';
  return `Deployed ${weeks} weeks ago`;
}

// State detection — priority order: deployed > testing > results > new.
function getLandingState({ activeExperiment, completedExperiments, deployedStrategy }) {
  if (deployedStrategy) return 'deployed';
  if (activeExperiment) return 'testing';
  if (completedExperiments?.length > 0) return 'results';
  return 'new';
}

// Resolve a strategy's dimensionValues from the cheapest sources we have
// synchronously. Returns null when nothing is available — callers hide the
// mini radar in that case rather than rendering a misleading neutral shape.
//
// Priority:
//   1. entry.algorithm.dimensionValues (future-proofing — not always present)
//   2. localStorage['forge.lastEntryDims'][entryId] (same-device cache
//      written by SeasonEntryModal at launch)
function resolveEntryDimensions(entry) {
  if (!entry) return null;
  if (entry.algorithm?.dimensionValues) return entry.algorithm.dimensionValues;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('forge.lastEntryDims');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.[entry.id] || null;
  } catch {
    return null;
  }
}

// ── Shared UI primitives ────────────────────────────────────────────────

// Inline SVG radar, 80x80 viewBox, no axis labels. The shared scoring util
// normalizes each dimension to [0.05, 1] so the polygon never collapses to a
// point at extremes. Renders a neutral guide ring even when dims are missing
// so the card's layout stays stable.
function MiniRadar({ dimensionValues, size = 80 }) {
  const scores = useMemo(() => {
    if (!dimensionValues) return null;
    return computeAllRadarScores(dimensionValues);
  }, [dimensionValues]);

  const center = size / 2;
  const radius = size / 2 - 4;

  const geometry = useMemo(() => {
    return DIMENSION_KEYS.map((key, i) => {
      const angle = (Math.PI * 2 * i) / DIMENSION_KEYS.length - Math.PI / 2;
      const v = scores?.[key] ?? 0.5;
      return {
        ox: center + radius * Math.cos(angle),
        oy: center + radius * Math.sin(angle),
        vx: center + radius * v * Math.cos(angle),
        vy: center + radius * v * Math.sin(angle),
      };
    });
  }, [scores, center, radius]);

  const polygon = geometry.map((p) => `${p.vx},${p.vy}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx={center} cy={center} r={radius} stroke={TEAL} strokeWidth="0.75" fill="none" opacity="0.25" />
      <circle cx={center} cy={center} r={radius * 0.66} stroke={TEAL} strokeWidth="0.5" fill="none" opacity="0.15" />
      <circle cx={center} cy={center} r={radius * 0.33} stroke={TEAL} strokeWidth="0.5" fill="none" opacity="0.1" />
      {geometry.map((p, i) => (
        <line key={i} x1={center} y1={center} x2={p.ox} y2={p.oy} stroke={TEAL} strokeWidth="0.4" opacity="0.2" />
      ))}
      {scores && (
        <polygon
          points={polygon}
          fill="rgba(94,234,212,0.2)"
          stroke={TEAL}
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

// Full-width trophy-gold CTA — single primary color across all states, to
// match existing "Next: Confirm" button in SeasonEntryModal.
function PrimaryCTA({ onClick, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '13px 16px',
        background: disabled ? SURFACE_BG : TROPHY_GOLD,
        color: disabled ? TEXT_MUTED : '#0D0E12',
        border: 'none',
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {children}
      <ArrowRight size={16} />
    </button>
  );
}

function SecondaryLink({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        padding: '10px 8px',
        color: TEXT_SECONDARY,
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      {children}
    </button>
  );
}

// 3-column metric grid used by cards in States 2–4.
function StatsRow({ items }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 8,
        marginTop: 12,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: SURFACE_BG,
            borderRadius: 8,
            padding: 10,
            textAlign: 'center',
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: it.color || TEXT_PRIMARY,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {it.value}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Weekend pit-stop banner with pulsing amber dot. Inline in State 2 card.
function PitStopBanner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        background: 'rgba(240,199,94,0.08)',
        border: `1px solid rgba(240,199,94,0.35)`,
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: TROPHY_GOLD,
          flexShrink: 0,
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 600, color: TROPHY_GOLD }}>
        Weekly review open — tune your strategy
      </div>
    </div>
  );
}

// Four-pip week-progress indicator for a 4-week experiment.
function ProgressPips({ currentWeek, totalWeeks = 4 }) {
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      {weeks.map((w) => (
        <div
          key={w}
          style={{
            width: 18,
            height: 4,
            borderRadius: 2,
            background: w <= currentWeek ? TEAL : BORDER_SUBTLE,
          }}
        />
      ))}
    </div>
  );
}

// ── Shell: tabs header ──────────────────────────────────────────────────

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

// ── State 1 — New User Hero ────────────────────────────────────────────

// Four-step Build → Test → Refine → Deploy strip shown only to first-time
// users. Each step has a colored circle + an icon stroked in the same family.
function LoopStep({ Icon, label, accent }) {
  // Accent is a [background, stroke] pair drawn from the Lucide 50/800 ramps.
  const [bg, fg] = accent;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={fg} strokeWidth={1.75} />
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_SECONDARY, letterSpacing: '0.3px' }}>
        {label}
      </div>
    </div>
  );
}

function NewUserHero({ onBuildStrategy, onConfigureManually }) {
  const LOOP_STEPS = [
    { Icon: Pencil, label: 'Build', accent: ['rgba(94,234,212,0.15)', TEAL] },
    { Icon: Activity, label: 'Test', accent: ['rgba(52,211,153,0.15)', POSITIVE] },
    { Icon: Settings2, label: 'Refine', accent: ['rgba(240,199,94,0.18)', TROPHY_GOLD] },
    { Icon: Zap, label: 'Deploy', accent: ['rgba(168,85,247,0.18)', '#C4B5FD'] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4 }}>
      <div style={{ textAlign: 'center', padding: '12px 4px 0' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 500,
            color: TEXT_PRIMARY,
            lineHeight: 1.3,
          }}
        >
          Build a strategy. Test it against the market.
        </h2>
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 14,
            color: TEXT_SECONDARY,
            lineHeight: 1.5,
          }}
        >
          Your agent needs a game plan. You&apos;ll build one together, prove it
          works, then send it into battle.
        </p>
      </div>

      {/* Loop strip — mobile 360px: 4x34px circles + 3 arrows ≈ 176px,
          comfortably fits. Uses space-between so it scales up on desktop. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 4px',
        }}
      >
        {LOOP_STEPS.map((step, i) => (
          <React.Fragment key={step.label}>
            <LoopStep {...step} />
            {i < LOOP_STEPS.length - 1 && (
              <div style={{ color: TEXT_MUTED, fontSize: 14, paddingBottom: 16 }}>→</div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{ marginTop: 4 }}>
        <PrimaryCTA onClick={onBuildStrategy}>Build your first strategy</PrimaryCTA>
        <SecondaryLink onClick={() => onConfigureManually()}>
          I know what I&apos;m doing — configure manually
        </SecondaryLink>
      </div>
    </div>
  );
}

// ── State 2 — Testing View ─────────────────────────────────────────────
//
// Known follow-up (Stage 2 audit): once a user has an active experiment,
// State 2 currently provides no path to create a new experiment. A
// "Start new experiment" affordance will be designed properly in the
// next pass — not added here because its placement interacts with the
// single-primary-CTA rule and the multi-experiment stack.

// Full-layout experiment card. Content is identical whether one or
// many experiments are active; `compact` only tightens padding/margins
// so a 2+ stack doesn't scroll excessively. Every card contains the
// five specified elements: mini radar + name/pips + alpha hero + stats
// row + daily briefing, plus a pit-stop banner when applicable.
//
// When `onOpen` is provided, the card renders an inline "Open" button
// at the bottom. This only fires in the multi-experiment case — in
// single-experiment mode, navigation lives in TestingView's bottom
// PrimaryCTA instead.
function ExperimentCard({
  season,
  entry,
  pitStop,
  dailyLog,
  dailyLogLoading,
  tradingDay,
  dims,
  compact = false,
  onOpen,
}) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const week = entry?.seasonState?.currentWeek || 1;
  const totalWeeks = Array.isArray(season?.weeks) ? season.weeks.length : 4;
  const rank = entry?.seasonState?.rank;
  const totalEntries = season?.entryCount;
  const forgeScore =
    entry?.seasonState?.forgeScore ?? entry?.forgeScore ?? null;
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;
  const tradesToday = Array.isArray(dailyLog?.trades) ? dailyLog.trades.length : null;

  const cardPadding = compact ? 12 : 14;
  const alphaHeroMarginTop = compact ? 12 : 16;
  const alphaHeroPaddingTop = compact ? 10 : 12;

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 12,
        padding: cardPadding,
      }}
    >
      {pitStop && <PitStopBanner />}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
        {dims && <MiniRadar dimensionValues={dims} size={80} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {season?.name || 'Current experiment'}
          </div>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
            Week {week} of {totalWeeks}
          </div>
          <ProgressPips currentWeek={week} totalWeeks={totalWeeks} />
        </div>
      </div>

      <div
        style={{
          marginTop: alphaHeroMarginTop,
          paddingTop: alphaHeroPaddingTop,
          borderTop: `1px solid ${BORDER_SUBTLE}`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
            fontSize: 28,
            fontWeight: 500,
            color: alphaColor,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {alpha >= 0 ? (
            <TrendingUp size={20} color={alphaColor} />
          ) : (
            <TrendingDown size={20} color={alphaColor} />
          )}
          {formatPct(alpha)}
        </div>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
          alpha vs S&amp;P 500
        </div>
      </div>

      <StatsRow
        items={[
          {
            value: forgeScore != null ? Math.round(forgeScore) : '—',
            label: 'Forge Score',
          },
          {
            value: rank ? `#${rank}${totalEntries ? ` of ${totalEntries}` : ''}` : '—',
            label: 'Rank',
          },
          {
            value: tradesToday != null ? tradesToday : '—',
            label: 'Trades today',
          },
        ]}
      />

      {/* Per-card daily briefing — each active experiment gets its own. */}
      <div style={{ marginTop: 12 }}>
        <DailyBriefingCard
          entry={entry}
          dailyLog={dailyLog}
          tradingDay={tradingDay}
          loading={dailyLogLoading}
        />
      </div>

      {/* Inline "Open" affordance — only present in the multi-experiment
          case where the bottom CTA is removed. Text swaps for weekend
          pit stop so the action word matches the destination. */}
      {onOpen && (
        <button
          onClick={onOpen}
          style={{
            marginTop: 12,
            width: '100%',
            background: 'transparent',
            border: `1px solid ${BORDER_SUBTLE}`,
            borderRadius: 10,
            padding: '9px 12px',
            color: pitStop ? TROPHY_GOLD : TEAL,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {pitStop ? 'Open weekly review' : 'Open dashboard'}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function TestingView({
  experiments,
  focusedExperiment,
  dailyLogsById,
  dailyLoadingById,
  dimensionsById,
  onViewDashboard,
}) {
  const multi = experiments.length > 1;

  // Single-experiment bottom CTA target: the one and only entry. We
  // compute pitStop here so the bottom CTA text stays consistent with
  // the inline pit-stop banner on the single card.
  const focused = focusedExperiment;
  const focusedPitStop = isPitStopOpen(focused.season, focused.entry);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      {experiments.map(({ season, entry }) => (
        <ExperimentCard
          key={entry.id}
          season={season}
          entry={entry}
          pitStop={isPitStopOpen(season, entry)}
          dailyLog={dailyLogsById[entry.id] || null}
          dailyLogLoading={Boolean(dailyLoadingById[entry.id])}
          tradingDay={
            entry?.seasonState?.currentDay ??
            season?.currentDay ??
            dailyLogsById[entry.id]?.day ??
            0
          }
          // Prefer the async-resolved bundle dims when present; fall
          // back to the sync resolver while the fetch is in flight so
          // the radar can still appear on same-device launches.
          dims={dimensionsById[entry.id] ?? resolveEntryDimensions(entry)}
          compact={multi}
          // Inline per-card "Open" button only when 2+ experiments are
          // stacked. In single-experiment mode the bottom PrimaryCTA
          // owns navigation so the card stays chrome-free.
          onOpen={
            multi
              ? () => onViewDashboard && onViewDashboard(season, entry)
              : undefined
          }
        />
      ))}

      {/* Bottom PrimaryCTA only renders when there is a single,
          unambiguous target. With 2+ experiments the per-card "Open"
          buttons replace it — no shared CTA below the stack. */}
      {!multi &&
        (focusedPitStop ? (
          <>
            <PrimaryCTA
              onClick={() =>
                onViewDashboard && onViewDashboard(focused.season, focused.entry)
              }
            >
              Open weekly review
            </PrimaryCTA>
            <SecondaryLink
              onClick={() =>
                onViewDashboard && onViewDashboard(focused.season, focused.entry)
              }
            >
              View full dashboard
            </SecondaryLink>
          </>
        ) : (
          <PrimaryCTA
            onClick={() =>
              onViewDashboard && onViewDashboard(focused.season, focused.entry)
            }
          >
            View full dashboard
          </PrimaryCTA>
        ))}
    </div>
  );
}

// ── State 3 — Results View ─────────────────────────────────────────────

function PastExperimentRow({ season, entry, onReview }) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const rank = entry?.seasonState?.finalRank || entry?.seasonState?.rank;
  const grade = computeGrade(alpha);
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;
  return (
    <button
      onClick={() => onReview && onReview(season, entry)}
      style={{
        width: '100%',
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        textAlign: 'left',
        minWidth: 0,
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
          {season?.name || 'Past experiment'}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
          <span style={{ color: alphaColor, fontWeight: 600 }}>{formatPct(alpha)}</span>
          {rank ? ` · Rank #${rank}` : ''}
        </div>
      </div>
      {grade && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: gradeColor(grade),
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            flexShrink: 0,
          }}
        >
          {grade}
        </div>
      )}
      <ArrowRight size={14} color={TEXT_MUTED} style={{ flexShrink: 0 }} />
    </button>
  );
}

function PastExperimentsSection({ past, onReview }) {
  // Expanded by default for a short list; collapsed when the past pile
  // grows so the State 3 hero card stays the center of attention.
  const [expanded, setExpanded] = useState(past.length <= 3);
  if (past.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px 0',
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
          Past experiments ({past.length})
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
            <div style={{ display: 'grid', gap: 8, paddingTop: 8 }}>
              {past.map((s) => (
                <PastExperimentRow
                  key={s.id}
                  season={s}
                  entry={s.entry}
                  onReview={onReview}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultsView({ season, entry, past, onDeploy, onRefine, onReviewReport, onReviewPast }) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const rank = entry?.seasonState?.finalRank || entry?.seasonState?.rank;
  const totalEntries = season?.entryCount;
  const forgeScore =
    entry?.seasonState?.forgeScore ?? entry?.forgeScore ?? null;
  const grade = computeGrade(alpha);
  const dims = resolveEntryDimensions(entry);
  // Older experiments shown as collapsed rows below the hero — skip the
  // hero itself so we don't list it twice.
  const olderPast = past.filter((s) => s.id !== season.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      <div
        style={{
          background: CARD_BG,
          border: `1px solid rgba(255,255,255,0.12)`,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          {dims && <MiniRadar dimensionValues={dims} size={80} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {season?.name || 'Completed experiment'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: POSITIVE,
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              Completed — 4 weeks
            </div>
          </div>
        </div>

        {/* Grade hero — centered, large. Color maps A/B→green, C→amber,
            D/F→red per gradeColor(). Formula is v1 alpha-based pending
            Forge Score integration. */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: `1px solid ${BORDER_SUBTLE}`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 500,
              color: gradeColor(grade),
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              lineHeight: 1,
            }}
          >
            {grade || '—'}
          </div>
          <div style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 6 }}>
            Final strategy grade
          </div>
        </div>

        <StatsRow
          items={[
            {
              value: formatPct(alpha),
              label: 'Final alpha',
              color: alpha >= 0 ? POSITIVE : NEGATIVE,
            },
            {
              value: forgeScore != null ? Math.round(forgeScore) : '—',
              label: 'Forge Score',
            },
            {
              value: rank ? `#${rank}${totalEntries ? ` of ${totalEntries}` : ''}` : '—',
              label: 'Final rank',
            },
          ]}
        />
      </div>

      {/* Primary: Deploy to agent — navigates to the completed
          experiment's dashboard where the existing deploy flow lives.
          Avoids duplicating DeployToAgent's bundle / dim resolution. */}
      <PrimaryCTA onClick={onDeploy}>Deploy to agent</PrimaryCTA>
      <SecondaryLink onClick={onRefine}>Refine and retest</SecondaryLink>
      <button
        onClick={onReviewReport}
        style={{
          background: 'transparent',
          border: 'none',
          color: TEXT_MUTED,
          fontSize: 12,
          cursor: 'pointer',
          padding: '4px 8px',
          textAlign: 'center',
          marginTop: -6,
        }}
      >
        View full experiment report
      </button>

      <PastExperimentsSection past={olderPast} onReview={onReviewPast} />
    </div>
  );
}

// ── State 4 — Deployed View ────────────────────────────────────────────

function BattleDot({ result }) {
  const isWin = result === 'win';
  const isLoss = result === 'loss';
  const bg = isWin
    ? 'rgba(52,211,153,0.18)'
    : isLoss
    ? 'rgba(239,68,68,0.18)'
    : SURFACE_BG;
  const color = isWin ? POSITIVE : isLoss ? NEGATIVE : TEXT_MUTED;
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {isWin ? 'W' : isLoss ? 'L' : '·'}
    </div>
  );
}

// Compact status line for the edge case where a user has both a
// deployed strategy and an active experiment — experiment sits below
// the deployed card as a one-line card, not the full State 2 layout.
function ActiveExperimentMiniCard({ season, entry, onViewDashboard }) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const week = entry?.seasonState?.currentWeek || 1;
  const totalWeeks = Array.isArray(season?.weeks) ? season.weeks.length : 4;
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Experiment in progress — {season?.name || 'current'}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
          Week {week} of {totalWeeks} ·{' '}
          <span style={{ color: alphaColor, fontWeight: 600 }}>{formatPct(alpha)}</span>
        </div>
      </div>
      <button
        onClick={onViewDashboard}
        style={{
          background: 'transparent',
          border: 'none',
          color: TEAL,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          padding: 4,
        }}
      >
        View Dashboard
      </button>
    </div>
  );
}

function DeployedView({
  user,
  agent,
  deployedStrategy,
  activeExperiment,
  onOpenCommandCenter,
  onStartNewExperiment,
  onViewActiveDashboard,
}) {
  const [recentBattles, setRecentBattles] = useState(null); // null = loading
  const [tradesPerGame, setTradesPerGame] = useState(null);

  // Fetch last 5 completed agentBattles for this agent. Filter on
  // state.status === 'completed' client-side — battles in this codebase
  // live under `state.status` rather than a top-level status field (see
  // existing queries in App.jsx).
  useEffect(() => {
    let cancelled = false;
    async function loadBattles() {
      if (!user?.uid || !agent?.id) {
        setRecentBattles([]);
        return;
      }
      try {
        const q = query(
          collection(db, 'agentBattles'),
          where('ownerId', '==', user.uid),
          where('agentId', '==', agent.id),
          orderBy('createdAt', 'desc'),
          limit(15)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const completed = all
          .filter(
            (b) =>
              b.state?.status === 'completed' || b.status === 'completed'
          )
          .slice(0, 5);

        const username = user?.username || user?.odUserId || null;
        const withResult = completed.map((b) => {
          const winner = b.result?.winner;
          let result = null;
          if (winner === 'tie') result = 'tie';
          else if (typeof winner === 'string' && username && winner === username) result = 'win';
          else if (winner === 'creator') {
            // Agent deploys are created by the user — treat creator win as user win.
            result = 'win';
          } else if (winner === 'opponent') result = 'loss';
          else if (winner) result = 'loss';
          return { id: b.id, result, trades: b.trades?.length ?? b.tradeCount ?? null };
        });
        setRecentBattles(withResult);

        const tradeCounts = withResult
          .map((b) => b.trades)
          .filter((n) => typeof n === 'number');
        if (tradeCounts.length > 0) {
          const avg =
            tradeCounts.reduce((s, n) => s + n, 0) / tradeCounts.length;
          setTradesPerGame(Math.round(avg * 10) / 10);
        } else {
          setTradesPerGame(null);
        }
      } catch (err) {
        console.warn('[ForgeLanding] recent battles fetch failed:', err?.message);
        if (!cancelled) setRecentBattles([]);
      }
    }
    loadBattles();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.username, user?.odUserId, agent?.id]);

  const wins = (recentBattles || []).filter((b) => b.result === 'win').length;
  const losses = (recentBattles || []).filter((b) => b.result === 'loss').length;
  const determined = wins + losses;
  const winRate = determined > 0 ? Math.round((wins / determined) * 100) : null;
  const recordText = determined > 0 ? `${wins}-${losses} record` : 'No battles yet';

  const deployedAtLabel = daysAgoLabel(deployedStrategy?.deployedAt);
  const strategyName =
    deployedStrategy?.experimentName || 'Deployed strategy';
  const grade = computeGrade(
    typeof deployedStrategy?.alpha === 'number' ? deployedStrategy.alpha : NaN
  );
  const fs =
    typeof deployedStrategy?.forgeScore === 'number'
      ? Math.round(deployedStrategy.forgeScore)
      : null;

  // Lifetime avg score from agent stats (more stable than recent-5).
  const avgScore =
    typeof agent?.stats?.avgScore === 'number'
      ? Math.round(agent.stats.avgScore)
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      <div
        style={{
          background: CARD_BG,
          border: `1px solid rgba(94,234,212,0.4)`,
          borderRadius: 12,
          padding: 14,
        }}
      >
        {/* LIVE badge row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.6px',
              background: 'rgba(94,234,212,0.18)',
              color: TEAL,
              padding: '3px 8px',
              borderRadius: 12,
            }}
          >
            LIVE
          </span>
          {deployedAtLabel && (
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>
              {deployedAtLabel}
            </span>
          )}
        </div>

        {/* Strategy identity row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          {deployedStrategy?.dimensionValues && (
            <MiniRadar
              dimensionValues={deployedStrategy.dimensionValues}
              size={80}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {strategyName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: TEXT_SECONDARY,
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {fs != null ? `Forge Score: ${fs}` : 'Forge Score: —'}
              {grade ? (
                <>
                  {' · '}
                  <span style={{ color: gradeColor(grade), fontWeight: 600 }}>
                    Grade {grade}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Recent battles */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${BORDER_SUBTLE}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: TEXT_SECONDARY,
              marginBottom: 8,
            }}
          >
            Recent battles
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {recentBattles === null ? (
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>Loading…</span>
            ) : recentBattles.length === 0 ? (
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                No battles yet — your agent will take the field on its next deploy.
              </span>
            ) : (
              <>
                {recentBattles.map((b) => (
                  <BattleDot key={b.id} result={b.result} />
                ))}
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, marginLeft: 4 }}>
                  {recordText}
                </span>
              </>
            )}
          </div>
        </div>

        <StatsRow
          items={[
            {
              value: avgScore != null ? avgScore : '—',
              label: 'Avg score',
            },
            {
              value: winRate != null ? `${winRate}%` : '—',
              label: 'Win rate',
            },
            {
              value: tradesPerGame != null ? tradesPerGame : '—',
              label: 'Trades / game',
            },
          ]}
        />
      </div>

      {activeExperiment && (
        <ActiveExperimentMiniCard
          season={activeExperiment.season}
          entry={activeExperiment.entry}
          onViewDashboard={onViewActiveDashboard}
        />
      )}

      <PrimaryCTA onClick={onOpenCommandCenter}>Open command center</PrimaryCTA>
      <SecondaryLink onClick={onStartNewExperiment}>
        Start a new experiment to improve
      </SecondaryLink>
    </div>
  );
}

// ── Agent card (Phase 6) ───────────────────────────────────────────────
//
// Always-present companion card whose tone adapts to the landing state.
// The agent is the user's partner across every chapter — waiting at the
// start, commenting while testing, advising on results, and celebrating
// in deployment. Dark-mode palette translation of the spec's light
// tokens: each state has a low-alpha tinted background + the matching
// brand stroke color, matching the LoopStep pattern used on State 1.
//
// Messages are template-only (no additional Firestore reads). If richer
// data (topHolding, weakDimension, etc.) becomes available in a later
// pass we can enrich the testing/deployed branches without changing
// the component shape.

function getAgentAccent(state) {
  switch (state) {
    case 'testing':
      return { bg: 'rgba(94,234,212,0.15)', stroke: TEAL };
    case 'results':
      return { bg: 'rgba(240,199,94,0.18)', stroke: TROPHY_GOLD };
    case 'deployed':
      return { bg: 'rgba(168,85,247,0.22)', stroke: '#C4B5FD' };
    case 'new':
    default:
      return { bg: SURFACE_BG, stroke: TEXT_MUTED };
  }
}

// Mouth path swaps by state — neutral in `new`, slight smile while
// testing, bigger smile once there are results to celebrate and once
// the agent is in the arena. Same face silhouette across all states
// so users recognize it as the same character.
function getAgentMouth(state) {
  switch (state) {
    case 'testing':
      return 'M8 15c1 1 3 1.5 4 1.5s3-.5 4-1.5';
    case 'results':
    case 'deployed':
      return 'M8 14c1 2 3 2.5 4 2.5s3-.5 4-2.5';
    case 'new':
    default:
      return 'M9 15h6';
  }
}

function getAgentMessage({ state, agent, experiment, deployedStrategy }) {
  if (state === 'new') {
    return "Waiting for a strategy. Build one and I'll test it for 4 weeks against the S&P 500.";
  }

  if (state === 'testing') {
    const alpha = experiment?.seasonState?.alphaVsSpy;
    const pitStop = Boolean(experiment?.isPitStopOpen);
    if (pitStop) {
      return "Weekly review is open. I've got some ideas on what to tweak — come take a look.";
    }
    if (typeof alpha === 'number' && alpha >= 1) {
      return `Up ${formatPct(alpha)} against the S&P. The strategy is working — let's keep feeding it data.`;
    }
    if (typeof alpha === 'number' && alpha <= -1) {
      return `Down ${formatPct(alpha, false)} this week. Stop-losses are doing their job. We'll see what the weekend review turns up.`;
    }
    return 'Testing in progress. Check the dashboard for today\u2019s moves.';
  }

  if (state === 'results') {
    const alpha = experiment?.seasonState?.alphaVsSpy;
    const grade = computeGrade(typeof alpha === 'number' ? alpha : NaN);
    if (grade === 'A' || grade === 'B') {
      return `Grade ${grade} is strong. Ready to deploy, or want to refine it first?`;
    }
    if (grade === 'C') {
      return `A ${grade} means there's room to improve. I'd suggest refining before deploying.`;
    }
    if (grade === 'D' || grade === 'F') {
      return `Honest take — a ${grade} means this one needs rework. Let's refine and try again.`;
    }
    return 'Experiment complete. Deploy it, refine it, or walk away — your call.';
  }

  if (state === 'deployed') {
    // Use lifetime stats from the agent doc rather than re-running the
    // recent-battles query. Keeps the card stateless.
    const wins = agent?.stats?.wins || 0;
    const losses = agent?.stats?.losses || 0;
    const gamesPlayed = agent?.stats?.gamesPlayed || 0;
    if (gamesPlayed === 0) {
      return "In the arena. I'll take the field on the next battle — check the command center to follow along.";
    }
    const winRate = Math.round((wins / gamesPlayed) * 100);
    const record = `${wins}-${losses}`;
    if (winRate >= 60) {
      return `${record} and climbing. The strategy is doing the heavy lifting out there.`;
    }
    if (winRate <= 40) {
      return `Rough stretch at ${record}. Might be time for a new experiment to find what's not working.`;
    }
    return `${record} on the board. Steady work — check the command center to see me in action.`;
  }

  // Defensive fallback — getLandingState only returns the four values above.
  return deployedStrategy ? 'In the arena.' : '';
}

function AgentCard({ state, agent, experiment, deployedStrategy }) {
  const accent = getAgentAccent(state);
  const mouthPath = getAgentMouth(state);
  const message = getAgentMessage({ state, agent, experiment, deployedStrategy });
  const name = agent?.name || 'Agent';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        marginTop: 16,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 12,
        background: CARD_BG,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: accent.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke={accent.stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.5" fill={accent.stroke} stroke="none" />
          <circle cx="15" cy="10" r="1.5" fill={accent.stroke} stroke="none" />
          <path d={mouthPath} />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: TEXT_PRIMARY,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            lineHeight: 1.4,
            marginTop: 4,
          }}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function ForgeLanding({
  // ForgeScreen pass-through props
  isMobile,
  onClose,
  user,
  onNavigateToSeasonHub,
  // Active experiment state (from App.jsx). `activeSeasonEntry` is the
  // currently-focused entry (used for the daily briefing panel and as
  // the fallback when only one experiment is live). `activeSeasonEntries`
  // is the full list — up to MAX_CONCURRENT entries.
  activeSeason,
  activeSeasonEntry,
  activeSeasonEntries = [],
  activeSeasonsById = {},
  // Agent
  agent,
  // Season navigation callbacks
  onViewDashboard,
  onJoinSeason,
  onReviewSeason,
  // Agent battle callback — State 4 uses this to route "Open command
  // center" to the active battle instead of the Season Hub fallback.
  // Optional; when absent or when agent.activeBattleId is empty, State
  // 4's CTA still falls back to onNavigateToSeasonHub.
  onOpenAgentBattle,
}) {
  const [view, setView] = useState('laboratory');
  const [seasons, setSeasons] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  // Per-entry dailyLog maps so State 2 can render one briefing per
  // active experiment. Keyed by entry id; each value is the full
  // dailyLog doc (or null if not yet written).
  const [dailyLogsById, setDailyLogsById] = useState({});
  const [dailyLoadingById, setDailyLoadingById] = useState({});

  // Per-entry dimensionValues map. Populated async because the canonical
  // dimensions live on the bundle doc (written at launch via
  // SeasonEntryModal / Workshop Mode), not on the entry itself.
  // resolveEntryDimensions covers the cheap sync paths (entry.algorithm,
  // localStorage cache) but on other devices those return null and the
  // mini radar would stay hidden without this bundle fallback. Mirrors
  // the same three-tier resolution SeasonReview.jsx uses.
  const [dimensionsById, setDimensionsById] = useState({});
  const [toast, setToast] = useState(null);
  const [workshopOpen, setWorkshopOpen] = useState(false);

  // Fetch all seasons + user's entries
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

  // Fetch the most recent dailyLog for each active experiment, in
  // parallel. Each card in State 2 renders its own briefing — capped
  // at 5 entries by MAX_CONCURRENT_EXPERIMENTS on the server, so this
  // fires at most 10 Firestore reads on mount (5 entries × 2-day
  // fallback). Serializing a list of { id, currentDay } values in the
  // dep keeps the effect stable when identity-equal parent arrays
  // rebuild on render.
  const dailyLogEntriesKey = useMemo(() => {
    const list = Array.isArray(activeSeasonEntries) && activeSeasonEntries.length > 0
      ? activeSeasonEntries
      : activeSeasonEntry
      ? [activeSeasonEntry]
      : [];
    return list
      .map((e) => `${e.id}:${e?.seasonState?.currentDay ?? ''}`)
      .join('|');
  }, [activeSeasonEntries, activeSeasonEntry]);

  useEffect(() => {
    let cancelled = false;
    const list =
      Array.isArray(activeSeasonEntries) && activeSeasonEntries.length > 0
        ? activeSeasonEntries
        : activeSeasonEntry
        ? [activeSeasonEntry]
        : [];

    if (list.length === 0) {
      setDailyLogsById({});
      setDailyLoadingById({});
      return undefined;
    }

    // Start everyone loading at once so the cards don't flicker between
    // "loading" and "waiting for first evaluation" on each resolve.
    const loadingFlags = Object.fromEntries(list.map((e) => [e.id, true]));
    setDailyLoadingById(loadingFlags);

    async function loadOne(entry) {
      const currentDay =
        entry?.seasonState?.currentDay ?? activeSeason?.currentDay ?? 0;
      const candidates = [currentDay, currentDay - 1].filter((d) => d >= 0);
      for (const dayNum of candidates) {
        try {
          const ref = doc(
            db,
            'seasonEntries',
            entry.id,
            'dailyLogs',
            String(dayNum)
          );
          const snap = await getDoc(ref);
          if (snap.exists()) {
            return { id: snap.id, ...snap.data() };
          }
        } catch (err) {
          console.warn('[ForgeLanding] dailyLog fetch failed:', entry.id, err?.message);
          return null;
        }
      }
      return null;
    }

    Promise.all(list.map((e) => loadOne(e).then((log) => [e.id, log]))).then(
      (pairs) => {
        if (cancelled) return;
        const nextLogs = {};
        const nextLoading = {};
        for (const [id, log] of pairs) {
          nextLogs[id] = log;
          nextLoading[id] = false;
        }
        setDailyLogsById(nextLogs);
        setDailyLoadingById(nextLoading);
      }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyLogEntriesKey, activeSeason?.currentDay]);

  // Resolve dimensionValues for each active entry. Three-tier lookup,
  // mirroring SeasonReview.jsx:195-230:
  //   1. resolveEntryDimensions() — sync (entry.algorithm, localStorage)
  //   2. bundle doc at agents/{agentId}/bundles/{bundleId} — canonical
  //   3. null — MiniRadar self-hides
  //
  // Rerun when the set of active entry IDs changes. Bundle dims are
  // immutable once written, so we don't need to refetch on other fields.
  const activeEntryIdsKey = useMemo(() => {
    const list =
      Array.isArray(activeSeasonEntries) && activeSeasonEntries.length > 0
        ? activeSeasonEntries
        : activeSeasonEntry
        ? [activeSeasonEntry]
        : [];
    return list.map((e) => e.id).join('|');
  }, [activeSeasonEntries, activeSeasonEntry]);

  useEffect(() => {
    let cancelled = false;
    const list =
      Array.isArray(activeSeasonEntries) && activeSeasonEntries.length > 0
        ? activeSeasonEntries
        : activeSeasonEntry
        ? [activeSeasonEntry]
        : [];

    if (!agent?.id || list.length === 0) {
      setDimensionsById({});
      return undefined;
    }

    async function resolveOne(entry) {
      const sync = resolveEntryDimensions(entry);
      if (sync) return sync;
      const bundleId = entry.bundleId || entry.algorithm?.bundleId || null;
      if (!bundleId) return null;
      try {
        const snap = await getDoc(
          doc(db, 'agents', agent.id, 'bundles', bundleId)
        );
        if (snap.exists()) {
          return snap.data()?.dimensionValues || null;
        }
      } catch (err) {
        console.warn('[ForgeLanding] bundle dims fetch failed:', entry.id, err?.message);
      }
      return null;
    }

    Promise.all(list.map((e) => resolveOne(e).then((dims) => [e.id, dims]))).then(
      (pairs) => {
        if (cancelled) return;
        setDimensionsById(Object.fromEntries(pairs));
      }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntryIdsKey, agent?.id]);

  // Build categorized experiment lists: completed (for State 3 / past-rows)
  // and the next upcoming season (for launch callbacks).
  const { past, nextUpcoming } = useMemo(() => {
    const entryMap = new Map(entries.map((e) => [e.seasonId, e]));
    const pastList = seasons
      .filter((s) => s.status === 'completed' && entryMap.has(s.id))
      .map((s) => ({ ...s, entry: entryMap.get(s.id) }));
    // Sort completed with most-recent first — SeasonEntry.completedAt if
    // present, otherwise fall back to the season's end/start date.
    pastList.sort((a, b) => {
      const aT = a.entry?.completedAt
        ? new Date(a.entry.completedAt).getTime()
        : a.endDate
        ? new Date(a.endDate).getTime()
        : 0;
      const bT = b.entry?.completedAt
        ? new Date(b.entry.completedAt).getTime()
        : b.endDate
        ? new Date(b.endDate).getTime()
        : 0;
      return bT - aT;
    });
    const upcomingList = seasons.filter(
      (s) => s.status === 'upcoming' || s.status === 'active'
    );
    upcomingList.sort((a, b) => {
      const aT = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bT = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return aT - bT;
    });
    return { past: pastList, nextUpcoming: upcomingList[0] || null };
  }, [seasons, entries]);

  // Users can run up to MAX_CONCURRENT_EXPERIMENTS simultaneously (the server
  // enforces the same cap in api/season/create-entry.js).
  const MAX_CONCURRENT_EXPERIMENTS = 5;
  const activeEntriesList = useMemo(() => {
    if (Array.isArray(activeSeasonEntries) && activeSeasonEntries.length > 0) {
      return activeSeasonEntries;
    }
    if (activeSeasonEntry) return [activeSeasonEntry];
    return [];
  }, [activeSeasonEntries, activeSeasonEntry]);
  const atLaunchCap = activeEntriesList.length >= MAX_CONCURRENT_EXPERIMENTS;

  // ── State detection inputs ─────────────────────────────────────────
  //
  // State 2's presence is driven by `focusedExperiment`, but the testing
  // view itself renders the full `testingExperiments[]` so users with
  // 2+ active experiments see every card stacked.
  // `completedExperiments` is the sorted `past` list — latest first.
  // `deployedStrategy` lives on the agent doc (see deployStrategyService).
  // A deployed strategy whose bundle the user manually unequipped in the
  // Advanced tab is treated as not-deployed, matching prior card logic.
  const deployedStrategy = useMemo(() => {
    const ds = agent?.deployedStrategy || null;
    if (!ds || !ds.bundleId) return null;
    const equipped = Array.isArray(agent?.equippedBundleIds)
      ? agent.equippedBundleIds
      : [];
    if (!equipped.includes(ds.bundleId)) return null;
    return ds;
  }, [agent?.deployedStrategy, agent?.equippedBundleIds]);

  // All active experiments paired with their season docs, preserving the
  // order from activeSeasonEntries. Any entry whose season doc hasn't
  // loaded is dropped so the card list never renders an orphan.
  const testingExperiments = useMemo(() => {
    return activeEntriesList
      .map((entry) => {
        const season =
          activeSeasonsById[entry.seasonId] ||
          (activeSeason && activeSeason.id === entry.seasonId ? activeSeason : null);
        return { entry, season };
      })
      .filter((e) => e.season);
  }, [activeEntriesList, activeSeason, activeSeasonsById]);

  // Focused experiment — the one whose daily briefing is shown and the
  // default target for the weekday CTA. Matches App.jsx's `activeSeasonEntry`
  // (which is what powers dailyLog fetching) so the briefing and the
  // highlighted card line up.
  const focusedExperiment = useMemo(() => {
    if (testingExperiments.length === 0) return null;
    return (
      testingExperiments.find((e) => e.entry.id === activeSeasonEntry?.id) ||
      testingExperiments[0]
    );
  }, [testingExperiments, activeSeasonEntry?.id]);

  const latestCompleted = past[0] || null;

  const landingState = getLandingState({
    activeExperiment: focusedExperiment,
    completedExperiments: past,
    deployedStrategy,
  });

  // ── Callbacks ──────────────────────────────────────────────────────

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 2500);
  };

  const handleBuildStrategy = () => {
    // Workshop Mode — conversational strategy development
    if (!agent?.id) {
      showToast('Create an agent first to use Workshop Mode');
      return;
    }
    if (atLaunchCap) {
      showToast(
        `Maximum ${MAX_CONCURRENT_EXPERIMENTS} concurrent experiments — complete one to start another.`
      );
      return;
    }
    if (!nextUpcoming) {
      showToast('No upcoming experiment to deploy to — check back soon');
      return;
    }
    setWorkshopOpen(true);
  };

  const handleWorkshopCompiled = (result) => {
    setWorkshopOpen(false);
    if (nextUpcoming && onJoinSeason) {
      onJoinSeason(nextUpcoming, {
        initialDimensionValues: result.dimensionValues,
        initialStep: 1,
        workshopThesisId: result.thesisId,
        workshopConfidence: result.confidence,
        workshopMappingNotes: result.mappingNotes,
        workshopWarnings: result.warnings,
      });
    } else {
      showToast('Strategy compiled — but no experiment to deploy to');
    }
  };

  const handleConfigureManually = (opts) => {
    if (atLaunchCap) {
      showToast(
        `Maximum ${MAX_CONCURRENT_EXPERIMENTS} concurrent experiments — complete one to start another.`
      );
      return;
    }
    if (nextUpcoming && onJoinSeason) {
      onJoinSeason(nextUpcoming, opts);
    } else {
      showToast('No upcoming experiments available');
    }
  };

  // ── Advanced view: render ForgeScreen full-bleed ──────────────────
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

  // ── Laboratory view ───────────────────────────────────────────────
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

      <div style={{ padding: '0 16px', maxWidth: 480, margin: '0 auto' }}>
        {/* ── State-branched body ────────────────────────────────── */}
        {landingState === 'new' && (
          <NewUserHero
            onBuildStrategy={handleBuildStrategy}
            onConfigureManually={handleConfigureManually}
          />
        )}

        {landingState === 'testing' && focusedExperiment && (
          <TestingView
            experiments={testingExperiments}
            focusedExperiment={focusedExperiment}
            dailyLogsById={dailyLogsById}
            dailyLoadingById={dailyLoadingById}
            dimensionsById={dimensionsById}
            onViewDashboard={onViewDashboard}
          />
        )}

        {landingState === 'results' && latestCompleted && (
          <ResultsView
            season={latestCompleted}
            entry={latestCompleted.entry}
            past={past}
            onDeploy={() => onViewDashboard && onViewDashboard(latestCompleted, latestCompleted.entry)}
            onRefine={() => {
              const dims = resolveEntryDimensions(latestCompleted.entry);
              handleConfigureManually({
                ...(dims ? { initialDimensionValues: dims } : {}),
                initialStep: 1,
                sourceExperimentId: latestCompleted.entry?.id,
              });
            }}
            onReviewReport={() =>
              onReviewSeason && onReviewSeason(latestCompleted, latestCompleted.entry)
            }
            onReviewPast={(s, e) => onReviewSeason && onReviewSeason(s, e)}
          />
        )}

        {landingState === 'deployed' && (
          <DeployedView
            user={user}
            agent={agent}
            deployedStrategy={deployedStrategy}
            activeExperiment={focusedExperiment}
            onOpenCommandCenter={() => {
              // Prefer routing to the agent's active battle when one
              // exists — the button text promises the command center,
              // not a hub screen. Fall back to Season Hub when the
              // agent has no active battle or the callback wasn't
              // wired through by the parent.
              const activeBattleId = agent?.activeBattleId;
              if (activeBattleId && onOpenAgentBattle) {
                onOpenAgentBattle(activeBattleId);
                return;
              }
              if (onNavigateToSeasonHub) onNavigateToSeasonHub();
            }}
            onStartNewExperiment={() => handleConfigureManually()}
            onViewActiveDashboard={() =>
              focusedExperiment &&
              onViewDashboard &&
              onViewDashboard(focusedExperiment.season, focusedExperiment.entry)
            }
          />
        )}

        {/* ── Agent card — always present, voice adapts to state ── */}
        <AgentCard
          state={landingState}
          agent={agent}
          experiment={focusedExperiment?.entry || latestCompleted?.entry}
          deployedStrategy={deployedStrategy}
        />

        {loading && landingState === 'new' && (
          // Tiny courtesy indicator for first-time users while seasons load;
          // everything else renders immediately from props.
          <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginTop: 12 }}>
            Loading…
          </div>
        )}
      </div>

      {/* Workshop Mode — conversational strategy development */}
      <WorkshopChat
        isOpen={workshopOpen}
        onClose={() => setWorkshopOpen(false)}
        user={user}
        agent={agent}
        onCompiled={handleWorkshopCompiled}
      />

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

// Re-export helpers so views built in later phases can share them without
// import churn. `dimensionToRadarScore` comes from the shared util and isn't
// re-exported here — import it directly from `src/utils/dimensionRadarScore`.
export {
  TROPHY_GOLD,
  TEAL,
  POSITIVE,
  NEGATIVE,
  WARNING,
  CARD_BG,
  SURFACE_BG,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BORDER_SUBTLE,
  formatPct,
  isPitStopOpen,
  computeGrade,
  gradeColor,
  getLandingState,
};
