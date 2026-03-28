// src/components/Forge/StatsTab.jsx
// Performance dashboard showing per-bundle and per-rule citation stats
// aggregated from agentBattles evaluation data.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Shield } from 'lucide-react';

const CATEGORY_META = {
  technical:   { label: 'Technical',   color: '#5eead4' },
  fundamental: { label: 'Fundamental', color: '#a78bfa' },
  risk:        { label: 'Risk',        color: '#f97066' },
  allocation:  { label: 'Allocation',  color: '#f59e0b' },
  general:     { label: 'General',     color: '#8b949e' },
};

const OVERRIDE_LABELS = {
  no_match: 'No match',
  conflict_with_constraint: 'Constraint conflict',
  market_conditions: 'Market conditions',
  insufficient_data: 'Insufficient data',
  higher_priority_opportunity: 'Higher priority',
};

// ── Loading Skeleton ──────────────────────────

function LoadingSkeleton({ tokens }) {
  const pulse = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    animation: 'pulse 1.5s ease-in-out infinite',
  };
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ ...pulse, height: '72px' }} />
        ))}
      </div>
      {[1, 2].map(i => (
        <div key={i} style={{ ...pulse, height: '160px' }} />
      ))}
    </div>
  );
}

// ── Empty State ───────────────────────────────

function EmptyState({ tokens, onGoToBundles }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '300px', gap: '12px',
      padding: '40px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <BarChart3 size={28} color={tokens.textMuted} />
      </div>
      <span style={{ fontSize: '16px', fontWeight: '600', color: tokens.textPrimary }}>
        No performance data yet
      </span>
      <span style={{ fontSize: '13px', color: tokens.textMuted, maxWidth: '280px' }}>
        Play a battle with your bundle equipped to start tracking how your rules perform.
      </span>
      {onGoToBundles && (
        <button
          onClick={onGoToBundles}
          style={{
            marginTop: '8px', padding: '8px 16px', borderRadius: '20px',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${tokens.teal}4D`, background: `${tokens.teal}1A`,
            color: tokens.teal, transition: 'all 0.2s ease',
          }}
        >
          Go to My Bundles
        </button>
      )}
    </div>
  );
}

// ── Metric Card ───────────────────────────────

function MetricCard({ label, value, tokens, color }) {
  const accent = color || tokens.teal;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${accent}0D 0%, ${accent}05 100%)`,
      borderRadius: '12px', padding: '16px', textAlign: 'center',
      border: `1px solid ${accent}1A`,
    }}>
      <div style={{ fontSize: '22px', fontWeight: '700', color: accent }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: tokens.textMuted, marginTop: '4px' }}>
        {label}
      </div>
    </div>
  );
}

// ── Citation Bar ──────────────────────────────

function CitationBar({ followed, blocked, overridden, maxTotal, tokens }) {
  const total = followed + blocked + overridden;
  if (maxTotal === 0) return null;
  const w = (v) => `${Math.max(0, (v / maxTotal) * 100)}%`;
  return (
    <div style={{
      height: '8px', background: 'rgba(255,255,255,0.04)',
      borderRadius: '9999px', overflow: 'hidden', display: 'flex',
    }}>
      {followed > 0 && (
        <div style={{ width: w(followed), background: tokens.teal, borderRadius: '9999px 0 0 9999px' }} />
      )}
      {blocked > 0 && (
        <div style={{ width: w(blocked), background: '#22c55e' }} />
      )}
      {overridden > 0 && (
        <div style={{ width: w(overridden), background: '#f59e0b', borderRadius: total === overridden ? '9999px' : '0 9999px 9999px 0' }} />
      )}
    </div>
  );
}

// ── Rule Stat Row ─────────────────────────────

function RuleStatRow({ rule, maxCitations, battlesWithRules, tokens }) {
  const [expanded, setExpanded] = useState(false);
  const catMeta = CATEGORY_META[rule.category] || CATEGORY_META.general;
  const totalCited = rule.timesFollowed + rule.timesBlocked;
  const hasOverrides = rule.timesOverridden > 0;
  const neverCited = totalCited === 0 && battlesWithRules >= 3;
  const highOverride = rule.timesOverridden > totalCited && totalCited > 0;

  // Find top override reason
  let topOverrideReason = null;
  if (hasOverrides) {
    const entries = Object.entries(rule.overrideReasons);
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      topOverrideReason = { reason: entries[0][0], count: entries[0][1] };
    }
  }

  return (
    <motion.div
      layout
      style={{
        padding: '10px 12px', borderRadius: '10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        cursor: hasOverrides ? 'pointer' : 'default',
      }}
      onClick={() => hasOverrides && setExpanded(!expanded)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: catMeta.color,
          fontFamily: 'monospace', minWidth: '22px',
        }}>
          {rule.label || '?'}
        </span>
        <span style={{
          fontSize: '12px', color: tokens.textPrimary, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {rule.text}
        </span>
        <span style={{
          padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600,
          color: catMeta.color, background: `${catMeta.color}18`,
        }}>
          {catMeta.label}
        </span>
      </div>

      {/* Citation bar */}
      <CitationBar
        followed={rule.timesFollowed}
        blocked={rule.timesBlocked}
        overridden={rule.timesOverridden}
        maxTotal={maxCitations}
        tokens={tokens}
      />

      {/* Counts */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginTop: '6px', fontSize: '11px', color: tokens.textMuted,
      }}>
        <span>{rule.timesFollowed} followed</span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>&middot;</span>
        <span>{rule.timesBlocked} blocked</span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>&middot;</span>
        <span>{rule.timesOverridden} overridden</span>
        {hasOverrides && (
          expanded
            ? <ChevronDown size={12} style={{ marginLeft: 'auto' }} />
            : <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
        )}
      </div>

      {/* Warning indicators */}
      {neverCited && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          marginTop: '6px', fontSize: '11px', color: '#f59e0b',
        }}>
          <AlertTriangle size={12} />
          Never cited — consider adjusting or removing
        </div>
      )}
      {highOverride && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          marginTop: '6px', fontSize: '11px', color: '#f59e0b',
        }}>
          <AlertTriangle size={12} />
          Overridden more than followed — parameters may be too strict
        </div>
      )}
      {rule.timesBlocked >= 3 && !neverCited && !highOverride && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          marginTop: '6px', fontSize: '11px', color: '#22c55e',
        }}>
          <Shield size={12} />
          Actively protecting your portfolio
        </div>
      )}

      {/* Override reason breakdown (expandable) */}
      <AnimatePresence>
        {expanded && hasOverrides && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: '8px', paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, marginBottom: '2px' }}>
                Override reasons
              </div>
              {Object.entries(rule.overrideReasons)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <div key={reason} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '11px', color: tokens.textMuted,
                  }}>
                    <span>{OVERRIDE_LABELS[reason] || reason}</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{count}x</span>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Bundle Stats Card ─────────────────────────

function BundleStatsCard({ bundleId, bundleStats, globalStats, tokens, muted }) {
  const bs = bundleStats;
  if (!bs) return null;

  const ruleEntries = Object.values(bs.rules);
  const maxCitations = Math.max(1, ...ruleEntries.map(r => r.timesFollowed + r.timesBlocked + r.timesOverridden));

  const statusColors = {
    equipped: '#22c55e',
    forged: tokens.teal,
    archived: tokens.textMuted,
  };
  const statusColor = statusColors[bs.status] || tokens.textMuted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: muted ? 0.65 : 1, y: 0 }}
      style={{
        padding: '16px', borderRadius: '14px',
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: tokens.textWhite }}>
            {bs.bundleName}
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
            color: statusColor, background: `${statusColor}18`,
            textTransform: 'uppercase',
          }}>
            {bs.status}
          </span>
        </div>
      </div>

      {/* Mini metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <MetricCard label="Citations" value={bs.totalCitations} tokens={tokens} color={tokens.teal} />
        <MetricCard label="Battles" value={bs.battlesEquipped} tokens={tokens} color="#a78bfa" />
        <MetricCard label="Overrides" value={bs.totalOverrides} tokens={tokens} color="#f59e0b" />
      </div>

      {/* No data state for this bundle */}
      {bs.battlesEquipped === 0 && (
        <div style={{ fontSize: '12px', color: tokens.textMuted, textAlign: 'center', padding: '8px 0' }}>
          No battles played with this bundle yet.
        </div>
      )}

      {/* Rule breakdown */}
      {ruleEntries.length > 0 && bs.battlesEquipped > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Rule Breakdown
          </div>
          {ruleEntries
            .sort((a, b) => {
              // Sort: C rules first, then S rules, by label
              const aNum = a.label || 'Z99';
              const bNum = b.label || 'Z99';
              return aNum.localeCompare(bNum);
            })
            .map(rule => (
              <RuleStatRow
                key={rule.ruleId}
                rule={rule}
                maxCitations={maxCitations}
                battlesWithRules={globalStats?.battlesWithRules || 0}
                tokens={tokens}
              />
            ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Main StatsTab Component ───────────────────

export default function StatsTab({ forge, tokens, isMobile, agent }) {
  const [showArchived, setShowArchived] = useState(false);
  const { stats, statsLoading, archivedBundles, loadStats, bundles, setActiveTab } = forge;

  // Loading state
  if (statsLoading && !stats) {
    return <LoadingSkeleton tokens={tokens} />;
  }

  const global = stats?.global;
  const bundleStatsMap = stats?.bundles || {};

  // Empty state — no battles with rules
  if (!statsLoading && (!global || global.battlesWithRules === 0)) {
    return (
      <div style={{ padding: isMobile ? '16px' : '16px 24px' }}>
        <EmptyState
          tokens={tokens}
          onGoToBundles={() => setActiveTab('myBundles')}
        />
      </div>
    );
  }

  // Separate active (equipped/forged) vs archived bundles
  const activeBundleIds = bundles
    .filter(b => b.status === 'equipped' || b.status === 'forged')
    .map(b => b.id);
  const archivedWithStats = archivedBundles
    .filter(b => bundleStatsMap[b.id]?.battlesEquipped > 0);

  const citationRate = global.totalEvaluations > 0
    ? Math.round((global.totalCitations / global.totalEvaluations) * 100)
    : 0;

  return (
    <div style={{ padding: isMobile ? '16px' : '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Refresh button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={loadStats}
          disabled={statsLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            fontSize: '11px', fontWeight: 500, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: tokens.textMuted,
            opacity: statsLoading ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw size={12} style={{ animation: statsLoading ? 'spin 1s linear infinite' : 'none' }} />
          {statsLoading ? 'Refreshing...' : 'Refresh'}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Global summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <MetricCard label="Battles with Rules" value={global.battlesWithRules} tokens={tokens} color={tokens.teal} />
        <MetricCard label="Total Citations" value={global.totalCitations} tokens={tokens} color="#22c55e" />
        <MetricCard label="Citation Rate" value={`${citationRate}%`} tokens={tokens} color="#a78bfa" />
      </div>

      {/* Active bundle stats */}
      <div style={{ fontSize: '12px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Bundle Performance
      </div>
      {activeBundleIds.map(bId => (
        <BundleStatsCard
          key={bId}
          bundleId={bId}
          bundleStats={bundleStatsMap[bId]}
          globalStats={global}
          tokens={tokens}
        />
      ))}
      {activeBundleIds.length === 0 && (
        <div style={{
          fontSize: '12px', color: tokens.textMuted, textAlign: 'center',
          padding: '20px', borderRadius: '12px',
          background: tokens.bgCard, border: `1px solid ${tokens.borderDefault}`,
        }}>
          No equipped or forged bundles. Create one in My Bundles.
        </div>
      )}

      {/* Archived bundles */}
      {archivedWithStats.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
              padding: '10px 0', background: 'none', border: 'none',
              cursor: 'pointer', color: tokens.textMuted, fontSize: '12px',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
            }}
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived Bundles ({archivedWithStats.length})
          </button>
          <AnimatePresence>
            {showArchived && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                {archivedWithStats.map(b => (
                  <BundleStatsCard
                    key={b.id}
                    bundleId={b.id}
                    bundleStats={bundleStatsMap[b.id]}
                    globalStats={global}
                    tokens={tokens}
                    muted
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
