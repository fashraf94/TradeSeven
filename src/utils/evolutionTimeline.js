// src/utils/evolutionTimeline.js
//
// Pure, framework-free assembly of an agent's evolution timeline from the agent
// doc — shared by the Agent Record sheet (AgentRecordSheet) and the Command
// Dashboard's Evolution preview card so the two surfaces can't drift. Ported
// from the Agent Hub's evolution tab via the record sheet (Closeout Spec §3.2).
//
// Entries cover only the event types with live writers: creation, consolidation
// cycles (agent.evolutionTimeline[] with a legacy synthesized fallback),
// lessons, scored games, and Forge strategy deploys. Drift/debrief entries stay
// out — nothing writes archetypeDrift or result-less memory reflections today.
// No React, no Firestore — unit-tested in evolutionTimeline.test.js.

import { CMD } from '../components/Dashboard/commandUI';
import { getArchetypeDisplayName } from '../data/archetypeDisplay';

// Wins keep the Hub's emerald — CMD reserves its red for downside, and draw
// stays deliberately neutral so only real losses read as red.
export const EMERALD = '#34D399';

export const parseDate = (val) => {
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

// "Today" / "Yesterday" / "3d ago" / "Mar 15" — the timeline's relative date.
export const formatRelativeDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * @param {Object|null} agent - the agent doc (reads createdAt, evolutionCycle,
 *   evolutionTimeline, consolidatedInsight, lessons, memory, deployedStrategy)
 * @returns {Array<Object>} timeline events, newest first. Each carries
 *   { type, title, subtitle, date, color } plus, for consolidation entries,
 *   { isConsolidation, eventId, narrative, metadata }.
 */
export function buildEvolutionTimeline(agent) {
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
    const scoreLabel = Number.isFinite(m.score) ? ` ${m.score > 0 ? '+' : ''}${m.score}` : '';
    events.push({
      type: 'game',
      title: `${m.gameMode || 'Game'} — ${resultLabel}${scoreLabel}`,
      subtitle: m.lesson || '',
      date: parseDate(m.date),
      color: m.result === 'win' ? EMERALD : m.result === 'draw' ? CMD.ink2 : CMD.risk,
    });
  });

  // Forge strategy deploy — written live by deployExperimentToAgent
  // (Forge → DeployToAgent), single entry from deployedStrategy metadata.
  if (agent.deployedStrategy?.deployedAt) {
    events.push({
      type: 'deploy',
      title: 'Strategy Deployed',
      subtitle: `"${agent.deployedStrategy.experimentName || 'Strategy'}" deployed from Forge`,
      date: parseDate(agent.deployedStrategy.deployedAt),
      color: EMERALD,
    });
  }

  return events.sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
}
