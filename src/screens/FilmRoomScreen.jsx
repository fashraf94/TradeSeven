import React, { useState, useMemo, useCallback, useEffect } from 'react';
import useAgentBattle from '../hooks/useAgentBattle';
import { useTheme } from '../contexts/ThemeContext';
import TermResearchModal from '../components/shared/TermResearchModal';
import AssetResearchModal from '../components/draft/AssetResearchModal';
import FilmRoomHeader from '../components/FilmRoom/FilmRoomHeader';
import DayPicker from '../components/FilmRoom/DayPicker';
import ScoreSummaryCard from '../components/FilmRoom/ScoreSummaryCard';
import AutoDebriefHero from '../components/FilmRoom/AutoDebriefHero';
import DaySummaryCard from '../components/FilmRoom/DaySummaryCard';
import TradeHistorySection from '../components/FilmRoom/TradeHistorySection';
import AnticipationLogSection from '../components/FilmRoom/AnticipationLogSection';
import FilmRoomChat from '../components/FilmRoom/FilmRoomChat';

function pickDefaultDay(agentBattle) {
  const reviews = Array.isArray(agentBattle?.dailyReviews) ? agentBattle.dailyReviews : [];
  if (reviews.length > 0) {
    const last = reviews[reviews.length - 1];
    if (typeof last?.tradingDay === 'number') return last.tradingDay;
  }
  const tradingDays = agentBattle?.timing?.tradingDays;
  if (Array.isArray(tradingDays) && tradingDays.length > 0) {
    return Math.max(1, agentBattle?.timing?.currentTradingDay || 1);
  }
  return 1;
}

export default function FilmRoomScreen({ battle, onBack }) {
  const { tokens } = useTheme();
  const agentBattleId = battle?.agentBattleId || battle?.id || null;
  const { battle: agentBattle, chatExchanges, loading } = useAgentBattle(agentBattleId);

  const [selectedDay, setSelectedDay] = useState(null);
  const [researchAsset, setResearchAsset] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);

  // Initialize selectedDay once the battle doc arrives.
  useEffect(() => {
    if (selectedDay == null && agentBattle) {
      setSelectedDay(pickDefaultDay(agentBattle));
    }
  }, [agentBattle, selectedDay]);

  const tradingDays = agentBattle?.timing?.tradingDays || [];
  const dailyReviews = useMemo(
    () => (Array.isArray(agentBattle?.dailyReviews) ? agentBattle.dailyReviews : []),
    [agentBattle?.dailyReviews]
  );

  const reviewForSelectedDay = useMemo(
    () => dailyReviews.find((r) => r?.tradingDay === selectedDay) || null,
    [dailyReviews, selectedDay]
  );

  // Build knownTickers from the agent's portfolio so chat entity detection lights them up.
  const knownTickers = useMemo(() => {
    const set = new Set();
    const portfolio = agentBattle?.portfolio || {};
    ['star', 'core', 'support'].forEach((tier) => {
      (portfolio[tier] || []).forEach((a) => {
        if (a?.symbol) set.add(a.symbol);
      });
    });
    (agentBattle?.trades || []).forEach((t) => {
      if (t?.symbolOut) set.add(t.symbolOut);
      if (t?.symbolIn) set.add(t.symbolIn);
    });
    return set;
  }, [agentBattle?.portfolio, agentBattle?.trades]);

  const handleSymbolClick = useCallback((payload) => {
    if (payload?.type === 'term') {
      setSelectedTerm(payload.token);
      return;
    }
    setResearchAsset(payload);
  }, []);

  // selectedDay is initialized by the effect above AFTER the first commit
  // where agentBattle becomes available. Without this check, the body renders
  // one frame with dayNum=null and every child shows an empty/zero state
  // ("Day  Score" header, "No review yet" placeholder).
  if (loading || !agentBattle || selectedDay == null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0d0e12',
          color: tokens.textMuted || '#94a3b8',
          padding: 40,
          textAlign: 'center',
          fontSize: 13,
        }}
      >
        Loading Film Room…
      </div>
    );
  }

  const agentName = agentBattle.agentContext?.agentName || 'Your Agent';
  const reviewBudgetUsed = agentBattle.reviewBudgetUsed || 0;
  const totalDays = Array.isArray(tradingDays) ? tradingDays.length : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0e12', display: 'flex', flexDirection: 'column' }}>
      <FilmRoomHeader onBack={onBack} tokens={tokens} totalDays={totalDays}>
        <DayPicker
          tradingDays={tradingDays}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          dailyReviews={dailyReviews}
          tokens={tokens}
        />
      </FilmRoomHeader>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          paddingTop: 12,
        }}
      >
        <ScoreSummaryCard battle={agentBattle} dayNum={selectedDay} tokens={tokens} />

        <AutoDebriefHero
          battle={agentBattle}
          chatExchanges={chatExchanges}
          dayNum={selectedDay}
          agentName={agentName}
          onSymbolClick={handleSymbolClick}
          knownTickers={knownTickers}
          tokens={tokens}
        />

        <DaySummaryCard review={reviewForSelectedDay} tokens={tokens} />

        <TradeHistorySection
          battle={agentBattle}
          dayNum={selectedDay}
          onSymbolClick={handleSymbolClick}
          tokens={tokens}
        />

        <AnticipationLogSection
          battle={agentBattle}
          chatExchanges={chatExchanges}
          dayNum={selectedDay}
          onSymbolClick={handleSymbolClick}
          knownTickers={knownTickers}
          tokens={tokens}
        />

        <FilmRoomChat
          agentId={agentBattle.agentId || battle?.agentId}
          battleId={agentBattleId}
          chatExchanges={chatExchanges}
          reviewBudgetUsed={reviewBudgetUsed}
          onSymbolClick={handleSymbolClick}
          knownTickers={knownTickers}
          tokens={tokens}
        />
      </div>

      {researchAsset && (
        <AssetResearchModal
          asset={researchAsset}
          onClose={() => setResearchAsset(null)}
          showActionButton={false}
          isGameContext={true}
          version={2}
          defaultTab="baggerbomb"
          defaultTimeframe="bomb"
        />
      )}

      <TermResearchModal
        termToken={selectedTerm}
        isOpen={!!selectedTerm}
        onClose={() => setSelectedTerm(null)}
      />
    </div>
  );
}
