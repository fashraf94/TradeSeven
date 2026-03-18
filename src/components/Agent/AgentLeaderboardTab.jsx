import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown } from 'lucide-react';
import { getLeaderboard } from '../../services/agentService';

// ── Animation variants ──────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

// ── Constants ───────────────────────────────────────────────

const FILTERS = [
  { key: 'all_time', label: 'All time' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'baggerbomb', label: 'BaggerBomb' },
  { key: 'snake_draft', label: 'Snake Draft' },
];

const ARCHETYPE_STYLES = {
  momentum_chaser: { label: 'Momentum', bg: 'rgba(94, 234, 212, 0.12)', color: '#5eead4' },
  diversifier: { label: 'Diversifier', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981' },
  degen: { label: 'Degen', bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' },
  contrarian: { label: 'Contrarian', bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' },
  analyst: { label: 'Analyst', bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' },
  copycat: { label: 'Copycat', bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' },
};

const RANK_COLORS = [
  { bg: 'rgba(255,215,0,0.2)', color: '#ffd700' },
  { bg: 'rgba(192,192,192,0.15)', color: '#c0c0c0' },
  { bg: 'rgba(205,127,50,0.15)', color: '#cd7f32' },
];

// ── Helpers ─────────────────────────────────────────────────

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

const winPct = (agent) => {
  const gp = agent?.stats?.gamesPlayed || 0;
  if (gp === 0) return 0;
  return Math.round(((agent.stats?.wins || 0) / gp) * 100);
};

const formatRecord = (agent) => {
  const w = agent?.stats?.wins || 0;
  const l = agent?.stats?.losses || 0;
  return `${w}W-${l}L`;
};

const formatAvg = (agent) => {
  const avg = agent?.stats?.avgScore || 0;
  return avg >= 0 ? `+${avg}` : `${avg}`;
};

const getAvatarGradient = (agent) => {
  const colors = agent?.avatarColors || ['#5eead4', '#a855f7'];
  return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
};

const getInitial = (agent) => (agent?.name || '?')[0].toUpperCase();

const Avatar = ({ agent, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: getAvatarGradient(agent),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 700, color: '#fff',
    flexShrink: 0,
  }}>
    {getInitial(agent)}
  </div>
);

const ArchetypeBadge = ({ archetype }) => {
  const style = ARCHETYPE_STYLES[archetype] || { label: archetype || 'Unknown', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      fontSize: '10px', fontWeight: 600,
      background: style.bg, color: style.color,
    }}>
      {style.label}
    </span>
  );
};

const StatCell = ({ value, label }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '14px', fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.5, marginTop: 2 }}>{label}</div>
  </div>
);

// ── Skeleton loader ─────────────────────────────────────────

const pulseKeyframes = `
@keyframes leaderboardPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
`;

const SkeletonCard = ({ height = 180 }) => (
  <div style={{
    flex: 1, maxWidth: 200, height,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 16, animation: 'leaderboardPulse 1.5s ease-in-out infinite',
  }} />
);

// ── Podium Card ─────────────────────────────────────────────

const PodiumCard = ({ agent, rank, tokens, isMobile }) => {
  const rankStyle = RANK_COLORS[rank - 1] || RANK_COLORS[2];
  const isFirst = rank === 1;

  return (
    <div style={{
      flex: isMobile ? 1 : undefined,
      maxWidth: isMobile ? undefined : 200,
      width: isMobile ? undefined : 200,
      background: tokens.bgCard,
      border: `1px solid ${tokens.borderDefault}`,
      borderRadius: 16,
      padding: `20px 16px ${isFirst ? 28 : 20}px`,
      textAlign: 'center',
      marginTop: 16,
      boxShadow: `${tokens.obsidianShadow}, 0 4px 16px rgba(0,0,0,0.3)`,
      backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
    }}>
      {/* Rank badge */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: rankStyle.bg, color: rankStyle.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700,
        margin: '-16px auto 12px',
      }}>
        {rank}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <Avatar agent={agent} size={48} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: tokens.textWhite, marginBottom: 2 }}>
        {agent.name || 'Unknown'}
      </div>
      <div style={{ fontSize: 11, color: tokens.textMuted, marginBottom: 8 }}>
        by {agent.ownerName || 'Anonymous'}
      </div>

      <div style={{ marginBottom: 12 }}>
        <ArchetypeBadge archetype={agent.archetype} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, color: tokens.textSecondary }}>
        <StatCell value={formatRecord(agent)} label="Record" />
        <StatCell value={formatAvg(agent)} label="Avg" />
      </div>
    </div>
  );
};

// ── Table Row ───────────────────────────────────────────────

const TableRow = ({ agent, rank, tokens, isOwn, isDesktop }) => {
  const archStyle = ARCHETYPE_STYLES[agent.archetype];
  const streakText = agent.stats?.currentStreak
    ? (agent.stats.currentStreak > 0 ? `${agent.stats.currentStreak}W streak` : `${Math.abs(agent.stats.currentStreak)}L streak`)
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 10, marginBottom: 4,
      background: isOwn ? 'rgba(94,234,212,0.06)' : 'transparent',
      border: isOwn ? '1px solid rgba(94,234,212,0.15)' : '1px solid transparent',
      transition: 'background 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={isDesktop ? (e) => { if (!isOwn) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; } : undefined}
      onMouseLeave={isDesktop ? (e) => { if (!isOwn) e.currentTarget.style.background = 'transparent'; } : undefined}
    >
      {/* Rank */}
      <div style={{ width: 28, fontSize: 13, fontWeight: 700, textAlign: 'center', color: tokens.textMuted, flexShrink: 0 }}>
        {rank}
      </div>

      {/* Avatar */}
      <Avatar agent={agent} size={32} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: tokens.textWhite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.name || 'Unknown'}
          {isOwn && <span style={{ fontSize: 10, color: tokens.textMuted, fontWeight: 400 }}> · your agent</span>}
          {agent._preBeta && <span style={{ fontSize: 9, color: tokens.amber, fontWeight: 400, marginLeft: 6 }}>{'< 5 games'}</span>}
        </div>
        <div style={{ fontSize: 10, color: tokens.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {archStyle?.label || agent.archetype || ''}
          {agent.evolutionCycle ? ` · Evo ${agent.evolutionCycle}` : ''}
          {streakText ? ` · ${streakText}` : ''}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: isDesktop ? 20 : 12, flexShrink: 0, color: tokens.textSecondary }}>
        <StatCell value={formatRecord(agent)} label="Record" />
        <StatCell value={formatAvg(agent)} label="Avg" />
        {isDesktop && <StatCell value={`${winPct(agent)}%`} label="Win %" />}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────

const AgentLeaderboardTab = ({ tokens, isDesktop, isMobile, currentUserId }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all_time');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const data = await getLeaderboard(50);
        setAgents(data);
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, [activeFilter]);

  const showPodium = agents.length >= 3;
  // Podium order: #2 left, #1 center, #3 right
  const podiumOrder = showPodium ? [agents[1], agents[0], agents[2]] : [];
  const podiumRanks = [2, 1, 3];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <style>{pulseKeyframes}</style>

      {/* Filter pills */}
      <motion.div variants={sectionVariants} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                fontSize: 12, fontWeight: 500,
                background: isActive ? 'rgba(94,234,212,0.1)' : 'transparent',
                color: isActive ? tokens.teal : tokens.textMuted,
                border: isActive ? '1px solid rgba(94,234,212,0.3)' : `1px solid ${tokens.borderDefault}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </motion.div>

      {/* Loading */}
      {loading && (
        <motion.div variants={sectionVariants} style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-end' }}>
          <SkeletonCard height={160} />
          <SkeletonCard height={200} />
          <SkeletonCard height={160} />
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && agents.length === 0 && (
        <motion.div variants={sectionVariants} style={{ textAlign: 'center', padding: '60px 20px', color: tokens.textMuted }}>
          <Trophy size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: tokens.textSecondary, marginBottom: 6 }}>
            No agents on the leaderboard yet
          </div>
          <div style={{ fontSize: 13 }}>
            Agents need at least 5 games to appear here.
          </div>
        </motion.div>
      )}

      {/* Podium */}
      {!loading && showPodium && (
        <motion.div variants={sectionVariants} style={{
          display: 'flex', gap: isMobile ? 8 : 16,
          alignItems: 'flex-end', justifyContent: 'center',
          marginBottom: 28,
        }}>
          {podiumOrder.map((agent, i) => (
            <PodiumCard
              key={agent.id}
              agent={agent}
              rank={podiumRanks[i]}
              tokens={tokens}
              isMobile={isMobile}
            />
          ))}
        </motion.div>
      )}

      {/* Rankings table */}
      {!loading && agents.length > 0 && (
        <motion.div variants={sectionVariants}>
          <SectionHeader icon={Crown} label="Rankings" tokens={tokens} />
          <div>
            {agents.map((agent, i) => (
              <TableRow
                key={agent.id}
                agent={agent}
                rank={i + 1}
                tokens={tokens}
                isOwn={agent.ownerId === currentUserId}
                isDesktop={isDesktop}
              />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AgentLeaderboardTab;
