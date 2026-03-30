// AgentBattleScreen - Phase 1: Screen shell with persistent top section
// Renders: score header (tug-of-war layout), portfolio strip, controls, hypothesis ticker
// Bottom section is a placeholder for Phase 2 activity feed.

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Activity, TrendingUp, Bot } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import useAgentBattleId from '../hooks/useAgentBattleId';
import useAgentBattle from '../hooks/useAgentBattle';
import AnimatedScore from '../components/shared/AnimatedScore';
import ExecutionModeToggle from '../components/Agent/ExecutionModeToggle';
import AgentPortfolioStrip from '../components/Agent/AgentPortfolioStrip';
import StrategyPresetBadge from '../components/Agent/StrategyPresetBadge';
import HypothesisTicker from '../components/Agent/HypothesisTicker';
import AgentActivityFeed from '../components/Agent/AgentActivityFeed';
import ForgeCitationCard from '../components/Agent/ForgeCitationCard';
import ProposalBanner from '../components/Agent/ProposalBanner';
import DebateModal from '../components/Agent/DebateModal';
import { addFeedBookmark, removeFeedBookmark } from '../services/agentService';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeDayLabel(timing) {
  if (!timing) return '';
  const { tradingDays, currentTradingDay } = timing;
  const total = tradingDays?.length || 0;
  const current = currentTradingDay || 1;
  return `Day ${current} of ${total}`;
}

function computeTugOfWarWidth(myScore, oppScore) {
  const total = Math.abs(myScore) + Math.abs(oppScore);
  if (total === 0) return 50;
  return Math.max(10, Math.min(90, (Math.abs(myScore) / total) * 100));
}

// ─── Score Header ──────────────────────────────────────────────────────────────

function ScoreHeader({ agentBattle, tokens }) {
  const myScore = agentBattle?.scoreState?.currentScore || 0;
  const oppScore = 0; // CPU score — will be computed in Phase 2 with price integration
  const dayLabel = computeDayLabel(agentBattle?.timing);
  const agentName = agentBattle?.agentContext?.agentName || 'Your Agent';
  const tradeCount = agentBattle?.scoreState?.tradeCount || 0;

  const myWidth = computeTugOfWarWidth(myScore, oppScore);
  const isLeading = myScore >= oppScore;

  return (
    <div style={{
      padding: '10px 16px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Names + Scores row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {/* Left: Agent */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 2,
          }}>
            <Bot size={12} color="#5eead4" />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {agentName}
            </span>
          </div>
          <AnimatedScore
            value={myScore}
            defaultColor="#5eead4"
            size={28}
          />
        </div>

        {/* Center: Day label + trade count */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}>
          {dayLabel && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: tokens.textFaint,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {dayLabel}
            </span>
          )}
          {tradeCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: tokens.textFaint,
            }}>
              <Activity size={9} />
              <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Right: CPU */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 2,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              CPU
            </span>
          </div>
          <AnimatedScore
            value={oppScore}
            defaultColor={tokens.textFaint || '#64748b'}
            size={28}
          />
        </div>
      </div>

      {/* Tug-of-war bar */}
      <div style={{
        width: '100%',
        height: 6,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        display: 'flex',
      }}>
        <motion.div
          animate={{ width: `${myWidth}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{
            height: '100%',
            background: isLeading
              ? 'linear-gradient(90deg, #5eead4, #2dd4bf)'
              : 'rgba(94,234,212,0.4)',
            borderRadius: '3px 0 0 3px',
          }}
        />
        <div style={{
          width: 2,
          height: '100%',
          background: 'rgba(255,255,255,0.15)',
          flexShrink: 0,
        }} />
        <div style={{
          flex: 1,
          height: '100%',
          background: !isLeading
            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
            : 'rgba(239,68,68,0.3)',
          borderRadius: '0 3px 3px 0',
        }} />
      </div>
    </div>
  );
}

// ─── Controls Row ──────────────────────────────────────────────────────────────

function ControlsRow({ agentBattleId, executionMode, strategyPreset, tokens }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '6px 16px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ExecutionModeToggle
          battleId={agentBattleId}
          executionMode={executionMode}
          tokens={tokens}
        />
      </div>
      <StrategyPresetBadge
        battleId={agentBattleId}
        strategyPreset={strategyPreset}
        tokens={tokens}
      />
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function AgentBattleScreen({ battle, user, onBack }) {
  const { tokens } = useTheme();
  const [filterTicker, setFilterTicker] = useState(null);
  const [debateOpen, setDebateOpen] = useState(false);
  const [debateSymbol, setDebateSymbol] = useState(null);
  const [citationOpen, setCitationOpen] = useState(false);
  const [citationRuleId, setCitationRuleId] = useState(null);

  // Resolve agentBattleId from the regular battle's agentId
  const { agentBattleId, loading: idLoading } = useAgentBattleId(battle?.agentId);

  // Subscribe to agent battle data
  const {
    battle: agentBattle,
    statusFeed,
    executionMode,
    pendingProposal,
    strategyPreset,
    gameplanMeeting,
    feedBookmarks,
    loading: battleLoading,
  } = useAgentBattle(agentBattleId);

  const loading = idLoading || battleLoading;

  const handleTickerTap = useCallback((symbol) => {
    setFilterTicker(prev => prev === symbol ? null : symbol);
  }, []);

  const handleChallenge = useCallback((entry) => {
    setDebateSymbol(entry.symbolOut);
    setDebateOpen(true);
  }, []);

  const handleCitationTap = useCallback((ruleId) => {
    setCitationRuleId(ruleId);
    setCitationOpen(true);
  }, []);

  // Loading state
  if (loading && !agentBattle) {
    return (
      <div style={{
        minHeight: '100vh',
        background: tokens.bgApp || '#0D0E12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          >
            <Bot size={24} color="#5eead4" />
          </motion.div>
          <span style={{ fontSize: 13, color: tokens.textMuted }}>Loading agent battle...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.bgApp || '#0D0E12',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ═══ PERSISTENT TOP SECTION (~30%) ═══ */}
      <div style={{
        flexShrink: 0,
        background: tokens.bgAgent || '#1C1A27',
        borderBottom: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
      }}>
        {/* Back button bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px 0',
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: '#5eead4',
              fontSize: 13,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 8,
            }}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>

          {agentBattle?.status && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10,
              fontWeight: 600,
              color: agentBattle.status === 'active' ? '#5eead4' : tokens.textFaint,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: agentBattle.status === 'active' ? '#5eead4' : tokens.textFaint,
              }} />
              {agentBattle.status}
            </div>
          )}
        </div>

        {/* Row 1: Score header */}
        <ScoreHeader agentBattle={agentBattle} tokens={tokens} />

        {/* Row 2: Portfolio strip */}
        <AgentPortfolioStrip
          portfolio={agentBattle?.portfolio}
          tokens={tokens}
          filterTicker={filterTicker}
          onTickerTap={handleTickerTap}
        />

        {/* Row 3: Controls */}
        <ControlsRow
          agentBattleId={agentBattleId}
          executionMode={executionMode}
          strategyPreset={strategyPreset}
          tokens={tokens}
        />

        {/* Row 4: Hypothesis ticker */}
        <HypothesisTicker statusFeed={statusFeed} tokens={tokens} />

        {/* Bottom spacer for the top section */}
        <div style={{ height: 8 }} />
      </div>

      {/* ═══ ACTIVITY FEED (~70%) ═══ */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <AgentActivityFeed
          statusFeed={statusFeed}
          feedBookmarks={feedBookmarks}
          filterTicker={filterTicker}
          onClearFilter={() => setFilterTicker(null)}
          onBookmark={(entryId) => addFeedBookmark(agentBattleId, entryId)}
          onUnbookmark={(entryId) => removeFeedBookmark(agentBattleId, entryId)}
          onChallenge={handleChallenge}
          onCitationTap={handleCitationTap}
          battleId={agentBattleId}
          isAgentVsAgent={!!agentBattle?.opponentAgentId}
          gameplanMeeting={gameplanMeeting}
          tokens={tokens}
        />
      </div>

      {/* ═══ PROPOSAL BANNER ═══ */}
      <ProposalBanner
        pendingProposal={pendingProposal}
        executionMode={executionMode}
        battleId={agentBattleId}
        onCitationTap={handleCitationTap}
        tokens={tokens}
      />

      {/* ═══ MODALS ═══ */}
      <DebateModal
        isOpen={debateOpen}
        onClose={() => setDebateOpen(false)}
        battleId={agentBattleId}
        targetSymbol={debateSymbol}
        tokens={tokens}
      />

      <ForgeCitationCard
        isOpen={citationOpen}
        onClose={() => setCitationOpen(false)}
        ruleId={citationRuleId}
        battleData={agentBattle}
        statusFeed={statusFeed}
        tokens={tokens}
      />
    </div>
  );
}
