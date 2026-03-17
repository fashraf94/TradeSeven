import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Trophy, TrendingUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import useAgent from '../../hooks/useAgent';
import AgentSidebar from './AgentSidebar';
import AgentMindTab from './AgentMindTab';
import AgentLeaderboardTab from './AgentLeaderboardTab';
import AgentEvolutionTab from './AgentEvolutionTab';

// ── Mock Data ──────────────────────────────────────────────

const MOCK_AGENT = {
  name: 'Spectre-7',
  archetype: 'Momentum Hunter',
  archetypeDrift: 'Leaning aggressive after 3 consecutive wins',
  avatarColors: ['#5eead4', '#9333ea'],
  config: { riskTolerance: 0.7, sectorBias: 'tech-forward', benchSwapAggression: 'high' },
  stats: { wins: 14, losses: 8, gamesPlayed: 22, avgScore: 72.4, currentStreak: 3 },
  evolutionCycle: 3,
  consolidatedInsight: 'Your agent has identified a pattern: portfolios with 40%+ tech allocation have underperformed in the last 3 cycles. Consider diversifying into healthcare and energy.',
  memory: [
    { mode: 'BaggerBomb', lesson: 'Overexposure to energy during volatility spike cost 12 points' },
    { mode: 'SnakeDraft', lesson: 'Early defensive picks in rounds 1-2 yielded higher floor scores' },
    { mode: 'ClashCard', lesson: 'Opponent tendency: 60% chance of tech-heavy lineup on Mondays' },
  ],
  directives: [
    { id: 1, text: 'Favor momentum over value', source: 'coaching' },
    { id: 2, text: 'Avoid energy sector this week', source: 'pinned' },
    { id: 3, text: 'Increase position sizing on high conviction', source: 'strategy_session' },
    { id: 4, text: 'Always hedge with 1 defensive pick', source: 'coaching' },
    { id: 5, text: 'Target 75+ score threshold', source: 'strategy_session', expiresAt: '2025-12-01' },
  ],
};

const MOCK_SPEECH = "I'm seeing unusual volume in semiconductors. Consider front-loading tech exposure this cycle.";

const MOCK_SCOUTING = 'Market volatility elevated. Sector rotation favoring energy and healthcare. Momentum signals strong in mid-cap growth names. Consider defensive positioning for next cycle.';

const MOCK_BATTLE_LOG = [
  { id: 1, opponent: 'GhostTrader', result: 'win', score: '78-65', summary: 'Tech momentum paid off', date: '2h ago' },
  { id: 2, opponent: 'AlphaBot', result: 'loss', score: '61-74', summary: 'Overexposed to energy downturn', date: '1d ago' },
  { id: 3, opponent: 'NightOwl', result: 'win', score: '82-70', summary: 'Defensive pivot worked perfectly', date: '2d ago' },
  { id: 4, opponent: 'MarketMind', result: 'win', score: '69-68', summary: 'Close match, bench swap clutch', date: '3d ago' },
  { id: 5, mode: 'BaggerBomb Evo', type: 'evolution', result: 'win', score: null, summary: 'Training complete — learned sector rotation timing', date: '4d ago' },
];

const MOCK_NEWS = [
  { id: 1, headline: 'Fed signals steady rates through Q2', reporter: 'Macro Mel', beat: 'Macro', color: '#f59e0b', time: '1h ago' },
  { id: 2, headline: 'Semiconductor shortage easing, supply chain improving', reporter: 'Chip Charlie', beat: 'Tech', color: '#5eead4', time: '3h ago' },
  { id: 3, headline: 'Healthcare sector rotation accelerating', reporter: 'Sector Sam', beat: 'Sectors', color: '#34d399', time: '5h ago' },
  { id: 4, headline: 'Earnings season preview: what to watch', reporter: 'Alpha Ana', beat: 'Earnings', color: '#9333ea', time: '8h ago' },
];

const TABS = [
  { key: 'mind', label: 'Mind', icon: Bot },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'evolution', label: 'Evolution', icon: TrendingUp },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

// ── Component ──────────────────────────────────────────────

const AgentDashboard = ({ user, setScreen }) => {
  const { tokens } = useTheme();
  const { isMobile, isDesktop } = useIsMobile();
  const [activeTab, setActiveTab] = useState('mind');
  const { agent, loading, hasAgent, speech, deployText, maturityStage,
          activeDirectives, groupedDirectives, record, seedTestAgent } = useAgent(user?.odUserId);

  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.bgAgent,
      paddingBottom: isMobile ? '100px' : 0,
    }}>
      {/* Dev seed button — shown when no agent exists */}
      {!hasAgent && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '16px', color: tokens.textSecondary }}>
            No agent found. Seed test data?
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              const id = await seedTestAgent();
              if (id) console.log('Test agent created:', id);
            }}
            style={{
              background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`,
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Seed Test Agent (Dev Only)
          </motion.button>
        </div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          maxWidth: isDesktop ? '1100px' : '100%',
          margin: '0 auto',
          padding: isDesktop ? '24px 32px' : '0',
        }}
      >
        {/* Left: Agent Sidebar */}
        <motion.div variants={sectionVariants}>
          <AgentSidebar
            agent={MOCK_AGENT}
            speech={MOCK_SPEECH}
            isDesktop={isDesktop}
            isMobile={isMobile}
            tokens={tokens}
            onDeploy={() => {}}
          />
        </motion.div>

        {/* Right: Tab Content Area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Tab Bar */}
          <motion.div
            variants={sectionVariants}
            style={{
              display: 'flex',
              borderBottom: `1px solid ${tokens.borderDefault}`,
              padding: isDesktop ? '0 24px' : '0 16px',
              position: isMobile ? 'sticky' : 'static',
              top: 0,
              zIndex: 10,
              background: tokens.bgAgent,
            }}
          >
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    position: 'relative',
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '6px',
                    padding: '14px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: isActive ? tokens.teal : tokens.textMuted,
                    fontSize: '13px', fontWeight: isActive ? '700' : '500',
                    transition: 'color 0.2s',
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="agentTabIndicator"
                      style={{
                        position: 'absolute', bottom: -1, left: 0, right: 0,
                        height: '2px',
                        background: `linear-gradient(90deg, ${tokens.teal}, ${tokens.purple})`,
                        borderRadius: '1px 1px 0 0',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              style={{ padding: isDesktop ? '20px 24px' : '16px' }}
            >
              {activeTab === 'mind' && (
                <AgentMindTab
                  agent={MOCK_AGENT}
                  scouting={MOCK_SCOUTING}
                  battleLog={MOCK_BATTLE_LOG}
                  news={MOCK_NEWS}
                  tokens={tokens}
                  isDesktop={isDesktop}
                  isMobile={isMobile}
                />
              )}
              {activeTab === 'leaderboard' && <AgentLeaderboardTab tokens={tokens} />}
              {activeTab === 'evolution' && <AgentEvolutionTab tokens={tokens} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default AgentDashboard;
