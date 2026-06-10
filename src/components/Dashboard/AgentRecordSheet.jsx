// src/components/Dashboard/AgentRecordSheet.jsx
//
// The agent's record — identity, rank progress, the full consolidated insight,
// and a compact evolution timeline — as an EquipSheet over the Command
// Dashboard. This is the Agent Hub's surviving read surface (Closeout Spec
// V1.1) and the seed of the post-launch trait-minting sheet: observe-only for
// now, no controls beyond close.
//
// Data flows entirely from the shell's existing useAgent subscription via
// props — no queries or subscriptions in here. Timeline entries cover only the
// event types with live writers: creation, consolidation cycles
// (agent.evolutionTimeline[] with a legacy synthesized fallback), lessons, and
// scored games. dock='bottom' renders the mobile spring sheet; dock='center'
// the desktop modal.

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AgentOrb from '../shared/AgentOrb';
import EquipSheet from './EquipSheet';
import { CMD, alpha, Mono, Eyebrow } from './commandUI';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';

// Wins keep the Hub's emerald — CMD reserves its red for downside, and draw
// stays deliberately neutral so only real losses read as red.
const EMERALD = '#34D399';
const INSIGHTS_THRESHOLD = 5;

// ── Helpers (ported from the Agent Hub's evolution tab) ─────────────────────

const parseDate = (val) => {
  if (!val) return new Date(0);
  if (val?._seconds) return new Date(val._seconds * 1000);
  if (val?.toDate) return val.toDate();
  return new Date(val);
};

const estimateCycleDate = (createdAt, cycleNum, totalCycles) => {
  const start = parseDate(createdAt).getTime();
  const now = Date.now();
  const span = now - start;
  const fraction = cycleNum / (totalCycles + 1);
  return new Date(start + span * fraction);
};

const formatDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const MetaBadge = ({ children, color }) => (
  <span style={{
    fontSize: 10, fontWeight: 600,
    padding: '3px 8px', borderRadius: 999,
    background: `${color}22`, color, border: `1px solid ${color}55`,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </span>
);

// ── Timeline item ────────────────────────────────────────────────────────────

const TimelineItem = ({ event, isLast, isExpanded, onToggleExpand }) => {
  const isExpandable = Boolean(event.narrative);
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/* dot + connecting line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: event.color, marginTop: 5, flexShrink: 0,
          boxShadow: event.isConsolidation ? `0 0 0 3px ${event.color}33` : 'none',
        }} />
        {!isLast && (
          <div style={{ width: 1, flexGrow: 1, minHeight: 20, background: CMD.hair2 }} />
        )}
      </div>

      {/* content */}
      <div
        style={{
          flex: 1, paddingBottom: isLast ? 0 : 12, minWidth: 0,
          cursor: isExpandable ? 'pointer' : 'default',
        }}
        onClick={isExpandable ? onToggleExpand : undefined}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{
            fontSize: 13,
            fontWeight: event.type === 'evolution' ? 600 : 500,
            color: event.isConsolidation ? CMD.allocation : CMD.ink,
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: isExpanded ? 'normal' : 'nowrap', flex: 1,
          }}>
            {event.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: CMD.ink3 }}>{formatDate(event.date)}</div>
            {isExpandable && (
              isExpanded
                ? <ChevronUp size={12} color={CMD.ink3} />
                : <ChevronDown size={12} color={CMD.ink3} />
            )}
          </div>
        </div>
        {event.subtitle && (
          <div style={{
            fontSize: 11, color: CMD.ink2, marginTop: 2,
            lineHeight: 1.4,
            ...(isExpanded ? {} : {
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }),
          }}>
            {event.subtitle}
          </div>
        )}

        {/* expanded consolidation detail */}
        <AnimatePresence initial={false}>
          {isExpanded && event.isConsolidation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: 10 }}>
                {event.narrative && (
                  <div style={{
                    fontSize: 12, color: CMD.ink, lineHeight: 1.55,
                    marginBottom: 10, fontStyle: 'italic',
                  }}>
                    {event.narrative}
                  </div>
                )}
                {event.metadata && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {event.metadata.confidenceLevel && (
                      <MetaBadge color={CMD.allocation}>{event.metadata.confidenceLevel}</MetaBadge>
                    )}
                    {Number.isFinite(event.metadata.lessonsAbsorbedCount) && (
                      <MetaBadge color={EMERALD}>{event.metadata.lessonsAbsorbedCount} absorbed</MetaBadge>
                    )}
                    {Number.isFinite(event.metadata.lessonsCarriedForwardCount) &&
                      event.metadata.lessonsCarriedForwardCount > 0 && (
                        <MetaBadge color={CMD.gold}>{event.metadata.lessonsCarriedForwardCount} carried</MetaBadge>
                      )}
                    {event.metadata.disciplinesCount && (
                      <MetaBadge color={CMD.teal}>
                        {event.metadata.disciplinesCount.selection || 0} sel /{' '}
                        {event.metadata.disciplinesCount.execution || 0} exec
                      </MetaBadge>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Sheet ────────────────────────────────────────────────────────────────────

export default function AgentRecordSheet({ open, onClose, agent, accent, levelConfig, nextLevelInfo, dock = 'bottom' }) {
  const [expandedId, setExpandedId] = useState(null);
  useEffect(() => { if (open) setExpandedId(null); }, [open]);

  const games = agent?.stats?.gamesPlayed ?? 0;
  const levelLabel = levelConfig?.label || 'Rookie';
  const levelColor = levelConfig?.color || CMD.ink3;
  const disposition = getArchetypeIdentity(agent?.archetype).disposition;

  // Rank progress = position within the current level's games band (same math
  // as the desktop IdentityPanel — Partner's maxGames is Infinity, so the
  // no-next-level branch must stay the 100% / "Max level" fallback).
  let rankPct = 100;
  let rankLabel = 'Max level';
  if (nextLevelInfo && levelConfig) {
    const band = (levelConfig.maxGames + 1) - levelConfig.minGames;
    rankPct = band > 0 ? Math.max(0, Math.min(100, ((games - levelConfig.minGames) / band) * 100)) : 0;
    rankLabel = `${nextLevelInfo.gamesNeeded} game${nextLevelInfo.gamesNeeded !== 1 ? 's' : ''} to ${nextLevelInfo.label}`;
  }

  // Timeline — only event types with live writers (Closeout Spec §3.2):
  // creation, consolidation cycles, lessons, scored games. Newest first.
  const timelineEvents = useMemo(() => {
    if (!agent) return [];
    const events = [];

    if (agent.createdAt) {
      events.push({
        type: 'creation',
        title: 'Agent created',
        subtitle: `${getArchetypeDisplayName(agent.archetype)} archetype`,
        date: parseDate(agent.createdAt),
        color: CMD.teal,
      });
    }

    // Prefer real entries from agent.evolutionTimeline[] (rich EvolutionEvents
    // from the consolidation writer); synthesize a muted entry only for cycles
    // that predate the writer.
    if (agent.evolutionCycle > 0) {
      const realByCycle = new Map();
      (agent.evolutionTimeline || []).forEach(ev => {
        if (ev?.type === 'consolidation' && Number.isInteger(ev?.cycle)) {
          realByCycle.set(ev.cycle, ev);
        }
      });

      for (let i = 1; i <= agent.evolutionCycle; i++) {
        const realEvent = realByCycle.get(i);
        if (realEvent) {
          events.push({
            type: 'evolution',
            isConsolidation: true,
            eventId: realEvent.id || `evo_cycle_${i}`,
            title: realEvent.headline || `Evolution cycle ${i} complete`,
            subtitle: realEvent.metadata?.keyShift || '',
            narrative: realEvent.narrative || null,
            metadata: realEvent.metadata || null,
            date: parseDate(realEvent.timestamp),
            color: CMD.allocation,
          });
        } else {
          events.push({
            type: 'evolution',
            isConsolidation: false,
            eventId: `evo_cycle_${i}_legacy`,
            title: `Evolution cycle ${i} complete`,
            subtitle: i === agent.evolutionCycle && agent.consolidatedInsight
              ? agent.consolidatedInsight.slice(0, 80) + '...'
              : 'Consolidated 5 games into strategic insight',
            date: estimateCycleDate(agent.createdAt, i, agent.evolutionCycle),
            color: CMD.teal,
          });
        }
      }
    }

    (agent.lessons || []).forEach(l => {
      if (!l?.createdAt) return;
      events.push({
        type: 'lesson',
        title: 'Lesson Learned',
        subtitle: l.text,
        date: parseDate(l.createdAt),
        color: CMD.gold,
      });
    });

    (agent.memory || []).forEach(m => {
      if (!m.result) return;
      const resultLabel = m.result === 'win' ? 'Win' : m.result === 'draw' ? 'Draw' : 'Loss';
      events.push({
        type: 'game',
        title: `${m.gameMode || 'Game'} — ${resultLabel} ${m.score > 0 ? '+' : ''}${m.score}`,
        subtitle: m.lesson || '',
        date: parseDate(m.date),
        color: m.result === 'win' ? EMERALD : m.result === 'draw' ? CMD.ink2 : CMD.risk,
      });
    });

    return events.sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
  }, [agent]);

  const card = {
    background: CMD.surface, border: `1px solid ${CMD.hair}`,
    borderRadius: 16, padding: '14px 16px',
  };

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      accent={accent}
      title={agent?.name || 'Your agent'}
      subtitle={`${getArchetypeDisplayName(agent?.archetype)} · ${levelLabel}`}
    >
      {!agent ? (
        <div style={{ padding: '18px 8px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>
          Your agent’s record will appear here once your agent is created.
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16,
          paddingBottom: dock === 'bottom' ? 'calc(env(safe-area-inset-bottom, 0px) + 14px)' : 4,
        }}>
          {/* rank card */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <AgentOrb state="ready" size={56} color={accent} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    background: alpha(levelColor, 0.13), color: levelColor, letterSpacing: '0.3px',
                  }}>
                    {levelLabel}
                  </span>
                  <Mono style={{ fontSize: 9.5, letterSpacing: '0.08em', color: CMD.ink2 }}>{rankLabel}</Mono>
                </div>
                <div style={{ height: 4.5, borderRadius: 4.5, background: CMD.hair, overflow: 'hidden', marginTop: 9 }}>
                  <div style={{ width: `${rankPct}%`, height: '100%', borderRadius: 4.5, background: levelColor, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
            {disposition && (
              <div style={{ fontSize: 12.5, color: CMD.ink2, lineHeight: 1.5, marginTop: 12 }}>{disposition}</div>
            )}
          </div>

          {/* strategic insight */}
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Strategic insight</Eyebrow>
            {agent.consolidatedInsight ? (
              <div style={{ ...card, borderLeft: `3px solid ${accent}` }}>
                <p style={{ fontSize: 14, color: CMD.ink, lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
                  {agent.consolidatedInsight}
                </p>
              </div>
            ) : (
              <div style={card}>
                <div style={{ fontSize: 13, color: CMD.ink, lineHeight: 1.5 }}>
                  {Math.min(games, INSIGHTS_THRESHOLD)}/{INSIGHTS_THRESHOLD} games until first strategic insight
                </div>
                <div style={{ height: 4, borderRadius: 4, background: CMD.hair, overflow: 'hidden', marginTop: 9 }}>
                  <div style={{
                    width: `${Math.min((games / INSIGHTS_THRESHOLD) * 100, 100)}%`,
                    height: '100%', borderRadius: 4,
                    background: alpha(accent, 0.9), transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: CMD.ink3, lineHeight: 1.5, marginTop: 9 }}>
                  Play more games to help your agent consolidate lessons into a strategic insight.
                </div>
              </div>
            )}
          </div>

          {/* evolution timeline */}
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Evolution timeline</Eyebrow>
            {timelineEvents.length === 0 ? (
              <div style={{ padding: '4px 2px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>
                Play games to see your agent evolve.
              </div>
            ) : (
              <div style={card}>
                {timelineEvents.map((event, i) => {
                  const key = event.eventId || `${event.type}_${i}`;
                  return (
                    <TimelineItem
                      key={key}
                      event={event}
                      isLast={i === timelineEvents.length - 1}
                      isExpanded={expandedId === key}
                      onToggleExpand={() => setExpandedId(expandedId === key ? null : key)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </EquipSheet>
  );
}
