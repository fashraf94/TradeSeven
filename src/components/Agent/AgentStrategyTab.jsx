import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Clock } from 'lucide-react';
import StatusFeedTimeline from './StatusFeedTimeline';
import ExecutionModeToggle from './ExecutionModeToggle';
import StrategyPresetToggle from './StrategyPresetToggle';
import ProposalCard from './ProposalCard';
import GameplanMeetingCard from './GameplanMeetingCard';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

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

const AgentStrategyTab = ({ battle, statusFeed, executionMode, pendingProposal, strategyPreset, gameplanMeeting, loading, tokens, isDesktop, isMobile }) => {
  // No active battle
  if (!battle && !loading) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
      >
        <motion.div variants={sectionVariants} style={{
          ...cardStyle(tokens),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
          gap: '12px',
        }}>
          <Activity size={32} color={tokens.textFaint} style={{ opacity: 0.5 }} />
          <p style={{ fontSize: '14px', color: tokens.textMuted, lineHeight: '1.6', maxWidth: '280px', margin: 0 }}>
            Deploy your agent to see the strategy feed. Your agent's decisions, trades, and risk actions will appear here in real-time.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        color: tokens.textMuted,
        fontSize: '13px',
      }}>
        Loading battle data...
      </div>
    );
  }

  const scoreState = battle?.scoreState || {};
  const isActive = battle?.status === 'active';
  const isCompleted = battle?.status === 'completed';
  const hasPendingProposal = pendingProposal && !pendingProposal.resolvedAt;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Battle status header */}
      <motion.div variants={sectionVariants} style={{
        ...cardStyle(tokens),
        borderLeft: `3px solid ${isActive ? tokens.teal : isCompleted ? tokens.amber : tokens.textMuted}`,
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isActive ? (
              <Zap size={14} color={tokens.teal} />
            ) : (
              <Clock size={14} color={tokens.textMuted} />
            )}
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: isActive ? tokens.teal : tokens.textMuted,
            }}>
              {isActive ? 'Live Battle' : isCompleted ? 'Battle Complete' : 'Battle'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: '700',
              fontFamily: 'monospace',
              color: (scoreState.currentScore || 0) >= 0 ? tokens.emerald : tokens.red,
            }}>
              {(scoreState.currentScore || 0) >= 0 ? '+' : ''}
              {(scoreState.currentScore || 0).toFixed(1)} pts
            </span>
            <span style={{ fontSize: '11px', color: tokens.textFaint }}>
              {scoreState.tradeCount || 0} trades
            </span>
          </div>
        </div>
      </motion.div>

      {/* Execution Mode Toggle */}
      {isActive && (
        <motion.div variants={sectionVariants} style={cardStyle(tokens)}>
          <ExecutionModeToggle
            battleId={battle.id}
            executionMode={executionMode}
            tokens={tokens}
            disabled={!isActive}
          />
        </motion.div>
      )}

      {/* Strategy Preset Toggle */}
      {isActive && (
        <motion.div variants={sectionVariants} style={cardStyle(tokens)}>
          <StrategyPresetToggle
            battleId={battle.id}
            strategyPreset={strategyPreset}
            tokens={tokens}
            disabled={!isActive}
          />
        </motion.div>
      )}

      {/* Pending Proposal Card */}
      <AnimatePresence>
        {hasPendingProposal && (
          <ProposalCard
            battleId={battle.id}
            proposal={pendingProposal}
            tokens={tokens}
          />
        )}
      </AnimatePresence>

      {/* Gameplan Meeting Card */}
      <AnimatePresence>
        {gameplanMeeting?.status === 'pending' && (
          <GameplanMeetingCard
            battleId={battle.id}
            meeting={gameplanMeeting}
            tokens={tokens}
          />
        )}
      </AnimatePresence>

      {/* Strategy Feed */}
      <motion.div variants={sectionVariants} style={cardStyle(tokens)}>
        <SectionHeader icon={Activity} label="Strategy Feed" tokens={tokens} />
        <StatusFeedTimeline
          statusFeed={statusFeed}
          tokens={tokens}
          isDesktop={isDesktop}
          isMobile={isMobile}
        />
      </motion.div>
    </motion.div>
  );
};

export default AgentStrategyTab;
