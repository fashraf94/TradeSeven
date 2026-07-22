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
// (agent.evolutionTimeline[] with a legacy synthesized fallback), lessons,
// scored games, and Forge strategy deploys. Drift/debrief entries stay out —
// nothing writes archetypeDrift or result-less memory reflections today.
// dock='bottom' renders the mobile spring sheet; dock='center' the desktop
// modal.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AgentOrb from '../shared/AgentOrb';
import EquipSheet from './EquipSheet';
import ConflictResolutionPanel from './ConflictResolutionPanel';
import { CMD, alpha, Mono, Eyebrow } from './commandUI';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';
import { getLevelProgressPct } from '../../constants/agentProgression';
import { buildEvolutionTimeline, formatRelativeDate, EMERALD } from '../../utils/evolutionTimeline';
// Mastery P3 (spec §10): cumulative per-archetype cards. The masteryProfile
// prop is threaded from the shell (this sheet stays props-only); it is null
// while MASTERY_SURFACE_ENABLED is false (the shell's hook performs zero
// reads dark), so the section is absent and the sheet renders byte-identical
// to pre-P3 (photographed). The progression numbers come from the SAME
// module the server enforcement re-exports (§9 one-source).
import { MASTERY_SURFACE_ENABLED } from '../../../api/_utils/masteryConfig.js';
import { levelProgress, bandForLevel } from '../../data/masteryProgression.js';
import { ARCHETYPE_ORDER } from './ArchetypePicker';

const INSIGHTS_THRESHOLD = 5;

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
            <div style={{ fontSize: 11, color: CMD.ink3 }}>{formatRelativeDate(event.date)}</div>
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

// ── Timeline list — owns the expand state so closing the sheet (which
// unmounts the body via EquipSheet's AnimatePresence) resets it for free.
function RecordTimeline({ events }) {
  const [expandedId, setExpandedId] = useState(null);
  return (
    <>
      {events.map((event, i) => {
        const key = event.eventId || `${event.type}_${i}`;
        return (
          <TimelineItem
            key={key}
            event={event}
            isLast={i === events.length - 1}
            isExpanded={expandedId === key}
            onToggleExpand={() => setExpandedId(expandedId === key ? null : key)}
          />
        );
      })}
    </>
  );
}

// ── Sheet ────────────────────────────────────────────────────────────────────

export default function AgentRecordSheet({ open, onClose, agent, loading, accent, levelConfig, nextLevelInfo, masteryProfile = null, dock = 'bottom' }) {
  const games = agent?.stats?.gamesPlayed ?? 0;
  const levelLabel = levelConfig?.label || 'Rookie';
  const levelColor = levelConfig?.color || CMD.ink3;
  const disposition = getArchetypeIdentity(agent?.archetype).disposition;

  // Rank progress = position within the current level's games band (shared
  // with the desktop IdentityPanel via getLevelProgressPct).
  const rankPct = getLevelProgressPct(games);
  const rankLabel = nextLevelInfo
    ? `${nextLevelInfo.gamesNeeded} game${nextLevelInfo.gamesNeeded !== 1 ? 's' : ''} to ${nextLevelInfo.label}`
    : 'Max level';

  // Timeline — only event types with live writers (Closeout Spec §3.2):
  // creation, consolidation cycles, lessons, scored games. Newest first.
  // Assembly is shared with the Evolution preview card via buildEvolutionTimeline.
  const timelineEvents = useMemo(() => buildEvolutionTimeline(agent), [agent]);

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
      subtitle={agent ? `${getArchetypeDisplayName(agent.archetype)} · ${levelLabel}` : undefined}
    >
      {!agent ? (
        <div style={{ padding: '18px 8px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>
          {loading
            ? 'Loading your agent’s record…'
            : 'Your agent’s record will appear here once your agent is created.'}
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16,
          // Safe-area inset is EquipSheet's (the footerless scroll container pads it).
          paddingBottom: dock === 'bottom' ? 14 : 4,
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
            ) : games >= INSIGHTS_THRESHOLD ? (
              <div style={card}>
                <div style={{ fontSize: 13, color: CMD.ink, lineHeight: 1.5 }}>
                  Consolidating your agent’s first strategic insight…
                </div>
                <div style={{ fontSize: 11, color: CMD.ink3, lineHeight: 1.5, marginTop: 7 }}>
                  It lands after the next evolution cycle completes.
                </div>
              </div>
            ) : (
              <div style={card}>
                <div style={{ fontSize: 13, color: CMD.ink, lineHeight: 1.5 }}>
                  {games}/{INSIGHTS_THRESHOLD} games until first strategic insight
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

          {/* Archetype mastery — cumulative per-archetype cards (Mastery P3,
              spec §10). Renders ONLY under MASTERY_SURFACE_ENABLED; with the
              flag off (or no profile yet) the section is absent and the
              sheet is byte-identical to pre-P3. Streams with no recorded
              battles render nothing (cards are earned, not scaffolded);
              a lit flag with an empty profile shows the honest empty state. */}
          {MASTERY_SURFACE_ENABLED && (
            <div>
              <Eyebrow style={{ marginBottom: 10 }}>Archetype mastery</Eyebrow>
              {(() => {
                const streams = ARCHETYPE_ORDER
                  .map((id) => ({ id, stream: masteryProfile?.archetypes?.[id] }))
                  .filter(({ stream }) => Number.isFinite(stream?.xp) && (stream.xp > 0 || stream.battlesCounted > 0));
                if (streams.length === 0) {
                  return (
                    <div style={{ padding: '4px 2px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>
                      No training records yet — complete battles to build archetype mastery.
                    </div>
                  );
                }
                return streams.map(({ id, stream }) => {
                  const p = levelProgress(stream.xp);
                  const band = bandForLevel(p.level);
                  return (
                    <div key={id} style={{ ...card, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: CMD.ink }}>
                          {getArchetypeDisplayName(id)}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                          background: alpha(accent, 0.13), color: accent, letterSpacing: '0.3px',
                        }}>
                          L{p.level} · {band?.label}
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 4, background: CMD.hair, overflow: 'hidden', marginTop: 8 }}>
                        <div style={{ width: `${p.pct}%`, height: '100%', borderRadius: 4, background: accent, transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <Mono style={{ fontSize: 9.5, letterSpacing: '0.08em', color: CMD.ink2 }}>
                          {stream.battlesCounted || 0} battle{(stream.battlesCounted || 0) !== 1 ? 's' : ''} counted
                        </Mono>
                        <Mono style={{ fontSize: 9.5, letterSpacing: '0.08em', color: CMD.ink2 }}>
                          {p.xpForNext === null ? 'Max level' : `${p.xpForNext} XP to L${p.level + 1}`}
                        </Mono>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* rule conflict resolution (Phase 3, Surface 2). Section appears only
              when a deploy populated agent.lastConflictReport (INJECT on); with
              the flags off there is no report and nothing renders here. */}
          {agent.lastConflictReport && (
            <div>
              <Eyebrow style={{ marginBottom: 10 }}>Rule check · last deploy</Eyebrow>
              <ConflictResolutionPanel report={agent.lastConflictReport} accent={accent} />
            </div>
          )}

          {/* evolution timeline */}
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Evolution timeline</Eyebrow>
            {timelineEvents.length === 0 ? (
              <div style={{ padding: '4px 2px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>
                Play games to see your agent evolve.
              </div>
            ) : (
              <div style={card}>
                <RecordTimeline events={timelineEvents} />
              </div>
            )}
          </div>
        </div>
      )}
    </EquipSheet>
  );
}
