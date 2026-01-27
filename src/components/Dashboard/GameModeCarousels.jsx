// /src/components/Dashboard/GameModeCarousels.jsx
// Horizontal scroll carousels for game modes
// Supports mode prop: 'pvp' (Enter the Arena), 'train' (Quick Play), 'all' (both)
// Features: Infinite/endless carousel with seamless looping

import React from 'react';
import { Zap, Swords } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import ThemedGameCard from './ThemedGameCard';
import InfiniteCarousel from './InfiniteCarousel';

// Section header style - prominent gradient text with italic styling
const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '12px',
  padding: '0 16px',
  marginBottom: '16px',
  marginTop: '24px',
};

// Gradient text style for section titles
const getSectionTitleStyle = (accentColor, lighterAccent) => ({
  fontSize: '18px',
  fontWeight: '700',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  fontStyle: 'italic',
  background: `linear-gradient(90deg, ${accentColor} 0%, ${lighterAccent} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

const sectionSubtitleStyle = {
  fontSize: '13px',
  color: HOLO_COLORS.textMuted,
  fontWeight: '400',
  fontStyle: 'normal',
};

export default function GameModeCarousels({
  // Mode: 'pvp' shows COMPETE only, 'train' shows EARN COINS only, 'all' shows both
  mode = 'all',
  // Training handlers
  setTrainingConfirmType,
  setShowTrainingConfirmModal,
  setShowClassicTrainingConfirm,
  setShowBaggerBombTrainingConfirm,
  // Screen navigation
  setScreen,
  // Modal handlers for COMPETE games
  setShowSnakeDraftModal,
  setShowBuilderModal,
  setShowBaggerBombModal,
  setShowOptionsArenaModal,
}) {
  // ═══════════════════════════════════════════════════════════════
  // EARN COINS / QUICK PLAY CARDS (Training)
  // ═══════════════════════════════════════════════════════════════
  const earnCoinsCards = [
    {
      id: 'snake-training',
      theme: 'snakeDraft',
      title: 'Snake Draft',
      description: 'Practice drafting against 3 CPU opponents in a 4-player snake draft',
      duration: '~5 min',
      isTraining: true,
      onClick: () => {
        setTrainingConfirmType('stocks');
        setShowTrainingConfirmModal(true);
      },
    },
    {
      id: 'builder-training',
      theme: 'builder',
      title: 'Builder',
      description: 'Practice building Classic Battle portfolios against CPU',
      duration: '~5 min',
      isTraining: true,
      onClick: () => {
        setShowClassicTrainingConfirm(true);
      },
    },
    {
      id: 'baggerbomb-training',
      theme: 'baggerBomb',
      title: 'BaggerBomb',
      description: 'Practice scoring points with breakout bonuses against CPU',
      duration: '~5 min',
      isTraining: true,
      onClick: () => {
        setShowBaggerBombTrainingConfirm(true);
      },
    },
    {
      id: 'options-training',
      theme: 'optionsArena',
      title: 'Options Arena',
      description: 'Practice picking strike prices and predicting market moves',
      duration: null,
      isTraining: true,
      onClick: () => {
        setScreen('stonkOptionsArena');
      },
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // COMPETE / ENTER THE ARENA CARDS (Real Games)
  // ═══════════════════════════════════════════════════════════════
  const competeCards = [
    {
      id: 'snake-draft',
      theme: 'snakeDraft',
      title: 'Snake Draft',
      description: 'Start a 4-player snake draft lobby and compete for rewards',
      duration: null,
      isTraining: false,
      onClick: () => {
        setShowSnakeDraftModal(true);
      },
    },
    {
      id: 'builder-1v1',
      theme: 'builder',
      title: 'Builder 1v1',
      description: 'Build a portfolio and battle 1v1 for dominance',
      duration: null,
      isTraining: false,
      onClick: () => {
        setShowBuilderModal(true);
      },
    },
    {
      id: 'bagger-bomb',
      theme: 'baggerBomb',
      title: 'BaggerBomb',
      description: 'Score points with breakout bonuses and explosive returns',
      duration: null,
      isTraining: false,
      onClick: () => {
        setShowBaggerBombModal(true);
      },
    },
    {
      id: 'options-arena',
      theme: 'optionsArena',
      title: 'Options Arena',
      description: 'Pick strikes & win big with binary options trading',
      duration: null,
      isTraining: false,
      onClick: () => {
        setShowOptionsArenaModal(true);
      },
    },
  ];

  const showTraining = mode === 'all' || mode === 'train';
  const showCompete = mode === 'all' || mode === 'pvp';

  // Section labels change based on mode
  const trainLabel = mode === 'train' ? 'QUICK PLAY' : 'EARN COINS';
  const trainSubtitle = mode === 'train' ? '— Practice against AI' : '— Low-risk training to build your balance';
  const competeLabel = mode === 'pvp' ? 'ENTER THE ARENA' : 'COMPETE';
  const competeSubtitle = mode === 'pvp' ? '— Challenge friends or rivals' : '— Challenge friends or rivals';

  return (
    <>
      {/* CSS to hide scrollbar for webkit browsers */}
      <style>{`
        .carousel-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          TRAINING SECTION
          ═══════════════════════════════════════════════════════════════ */}
      {showTraining && (
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionHeaderStyle}>
            <Zap size={18} color={HOLO_COLORS.purple} />
            <span style={getSectionTitleStyle(HOLO_COLORS.purple, '#a78bfa')}>
              {trainLabel}
            </span>
            <span style={sectionSubtitleStyle}>
              {trainSubtitle}
            </span>
          </div>

          <InfiniteCarousel
            items={earnCoinsCards}
            renderCard={(card, index) => (
              <ThemedGameCard
                key={`${card.id}-${index}`}
                theme={card.theme}
                title={card.title}
                description={card.description}
                duration={card.duration}
                onClick={card.onClick}
                index={index % earnCoinsCards.length}
                isTraining={card.isTraining}
              />
            )}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          COMPETE SECTION
          ═══════════════════════════════════════════════════════════════ */}
      {showCompete && (
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionHeaderStyle}>
            <Swords size={18} color={HOLO_COLORS.defensive} />
            <span style={getSectionTitleStyle(HOLO_COLORS.defensive, '#34d399')}>
              {competeLabel}
            </span>
            <span style={sectionSubtitleStyle}>
              {competeSubtitle}
            </span>
          </div>

          <InfiniteCarousel
            items={competeCards}
            renderCard={(card, index) => (
              <ThemedGameCard
                key={`${card.id}-${index}`}
                theme={card.theme}
                title={card.title}
                description={card.description}
                duration={card.duration}
                onClick={card.onClick}
                index={index % competeCards.length}
                isTraining={card.isTraining}
              />
            )}
          />
        </div>
      )}
    </>
  );
}
