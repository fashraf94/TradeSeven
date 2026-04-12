// src/screens/SeasonReview.jsx
//
// Post-season review screen. Navigated to from SeasonHub's "Review" button on
// completed seasons. Shows final stats (with client-side computed Sharpe /
// consistency / recovery), derived badges, a RuleReportCard for each rule in
// the user's algorithm, and a CTA to refine in the Forge for the next season.
//
// Props:
//   user              - current user object
//   season            - completed season document
//   entry             - completed seasonEntry document
//   onBack            - back to SeasonHub
//   onNavigateForge   - open the Forge in season mode (App.jsx sets forgeMode)
//
// Data sources (all verified available):
//   entry.seasonState.alphaVsSpy   — raw percentage
//   entry.portfolio.totalReturn    — raw percentage
//   entry.portfolio.drawdownFromPeak
//   entry.dailySnapshots[]         — used for Sharpe + consistency computation
//   entry.rulePerformance[ruleId]  — aggregated across the season
//   entry.algorithm.rules[]        — rule list for report cards
//   leaderboard.rankings[]         — final rank lookup by entryId
//   leaderboard.stats              — spyReturn, participantCount, etc.
//
// Notes:
// - Final percentages are stored as raw percentages (2.34 = 2.34%), never
//   decimals. Do NOT multiply by 100.
// - computeFinalMetrics is imported from api/_utils/seasonLeaderboard.js —
//   that file is pure ES module with no node-only deps (same pattern used by
//   src/services/fantasyTimesDetector.js importing from api/_utils/).

import React, { useEffect, useMemo, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { HOLO_COLORS } from '../constants/holoTheme';
import { computeFinalMetrics } from '../../api/_utils/seasonLeaderboard';
import RuleReportCard from '../components/Season/RuleReportCard';

const TROPHY_GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const MUTED = '#8B949E';

// ─── Formatting helpers ────────────────────────────────────────

function formatPct(n, digits = 2) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function formatNum(n, digits = 2) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function pctColor(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return HOLO_COLORS.textPrimary;
  return n >= 0 ? POSITIVE : NEGATIVE;
}

// ─── Animated percentage display (matches SeasonScoreHeader) ──

function AnimatedPct({ value, color, fontSize = 48, fontWeight = 800 }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });

  useEffect(() => {
    spring.set(typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, [value, spring]);

  const display = useTransform(spring, (v) => {
    const rounded = Math.round(v * 100) / 100;
    return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(2)}%`;
  });

  return (
    <motion.span style={{ color, fontSize, fontWeight, lineHeight: 1 }}>
      {display}
    </motion.span>
  );
}

// ─── Stat cell ─────────────────────────────────────────────────

function StatCell({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: color || HOLO_COLORS.textPrimary,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Badge definitions ─────────────────────────────────────────
// Derived client-side from entry state. When the finalization endpoint lands,
// replace these with `entry.badges` reads.

function deriveBadges(entry, finalMetrics, leaderboardRank, totalParticipants) {
  const earned = [];
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const drawdown = finalMetrics?.maxDrawdown ?? entry?.portfolio?.drawdownFromPeak ?? 0;
  const consistency = finalMetrics?.consistencyPct ?? 0;

  if (alpha > 0) {
    earned.push({ key: 'marketBeater', label: 'Market Beater', icon: '🏆', color: POSITIVE });
  }
  if (alpha > 5) {
    earned.push({ key: 'marketCrusher', label: 'Market Crusher', icon: '💪', color: TROPHY_GOLD });
  }
  if (drawdown > -3) {
    earned.push({ key: 'unshakable', label: 'The Unshakable', icon: '🛡️', color: '#5EEAD4' });
  }
  if (consistency >= 70) {
    earned.push({ key: 'consistent', label: 'Consistency King', icon: '🎯', color: '#A78BFA' });
  }
  if (leaderboardRank != null && leaderboardRank <= 3) {
    earned.push({ key: 'podium', label: 'Podium Finish', icon: '🥇', color: TROPHY_GOLD });
  }
  if (
    leaderboardRank != null &&
    totalParticipants != null &&
    totalParticipants > 0 &&
    leaderboardRank / totalParticipants <= 0.1
  ) {
    earned.push({ key: 'topTen', label: 'Top 10%', icon: '⭐', color: TROPHY_GOLD });
  }
  return earned;
}

// ─── Back arrow ────────────────────────────────────────────────

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────

export default function SeasonReview({ user: _user, season, entry, onBack, onNavigateForge }) {
  const [leaderboard, setLeaderboard] = useState(null);

  // Load leaderboard for final rank + spy return
  useEffect(() => {
    if (!season?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'seasonLeaderboard', season.id));
        if (!cancelled && snap.exists()) {
          setLeaderboard(snap.data());
        }
      } catch (err) {
        console.error('[SeasonReview] Failed to load leaderboard:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [season?.id]);

  // Compute final metrics client-side (no trades passed — win rate/profit
  // factor will be null, but sharpe/drawdown/consistency/recovery all work
  // from dailySnapshots alone).
  const finalMetrics = useMemo(() => {
    if (!entry) return null;
    try {
      return computeFinalMetrics(entry, season || {}, []);
    } catch (err) {
      console.error('[SeasonReview] computeFinalMetrics failed:', err);
      return null;
    }
  }, [entry, season]);

  // Pull values
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const totalReturn = entry?.portfolio?.totalReturn ?? 0;
  const myRankRow = leaderboard?.rankings?.find((r) => r.entryId === entry?.id);
  const rank = myRankRow?.rank ?? null;
  const totalParticipants = leaderboard?.stats?.participantCount ?? null;
  const spyReturn = leaderboard?.stats?.spyReturn ?? null;
  const sharpe = finalMetrics?.sharpe ?? null;
  const maxDrawdown = finalMetrics?.maxDrawdown ?? entry?.portfolio?.drawdownFromPeak ?? 0;

  const badges = useMemo(
    () => deriveBadges(entry, finalMetrics, rank, totalParticipants),
    [entry, finalMetrics, rank, totalParticipants]
  );

  // Sort rules: graded (A first) then ungraded. For now, sort by rulePerformance.timesCited desc.
  const rules = useMemo(() => {
    const r = entry?.algorithm?.rules || [];
    const perf = entry?.rulePerformance || {};
    return r.slice().sort((a, b) => {
      const ac = perf[a.ruleId]?.timesCited || 0;
      const bc = perf[b.ruleId]?.timesCited || 0;
      return bc - ac;
    });
  }, [entry?.algorithm?.rules, entry?.rulePerformance]);

  // Guard
  if (!season || !entry) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: HOLO_COLORS.bgCard,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          color: HOLO_COLORS.textMuted,
        }}
      >
        <div style={{ marginBottom: 16, fontSize: 14 }}>No season to review.</div>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: HOLO_COLORS.primary,
            border: `1px solid ${HOLO_COLORS.primary}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: HOLO_COLORS.bgDeep,
        color: HOLO_COLORS.textPrimary,
        paddingBottom: 80,
      }}
    >
      {/* ─── Sticky header ─── */}
      <div
        style={{
          background: HOLO_COLORS.bgElevated,
          borderBottom: `1px solid ${TROPHY_GOLD}`,
          padding: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: HOLO_COLORS.primary,
            fontSize: 14,
            fontWeight: 600,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
          }}
        >
          <BackArrow />
          Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Experiment Report</h1>
          <div style={{ fontSize: 11, color: HOLO_COLORS.textMuted, marginTop: 2 }}>
            {season.name || 'Experiment'} · Complete
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
        {/* Final results hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background: HOLO_COLORS.bgElevated,
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderTop: `3px solid ${TROPHY_GOLD}`,
            borderRadius: 16,
            padding: '24px 16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: HOLO_COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Final Alpha
          </div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <AnimatedPct value={alpha} color={alpha >= 0 ? POSITIVE : NEGATIVE} />
          </div>

          {/* 6-stat grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              padding: '16px 0',
              borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
            }}
          >
            <StatCell
              label="Rank"
              value={rank ? `#${rank}${totalParticipants ? ` / ${totalParticipants}` : ''}` : '—'}
              color={rank && rank <= 3 ? TROPHY_GOLD : HOLO_COLORS.textPrimary}
            />
            <StatCell
              label="Total Return"
              value={formatPct(totalReturn)}
              color={pctColor(totalReturn)}
            />
            <StatCell
              label="S&P 500"
              value={formatPct(spyReturn)}
              color={HOLO_COLORS.textPrimary}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              padding: '16px 0 0 0',
            }}
          >
            <StatCell
              label="Sharpe"
              value={formatNum(sharpe)}
              color={HOLO_COLORS.textPrimary}
            />
            <StatCell
              label="Max Drawdown"
              value={formatPct(maxDrawdown)}
              color={maxDrawdown < 0 ? NEGATIVE : HOLO_COLORS.textPrimary}
            />
            <StatCell
              label="Consistency"
              value={
                typeof finalMetrics?.consistencyPct === 'number'
                  ? `${finalMetrics.consistencyPct.toFixed(0)}%`
                  : '—'
              }
              color={HOLO_COLORS.textPrimary}
            />
          </div>
        </motion.div>

        {/* Badges */}
        {badges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{ marginBottom: 20 }}
          >
            <div
              style={{
                fontSize: 11,
                color: HOLO_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 600,
                marginBottom: 10,
                paddingLeft: 4,
              }}
            >
              Badges Earned
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              {badges.map((b, i) => (
                <motion.div
                  key={b.key}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: 0.3 + i * 0.1,
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    background: `${b.color}15`,
                    border: `1px solid ${b.color}55`,
                    borderRadius: 24,
                    fontSize: 13,
                    fontWeight: 600,
                    color: b.color,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{b.icon}</span>
                  {b.label}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rule Report Cards */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              color: HOLO_COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
              marginBottom: 12,
              paddingLeft: 4,
            }}
          >
            Rule Report Cards
          </div>
          {rules.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                color: MUTED,
                fontSize: 13,
                background: HOLO_COLORS.bgElevated,
                borderRadius: 12,
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              }}
            >
              No rules equipped this experiment.
            </div>
          ) : (
            rules.map((rule, i) => (
              <RuleReportCard
                key={rule.ruleId}
                rule={rule}
                performance={entry?.rulePerformance?.[rule.ruleId]}
                index={i}
              />
            ))
          )}
        </div>

        {/* Re-entry CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          style={{
            background: HOLO_COLORS.bgElevated,
            border: `1px solid ${TROPHY_GOLD}44`,
            borderRadius: 16,
            padding: 20,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              marginBottom: 6,
            }}
          >
            Ready for Next Experiment?
          </div>
          <div
            style={{
              fontSize: 13,
              color: HOLO_COLORS.textSecondary,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            Refine your algorithm in the Forge based on what worked — and what didn't.
          </div>
          <button
            onClick={onNavigateForge}
            style={{
              padding: '12px 24px',
              background: TROPHY_GOLD,
              color: HOLO_COLORS.bgDeep,
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 0 20px ${TROPHY_GOLD}44`,
            }}
          >
            Refine in the Forge →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
