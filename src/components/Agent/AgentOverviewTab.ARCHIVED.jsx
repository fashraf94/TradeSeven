import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Swords, Newspaper } from 'lucide-react';
import FantasyTimesStrip from './FantasyTimesStrip';
import ActiveDeployments from './ActiveDeployments';
import DeployedStrategyCard from './DeployedStrategyCard';
import EquippedWatchlistCard from './EquippedWatchlistCard';
import ConsolidatedInsightPreview from './ConsolidatedInsightPreview';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

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

const cardStyle = (tokens) => ({
  background: tokens.bgCard,
  borderRadius: '16px',
  border: `1px solid ${tokens.borderDefault}`,
  padding: '16px 20px',
  boxShadow: `${tokens.obsidianShadow}, 0 4px 16px rgba(0,0,0,0.3)`,
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
});

const BattleLogRow = ({ entry, tokens }) => {
  const isEvo = entry.type === 'evolution';
  const isWin = entry.result === 'win';
  const badge = isEvo ? 'E' : isWin ? 'W' : 'L';
  const badgeColor = isEvo ? tokens.teal : isWin ? tokens.emerald : tokens.red;
  const badgeBg = isEvo
    ? 'rgba(94,234,212,0.15)'
    : isWin ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 0',
      borderBottom: `1px solid ${tokens.borderDefault}`,
    }}>
      <span style={{
        width: '28px', height: '28px', borderRadius: '6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: badgeBg, color: badgeColor,
        fontSize: '12px', fontWeight: '700', flexShrink: 0,
      }}>
        {badge}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: tokens.textPrimary, fontWeight: '600' }}>
          {isEvo ? `Evo: ${entry.mode}` : (entry.opponent ? `vs ${entry.opponent}` : entry.mode || 'Game')}
        </div>
        <div style={{
          fontSize: '11px', color: tokens.textFaint, marginTop: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.summary}
        </div>
      </div>
      <span style={{
        fontSize: '13px', color: tokens.textSecondary, fontWeight: '600', fontFamily: 'monospace',
        flexShrink: 0,
      }}>
        {isEvo ? 'Evo' : entry.score}
      </span>
    </div>
  );
};

const AgentOverviewTab = ({
  agent,
  scouting,
  battleLog,
  news,
  tokens,
  isDesktop,
  isMobile,
  onNavigateToForge,
  onOpenBattle,
  onOpenStory,
  onViewRankings,
  onViewFullInsight,
}) => {
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;

  // Scouting Report card (shared by both layouts)
  const scoutingReport = (
    <motion.div variants={sectionVariants} style={{
      ...cardStyle(tokens),
      borderLeft: `3px solid ${tokens.amber}`,
    }}>
      <SectionHeader icon={Eye} label="Scouting Report" tokens={tokens} />
      {scouting ? (
        <p style={{ fontSize: '14px', color: tokens.textPrimary, lineHeight: '1.6', margin: 0 }}>
          {scouting}
        </p>
      ) : (
        <p style={{ fontSize: '14px', color: tokens.textMuted, lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
          Deploy your agent to generate a scouting report.
        </p>
      )}
    </motion.div>
  );

  const activeDeployments = (
    <motion.div variants={sectionVariants}>
      <ActiveDeployments
        agentId={agent?.id}
        onOpenBattle={onOpenBattle}
        isDesktop={isDesktop}
      />
    </motion.div>
  );

  const fantasyTimes = news?.length > 0 ? (
    <motion.div variants={sectionVariants}>
      <SectionHeader icon={Newspaper} label="Fantasy Times Intel" tokens={tokens} />
      <FantasyTimesStrip
        stories={news}
        tokens={tokens}
        isDesktop={isDesktop}
        isMobile={isMobile}
        onTileClick={onOpenStory}
      />
    </motion.div>
  ) : null;

  const battleLogSection = (
    <motion.div variants={sectionVariants} style={cardStyle(tokens)}>
      <SectionHeader icon={Swords} label="Battle Log" tokens={tokens} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {battleLog.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: tokens.textMuted, fontSize: '13px' }}>
            No battles yet. Deploy your agent to start competing.
          </div>
        ) : (
          battleLog.map((entry, i) => (
            <BattleLogRow key={entry.id || i} entry={entry} tokens={tokens} />
          ))
        )}
      </div>
    </motion.div>
  );

  const viewRankingsLink = (
    <motion.div variants={sectionVariants}>
      <button
        type="button"
        onClick={onViewRankings}
        disabled={!onViewRankings}
        style={{
          display: 'block',
          width: '100%',
          padding: '12px 0',
          border: 'none',
          background: 'transparent',
          color: '#00d9ff',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'center',
          cursor: onViewRankings ? 'pointer' : 'default',
          fontFamily: 'inherit',
        }}
      >
        View Rankings →
      </button>
    </motion.div>
  );

  const deployedStrategyCard = (
    <motion.div variants={sectionVariants}>
      <DeployedStrategyCard agent={agent} onNavigateToForge={onNavigateToForge} />
    </motion.div>
  );

  const equippedWatchlistCard = (
    <motion.div variants={sectionVariants}>
      <EquippedWatchlistCard agent={agent} onNavigateToForge={onNavigateToForge} />
    </motion.div>
  );

  const insightPreview = (
    <motion.div variants={sectionVariants}>
      <ConsolidatedInsightPreview
        consolidatedInsight={agent?.consolidatedInsight}
        gamesPlayed={gamesPlayed}
        onViewFull={onViewFullInsight}
      />
    </motion.div>
  );

  if (isDesktop) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '3fr 2fr',
          gap: 20,
        }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {scoutingReport}
            {activeDeployments}
            {fantasyTimes}
            {battleLogSection}
            {viewRankingsLink}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {deployedStrategyCard}
            {equippedWatchlistCard}
            {insightPreview}
          </div>
        </div>
      </motion.div>
    );
  }

  // Mobile: single column stack
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {scoutingReport}
      {activeDeployments}
      {deployedStrategyCard}
      {equippedWatchlistCard}
      {insightPreview}
      {fantasyTimes}
      {battleLogSection}
      {viewRankingsLink}
    </motion.div>
  );
};

export default AgentOverviewTab;
