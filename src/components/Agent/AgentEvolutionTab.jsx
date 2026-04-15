import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, GitBranch, Shield, Target, Zap, Clock, Award } from 'lucide-react';

// ── Animation variants ──────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

// ── Reused patterns ─────────────────────────────────────────

const cardStyle = (tokens) => ({
  background: tokens.bgCard,
  borderRadius: '16px',
  border: `1px solid ${tokens.borderDefault}`,
  padding: '16px 20px',
  boxShadow: `${tokens.obsidianShadow}, 0 4px 16px rgba(0,0,0,0.3)`,
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
});

const SectionHeader = ({ icon: Icon, label, tokens }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
    <div style={{
      width: '3px', height: '16px',
      background: `linear-gradient(180deg, ${tokens.teal}, ${tokens.purple})`,
      borderRadius: '2px',
    }} />
    {Icon && <Icon size={14} color={tokens.textMuted} />}
    <span style={{
      fontSize: '13px', fontWeight: '700', color: tokens.textFaint,
      textTransform: 'uppercase', letterSpacing: '1.5px',
    }}>
      {label}
    </span>
  </div>
);

// ── Helpers ─────────────────────────────────────────────────

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

const formatArchetype = (arch) => {
  if (!arch) return 'Unknown';
  return arch.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
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

// ── Timeline Item ───────────────────────────────────────────

const TimelineItem = ({ event, isLast, tokens }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    {/* Dot + connecting line */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: event.color, marginTop: 5, flexShrink: 0,
      }} />
      {!isLast && (
        <div style={{
          width: 1, flexGrow: 1, minHeight: 20,
          background: tokens.borderDefault,
        }} />
      )}
    </div>

    {/* Content */}
    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          fontSize: 13, fontWeight: event.type === 'evolution' ? 600 : 500,
          color: event.type === 'drift' ? tokens.amber : tokens.textWhite,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {event.title}
        </div>
        <div style={{ fontSize: 11, color: tokens.textMuted, flexShrink: 0 }}>
          {formatDate(event.date)}
        </div>
      </div>
      {event.subtitle && (
        <div style={{
          fontSize: 11, color: tokens.textMuted, marginTop: 2,
          lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {event.subtitle}
        </div>
      )}
    </div>
  </div>
);

// ── Stat Box ────────────────────────────────────────────────

const StatBox = ({ value, label, color, tokens }) => (
  <div style={{
    ...cardStyle(tokens),
    textAlign: 'center',
    padding: 16,
  }}>
    <div style={{ fontSize: 24, fontWeight: 700, color: color || tokens.textWhite }}>
      {value}
    </div>
    <div style={{
      fontSize: 10, color: tokens.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4,
    }}>
      {label}
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────

const AgentEvolutionTab = ({ agent, tokens, isDesktop, isMobile }) => {
  const timelineEvents = useMemo(() => {
    if (!agent) return [];
    const events = [];

    // 1. Agent creation
    if (agent.createdAt) {
      events.push({
        type: 'creation',
        title: 'Agent created',
        subtitle: `${formatArchetype(agent.archetype)} archetype`,
        date: parseDate(agent.createdAt),
        color: tokens.teal,
        icon: 'zap',
      });
    }

    // 2. Evolution cycles
    if (agent.evolutionCycle > 0) {
      for (let i = 1; i <= agent.evolutionCycle; i++) {
        events.push({
          type: 'evolution',
          title: `Evolution cycle ${i} complete`,
          subtitle: i === agent.evolutionCycle && agent.consolidatedInsight
            ? agent.consolidatedInsight.slice(0, 80) + '...'
            : 'Consolidated 5 games into strategic insight',
          date: estimateCycleDate(agent.createdAt, i, agent.evolutionCycle),
          color: tokens.teal,
          icon: 'target',
        });
      }
    }

    // 3. Lessons — learnings harvested by Film Room review / pit stops / debriefs.
    //    Sourced from agent.lessons[] (new-home field post-directive-migration).
    (agent.lessons || []).forEach(l => {
      if (!l?.createdAt) return;
      events.push({
        type: 'lesson',
        title: 'Lesson Learned',
        subtitle: l.text,
        date: parseDate(l.createdAt),
        color: '#F0C75E',
        icon: 'lightbulb',
      });
    });

    // 4. Archetype drift
    if (agent.archetypeDrift) {
      events.push({
        type: 'drift',
        title: 'Archetype drift detected',
        subtitle: agent.archetypeDrift,
        date: new Date(),
        color: tokens.amber,
        icon: 'gitbranch',
      });
    }

    // 5. Recent games from memory — only entries with an actual result (win/loss).
    (agent.memory || []).forEach(m => {
      if (!m.result) return;
      events.push({
        type: 'game',
        title: `${m.gameMode || 'Game'} — ${m.result === 'win' ? 'Win' : 'Loss'} ${m.score > 0 ? '+' : ''}${m.score}`,
        subtitle: m.lesson || '',
        date: parseDate(m.date),
        color: m.result === 'win' ? tokens.emerald : tokens.red,
        icon: m.result === 'win' ? 'award' : 'clock',
      });
    });

    // 5b. Debriefs — memory reflections added without a game result (e.g. addMemoryReflection).
    // Forward-compatible: empty today if all memory entries are games, populated as reflections land.
    (agent.memory || []).forEach(m => {
      if (m.result) return;
      events.push({
        type: 'debrief',
        title: 'Game Tape debrief',
        subtitle: m.lesson || m.reflection || m.text || '',
        date: parseDate(m.date || m.createdAt),
        color: '#E8927C',
        icon: 'film',
      });
    });

    // 6. Strategy deploy event (single entry from deployedStrategy metadata).
    if (agent.deployedStrategy?.deployedAt) {
      events.push({
        type: 'deploy',
        title: 'Strategy Deployed',
        subtitle: `"${agent.deployedStrategy.experimentName || 'Strategy'}" deployed from Forge`,
        date: parseDate(agent.deployedStrategy.deployedAt),
        color: '#34D399',
        icon: 'rocket',
      });
    }

    // Sort newest first
    return events.sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
  }, [agent, tokens]);

  const stats = agent?.stats || {};
  const gamesPlayed = stats.gamesPlayed || 0;
  const winRate = gamesPlayed > 0 ? Math.round(((stats.wins || 0) / gamesPlayed) * 100) : 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Prominent Consolidated Insight — full text, above the timeline */}
      {agent?.consolidatedInsight && (
        <motion.div variants={sectionVariants}>
          <SectionHeader icon={Target} label="Strategic Insight" tokens={tokens} />
          <div style={{
            ...cardStyle(tokens),
            borderLeft: `3px solid ${tokens.teal}`,
          }}>
            <p style={{
              fontSize: 14,
              color: tokens.textPrimary,
              lineHeight: 1.65,
              margin: 0,
              fontStyle: 'italic',
            }}>
              {agent.consolidatedInsight}
            </p>
          </div>
        </motion.div>
      )}

      <div style={{
        display: isDesktop ? 'grid' : 'flex',
        gridTemplateColumns: isDesktop ? '3fr 2fr' : undefined,
        flexDirection: isDesktop ? undefined : 'column',
        gap: 20,
      }}>
        {/* Left: Evolution Timeline */}
        <motion.div variants={sectionVariants}>
          <SectionHeader icon={TrendingUp} label="Evolution Timeline" tokens={tokens} />

          {timelineEvents.length === 0 ? (
            <div style={{ ...cardStyle(tokens), textAlign: 'center', padding: '40px 20px' }}>
              <TrendingUp size={32} style={{ color: tokens.textMuted, opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 14, color: tokens.textSecondary }}>
                Play games to see your agent evolve
              </div>
            </div>
          ) : (
            <div style={{ ...cardStyle(tokens) }}>
              {timelineEvents.map((event, i) => (
                <TimelineItem
                  key={`${event.type}_${i}`}
                  event={event}
                  isLast={i === timelineEvents.length - 1}
                  tokens={tokens}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: Performance */}
        <motion.div variants={sectionVariants}>
          <SectionHeader icon={Award} label="Performance" tokens={tokens} />

          {/* 2x2 stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatBox value={gamesPlayed} label="Games" tokens={tokens} />
            <StatBox
              value={`${winRate}%`}
              label="Win Rate"
              color={winRate >= 50 ? tokens.emerald : tokens.red}
              tokens={tokens}
            />
            <StatBox value={stats.bestStreak || 0} label="Best Streak" tokens={tokens} />
            <StatBox value={agent?.evolutionCycle || 0} label="Evo Cycles" tokens={tokens} />
          </div>

          {/* Score Trend */}
          <div style={{ ...cardStyle(tokens), marginTop: 12 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: tokens.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
            }}>
              Recent scores
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
              {(agent?.memory || []).length > 0 ? (
                agent.memory.map((m, i) => {
                  const maxScore = Math.max(...agent.memory.map(x => Math.abs(x.score || 0)), 1);
                  const height = Math.max((Math.abs(m.score || 0) / maxScore) * 60, 4);
                  const isWin = m.result === 'win';
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: isWin ? tokens.emerald : tokens.red }}>
                        {m.score > 0 ? '+' : ''}{m.score}
                      </div>
                      <div style={{
                        width: '100%', maxWidth: 40, height,
                        borderRadius: '4px 4px 0 0',
                        background: isWin
                          ? `linear-gradient(180deg, ${tokens.emerald}, rgba(16,185,129,0.3))`
                          : `linear-gradient(180deg, ${tokens.red}, rgba(239,68,68,0.3))`,
                      }} />
                    </div>
                  );
                })
              ) : (
                <div style={{ width: '100%', textAlign: 'center', color: tokens.textMuted, fontSize: 12, padding: '20px 0' }}>
                  No game data yet
                </div>
              )}
            </div>
          </div>

        </motion.div>
      </div>
    </motion.div>
  );
};

export default AgentEvolutionTab;
