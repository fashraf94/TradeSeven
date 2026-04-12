// src/components/Season/RuleReportCard.jsx
//
// Post-season grade card for a single rule from the user's algorithm.
// Renders a rule's name (from FORGE_RULE_TEMPLATES), category color,
// letter grade, trigger counts, and a plain-language insight line.
//
// Grades are derived client-side from entry.rulePerformance[ruleId] because
// the finalization endpoint (computeFinalMetrics-backed) is not wired yet —
// when it lands, pass a pre-computed grade via the `grade` prop to override.
//
// Props:
//   rule        - entry.algorithm.rules[n] ({ ruleId, category, params, ... })
//   performance - entry.rulePerformance[ruleId] (may be undefined)
//   grade       - optional pre-computed letter grade; falls back to derived
//   index       - card index for staggered reveal animation
//
// Verified rulePerformance fields (from api/_utils/seasonSettlement.js:508-568):
//   timesCited, sellsTriggered, returnAtSell, timesPassedEntry,
//   timesBlockedEntry, timesActivated

import React from 'react';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { FORGE_CATEGORIES, FORGE_RULE_TEMPLATES } from '../../data/forgeKnowledgeBase';

const GRADE_COLORS = {
  'A+': '#34D399',
  'A': '#34D399',
  'B+': '#5EEAD4',
  'B': '#5EEAD4',
  'C+': '#F59E0B',
  'C': '#F59E0B',
  'D': '#FB923C',
  'F': '#EF4444',
  '—': HOLO_COLORS.textMuted,
};

const MUTED = '#8B949E';

// ─── Lookup helpers ────────────────────────────────────────────

function lookupTemplate(ruleId) {
  return FORGE_RULE_TEMPLATES.find((t) => t.id === ruleId) || null;
}

function categoryColor(categoryId) {
  const cat = FORGE_CATEGORIES.find((c) => c.id === categoryId);
  return cat?.color || HOLO_COLORS.textMuted;
}

function categoryLabel(categoryId) {
  const cat = FORGE_CATEGORIES.find((c) => c.id === categoryId);
  return cat?.label || categoryId || '';
}

// ─── Grade derivation ──────────────────────────────────────────
// Rough client-side heuristic — will be superseded by the eventual
// finalization endpoint's server-computed grades.

function deriveGrade(ruleId, performance) {
  if (!performance || !performance.timesCited || performance.timesCited === 0) {
    return '—';
  }

  // Entry rules: grade on pass ratio
  if (typeof ruleId === 'string' && ruleId.startsWith('se-')) {
    const passes = performance.timesPassedEntry || 0;
    const blocks = performance.timesBlockedEntry || 0;
    const total = passes + blocks;
    if (total === 0) return 'C';
    const passRate = passes / total;
    if (passRate > 0.8) return 'A';
    if (passRate > 0.6) return 'B';
    if (passRate > 0.4) return 'C';
    return 'D';
  }

  // Exit rules: grade on triggered + positive returnAtSell
  if (typeof ruleId === 'string' && ruleId.startsWith('sx-')) {
    const triggered = performance.sellsTriggered || 0;
    if (triggered === 0) return 'C';
    if (typeof performance.returnAtSell === 'number' && performance.returnAtSell > 0) return 'A';
    return 'B';
  }

  // Rebalance / strategy / other: just "B" when cited
  return 'B';
}

// ─── Insight copy ──────────────────────────────────────────────

function deriveInsight(ruleId, performance) {
  if (!performance || !performance.timesCited) {
    return 'Never triggered this experiment — consider loosening conditions if this surprises you.';
  }
  const cited = performance.timesCited;

  if (typeof ruleId === 'string' && ruleId.startsWith('se-')) {
    const passes = performance.timesPassedEntry || 0;
    const blocks = performance.timesBlockedEntry || 0;
    const total = passes + blocks;
    if (total === 0) {
      return `Evaluated ${cited} times but no entry decisions recorded.`;
    }
    const rate = Math.round((passes / total) * 100);
    return `Let ${passes} candidate${passes === 1 ? '' : 's'} through and blocked ${blocks} (${rate}% pass rate).`;
  }

  if (typeof ruleId === 'string' && ruleId.startsWith('sx-')) {
    const sells = performance.sellsTriggered || 0;
    if (sells === 0) {
      return `Cited ${cited} times but never actually triggered a sell.`;
    }
    if (typeof performance.returnAtSell === 'number') {
      const r = performance.returnAtSell;
      return `Triggered ${sells} sell${sells === 1 ? '' : 's'}. Most recent exit: ${r >= 0 ? '+' : ''}${r.toFixed(2)}%.`;
    }
    return `Triggered ${sells} sell${sells === 1 ? '' : 's'} this experiment.`;
  }

  if (typeof ruleId === 'string' && ruleId.startsWith('ss-')) {
    const activated = performance.timesActivated || 0;
    return `Active on ${activated} day${activated === 1 ? '' : 's'} across the experiment.`;
  }

  return `Participated in ${cited} evaluation${cited === 1 ? '' : 's'}.`;
}

// ─── Stats row ─────────────────────────────────────────────────

function StatPill({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: HOLO_COLORS.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export default function RuleReportCard({ rule, performance, grade, index = 0 }) {
  const ruleId = rule?.ruleId || rule?.id;
  const template = lookupTemplate(ruleId);
  const name = template?.headline || ruleId || 'Unknown Rule';
  const categoryId = template?.category || rule?.category;
  const catColor = categoryColor(categoryId);
  const catLabel = categoryLabel(categoryId);

  const resolvedGrade = grade || deriveGrade(ruleId, performance);
  const gradeColor = GRADE_COLORS[resolvedGrade] || HOLO_COLORS.textMuted;
  const insight = deriveInsight(ruleId, performance);

  const cited = performance?.timesCited || 0;
  const isEntry = typeof ruleId === 'string' && ruleId.startsWith('se-');
  const isExit = typeof ruleId === 'string' && ruleId.startsWith('sx-');

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: index * 0.15,
        type: 'spring',
        stiffness: 260,
        damping: 22,
      }}
      style={{
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderLeft: `4px solid ${catColor}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Header row: icon, title, grade */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Category icon circle */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `${catColor}22`,
            border: `1px solid ${catColor}66`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: catColor,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {catLabel.charAt(0).toUpperCase() || '?'}
        </div>

        {/* Title + category */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ color: MUTED, marginRight: 8, fontFamily: 'monospace', fontSize: 12 }}>
              {ruleId}
            </span>
            {name}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 600,
                background: `${catColor}1A`,
                color: catColor,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {catLabel}
            </span>
            <span style={{ fontSize: 11, color: MUTED }}>
              {cited > 0 ? `Triggered ${cited} time${cited === 1 ? '' : 's'}` : 'Never Triggered'}
            </span>
          </div>
        </div>

        {/* Grade badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: index * 0.15 + 0.2,
            type: 'spring',
            stiffness: 300,
            damping: 18,
          }}
          style={{
            minWidth: 44,
            height: 44,
            borderRadius: 10,
            background: `${gradeColor}1A`,
            border: `2px solid ${gradeColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: gradeColor,
            fontSize: 20,
            fontWeight: 800,
            flexShrink: 0,
            padding: '0 6px',
          }}
        >
          {resolvedGrade}
        </motion.div>
      </div>

      {/* Insight line */}
      <div
        style={{
          marginTop: 12,
          fontSize: 13,
          lineHeight: 1.5,
          color: HOLO_COLORS.textSecondary,
        }}
      >
        {insight}
      </div>

      {/* Stats row */}
      {cited > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <StatPill label="Cited" value={cited} />
          {isExit && (
            <StatPill label="Sells" value={performance?.sellsTriggered || 0} />
          )}
          {isEntry && (
            <>
              <StatPill label="Passed" value={performance?.timesPassedEntry || 0} />
              <StatPill label="Blocked" value={performance?.timesBlockedEntry || 0} />
            </>
          )}
          {!isEntry && !isExit && performance?.timesActivated != null && (
            <StatPill label="Activated" value={performance.timesActivated} />
          )}
        </div>
      )}
    </motion.div>
  );
}
