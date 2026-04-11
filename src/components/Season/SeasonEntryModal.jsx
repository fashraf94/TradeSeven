// src/components/Season/SeasonEntryModal.jsx
//
// 3-step flow for joining a season:
//   0. Overview          — season info, dates, universe, macro events
//   1. Algorithm          — pick a season-compatible bundle
//   2. Confirm & Deploy   — summary + POST /api/season/create-entry
//
// Mirrors the multi-step pattern from
// src/components/Agent/AgentCreationFlow.jsx (slideVariants, direction,
// AnimatePresence mode="wait"). Uses CenteredModal as the shell.
//
// The client bundle filter must match the server's filter in
// api/season/create-entry.js — both drop snapshots whose live rule doc
// has no sourceRef matching /^s[exrs]-\d+$/. Otherwise users select a
// bundle only to hit a 400 from the API.
//
// Props:
//   isOpen, onClose, season, user, agent, onBuildInForge, onSuccess

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import CenteredModal from '../shared/CenteredModal';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { SEASON_CONFLICT_PAIRS } from '../../data/forgeKnowledgeBase';
import { HOLO_COLORS } from '../../constants/holoTheme';

const TROPHY_GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const AMBER_WARN = '#F59E0B';

const SEASON_RULE_ID_RE = /^s[exrs]-\d+$/;

// ── Animation ──────────────────────────────────────────────

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -200 : 200, opacity: 0 }),
};
const slideTransition = { type: 'spring', stiffness: 300, damping: 28 };

// ── Helpers ────────────────────────────────────────────────

function phaseOfRuleId(ruleId) {
  if (!ruleId) return null;
  if (ruleId.startsWith('se-')) return 'entry';
  if (ruleId.startsWith('sx-')) return 'exit';
  if (ruleId.startsWith('sr-')) return 'rebalance';
  if (ruleId.startsWith('ss-')) return 'strategy';
  return null;
}

function countPhases(seasonRuleIds) {
  const counts = { entry: 0, exit: 0, rebalance: 0, strategy: 0 };
  for (const rid of seasonRuleIds) {
    const p = phaseOfRuleId(rid);
    if (p) counts[p]++;
  }
  return counts;
}

function findConflicts(seasonRuleIds) {
  if (!Array.isArray(seasonRuleIds) || seasonRuleIds.length < 2) return [];
  const set = new Set(seasonRuleIds);
  const matches = [];
  for (const pair of SEASON_CONFLICT_PAIRS) {
    if (set.has(pair.ruleA) && set.has(pair.ruleB)) matches.push(pair);
  }
  return matches;
}

function formatDateRange(startDate, endDate) {
  try {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(s)} — ${fmt(e)}`;
  } catch {
    return '—';
  }
}

/**
 * Loads the user's bundles and, for each forged/equipped bundle,
 * resolves each rule snapshot's sourceRef by reading the live rule
 * doc. Returns only bundles that contain ≥1 season-compatible rule.
 *
 * Matches api/season/create-entry.js:buildBundleRules exactly so
 * client-side filtering agrees with what the server will accept.
 */
async function loadSeasonCompatibleBundles(agentId) {
  if (!agentId) return [];
  const bundlesSnap = await getDocs(collection(db, 'agents', agentId, 'bundles'));
  const candidates = bundlesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.status === 'forged' || b.status === 'equipped');

  const results = [];
  for (const bundle of candidates) {
    const snapshots = Array.isArray(bundle.ruleSnapshots) ? bundle.ruleSnapshots : [];
    if (snapshots.length === 0) continue;

    // Read live rule docs in parallel so we can recover sourceRef.
    const ruleDocs = await Promise.all(
      snapshots.map((s) => getDoc(doc(db, 'agents', agentId, 'rules', s.id)))
    );

    const seasonRuleIds = [];
    for (let i = 0; i < snapshots.length; i++) {
      const ruleSnap = ruleDocs[i];
      if (!ruleSnap.exists()) continue;
      const rule = ruleSnap.data();
      if (rule.isDeleted) continue;
      const templateId = rule.sourceRef;
      if (!templateId || !SEASON_RULE_ID_RE.test(templateId)) continue;
      seasonRuleIds.push(templateId);
    }

    if (seasonRuleIds.length === 0) continue;

    results.push({
      id: bundle.id,
      name: bundle.name || 'Unnamed Bundle',
      status: bundle.status,
      seasonRuleIds,
      seasonRuleCount: seasonRuleIds.length,
      phaseCounts: countPhases(seasonRuleIds),
    });
  }
  return results;
}

// ── Small sub-components ───────────────────────────────────

function StepDots({ current, total }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        padding: '4px 0 12px',
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background: i === current ? TROPHY_GOLD : HOLO_COLORS.borderSubtle,
            transition: 'all 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

function InfoRow({ icon, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
        color: HOLO_COLORS.textSecondary,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: HOLO_COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// ── Step views ─────────────────────────────────────────────

function StepOverview({ season }) {
  const universe = Array.isArray(season.universe) ? season.universe : [];
  const universePreview = universe.slice(0, 5).join(', ');
  const universeMore = universe.length > 5 ? ` and ${universe.length - 5} more` : '';
  const macro = Array.isArray(season.macroEvents) ? season.macroEvents : [];
  const tradingDays = season.tradingDays || season.tradingDayCount;

  return (
    <div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          margin: '0 0 4px',
          textAlign: 'center',
        }}
      >
        {season.name || 'Season'}
      </h2>
      <div
        style={{
          height: 3,
          width: 48,
          background: TROPHY_GOLD,
          margin: '0 auto 16px',
          borderRadius: 2,
        }}
      />

      <InfoRow icon="📅">
        {formatDateRange(season.startDate, season.endDate)}
        {tradingDays ? ` (${tradingDays} trading days)` : ''}
      </InfoRow>
      <InfoRow icon="📊">
        Universe: {universe.length || '—'} stocks
        {universePreview ? ` — ${universePreview}${universeMore}` : ''}
      </InfoRow>
      <InfoRow icon="🏦">Starting Capital: $100,000</InfoRow>
      <InfoRow icon="📈">Benchmark: S&amp;P 500</InfoRow>

      <SectionLabel>Weekly Rhythm</SectionLabel>
      <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary, lineHeight: 1.6 }}>
        <div>Mon–Fri: Algorithm runs autonomously</div>
        <div>Sat–Sun: Pit Stop (review &amp; tune)</div>
      </div>

      {macro.length > 0 && (
        <>
          <SectionLabel>Macro Events This Season</SectionLabel>
          <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary, lineHeight: 1.6 }}>
            {macro.map((ev, i) => (
              <div key={i}>
                • {ev.name || ev.title || 'Event'}
                {ev.date ? ` — ${ev.date}` : ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BundleCard({ bundle, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(bundle.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        marginBottom: 8,
        background: selected ? 'rgba(240, 199, 94, 0.08)' : HOLO_COLORS.bgElevated,
        border: `1px solid ${selected ? TROPHY_GOLD : HOLO_COLORS.borderSubtle}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `2px solid ${selected ? TROPHY_GOLD : HOLO_COLORS.textMuted}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {selected && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: TROPHY_GOLD,
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: HOLO_COLORS.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {bundle.name}
        </div>
        <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, marginTop: 2 }}>
          {bundle.seasonRuleCount} season rule{bundle.seasonRuleCount === 1 ? '' : 's'} • {bundle.status}
        </div>
      </div>
    </button>
  );
}

function StepAlgorithm({
  loadingBundles,
  bundles,
  selectedBundleId,
  onSelectBundle,
  onBuildInForge,
}) {
  const selected = bundles.find((b) => b.id === selectedBundleId);
  const conflicts = useMemo(
    () => (selected ? findConflicts(selected.seasonRuleIds) : []),
    [selected]
  );

  if (loadingBundles) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 40,
          color: HOLO_COLORS.textMuted,
          fontSize: 13,
        }}
      >
        Loading your bundles...
      </div>
    );
  }

  if (bundles.length === 0) {
    return (
      <div>
        <div
          style={{
            textAlign: 'center',
            padding: '24px 12px',
            background: HOLO_COLORS.bgElevated,
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔨</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: HOLO_COLORS.textPrimary,
              marginBottom: 6,
            }}
          >
            No season-compatible bundles
          </div>
          <div
            style={{
              fontSize: 12,
              color: HOLO_COLORS.textMuted,
              lineHeight: 1.5,
            }}
          >
            Forge a bundle in Season mode to join this season. Any bundle
            with a season rule (Entry, Exit, Rebalance, or Strategy) will
            qualify.
          </div>
        </div>
        <button
          onClick={onBuildInForge}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: TROPHY_GOLD,
            color: '#0d1117',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Build One in the Forge →
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          color: HOLO_COLORS.textSecondary,
          marginBottom: 12,
        }}
      >
        Select a Season-compatible bundle:
      </div>
      <div>
        {bundles.map((b) => (
          <BundleCard
            key={b.id}
            bundle={b}
            selected={b.id === selectedBundleId}
            onSelect={onSelectBundle}
          />
        ))}
      </div>

      {selected && (
        <>
          <SectionLabel>Algorithm Preview</SectionLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              padding: '10px 12px',
              background: HOLO_COLORS.bgElevated,
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: 8,
            }}
          >
            {[
              ['Entry', selected.phaseCounts.entry],
              ['Exit', selected.phaseCounts.exit],
              ['Rebalance', selected.phaseCounts.rebalance],
              ['Strategy', selected.phaseCounts.strategy],
            ].map(([label, count]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: count > 0 ? TROPHY_GOLD : HOLO_COLORS.textMuted,
                  }}
                >
                  {count}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: HOLO_COLORS.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          {conflicts.length > 0 && (
            <>
              <SectionLabel>Conflict Warnings</SectionLabel>
              {conflicts.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: `1px solid ${AMBER_WARN}`,
                    borderRadius: 8,
                    marginBottom: 6,
                    fontSize: 12,
                    color: HOLO_COLORS.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 600, color: AMBER_WARN, marginBottom: 2 }}>
                    ⚠️ {c.ruleA.toUpperCase()} &amp; {c.ruleB.toUpperCase()}
                  </div>
                  <div>{c.warning}</div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function StepConfirm({ season, bundle, submitting, error }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: HOLO_COLORS.textPrimary,
          margin: '0 0 12px',
          textAlign: 'center',
        }}
      >
        Confirm Your Entry
      </h3>

      <div
        style={{
          background: HOLO_COLORS.bgElevated,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 12,
        }}
      >
        <SummaryLine label="Season" value={season.name || '—'} />
        <SummaryLine label="Algorithm" value={bundle?.name || '—'} />
        <SummaryLine
          label="Rules"
          value={
            bundle
              ? `${bundle.seasonRuleCount} (${bundle.phaseCounts.entry} entry, ${bundle.phaseCounts.exit} exit, ${bundle.phaseCounts.rebalance} rebalance, ${bundle.phaseCounts.strategy} strategy)`
              : '—'
          }
        />
        <SummaryLine label="Starting Capital" value="$100,000" />
      </div>

      <p
        style={{
          fontSize: 12,
          color: HOLO_COLORS.textMuted,
          lineHeight: 1.5,
          margin: '12px 0',
        }}
      >
        Portfolio construction happens automatically at market close on Day
        1. Your entry rules will scan the universe and build your portfolio.
      </p>

      {error && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid #EF4444',
            borderRadius: 8,
            fontSize: 12,
            color: '#EF4444',
            marginTop: 8,
          }}
        >
          {error}
        </div>
      )}

      {submitting && (
        <div
          style={{
            textAlign: 'center',
            padding: 12,
            color: HOLO_COLORS.textMuted,
            fontSize: 12,
          }}
        >
          Deploying algorithm...
        </div>
      )}
    </div>
  );
}

function SummaryLine({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        fontSize: 13,
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}
    >
      <span style={{ color: HOLO_COLORS.textMuted }}>{label}</span>
      <span
        style={{
          color: HOLO_COLORS.textPrimary,
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────

export default function SeasonEntryModal({
  isOpen,
  onClose,
  season,
  user,
  agent,
  onBuildInForge,
  onSuccess,
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [bundles, setBundles] = useState([]);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when the modal is opened/closed so a second open is clean
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setDirection(1);
    setBundles([]);
    setLoadingBundles(false);
    setSelectedBundleId(null);
    setSubmitting(false);
    setError(null);
  }, [isOpen]);

  // Load bundles the first time the user advances to Step 1
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 1) return;
    if (bundles.length > 0 || loadingBundles) return;
    if (!agent?.id) return;

    let cancelled = false;
    async function load() {
      setLoadingBundles(true);
      try {
        const compatible = await loadSeasonCompatibleBundles(agent.id);
        if (cancelled) return;
        setBundles(compatible);
        // Auto-select the first bundle if only one is available
        if (compatible.length === 1) setSelectedBundleId(compatible[0].id);
      } catch (err) {
        if (cancelled) return;
        console.error('[SeasonEntryModal] Failed to load bundles:', err);
        setError(err.message || 'Failed to load bundles');
      } finally {
        if (!cancelled) setLoadingBundles(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, step, agent?.id, bundles.length]);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => s + 1);
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => s - 1);
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!season?.id || !agent?.id || !selectedBundleId) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/season/create-entry', {
        method: 'POST',
        body: JSON.stringify({
          seasonId: season.id,
          agentId: agent.id,
          bundleId: selectedBundleId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      if (onSuccess) onSuccess(data.entryId);
    } catch (err) {
      console.error('[SeasonEntryModal] Deploy failed:', err);
      setError(err.message || 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  }, [season?.id, agent?.id, selectedBundleId, onSuccess]);

  const selectedBundle = bundles.find((b) => b.id === selectedBundleId);

  const nextDisabled =
    (step === 1 && !selectedBundleId) ||
    (step === 2 && submitting);

  const titleByStep = ['Join Season', 'Choose Algorithm', 'Confirm Entry'];

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose} title={titleByStep[step]}>
      <div
        style={{
          padding: '4px 20px 20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <StepDots current={step} total={3} />

        <div style={{ flex: 1, position: 'relative', minHeight: 240 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`step-${step}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              {step === 0 && <StepOverview season={season} />}
              {step === 1 && (
                <StepAlgorithm
                  loadingBundles={loadingBundles}
                  bundles={bundles}
                  selectedBundleId={selectedBundleId}
                  onSelectBundle={setSelectedBundleId}
                  onBuildInForge={onBuildInForge}
                />
              )}
              {step === 2 && (
                <StepConfirm
                  season={season}
                  bundle={selectedBundle}
                  submitting={submitting}
                  error={error}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav buttons */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
            paddingTop: 12,
            borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
          }}
        >
          {step > 0 && (
            <button
              onClick={goBack}
              disabled={submitting}
              style={{
                flex: '0 0 auto',
                padding: '12px 18px',
                background: 'transparent',
                color: HOLO_COLORS.textSecondary,
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              ← Back
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={goNext}
              disabled={nextDisabled}
              style={{
                flex: 1,
                padding: '12px 18px',
                background: nextDisabled ? HOLO_COLORS.borderSubtle : TROPHY_GOLD,
                color: nextDisabled ? HOLO_COLORS.textMuted : '#0d1117',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: nextDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {step === 0 ? 'Next: Choose Algorithm →' : 'Next: Confirm →'}
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={nextDisabled}
              style={{
                flex: 1,
                padding: '12px 18px',
                background: nextDisabled ? HOLO_COLORS.borderSubtle : POSITIVE,
                color: nextDisabled ? HOLO_COLORS.textMuted : '#0d1117',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: nextDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Deploying...' : '🔥 Deploy Algorithm'}
            </button>
          )}
        </div>
      </div>
    </CenteredModal>
  );
}
