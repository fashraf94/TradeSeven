import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, TrendingUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import useAgent from '../../hooks/useAgent';
import { useFantasyTimes } from '../../hooks/useFantasyTimes';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';
import AgentSidebar from './AgentSidebar';
import AgentOverviewTab from './AgentOverviewTab';
import AgentLeaderboardTab from './AgentLeaderboardTab';
import AgentEvolutionTab from './AgentEvolutionTab';
import AgentCreationFlow from './AgentCreationFlow';
import LevelUpNotification from './LevelUpNotification';

// ── Tabs ──────────────────────────────────────────────────

// Leaderboard is not in the tab bar — it's reached via the "View Rankings →"
// link on the Overview tab (activeTab === 'leaderboard') and dismissed via a
// back button rendered alongside the leaderboard content.
const TABS = [
  { key: 'overview', label: 'Overview', icon: Bot },
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

const AgentDashboard = ({ user, setScreen, onCreateAgentBattle, setShowForge, onOpenAgentBattle, onOpenStory }) => {
  const { tokens } = useTheme();
  const { isMobile, isDesktop } = useIsMobile();
  const [activeTab, setActiveTab] = useState('overview');
  const [deploying, setDeploying] = useState(false);
  const { agent, loading, hasAgent, speech, deployText, maturityStage,
          currentLevel, levelConfig, nextLevelInfo, levelUpEvent, clearLevelUp,
          activeDirectives, groupedDirectives, record } = useAgent(user?.odUserId);
  const { stories: rawStories } = useFantasyTimes();

  const handleDeploy = async () => {
    if (!agent?.id || deploying) return;
    setDeploying(true);
    try {
      // Step 1: Generate portfolio via AI
      const response = await fetch('/api/agent/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await response.json();

      if (!data.success) {
        console.error('[Deploy] Failed:', data.error);
        setDeploying(false);
        return;
      }

      // Step 2: Navigate to battle view (opponent is now set server-side)
      console.log('[Deploy] Agent battle created:', data.agentBattleId || '(existing)');
      if (onCreateAgentBattle) {
        await onCreateAgentBattle(
          data.portfolio,
          data.bench,
          {
            agentId: agent.id,
            agentBattleId: data.agentBattleId || null,
            innerMonologue: data.innerMonologue || null,
            strategyBrief: data.strategyBrief || null,
            expiresAt: data.expiresAt || null,
            opponent: data.opponent || null,
            opponentBench: data.opponentBench || null,
          }
        );
      }
    } catch (err) {
      console.error('[Deploy] Error:', err);
    }
    setDeploying(false);
  };
  const transformedStories = transformStoriesForStrip(rawStories);

  // The strip receives a trimmed story shape (6 display fields). When a tile
  // is tapped we need to hand the StoryDetail screen the FULL raw story so
  // body, tickers, visualType, sentiment, etc. are available. Look up the
  // raw story by id and pass that to onOpenStory instead of the trimmed copy.
  const handleStoryTap = (transformedStory) => {
    if (!onOpenStory) return;
    const fullStory = rawStories?.find(s => s.id === transformedStory?.id) || transformedStory;
    onOpenStory(fullStory);
  };

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

      {/* No agent — creation flow */}
      {!hasAgent && !loading && (
        <AgentCreationFlow
          user={user}
          tokens={tokens}
          isDesktop={isDesktop}
          isMobile={isMobile}
          onComplete={(agentId) => {
            console.log('[Agent] Created:', agentId);
          }}
        />
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
              deployText={deployText}
              currentLevel={currentLevel}
              levelConfig={levelConfig}
              nextLevelInfo={nextLevelInfo}
              isDesktop={isDesktop}
              isMobile={isMobile}
              tokens={tokens}
              onDeploy={handleDeploy}
              deploying={deploying}
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
                {activeTab === 'overview' && (
                  <AgentOverviewTab
                    agent={agent}
                    scouting={buildScoutingReport(agent, maturityStage)}
                    battleLog={buildBattleLog(agent)}
                    news={transformedStories}
                    tokens={tokens}
                    isDesktop={isDesktop}
                    isMobile={isMobile}
                    onNavigateToForge={setShowForge ? () => setShowForge(true) : undefined}
                    onOpenBattle={onOpenAgentBattle}
                    onOpenStory={handleStoryTap}
                    onViewRankings={() => setActiveTab('leaderboard')}
                    onViewFullInsight={() => setActiveTab('evolution')}
                  />
                )}
                {activeTab === 'leaderboard' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        marginBottom: 12,
                        border: `1px solid ${tokens.borderDefault}`,
                        borderRadius: 8,
                        background: 'transparent',
                        color: tokens.teal,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      ← Back to Overview
                    </button>
                    <AgentLeaderboardTab
                      tokens={tokens}
                      isDesktop={isDesktop}
                      isMobile={isMobile}
                      currentUserId={user?.odUserId}
                    />
                  </div>
                )}
                {activeTab === 'evolution' && (
                  <AgentEvolutionTab
                    agent={agent}
                    tokens={tokens}
                    isDesktop={isDesktop}
                    isMobile={isMobile}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Level-Up Notification */}
      {levelUpEvent && (
        <LevelUpNotification
          event={levelUpEvent}
          agentName={agent?.name}
          onDismiss={clearLevelUp}
          tokens={tokens}
        />
      )}
    </div>
  );
};

export default AgentDashboard;
