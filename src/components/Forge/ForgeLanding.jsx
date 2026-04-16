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
} from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
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

// Full-size experiment card — used when exactly one active experiment.
// Keeps the mini radar + alpha hero + stats row + pit-stop banner layout.
function FullExperimentCard({ season, entry, pitStop, dailyLog, dims }) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const week = entry?.seasonState?.currentWeek || 1;
  const totalWeeks = Array.isArray(season?.weeks) ? season.weeks.length : 4;
  const rank = entry?.seasonState?.rank;
  const totalEntries = season?.entryCount;
  const forgeScore =
    entry?.seasonState?.forgeScore ?? entry?.forgeScore ?? null;
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;
  const tradesToday = Array.isArray(dailyLog?.trades) ? dailyLog.trades.length : null;

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 12,
        padding: 14,
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
          marginTop: 16,
          paddingTop: 12,
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
    </div>
  );
}

// Compact variant used when 2+ experiments are stacked. Single-row layout:
// small radar + name/week on the left, alpha on the right. Tappable.
function CompactExperimentCard({ season, entry, focused, onTap }) {
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const week = entry?.seasonState?.currentWeek || 1;
  const totalWeeks = Array.isArray(season?.weeks) ? season.weeks.length : 4;
  const rank = entry?.seasonState?.rank;
  const forgeScore =
    entry?.seasonState?.forgeScore ?? entry?.forgeScore ?? null;
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;
  const dims = resolveEntryDimensions(entry);

  return (
    <button
      onClick={onTap}
      style={{
        width: '100%',
        background: CARD_BG,
        border: `1px solid ${focused ? 'rgba(240,199,94,0.35)' : BORDER_SUBTLE}`,
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        minWidth: 0,
      }}
    >
      {dims ? (
        <MiniRadar dimensionValues={dims} size={56} />
      ) : (
        <div style={{ width: 56, height: 56, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {season?.name || 'Experiment'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: TEXT_SECONDARY,
            marginTop: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Week {week} of {totalWeeks}
          {rank ? ` · #${rank}` : ''}
          {forgeScore != null ? ` · FS ${Math.round(forgeScore)}` : ''}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 16,
          fontWeight: 600,
          color: alphaColor,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          flexShrink: 0,
        }}
      >
        {alpha >= 0 ? (
          <TrendingUp size={14} color={alphaColor} />
        ) : (
          <TrendingDown size={14} color={alphaColor} />
        )}
        {formatPct(alpha)}
      </div>
    </button>
  );
}

function TestingView({
  experiments,
  focusedExperiment,
  dailyLog,
  dailyLogLoading,
  tradingDay,
  onViewDashboard,
}) {
  const multi = experiments.length > 1;

  // Pit stop CTA should act on the experiment whose pit stop is actually
  // open (not necessarily the focused one). Banner names that experiment
  // when there are 2+ so the user knows which dashboard they're opening.
  const pitStopExperiment =
    experiments.find((e) => isPitStopOpen(e.season, e.entry)) || null;
  const anyPitStopOpen = Boolean(pitStopExperiment);
  const focusedPitStop = isPitStopOpen(focusedExperiment.season, focusedExperiment.entry);
  const focusedDims = resolveEntryDimensions(focusedExperiment.entry);

  const handleCta = () => {
    if (!onViewDashboard) return;
    if (anyPitStopOpen) {
      onViewDashboard(pitStopExperiment.season, pitStopExperiment.entry);
    } else {
      onViewDashboard(focusedExperiment.season, focusedExperiment.entry);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      {/* Multi-experiment shared pit-stop banner — names the specific
          experiment so a tap on the CTA lands on the right dashboard. */}
      {multi && anyPitStopOpen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: 'rgba(240,199,94,0.08)',
            border: `1px solid rgba(240,199,94,0.35)`,
            borderRadius: 8,
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
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: TROPHY_GOLD,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Weekly review open for {pitStopExperiment.season?.name || 'an experiment'}
          </div>
        </div>
      )}

      {/* Card layout — full for 1, compact stacked for 2+. */}
      {multi ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {experiments.map(({ season, entry }) => (
            <CompactExperimentCard
              key={entry.id}
              season={season}
              entry={entry}
              focused={entry.id === focusedExperiment.entry.id}
              onTap={() => onViewDashboard && onViewDashboard(season, entry)}
            />
          ))}
        </div>
      ) : (
        <FullExperimentCard
          season={focusedExperiment.season}
          entry={focusedExperiment.entry}
          pitStop={focusedPitStop}
          dailyLog={dailyLog}
          dims={focusedDims}
        />
      )}

      {/* Daily briefing — rendered once for the focused entry. When there
          are 2+ experiments we add a helper line so users know per-
          experiment briefings are still reachable from each dashboard. */}
      <DailyBriefingCard
        entry={focusedExperiment.entry}
        dailyLog={dailyLog}
        tradingDay={tradingDay}
        loading={dailyLogLoading}
      />
      {multi && (
        <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginTop: -4 }}>
          Showing {focusedExperiment.season?.name || 'the focused experiment'}. Tap any card for its own briefing.
        </div>
      )}

      {/* Contextual CTA — weekend variant when any experiment has pit
          stop open; otherwise weekday. Trophy-gold across all states. */}
      {anyPitStopOpen ? (
        <>
          <PrimaryCTA onClick={handleCta}>Open weekly review</PrimaryCTA>
          <SecondaryLink
            onClick={() =>
              onViewDashboard &&
              onViewDashboard(focusedExperiment.season, focusedExperiment.entry)
            }
          >
            View full dashboard
          </SecondaryLink>
        </>
      ) : (
        <PrimaryCTA onClick={handleCta}>View full dashboard</PrimaryCTA>
      )}
    </div>
  );
}

function ResultsView(/* props wired in Phase 4 */) {
  return (
    <div style={{ padding: 24, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 4 fills this in */}
      Results view — coming in Phase 4.
    </div>
  );
}

function DeployedView(/* props wired in Phase 5 */) {
  return (
    <div style={{ padding: 24, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 5 fills this in */}
      Deployed view — coming in Phase 5.
    </div>
  );
}

function AgentCard(/* props wired in Phase 6 */) {
  return (
    <div style={{ padding: 14, marginTop: 16, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 6 fills this in */}
      Agent card — coming in Phase 6.
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
}) {
  const [view, setView] = useState('laboratory');
  const [seasons, setSeasons] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyLog, setDailyLog] = useState(null);
  const [dailyLogLoading, setDailyLogLoading] = useState(false);
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

  // Fetch the most recent dailyLog for the active experiment (used by State 2)
  useEffect(() => {
    let cancelled = false;
    async function loadDailyLog() {
      if (!activeSeasonEntry?.id) {
        setDailyLog(null);
        return;
      }
      setDailyLogLoading(true);
      try {
        const currentDay =
          activeSeasonEntry?.seasonState?.currentDay ??
          activeSeason?.currentDay ??
          0;
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
  const tradingDay =
    activeSeasonEntry?.seasonState?.currentDay ??
    activeSeason?.currentDay ??
    dailyLog?.day ??
    0;

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
            dailyLog={dailyLog}
            dailyLogLoading={dailyLogLoading}
            tradingDay={tradingDay}
            onViewDashboard={onViewDashboard}
          />
        )}

        {landingState === 'results' && latestCompleted && (
          <ResultsView
            season={latestCompleted}
            entry={latestCompleted.entry}
            past={past}
            onDeploy={() => onViewDashboard && onViewDashboard(latestCompleted, latestCompleted.entry)}
            onRefine={() =>
              handleConfigureManually({
                initialDimensionValues: latestCompleted.entry?.algorithm?.dimensionValues,
                initialStep: 1,
                sourceExperimentId: latestCompleted.entry?.id,
              })
            }
            onReviewReport={() => onReviewSeason && onReviewSeason(latestCompleted, latestCompleted.entry)}
          />
        )}

        {landingState === 'deployed' && (
          <DeployedView
            user={user}
            agent={agent}
            deployedStrategy={deployedStrategy}
            activeExperiment={focusedExperiment}
            onOpenCommandCenter={() => onNavigateToSeasonHub && onNavigateToSeasonHub()}
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
