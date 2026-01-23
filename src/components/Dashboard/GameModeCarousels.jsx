// /src/components/Dashboard/GameModeCarousels.jsx
// Horizontal scroll carousels for game modes - EARN COINS and COMPETE sections
// Major consolidation: unified carousel view with themed cards

import React from 'react';
import { Zap, Swords } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import ThemedGameCard from './ThemedGameCard';

// Carousel container style with hidden scrollbar
const carouselContainerStyle = {
  display: 'flex',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  gap: '12px',
  padding: '0 16px 16px 16px',
  scrollbarWidth: 'none',        // Firefox
  msOverflowStyle: 'none',       // IE/Edge
  WebkitOverflowScrolling: 'touch', // Smooth iOS scroll
};

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
  // Training handlers
  setTrainingConfirmType,
  setShowTrainingConfirmModal,
  setShowClassicTrainingConfirm,
  // Screen navigation
  setScreen,
  // NEW: Modal handlers for COMPETE games
  setShowSnakeDraftModal,
  setShowBuilderModal,
  setShowBaggerBombModal,
  setShowOptionsArenaModal,
}) {
  // ═══════════════════════════════════════════════════════════════
  // EARN COINS CARDS (Training)
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
        // Open modal with Stocks/Crypto selector
        setTrainingConfirmType('stocks');
        setShowTrainingConfirmModal(true);
      },
    },
    {
      id: 'builder-training',
      theme: 'builder',
      title: 'Builder',
      description: 'Practice building portfolios against CPU in Classic or BaggerBomb mode',
      duration: '~5 min',
      isTraining: true,
      onClick: () => {
        // Open modal with Classic/BaggerBomb selector
        setShowClassicTrainingConfirm(true);
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
        // Direct navigation - no modal needed for training
        setScreen('stonkOptionsArena');
      },
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // COMPETE CARDS (Real Games)
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

  return (
    <>
      {/* CSS to hide scrollbar for webkit browsers */}
      <style>{`
        .carousel-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          EARN COINS SECTION - Training modes to build balance
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '24px' }}>
        {/* Section Header - Purple gradient */}
        <div style={sectionHeaderStyle}>
          <Zap size={18} color="#8b5cf6" />
          <span style={getSectionTitleStyle('#8b5cf6', '#a78bfa')}>
            EARN COINS
          </span>
          <span style={sectionSubtitleStyle}>
            — Low-risk training to build your balance
          </span>
        </div>

        {/* Carousel */}
        <div
          className="carousel-scroll"
          style={carouselContainerStyle}
        >
          {earnCoinsCards.map((card, index) => (
            <ThemedGameCard
              key={card.id}
              theme={card.theme}
              title={card.title}
              description={card.description}
              duration={card.duration}
              onClick={card.onClick}
              index={index}
              isTraining={card.isTraining}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          COMPETE SECTION - Real games against real opponents
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '24px' }}>
        {/* Section Header - Green gradient */}
        <div style={sectionHeaderStyle}>
          <Swords size={18} color="#10b981" />
          <span style={getSectionTitleStyle('#10b981', '#34d399')}>
            COMPETE
          </span>
          <span style={sectionSubtitleStyle}>
            — Challenge friends or rivals
          </span>
        </div>

        {/* Carousel */}
        <div
          className="carousel-scroll"
          style={carouselContainerStyle}
        >
          {competeCards.map((card, index) => (
            <ThemedGameCard
              key={card.id}
              theme={card.theme}
              title={card.title}
              description={card.description}
              duration={card.duration}
              onClick={card.onClick}
              index={index}
              isTraining={card.isTraining}
            />
          ))}
        </div>
      </div>
    </>
  );
}
