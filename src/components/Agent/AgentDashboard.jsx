import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Trophy, TrendingUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import useAgent from '../../hooks/useAgent';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';
import AgentSidebar from './AgentSidebar';
import AgentMindTab from './AgentMindTab';
import AgentLeaderboardTab from './AgentLeaderboardTab';
import AgentEvolutionTab from './AgentEvolutionTab';

// ── Tabs ──────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp?._seconds
    ? new Date(timestamp._seconds * 1000)
    : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const transformStoriesForStrip = (stories) => {
  if (!stories?.length) return [];
  return stories.slice(0, 4).map(story => {
    const profile = REPORTER_PROFILES[story.reporter] || {};
    return {
      id: story.id,
      reporter: profile.name || story.reporter || 'Unknown',
      beat: profile.beat || 'Market intel',
      headline: story.headline || '',
      color: profile.color || '#5eead4',
      time: formatTimeAgo(story.publishedAt),
    };
  });
};

const buildBattleLog = (agent) => {
  if (!agent?.memory?.length) return [];
  return agent.memory.map((m, i) => ({
    id: m.gameId || `mem_${i}`,
    mode: m.gameMode || 'BaggerBomb',
    result: m.result,
    score: m.score || 0,
    summary: m.lesson || '',
    date: m.date ? formatTimeAgo(m.date) : '',
  })).reverse();
};

const buildScoutingReport = (agent, maturityStage) => {
  if (!agent) return '';
  if (maturityStage === 'fresh') return "Deploy me first, then I'll start reading FantasyTimes.";
  if (maturityStage === 'growing') return 'Still learning. A few more games and I\'ll start connecting news to strategy.';
  if (agent.consolidatedInsight) {
    return `Based on my experience: ${agent.consolidatedInsight.slice(0, 200)}${agent.consolidatedInsight.length > 200 ? '...' : ''}`;
  }
  return 'Analyzing market conditions...';
};

// ── Component ──────────────────────────────────────────────

const AgentDashboard = ({ user, setScreen }) => {
  const { tokens } = useTheme();
  const { isMobile, isDesktop } = useIsMobile();
  const [activeTab, setActiveTab] = useState('mind');
  const { agent, loading, hasAgent, speech, deployText, maturityStage,
          activeDirectives, groupedDirectives, record, seedTestAgent } = useAgent(user?.odUserId);
  const { stories: rawStories } = useFantasyTimes();
  const transformedStories = transformStoriesForStrip(rawStories);

  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.bgAgent,
      paddingBottom: isMobile ? '100px' : 0,
    }}>
      {/* Loading state */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          color: tokens.textMuted,
          fontSize: '14px',
        }}>
          Loading agent data...
        </div>
      )}

      {/* No agent — empty state with seed button */}
      {!hasAgent && !loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '20px',
          padding: '40px 20px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.purple})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
          }}>
            <Bot size={36} color="#fff" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: tokens.textWhite }}>
            Build your trading agent
          </div>
          <div style={{
            fontSize: '14px',
            color: tokens.textSecondary,
            maxWidth: '340px',
            lineHeight: '1.6',
          }}>
            Create an AI agent that learns your style, reads the market, and competes on your behalf.
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
              padding: '14px 28px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Create Agent (Dev: Seeds Test Data)
          </motion.button>
        </div>
      )}

      {/* Dashboard layout — only when agent exists */}
      {hasAgent && !loading && (
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
              agent={agent}
              speech={speech}
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
                    agent={agent}
                    scouting={buildScoutingReport(agent, maturityStage)}
                    battleLog={buildBattleLog(agent)}
                    news={transformedStories}
                    tokens={tokens}
                    isDesktop={isDesktop}
                    isMobile={isMobile}
                  />
                )}
                {activeTab === 'leaderboard' && (
                  <AgentLeaderboardTab
                    tokens={tokens}
                    isDesktop={isDesktop}
                    isMobile={isMobile}
                    currentUserId={user?.odUserId}
                  />
                )}
                {activeTab === 'evolution' && <AgentEvolutionTab tokens={tokens} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AgentDashboard;
